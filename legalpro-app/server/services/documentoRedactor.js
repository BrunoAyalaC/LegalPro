/**
 * Documento Redactor - Redacta el contenido estructurado de un escrito legal
 * a partir de una conversación, usando el proveedor IA activo + RAG.
 *
 * Usa OpenCode/DeepSeek V4 Flash por defecto y MiniMax como fallback
 * (vía providerRouter), igual que el resto de rutas IA del proyecto.
 *
 * Seguridad:
 * - Sanitiza la conversación con sanitizarPrompt (OWASP LLM01 — prompt injection).
 * - Envuelve el contenido del usuario con envolverContenidoUsuario (LPDP Art. 21).
 * - El contexto legal RAG se inyecta como VERIFICADO: el prompt instruye al
 *   modelo a no inventar normas (anti-alucinación).
 */

import { createAiAdapter, isOpenCodeActive } from '../utils/providerRouter.js';
import { withLegalBase } from '../utils/systemPromptBase.js';
// FIX 2026-08-07: la ruta correcta del RAG es ../../../tools/rag (raíz del repo).
// legalpro-app/tools/rag no existe; el wrapper vive en <raíz>/tools/rag/.
import { consultarBaseLegal } from '../../../tools/rag/junior-rag-wrapper.mjs';
import { sanitizarPrompt, envolverContenidoUsuario } from '../middleware/promptSanitizer.js';
import logger from '../logger.js';

const MAX_MENSAJES = 20;

// Modelo por defecto según el proveedor activo (OpenCode > MiniMax).
const MODEL = isOpenCodeActive()
  ? (process.env.OPENCODE_MODEL || 'deepseek-v4-flash-free')
  : (process.env.MINIMAX_MODEL_DEFAULT || 'MiniMax-M3');

// Inicialización perezosa del adaptador IA.
let _ai = null;
function getAi() {
  if (!_ai) _ai = createAiAdapter();
  return _ai;
}

const SYSTEM_REDACTOR = withLegalBase(`Eres un abogado senior peruano experto en redacción de escritos judiciales.
A partir de la conversación del usuario, redacta el documento legal solicitado con la
estructura del Poder Judicial peruano.

Genera SOLO JSON válido con este formato:
{
  "sumilla": "la sumilla del escrito (máx 2 líneas)",
  "fundamentos": ["fundamento 1 con cita legal", "fundamento 2", ...],
  "petitorio": "lo que se solicita al juez",
  "base_legal": ["Art. X de la Ley Y", "Art. Z del Código W"],
  "otrosi_primero": "representación o domicilio procesal",
  "otrosi_segundo": "poder especial si aplica"
}

REGLAS:
- Usa SOLO la base legal del contexto RAG proporcionado (no inventes)
- Cita artículos con precisión
- Lenguaje formal forense peruano`);

// ─── Helpers de normalización de conversación (mismos criterios que el detector) ─

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

/** Sanitiza y envuelve cada mensaje para prevenir prompt injection. */
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

// ─── Redacción del documento estructurado ─────────────────────────────────────

/**
 * Redacta el documento estructurado desde la conversación.
 *
 * @param {object} params
 * @param {Array} params.conversacion - Mensajes del chat
 * @param {string} params.tipoDocumento - Tipo detectado (demanda, apelacion, ...)
 * @param {string} [params.materia] - Materia legal
 * @param {string} [params.baseLegalContexto] - Contexto legal ya recuperado (RAG)
 * @param {string} [params.numeroExpediente] - Número de expediente
 * @returns {Promise<object>} { sumilla, fundamentos, petitorio, base_legal, otrosi_primero, otrosi_segundo, ... }
 */
export async function redactarDocumento({
  conversacion,
  tipoDocumento,
  materia = 'general',
  baseLegalContexto = '',
  numeroExpediente = '',
}) {
  const mensajes = normalizarConversacion(conversacion);
  const mensajesSanitizados = sanitizarConversacion(mensajes);

  // RAG: si no recibimos contexto legal, intentar recuperarlo (fail-open).
  let ragContexto = baseLegalContexto;
  if (!ragContexto && mensajes.length > 0) {
    try {
      const query = mensajes.map((m) => m.contenido).join(' ');
      if (query.trim().length >= 5) {
        const baseLegal = await consultarBaseLegal({
          materia,
          consulta: query.substring(0, 500),
          contexto: numeroExpediente || '',
        });
        ragContexto = baseLegal?.contexto || '';
      }
    } catch (err) {
      logger.warn('[documento-redactor] RAG no disponible, continúa sin contexto:', err.message);
    }
  }

  const conversacionTexto = mensajesSanitizados
    .map((m) => `${m.rol}: ${m.contenido}`)
    .join('\n');

  const prompt = `Tipo de documento: ${tipoDocumento}
Materia: ${materia}
Número de expediente: ${numeroExpediente || 'Por asignar'}

CONTEXTO LEGAL VERIFICADO (RAG):
${ragContexto || 'No se recuperó contexto adicional'}

CONVERSACIÓN DEL USUARIO:
${conversacionTexto}

Redacta el documento completo.`;

  try {
    const response = await getAi().models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM_REDACTOR,
        maxOutputTokens: 4096,
        temperature: 0.1,
      },
    });

    const data = parsearJsonDeRespuesta(response?.text ?? '');
    if (data && (data.sumilla || data.petitorio || (Array.isArray(data.fundamentos) && data.fundamentos.length > 0))) {
      return {
        sumilla: typeof data.sumilla === 'string' && data.sumilla ? data.sumilla : 'Escrito presentado por el solicitante',
        fundamentos: Array.isArray(data.fundamentos)
          ? data.fundamentos.filter((f) => typeof f === 'string' && f.trim().length > 0)
          : [],
        petitorio: typeof data.petitorio === 'string' ? data.petitorio : '',
        base_legal: Array.isArray(data.base_legal)
          ? data.base_legal.filter((b) => typeof b === 'string' && b.trim().length > 0)
          : [],
        otrosi_primero: typeof data.otrosi_primero === 'string' ? data.otrosi_primero : '',
        otrosi_segundo: typeof data.otrosi_segundo === 'string' ? data.otrosi_segundo : '',
        tokens: response?.usageMetadata?.totalTokenCount ?? null,
        provider: isOpenCodeActive() ? 'opencode' : 'minimax',
        model: MODEL,
      };
    }
  } catch (err) {
    logger.warn('[documento-redactor] Error al llamar al proveedor IA:', err.message);
  }

  // Fallback: estructura básica si el proveedor falla o devuelve JSON inválido.
  return {
    sumilla: 'Escrito presentado por el solicitante',
    fundamentos: [],
    petitorio: 'Se sirva admitir el presente escrito y dar trámite conforme a ley.',
    base_legal: [],
    otrosi_primero: '',
    otrosi_segundo: '',
    tokens: null,
    provider: isOpenCodeActive() ? 'opencode' : 'minimax',
    model: MODEL,
  };
}
