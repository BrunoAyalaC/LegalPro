#!/usr/bin/env node
/**
 * RAG Advanced - Multi-query + RRF fusion + Reranking
 *
 * Mejora el retrieval:
 * 1. Descompone la pregunta en sub-queries (DeepSeek V4 Flash vía opencodeClient)
 * 2. Busca cada sub-query con retrieve()
 * 3. Fusiona con Reciprocal Rank Fusion (RRF)
 * 4. Reranquea con scoring híbrido (RRF + keyword overlap + posición + longitud)
 *
 * Uso:
 *   import { buscarAvanzado } from './tools/rag/rag-advanced.mjs';
 *   const results = await buscarAvanzado('despido arbitrario sin pago de CTS', { materia: 'laboral' });
 *
 * Scoring final (pesos suman 1.0):
 *   score_final = rrf_norm * 0.60 + keyword * 0.25 + posicion * 0.10 + longitud * 0.05
 *
 * Fallbacks de robustez:
 *   - Si DeepSeek no está configurado o falla -> usa la consulta original sola
 *   - Si una sub-query falla -> el resto continúa (allSettled)
 *   - Si ninguna sub-query devuelve resultados -> []
 *
 * FIX 2026-08-22: descomponerQuery agrega máx +1 sub-query con sinónimos
 * legales (SINONIMOS_LEGALES de retrieve.mjs) de términos en la query original.
 *
 * @version 1.1.0
 * @date 2026-08-22
 */

import { pathToFileURL } from 'node:url';
import { retrieve, expandirConSinonimos } from './retrieve.mjs';

// FIX DEPLOY (2026-08-22): import agnóstico al layout. En el repo local tools/
// vive junto a legalpro-app/ (../../legalpro-app/server/...), pero en el
// contenedor Docker tools está en /app/tools y server en /app/server
// (../../server/...). ESM estático no permite try/catch → dynamic import con
// fallback + caché del módulo resuelto.
let _opencodeClient = null;
async function getOpencodeClient() {
  if (_opencodeClient) return _opencodeClient;
  const candidates = [
    '../../server/utils/opencodeClient.js',        // layout contenedor: /app/tools/rag → /app/server
    '../../legalpro-app/server/utils/opencodeClient.js', // layout repo: tools/rag → legalpro-app/server
  ];
  let lastErr;
  for (const spec of candidates) {
    try {
      const mod = await import(spec);
      _opencodeClient = mod.default ?? mod;
      return _opencodeClient;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

const DEFAULTS = {
  subQueryTopK: 20,          // recall amplio por sub-query para alimentar el RRF
  subQueryThreshold: 0.4,    // umbral laxo: el reranking decide el top final
  rrfK: 60,                  // constante de suavizado RRF
  topK: 5,                   // resultados finales
  pesos: { rrf: 0.6, keyword: 0.25, posicion: 0.1, longitud: 0.05 },
  longitudOptimaMin: 300,    // chars
  longitudOptimaMax: 3000,   // chars
};

/**
 * Descompone vía LLM (lógica original extraída). NO usar directo: pasar por
 * descomponerQuery, que añade la expansión de sinónimos.
 *
 * @param {string} pregunta - Consulta original del usuario
 * @param {string} [materia] - Materia legal para contextualizar
 * @returns {Promise<string[]>} - Sub-queries LLM; si DeepSeek falla, [pregunta]
 */
async function subQueriesLLM(pregunta, materia) {
  let opencodeClient;
  try {
    opencodeClient = await getOpencodeClient();
  } catch {
    return [pregunta]; // sin cliente IA disponible → degradación honesta
  }
  if (!opencodeClient.isConfigured?.()) return [pregunta];

  const system = [
    'Descompón esta pregunta legal peruana en 2-4 sub-preguntas más específicas.',
    'Cada sub-pregunta debe enfocarse en un aspecto distinto (norma aplicable, plazos, jurisprudencia, procedimiento).',
    materia ? `Contexto de materia: ${materia}.` : '',
    'No inventes artículos ni leyes. Responde SOLO en JSON: {"queries": ["...", "..."]}',
  ].filter(Boolean).join('\n');

  try {
    const res = await opencodeClient.generateText(pregunta, {
      system,
      temperature: 0.1,      // determinismo: ámbito legal (regla PromptEngineer)
      maxTokens: 300,        // salida corta -> bajo costo
    });

    const match = String(res || '').match(/\{[\s\S]*\}/);
    const data = match ? JSON.parse(match[0]) : null;
    const queries = Array.isArray(data?.queries)
      ? data.queries.map((q) => String(q).trim()).filter(Boolean)
      : [];

    // Deduplicar y descartar duplicados exactos de la consulta original
    const unicas = [...new Set(queries)].filter((q) => q !== pregunta.trim());
    return unicas.length > 0 ? unicas : [pregunta];
  } catch {
    // DeepSeek no disponible o respuesta no-JSON -> fallback a la consulta original
    return [pregunta];
  }
}

/**
 * Descompone una pregunta legal compleja en sub-queries más específicas.
 *
 * FIX 2026-08-22 (precisión): además de las sub-queries del LLM, agrega
 * MÁXIMO +1 sub-query extra reemplazando los términos de SINONIMOS_LEGALES
 * presentes en la query ORIGINAL por sus sinónimos (ej. "demanda" →
 * "requerimiento o petitorio"). Solo aplica si el término aparece realmente;
 * si la expansión no produce nada nuevo, el resultado queda igual.
 *
 * @param {string} pregunta - Consulta original del usuario
 * @param {string} [materia] - Materia legal para contextualizar (laboral, penal, civil...)
 * @returns {Promise<string[]>} - Sub-queries (LLM + máx 1 de sinónimos)
 */
export async function descomponerQuery(pregunta, materia) {
  const base = await subQueriesLLM(pregunta, materia);

  // Expansión léxica por sinónimos legales (+1 sub-query máximo)
  const expandida = expandirConSinonimos(pregunta);
  if (!expandida || base.includes(expandida)) return base;
  return [...base, expandida];
}

/**
 * Reciprocal Rank Fusion (RRF) - combina resultados de múltiples queries.
 *
 * @param {Array<Array<object>>} listasResultados - Listas de resultados por sub-query
 * @param {number} k - Constante de suavizado (default 60)
 * @returns {Array<{id, rrf_score}>} - Resultados fusionados ordenados por score
 */
export function reciprocalRankFusion(listasResultados, k = DEFAULTS.rrfK) {
  const scores = new Map();

  for (const resultados of listasResultados) {
    resultados.forEach((r, idx) => {
      const score = 1 / (k + idx + 1);
      scores.set(r.id, (scores.get(r.id) || 0) + score);
    });
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ id, rrf_score: score }));
}

/**
 * Reranking: combina RRF score con keyword overlap, posición promedio y longitud.
 *
 * @param {Array<{id, rrf_score}>} resultadosFusionados - Salida de reciprocalRankFusion
 * @param {string} consultaOriginal - Consulta del usuario (para keyword overlap)
 * @param {object} detalles - Mapa id -> resultado completo de retrieve()
 * @param {object} [options] - Opciones { topK, ranksPorId, pesos }
 * @returns {Array} - Top-K reranqueados
 */
export function reranquear(resultadosFusionados, consultaOriginal, detalles, options = {}) {
  const { topK = DEFAULTS.topK, ranksPorId = new Map(), pesos = DEFAULTS.pesos } = options;

  const queryTerms = consultaOriginal.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
  const maxRrf = resultadosFusionados.reduce((max, f) => Math.max(max, f.rrf_score), 0) || 1;

  return resultadosFusionados
    .map((f) => {
      const detalle = detalles[f.id] || {};
      const content = (detalle.content || '').toLowerCase();
      const length = content.length;

      // 1. Keyword overlap: proporción de términos de la consulta presentes en el chunk
      const keywordMatches = queryTerms.filter((t) => content.includes(t)).length;
      const keywordScore = queryTerms.length ? keywordMatches / queryTerms.length : 0;

      // 2. Posición: rank promedio en todas las listas (mejor rank -> score alto)
      const ranks = ranksPorId.get(f.id) || [detalle.rank || DEFAULTS.subQueryTopK];
      const avgRank = ranks.reduce((a, b) => a + b, 0) / ranks.length;
      const positionScore = Math.max(0, 1 - (avgRank - 1) / DEFAULTS.subQueryTopK);

      // 3. Longitud: óptimo en [300, 3000] chars; castigo fuera del rango
      let lengthScore = 0;
      if (length > 0) {
        if (length < DEFAULTS.longitudOptimaMin) {
          lengthScore = length / DEFAULTS.longitudOptimaMin;
        } else if (length > DEFAULTS.longitudOptimaMax) {
          lengthScore = DEFAULTS.longitudOptimaMax / length;
        } else {
          lengthScore = 1;
        }
      }

      // 4. RRF normalizado a [0, 1] para comparabilidad con las demás señales
      const rrfNorm = f.rrf_score / maxRrf;

      const score_final =
        rrfNorm * pesos.rrf +
        keywordScore * pesos.keyword +
        positionScore * pesos.posicion +
        lengthScore * pesos.longitud;

      return {
        ...f,
        ...detalle,
        rrf_norm: rrfNorm,
        keyword_matches: keywordMatches,
        avg_rank: avgRank,
        score_final: Number(score_final.toFixed(4)),
      };
    })
    .sort((a, b) => b.score_final - a.score_final)
    .slice(0, topK);
}

/**
 * Búsqueda avanzada completa: multi-query + RRF + reranking.
 *
 * FIX LDDE-GAP1 (2026-08-22): ahora acepta `filter` y `threshold` para poder
 * ser el path PRINCIPAL de producción (antes solo soportaba materia y nadie
 * lo importaba). Propaga el flag `degraded` de los sub-queries: si cualquier
 * chunk fuente corrió en modo hash-fallback, el resultado final también es
 * degraded (nunca presentable como jurisprudencia verificada).
 *
 * @param {string} consulta - Consulta del usuario
 * @param {object} [options] - Opciones { materia, topK, filter, threshold }
 * @returns {Promise<Array>} - Top-K resultados reranqueados
 */
export async function buscarAvanzado(consulta, options = {}) {
  const { materia, topK = DEFAULTS.topK, filter = null, threshold = null } = options;

  // 1. Descomponer en sub-queries (fallback: consulta original sola)
  const subQueries = await descomponerQuery(consulta, materia);

  // 2. Buscar cada sub-query en paralelo (allSettled: un fallo no rompe el resto)
  // FIX 2026-08-22 (MEDIUM): los sub-queries usan SIEMPRE el threshold laxo por
  // diseño — propagar el threshold estricto del caller mata recall multi-query.
  // El umbral del caller se aplica UNA sola vez al final, post-rerank.
  const effectiveFilter = filter || (materia ? { materia } : {});
  const settled = await Promise.allSettled(
    subQueries.map((q) =>
      retrieve(q, {
        topK: DEFAULTS.subQueryTopK,
        threshold: DEFAULTS.subQueryThreshold,
        filter: effectiveFilter,
      })
    )
  );

  const resultadosPorQuery = [];
  for (const s of settled) {
    if (s.status === 'fulfilled' && Array.isArray(s.value) && s.value.length > 0) {
      resultadosPorQuery.push(s.value);
    }
    // rejected -> se ignora; el RRF trabaja con las listas que sí respondieron
  }

  if (resultadosPorQuery.length === 0) return [];

  // 3. RRF fusion
  const fusionados = reciprocalRankFusion(resultadosPorQuery);

  // 4. Construir mapa de detalles + mapa de ranks por id
  const detalles = {};
  const ranksPorId = new Map();
  for (const lista of resultadosPorQuery) {
    lista.forEach((r, idx) => {
      detalles[r.id] = r;
      ranksPorId.set(r.id, [...(ranksPorId.get(r.id) || []), idx + 1]);
    });
  }

  // 5. Rerank y top-K
  const finales = reranquear(fusionados, consulta, detalles, { topK, ranksPorId });

  // 6. FIX P0-F2 propagación: heredar degraded desde los chunks fuente.
  //    Si un chunk apareció degradado en CUALQUIER sub-query, mantiene el flag.
  for (const r of finales) {
    if (detalles[r.id]?.degraded) r.degraded = true;
  }

  // 7. FIX 2026-08-22 (MEDIUM): umbral del caller aplicado SOLO aquí,
  //    post-rerank, sobre el score final (no sobre scores inflados ni
  //    recortando sub-queries). Sin threshold (null/0) → sin filtro.
  return finales.filter((r) => !threshold || (r.score_final ?? r.similarity ?? 0) >= threshold);
}

// CLI para test
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const consulta = process.argv[2] || 'despido arbitrario sin pago de CTS';
  const materia = process.argv[3] || 'laboral';
  console.log(`Buscando: "${consulta}" (${materia})`);
  buscarAvanzado(consulta, { materia })
    .then((r) => {
      console.log('Resultados:', r.length);
      r.forEach((x) => console.log(' -', x.id, x.score_final?.toFixed(3)));
    })
    .catch((e) => console.error('ERR:', e.message));
}
