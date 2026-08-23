#!/usr/bin/env node
/**
 * Populate Lento - Puebla rag_vectors_v2 con embeddings MiniMax
 * Respetando el rate limit bajo de MiniMax (plan RPM pequeño).
 *
 * Pipeline SIMPLE y robusto (alternativa al indexer-v2.mjs, que es complejo):
 *   - Procesa los catálogos de UNO por vez, doc por doc
 *   - 7s de espera entre cada embedding (configurable via --delay o MINIMAX_DELAY_MS)
 *   - Retry con backoff creciente ante rate limit (429 / base_resp.status_code != 0)
 *   - `type: 'document'` al indexar (mejor para documentos largos)
 *   - Tabla `rag_vectors_v2` con vector(1536), upsert idempotente (ON CONFLICT)
 *   - Puede ejecutarse en background: no requiere interacción, --log para logs
 *   - --resume: salta ids ya presentes en la tabla (reanuda tras un corte)
 *
 * Uso:
 *   node tools/rag/populate-lento.mjs                     # todo
 *   node tools/rag/populate-lento.mjs --only=codigos-leyes
 *   node tools/rag/populate-lento.mjs --limit=10
 *   node tools/rag/populate-lento.mjs --resume            # continuar desde el último
 *   node tools/rag/populate-lento.mjs --delay=8000 --log=rag-populate.log
 *
 * Variables de entorno (override):
 *   DATABASE_URL        # conexión PostgreSQL (default: railway)
 *   MINIMAX_API_KEY     # leída de datos.txt si no se define aquí
 *   MINIMAX_DELAY_MS    # espera entre embeddings (default 7000)
 *
 * @version 1.0.0
 * @date    2026-08-07
 */

import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no definida. Exporta DATABASE_URL (valor real en Railway) o defínela en .env antes de ejecutar.');
  process.exit(1);
}
const MINIMAX_KEY = process.env.MINIMAX_API_KEY ||
  ((fs.readFileSync(path.join(process.cwd(), 'datos.txt'), 'utf8').match(/MINIMAX_API_KEY="([^"]+)"/) || [])[1]);
const CATALOGS_DIR = path.join(process.cwd(), 'catalogs');

// Rate limit: espera larga entre llamadas (MiniMax RPM bajo)
const DELAY_MS = Number(process.env.MINIMAX_DELAY_MS || 7000); // 7 segundos entre embeddings
const MAX_RETRIES = 5;

// ------------------------------------------------------------------
// Logging: console + archivo opcional (útil para background)
// ------------------------------------------------------------------
let logStream = null;
function log(...args) {
  const line = args.map(String).join(' ');
  console.log(line);
  if (logStream) logStream.write(line + '\n');
}

// ------------------------------------------------------------------
// Embedding MiniMax embo-01 (1536 dims) con retry + backoff
// ------------------------------------------------------------------
async function getEmbedding(text) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch('https://api.minimax.io/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MINIMAX_KEY}` },
        body: JSON.stringify({ model: 'embo-01', texts: [text.substring(0, 8000)], type: 'document' })
      });

      // 429 = rate limit explícito; 401 = key inválida (no reintentar mucho)
      if (res.status === 429) {
        const wait = DELAY_MS * (attempt + 2);
        log(`  [rate limit HTTP 429] esperando ${Math.round(wait / 1000)}s (intento ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(wait);
        continue;
      }
      if (res.status === 401) {
        throw new Error('MINIMAX_API_KEY inválida (HTTP 401)');
      }

      const data = await res.json();

      // MiniMax devuelve errores en base_resp.status_code (0 = ok)
      const code = data.base_resp && data.base_resp.status_code;
      if (code && code !== 0) {
        const msg = (data.base_resp.status_msg || 'error MiniMax').substring(0, 80);
        // 1002 / 1004 / 1049 / 1063 suelen ser rate limit o cuota
        // (verificado en producción: MiniMax devuelve 1002 "rate limit exceeded (RPM)")
        if (code === 1002 || code === 1004 || code === 1049 || code === 1063 || code === 1064) {
          const wait = DELAY_MS * (attempt + 2);
          log(`  [rate limit code ${code}] esperando ${Math.round(wait / 1000)}s (intento ${attempt + 1}/${MAX_RETRIES})`);
          await sleep(wait);
          continue;
        }
        throw new Error(`MiniMax error ${code}: ${msg}`);
      }

      if (data.vectors && data.vectors[0]) return data.vectors[0];

      // Sin vectors pero sin error claro: asumimos rate limit blando
      const wait = DELAY_MS * (attempt + 1);
      log(`  [sin vectors] esperando ${Math.round(wait / 1000)}s (intento ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(wait);
    } catch (e) {
      if (e.message.includes('401') || e.message.includes('error')) throw e; // error definitivo
      log(`  [fetch error] ${e.message.substring(0, 60)} - reintentando en ${Math.round(DELAY_MS / 1000)}s`);
      await sleep(DELAY_MS);
    }
  }
  throw new Error('Embedding fallo definitivo');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ------------------------------------------------------------------
// Tabla + índices
// ------------------------------------------------------------------
async function ensureTable(client) {
  await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS rag_vectors_v2 (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding vector(1536),
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_v2_source ON rag_vectors_v2(source)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_v2_materia ON rag_vectors_v2((metadata->>'materia'))`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_v2_embedding ON rag_vectors_v2 USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50)`);
}

// ------------------------------------------------------------------
// Extracción de docs según la estructura de cada catálogo
// ------------------------------------------------------------------
function extractDocs(data) {
  const candidates = [
    'normas', 'jurisprudencia', 'sentencias', 'casaciones',
    'resoluciones', 'normativa_relevante_destacada', 'informes_destacados_2026'
  ];
  for (const k of candidates) {
    if (Array.isArray(data[k]) && data[k].length) return data[k];
  }
  // Fallback genérico: primer array con objetos que parecen docs legales
  for (const k of Object.keys(data)) {
    if (Array.isArray(data[k]) && data[k].length && typeof data[k][0] === 'object') return data[k];
  }
  return [];
}

// ------------------------------------------------------------------
// Builder de contenido: junta los campos útiles de cada doc
// ------------------------------------------------------------------
function buildContent(doc) {
  const parts = [];
  for (const k of ['nombre', 'titulo', 'caso', 'asunto', 'sumilla', 'decision', 'fundamento_principal', 'numero', 'expediente', 'delito', 'materia']) {
    const v = doc[k];
    if (typeof v === 'string' && v.trim()) parts.push(v.trim());
    else if (Array.isArray(v) && v.length) parts.push(v.join(', '));
  }
  const kw = doc.palabras_clave;
  if (Array.isArray(kw) && kw.length) parts.push('Palabras clave: ' + kw.join(', '));
  if (Array.isArray(doc.articulos_mas_citados) && doc.articulos_mas_citados.length) parts.push('Artículos más citados: ' + doc.articulos_mas_citados.join(', '));
  return parts.join(' | ');
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const only = args.find(a => a.startsWith('--only='))?.split('=')[1];
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '99999');
  const resume = args.includes('--resume');
  const delayArg = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1] || '');
  const delay = Number.isFinite(delayArg) && delayArg > 0 ? delayArg : DELAY_MS;
  const logFile = args.find(a => a.startsWith('--log='))?.split('=')[1];

  if (logFile) {
    logStream = fs.createWriteStream(path.join(process.cwd(), logFile), { flags: 'a' });
  }

  if (!MINIMAX_KEY) {
    console.error('ERROR: no se encontró MINIMAX_API_KEY en datos.txt ni en entorno.');
    process.exit(1);
  }

  log('=== POPULATE LENTO RAG V2 ===');
  log(`key: ...${MINIMAX_KEY.slice(-6)} | delay: ${delay}ms | limit: ${limit}${resume ? ' | resume: ON' : ''}`);
  log(`args: ${args.join(' ') || '(todos)'}`);

  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await ensureTable(client);
  log('Conectado + tabla lista');

  // --resume: ids ya indexados para saltarlos
  const done = new Set();
  if (resume) {
    const r = await client.query('SELECT id FROM rag_vectors_v2');
    for (const row of r.rows) done.add(row.id);
    log(`resume: ${done.size} ids ya existentes serán omitidos`);
  }

  const catalogFiles = [
    'codigos-leyes.json', 'normas-especializadas-2026.json',
    'jurisprudencia-tc-2026.json', 'sentencias-tc-completas-2026.json',
    'casaciones-pj-2026.json', 'resoluciones-indecopi-2026.json',
    'normas-minjusdh-2026.json', 'resoluciones-anpd-2026.json'
  ].filter(f => !only || f.includes(only));

  let total = 0;
  let skipped = 0;
  const t0 = Date.now();

  for (const file of catalogFiles) {
    const fp = path.join(CATALOGS_DIR, file);
    if (!fs.existsSync(fp)) { log('  WARN no existe: ' + file); continue; }
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const docs = extractDocs(data);
    log('\nProcesando ' + file + ' (' + docs.length + ' docs)');

    for (const doc of docs) {
      if (total >= limit) break;
      const content = buildContent(doc);
      if (!content.trim()) { log('  - (vacío) ' + (doc.id || file)); continue; }
      const id = file.replace('.json', '') + '-' + (doc.id || total);
      if (done.has(id)) { skipped++; continue; }

      try {
        const vec = await getEmbedding(content);
        await client.query(
          `INSERT INTO rag_vectors_v2 (id, source, content, embedding, metadata, updated_at)
           VALUES ($1,$2,$3,$4::vector,$5::jsonb,NOW())
           ON CONFLICT (id) DO UPDATE SET embedding=EXCLUDED.embedding, content=EXCLUDED.content, metadata=EXCLUDED.metadata, updated_at=NOW()`,
          [id, file.replace('.json', ''), content, '[' + vec.join(',') + ']',
           JSON.stringify({
             materia: doc.materia || 'general',
             tipo: doc.tipo || 'norma',
             numero: doc.numero || '',
             expediente: doc.expediente || '',
             url: doc.url_fuente || doc.url || doc.url_spij || ''
           })]
        );
        total++;
        const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
        log(`  ✓ ${total}. ${id} (${elapsed}s)`);
        await sleep(delay); // rate limit
      } catch (err) {
        log(`  ✗ ${id}: ${err.message.substring(0, 80)}`);
        await sleep(delay * 2);
      }
    }
    if (total >= limit) break;
  }

  const final = await client.query('SELECT COUNT(*) FROM rag_vectors_v2');
  const elapsedMin = ((Date.now() - t0) / 60000).toFixed(1);
  log('\n✅ Insertados: ' + total + ' | Omitidos (resume): ' + skipped);
  log('📦 Total en rag_vectors_v2: ' + final.rows[0].count);
  log('⏱️  Tiempo transcurrido: ' + elapsedMin + ' min' + ` (aprox. ${Math.round(delay / 1000)}s por embedding)`);
  await client.end();
  if (logStream) logStream.end();
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
