/**
 * OpenCode Client - Cliente DeepSeek V4 Flash vía OpenCode Zen
 *
 * Reemplaza a minimaxClient.js y geminiClient.js como proveedor IA
 * principal del producto LegalPro.
 *
 * Proveedor: OPENCODE ZEN (AI gateway de OpenCode)
 * Modelo: deepseek-v4-flash (DeepSeek V4 Flash)
 * Compatible: OpenAI-compatible API (chat completions)
 *
 * ENDPOINT CORRECTO (verificado 2026-08-07 en docs oficiales):
 *   https://opencode.ai/zen/v1/chat/completions
 *   (el endpoint /api/v1 NO existe -> devolvía 404)
 *
 * Modelos disponibles (docs OpenCode Zen):
 *   - deepseek-v4-flash        (DeepSeek V4 Flash, $0.14/$0.28)
 *   - deepseek-v4-flash-free   (¡GRATIS por tiempo limitado!)
 *   - deepseek-v4-pro          ($1.74/$3.48)
 *   - mimo-v2.5-free           (MiMo V2.5 visión, ¡GRATIS!)
 *
 * Configuración (.env):
 *   OPENCODE_API_KEY=sk-...
 *   OPENCODE_BASE_URL=https://opencode.ai/zen/v1
 *   OPENCODE_MODEL=deepseek-v4-flash
 *   OPENCODE_TEMPERATURE=0.2
 *   OPENCODE_MAX_TOKENS=8192
 */

const OPENCODE_API_KEY = process.env.OPENCODE_API_KEY;
const OPENCODE_BASE_URL = process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/v1';
const OPENCODE_MODEL = process.env.OPENCODE_MODEL || 'deepseek-v4-flash-free';
const OPENCODE_TEMPERATURE = parseFloat(process.env.OPENCODE_TEMPERATURE || '0.2');
const OPENCODE_MAX_TOKENS = parseInt(process.env.OPENCODE_MAX_TOKENS || '8192');
// Modelo de VISIÓN configurable para OCR/extracción multimodal.
// FIX 2026-08-08: usuario eligió qwen3-vl-32b-instruct (mejor precisión del
// rango 8B/15B/32B, $0.10/$0.42 por 1M tok, no 'thinking', sin 72B/235B).
// Pipeline: imagen → Qwen VL 32B extrae texto → deepseek-v4-flash-free analiza
// el caso (con texto + RAG + sistema multi-junior). Se puede bajar a 8B/15B
// seteando OPENCODE_VISION_MODEL (8B: 'qwen3-vl-8b-instruct', 15B MoE:
// 'qwen3-vl-30b-a3b-instruct'). NO usar modelos más grandes.
const OPENCODE_VISION_MODEL = process.env.OPENCODE_VISION_MODEL || 'qwen3-vl-32b-instruct';

class OpenCodeError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'OpenCodeError';
    this.status = status;
    this.code = code;
  }
}

function getAuthHeaders() {
  if (!OPENCODE_API_KEY) throw new OpenCodeError('OPENCODE_API_KEY no configurada', 500, 'CONFIG_MISSING');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENCODE_API_KEY}`,
  };
}

/**
 * Chat completions (OpenAI-compatible)
 *
 * Soporta adicionalmente (aditivo, opcional):
 *  - model: override del modelo por defecto (p.ej. desde el body de la petición)
 *  - tools: function calling en formato OpenAI
 *  - toolChoice: 'auto' | 'none' | { type: 'function', function: { name } }
 *  - responseFormat: { type: 'json_object', schema? } para salidas estructuradas
 *  - vision: true indica llamada multimodal (OCR/imágenes). En ese modo NO se
 *    envía `reasoning_effort: none` (parámetro específico de los modelos
 *    DeepSeek razonadores; algunos modelos de visión lo rechazan).
 *
 *  IMPORTANTE (multimodal): `messages[].content` puede ser un STRING (solo
 *  texto) o un ARRAY de partes OpenAI-compatible:
 *    content: [
 *      { type: 'text', text: '...' },
 *      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } },
 *    ]
 *  El body se serializa tal cual, así que el array de partes llega intacto.
 */
async function chatCompletion({ model, system, messages = [], temperature, maxTokens, tools, toolChoice, responseFormat, vision }) {
  const url = `${OPENCODE_BASE_URL}/chat/completions`;
  const body = {
    model: model || OPENCODE_MODEL,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages,
    ],
    temperature: temperature ?? OPENCODE_TEMPERATURE,
    max_tokens: maxTokens ?? OPENCODE_MAX_TOKENS,
    // FIX 2026-08-07: desactivar razonamiento visible. DeepSeek V4 Flash Free
    // devuelve su cadena de pensamiento en reasoning_content y a veces deja
    // content vacío. Con reasoning_effort=none la respuesta final va en content.
    // En llamadas de visión (vision: true) NO se envía (ver docs arriba).
  };
  if (!vision) body.reasoning_effort = 'none';
  if (Array.isArray(tools) && tools.length > 0) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;
  if (responseFormat) body.response_format = responseFormat;

  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new OpenCodeError(`OpenCode API error ${res.status}: ${errText.slice(0, 200)}`, res.status, 'API_ERROR');
  }

  const data = await res.json();
  return data;
}

/**
 * Texto simple (generación)
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
 * Chat con historial
 */
async function chat(messages, options = {}) {
  const data = await chatCompletion({
    system: options.system,
    messages,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });
  return data;
}

/**
 * Streaming (SSE) - OpenAI-compatible
 */
async function chatStream({ system, messages, temperature, maxTokens, onChunk }) {
  const url = `${OPENCODE_BASE_URL}/chat/completions`;
  const body = {
    model: OPENCODE_MODEL,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages,
    ],
    temperature: temperature ?? OPENCODE_TEMPERATURE,
    max_tokens: maxTokens ?? OPENCODE_MAX_TOKENS,
    stream: true,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new OpenCodeError(`OpenCode stream error ${res.status}: ${errText.slice(0, 200)}`, res.status, 'API_ERROR');
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
        const chunk = json?.choices?.[0]?.delta?.content ?? '';
        if (chunk && onChunk) onChunk(chunk);
      } catch { /* ignore partial */ }
    }
  }
}

/**
 * Streaming (SSE) como async generator.
 * Yield: { text, usageMetadata } — interfaz compatible con los consumidores
 * existentes de `models.generateContentStream` (chunk.text / chunk.usageMetadata).
 */
async function* chatStreamGenerator({ model, system, messages = [], temperature, maxTokens, tools, toolChoice, responseFormat, vision }) {
  const url = `${OPENCODE_BASE_URL}/chat/completions`;
  const body = {
    model: model || OPENCODE_MODEL,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages,
    ],
    temperature: temperature ?? OPENCODE_TEMPERATURE,
    max_tokens: maxTokens ?? OPENCODE_MAX_TOKENS,
    stream: true,
    // FIX 2026-08-07: desactivar razonamiento visible en streaming también.
    // En llamadas de visión (vision: true) NO se envía.
  };
  if (!vision) body.reasoning_effort = 'none';
  if (Array.isArray(tools) && tools.length > 0) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;
  if (responseFormat) body.response_format = responseFormat;

  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new OpenCodeError(`OpenCode stream error ${res.status}: ${errText.slice(0, 200)}`, res.status, 'API_ERROR');
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
      } catch { /* ignore partial */ }
    }
  }
}

/**
 * Embeddings (para RAG) - OpenAI-compatible
 */
async function embeddings(input) {
  const url = `${OPENCODE_BASE_URL}/embeddings`;
  const body = { model: OPENCODE_MODEL, input };
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new OpenCodeError(`Embeddings error ${res.status}`, res.status, 'API_ERROR');
  return (await res.json())?.data?.[0]?.embedding ?? [];
}

export const opencodeClient = {
  chatCompletion,
  generateText,
  chat,
  chatStream,
  chatStreamGenerator,
  embeddings,
  isConfigured: () => !!OPENCODE_API_KEY,
  model: OPENCODE_MODEL,
  visionModel: OPENCODE_VISION_MODEL,
  provider: 'opencode',
  providerLabel: 'DeepSeek V4 Flash (OpenCode Go)',
};

export default opencodeClient;
