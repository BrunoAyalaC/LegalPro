/**
 * Documento Detector - Detecta el tipo de documento legal
 * a partir de una conversación de chat.
 *
 * Usa el proveedor IA activo (OpenCode/DeepSeek V4 Flash por defecto,
 * MiniMax como fallback vía providerRouter) para analizar la conversación
 * y decidir qué documento corresponde.
 *
 * Seguridad:
 * - Sanitiza la conversación con sanitizarPrompt (OWASP LLM01 — prompt injection).
 * - Envuelve el contenido del usuario con envolverContenidoUsuario (LPDP Art. 21).
 * - La base legal se recupera vía RAG en modo fail-open: si RAG falla, la
 *   detección continúa sin contexto (no bloquea la respuesta).
 */

import { createAiAdapter, isOpenCodeActive } from '../utils/providerRouter.js';
import { withLegalBase } from '../utils/systemPromptBase.js';
import { consultarBaseLegal } from '../../../tools/rag/junior-rag-wrapper.mjs';
import { sanitizarPrompt, envolverContenidoUsuario } from '../middleware/promptSanitizer.js';
import logger from '../logger.js';

const TIPOS_DOCUMENTO = Object.freeze([
  'demanda', 'contestacion', 'apelacion', 'casacion', 'amparo',
  'habeas_corpus', 'escrito_simple', 'alegato', 'denuncia',
  'contrato', 'dictamen', 'pericial', 'medida_cautelar', 'resumen', 'custodia',
]);

const MAX_MENSAJES = 20;

// Modelo por defecto según el proveedor activo (OpenCode > MiniMax), mismo
// criterio que routes/ai.js para etiquetar correctamente cada respuesta.
const MODEL = isOpenCodeActive()
  ? (process.env.OPENCODE_MODEL || 'deepseek-v4-flash-free')
  : (process.env.MINIMAX_MODEL_DEFAULT || 'MiniMax-M3');

// Inicialización perezosa del adaptador IA (no tumbe el arranque si falta API key).
let _ai = null;
function getAi() {
  if (!_ai) _ai = createAiAdapter();
  return _ai;
}

const SYSTEM_DETECTOR = withLegalBase(`Eres un asistente legal que DETECTA qué tipo de documento necesita el usuario.
Analiza la conversación y determina:
1. El tipo de documento más apropiado (uno de: ${TIPOS_DOCUMENTO.join(', ')})
2. La materia legal (penal, civil, laboral, tributario, constitucional, familiar, etc.)
3. Un título descriptivo para el documento

Responde SOLO en JSON válido con este formato:
{
  "tipo": "demanda",
  "materia": "laboral",
  "titulo": "Demanda Laboral por Despido Arbitrario",
  "confianza": 0.9,
  "razon": "La conversación describe un despido sin causa"
}`);

// ─── Helpers de normalización de conversación ─────────────────────────────────

/** Extrae el texto de un mensaje, soportando los formatos usados por el frontend. */
function extraerTextoMensaje(m) {
  if (typeof m === 'string') return m;
  if (!m || typeof m !== 'object') return '';
  return m.contenido || m.mensaje || m.text || m.content || '';
}

/** Extrae el rol de un mensaje (default: usuario). */
function extraerRolMensaje(m) {
  if (typeof m === 'string') return 'usuario';
  return m?.rol || 'usuario';
}

/** Normaliza y recorta la conversación a los últimos N mensajes con texto. */
function normalizarConversacion(conversacion) {
  return (conversacion || [])
    .slice(-MAX_MENSAJES)
    .map((m) => ({
      rol: extraerRolMensaje(m),
      contenido: extraerTextoMensaje(m),
    }))
    .filter((m) => typeof m.contenido === 'string' && m.contenido.trim().length > 0);
}

/**
 * Sanitiza cada mensaje y envuelve el contenido del usuario en un bloque
 * marcado como datos (no instrucciones). Previene indirect prompt injection.
 */
function sanitizarConversacion(mensajes) {
  return mensajes.map((m) => {
    const { sanitizado } = sanitizarPrompt(m.contenido, 'escrito');
    const label = m.rol === 'usuario' ? 'MENSAJE_USUARIO' : 'MENSAJE_ASISTENTE';
    return {
      rol: m.rol,
      contenido: envolverContenidoUsuario(sanitizado || '(mensaje vacío)', label),
    };
  });
}

/** Parsea JSON tolerando markdown/bloques de código que el modelo pueda añadir. */
function parsearJsonDeRespuesta(respuesta) {
  if (!respuesta || typeof respuesta !== 'string') return null;
  try {
    return JSON.parse(respuesta.trim());
  } catch {
    const match = respuesta.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

// ─── Detección de tipo de documento ───────────────────────────────────────────

/**
 * Detecta el tipo de documento a partir de una conversación de chat.
 *
 * @param {Array<{rol?: string, contenido?: string, mensaje?: string, text?: string}>} conversacion
 * @param {object} [contexto]
 * @param {string} [contexto.materia] - Materia legal sugerida (penal, civil, ...)
 * @param {string} [contexto.numeroExpediente] - Número de expediente asociado
 * @returns {Promise<object>} { tipo, materia, titulo, confianza, razon, base_legal, rag_context, ... }
 */
export async function detectarTipoDocumento(conversacion, contexto = {}) {
  const mensajes = normalizarConversacion(conversacion);
  const mensajesSanitizados = sanitizarConversacion(mensajes);

  // Buscar base legal relevante (RAG opcional, fail-open).
  let baseLegal = null;
  try {
    const query = mensajes.map((m) => m.contenido).join(' ');
    if (query.trim().length >= 5) {
      baseLegal = await consultarBaseLegal({
        materia: contexto.materia || 'general',
        consulta: query.substring(0, 500),
        contexto: contexto.numeroExpediente || '',
      });
    }
  } catch (err) {
    logger.warn('[documento-detector] RAG no disponible, continúa sin contexto:', err.message);
    baseLegal = null;
  }

  const conversacionTexto = mensajesSanitizados
    .map((m) => `${m.rol}: ${m.contenido}`)
    .join('\n');

  const prompt = `Conversación del usuario:\n${conversacionTexto}\n\nDetermina el documento que necesita.`;

  try {
    const response = await getAi().models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM_DETECTOR,
        maxOutputTokens: 500,
        temperature: 0.1,
      },
    });

    const data = parsearJsonDeRespuesta(response?.text ?? '');
    if (data && typeof data.tipo === 'string' && data.tipo) {
      // Validar que el tipo sea conocido; si el modelo alucina, degradar seguro.
      const tipoValido = TIPOS_DOCUMENTO.includes(data.tipo);
      return {
        tipo: tipoValido ? data.tipo : 'escrito_simple',
        materia: typeof data.materia === 'string' ? data.materia : (contexto.materia || 'general'),
        titulo: typeof data.titulo === 'string' ? data.titulo : 'Escrito',
        confianza: typeof data.confianza === 'number' ? data.confianza : 0.5,
        razon: typeof data.razon === 'string' ? data.razon : '',
        base_legal: baseLegal?.chunks_usados > 0 ? (baseLegal.citaciones || []) : [],
        rag_context: baseLegal?.contexto || '',
        tokens: response?.usageMetadata?.totalTokenCount ?? null,
        provider: isOpenCodeActive() ? 'opencode' : 'minimax',
        model: MODEL,
      };
    }
  } catch (err) {
    logger.warn('[documento-detector] Error al llamar al proveedor IA:', err.message);
  }

  // Fallback determinístico si el proveedor falla o devuelve JSON inválido.
  return {
    tipo: 'escrito_simple',
    materia: contexto.materia || 'general',
    titulo: 'Escrito',
    confianza: 0.5,
    razon: 'No se pudo determinar el tipo exacto',
    base_legal: baseLegal?.chunks_usados > 0 ? (baseLegal.citaciones || []) : [],
    rag_context: baseLegal?.contexto || '',
    tokens: null,
    provider: isOpenCodeActive() ? 'opencode' : 'minimax',
    model: MODEL,
  };
}

export { TIPOS_DOCUMENTO };
