#!/usr/bin/env node
/**
 * RAG Reranker especializado — GAP-1 del informe SOTA (rag.txt §9)
 *
 * Sustituye/complementa el reranking heurístico con un cross-encoder real:
 *
 *   (a) API BGE reranker  → si RERANKER_API_URL + RERANKER_API_KEY están
 *       configuradas. Contrato: POST { model, query, documents: [texto...] }
 *       → { results: [{ index, relevance_score }] } (formato SiliconFlow /
 *       Cohere-rerank / Jina / HF Inference compatible).
 *   (b) Fallback heurístico → la MISMA lógica de `reranquear()` de
 *       rag-advanced.mjs, extraída aquí como helper compartido
 *       (`reranquearHeuristico`) para evitar duplicación.
 *
 * FAIL-OPEN: si la API falla (timeout, 4xx/5xx, respuesta malformada) se cae
 * al heurístico. Esta función NUNCA lanza.
 *
 * Cada chunk retornado lleva:
 *   - rerank_score: number  (relevance_score del cross-encoder o score_final heurístico)
 *   - reranker: 'bge-api' | 'heuristico'
 *
 * ==========================================
 * VARIABLES DE ENTORNO
 * ==========================================
 *   RERANKER_API_URL      Endpoint HTTP POST del reranker. Ejemplos:
 *                         - SiliconFlow: https://api.siliconflow.cn/v1/rerank
 *                           (con RERANKER_MODEL=BAAI/bge-reranker-v2-m3)
 *                         - HF Inference:
 *                           https://router.huggingface.co/hf-inference/models/BAAI/bge-reranker-v2-m3
 *   RERANKER_API_KEY      Bearer token del proveedor.
 *   RERANKER_MODEL        (opcional) default 'BAAI/bge-reranker-v2-m3'.
 *   RERANKER_TIMEOUT_MS   (opcional) timeout del fetch, default 8000 (8s).
 *   RERANKER_MAX_DOC_CHARS (opcional) truncado por documento enviado a la API,
 *                         default 4000 chars (control de coste; el informe §9
 *                         recomienda reranquear solo 20-100 candidatos).
 *
 * Uso:
 *   import { rerank } from './tools/rag/reranker.mjs';
 *   const top = await rerank('despido arbitrario CTS', chunks, { topK: 10 });
 *
 * @author  BackendNode (RAG)
 * @version 1.0.0
 * @date    2026-08-22
 */

// Defaults del heurístico (portados 1:1 desde rag-advanced.mjs DEFAULTS para
// que el fallback sea conductualmente idéntico al reranking histórico).
export const HEURISTIC_DEFAULTS = Object.freeze({
  topK: 5,
  subQueryTopK: 20,          // rank máximo esperado (para normalizar posición)
  pesos: { rrf: 0.6, keyword: 0.25, posicion: 0.1, longitud: 0.05 },
  longitudOptimaMin: 300,    // chars
  longitudOptimaMax: 3000,   // chars
});

const API_DEFAULTS = Object.freeze({
  model: process.env.RERANKER_MODEL || 'BAAI/bge-reranker-v2-m3',
  timeoutMs: Math.max(1000, parseInt(process.env.RERANKER_TIMEOUT_MS || '8000', 10)),
  maxDocChars: Math.max(200, parseInt(process.env.RERANKER_MAX_DOC_CHARS || '4000', 10)),
});

/** Texto indexable de un chunk (acepta .text o .content según el caller). */
function chunkText(chunk) {
  return String(chunk?.text ?? chunk?.content ?? '').substring(0, API_DEFAULTS.maxDocChars);
}

/**
 * Intenta el rerank vía API BGE. Devuelve array de chunks ordenados por
 * relevance_score DESC con { rerank_score, reranker:'bge-api' }, o null si
 * la API no está configurada o falla (fail-open).
 *
 * @param {string} query
 * @param {Array<object>} chunks - Deben tener id + text/content
 * @returns {Promise<Array|null>}
 */
async function rerankViaApi(query, chunks) {
  const url = process.env.RERANKER_API_URL;
  const key = process.env.RERANKER_API_KEY;
  if (!url || !key) return null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: API_DEFAULTS.model,
        query: String(query || ''),
        documents: chunks.map(chunkText),
      }),
      signal: AbortSignal.timeout(API_DEFAULTS.timeoutMs),
    });
    if (!res.ok) return null;

    const data = await res.json();
    // Formato canónico { results: [{index, relevance_score}] }; tolera
    // variantes ({ data: [...] }) y score alternativo (`score`).
    const results = Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data?.data) ? data.data : null;
    if (!results || results.length === 0) return null;

    const scored = [];
    for (const r of results) {
      const idx = Number(r?.index);
      const score = Number(r?.relevance_score ?? r?.score);
      if (!Number.isInteger(idx) || idx < 0 || idx >= chunks.length) continue;
      if (!Number.isFinite(score)) continue;
      scored.push({ score, idx });
    }
    if (scored.length === 0) return null;

    return scored
      .sort((a, b) => b.score - a.score)
      .map(({ score, idx }) => ({
        ...chunks[idx],
        rerank_score: Number(score.toFixed(6)),
        reranker: 'bge-api',
      }));
  } catch {
    return null; // timeout / red / JSON inválido → fail-open
  }
}

/**
 * Reranking heurístico compartido (lógica extraída de reranquear() en
 * rag-advanced.mjs, comportamiento idéntico):
 *
 *   score_final = rrf_norm * 0.60 + keyword * 0.25 + posicion * 0.10 + longitud * 0.05
 *
 * @param {Array<{id, rrf_score}>} resultadosFusionados - Salida de RRF
 * @param {string} consultaOriginal - Consulta del usuario (keyword overlap)
 * @param {object} detalles - Mapa id -> resultado completo (content, rank...)
 * @param {object} [options] - { topK, ranksPorId:Map, pesos }
 * @returns {Array} Top-K con score_final
 */
export function reranquearHeuristico(resultadosFusionados, consultaOriginal, detalles, options = {}) {
  const {
    topK = HEURISTIC_DEFAULTS.topK,
    ranksPorId = new Map(),
    pesos = HEURISTIC_DEFAULTS.pesos,
  } = options;

  const queryTerms = String(consultaOriginal || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 3);
  const maxRrf = resultadosFusionados.reduce((max, f) => Math.max(max, f.rrf_score), 0) || 1;

  return resultadosFusionados
    .map((f) => {
      const detalle = detalles[f.id] || {};
      const content = String(detalle.content || '').toLowerCase();
      const length = content.length;

      // 1. Keyword overlap: proporción de términos de la consulta presentes
      const keywordMatches = queryTerms.filter((t) => content.includes(t)).length;
      const keywordScore = queryTerms.length ? keywordMatches / queryTerms.length : 0;

      // 2. Posición: rank promedio en todas las listas (mejor rank -> alto)
      const ranks = ranksPorId.get(f.id) || [detalle.rank || HEURISTIC_DEFAULTS.subQueryTopK];
      const avgRank = ranks.reduce((a, b) => a + b, 0) / ranks.length;
      const positionScore = Math.max(0, 1 - (avgRank - 1) / HEURISTIC_DEFAULTS.subQueryTopK);

      // 3. Longitud: óptimo en [300, 3000] chars; castigo fuera del rango
      let lengthScore = 0;
      if (length > 0) {
        if (length < HEURISTIC_DEFAULTS.longitudOptimaMin) {
          lengthScore = length / HEURISTIC_DEFAULTS.longitudOptimaMin;
        } else if (length > HEURISTIC_DEFAULTS.longitudOptimaMax) {
          lengthScore = HEURISTIC_DEFAULTS.longitudOptimaMax / length;
        } else {
          lengthScore = 1;
        }
      }

      // 4. RRF normalizado a [0, 1]
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
 * Punto de entrada único (GAP-1). Orden de intentos:
 *   1. API BGE reranker (si env configurada) → reranker:'bge-api'
 *   2. Fallback heurístico compartido        → reranker:'heuristico'
 *
 * Fail-open garantizado: nunca lanza; ante cualquier error devuelve el
 * resultado heurístico (o [] si no hay chunks).
 *
 * @param {string} query - Consulta del usuario
 * @param {Array<object>} chunks - Candidatos (id + text|content + scores previos)
 * @param {object} [options] - { topK = 10 }
 * @returns {Promise<Array>} Chunks ordenados por relevancia, con
 *   rerank_score:number y reranker:'bge-api'|'heuristico'
 */
export async function rerank(query, chunks, { topK = 10 } = {}) {
  if (!Array.isArray(chunks) || chunks.length === 0) return [];

  // (a) Cross-encoder remoto
  const viaApi = await rerankViaApi(query, chunks);
  if (viaApi && viaApi.length > 0) {
    return viaApi.slice(0, topK);
  }

  // (b) Heurístico local (misma lógica que reranquear() histórico). Los
  // candidatos ya traen sus campos fusionados (rrf_score, content, rank...),
  // así que el mapa de detalles son ellos mismos.
  const detalles = {};
  for (const c of chunks) {
    if (c && c.id != null) detalles[c.id] = c;
  }
  const fusionados = chunks.map((c) => ({
    id: c.id,
    rrf_score: typeof c.rrf_score === 'number' ? c.rrf_score : 0,
  }));

  const heuristicos = reranquearHeuristico(fusionados, query, detalles, { topK });
  return heuristicos.map((r) => ({
    ...r,
    rerank_score: r.score_final,
    reranker: 'heuristico',
  }));
}
