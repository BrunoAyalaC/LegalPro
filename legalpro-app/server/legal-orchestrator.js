// legalpro-app/server/legal-orchestrator.js
// Orquestador del sistema multi-agente legal
// Generado por @arquitecto-chief + @abogado-chief
// Patron: abogado-senior -> abogado-jr-* especialistas -> consolidacion -> usuario

import { GoogleGenAI } from '@google/genai';
import { legalRouter } from './legal-router.js';
import Cache from './cache-redis.js';
const cache = Cache;
import { logAudit } from '../utils/audit.js';
import crypto from 'node:crypto';

const GEMINI_MODEL = 'gemini-2.5-flash-lite'; // Gemini 3.5 Flash Lite
const API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });

// System instruction base (compartido por todos los abogados)
const BASE_LEGAL_INSTRUCTION = `Eres parte del sistema LegalPro / LexIA Peru, un asistente juridico especializado en el ordenamiento peruano.

REGLAS DURAS:
1. Cita SIEMPRE la base legal (CC, CP, CPC, NCPP, LPDP, etc.) con articulo.
2. NUNCA inventes jurisprudencia. Si no conoces, di "consultar fuentes oficiales".
3. SIEMPRE incluye los 4 disclaimers obligatorios al final:
   - "Esto NO constituye asesoria legal"
   - "Consulta con un abogado colegiado"
   - "Verifica la vigencia de las normas citadas"
   - "La IA puede cometer errores"
4. Considera el LPDP 29733 (consentimientos, ARCO, transferencia internacional).
5. Si la consulta es cross-rama, escala al senior correspondiente.
6. Output en espanol Peru (es-PE).
7. Estructura: HECHOS, BASE LEGAL, ANALISIS, CONCLUSION, DISCLAIMERS.

CATALOGOS DISPONIBLES (single source of truth):
- catalogs/codigos-leyes.json (20 codigos y leyes)
- catalogs/tipos-penales-peru.json (25 tipos penales)
- catalogs/plazos-procesales.json (17 plazos)
- catalogs/delitos-economicos.json
- catalogs/reguladores-peru.json
- catalogs/disclaimers-ia.json

SIEMPRE valida tus respuestas contra los catalogos antes de responder.`;

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
- Si hay conflicto con otra rama del derecho, mencionalo.`;
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
        maxOutputTokens: 2048
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
        maxOutputTokens: 4096
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
