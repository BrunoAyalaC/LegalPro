/**
 * openrouterClient.js — Cliente OpenRouter (OpenAI-compatible)
 *
 * Proveedor IA alternativo a OpenCode Go y MiniMax. OpenRouter agrega acceso
 * unificado a cientos de modelos (DeepSeek, Qwen, Claude, GPT, etc.) con
 * precios competitivos y un único endpoint OpenAI-compatible.
 *
 * Uso principal en LegalPro:
 *  - VISIÓN: `qwen/qwen3-vl-8b-instruct` (por defecto via OPENROUTER_VISION_MODEL).
 *    Escala a 15B o 32B seteando OPENROUTER_VISION_MODEL. NO usar modelos
 *    más grandes (qwen-vl-max, qwen2.5-vl-72b, qwen3-vl-235b) por costo.
 *    cuando OPENROUTER_API_KEY está configurada. Reemplaza al fallback
 *    `mimo-v2.5-free` de OpenCode cuando se requiere mayor calidad OCR.
 *  - TEXTO: `deepseek/deepseek-chat-v3.1:free` (por defecto via OPENROUTER_TEXT_MODEL)
 *    como alternativa económica al cerebro DeepSeek V4 Flash de OpenCode.
 *
 * Documentación oficial (https://openrouter.ai/docs):
 *  - Endpoint base: https://openrouter.ai/api/v1
 *  - Headers OBLIGATORIOS (rechazan requests sin ellos):
 *      HTTP-Referer: <URL pública de tu app>   (ranking en OpenRouter)
 *      X-Title: <Nombre de tu app>             (mostrado en dashboard)
 *  - Auth: `Authorization: Bearer <OPENROUTER_API_KEY>`
 *  - Formato: idéntico a OpenAI Chat Completions (compatible con
 *    mapContentsToMessages de providerRouter.js).
 *
 * Configuración (.env):
 *   OPENROUTER_API_KEY=sk-or-v1-...
 *   OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
 *   OPENROUTER_VISION_MODEL=qwen/qwen3-vl-8b-instruct   (default, 8B barato)
 *   OPENROUTER_TEXT_MODEL=deepseek/deepseek-chat-v3.1:free
 *   OPENROUTER_TEMPERATURE=0.2
 *   OPENROUTER_MAX_TOKENS=8192
 *   APP_REFERER=https://legalpro.ai   (opcional, default)
 *   APP_TITLE=LegalPro                (opcional, default)
 *
 * Esta es la FUENTE DE CONFIGURACIÓN: NO hardcodear IDs de modelo aquí.
 * Todos los modelos se leen desde `../utils/aiConfig.js`.
 *
 * @author BackendNode
 * @version 1.0.0 (2026-08-08)
 */

import aiConfig from './aiConfig.js';

export class OpenRouterError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'OpenRouterError';
    this.status = status;
    this.code = code;
  }
}

function _authHeaders() {
  if (!aiConfig.openrouterApiKey) {
    throw new OpenRouterError(
      'OPENROUTER_API_KEY no configurada',
      500,
      'CONFIG_MISSING'
    );
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${aiConfig.openrouterApiKey}`,
    // Headers OBLIGATORIOS para OpenRouter (rechazan requests sin ellos).
    // Ver https://openrouter.ai/docs#requests — sin estos, 400 Bad Request.
    'HTTP-Referer': aiConfig.appReferer,
    'X-Title': aiConfig.appTitle,
  };
}

/**
 * Chat completions (OpenAI-compatible via OpenRouter).
 *
 * Soporta los mismos parámetros que opencodeClient.js:
 *  - model, system, messages, temperature, maxTokens
 *  - tools (function calling formato OpenAI)
 *  - toolChoice: 'auto' | 'none' | { type: 'function', function: { name } }
 *  - responseFormat: { type: 'json_object', schema? }
 *  - vision: true → llamada multimodal (image_url en messages)
 *
 * @param {object} opts
 * @returns {Promise<object>} respuesta cruda OpenAI-compatible
 */
async function chatCompletion({
  model,
  system,
  messages = [],
  temperature,
  maxTokens,
  tools,
  toolChoice,
  responseFormat,
  vision,
} = {}) {
  // Para visión: usar el modelo de visión por defecto; para texto: el de texto.
  const resolvedModel = model
    || (vision ? aiConfig.openrouterVisionModel : aiConfig.openrouterTextModel);

  const url = `${aiConfig.openrouterBaseUrl}/chat/completions`;
  const body = {
    model: resolvedModel,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages,
    ],
    temperature: temperature ?? aiConfig.openrouterTemperature,
    max_tokens: maxTokens ?? aiConfig.openrouterMaxTokens,
  };
  if (Array.isArray(tools) && tools.length > 0) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;
  if (responseFormat) body.response_format = responseFormat;

  const res = await fetch(url, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new OpenRouterError(
      `OpenRouter API error ${res.status}: ${errText.slice(0, 200)}`,
      res.status,
      'API_ERROR'
    );
  }

  return await res.json();
}

/**
 * Streaming SSE (OpenAI-compatible) — async generator.
 * Yield: { text, usageMetadata } — interfaz compatible con
 * `models.generateContentStream` que consumen las rutas de LegalPro.
 */
async function* chatStreamGenerator({
  model,
  system,
  messages = [],
  temperature,
  maxTokens,
  tools,
  toolChoice,
  responseFormat,
  vision,
} = {}) {
  const resolvedModel = model
    || (vision ? aiConfig.openrouterVisionModel : aiConfig.openrouterTextModel);

  const url = `${aiConfig.openrouterBaseUrl}/chat/completions`;
  const body = {
    model: resolvedModel,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages,
    ],
    temperature: temperature ?? aiConfig.openrouterTemperature,
    max_tokens: maxTokens ?? aiConfig.openrouterMaxTokens,
    stream: true,
  };
  if (Array.isArray(tools) && tools.length > 0) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;
  if (responseFormat) body.response_format = responseFormat;

  const res = await fetch(url, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new OpenRouterError(
      `OpenRouter stream error ${res.status}: ${errText.slice(0, 200)}`,
      res.status,
      'API_ERROR'
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const chunkText = json?.choices?.[0]?.delta?.content ?? '';
        const usage = json?.usage;
        yield {
          text: chunkText,
          usageMetadata: usage ? {
            promptTokenCount: usage.prompt_tokens ?? 0,
            candidatesTokenCount: usage.completion_tokens ?? 0,
            totalTokenCount: usage.total_tokens ?? 0,
          } : null,
        };
      } catch {
        /* ignorar chunks parciales / mal formados */
      }
    }
  }
}

/**
 * Texto simple (helper de alto nivel).
 */
async function generateText(prompt, options = {}) {
  const data = await chatCompletion({
    system: options.system,
    messages: [{ role: 'user', content: prompt }],
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });
  return data?.choices?.[0]?.message?.content ?? '';
}

/**
 * Embeddings (para RAG). OpenRouter expone `/embeddings` con varios modelos;
 * se usa el modelo de embeddings por defecto. Si no hay modelo configurado,
 * se intenta `openai/text-embedding-3-small` (disponible en OpenRouter).
 */
async function embeddings(input) {
  const url = `${aiConfig.openrouterBaseUrl}/embeddings`;
  const model = aiConfig.openrouterEmbeddingModel || 'openai/text-embedding-3-small';
  const res = await fetch(url, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify({ model, input }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new OpenRouterError(
      `OpenRouter embeddings error ${res.status}: ${errText.slice(0, 200)}`,
      res.status,
      'API_ERROR'
    );
  }
  return (await res.json())?.data?.[0]?.embedding ?? [];
}

/**
 * Streaming con callback (helper onChunk) — usado por opencodeClient compat.
 */
async function chatStream({ system, messages, temperature, maxTokens, onChunk } = {}) {
  for await (const chunk of chatStreamGenerator({ system, messages, temperature, maxTokens })) {
    if (chunk.text && onChunk) onChunk(chunk.text);
  }
}

export const openrouterClient = Object.freeze({
  // API principal (mismo contrato que opencodeClient → intercambiables).
  chatCompletion,
  chatStreamGenerator,
  chatStream,
  generateText,
  embeddings,
  // Metadata.
  isConfigured: () => !!aiConfig.openrouterApiKey,
  model: aiConfig.openrouterTextModel,
  visionModel: aiConfig.openrouterVisionModel,
  provider: 'openrouter',
  providerLabel: `OpenRouter (texto: ${aiConfig.openrouterTextModel}, visión: ${aiConfig.openrouterVisionModel})`,
  // Error class exportado para captura específica.
  OpenRouterError,
});

export default openrouterClient;
