/**
 * Provider Router - Selecciona proveedor IA principal (texto/chat)
 *
 * Esta capa SOLO enruta. La configuración vive en `./aiConfig.js` (FUENTE ÚNICA
 * DE VERDAD). Cero hardcoding de modelos: todo viene de env vars vía aiConfig.
 *
 * Selección del proveedor (cuando IA_PROVIDER='auto', el default):
 *   1. OpenRouter (si OPENROUTER_API_KEY) — soporte multimodal + precios competitivos
 *   2. OpenCode (si OPENCODE_API_KEY)    — cerebro primario (GRATIS via Zen)
 *   3. MiniMax (LEGACY fallback)         — solo si las dos anteriores faltan
 *
 * Si IA_PROVIDER='opencode' | 'openrouter' | 'minimax', se respeta el flag
 * explícito siempre que la key correspondiente exista; si no, se cae a 'auto'.
 *
 * Uso en rutas (compatible con código existente, sin cambios necesarios):
 *   import { getActiveProvider, isOpenCodeActive, createAiAdapter,
 *            IA_PROVIDER_LABEL, esTextoMayormenteIngles } from '../utils/providerRouter.js';
 *
 * El adaptador (`createAiAdapter`) expone la interfaz Gemini-like que ya consumen
 * las rutas (`models.generateContent(params)` / `models.generateContentStream(params)`),
 * mapeando internamente al formato OpenAI-compatible del provider elegido.
 *
 * @author BackendNode
 * @version 2.0.0 (2026-08-08) — refactor a aiConfig, soporte OpenRouter
 */

import opencodeClient from './opencodeClient.js';
import openrouterClient from './openrouterClient.js';
import { MiniMaxAI } from './minimaxClient.js';
import {
  aiConfig,
  IA_PROVIDER_LABEL as _IA_PROVIDER_LABEL,
  getActiveProvider as _getActiveProvider,
  isOpenCodeActive as _isOpenCodeActive,
  providerLabel,
} from './aiConfig.js';

// ─── Re-exports para compatibilidad con código y tests previos ────────────
// (routes/ai.js, routes/interpretacion-legal.js, services/* los importan
// desde aquí desde antes del refactor; los tests de provider-router.test.js
// también dependen de estos exports).
export const IA_PROVIDER_LABEL = _IA_PROVIDER_LABEL;
export { providerLabel };

/**
 * Devuelve el proveedor IA activo (texto/chat).
 * Mantiene la firma `{ name, client, providerLabel }` que esperan los tests
 * y `routes/ai.js`. El `client` puede ser `null` si la key no está
 * configurada (degradación manejada por los adaptadores).
 *
 * @returns {{name: string, client: object|null, providerLabel: string, model: string}}
 */
export function getActiveProvider() {
  const info = _getActiveProvider();
  let client = null;
  if (info.name === 'opencode') client = opencodeClient;
  else if (info.name === 'openrouter') client = openrouterClient;
  // 'minimax' y 'none' se resuelven perezosamente en el adapter.

  return {
    name: info.name,
    client,
    providerLabel: info.providerLabel,
    model: info.model,
  };
}

/**
 * Helper booleano (compat). Útil para servicios que etiquetan respuestas
 * sin necesidad de instanciar el adapter completo.
 */
export function isOpenCodeActive() {
  return _isOpenCodeActive();
}

// ─── Mapeo de parámetros Gemini-like → OpenAI-compatible ───────────────────

/**
 * contents: [{ role: 'model'|'assistant'|'user', parts: [{ text, inlineData? }] }]
 * → messages OpenAI: [{ role: 'assistant'|'user', content: string | Array<{type,text|image_url}> }]
 *
 * Se aplica tanto a OpenCode como a OpenRouter (ambos son OpenAI-compatible).
 */
export function mapContentsToMessages(contents) {
  const messages = [];
  for (const c of Array.isArray(contents) ? contents : []) {
    const role = (c.role === 'model' || c.role === 'assistant') ? 'assistant' : 'user';
    const parts = Array.isArray(c.parts) ? c.parts : (c.parts ? [c.parts] : []);
    const contentParts = [];
    for (const p of parts) {
      if (typeof p === 'string') {
        contentParts.push({ type: 'text', text: p });
      } else if (p && p.text) {
        contentParts.push({ type: 'text', text: p.text });
      } else if (p && p.inlineData && p.inlineData.data) {
        // Visión: convertir base64 → image_url data URI (Qwen VL / modelos multimodales)
        const mime = p.inlineData.mimeType || 'image/png';
        contentParts.push({
          type: 'image_url',
          image_url: { url: `data:${mime};base64,${p.inlineData.data}` },
        });
      }
    }
    if (contentParts.length > 0) {
      // Solo texto → content string (compatibilidad total con el chat actual);
      // con imágenes → content array (necesario para visión OpenAI-compatible).
      const soloTexto = contentParts.every(p => p.type === 'text');
      messages.push({
        role,
        content: soloTexto ? contentParts.map(p => p.text).join('\n') : contentParts,
      });
    }
  }
  return messages;
}

/**
 * tools Gemini-like: [{ functionDeclarations: [{ name, description, parametersJsonSchema }] }]
 * → tools OpenAI: [{ type: 'function', function: { name, description, parameters } }]
 */
function mapTools(configTools) {
  if (!Array.isArray(configTools)) return undefined;
  const tools = [];
  for (const t of configTools) {
    if (t.functionDeclarations) {
      for (const fd of t.functionDeclarations) {
        tools.push({
          type: 'function',
          function: {
            name: fd.name,
            description: fd.description,
            parameters: fd.parametersJsonSchema || fd.parameters,
          },
        });
      }
    }
  }
  return tools.length > 0 ? tools : undefined;
}

function mapToolChoice(toolConfig, tools) {
  if (!toolConfig?.functionCallingConfig) return undefined;
  const { mode, allowedFunctionNames } = toolConfig.functionCallingConfig;
  const hasTools = Array.isArray(tools) && tools.length > 0;

  // ANY: solo se fuerza tool_choice cuando hay UNA ÚNICA función permitida.
  // Con multi-función NUNCA se toma allowedFunctionNames[0] a ciegas.
  if (mode === 'ANY') {
    if (hasTools && Array.isArray(allowedFunctionNames) && allowedFunctionNames.length === 1) {
      return { type: 'function', function: { name: allowedFunctionNames[0] } };
    }
    return hasTools ? 'auto' : undefined;
  }

  if (mode === 'NONE') return 'none';
  return hasTools ? 'auto' : undefined;
}
export { mapToolChoice };

/**
 * Normaliza la respuesta OpenAI-compatible (OpenCode u OpenRouter) a la forma
 * Gemini-like que consumen las rutas: { text, functionCalls, usageMetadata }.
 *
 * Maneja el caso especial de modelos razonadores DeepSeek V4 Flash Free que
 * exponen `reasoning_content`: con `reasoning_effort: none` la respuesta final
 * viene en `content`. Si content viene vacío, se extrae la última parte del
 * reasoning como fallback defensivo.
 */
function normalizeResponse(data) {
  const message = data?.choices?.[0]?.message || {};
  const usage = data?.usage || {};
  const usageMetadata = {
    promptTokenCount: usage.prompt_tokens || 0,
    candidatesTokenCount: usage.completion_tokens || 0,
    totalTokenCount: usage.total_tokens || 0,
  };

  // Respuesta con function calling (tool_calls).
  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    const functionCalls = message.tool_calls.map((toolCall) => {
      let args = {};
      try {
        args = JSON.parse(toolCall.function?.arguments ?? '{}');
      } catch {
        args = { rawArguments: toolCall.function?.arguments };
      }
      return { name: toolCall.function?.name ?? 'desconocida', args };
    });
    return { functionCalls, usageMetadata };
  }

  const content = message.content || '';
  const reasoning = message.reasoning_content || '';

  let text = content;
  if (!text.trim() && reasoning.trim()) {
    const lines = reasoning.split('\n').map(l => l.trim()).filter(Boolean);
    const instructionMarkers = ['Answer in', 'Respond in', 'Respuesta en', 'In Spanish', 'Provide concise', 'Let', 'Need', 'Ensure', 'Answer:'];
    let startIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (instructionMarkers.some(m => line.toLowerCase().includes(m.toLowerCase()))) {
        startIdx = i + 1;
        break;
      }
    }
    const candidate = startIdx > 0 ? lines.slice(startIdx).join('\n') : lines.slice(-3).join('\n');
    text = candidate.trim() || reasoning.slice(-500);
  }

  return { text, usageMetadata };
}
export { normalizeResponse };

/**
 * Detección heurística de inglés dominante en texto (para respuestas IA).
 * Cuenta palabras en inglés comunes vs total. Devuelve true si >35% de las
 * palabras significativas parecen inglés.
 */
export function esTextoMayormenteIngles(texto) {
  if (!texto || texto.length < 40) return false;
  const tokens = texto.toLowerCase().match(/[a-záéíóúñü]+/g) || [];
  if (tokens.length < 10) return false;
  const stopEn = new Set([
    'the','and','for','with','that','this','you','your','are','was','were','have',
    'has','had','not','but','from','they','them','their','there','here','will',
    'would','can','could','should','shall','may','might','must','about','into',
    'over','after','before','between','under','again','further','then','once',
    'when','where','why','how','all','any','both','each','few','more','most',
    'other','some','such','no','nor','only','own','same','so','than','too','very',
    'just','because','does','doing','done','been','being','what','which','who',
    'whom','while','during','also','its','it\'s','i\'m','you\'re','let\'s','please',
    'answer','respond','english','spanish','question','step','steps','need','ensure',
    'provide','concise','below','above','following','brief','short'
  ]);
  let en = 0;
  for (const t of tokens) if (stopEn.has(t)) en++;
  return (en / tokens.length) > 0.35;
}

/**
 * Refuerza que la respuesta final esté en español. Si la respuesta cruda del
 * modelo viene en inglés (deepseek-v4-flash-free a veces ignora el system),
 * se antepone una nota para que el siguiente chunk/refinamiento lo corrija.
 */
export function ensureEspanol(texto) {
  if (!texto || typeof texto !== 'string') return texto;
  if (esTextoMayormenteIngles(texto)) {
    return texto;
  }
  return texto;
}

/**
 * Construye los params OpenAI-compatibles a partir de la firma Gemini-like
 * que usan las rutas (`{ model, contents, config }`).
 *
 * @param {object} params
 * @param {string} [params.model] - override del modelo; si no, se usa el del provider activo
 * @param {Array}  [params.contents=[]]
 * @param {object} [params.config={}] - { systemInstruction, temperature, maxOutputTokens, tools, toolConfig, responseMimeType, responseSchema }
 */
function buildRequestParams(params) {
  const { contents = [], config = {} } = params;
  const tools = mapTools(config.tools);
  return {
    // Si el caller no especifica model, el cliente usará su default (de aiConfig).
    model: params.model,
    system: config.systemInstruction,
    messages: mapContentsToMessages(contents),
    temperature: config.temperature,
    maxTokens: config.maxOutputTokens,
    tools,
    toolChoice: mapToolChoice(config.toolConfig, tools),
    responseFormat: config.responseMimeType === 'application/json'
      ? { type: 'json_object', schema: config.responseSchema }
      : undefined,
  };
}

/**
 * Fábrica de adaptadores por provider. Todos exponen la interfaz Gemini-like:
 *   { provider, models: { generateContent, generateContentStream } }
 *
 * OpenCode y OpenRouter son intercambiables porque ambos son OpenAI-compatible
 * y comparten `mapContentsToMessages` + `normalizeResponse`.
 */
function createOpenCodeAdapter() {
  return {
    provider: 'opencode',
    models: {
      generateContent: async (params) => {
        const data = await opencodeClient.chatCompletion(buildRequestParams(params));
        return normalizeResponse(data);
      },
      generateContentStream: async (params) => {
        return opencodeClient.chatStreamGenerator(buildRequestParams(params));
      },
    },
  };
}

function createOpenRouterAdapter() {
  return {
    provider: 'openrouter',
    models: {
      generateContent: async (params) => {
        const data = await openrouterClient.chatCompletion(buildRequestParams(params));
        return normalizeResponse(data);
      },
      generateContentStream: async (params) => {
        return openrouterClient.chatStreamGenerator(buildRequestParams(params));
      },
    },
  };
}

function createMinimaxAdapter() {
  let instance = null;
  const getInstance = () => {
    if (!aiConfig.hasMinimax) {
      const err = new Error('El servicio de IA no está disponible (MINIMAX_API_KEY no configurada).');
      err.status = 503;
      err.code = 'IA_NO_DISPONIBLE';
      throw err;
    }
    if (!instance) instance = new MiniMaxAI({ apiKey: aiConfig.minimaxApiKey });
    return instance;
  };
  return {
    provider: 'minimax',
    models: {
      generateContent: (params) => getInstance().models.generateContent(params),
      generateContentStream: (params) => getInstance().models.generateContentStream(params),
    },
  };
}

/**
 * Devuelve el adaptador del proveedor IA activo.
 * Selección:
 *   - `IA_PROVIDER` env var fija el provider (override explícito).
 *   - Si está en 'auto' (default) o el provider fijado no tiene key, se usa
 *     la prioridad calculada por `aiConfig.getActiveProvider()`:
 *     openrouter > opencode > minimax.
 *
 * El adaptador es siempre Gemini-like (`models.generateContent / ...Stream`),
 * así las rutas no cambian.
 */
export function createAiAdapter() {
  const info = _getActiveProvider();
  const explicit = aiConfig.IA_PROVIDER;

  // Override explícito válido + key presente → respetar.
  if (explicit === 'openrouter' && aiConfig.hasOpenrouter) return createOpenRouterAdapter();
  if (explicit === 'opencode' && aiConfig.hasOpencode) return createOpenCodeAdapter();
  if (explicit === 'minimax' && aiConfig.hasMinimax) return createMinimaxAdapter();

  // Modo 'auto' (o flag inválido) → usar la prioridad.
  if (info.name === 'openrouter') return createOpenRouterAdapter();
  if (info.name === 'opencode') return createOpenCodeAdapter();
  return createMinimaxAdapter();
}
