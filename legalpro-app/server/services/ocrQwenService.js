/**
 * ocrQwenService.js — Extracción de texto (OCR) con modelo de VISIÓN
 *
 * Pipeline visión → cerebro:
 *   1. Modelo de visión (configurable vía env vars) extrae el texto del
 *      documento/imagen (OCR multimodal). El provider se elige DINÁMICAMENTE
 *      desde `aiConfig.getVisionProvider()`:
 *        - OpenRouter (Qwen VL 8B default, escala a 15B/32B) si OPENROUTER_API_KEY existe
 *        - OpenCode (mimo-v2.5-free, GRATIS) si OPENCODE_API_KEY existe
 *        - MiniMax (LEGACY fallback)
 *   2. El texto extraído se guarda en expedientes.texto_ocr y se alimenta al
 *      cerebro de texto (providerRouter → OpenCode DeepSeek V4 Flash por default)
 *      para el análisis legal.
 *
 * FAIL-OPEN: si el provider primario de visión falla (timeout, 401, 429, etc.),
 * se degrada automáticamente al siguiente en la cadena:
 *   OpenRouter → OpenCode (mimo-v2.5-free) → MiniMax.
 * Esto preserva la disponibilidad del upload aunque un provider específico
 * tenga problemas (créditos agotados, rate limit, outage).
 *
 * Cero hardcoding: los modelos se leen desde `aiConfig.js` (FUENTE ÚNICA DE
 * VERDAD). `OPENROUTER_VISION_MODEL`, `OPENCODE_VISION_MODEL` y
 * `MINIMAX_MODEL_DEFAULT` configuran los IDs sin tocar código.
 *
 * Configuración típica (.env):
 *   OPENROUTER_API_KEY=sk-or-v1-...        # activa Qwen VL para visión
 *   OPENROUTER_VISION_MODEL=qwen/qwen3-vl-32b-instruct   # 32B default (máx precisión)
 *   # Para escalar (con OpenRouter): cambiar a 15B o 32B:
 *   # OPENROUTER_VISION_MODEL=qwen/qwen3-vl-30b-a3b-instruct   # 30B MoE
 *   # OPENROUTER_VISION_MODEL=qwen/qwen3-vl-32b-instruct      # 32B
 *   OPENCODE_API_KEY=sk-...                # fallback GRATIS (mimo-v2.5-free)
 *   VISION_PROVIDER=auto                   # 'auto' | 'openrouter' | 'opencode' | 'minimax'
 *
 * @author BackendNode
 * @version 2.1.0 (2026-08-08) — default Qwen VL 8B (8B → 15B → 32B progresivo)
 */

import opencodeClient from '../utils/opencodeClient.js';
import openrouterClient from '../utils/openrouterClient.js';
import { MiniMaxAI } from '../utils/minimaxClient.js';
import {
  aiConfig,
  getVisionProvider,
  providerLabel as _providerLabel,
} from '../utils/aiConfig.js';
import logger from '../logger.js';

// Prompt OCR en español, enfocado en documentos legales peruanos.
const PROMPT_OCR = `Realiza un OCR (Reconocimiento Óptico de Caracteres) preciso de este documento legal peruano.
Extrae todo el texto legible con exactitud, manteniendo la estructura general del documento
(encabezados, numeración, secciones, fechas, nombres de partes, juzgado, expediente, petitorios).
No agregues introducciones, resúmenes ni comentarios adicionales; devuelve SOLO el texto extraído,
completo y sin omitir información.`;

/**
 * Construye los mensajes OpenAI-compatible (multimodal) a partir de base64.
 * @param {string} base64Data
 * @param {string} mimeType
 */
function _buildVisionMessages(base64Data, mimeType) {
  const mime = mimeType || 'image/png';
  return [
    {
      role: 'user',
      content: [
        { type: 'text', text: PROMPT_OCR },
        { type: 'image_url', image_url: { url: `data:${mime};base64,${base64Data}` } },
      ],
    },
  ];
}

/**
 * Intenta extraer OCR con un cliente específico. Devuelve el texto o lanza.
 */
async function _ocrConOpenrouter(base64Data, mimeType, modelo) {
  const data = await openrouterClient.chatCompletion({
    model: modelo,
    messages: _buildVisionMessages(base64Data, mimeType),
    temperature: 0.1,
    maxTokens: 4096,
    vision: true, // fuerza el modelo de visión por defecto
  });
  return {
    texto: data?.choices?.[0]?.message?.content ?? '',
    usageMetadata: data?.usage
      ? {
          promptTokenCount: data.usage.prompt_tokens ?? 0,
          candidatesTokenCount: data.usage.completion_tokens ?? 0,
          totalTokenCount: data.usage.total_tokens ?? 0,
        }
      : null,
  };
}

async function _ocrConOpencode(base64Data, mimeType, modelo) {
  const data = await opencodeClient.chatCompletion({
    model: modelo,
    messages: _buildVisionMessages(base64Data, mimeType),
    temperature: 0.1,
    maxTokens: 4096,
    vision: true,
  });
  return {
    texto: data?.choices?.[0]?.message?.content ?? '',
    usageMetadata: data?.usage
      ? {
          promptTokenCount: data.usage.prompt_tokens ?? 0,
          candidatesTokenCount: data.usage.completion_tokens ?? 0,
          totalTokenCount: data.usage.total_tokens ?? 0,
        }
      : null,
  };
}

async function _ocrConMinimax(base64Data, mimeType, modelo) {
  if (!aiConfig.hasMinimax) {
    const err = new Error('MINIMAX_API_KEY no configurada');
    err.status = 503;
    err.code = 'IA_NO_DISPONIBLE';
    throw err;
  }
  const mm = new MiniMaxAI({ apiKey: aiConfig.minimaxApiKey });
  const filePart = {
    inlineData: { data: base64Data, mimeType: mimeType || 'image/png' },
  };
  const response = await mm.models.generateContent({
    model: modelo,
    contents: [filePart, PROMPT_OCR],
    config: { temperature: 0.1, maxOutputTokens: 4096 },
  });
  return { texto: response.text ?? '', usageMetadata: response.usageMetadata ?? null };
}

/**
 * Lista ordenada de proveedores de visión a intentar (fail-open chain).
 * Se construye UNA vez al cargar el módulo (snapshot de aiConfig).
 * Solo incluye los providers que tienen key configurada.
 */
const _visionFallbackChain = (() => {
  const chain = [];
  // 1. Provider preferido según getVisionProvider()
  const preferred = getVisionProvider();
  if (preferred.name === 'openrouter' && aiConfig.hasOpenrouter) {
    chain.push({
      name: 'openrouter',
      modelo: preferred.model,
      run: _ocrConOpenrouter,
    });
  }
  if (preferred.name === 'opencode' && aiConfig.hasOpencode) {
    chain.push({
      name: 'opencode',
      modelo: preferred.model,
      run: _ocrConOpencode,
    });
  }
  if (preferred.name === 'minimax' && aiConfig.hasMinimax) {
    chain.push({
      name: 'minimax',
      modelo: preferred.model,
      run: _ocrConMinimax,
    });
  }
  // 2. Fallbacks adicionales en orden: OpenCode (GRATIS) > MiniMax (legacy).
  //    OpenRouter ya está en chain si es el preferido; si no, lo agregamos.
  if (!chain.some(c => c.name === 'openrouter') && aiConfig.hasOpenrouter) {
    chain.push({
      name: 'openrouter',
      modelo: aiConfig.openrouterVisionModel,
      run: _ocrConOpenrouter,
    });
  }
  if (!chain.some(c => c.name === 'opencode') && aiConfig.hasOpencode) {
    chain.push({
      name: 'opencode',
      modelo: aiConfig.opencodeVisionModel,
      run: _ocrConOpencode,
    });
  }
  if (!chain.some(c => c.name === 'minimax') && aiConfig.hasMinimax) {
    chain.push({
      name: 'minimax',
      modelo: aiConfig.minimaxModelDefault,
      run: _ocrConMinimax,
    });
  }
  return chain;
})();

/**
 * Extrae el texto de un documento/imagen usando el provider de visión
 * configurado (decidido por `aiConfig.getVisionProvider()`).
 *
 * Fail-open: si el provider primario falla, se intenta el siguiente de la
 * cadena hasta agotar todos los configurados. Solo lanza error si NINGUNO
 * devuelve texto (o si todos fallan por error técnico).
 *
 * @param {object} params
 * @param {string} params.base64Data - Contenido del archivo en base64.
 * @param {string} [params.mimeType] - MIME del archivo (image/png, application/pdf, etc.).
 * @param {object} [params.opciones] - Opciones extra (no usadas por ahora).
 * @returns {Promise<{texto: string, modelo: string, provider: string, usageMetadata: object|null}>}
 */
export async function extraerTextoOcr({ base64Data, mimeType = 'image/png', opciones = {} }) {
  if (!base64Data) {
    const err = new Error('base64Data es obligatorio para OCR');
    err.status = 400;
    err.code = 'OCR_BAD_INPUT';
    throw err;
  }

  if (_visionFallbackChain.length === 0) {
    const err = new Error(
      'No hay proveedor de visión configurado. Configura OPENROUTER_API_KEY, OPENCODE_API_KEY o MINIMAX_API_KEY.'
    );
    err.status = 503;
    err.code = 'OCR_NO_PROVIDER';
    throw err;
  }

  const errores = [];
  for (const step of _visionFallbackChain) {
    try {
      logger.info('[OCR] Iniciando extracción con proveedor de visión', {
        provider: step.name,
        modelo: step.modelo,
        mimeType,
      });
      const { texto, usageMetadata } = await step.run(base64Data, mimeType, step.modelo);

      if (!texto.trim()) {
        // El provider respondió OK pero sin texto (modelo mudo o filtro).
        // Se considera fallo de "calidad" y se intenta el siguiente.
        errores.push({ provider: step.name, modelo: step.modelo, motivo: 'sin_texto' });
        logger.warn('[OCR] Proveedor no devolvió texto, intentando siguiente', {
          provider: step.name,
        });
        continue;
      }

      logger.info('[OCR] Extracción completada', {
        provider: step.name,
        modelo: step.modelo,
        chars: texto.length,
      });

      return {
        texto,
        modelo: step.modelo,
        provider: step.name,
        usageMetadata: usageMetadata || null,
      };
    } catch (err) {
      errores.push({
        provider: step.name,
        modelo: step.modelo,
        motivo: err?.message || 'error_desconocido',
      });
      logger.warn('[OCR] Falló proveedor, intentando siguiente', {
        provider: step.name,
        error: err?.message,
      });
      // Continúa con el siguiente provider (fail-open).
    }
  }

  // Si llegamos aquí, TODOS los providers fallaron.
  const err = new Error(
    `Todos los proveedores de visión fallaron: ${errores.map(e => `${e.provider} (${e.motivo})`).join('; ')}`
  );
  err.status = 503;
  err.code = 'OCR_ALL_PROVIDERS_FAILED';
  err.detalles = errores;
  throw err;
}

export default { extraerTextoOcr };
