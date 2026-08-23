#!/usr/bin/env node
/**
 * Indexer dedicado: catalogs/interpretaciones-favorables.json → rag_vectors_v2
 *
 * Indexa las interpretaciones legales PRO-CLIENTE (34 entradas: laboral,
 * tributario, consumidor, penal, procesal-civil, constitucional) para que el
 * chatbot RAG pueda citarlas con grounding real.
 *
 * DIFERENCIAS con index-todos.mjs:
 *   - index-todos.mjs no tenía este catálogo en su lista de fuentes y su
 *     buildCompositeText perdería principio/base_legal/estrategia/ejemplo/
 *     límites (solo usaría `descripcion`), generando tipo 'norma' en vez de
 *     'interpretacion' e ids no estables.
 *   - Este script construye texto LEGIBLE y RICO por interpretación, con:
 *       id único        → `interp-fav-${id}`  (ej. interp-fav-LAB-01)
 *       source          → 'interpretaciones-favorables.json'
 *       content         → principio + descripcion + base_legal + articulo
 *                         + como_aplicarlo (estrategia) + ejemplo_practico
 *                         + limites + tags
 *       metadata        → { tipo: 'interpretacion', materia, base_legal,
 *                           id_original, codigo, vigente, relevancia,
 *                           palabras_clave, necesita_revision_humana }
 *   - UPSERT idempotente: ON CONFLICT (id) DO UPDATE → NUNCA borra chunks
 *     existentes (los 308 actuales quedan intactos).
 *
 * EMBEDDINGS (compatibles vector(1536)):
 *   - Default `--hash`: hash semántico-ligero de retrieve.mjs (tokenización
 *     español + bigramas + trigramas + IDF, 1536 dims, [0,1]) — el MISMO
 *     algoritmo del retrieval en modo degradado → consistencia query↔chunk.
 *   - `--minimax`: MiniMax embo-01 con retry, fallback a hash ante rate limit.
 *   - `--auto`: MiniMax si MINIMAX_API_KEY está, si no hash.
 *
 * Uso:
 *   node tools/rag/index-interpretaciones.mjs --hash        # recomendado (determinístico)
 *   node tools/rag/index-interpretaciones.mjs --minimax     # embeddings reales
 *   node tools/rag/index-interpretaciones.mjs --dry-run     # solo chunking
 *
 * Requiere DATABASE_URL (PostgreSQL con pgvector).
 *
 * @version 1.0.0
 * @date    2026-08-12
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { hashEmbedding } from './retrieve.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATABASE_URL = process.env.DATABASE_URL;
const CATALOG_PATH = path.join(__dirname, '..', '..', 'catalogs', 'interpretaciones-favorables.json');

const CONFIG = {
  table: 'rag_vectors_v2',
  source: 'interpretaciones-favorables.json',
  embeddingDimensions: 1536,
  embeddingModel: process.env.MINIMAX_EMBEDDING_MODEL || 'embo-01',
  embeddingType: process.env.MINIMAX_EMBEDDING_TYPE || 'document',
  embeddingEndpoint: process.env.MINIMAX_EMBEDDING_URL || 'https://api.minimax.io/v1/embeddings',
  rateLimitMs: Number(process.env.MINIMAX_RATE_LIMIT_MS || 1200),
  maxRetries: Number(process.env.MINIMAX_MAX_RETRIES || 3),
  retryBackoffMs: Number(process.env.MINIMAX_RETRY_BACKOFF_MS || 1500),
  maxTokensChars: 8000
};

// ==========================================
// ARGS CLI
// ==========================================

function parseArgs(argv) {
  const args = { mode: 'hash', dryRun: false };
  for (const arg of argv) {
    if (arg === '--hash') args.mode = 'hash';
    if (arg === '--minimax') args.mode = 'minimax';
    if (arg === '--auto') args.mode = 'auto';
    if (arg === '--dry-run') args.dryRun = true;
  }
  return args;
}

const ARGS = parseArgs(process.argv.slice(2));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==========================================
// CONSTRUCCIÓN DEL CONTENIDO LEGIBLE
// ==========================================

/**
 * Texto legible y rico de cada interpretación, diseñado para que el retrieval
 * híbrido (semántica + full-text 'spanish') lo encuentre tanto por términos
 * técnicos (in dubio pro reo, carga de la prueba, nulidad de despido) como
 * por contexto forense (estrategia, ejemplo, límites).
 */
function buildContent(doc) {
  const parts = [];

  parts.push(`Interpretación favorable al cliente (materia: ${doc.materia || 'general'}) — id ${doc.id}`);

  if (doc.principio) parts.push(`Principio: ${doc.principio}`);
  if (doc.descripcion) parts.push(`Interpretación favorable: ${doc.descripcion}`);
  if (doc.base_legal) parts.push(`Base legal: ${doc.base_legal}`);
  if (doc.articulo) parts.push(`Artículo: ${doc.articulo}`);

  if (Array.isArray(doc.como_aplicarlo) && doc.como_aplicarlo.length > 0) {
    parts.push('Estrategia de aplicación en la práctica forense:');
    doc.como_aplicarlo.forEach((step, i) => parts.push(`  ${i + 1}. ${step}`));
  }

  if (doc.ejemplo_practico) parts.push(`Ejemplo práctico: ${doc.ejemplo_practico}`);
  if (doc.limites) parts.push(`Límites (cuándo NO aplica): ${doc.limites}`);

  if (Array.isArray(doc.tags) && doc.tags.length > 0) {
    parts.push(`Palabras clave: ${doc.tags.join(', ')}`);
  }

  return parts.filter(Boolean).join('\n\n');
}

// ==========================================
// METADATA RICA POR INTERPRETACIÓN
// ==========================================

function buildMetadata(doc) {
  return {
    source: CONFIG.source,
    fuente: CONFIG.source.replace(/\.json$/, ''),
    tipo: 'interpretacion',
    materia: String(doc.materia || 'general').toLowerCase().replace(/\s+/g, '_'),
    codigo: doc.id,
    id_original: doc.id,
    base_legal: doc.base_legal || null,
    articulo: doc.articulo ? String(doc.articulo).substring(0, 500) : null,
    vigente: true,
    relevancia: 'ALTA',
    palabras_clave: Array.isArray(doc.tags) ? doc.tags : [],
    necesita_revision_humana: doc.necesita_revision_humana === true
  };
}

function buildChunk(doc) {
  const content = buildContent(doc);
  return {
    id: `interp-fav-${doc.id}`,
    content,
    metadata: buildMetadata(doc)
  };
}

// Exportado para que index-todos.mjs reutilice el MISMO formato de chunk
// (ids estables `interp-fav-*`, tipo 'interpretacion') sin duplicados.
export { buildChunk, buildContent, buildMetadata };

// ==========================================
// EMBEDDINGS: MiniMax embo-01 (retry) → fallback hash (retrieve.mjs)
// ==========================================

class RateLimitError extends Error {
  constructor(message, retryAfterMs) {
    super(message);
    this.retryAfterMs = retryAfterMs;
  }
}

async function getEmbedding(text, attempt = 0) {
  const truncated = String(text || '').substring(0, CONFIG.maxTokensChars);

  const usarMinimax = ARGS.mode === 'minimax'
    || (ARGS.mode === 'auto' && process.env.MINIMAX_API_KEY);

  if (!usarMinimax) {
    return hashEmbedding(truncated, CONFIG.embeddingDimensions);
  }

  try {
    const res = await fetch(CONFIG.embeddingEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`
      },
      body: JSON.stringify({
        model: CONFIG.embeddingModel,
        texts: [truncated],
        type: CONFIG.embeddingType
      })
    });

    if (res.status === 429) {
      const retryAfter = Number.parseInt(res.headers.get('retry-after') || '0', 10) || CONFIG.retryBackoffMs;
      throw new RateLimitError(`HTTP 429 rate limit (retry-after: ${retryAfter}ms)`, retryAfter);
    }
    if (res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504) {
      throw new RateLimitError(`HTTP ${res.status} transitorio`, CONFIG.retryBackoffMs);
    }
    if (!res.ok) {
      throw new Error(`MiniMax HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();

    if (data.vectors && Array.isArray(data.vectors) && data.vectors[0]) {
      const vector = data.vectors[0];
      if (vector.length !== CONFIG.embeddingDimensions) {
        throw new Error(`Dimensiones inesperadas: ${vector.length} (esperado ${CONFIG.embeddingDimensions})`);
      }
      return vector;
    }

    if (data.base_resp && data.base_resp.status_code && Number(data.base_resp.status_code) !== 0) {
      const code = data.base_resp.status_code;
      if (code === 1004 || code === 1005 || code === 1032 || code === 1002) {
        throw new RateLimitError(`MiniMax base_resp ${code}: ${data.base_resp.status_msg || 'rate limit'}`, CONFIG.retryBackoffMs * 2);
      }
      throw new Error(`MiniMax base_resp ${code}: ${data.base_resp.status_msg || 'error'}`);
    }

    throw new Error('Embedding fallo: respuesta sin vectors');
  } catch (err) {
    if (attempt < CONFIG.maxRetries && err instanceof RateLimitError) {
      const delay = Math.max(err.retryAfterMs || CONFIG.retryBackoffMs, CONFIG.retryBackoffMs) * (attempt + 1);
      console.warn(`   ⚠️  Embedding retry ${attempt + 1}/${CONFIG.maxRetries} tras ${delay}ms (${err.message})`);
      await sleep(delay);
      return getEmbedding(text, attempt + 1);
    }
    if (err instanceof RateLimitError || err.message !== 'Embedding fallo: respuesta sin vectors') {
      console.warn(`   ⚠️  MiniMax no disponible (${err.message}) → fallback hash para este chunk`);
    }
    return hashEmbedding(truncated, CONFIG.embeddingDimensions);
  }
}

// ==========================================
// STORAGE (PostgreSQL con pgvector, tabla v2)
// ==========================================

async function ensureSchema(client) {
  await client.query(`
    CREATE EXTENSION IF NOT EXISTS vector;

    CREATE TABLE IF NOT EXISTS ${CONFIG.table} (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding vector(${CONFIG.embeddingDimensions}),
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_${CONFIG.table}_source
      ON ${CONFIG.table}(source);
    CREATE INDEX IF NOT EXISTS idx_${CONFIG.table}_materia
      ON ${CONFIG.table} ((metadata->>'materia'));
    CREATE INDEX IF NOT EXISTS idx_${CONFIG.table}_codigo
      ON ${CONFIG.table} ((metadata->>'codigo'));
    CREATE INDEX IF NOT EXISTS idx_${CONFIG.table}_articulo
      ON ${CONFIG.table} ((metadata->>'articulo'));
    CREATE INDEX IF NOT EXISTS idx_${CONFIG.table}_tipo
      ON ${CONFIG.table} ((metadata->>'tipo'));
    CREATE INDEX IF NOT EXISTS idx_${CONFIG.table}_vigente
      ON ${CONFIG.table} ((metadata->>'vigente'));
    CREATE INDEX IF NOT EXISTS idx_${CONFIG.table}_relevancia
      ON ${CONFIG.table} ((metadata->>'relevancia'));
    CREATE INDEX IF NOT EXISTS idx_${CONFIG.table}_metadata_gin
      ON ${CONFIG.table} USING GIN (metadata jsonb_path_ops);
    CREATE INDEX IF NOT EXISTS idx_${CONFIG.table}_embedding
      ON ${CONFIG.table} USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);

    ALTER TABLE ${CONFIG.table} ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS rag_vectors_v2_select_public ON ${CONFIG.table};
    CREATE POLICY rag_vectors_v2_select_public
      ON ${CONFIG.table} FOR SELECT
      USING (true);
  `);
  console.log(`✅ Schema RAG v2 verificado/creado (tabla: ${CONFIG.table}, vector(${CONFIG.embeddingDimensions}))`);
}

/**
 * UPSERT idempotente: inserta o actualiza SIN borrar (ON CONFLICT (id)
 * DO UPDATE). Devuelve 'inserted' | 'updated' (truco xmax: PostgreSQL marca
 * xmax=0 en filas insertadas por esta transacción).
 */
async function upsertChunk(client, chunk, embedding) {
  const vectorStr = `[${embedding.join(',')}]`;
  const { rows } = await client.query(
    `
    INSERT INTO ${CONFIG.table} (id, source, content, embedding, metadata, updated_at)
    VALUES ($1, $2, $3, $4::vector, $5::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET
      source = EXCLUDED.source,
      content = EXCLUDED.content,
      embedding = EXCLUDED.embedding,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING id, (xmax = 0) AS inserted
  `,
    [chunk.id, chunk.metadata.source, chunk.content, vectorStr, JSON.stringify(chunk.metadata)]
  );
  return rows[0] && rows[0].inserted ? 'inserted' : 'updated';
}

// ==========================================
// MAIN
// ==========================================

async function main() {
  console.log('🚀 Indexer interpretaciones-favorables → rag_vectors_v2');
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log(`Modo embeddings: ${ARGS.mode} (${ARGS.mode === 'hash' ? 'hash semántico-ligero de retrieve.mjs (1536 dims)' : ARGS.mode === 'minimax' ? 'MiniMax embo-01 + fallback hash' : 'auto: MiniMax si hay key, si no hash'})`);
  console.log(`Modo: ${ARGS.dryRun ? 'DRY-RUN (sin BD/API)' : 'indexación real (UPSERT ON CONFLICT, sin delete)'}`);
  console.log('');

  // ── Validar catálogo ────────────────────────────────────────────────────
  if (!fs.existsSync(CATALOG_PATH)) {
    console.error(`❌ No encontrado: ${CATALOG_PATH}`);
    process.exit(1);
  }

  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  } catch (err) {
    console.error(`❌ Error parseando catálogo: ${err.message}`);
    process.exit(1);
  }

  const docs = Array.isArray(catalog.interpretaciones) ? catalog.interpretaciones : [];
  console.log(`📄 Catálogo: ${CATALOG_PATH}`);
  console.log(`   Interpretaciones en el archivo: ${docs.length}`);
  console.log(`   Estadísticas declaradas: total=${catalog.estadisticas?.total_interpretaciones}, materias=${catalog.estadisticas?.materias}`);
  console.log('');

  if (docs.length === 0) {
    console.error('❌ El catálogo no contiene la key `interpretaciones` (array).');
    process.exit(1);
  }

  const chunks = docs.map(buildChunk);

  // ── DRY-RUN ─────────────────────────────────────────────────────────────
  if (ARGS.dryRun) {
    console.log('🔬 DRY-RUN: chunking validado sin escribir en BD ni llamar a API.\n');
    for (const c of chunks) {
      console.log(`   • ${c.id} (${c.metadata.materia}) — ${c.content.length} chars`);
    }
    console.log(`\n✅ DRY-RUN: ${chunks.length} chunks listos. Nada escrito en BD.`);
    process.exit(0);
  }

  // ── Validar configuración ───────────────────────────────────────────────
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL no configurada');
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('✅ Conectado a PostgreSQL');

  await ensureSchema(client);

  // Baseline total (para reportar "no bajó de 308")
  const antes = await client.query(`SELECT COUNT(*) AS n FROM ${CONFIG.table}`);
  console.log(`📊 Total rag_vectors_v2 ANTES: ${antes.rows[0].n}`);

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  let embeddingCalls = 0;

  for (const chunk of chunks) {
    try {
      const embedding = await getEmbedding(chunk.content);
      embeddingCalls++;
      const result = await upsertChunk(client, chunk, embedding);
      if (result === 'inserted') {
        totalInserted++;
        console.log(`   ✅ INSERTED ${chunk.id} (${chunk.metadata.materia})`);
      } else {
        totalUpdated++;
        console.log(`   🔄 UPDATED  ${chunk.id} (${chunk.metadata.materia})`);
      }
      if (ARGS.mode === 'minimax' || (ARGS.mode === 'auto' && process.env.MINIMAX_API_KEY)) {
        await sleep(CONFIG.rateLimitMs);
      }
    } catch (err) {
      console.error(`\n❌ Error indexando ${chunk.id}: ${err.message}`);
      totalErrors++;
    }
  }

  // Verificación post-index
  const despues = await client.query(`SELECT COUNT(*) AS n FROM ${CONFIG.table}`);
  const porSource = await client.query(
    `SELECT COUNT(*) AS n FROM ${CONFIG.table} WHERE metadata->>'source' = $1`,
    [CONFIG.source]
  );
  const totalAntes = Number(antes.rows[0].n);
  const totalDespues = Number(despues.rows[0].n);

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN INDEXER INTERPRETACIONES:');
  console.log(`   Chunks AÑADIDOS (nuevos): ${totalInserted}`);
  console.log(`   Chunks ACTUALIZADOS: ${totalUpdated}`);
  console.log(`   Errores: ${totalErrors}`);
  console.log(`   Embeddings generados: ${embeddingCalls} (modo ${ARGS.mode})`);
  console.log(`   Total rag_vectors_v2 ANTES:  ${totalAntes}`);
  console.log(`   Total rag_vectors_v2 DESPUÉS: ${totalDespues}`);
  console.log(`   Delta total: ${totalDespues - totalAntes} (debe ser ≥ 0, nunca negativo — no se borra nada)`);
  console.log(`   Chunks source='${CONFIG.source}': ${porSource.rows[0].n} (esperado ~${docs.length})`);
  console.log('');

  const ok = totalErrors === 0 && Number(porSource.rows[0].n) === docs.length;
  if (ok) {
    console.log('✅ INDEXACIÓN COMPLETADA EXITOSAMENTE');
    process.exit(0);
  } else {
    console.log('⚠️  REVISAR: hubo errores o el conteo de source no cuadra con el catálogo.');
    process.exit(1);
  }
}

// Guard de ejecución directa: al importar las funciones desde index-todos.mjs
// NO se ejecuta main() (solo se exponen buildChunk/buildContent/buildMetadata).
const esEjecucionDirecta = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (esEjecucionDirecta) {
  main().catch((err) => {
    console.error('💥 Error fatal:', err);
    process.exit(1);
  });
}