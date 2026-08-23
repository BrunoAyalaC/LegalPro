#!/usr/bin/env node
/**
 * eval-golden.mjs — Evaluador del golden set RAG (informe SOTA RAG §27)
 *
 * Ejecuta cada query de golden-set.json contra el pipeline REAL de
 * producción (buscarAvanzado: multi-query + RRF + rerank) y calcula:
 *
 *   - hit_rate          % de queries answerable donde ALGÚN chunk.source
 *                       coincide con evidence_hint (recall@topK por fuente)
 *   - mrr               Mean Reciprocal Rank básico: media de 1/rank de la
 *                       PRIMERA coincidencia source===evidence_hint (0 si no hay)
 *   - abstention_correct % de queries unanswerable donde el sistema se abstuvo:
 *                       resultado vacío O todos los chunks degradados
 *                       (hash-fallback cross-space = no presentable como fuente)
 *   - latencia p50/p95  ms por query end-to-end (incluye descomposición IA)
 *
 * Uso:
 *   node tools/rag/eval-golden.mjs                 # set completo (50 queries)
 *   node tools/rag/eval-golden.mjs --limit 5       # prueba parcial
 *   node tools/rag/eval-golden.mjs --dry-run       # valida estructura sin BD
 *
 * Requiere DATABASE_URL (PostgreSQL con rag_vectors_v2 poblada). NO apuntar
 * a prod sin autorización: cada query dispara embeddings + posible LLM de
 * descomposición. Guarda: NODE_ENV=production exige ALLOW_EVAL_PROD=1.
 *
 * Salida: tabla resumen en consola + tools/rag/golden-results-latest.json
 *
 * @version 1.0.0
 * @date    2026-08-23
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { buscarAvanzado } from './rag-advanced.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOLDEN_PATH = path.join(__dirname, 'golden-set.json');
const RESULTS_PATH = path.join(__dirname, 'golden-results-latest.json');

const CONFIG = {
  topK: 5,
  timeoutMsPerQuery: Number(process.env.RAG_EVAL_TIMEOUT_MS || 30000),
};

// ─────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { limit: null, dryRun: false };
  // soporta "--limit=5" y "--limit 5"
  const idx = argv.indexOf('--limit');
  if (idx !== -1) {
    const raw = argv[idx + 1];
    args.limit = raw && /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : NaN;
  }
  const inline = argv.find((a) => /^--limit=\d+$/.test(a));
  if (inline) args.limit = Number.parseInt(inline.split('=')[1], 10);
  if (argv.includes('--dry-run')) args.dryRun = true;

  if (args.limit !== null && (Number.isNaN(args.limit) || args.limit < 1)) {
    console.error('❌ --limit debe ser un entero >= 1');
    process.exit(1);
  }
  return args;
}

// ─────────────────────────────────────────────────────────────────
// Utilidades de métricas
// ─────────────────────────────────────────────────────────────────

/** Percentil por nearest-rank sobre array numérico. */
function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[idx]);
}

/**
 * Rank (1-based) de la primera coincidencia source === evidence_hint.
 * @returns {number} rank o 0 si no hay coincidencia
 */
function firstMatchRank(results, evidenceHint) {
  if (!evidenceHint) return 0;
  const idx = results.findIndex((r) => r.source === evidenceHint);
  return idx === -1 ? 0 : idx + 1;
}

/**
 * Abstención correcta para unanswerable:
 *   - resultados vacíos, O
 *   - TODOS los chunks degradados (embedding hash-fallback → cross-space,
 *     nunca presentable como evidencia verificada).
 */
function isCorrectAbstention(results) {
  if (!Array.isArray(results) || results.length === 0) return true;
  return results.every((r) => r.degraded === true);
}

// ─────────────────────────────────────────────────────────────────
// Carga y validación del golden set
// ─────────────────────────────────────────────────────────────────
function loadGoldenSet() {
  if (!fs.existsSync(GOLDEN_PATH)) {
    console.error(`❌ No existe ${GOLDEN_PATH}`);
    process.exit(1);
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
  } catch (e) {
    console.error(`❌ golden-set.json no es JSON válido: ${e.message}`);
    process.exit(1);
  }
  const entries = Array.isArray(parsed.queries) ? parsed.queries : [];
  if (entries.length === 0) {
    console.error('❌ golden-set.json sin entries en .queries');
    process.exit(1);
  }

  // Validación estructural mínima (falla rápido antes de tocar la BD)
  const errors = [];
  const seenIds = new Set();
  entries.forEach((e, i) => {
    if (!e.id || seenIds.has(e.id)) errors.push(`[${i}] id ausente o duplicado`);
    seenIds.add(e.id);
    if (typeof e.query !== 'string' || e.query.trim().length === 0) errors.push(`[${e.id}] query vacía`);
    if (typeof e.answerable !== 'boolean') errors.push(`[${e.id}] answerable debe ser boolean`);
    if (e.answerable === true && typeof e.evidence_hint !== 'string') {
      errors.push(`[${e.id}] answerable=true exige evidence_hint string`);
    }
    if (e.answerable === false && e.expected !== 'abstain') {
      errors.push(`[${e.id}] answerable=false exige expected:'abstain'`);
    }
  });
  if (errors.length > 0) {
    console.error(`❌ Golden set inválido (${errors.length} errores):\n  - ${errors.slice(0, 10).join('\n  - ')}`);
    process.exit(1);
  }
  return entries;
}

// ─────────────────────────────────────────────────────────────────
// Ejecución principal
// ─────────────────────────────────────────────────────────────────
async function runEval(entries) {
  const perEntry = [];
  const t0Global = Date.now();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const label = `${entry.id} [${entry.categoria}]`;
    process.stdout.write(`(${i + 1}/${entries.length}) ${label} ... `);

    const t0 = Date.now();
    let results = [];
    let error = null;
    try {
      const exec = buscarAvanzado(entry.query, { topK: CONFIG.topK });
      const guard = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`timeout ${CONFIG.timeoutMsPerQuery}ms`)), CONFIG.timeoutMsPerQuery)
      );
      results = await Promise.race([exec, guard]);
      if (!Array.isArray(results)) results = [];
    } catch (e) {
      error = e.message;
    }
    const latencyMs = Date.now() - t0;

    const record = {
      id: entry.id,
      categoria: entry.categoria,
      query: entry.query,
      answerable: entry.answerable,
      evidence_hint: entry.evidence_hint ?? null,
      latency_ms: latencyMs,
      n_results: results.length,
      all_degraded: results.length > 0 && results.every((r) => r.degraded === true),
      sources_returned: results.map((r) => r.source),
      top_score: typeof results[0]?.score_final === 'number'
        ? Number(results[0].score_final.toFixed(4))
        : (typeof results[0]?.similarity === 'number'
          ? Number(results[0].similarity.toFixed(4))
          : null),
      hit: false,
      reciprocal_rank: 0,
      abstention_correct: null,
      error,
    };

    if (entry.answerable) {
      const rank = firstMatchRank(results, entry.evidence_hint);
      record.hit = rank > 0;
      record.reciprocal_rank = rank > 0 ? Number((1 / rank).toFixed(4)) : 0;
    } else {
      record.abstention_correct = isCorrectAbstention(results);
    }

    perEntry.push(record);
    const flag = error ? `ERROR: ${error}`
      : entry.answerable ? (record.hit ? `HIT rank=${Math.round(1 / record.reciprocal_rank)}` : 'MISS')
      : (record.abstention_correct ? 'ABSTUVO ✓' : 'RESPONDIÓ ✗');
    console.log(`${latencyMs}ms → ${flag}`);
  }

  return { perEntry, totalMs: Date.now() - t0Global };
}

// ─────────────────────────────────────────────────────────────────
// Agregación + reporte
// ─────────────────────────────────────────────────────────────────
function aggregate(perEntry) {
  const answerable = perEntry.filter((r) => r.answerable && !r.error);
  const unanswerable = perEntry.filter((r) => !r.answerable && !r.error);
  const okLatencies = perEntry.filter((r) => !r.error).map((r) => r.latency_ms);

  const byCategoria = {};
  for (const r of perEntry) {
    byCategoria[r.categoria] ??= { total: 0, hits: 0, rr_sum: 0, abstains_ok: 0, errors: 0 };
    const c = byCategoria[r.categoria];
    c.total += 1;
    if (r.error) c.errors += 1;
    if (r.answerable) {
      if (r.hit) c.hits += 1;
      c.rr_sum += r.reciprocal_rank;
    } else if (r.abstention_correct) {
      c.abstains_ok += 1;
    }
  }

  return {
    total_queries: perEntry.length,
    errores_ejecucion: perEntry.filter((r) => r.error).length,
    hit_rate: answerable.length > 0
      ? Number((answerable.filter((r) => r.hit).length / answerable.length).toFixed(4))
      : 0,
    mrr: answerable.length > 0
      ? Number((answerable.reduce((s, r) => s + r.reciprocal_rank, 0) / answerable.length).toFixed(4))
      : 0,
    abstention_correct: unanswerable.length > 0
      ? Number((unanswerable.filter((r) => r.abstention_correct).length / unanswerable.length).toFixed(4))
      : null,
    latencia_p50_ms: percentile(okLatencies, 50),
    latencia_p95_ms: percentile(okLatencies, 95),
    by_categoria: byCategoria,
  };
}

function printSummary(metrics) {
  const pct = (v) => (v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`);
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(' RESUMEN GOLDEN SET RAG (buscarAvanzado, topK=%d)', CONFIG.topK);
  console.log('══════════════════════════════════════════════════════════');
  console.log(` Queries ejecutadas      : ${metrics.total_queries} (${metrics.errores_ejecucion} con error)`);
  console.log(` Hit rate (source match) : ${pct(metrics.hit_rate)}`);
  console.log(` MRR                     : ${metrics.mrr.toFixed(3)}`);
  console.log(` Abstención correcta     : ${metrics.abstention_correct === null ? 'n/a' : pct(metrics.abstention_correct)}`);
  console.log(` Latencia p50 / p95 (ms) : ${metrics.latencia_p50_ms} / ${metrics.latencia_p95_ms}`);
  console.log('──────────────────────────────────────────────────────────');
  console.log(' Por categoría:');
  console.log('   categoria               total  hit  abst  err');
  for (const [cat, c] of Object.entries(metrics.by_categoria)) {
    console.log(
      `   ${cat.padEnd(24)}${String(c.total).padStart(4)}  ${String(c.hits).padStart(4)}  ${String(c.abstains_ok).padStart(4)}  ${String(c.errors).padStart(3)}`
    );
  }
  console.log('══════════════════════════════════════════════════════════');
}

// ─────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const entries = loadGoldenSet();
  const selected = args.limit ? entries.slice(0, args.limit) : entries;

  console.log(`📋 Golden set cargado: ${entries.length} entradas | seleccionadas: ${selected.length}`);

  if (args.dryRun) {
    const cats = {};
    for (const e of selected) cats[e.categoria] = (cats[e.categoria] || 0) + 1;
    console.log('✅ Estructura válida (--dry-run). Distribución:', cats);
    return;
  }

  // Guards anti-ejecución accidental
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no configurada. Usa --dry-run para validar solo estructura.');
    process.exit(1);
  }
  // FIX GOLDEN-SET (2026-08-23): el corpus productivo vive en rag_vectors_v2.
  // Sin este default el evaluador consultaba la tabla v1 vacía → 0% hit rate
  // falso (el golden set hizo su trabajo: expuso el desajuste de configuración).
  process.env.RAG_USE_V2 ??= 'true';
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_EVAL_PROD !== '1') {
    console.error('❌ NODE_ENV=production sin ALLOW_EVAL_PROD=1: evaluador bloqueado (cada query consume embeddings/LLM).');
    process.exit(1);
  }

  const { perEntry, totalMs } = await runEval(selected);
  const metrics = aggregate(perEntry);
  printSummary(metrics);

  const output = {
    _meta: {
      generado: new Date().toISOString(),
      duracion_total_ms: totalMs,
      config: CONFIG,
      script: 'tools/rag/eval-golden.mjs',
      golden_set_version: '1.0.0',
    },
    metrics,
    per_entry: perEntry,
  };
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`💾 Resultados guardados en ${path.relative(process.cwd(), RESULTS_PATH)}`);
}

// Solo auto-ejecuta cuando es el proceso principal (no al ser importado)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error('❌ Error fatal:', e.message);
    process.exit(1);
  });
}
