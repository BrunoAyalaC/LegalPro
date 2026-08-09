/**
 * Router de Intenciones del Chat LegalPro/LexIA — TOOL EXECUTOR (FASE 1 + FASE 2)
 *
 * Convierte el mensaje del usuario en una HERRAMIENTA REAL (Function Calling
 * REAL, no fake): ejecuta los servicios reales del backend:
 *   - redactar_documento    → services/documentoRedactor.js
 *   - calcular_plazo        → utils/feriados.js + catalogs/plazos-procesales.json
 *   - analizar_expediente   → DB (expedientes.texto_ocr) + RAG + LLM structured
 *   - buscar_jurisprudencia → RAG (tools/rag/junior-rag-wrapper.mjs) — NUNCA inventar
 *   - predecir_resultado    → flujo predictor (declaration emitirPrediccion)
 *
 * FASE 0 (regex determinista) vive en intentFase0.js.
 *
 * Reglas duras:
 *  - Fail-open: si cualquier fase falla, enrutarMensaje devuelve null y la ruta
 *    cae a la llamada directa normal (NUNCA 500 por el router).
 *  - Temperatura router (FASE 1) 0.1 (determinismo legal); ejecución (FASE 2) 0.2-0.4.
 *  - NUNCA devolver los args del modelo como resultado: siempre se ejecuta la tool.
 *  - NUNCA inventar jurisprudencia: buscar_jurisprudencia exige grounding RAG.
 *
 * Skill: .opencode/skills/enrutamiento-intenciones-chat.md
 * Catálogo: catalogs/chat-intent-functions.json
 *
 * @author BackendNode
 */

import { createAiAdapter, isOpenCodeActive } from './providerRouter.js';
import { sumarDiasHabiles, esDiaHabil, getDiasNoHabilesDelAnio } from './feriados.js';
import { redactarDocumento } from '../services/documentoRedactor.js';
import { sanitizarPrompt } from '../middleware/promptSanitizer.js';
import logger from '../logger.js';
import db from '../db.js';
import { readFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join, resolve } from 'path';
import {
  normalizar,
  detectarIntencionFase0,
  resolverPlazoId,
  detectarTipoDocumentoTexto,
  extraerUuid,
  MATERIAS,
} from './intentFase0.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Rutas a catálogos de la RAÍZ del repo ──────────────────────────────────
const FUNCTIONS_PATH = resolve(__dirname, '../../../catalogs/chat-intent-functions.json');
const PLAZOS_PATH = resolve(__dirname, '../../../catalogs/plazos-procesales.json');
const DISCLAIMERS_PATH = resolve(__dirname, '../../../catalogs/disclaimers-ia.json');
const RAG_MODULE_URL = pathToFileURL(resolve(__dirname, '../../../tools/rag/junior-rag-wrapper.mjs')).href;

const MODEL = isOpenCodeActive()
  ? (process.env.OPENCODE_MODEL || 'deepseek-v4-flash-free')
  : (process.env.MINIMAX_MODEL_DEFAULT || 'MiniMax-M3');

// Inicialización perezosa del adaptador IA (OpenCode primero, MiniMax fallback).
let _ai = null;
function getAi() {
  if (!_ai) _ai = createAiAdapter();
  return _ai;
}

// ─── Catálogo de functions (única fuente de verdad) ─────────────────────────
let _catalogoTools = null;
export function getCatalogoTools() {
  if (!_catalogoTools) {
    try {
      const cat = JSON.parse(readFileSync(FUNCTIONS_PATH, 'utf-8'));
      _catalogoTools = Array.isArray(cat.tools) ? cat.tools : [];
    } catch (err) {
      logger.warn('[intent-router] No se pudo cargar chat-intent-functions.json:', err.message);
      _catalogoTools = [];
    }
  }
  return _catalogoTools;
}

// ─── Catálogo de plazos procesales ──────────────────────────────────────────
let _plazosCache = null;
function loadPlazos() {
  if (!_plazosCache) _plazosCache = JSON.parse(readFileSync(PLAZOS_PATH, 'utf-8'));
  return _plazosCache;
}

// ─── Disclaimers canónicos (catalogs/disclaimers-ia.json) ───────────────────
let _disclaimersCache = null;
function loadDisclaimers() {
  if (!_disclaimersCache) {
    try {
      _disclaimersCache = JSON.parse(readFileSync(DISCLAIMERS_PATH, 'utf-8')).disclaimers || [];
    } catch {
      _disclaimersCache = [];
    }
  }
  return _disclaimersCache;
}
function getDisclaimer(id) {
  const d = loadDisclaimers().find((x) => x.id === id);
  return d ? d.texto : '';
}
const DISCLAIMER_GENERAL = getDisclaimer('disclaimer_general');
const DISCLAIMER_REDACTOR = getDisclaimer('disclaimer_redactor');
const DISCLAIMER_PREDICTOR = getDisclaimer('disclaimer_predictor');

// ─── Metadata de tipo_respuesta para la UI (contrato frontend) ───────────────
// Cada intención enrutada expone un `tipo_respuesta` ESTABLE para que el
// frontend renderice distinto por tipo (tarjeta de plazo, escrito descargable,
// análisis, jurisprudencia, predicción). Respuestas sin tool → 'respuesta'.
export const INTENT_TO_TIPO_RESPUESTA = {
  redactar_documento: 'escrito',
  calcular_plazo: 'plazo',
  analizar_expediente: 'analisis',
  buscar_jurisprudencia: 'jurisprudencia',
  predecir_resultado: 'prediccion',
};

/** Devuelve el tipo_respuesta canónico de una intención (default: 'respuesta'). */
export function tipoRespuestaDeIntent(intent) {
  return (intent && INTENT_TO_TIPO_RESPUESTA[intent]) || 'respuesta';
}

// ─── RAG wrapper (import dinámico fail-open) ────────────────────────────────
async function getRagConsulta() {
  try {
    const mod = await import(RAG_MODULE_URL);
    return typeof mod.consultarBaseLegal === 'function' ? mod.consultarBaseLegal : null;
  } catch (err) {
    logger.warn('[intent-router] RAG no disponible (fail-open):', err.message);
    return null;
  }
}

// ─── Declaraciones structured output (alineadas con routes/ai.js) ───────────
const ANALISIS_DECLARATION = {
  name: 'analizarExpediente',
  description: 'Analiza un expediente legal peruano e identifica puntos críticos, inconsistencias y estrategia.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      resumenGeneral: { type: 'string', description: 'Resumen del caso en 3-5 oraciones.' },
      hechosClave: { type: 'array', items: { type: 'string' }, description: 'Hechos procesalmente relevantes.' },
      inconsistencias: { type: 'array', items: { type: 'string' }, description: 'Contradicciones o vacios en el expediente.' },
      riesgosProcesales: { type: 'array', items: { type: 'string' }, description: 'Riesgos como prescripción, caducidad o nulidades.' },
      estrategiaRecomendada: { type: 'string', description: 'Estrategia de defensa o ataque recomendada.' },
    },
    required: ['resumenGeneral', 'hechosClave', 'estrategiaRecomendada'],
  },
};

const PREDICCION_DECLARATION = {
  name: 'emitirPrediccion',
  description: 'Emite una predicción estructurada sobre la viabilidad judicial del caso peruano.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      probabilidadExito: { type: 'number', description: 'Probabilidad de éxito del caso entre 0 y 100.' },
      veredictoGeneral: { type: 'string', description: 'Fallo probable en una o dos oraciones.' },
      factoresFavorables: { type: 'array', items: { type: 'string' }, description: 'Argumentos y pruebas que benefician al cliente.' },
      factoresDesfavorables: { type: 'array', items: { type: 'string' }, description: 'Argumentos y pruebas que perjudican al cliente.' },
      recomendacion: { type: 'string', description: 'Estrategia recomendada para el abogado.' },
    },
    required: ['probabilidadExito', 'veredictoGeneral', 'factoresFavorables', 'factoresDesfavorables', 'recomendacion'],
  },
};

const SISTEMA_ANALISIS = `Eres un analista jurídico experto peruano. Analiza el expediente o documento proporcionado
identificando: hechos relevantes, pretensiones, fundamentos jurídicos, pruebas clave,
riesgos procesales (prescripción, caducidad, nulidades) y estrategia recomendada.
Usa SOLO la información proporcionada y el contexto legal verificado (RAG). NUNCA inventes hechos ni normas.
Responde en español (Perú).`;

const SISTEMA_PREDICTOR = `Eres un analista predictivo judicial peruano. Basándote en la información del caso,
evalúa la probabilidad de éxito (porcentaje), veredicto probable, factores favorables y
desfavorables, y recomendaciones estratégicas. NUNCA presentes la predicción como verdad
absoluta: es un análisis probabilístico. Responde en español (Perú).`;

// ─── System prompt del Router (FASE 1) ───────────────────────────────────────
const SYSTEM_ROUTER = `Eres el Router de Intenciones del chat legal LegalPro/LexIA (derecho peruano).

Analiza el mensaje del usuario y decide UNA de estas opciones:

1. REDACTAR un escrito legal (demanda, contestación, apelación, casación, amparo, hábeas corpus, medida cautelar, memorial, alegato, acusación, requerimiento...) → llama a la herramienta "redactar_documento" con tipo_documento, materia y hechos.
2. CALCULAR un plazo procesal (cuándo vence, cuántos días hábiles, prescripción, caducidad, término, feriado...) → llama a "calcular_plazo" con fecha_inicio (YYYY-MM-DD, usa hoy si no la da) y acto_procesal.
3. ANALIZAR un expediente (riesgos, fortalezas, debilidades, estrategia, resumen del caso, nulidades...) → llama a "analizar_expediente" con expediente_id (si lo menciona) y tipo_analisis.
4. BUSCAR jurisprudencia (casaciones, precedentes vinculantes, sentencias, qué ha dicho el TC, INDECOPI, SUNARP, MINJUS...) → llama a "buscar_jurisprudencia" con query.
5. PREDECIR el resultado/probabilidad de éxito de un caso (vamos a ganar, qué probabilidad, chances, porcentaje de éxito...) → llama a "predecir_resultado" con expediente_id (si lo menciona) y materia.
6. Consulta legal general (qué dice la ley, explicación, concepto, diferencia entre...) o saludo/agradecimiento → responde TEXTO DIRECTO, SIN llamar ninguna herramienta.

Reglas:
- Completa los argumentos requeridos de la tool con lo razonable del mensaje; si falta un dato esencial (p. ej. fecha), usa un valor sensato o el más probable.
- NO inventes datos que no estén en el mensaje (expediente_id, fechas, números).
- Responde SIEMPRE en español (Perú).
- Si el usuario pide redactar pero además menciona jurisprudencia como apoyo, prioriza la acción principal (redactar).`;

// ─── FASE 1: LLM con tools AUTO (temperatura 0.1 — determinismo legal) ──────
async function ejecutarFase1({ mensaje, historial = [], model, req }) {
  const tools = getCatalogoTools();
  const contents = [
    ...(historial || []).map((h) => ({
      role: (h.role === 'model' || h.role === 'assistant') ? 'model' : 'user',
      parts: [{ text: h.text ?? h.content ?? '' }],
    })),
    { role: 'user', parts: [{ text: mensaje }] },
  ];
  return getAi().models.generateContent({
    model: model || MODEL,
    contents,
    config: {
      systemInstruction: SYSTEM_ROUTER,
      maxOutputTokens: 1024,
      temperature: 0.1,
      tools,
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    },
  });
}

// ─── Ejecutores de herramientas (servicios REALES) ───────────────────────────

/** redactar_documento → services/documentoRedactor.js (flujo real de documento-chat) */
async function ejecutarRedactarDocumento(args, req) {
  const {
    tipo_documento, materia = 'general', hechos = '', fundamentos = '', petitorio = '',
    expediente_id, _texto = '',
  } = args;

  const tipo = tipo_documento || detectarTipoDocumentoTexto(_texto || hechos) || 'demanda';

  // Construir conversación para el redactor (mismo contrato que /redactar-documento).
  const contenido = [
    hechos && hechos !== _texto ? `HECHOS: ${hechos}` : '',
    fundamentos ? `FUNDAMENTOS DE DERECHO: ${fundamentos}` : '',
    petitorio ? `PETITORIO: ${petitorio}` : '',
    (_texto && !hechos) ? _texto : '',
  ].filter(Boolean).join('\n') || 'Redacta el escrito legal solicitado.';

  const conversacion = [{ rol: 'usuario', contenido }];

  const { sanitizado } = sanitizarPrompt(contenido, 'escrito');
  if (!sanitizado.trim()) {
    return { texto: 'El contenido solicitado no es válido para redactar el documento.', data: null };
  }
  conversacion[0].contenido = sanitizado;

  const documento = await redactarDocumento({
    conversacion,
    tipoDocumento: tipo,
    materia,
    numeroExpediente: expediente_id || '',
  });

  const texto = formatearDocumentoMarkdown(documento, tipo);
  return {
    texto: `${texto}\n\n${DISCLAIMER_REDACTOR || DISCLAIMER_GENERAL}`,
    data: {
      // Shape canónico para tarjeta de "escrito" en el frontend (v3).
      tipo,
      sumilla: documento.sumilla || '',
      fundamentos: Array.isArray(documento.fundamentos) ? documento.fundamentos : [],
      petitorio: documento.petitorio || '',
      base_legal: Array.isArray(documento.base_legal) ? documento.base_legal : [],
      formato_disponible: ['pdf', 'docx'],
      // Extras útiles (sin romper el shape canónico).
      otrosi_primero: documento.otrosi_primero || '',
      otrosi_segundo: documento.otrosi_segundo || '',
      materia,
      tokens: documento.tokens ?? null,
      provider: documento.provider || null,
      model: documento.model || null,
    },
    tokens: documento.tokens || null,
  };
}

/** calcular_plazo → utils/feriados.js + catalogs/plazos-procesales.json (cálculo real) */
async function ejecutarCalcularPlazo(args, req) {
  const catalog = loadPlazos();
  const actoProcesal = args.acto_procesal || args._texto || '';
  const plazoId = args.plazo_id || resolverPlazoId(catalog, actoProcesal);

  // SKILL: enrutamiento-intenciones-chat v1.1.0 — consulta conceptual sin fecha_inicio.
  // El usuario puede preguntar por un plazo SIN fecha de inicio explícita
  // (p. ej. "Cuánto tiempo tengo para demandar contencioso-administrativo?",
  // "Cuál es el plazo de prescripción...", "Cuántos días para apelar...").
  // En ese caso NO debemos inventar `fecha_inicio=hoy` porque devolveríamos
  // una fecha de vencimiento FALSA y confundiríamos al usuario. Detectar si
  // la fecha fue EXPLÍCITAMENTE proporcionada (string no vacío o Date válido).
  const fechaInicioBruta = args.fecha_inicio;
  let fechaInicioProporcionada = false;
  let fechaInicio = null;
  if (typeof fechaInicioBruta === 'string' && fechaInicioBruta.trim() !== '') {
    fechaInicio = fechaInicioBruta.trim();
    fechaInicioProporcionada = true;
  } else if (fechaInicioBruta instanceof Date && !Number.isNaN(fechaInicioBruta.getTime())) {
    fechaInicio = fechaInicioBruta.toISOString().slice(0, 10);
    fechaInicioProporcionada = true;
  }

  let plazoInfo = null;
  let diasHabiles = null;
  if (plazoId) {
    plazoInfo = catalog.plazos.find((p) => p.id === plazoId) || null;
    if (plazoInfo) diasHabiles = typeof plazoInfo.dias === 'number' ? plazoInfo.dias : null;
  }

  if (!plazoInfo) {
    return {
      texto: 'No pude identificar el plazo procesal contra el catálogo canónico. Indícame el acto procesal (p. ej. "apelación de sentencia civil", "contestar demanda laboral") o un `plazo_id` del catálogo, y la fecha de inicio (YYYY-MM-DD).',
      data: { error: 'PLAZO_NO_RESUELTO', acto_procesal: actoProcesal || null },
    };
  }

  if (diasHabiles == null) {
    return {
      texto: `El plazo "${plazoInfo.acto}" no tiene un número fijo de días (${plazoInfo.codigo || 'Código'}${plazoInfo.articulo ? ` art. ${plazoInfo.articulo}` : ''}). ${plazoInfo.nota || plazoInfo.dias_meses || 'Consulta el detalle en el catálogo de plazos procesales.'}`,
      data: {
        acto_procesal: plazoInfo.acto,
        base_legal: [plazoInfo.codigo, plazoInfo.articulo ? `art. ${plazoInfo.articulo}` : ''].filter(Boolean).join(', ') || null,
        fecha_inicio: fechaInicio,
        dias_habiles: null,
        fecha_vencimiento: null,
        dias_calendario: null,
        consecuencia: plazoInfo.consecuencia_vencimiento || null,
        plazo_info: plazoInfo,
      },
    };
  }

  // ─── CONSULTA CONCEPTUAL DE PLAZO (sin fecha_inicio) ──────────────────────
  // FIX bug P0 (auditor-legal 2026-08-08): preguntas tipo "Cuánto tiempo tengo
  // para demandar contencioso-administrativo?" caían en `fecha_inicio=hoy` por
  // defecto y devolvían una fecha de vencimiento FALSA (la calculada desde hoy),
  // confundiendo al usuario y/o atorando al modelo en un loop pidiendo fecha.
  //
  // Comportamiento nuevo: si NO hay fecha_inicio explícita, devolvemos la ficha
  // del catálogo (días, base legal, consecuencia) con `fecha_vencimiento: null`
  // y `dias_calendario: null`, y pedimos la fecha para calcular el vencimiento
  // exacto. Mantiene el shape canónico para que la tarjeta "plazo" del frontend
  // renderice correctamente.
  if (!fechaInicioProporcionada) {
    const codigoConArticulo = [plazoInfo.codigo, plazoInfo.articulo ? `art. ${plazoInfo.articulo}` : ''].filter(Boolean).join(', ') || null;
    const tipoPlazo = plazoInfo.tipo || 'hábiles';
    const diasTextoNumero = typeof plazoInfo.dias === 'number' ? `${plazoInfo.dias} días ${tipoPlazo}` : null;

    const lineas = [
      '## Información de plazo procesal',
      '',
      `- **Acto procesal:** ${plazoInfo.acto}${codigoConArticulo ? ` (${codigoConArticulo})` : ''}`,
      `- **Base legal:** ${codigoConArticulo || 'Código procesal aplicable'}`,
      diasTextoNumero ? `- **Plazo:** ${diasTextoNumero}` : '',
      plazoInfo.dies_a_quem ? `- **Dies a quo:** ${plazoInfo.dies_a_quem}` : '',
      plazoInfo.consecuencia_vencimiento ? `- **Consecuencia del vencimiento:** ${plazoInfo.consecuencia_vencimiento}` : '',
      plazoInfo.nota ? `- **Nota:** ${plazoInfo.nota}` : '',
      '',
      diasTextoNumero
        ? `Tienes **${diasTextoNumero}** para *${plazoInfo.acto}* según *${codigoConArticulo || 'el código procesal aplicable'}*. Indícame la fecha de inicio (YYYY-MM-DD, p. ej. fecha de notificación o de la resolución que agota la vía administrativa) si quieres calcular la fecha de vencimiento exacta.`
        : `Para *${plazoInfo.acto}* (${codigoConArticulo || 'código procesal aplicable'}) no aplica un conteo fijo de días. ${plazoInfo.nota || plazoInfo.dias_meses || 'Consulta el detalle en el catálogo de plazos procesales.'}`,
      '',
      `*Fuente: catalogs/plazos-procesales.json (SPIJ/MINJUS). No se calculó fecha de vencimiento porque no se proporcionó fecha de inicio.*`,
    ].filter(Boolean).join('\n');

    const dataBase = {
      // Shape canónico (con `fecha_vencimiento: null` por no haber fecha).
      acto_procesal: plazoInfo.acto,
      base_legal: codigoConArticulo,
      fecha_inicio: null,
      dias_habiles: tipoPlazo === 'hábiles' || tipoPlazo === 'habiles' ? plazoInfo.dias : null,
      dias_naturales: tipoPlazo === 'naturales' ? plazoInfo.dias : null,
      dias: plazoInfo.dias ?? null,
      tipo: tipoPlazo,
      fecha_vencimiento: null,
      dias_calendario: null,
      consecuencia: plazoInfo.consecuencia_vencimiento || null,
      requiere_fecha_inicio: true,
      plazo_info: {
        id: plazoInfo.id,
        acto: plazoInfo.acto,
        codigo: plazoInfo.codigo,
        articulo: plazoInfo.articulo,
        dias: plazoInfo.dias,
        tipo: plazoInfo.tipo,
        dies_a_quem: plazoInfo.dies_a_quem || null,
        consecuencia_vencimiento: plazoInfo.consecuencia_vencimiento || null,
        nota: plazoInfo.nota || null,
      },
    };

    return {
      texto: lineas,
      data: dataBase,
    };
  }

  const fechaVencimiento = sumarDiasHabiles(fechaInicio, diasHabiles);
  const esHabil = esDiaHabil(fechaVencimiento);
  const year = new Date(fechaInicio + 'T00:00:00').getFullYear();
  const feriados = getDiasNoHabilesDelAnio(year);
  const inicio = new Date(fechaInicio + 'T00:00:00');
  const fin = new Date(fechaVencimiento + 'T00:00:00');
  const diffDias = Math.round((fin - inicio) / (1000 * 60 * 60 * 24));

  const codigoConArticulo = [plazoInfo.codigo, plazoInfo.articulo ? `art. ${plazoInfo.articulo}` : ''].filter(Boolean).join(', ');

  const texto = [
    '## Cálculo de plazo procesal',
    '',
    `- **Acto procesal:** ${plazoInfo.acto}${codigoConArticulo ? ` (${codigoConArticulo})` : ''}`,
    `- **Base legal:** ${codigoConArticulo || 'Código procesal aplicable'}`,
    `- **Fecha de inicio:** ${fechaInicio}`,
    `- **Plazo:** ${diasHabiles} días hábiles`,
    `- **Fecha de vencimiento:** ${fechaVencimiento}`,
    `- **Días calendario totales:** ${diffDias}`,
    plazoInfo.dies_a_quem ? `- **Dies a quo:** ${plazoInfo.dies_a_quem}` : '',
    esHabil ? '' : '⚠️ El vencimiento cayó en día inhábil (fin de semana o feriado) y se prorrogó al siguiente día hábil (CPC art. 144).',
    plazoInfo.consecuencia_vencimiento ? `- **Consecuencia del vencimiento:** ${plazoInfo.consecuencia_vencimiento}` : '',
    '',
    `*Cálculo en días hábiles (CPC art. 144). Fuente: catalogs/plazos-procesales.json (SPIJ/MINJUS) + utils/feriados.js.*`,
  ].filter(Boolean).join('\n');

  return {
    texto,
    data: {
      // Shape canónico para tarjeta de "plazo" en el frontend (v3).
      acto_procesal: plazoInfo.acto,
      base_legal: codigoConArticulo || null,
      fecha_inicio: fechaInicio,
      dias_habiles: diasHabiles,
      fecha_vencimiento: fechaVencimiento,
      dias_calendario: diffDias,
      consecuencia: plazoInfo.consecuencia_vencimiento || null,
      // Extras de compatibilidad (v2 mantenido).
      plazo_id: plazoInfo.id,
      plazo_info: { id: plazoInfo.id, acto: plazoInfo.acto, codigo: plazoInfo.codigo, articulo: plazoInfo.articulo, dias: plazoInfo.dias },
      dias_calendario_total: diffDias,
      es_habil: esHabil,
      feriados_del_anio: feriados,
    },
  };
}

/** analizar_expediente → DB (expedientes.texto_ocr) + RAG + LLM structured */
async function ejecutarAnalizarExpediente(args, req) {
  const { expediente_id, tipo_analisis = 'completo', materia = 'general', _texto = '' } = args;
  const orgId = req.organizationId;

  // 1. Cargar expediente REAL de DB (multi-tenant: WHERE organization_id=$2)
  let textoExpediente = '';
  let datosExpediente = null;
  if (expediente_id) {
    try {
      const { rows: [exp] } = await db.query(
        'SELECT id, numero, titulo, tipo, estado, texto_ocr FROM expedientes WHERE id=$1 AND organization_id=$2',
        [expediente_id, orgId]
      );
      if (exp) {
        datosExpediente = { id: exp.id, numero: exp.numero, titulo: exp.titulo, tipo: exp.tipo, estado: exp.estado };
        textoExpediente = exp.texto_ocr || '';
      }
    } catch (err) {
      req.logger?.warn('[INTENT-ROUTER] Error leyendo expediente:', err?.message);
    }
  }

  // 2. Contexto RAG (base legal verificada) — fail-open
  let ragContexto = '';
  try {
    const consultarBaseLegal = await getRagConsulta();
    if (consultarBaseLegal) {
      const base = await consultarBaseLegal({
        materia,
        consulta: (_texto || 'análisis de expediente').substring(0, 500),
        contexto: datosExpediente?.numero || '',
      });
      ragContexto = base?.contexto || '';
    }
  } catch (err) {
    req.logger?.warn('[INTENT-ROUTER] RAG no disponible para análisis:', err?.message);
  }

  if (!expediente_id && !textoExpediente && !ragContexto) {
    return {
      texto: 'Para analizar un expediente necesito el `expediente_id` (UUID) del caso, o al menos los hechos. ¿Puedes indicármelo?',
      data: { necesita_expediente: true, resumen: null, fortalezas: [], riesgos: [], estrategia: null },
    };
  }

  const prompt = [
    `Tipo de análisis solicitado: ${tipo_analisis}`,
    `Consulta del usuario: ${_texto || 'Analiza el expediente'}`,
    datosExpediente ? `\nExpediente: ${datosExpediente.numero} — ${datosExpediente.titulo} (${datosExpediente.tipo}, ${datosExpediente.estado})` : '',
    textoExpediente ? `\nCONTENIDO DEL EXPEDIENTE (OCR):\n${textoExpediente.slice(0, 6000)}` : '',
    ragContexto ? `\nCONTEXTO LEGAL VERIFICADO (RAG):\n${ragContexto}` : '',
  ].filter(Boolean).join('\n');

  const respuesta = await getAi().models.generateContent({
    model: req.model || MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction: SISTEMA_ANALISIS,
      maxOutputTokens: 4096,
      temperature: 0.3,
      tools: [{ functionDeclarations: [ANALISIS_DECLARATION] }],
      toolConfig: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [ANALISIS_DECLARATION.name] } },
    },
  });

  const fc = respuesta.functionCalls?.[0];
  const resultado = fc?.args ?? {};
  const texto = formatearAnalisisMarkdown(resultado, tipo_analisis, datosExpediente);

  return {
    texto,
    data: {
      // Shape canónico para tarjeta de "análisis" en el frontend (v3).
      resumen: resultado.resumenGeneral || null,
      fortalezas: Array.isArray(resultado.hechosClave) ? resultado.hechosClave : [],
      riesgos: Array.isArray(resultado.riesgosProcesales) ? resultado.riesgosProcesales : [],
      estrategia: resultado.estrategiaRecomendada || null,
      inconsistencias: Array.isArray(resultado.inconsistencias) ? resultado.inconsistencias : [],
      // Extras de compatibilidad (resultado crudo de la declaration + expediente).
      resultado,
      expediente: datosExpediente,
      necesita_revision_humana: true,
    },
    tokens: respuesta.usageMetadata?.totalTokenCount || null,
  };
}

/** buscar_jurisprudencia → RAG local (consultarBaseLegal). NUNCA inventar. */
async function ejecutarBuscarJurisprudencia(args, req) {
  const { query = '', materia = 'general', fuente = '', max_resultados = 10 } = args;
  const consulta = String(query || '').trim();
  if (!consulta || consulta.length < 5) {
    return {
      texto: 'Indícame qué tema jurídico quieres buscar (p. ej. "desalojo", "despido arbitrario", "prescripción adquisitiva").',
      data: { error: 'QUERY_REQUERIDA', resultados: [] },
    };
  }

  const consultarBaseLegal = await getRagConsulta();
  if (!consultarBaseLegal) {
    return {
      texto: '⚠️ El servicio de búsqueda de jurisprudencia (RAG) no está disponible en este momento. **No puedo citar jurisprudencia sin verificación real** y no la inventaré. Intenta más tarde o usa el buscador de jurisprudencia dedicado.',
      data: { disponible: false, resultados: [] },
    };
  }

  const base = await consultarBaseLegal({
    materia,
    consulta: consulta.substring(0, 500),
    contexto: fuente || '',
  });
  const chunks = base?.chunks_usados || 0;

  if (chunks === 0) {
    return {
      texto: `No encontré jurisprudencia real verificada para "${consulta}". **No invento jurisprudencia**: si no hay resultados reales, lo digo explícitamente. Prueba con otros términos o revisa el buscador de jurisprudencia.`,
      data: { chunks_usados: 0, resultados: [], citaciones: [] },
    };
  }

  // Array estructurado para que el frontend renderice tarjetas sin parsear markdown (v3).
  const resultados = (base.citaciones || []).map((c) => ({
    numero: c.numero ?? null,
    fuente: c.fuente || null,
    url: c.url || null,
    similitud: typeof c.similitud === 'number' ? Number((c.similitud * 100).toFixed(1)) : null,
    titulo: c.metadata?.titulo || c.metadata?.sumilla || c.fuente || null,
    tipo: c.metadata?.tipo || c.metadata?.codigo || null,
    materia: c.metadata?.materia || null,
    articulo: c.metadata?.articulo || null,
    referencia: c.metadata?.referencia || null,
  }));

  const citas = (base.citaciones || []).slice(0, max_resultados).map((c) => `[${c.numero}] ${c.fuente}${c.url ? ` — ${c.url}` : ''}`);
  const lineas = [
    `# Jurisprudencia sobre: ${consulta}`,
    '',
    'Resultados recuperados de **fuentes reales** (RAG local):',
    '',
    '**Base legal/normativa encontrada:**',
    '',
    (base.contexto || '').slice(0, 4000),
    '',
    '**Fuentes citadas:**',
    '',
    ...citas.map((c) => `- ${c}`),
    '',
    '⚠️ **No se citan expedientes ni casaciones no verificados.**',
    DISCLAIMER_GENERAL,
  ].filter(Boolean).join('\n');

  return {
    texto: lineas,
    data: { resultados, chunks_usados: chunks, citaciones: base.citaciones, fuentes: base.fuentes },
  };
}

/** predecir_resultado → flujo predictor (declaration emitirPrediccion) */
async function ejecutarPredecirResultado(args, req) {
  const { expediente_id, materia = 'general', tipo_prediccion = 'probabilidad', _texto = '' } = args;
  const orgId = req.organizationId;
  const userId = req.user?.sub;

  // 1. Contexto del expediente si existe
  let contexto = '';
  let datosExpediente = null;
  if (expediente_id) {
    try {
      const { rows: [exp] } = await db.query(
        'SELECT id, numero, titulo, tipo, estado, texto_ocr FROM expedientes WHERE id=$1 AND organization_id=$2',
        [expediente_id, orgId]
      );
      if (exp) {
        datosExpediente = { id: exp.id, numero: exp.numero, titulo: exp.titulo, tipo: exp.tipo, estado: exp.estado };
        contexto = `\nExpediente: ${exp.numero} — ${exp.titulo} (${exp.tipo}, ${exp.estado})\nContenido OCR:\n${(exp.texto_ocr || '').slice(0, 6000)}`;
      }
    } catch (err) {
      req.logger?.warn('[INTENT-ROUTER] Error leyendo expediente para predicción:', err?.message);
    }
  }

  const prompt = `Basándote en la siguiente información del caso peruano, emite una predicción estructurada de viabilidad judicial.
Tipo de predicción solicitada: ${tipo_prediccion}
${_texto ? `Consulta del usuario: ${_texto}` : ''}
${contexto || '\n(Sin expediente en contexto: predicción basada únicamente en la consulta del usuario)'}`;

  const respuesta = await getAi().models.generateContent({
    model: req.model || MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction: SISTEMA_PREDICTOR,
      maxOutputTokens: 4096,
      temperature: 0.2,
      tools: [{ functionDeclarations: [PREDICCION_DECLARATION] }],
      toolConfig: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [PREDICCION_DECLARATION.name] } },
    },
  });

  const fc = respuesta.functionCalls?.[0];
  const resultado = fc?.args ?? {};

  // 2. Persistir en predicciones_judiciales (mismo patrón que ai.js /consulta)
  if (resultado.probabilidadExito !== undefined) {
    try {
      await db.query(
        `INSERT INTO predicciones_judiciales (
          usuario_id, organization_id, tipo_proceso, materia, probabilidad_exito, analisis_ia, factores_favorables, factores_desfavorables, recomendaciones
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId,
          orgId,
          datosExpediente?.tipo || 'GENERAL',
          materia || 'GENERAL',
          resultado.probabilidadExito,
          JSON.stringify({ veredictoGeneral: resultado.veredictoGeneral }),
          JSON.stringify(resultado.factoresFavorables || []),
          JSON.stringify(resultado.factoresDesfavorables || []),
          JSON.stringify([resultado.recomendacion || '']),
        ]
      );
    } catch (dbErr) {
      req.logger?.error('[INTENT-ROUTER] Error guardando predicción judicial:', dbErr);
    }
  }

  const texto = formatearPrediccionMarkdown(resultado);
  return {
    texto,
    data: {
      // Shape canónico para tarjeta de "predicción" en el frontend (v3).
      probabilidad_exito: typeof resultado.probabilidadExito === 'number' ? resultado.probabilidadExito : null,
      veredicto: resultado.veredictoGeneral || null,
      factores_favorables: Array.isArray(resultado.factoresFavorables) ? resultado.factoresFavorables : [],
      factores_desfavorables: Array.isArray(resultado.factoresDesfavorables) ? resultado.factoresDesfavorables : [],
      recomendacion: resultado.recomendacion || null,
      // Extra de compatibilidad: resultado crudo de la declaration.
      resultado,
    },
    tokens: respuesta.usageMetadata?.totalTokenCount || null,
  };
}

/**
 * Ejecuta una herramienta por nombre (FASE 2).
 * @param {string} intent - Nombre de la tool (redactar_documento, calcular_plazo, ...)
 * @param {object} args   - Argumentos del modelo (o inferidos por FASE 0).
 * @param {object} req    - Request Express (para req.logger, req.organizationId, req.user).
 * @returns {Promise<{ texto: string, data?: object|null, tokens?: number|null }>}
 *   `data` es el shape estructurado por tipo de tool (ver ejecutores):
 *     calcular_plazo        → { acto_procesal, base_legal, fecha_inicio, dias_habiles,
 *                               fecha_vencimiento, dias_calendario, consecuencia }
 *     redactar_documento    → { tipo, sumilla, fundamentos, petitorio, base_legal,
 *                               formato_disponible: ['pdf','docx'] }
 *     analizar_expediente   → { resumen, fortalezas, riesgos, estrategia }
 *     buscar_jurisprudencia → { resultados: [...] }
 *     predecir_resultado    → { probabilidad_exito, veredicto, factores_favorables,
 *                               factores_desfavorables, recomendacion }
 */
export async function ejecutarHerramienta(intent, args = {}, req = {}) {
  req.logger = req.logger || logger;
  const safeArgs = (args && typeof args === 'object') ? args : {};

  switch (intent) {
    case 'redactar_documento':
      return ejecutarRedactarDocumento(safeArgs, req);
    case 'calcular_plazo':
      return ejecutarCalcularPlazo(safeArgs, req);
    case 'analizar_expediente':
      return ejecutarAnalizarExpediente(safeArgs, req);
    case 'buscar_jurisprudencia':
      return ejecutarBuscarJurisprudencia(safeArgs, req);
    case 'predecir_resultado':
      return ejecutarPredecirResultado(safeArgs, req);
    default:
      throw new Error(`Intención desconocida: ${intent}`);
  }
}

// ─── FASE 2: ejecutar tool_calls → resultado formateado (sin segunda llamada) ─
async function ejecutarFase2(functionCalls, req) {
  const resultados = [];
  let tokens = 0;
  for (const fc of functionCalls || []) {
    const r = await ejecutarHerramienta(fc.name, fc.args || {}, req);
    resultados.push({ name: fc.name, ...r });
    tokens += r.tokens || 0;
  }

  // Si el resultado de la tool ya es texto limpio → responder sin segunda llamada.
  if (resultados.length === 1 && resultados[0].texto?.trim()) {
    return {
      respuesta: resultados[0].texto.trim(),
      intent: resultados[0].name,
      tokens,
      data: resultados[0].data ?? null,
    };
  }
  // Multi-tool (defensivo) → concatenar secciones; data como array por tool.
  const texto = resultados.map((r) => r.texto || '').filter(Boolean).join('\n\n---\n\n');
  return {
    respuesta: texto || 'No se pudo ejecutar la herramienta solicitada.',
    intent: resultados[0]?.name || 'desconocida',
    tokens,
    data: resultados.map((r) => ({ name: r.name, data: r.data ?? null })).filter((r) => r.data !== null),
  };
}

// ─── Orquestación FASE 0 → FASE 1 → FASE 2 → fallback (null) ─────────────────
/**
 * Enruta el mensaje del chat hacia la herramienta real.
 * @returns {Promise<{ respuesta, intent, tipo_respuesta, fase, tokens, data } | null>}
 *   `data` = shape estructurado por tool (null si es respuesta directa sin tool).
 *   null → la ruta debe degradar a la llamada directa normal (fail-open).
 */
export async function enrutarMensaje({ mensaje, historial = [], expediente_id, model, req }) {
  if (!mensaje || typeof mensaje !== 'string') return null;

  // FASE 0 — regex determinista (costo ~0)
  try {
    const fase0 = detectarIntencionFase0(mensaje);
    if (fase0) {
      const args = {
        ...fase0.args,
        // Refuerzo: expediente_id del body si el cliente lo adjuntó.
        expediente_id: expediente_id || fase0.args.expediente_id || null,
      };
      const r = await ejecutarHerramienta(fase0.intent, args, req);
      return {
        respuesta: r.texto,
        intent: fase0.intent,
        tipo_respuesta: tipoRespuestaDeIntent(fase0.intent),
        fase: 'fase0',
        tokens: r.tokens || null,
        data: r.data || null,
      };
    }
  } catch (err) {
    req.logger?.warn('[INTENT-ROUTER] FASE 0 falló, pasando a FASE 1 (fail-open):', err?.message);
  }

  // FASE 1 — LLM con tools AUTO (temp 0.1)
  let fase1;
  try {
    fase1 = await ejecutarFase1({ mensaje, historial, model, req });
  } catch (err) {
    req.logger?.warn('[INTENT-ROUTER] FASE 1 falló, degradando a llamada directa (fail-open):', err?.message);
    return null;
  }

  // El modelo respondió texto directo → es la respuesta limpia normal.
  if (fase1.text?.trim() && !fase1.functionCalls?.length) {
    return { respuesta: fase1.text.trim(), intent: null, tipo_respuesta: 'respuesta', fase: 'fase1-texto', tokens: null, data: null };
  }

  // FASE 2 — ejecutar las tools llamadas por el modelo.
  if (fase1.functionCalls?.length) {
    try {
      const r2 = await ejecutarFase2(fase1.functionCalls, req);
      return { ...r2, tipo_respuesta: tipoRespuestaDeIntent(r2.intent), fase: 'fase2' };
    } catch (err) {
      req.logger?.warn('[INTENT-ROUTER] FASE 2 falló, degradando a llamada directa (fail-open):', err?.message);
      return null;
    }
  }

  return null;
}

// ─── Formateadores markdown ──────────────────────────────────────────────────

/** Convierte un id de tipo de documento a un título legible forense. */
function legibilizarTipo(tipo) {
  const map = {
    demanda: 'Demanda',
    contestacion: 'Contestación de demanda',
    apelacion: 'Recurso de apelación',
    casacion: 'Recurso de casación',
    amparo: 'Demanda de amparo',
    habeas_corpus: 'Hábeas corpus',
    'habeas corpus': 'Hábeas corpus',
    'medida cautelar': 'Medida cautelar',
    acusacion: 'Acusación fiscal',
    sobreseimiento: 'Sobreseimiento',
    pericial: 'Informe pericial',
    alegato: 'Alegato',
    requerimiento: 'Requerimiento',
    resolucion: 'Resolución',
    reconvencion: 'Reconvención',
    queja: 'Recurso de queja',
    reposicion: 'Recurso de reposición',
    traslado: 'Traslado',
    memorial: 'Memorial',
    escrito: 'Escrito legal',
  };
  if (map[tipo]) return map[tipo];
  return typeof tipo === 'string' && tipo.trim()
    ? tipo.charAt(0).toUpperCase() + tipo.slice(1)
    : 'Escrito legal';
}

function formatearDocumentoMarkdown(doc, tipo) {
  const lineas = [
    `# Escrito: ${legibilizarTipo(tipo)}`,
    '',
  ];
  if (doc.sumilla) lineas.push(`**SUMILLA:** ${doc.sumilla}`, '');
  if (Array.isArray(doc.fundamentos) && doc.fundamentos.length) {
    lineas.push('## FUNDAMENTOS', '', ...doc.fundamentos.map((f, i) => `${i + 1}. ${f}`), '');
  }
  if (Array.isArray(doc.base_legal) && doc.base_legal.length) {
    lineas.push('## BASE LEGAL', '', ...doc.base_legal.map((b) => `- ${b}`), '');
  }
  if (doc.petitorio) lineas.push('## PETITORIO', '', doc.petitorio, '');
  if (doc.otrosi_primero) lineas.push(`**OTROSÍ PRIMERO.-** ${doc.otrosi_primero}`, '');
  if (doc.otrosi_segundo) lineas.push(`**OTROSÍ SEGUNDO.-** ${doc.otrosi_segundo}`, '');
  lineas.push('*Borrador generado por IA — debe ser revisado y validado por un abogado colegiado antes de presentarse (Ley 27269: firma digital al exportar).*');
  return lineas.join('\n');
}

function formatearAnalisisMarkdown(r, tipo, exp) {
  const lineas = [];
  lineas.push(`# Análisis de expediente${exp?.numero ? ` ${exp.numero}` : ''}`, '');
  if (r.resumenGeneral) lineas.push('## Resumen general', '', r.resumenGeneral, '');
  if (Array.isArray(r.hechosClave) && r.hechosClave.length) {
    lineas.push('## Hechos clave', '', ...r.hechosClave.map((h, i) => `${i + 1}. ${h}`), '');
  }
  if (Array.isArray(r.inconsistencias) && r.inconsistencias.length) {
    lineas.push('## Inconsistencias o vacíos', '', ...r.inconsistencias.map((h, i) => `${i + 1}. ${h}`), '');
  }
  if (Array.isArray(r.riesgosProcesales) && r.riesgosProcesales.length) {
    lineas.push('## Riesgos procesales', '', ...r.riesgosProcesales.map((h, i) => `${i + 1}. ${h}`), '');
  }
  if (r.estrategiaRecomendada) lineas.push('## Estrategia recomendada', '', r.estrategiaRecomendada, '');
  lineas.push(`*Tipo de análisis: ${tipo || 'completo'}.*`, '');
  lineas.push('⚠️ **Requiere revisión humana** antes de tomar decisiones procesales.');
  if (DISCLAIMER_GENERAL) lineas.push(DISCLAIMER_GENERAL);
  return lineas.join('\n');
}

function formatearPrediccionMarkdown(r) {
  const lineas = [];
  lineas.push('# Predicción de resultado del caso', '');
  if (typeof r.probabilidadExito === 'number') {
    lineas.push(`## Probabilidad de éxito: **${r.probabilidadExito}%**`, '');
  }
  if (r.veredictoGeneral) lineas.push('## Veredicto probable', '', r.veredictoGeneral, '');
  if (Array.isArray(r.factoresFavorables) && r.factoresFavorables.length) {
    lineas.push('## Factores favorables', '', ...r.factoresFavorables.map((f, i) => `✅ ${i + 1}. ${f}`), '');
  }
  if (Array.isArray(r.factoresDesfavorables) && r.factoresDesfavorables.length) {
    lineas.push('## Factores desfavorables', '', ...r.factoresDesfavorables.map((f, i) => `⚠️ ${i + 1}. ${f}`), '');
  }
  if (r.recomendacion) lineas.push('## Recomendación estratégica', '', r.recomendacion, '');
  if (DISCLAIMER_PREDICTOR) lineas.push(DISCLAIMER_PREDICTOR);
  if (DISCLAIMER_GENERAL) lineas.push(DISCLAIMER_GENERAL);
  return lineas.join('\n');
}
