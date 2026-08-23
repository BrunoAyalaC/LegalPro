#!/usr/bin/env node
/**
 * RAG Stress Test - LegalPro
 *
 * Valida el sistema RAG bajo carga concurrente, midiendo latencia,
 * throughput y tasa de exito del flujo completo (embedding + pgvector
 * + hybrid re-ranking + cache).
 *
 * CARACTERISTICAS:
 *  - Percentiles con interpolacion lineal (p50/p95/p99/max)
 *  - Histograma de latencias en 4 buckets
 *  - Top errores categorizados
 *  - Warm-up configurable (descarta outliers de JIT/cache cold-start)
 *  - Manejo de SIGINT para abortar limpio
 *  - Validacion temprana de envs (DATABASE_URL + OPENAI_API_KEY|GEMINI_API_KEY)
 *  - Soporte para --help
 *
 * Uso:
 *   node tools/rag/stress-test.mjs                       # Default
 *   node tools/rag/stress-test.mjs --users=100 --reqs=500
 *   node tools/rag/stress-test.mjs --duration=60 --warmup=20
 *   node tools/rag/stress-test.mjs --help
 *
 * NOTA SOBRE CACHE:
 *   junior-rag-wrapper.mjs mantiene cache in-memory con TTL de 1h.
 *   Para evitar que la mayoria de requests peguen al cache, este
 *   script agrega un sufijo unico por iteracion a cada consulta.
 *
 * UMBRALES (ajustables via env):
 *   STRESS_MIN_SUCCESS_RATE  (default 95.0)
 *   STRESS_MAX_P95_MS        (default 3000)
 *   STRESS_MAX_P99_MS        (default 6000)
 *
 * Exit codes:
 *   0   PASS - todos los umbrales OK
 *   1   FAIL - umbral(es) no cumplido(s) o error fatal
 *   130 ABORT - cancelado por SIGINT
 */

import { consultarBaseLegal } from './junior-rag-wrapper.mjs';

// =====================================================
// CLI ARGS PARSER (liviano, sin dependencias)
// =====================================================

function getArg(name, defaultValue) {
  const flag = "--" + name;
  const match = process.argv.find((a) => a.startsWith(flag + "="));
  if (match) return match.split("=")[1];
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return defaultValue;
}

function hasFlag(name) {
  return process.argv.includes("--" + name);
}

function showHelp() {
  console.log("RAG Stress Test - LegalPro\n\nUso:\n  node tools/rag/stress-test.mjs [opciones]\n\nOpciones:\n  --users=N       Cantidad de usuarios virtuales concurrentes (default 50)\n  --reqs=N        Total de requests a ejecutar (default 100)\n  --duration=N    Duracion maxima en segundos (default 30)\n  --warmup=N      Requests de warm-up antes de empezar a medir (default 10)\n  --help          Muestra esta ayuda\n\nVariables de entorno:\n  DATABASE_URL              Requerida (Postgres + pgvector)\n  OPENAI_API_KEY            Proveedor embeddings (opcional A)\n  GEMINI_API_KEY            Proveedor embeddings (opcional B)\n  STRESS_MIN_SUCCESS_RATE   % exito minima (default 95)\n  STRESS_MAX_P95_MS         Latencia p95 maxima en ms (default 3000)\n  STRESS_MAX_P99_MS         Latencia p99 maxima en ms (default 6000)\n\nExit codes:\n  0   PASS - todos los umbrales OK\n  1   FAIL - umbral(es) no cumplido(s) o error fatal\n  130 ABORT - cancelado por SIGINT\n");
  process.exit(0);
}

if (hasFlag("help") || process.argv.includes("-h")) {
  showHelp();
}
// =====================================================
// CONFIG
// =====================================================

const CONFIG = {
  users: Math.max(1, parseInt(getArg("users", "50"), 10) || 50),
  totalRequests: Math.max(1, parseInt(getArg("reqs", "100"), 10) || 100),
  duration: Math.max(1, parseInt(getArg("duration", "30"), 10) || 30),
  warmup: Math.max(0, parseInt(getArg("warmup", "10"), 10) || 0),
  thresholds: {
    minSuccessRate: parseFloat(process.env.STRESS_MIN_SUCCESS_RATE || "95.0"),
    maxP95Ms: parseInt(process.env.STRESS_MAX_P95_MS || "3000", 10),
    maxP99Ms: parseInt(process.env.STRESS_MAX_P99_MS || "6000", 10)
  },
  materias: ["civil", "penal", "laboral", "tributario", "constitucional", "familia"],
  // Consultas semilla; el script les agrega un sufijo unico por iteracion
  // para evitar el cache in-memory del wrapper (TTL 1h).
  consultasSample: [
    "plazo para contestar demanda civil",
    "que es el delito de lavado de activos",
    "calculo de CTS para 5 anos",
    "tasa IGV restaurantes 2026",
    "derecho a la protesta constitucional",
    "divorcio por causal de separacion de hecho",
    "despido arbitrario sin preaviso",
    "prescripcion de acciones tributarias",
    "amparo por violacion de debido proceso",
    "regimen de visitas para menores",
    "pension de alimentos porcentaje",
    "contrato de arrendamiento comercial",
    "sociedad anonima cerrada requisitos",
    "delito de estafa tipo penal",
    "recurso de casacion procedencia"
  ]
};

// =====================================================
// VALIDACION DE ENTORNO
// =====================================================

function validateEnv() {
  const errors = [];
  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL no definida (requerida por retrieve.mjs)");
  }
  if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    errors.push("Ni OPENAI_API_KEY ni GEMINI_API_KEY definidas (requeridas para embeddings)");
  }
  if (errors.length) {
    console.error("\u274c Entorno invalido:");
    for (const e of errors) console.error("   - " + e);
    console.error("\nSugerencia: copia .env.example a .env y exporta las variables.");
    process.exit(1);
  }
}
