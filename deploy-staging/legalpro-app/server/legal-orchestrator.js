// legalpro-app/server/legal-orchestrator.js
// Orquestador del sistema multi-agente legal
// Generado por @arquitecto-chief + @abogado-chief
// Patron: abogado-senior -> abogado-jr-* especialistas -> consolidacion -> usuario

import { GoogleGenAI } from '@google/genai';
import { legalRouter } from './legal-router.js';
import Cache from './cache-redis.js';
const cache = Cache;
import { logAudit } from './utils/audit.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOGOS_PATH = path.resolve(__dirname, '../catalogs');

function cargarCatalogo(nombre) {
  try {
    const content = fs.readFileSync(path.join(CATALOGOS_PATH, nombre), 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.warn(`[orchestrator] No se pudo cargar catálogo: ${nombre}`, err.message);
    return null;
  }
}

// Cargar catálogos al inicio
const CODIGOS_LEYES = cargarCatalogo('codigos-leyes.json');
const TIPOS_PENALES = cargarCatalogo('tipos-penales-peru.json');
const PLAZOS_PROCESALES = cargarCatalogo('plazos-procesales.json');
const DISCLAIMERS = cargarCatalogo('disclaimers-ia.json');

const GEMINI_MODEL = 'gemini-2.5-flash-lite'; // Gemini 3.5 Flash Lite
const API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Formatea los catálogos cargados para inyectarlos en el system prompt
 */
function formatCatalogsForPrompt() {
  let result = '\n\n=== CATÁLOGOS VERIFICADOS POR ABOGADOS PERUANOS ===\n\n';

  result += '📚 CÓDIGOS Y LEYES VIGENTES:\n';
  if (CODIGOS_LEYES && CODIGOS_LEYES.normas) {
    result += CODIGOS_LEYES.normas.map(n =>
      `- ${n.nombre} (${n.numero}) [${n.tipo}]\n  Artículos clave: ${n.articulos_mas_citados.join(', ')}\n  SPIJ: ${n.url_spij}`
    ).join('\n') + '\n';
  } else {
    result += '  [No disponible - usar conocimiento interno]\n';
  }

  result += '\n⚖️ TIPOS PENALES (Código Penal):\n';
  if (TIPOS_PENALES && TIPOS_PENALES.tipos) {
    result += TIPOS_PENALES.tipos.map(t =>
      `- ${t.nombre} (Art. ${t.articulo_cp} CP): Pena ${t.pena_minima} - ${t.pena_maxima}, Bien jurídico: ${t.bien_juridico}`
    ).join('\n') + '\n';
  } else {
    result += '  [No disponible - usar conocimiento interno]\n';
  }

  result += '\n📅 PLAZOS PROCESALES:\n';
  if (PLAZOS_PROCESALES && PLAZOS_PROCESALES.plazos) {
    result += PLAZOS_PROCESALES.plazos.map(p =>
      `- ${p.acto}: ${p.dias} ${p.tipo || 'días'} (${p.codigo} art. ${p.articulo})`
    ).join('\n') + '\n';
  } else {
    result += '  [No disponible - usar conocimiento interno]\n';
  }

  return result;
}

// System instruction base construida dinámicamente con los catálogos
const BASE_LEGAL_INSTRUCTION = buildBaseLegalInstruction();

function buildBaseLegalInstruction() {
  const catalogsSection = formatCatalogsForPrompt();

  return `Eres parte del sistema LegalPro / LexIA Peru — asistente legal peruano.

TIENES 3 FUENTES DE CONOCIMIENTO:
1. TU CONOCIMIENTO INTERNO: Todo tu training en derecho peruano.
2. CATÁLOGOS VERIFICADOS (abajo): Leyes actualizadas por abogados peruanos.
3. BÚSQUEDA WEB: Para leyes muy recientes (Google Search Grounding activado).

REGLAS:
1. Prioridad: Catálogo > Web > Conocimiento interno
2. Si una ley NO está en el catálogo pero la conoces, USALA igual.
3. Si es una ley muy reciente (últimos meses), búscala en web.
4. Cita SIEMPRE con artículo específico (ej: "LPCL Art. 34", no **LPCL Art. 34**).
5. NUNCA inventes jurisprudencia.
6. Incluye SIEMPRE los 4 disclaimers obligatorios al final del mensaje, separados por líneas.
7. Considera el LPDP 29733.
8. Output en español Perú (es-PE), CLARO y DIRECTO.

FORMATO OBLIGATORIO (SIN markdown, SIN asteriscos, SIN numerales):
- NO uses ##, **, *, -, >>> ni ningún formato markdown.
- Usa texto plano con mayúsculas para títulos: "RESUMEN EJECUTIVO:" en lugar de "## Resumen Ejecutivo".
- Usa sangría con espacios para subsecciones en lugar de - o *.
- Separa secciones con una línea en blanco.
- Las leyes se escriben como: LPCL Art. 34 (sin negrita ni asteriscos).
- Los disclaimers al final, uno por línea, sin formato.

ESTRUCTURA:
RESUMEN EJECUTIVO:
[texto]

BASE LEGAL:
LPCL Art. 34 — Descripción del artículo
DS 003-97-TR Art. 3 — Descripción

ANÁLISIS:
[texto]

RIESGOS:
[texto]

RECOMENDACIÓN:
[texto]

DISCLAIMERS:
Esto NO constituye asesoría legal.
Consulte con un abogado colegiado.
Verifique la vigencia de las normas citadas.
La IA puede cometer errores.

${catalogsSection}`;
}

// Cache TTL: 24h (las consultas legales no cambian frecuentemente)
const CACHE_TTL = 24 * 60 * 60;

function hashKey(parts) {
  return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 16);
}

/**
 * Prompt para cada abogado-jr especialista
 * Cada uno tiene su propio system instruction con su especialidad
 */
function getSystemInstructionForSpecialty(specialty) {
  return `${BASE_LEGAL_INSTRUCTION}

TU ESPECIALIDAD: ${specialty.toUpperCase()}

INSTRUCCIONES ADICIONALES:
- Solo responde aspectos de tu especialidad.
- Si la consulta NO es de tu especialidad, responde: "{specialty}_NOT_APPLICABLE".
- Cita SIEMPRE las normas de tu area con articulos especificos.
- Usa los CATÁLOGOS VERIFICADOS provistos arriba como referencia prioritaria para tu especialidad.
- Consulta el catálogo de plazos procesales si la consulta involucra plazos o términos.
- Si hay conflicto con otra rama del derecho, mencionalo.
- Incluye los disclaimers obligatorios del catálogo de disclaimers.`;
}

/**
 * Mapa de especialidades a nombres de agentes juniors
 */
const SPECIALTY_TO_AGENT = {
  'civil': 'abogado-jr-civil',
  'familia': 'abogado-jr-familia',
  'penal': 'abogado-jr-penal',
  'penal-economico': 'abogado-jr-penal-economico',
  'procesal-penal': 'abogado-jr-procesal-penal',
  'amparo': 'abogado-jr-amparo',
  'crimen-organizado': 'abogado-jr-crimen-organizado',
  'trabajo-forzoso': 'abogado-jr-trabajo-forzoso',
  'comercial': 'abogado-jr-comercial',
  'propiedad-intelectual': 'abogado-jr-propiedad-intelectual',
  'notarial': 'abogado-jr-notarial',
  'consumidor': 'abogado-jr-consumidor',
  'arbitraje': 'abogado-jr-arbitraje',
  'administrativo': 'abogado-jr-administrativo',
  'tributario': 'abogado-jr-tributario',
  'concursal': 'abogado-jr-concursal',
  'ambiental': 'abogado-jr-ambiental',
  'mineria-energia': 'abogado-jr-mineria-energia',
  'sanitario': 'abogado-jr-sanitario',
  'educacion': 'abogado-jr-educacion',
  'compliance': 'abogado-jr-compliance',
  'laboral-colectivo': 'abogado-jr-laboral-colectivo',
  'seguridad-social': 'abogado-jr-seguridad-social',
  'migratorio': 'abogado-jr-migratorio',
  'forense': 'contador-jr-forense'
};

/**
 * Llama a un agente jr-especialista via Gemini
 */
async function callSpecialist(specialty, query, context = {}) {
  const agentName = SPECIALTY_TO_AGENT[specialty];
  if (!agentName) {
    return { specialty, applicable: false, reason: 'No specialist for: ' + specialty };
  }

  // Verificar cache
  const cacheKey = `legal:${specialty}:${hashKey({ q: query, c: context })}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return { specialty, agent: agentName, ...cached, cached: true };
  }

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{
        role: 'user',
        parts: [{ text: `Consulta del usuario: ${query}\n\nContexto adicional: ${JSON.stringify(context)}` }]
      }],
      config: {
        systemInstruction: getSystemInstructionForSpecialty(specialty),
        temperature: 0.2,
        maxOutputTokens: 2048,
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const applicable = !text.includes(`${specialty.toUpperCase()}_NOT_APPLICABLE`);

    const result = {
      specialty,
      agent: agentName,
      applicable,
      content: text,
      tokensInput: response.usageMetadata?.promptTokenCount || 0,
      tokensOutput: response.usageMetadata?.candidatesTokenCount || 0,
      cost: ((response.usageMetadata?.promptTokenCount || 0) * 0.000000075) +
            ((response.usageMetadata?.candidatesTokenCount || 0) * 0.0000003)
    };

    // Guardar en cache solo si es aplicable
    if (applicable) {
      await cache.set(cacheKey, result, CACHE_TTL);
    }

    return result;
  } catch (e) {
    console.error(`[orchestrator] Error en ${specialty}:`, e.message);
    return { specialty, agent: agentName, applicable: false, error: e.message };
  }
}

/**
 * CONSOLIDACION: el agente senior consolida las respuestas de los juniors
 */
async function consolidateWithSenior(seniorSpecialty, query, juniorResponses, context) {
  const applicableResponses = juniorResponses.filter(r => r.applicable);
  if (applicableResponses.length === 0) {
    return {
      success: false,
      error: 'Ningun especialista pudo responder',
      query
    };
  }

  // Construir contexto consolidado
  const consolidatedContext = applicableResponses.map(r => `
[${r.specialty.toUpperCase()} - ${r.agent}]
${r.content}
---
`).join('\n');

  const consolidationPrompt = `Eres un abogado senior con 10+ anos de experiencia en ${seniorSpecialty} en el ordenamiento peruano.

Consulta original del usuario: "${query}"

Contexto: ${JSON.stringify(context)}

Respuestas de tus especialistas juniors:
${consolidatedContext}

TU TAREA:
1. Analiza las respuestas de los especialistas.
2. Sintetiza la respuesta final (max 1500 palabras).
3. Si hay conflicto entre especialidades, mencionalo.
4. Identifica lagunas o areas que requieren mas investigacion.
5. Incluye los 4 disclaimers obligatorios.
6. Proporciona base legal consolidada con articulos especificos.
7. Estructura: RESUMEN EJECUTIVO, BASE LEGAL, ANALISIS INTEGRAL, RECOMENDACIONES, DISCLAIMERS.

NO alucines. Si una respuesta es debil, mencionalo honestamente.`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{
        role: 'user',
        parts: [{ text: consolidationPrompt }]
      }],
      config: {
        systemInstruction: BASE_LEGAL_INSTRUCTION,
        temperature: 0.15,
        maxOutputTokens: 4096,
        tools: [{ googleSearch: {} }]
      }
    });

    const finalResponse = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      success: true,
      query,
      seniorSpecialty,
      specialists: applicableResponses.map(r => r.specialty),
      finalResponse,
      rawResponses: applicableResponses,
      tokensInput: response.usageMetadata?.promptTokenCount || 0,
      tokensOutput: response.usageMetadata?.candidatesTokenCount || 0,
      cost: ((response.usageMetadata?.promptTokenCount || 0) * 0.000000075) +
            ((response.usageMetadata?.candidatesTokenCount || 0) * 0.0000003),
      cached: false
    };
  } catch (e) {
    console.error('[orchestrator] Error consolidando:', e.message);
    return {
      success: false,
      error: e.message,
      query,
      seniorSpecialty
    };
  }
}

/**
 * Funcion principal: procesar una consulta legal
 * @param {string} query - La consulta del usuario
 * @param {object} context - Contexto adicional
 * @param {object} options - Opciones adicionales
 * @returns {Promise<object>} Respuesta consolidada
 */
export async function processLegalQuery(query, context = {}, options = {}) {
  const startTime = Date.now();
  const { forceSenior = null, forceSpecialties = null, skipCache = false } = options;

  // Verificar cache de respuesta completa
  const fullCacheKey = `legal-full:${hashKey({ q: query, c: context })}`;
  if (!skipCache) {
    const cached = await cache.get(fullCacheKey);
    if (cached) {
      await logAudit('LEGAL_QUERY_CACHED', {
        severity: 'INFO',
        ip: context.ip,
        userId: context.userId,
        query: query.slice(0, 100)
      });
      return { ...cached, cached: true, latencyMs: Date.now() - startTime };
    }
  }

  // Detectar especialidades relevantes
  const detectedSpecialties = forceSpecialties || legalRouter.detectSpecialties(query, context);
  const seniorSpecialty = forceSenior || legalRouter.determineSenior(detectedSpecialties);

  if (detectedSpecialties.length === 0) {
    return {
      success: false,
      error: 'No se pudo determinar la materia legal',
      query,
      latencyMs: Date.now() - startTime
    };
  }

  // PASO 1: Llamar a TODOS los juniors relevantes EN PARALELO
  const juniorResponses = await Promise.all(
    detectedSpecialties.map(s => callSpecialist(s, query, context))
  );

  // PASO 2: El senior consolida
  const consolidated = await consolidateWithSenior(
    seniorSpecialty,
    query,
    juniorResponses,
    context
  );

  // PASO 3: Audit log
  await logAudit('LEGAL_QUERY_PROCESSED', {
    severity: 'INFO',
    userId: context.userId,
    organizationId: context.organizationId,
    ip: context.ip,
    query: query.slice(0, 200),
    specialties: detectedSpecialties,
    seniorSpecialty,
    applicable: juniorResponses.filter(r => r.applicable).length,
    totalTokens: (consolidated.tokensInput || 0) + (consolidated.tokensOutput || 0) +
                 juniorResponses.reduce((s, r) => s + (r.tokensInput || 0) + (r.tokensOutput || 0), 0),
    totalCost: (consolidated.cost || 0) + juniorResponses.reduce((s, r) => s + (r.cost || 0), 0),
    latencyMs: Date.now() - startTime
  });

  // Guardar en cache
  if (consolidated.success) {
    await cache.set(fullCacheKey, consolidated, CACHE_TTL);
  }

  return {
    ...consolidated,
    latencyMs: Date.now() - startTime
  };
}

/**
 * Procesa una consulta legal de manera ASÍNCRONA con streaming
 * (Para cuando el usuario quiere ver el progreso)
 */
export async function* streamLegalQuery(query, context = {}) {
  const detectedSpecialties = legalRouter.detectSpecialties(query, context);
  const seniorSpecialty = legalRouter.determineSenior(detectedSpecialties);

  yield { type: 'start', query, detectedSpecialties, seniorSpecialty };

  // Stream de cada especialista
  for (const specialty of detectedSpecialties) {
    yield { type: 'specialist_start', specialty };
  }

  const responses = [];
  for (const specialty of detectedSpecialties) {
    const response = await callSpecialist(specialty, query, context);
    yield { type: 'specialist_end', specialty, response };
    responses.push(response);
  }

  yield { type: 'consolidation_start' };
  const consolidated = await consolidateWithSenior(seniorSpecialty, query, responses, context);
  yield { type: 'consolidation_end', consolidated };
  yield { type: 'done', final: consolidated };
}

export { BASE_LEGAL_INSTRUCTION, SPECIALTY_TO_AGENT, getSystemInstructionForSpecialty };
export default processLegalQuery;
