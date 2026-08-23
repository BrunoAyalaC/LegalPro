#!/usr/bin/env node
/**
 * RAG Advanced - Multi-query + RRF fusion + Reranking
 *
 * Mejora el retrieval:
 * 1. Descompone la pregunta en sub-queries (DeepSeek V4 Flash vía opencodeClient)
 * 2. Busca cada sub-query con retrieve()
 * 3. Fusiona con Reciprocal Rank Fusion (RRF)
 * 4. Reranquea: API BGE reranker (RERANKER_API_URL) → fallback heurístico
 *    (RRF + keyword overlap + posición + longitud). FIX RAG-SOTA-GAP1.
 *
 * Uso:
 *   import { buscarAvanzado } from './tools/rag/rag-advanced.mjs';
 *   const results = await buscarAvanzado('despido arbitrario sin pago de CTS', { materia: 'laboral' });
 *
 * Scoring final heurístico (pesos suman 1.0):
 *   score_final = rrf_norm * 0.60 + keyword * 0.25 + posicion * 0.10 + longitud * 0.05
 *   (con RERANKER_API_URL configurado el orden lo decide el cross-encoder;
 *    cada chunk lleva rerank_score + reranker:'bge-api'|'heuristico')
 *
 * Fallbacks de robustez:
 *   - Si DeepSeek no está configurado o falla -> usa la consulta original sola
 *   - Si una sub-query falla -> el resto continúa (allSettled)
 *   - Si la API de rerank falla -> heurístico local (fail-open, nunca lanza)
 *   - Si ninguna sub-query devuelve resultados -> []
 *
 * @version 1.1.0
 * @date 2026-08-22
 */

import { pathToFileURL } from 'node:url';
import { retrieve } from './retrieve.mjs';
// FIX RAG-SOTA-GAP1 (2026-08-22): reranker especializado (API BGE → fallback
// heurístico compartido). La lógica de reranquear() vive ahora en
// tools/rag/reranker.mjs (reranquearHeuristico) para evitar duplicación.
import { rerank, reranquearHeuristico } from './reranker.mjs';

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
 * Descompone una pregunta legal compleja en sub-queries más específicas.
 *
 * @param {string} pregunta - Consulta original del usuario
 * @param {string} [materia] - Materia legal para contextualizar (laboral, penal, civil...)
 * @returns {Promise<string[]>} - Sub-queries; si DeepSeek falla, devuelve [pregunta]
 */
export async function descomponerQuery(pregunta, materia) {
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
 * FIX RAG-SOTA-GAP1 (2026-08-22): la implementación se extrajo a
 * tools/rag/reranker.mjs (reranquearHeuristico) como helper compartido con el
 * reranker especializado. Delegación 1:1 — comportamiento idéntico
 * (score_final = rrf*0.60 + keyword*0.25 + posicion*0.10 + longitud*0.05).
 *
 * @param {Array<{id, rrf_score}>} resultadosFusionados - Salida de reciprocalRankFusion
 * @param {string} consultaOriginal - Consulta del usuario (para keyword overlap)
 * @param {object} detalles - Mapa id -> resultado completo de retrieve()
 * @param {object} [options] - Opciones { topK, ranksPorId, pesos }
 * @returns {Array} - Top-K reranqueados
 */
export function reranquear(resultadosFusionados, consultaOriginal, detalles, options = {}) {
  return reranquearHeuristico(resultadosFusionados, consultaOriginal, detalles, options);
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
  // FIX RAG-SOTA-GAP1 (2026-08-22): reranker especializado ANTES del heurístico
  // histórico (informe rag.txt §9: "reranking es una de las inversiones con
  // mejor retorno"). Orden de intentos:
  //   (a) API BGE reranker (RERANKER_API_URL + RERANKER_API_KEY, timeout 8s)
  //   (b) fallback heurístico compartido dentro de rerank() (misma lógica que
  //       reranquear()) — fail-open, NUNCA lanza.
  // Si el resultado trae rerank_score numérico se usa ese orden; si no (o si
  // algo inesperado falla), se cae al heurístico existente. Los campos
  // degraded/boosted_score viajan dentro de los candidatos (spread de detalles)
  // y el paso 6 re-aplica degraded desde la fuente igual que antes.
  let finales;
  try {
    const candidatos = fusionados.map((f) => ({ ...f, ...(detalles[f.id] || {}) }));
    const reranked = await rerank(consulta, candidatos, { topK });
    const usable =
      Array.isArray(reranked) &&
      reranked.length > 0 &&
      reranked.every((r) => typeof r.rerank_score === 'number');
    finales = usable
      ? reranked
      : reranquear(fusionados, consulta, detalles, { topK, ranksPorId });
  } catch {
    // Fail-open duro: el pipeline de búsqueda nunca se detiene por el reranker.
    finales = reranquear(fusionados, consulta, detalles, { topK, ranksPorId });
  }

  // 6. FIX P0-F2 propagación: heredar degraded desde los chunks fuente.
  //    Si un chunk apareció degradado en CUALQUIER sub-query, mantiene el flag.
  for (const r of finales) {
    if (detalles[r.id]?.degraded) r.degraded = true;
  }

  // 7. FIX 2026-08-22 (MEDIUM): umbral del caller aplicado SOLO aquí,
  //    post-rerank, sobre el score final (no sobre scores inflados ni
  //    recortando sub-queries). Sin threshold (null/0) → sin filtro.
  //    FIX GOLDEN-SET (2026-08-23): si hubo chunks degradados (modo hash),
  //    el umbral se adapta al espacio hash (CONFIG.umbralDegradado en
  //    retrieve.mjs = 0.20) — el threshold 0.70 asume embeddings reales.
  const huboDegraded = finales.some((r) => r.degraded);
  const umbralFinal = huboDegraded
    ? Math.min(threshold ?? 0.70, 0.20)
    : (threshold ?? 0.70);
  return finales.filter((r) => !umbralFinal || (r.score_final ?? r.similarity ?? 0) >= umbralFinal);
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
