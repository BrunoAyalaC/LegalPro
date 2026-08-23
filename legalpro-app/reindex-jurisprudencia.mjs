#!/usr/bin/env node
/**
 * reindex-jurisprudencia.mjs — REINDEX TEMPORAL DE JURISPRUDENCIA (2026-08-07)
 *
 * Repara el RAG de jurisprudencia en PRODUCCIÓN:
 *   - Los catálogos casaciones-pj-2026.json, jurisprudencia-tc-2026.json,
 *     sentencias-tc-completas-2026.json y resoluciones-indecopi-2026.json
 *     NO estaban indexados en rag_vectors_v2 con metadata correcta
 *     (tipo='jurisprudencia'), por lo que GET /api/ai/jurisprudencia
 *     (filter tipo='jurisprudencia') devolvía 0 resultados.
 *   - Este script indexa los 4 catálogos con la MISMA lógica de
 *     tools/rag/indexer-v2.mjs (chunking por sección vía chunker-advanced)
 *     y metadata rica: tipo='jurisprudencia' (FORZADO), fuente, numero,
 *     expediente, fecha, relevancia, url, sala/tribunal, materia, vigente.
 *
 * EMBEDDINGS:
 *   - Intenta MiniMax embo-01 (1536 dims) con la key de datos.txt.
 *   - Si MiniMax falla (rate limit 1002, verificado en prod el 2026-08-07),
 *     inserta placeholder hash determinístico (mismo esquema que populate-hash.mjs)
 *     con `placeholder: true` en metadata, para que el pipeline RAG funcione
 *     (full-text + metadata filter) y luego se re-embedding con embeddings reales.
 *
 * NO BORRA datos existentes: usa ON CONFLICT (id) DO UPDATE y NO toca las filas
 * previas (ids diferentes). NO elimina los 176 docs actuales de rag_vectors_v2.
 *
 * Uso:
 *   node reindex-jurisprudencia.mjs            # indexa los 4 catálogos
 *   node reindex-jurisprudencia.mjs --only=casaciones
 *   node reindex-jurisprudencia.mjs --dry-run  # solo chunking, sin BD/API
 *
 * @version 1.0.0
 * @date    2026-08-07
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { chunkHibrido } from '../tools/rag/chunker-advanced.mjs';

const DATABASE_URL = process.env.PROBE_DATABASE_URL;
const CATALOGS_DIR = path.join(process.cwd(), '..', 'catalogs');

// Key MiniMax real leída de datos.txt (misma convención que populate-lento.mjs)
const datosRaw = fs.readFileSync(path.join(process.cwd(), '..', 'datos.txt'), 'utf8');
const MINIMAX_KEY = process.env.MINIMAX_API_KEY || (datosRaw.match(/MINIMAX_API_KEY="([^"]+)"/) || [])[1];

const ARGS = process.argv.slice(2);
const only = ARGS.find((a) => a.startsWith('--only='))?.split('=')[1] || null;
const dryRun = ARGS.includes('--dry-run');

const EMBED_MODEL = 'embo-01';
const EMBED_DIMS = 1536;
const EMBED_URL = 'https://api.minimax.io/v1/embeddings';

// Catálogos de jurisprudencia → (archivo, arrayKey, fuente canónica, tribunal por defecto)
const JURIS_CATALOGS = [
  { file: 'casaciones-pj-2026.json', key: 'casaciones', fuente: 'casaciones-pj-2026', tribunal: 'Corte Suprema de la República' },
  { file: 'jurisprudencia-tc-2026.json', key: 'jurisprudencia', fuente: 'jurisprudencia-tc-2026', tribunal: 'Tribunal Constitucional' },
  { file: 'sentencias-tc-completas-2026.json', key: 'sentencias', fuente: 'sentencias-tc-completas-2026', tribunal: 'Tribunal Constitucional' },
  { file: 'resoluciones-indecopi-2026.json', key: 'resoluciones', fuente: 'resoluciones-indecopi-2026', tribunal: 'INDECOPI' },
].filter((c) => !only || c.file.includes(only) || c.fuente.includes(only));

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function slugify(text) {
  return String(text || 'unknown')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60) || 'unknown';
}

function normalizeRelevancia(value) {
  const v = String(value || 'MEDIA').toUpperCase();
  return v.includes('ALTA') ? 'ALTA' : v.includes('BAJA') ? 'BAJA' : 'MEDIA';
}

// Hash determinístico → vector 1536 (mismo esquema que populate-hash.mjs)
function hashToVector(text, dims = EMBED_DIMS) {
  const hash = crypto.createHash('sha256').update(String(text || '')).digest();
  const vec = [];
  for (let i = 0; i < dims; i++) {
    const b1 = hash[i % hash.length];
    const b2 = hash[(i * 7) % hash.length];
    vec.push(((b1 + b2 + i) % 256) / 255);
  }
  return vec;
}

// ---------------------------------------------------------------------------
// Embedding MiniMax con retry corto; fallback placeholder si falla
// ---------------------------------------------------------------------------
async function getEmbedding(text) {
  if (!MINIMAX_KEY) return { vec: hashToVector(text), placeholder: true, reason: 'sin-key' };
  const truncated = String(text || '').substring(0, 8000);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(EMBED_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MINIMAX_KEY}` },
        body: JSON.stringify({ model: EMBED_MODEL, texts: [truncated], type: 'document' }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      const code = data.base_resp && data.base_resp.status_code;
      if (res.ok && data.vectors && Array.isArray(data.vectors) && data.vectors[0] && code === 0) {
        const vec = data.vectors[0];
        if (vec.length === EMBED_DIMS) return { vec, placeholder: false, reason: 'minimax-real' };
      }
      const msg = code ? `MiniMax code ${code}: ${data.base_resp.status_msg}` : `HTTP ${res.status}`;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1200));
      else return { vec: hashToVector(text), placeholder: true, reason: msg };
    } catch (err) {
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1200));
      else return { vec: hashToVector(text), placeholder: true, reason: err.message };
    }
  }
  return { vec: hashToVector(text), placeholder: true, reason: 'max-retries' };
}

// ---------------------------------------------------------------------------
// Builders de contenido y metadata (misma filosofía que indexer-v2.mjs)
// ---------------------------------------------------------------------------
function buildHeader(doc, cat, numero, url) {
  const parts = [];
  if (numero) parts.push(`Número: ${numero}`);
  if (cat.tribunal) parts.push(`Tribunal: ${cat.tribunal}`);
  if (doc.sala || doc.colegiado) parts.push(`Sala: ${doc.sala || doc.colegiado}`);
  if (doc.sumilla) parts.push(`Sumilla: ${doc.sumilla}`);
  if (doc.materia) parts.push(`Materia: ${doc.materia}`);
  if (url) parts.push(`Fuente: ${url}`);
  return parts.join('\n\n');
}

function buildBody(doc) {
  const parts = [];
  for (const [label, key] of [
    ['Caso', 'caso'],
    ['Asunto', 'asunto'],
    ['Decisión', 'decision'],
    ['Delito', 'delito'],
    ['Derechos invocados', 'derechos_invocados'],
    ['Agravio alegado', 'agravio_alegado'],
    ['Fundamento principal', 'fundamento_principal'],
    ['Precedente vinculante', 'precedente_vinculante'],
    ['Sentencia TC', 'sentencia_tc'],
    ['Descripción', 'descripcion'],
  ]) {
    const v = doc[key];
    if (typeof v === 'string' && v.trim()) parts.push(`${label}: ${v.trim()}`);
    else if (Array.isArray(v) && v.length) parts.push(`${label}: ${v.join(', ')}`);
  }
  if (Array.isArray(doc.palabras_clave) && doc.palabras_clave.length) {
    parts.push(`Palabras clave: ${doc.palabras_clave.join(', ')}`);
  }
  return parts;
}

function buildMetadata(doc, cat, numero, url, fecha, placeholder) {
  return {
    source: cat.file,                     // con .json → mapea TRIBUNAL_POR_FUENTE del endpoint
    fuente: cat.fuente,                   // sin .json (fuente canónica)
    tipo: 'jurisprudencia',               // FORZADO: filter del endpoint /api/ai/jurisprudencia
    materia: String(doc.materia || 'general').toLowerCase().replace(/\s+/g, '_'),
    numero: numero || null,
    expediente: doc.expediente || null,
    fecha: fecha || null,
    relevancia: normalizeRelevancia(doc.relevancia_legalpro || doc.relevancia),
    vigente: true,
    url: url || null,
    nombre: doc.titulo || doc.nombre || doc.caso || doc.acto || numero || null,
    sala: doc.sala || doc.colegiado || cat.tribunal || null,
    tribunal: cat.tribunal || null,
    palabras_clave: Array.isArray(doc.palabras_clave) ? doc.palabras_clave : [],
    placeholder: Boolean(placeholder),
  };
}

// ---------------------------------------------------------------------------
// Chunking por documento (secciones + header repetido en cada chunk)
// ---------------------------------------------------------------------------
function buildChunks(doc, cat) {
  const numero = doc.numero || doc.expediente || null;
  const url = doc.url || doc.url_fuente || doc.url_spij || doc.pdf_url || null;
  const fecha = doc.fecha_publicacion || doc.fecha_sentencia || null;
  const header = buildHeader(doc, cat, numero, url);
  const body = buildBody(doc);
  const fullText = header + (body.length ? '\n\n' + body.join('\n\n') : '');

  if (!fullText.trim()) return [];

  // Chunking por sección (misma estrategia que indexer-v2 para jurisprudencia)
  const rawChunks = chunkHibrido(fullText, { tipo: 'jurisprudencia', id: `${cat.fuente}-${doc.id || numero || 'doc'}`, titulo: `${cat.fuente}-${doc.id || numero || 'doc'}` });

  // Si el chunker no produjo nada (todo muy corto), forzar un chunk del fullText
  const chunks = rawChunks.length > 0 ? rawChunks : [{ id: 'full', content: fullText.substring(0, 8000), metadata: {} }];

  const docSlug = slugify(`${cat.fuente}-${doc.id || numero || 'doc'}`);
  return chunks.map((c, i) => {
    // Prefijar header a CADA chunk para que full-text/keywords matcheen siempre
    const content = c.content && c.content !== fullText
      ? header + '\n\n' + c.content
      : c.content;
    return {
      id: `juris-${docSlug}-sec-${i}`,
      content,
      baseMeta: buildMetadata(doc, cat, numero, url, fecha, false),
    };
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('🚀 REINDEX JURISPRUDENCIA → rag_vectors_v2 (metadata tipo=jurisprudencia)');
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log(`Modo: ${dryRun ? 'DRY-RUN' : 'REAL'} | catálogos: ${JURIS_CATALOGS.map((c) => c.fuente).join(', ') || 'NINGUNO'}`);
  console.log(`MiniMax key: ${MINIMAX_KEY ? `...${MINIMAX_KEY.slice(-6)}` : 'NO CONFIGURADA (placeholder-only)'}`);
  console.log('');

  if (JURIS_CATALOGS.length === 0) {
    console.error('❌ No hay catálogos que coincidan con --only');
    process.exit(1);
  }

  let docCount = 0;
  let chunkCount = 0;
  const perSource = {};

  for (const cat of JURIS_CATALOGS) {
    const fp = path.join(CATALOGS_DIR, cat.file);
    if (!fs.existsSync(fp)) { console.warn(`⚠️ No encontrado: ${cat.file}`); continue; }
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const docs = data[cat.key] || [];
    console.log(`📂 ${cat.file}: ${docs.length} docs (array '${cat.key}')`);

    for (const doc of docs) {
      const chunks = buildChunks(doc, cat);
      docCount++;
      perSource[cat.fuente] = (perSource[cat.fuente] || 0) + chunks.length;
      chunkCount += chunks.length;
      if (dryRun) console.log(`   [dry] ${doc.id || doc.numero}: ${chunks.length} chunks`);
    }
  }

  if (dryRun) {
    console.log(`\n📊 DRY-RUN: ${docCount} docs → ${chunkCount} chunks`);
    console.log('   Por fuente:', JSON.stringify(perSource));
    process.exit(0);
  }

  if (!DATABASE_URL) { console.error('❌ PROBE_DATABASE_URL no configurada'); process.exit(1); }
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Conectado a PostgreSQL');

  // Índices necesarios para el filtro metadata->>'tipo' y GIN
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_rag_vectors_v2_tipo ON rag_vectors_v2 ((metadata->>'tipo'));
    CREATE INDEX IF NOT EXISTS idx_rag_vectors_v2_metadata_gin ON rag_vectors_v2 USING GIN (metadata jsonb_path_ops);
    CREATE INDEX IF NOT EXISTS idx_v2_embedding ON rag_vectors_v2 USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
  `);

  let inserted = 0;
  let placeholderCount = 0;
  let realCount = 0;
  let errors = 0;
  const t0 = Date.now();

  for (const cat of JURIS_CATALOGS) {
    const fp = path.join(CATALOGS_DIR, cat.file);
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const docs = data[cat.key] || [];

    for (const doc of docs) {
      const chunks = buildChunks(doc, cat);
      for (const chunk of chunks) {
        try {
          const { vec, placeholder, reason } = await getEmbedding(chunk.content);
          const meta = { ...chunk.baseMeta, placeholder };
          const vectorStr = `[${vec.join(',')}]`;
          await client.query(
            `INSERT INTO rag_vectors_v2 (id, source, content, embedding, metadata, updated_at)
             VALUES ($1,$2,$3,$4::vector,$5::jsonb,NOW())
             ON CONFLICT (id) DO UPDATE SET
               source=EXCLUDED.source, content=EXCLUDED.content,
               embedding=EXCLUDED.embedding, metadata=EXCLUDED.metadata, updated_at=NOW()`,
            [chunk.id, meta.source, chunk.content, vectorStr, JSON.stringify(meta)]
          );
          inserted++;
          if (placeholder) placeholderCount++;
          else realCount++;
          process.stdout.write(`   . ${chunk.id} ${placeholder ? '[PH]' : '[REAL]'}\r`);
        } catch (err) {
          errors++;
          console.error(`\n❌ Error ${chunk.id}: ${err.message}`);
        }
      }
    }
    console.log(`\n   ✅ ${cat.fuente} procesado`);
  }

  const elapsedMin = ((Date.now() - t0) / 60000).toFixed(1);
  const final = await client.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE metadata->>'tipo'='jurisprudencia')::int AS juris FROM rag_vectors_v2`);
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN REINDEX JURISPRUDENCIA:');
  console.log(`   Docs procesados: ${docCount}`);
  console.log(`   Chunks insertados/upserted: ${inserted}`);
  console.log(`   Embeddings REALES (MiniMax): ${realCount}`);
  console.log(`   Embeddings PLACEHOLDER (hash): ${placeholderCount}`);
  console.log(`   Errores: ${errors}`);
  console.log(`   Tiempo: ${elapsedMin} min`);
  console.log(`   Total rag_vectors_v2: ${final.rows[0].total}`);
  console.log(`   Total tipo='jurisprudencia': ${final.rows[0].juris}`);
  console.log('');
  console.log(placeholderCount > 0
    ? '⚠️  MiniMax bloqueado por rate limit (1002): se insertaron placeholders hash con metadata correcta.\n   Documentar: RE-EMBEDDING pendiente cuando MiniMax levante (o migrar a otro proveedor 1536-dim).'
    : '✅ Embeddings reales MiniMax OK');
  await client.end();
}

main().catch((err) => { console.error('💥 Error fatal:', err); process.exit(1); });
