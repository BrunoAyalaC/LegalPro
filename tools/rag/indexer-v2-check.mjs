#!/usr/bin/env node
/**
 * Indexer V2 - Chunking por artículo legal + metadata rica
 *
 * Pipeline de indexación RAG mejorado para LegalPro / LexIA:
 *   - Chunking por ARTÍCULO legal (ej: "Artículo 473 CPC" = chunk propio)
 *     reutilizando chunkHibrido() de chunker-advanced.mjs
 *   - Metadata rica por chunk: materia, codigo, articulo, tipo, vigente,
 *     relevancia, url, nombre, numero, fecha
 *   - Embeddings MiniMax embo-01 (1536 dimensiones) con rate limit y retry
 *   - Tabla propia `rag_vectors_v2` (vector(1536)) para NO romper el
 *     indexer original `index-corpus.mjs` que usa `rag_vectors` (vector(768))
 *   - Filtros por metadata habilitados en el retrieval (materia, codigo,
 *     articulo, tipo, vigente, relevancia, source)
 *
 * Uso:
 *   node tools/rag/indexer-v2.mjs                      # full corpus
 *   node tools/rag/indexer-v2.mjs --limit=20           # probar con 20 docs
 *   node tools/rag/indexer-v2.mjs --dry-run            # solo chunking, sin BD/API
 *   node tools/rag/indexer-v2.mjs --only=codigos-leyes # un solo catálogo
 *
 * Requiere:
 *   - DATABASE_URL (PostgreSQL con pgvector)
 *   - MINIMAX_API_KEY (embeddings embo-01, 1536 dims)
 *
 * @version 2.0.0
 * @date    2026-08-06
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { chunkHibrido, estadisticasChunking } from './chunker-advanced.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATABASE_URL = process.env.DATABASE_URL;
const CATALOGS_DIR = path.join(__dirname, '..', '..', 'catalogs');

// ==========================================
// CONFIGURACIÓN
// ==========================================

const CONFIG = {
  table: 'rag_vectors_v2',          // tabla propia v2 (1536 dims), no toca rag_vectors
  embeddingModel: process.env.MINIMAX_EMBEDDING_MODEL || 'embo-01',
  embeddingDimensions: 1536,        // MiniMax embo-01
  embeddingType: process.env.MINIMAX_EMBEDDING_TYPE || 'document', // 'document' al indexar, 'query' al buscar
  embeddingEndpoint: process.env.MINIMAX_EMBEDDING_URL || 'https://api.minimax.io/v1/embeddings',
  rateLimitMs: Number(process.env.MINIMAX_RATE_LIMIT_MS || 2500), // RPM bajo: espera 2-3s entre llamadas
  maxRetries: Number(process.env.MINIMAX_MAX_RETRIES || 4),
  retryBackoffMs: Number(process.env.MINIMAX_RETRY_BACKOFF_MS || 2000),
  maxTokensChars: 8000,             // límite duro de chars por embedding
  batchSize: 5,
  sources: [
    // CÓDIGOS / LEYES BASE
    'codigos-leyes.json',
    'plazos-procesales.json',
    'tipos-penales-peru.json',
    'delitos-economicos.json',
    'disclaimers-ia.json',
    // JURISPRUDENCIA / PRECEDENTES
    'jurisprudencia-tc-2026.json',
    'sentencias-tc-completas-2026.json',
    'casaciones-pj-2026.json',
    'resoluciones-indecopi-2026.json',
    'resoluciones-tribunal-fiscal-2026.json',
    'resoluciones-anpd-2026.json',
    'directivas-sunarp-2026.json',
    // NORMAS ESPECIALIZADAS (30 materias del arnés)
    'normas-especializadas-2026.json',
    'normas-minjusdh-2026.json',
    'normas-sunat-2026.json',
    'normas-sbs-2026.json',
    'normas-mtpe-2026.json',
    'normas-minsa-2026.json',
    'normas-oefa-2026.json',
    'normas-onp-2026.json',
    'normas-cgr-2026.json',
    'normas-elperuano-2026.json',
    'contrataciones-osce-2026.json',
    // SNAPSHOTS (doctrina/artículos LP Derecho)
    'lpderecho-snapshots/lpderecho-playwright-2026-08-07.json'
  ]
};

// ==========================================
// MAPAS DE MATERIA (metadata filtering)
// ==========================================

const MATERIA_MAP = {
  'codigos-leyes': {
    'const-1993': 'constitucional',
    cp: 'penal',
    cc: 'civil',
    cpc: 'civil',
    ncpp: 'penal',
    lpcl: 'laboral',
    cpcl: 'laboral',
    cts: 'laboral',
    gratificaciones: 'laboral',
    lpdp: 'datos_personales',
    'firma-digital': 'comercio_electronico',
    'lavado-activos': 'penal_economico',
    igv: 'tributario',
    ir: 'tributario',
    ct: 'tributario',
    'cpc-const': 'constitucional',
    arbitraje: 'arbitraje',
    'contencioso-administrativo': 'administrativo',
    sst: 'laboral',
    'hostigamiento-sexual': 'laboral',
    'ley-general-sistema-financiero': 'bancario',
    'contrataciones-estado': 'contrataciones',
    'ley-general-aduanas': 'aduanero',
    'conductas-anticompetitivas': 'competencia',
    'banda-ancha': 'telecomunicaciones',
    'ley-organica-elecciones': 'electoral',
    'organizaciones-politicas': 'electoral',
    'codigo-ejecucion-penal': 'penitenciario',
    'violencia-mujeres': 'genero',
    migraciones: 'extranjeria',
    'sistema-nacional-pensiones': 'previsional',
    'sistema-privado-pensiones': 'previsional',
    'sistema-portuario-nacional': 'maritimo',
    'aeronautica-civil': 'aeronautico',
    'ley-general-pesca': 'pesca',
    'recursos-hidricos': 'aguas',
    'ley-forestal-fauna': 'forestal',
    'organica-municipalidades': 'municipal',
    'contrato-seguro': 'seguros',
    'delitos-informaticos': 'ciberespacio',
    'promocion-deporte': 'deporte',
    'ley-general-turismo': 'turismo',
    'codigo-penal-militar-policial': 'militar',
    'patrimonio-cultural': 'cultura',
    'persona-adulta-mayor': 'adulto_mayor',
    'persona-discapacidad': 'discapacidad',
    'cooperativas-ahorro-credito': 'cooperativo'
  },
  'normas-especializadas': {
    BANC: 'bancario', CONT: 'contrataciones', ADUA: 'aduanero', COMP: 'competencia',
    TELC: 'telecomunicaciones', ELEC: 'electoral', PENI: 'penitenciario',
    GENE: 'genero', EXTR: 'extranjeria', PREV: 'previsional', MARI: 'maritimo',
    AERO: 'aeronautico', AGRA: 'agrario', PESC: 'pesca', AGUA: 'aguas',
    FORE: 'forestal', DPER: 'datos_personales', INTL: 'internacional',
    MUNI: 'municipal', EJEC: 'ejecucion', SEGU: 'seguros', CIBE: 'ciberespacio',
    DEPO: 'deporte', TURI: 'turismo', MILI: 'militar', POLI: 'policial',
    COOP: 'cooperativo', CULT: 'cultura', AMAY: 'adulto_mayor', DISC: 'discapacidad'
  }
};

// Prefijos de id de normas-especializadas → materia (ej: "BANC-2026-001" → bancario)
const MATERIA_BY_PREFIX = MATERIA_MAP['normas-especializadas'];

// ==========================================
// PARSING DE ARGUMENTOS CLI
// ==========================================

function parseArgs(argv) {
  const args = { limit: null, dryRun: false, only: null };
  for (const arg of argv) {
    if (arg.startsWith('--limit=')) args.limit = Number.parseInt(arg.split('=')[1], 10);
    if (arg === '--dry-run') args.dryRun = true;
    if (arg.startsWith('--only=')) args.only = arg.split('=')[1];
  }
  if (args.limit !== null && (Number.isNaN(args.limit) || args.limit < 1)) {
    console.error(`❌ --limit debe ser un entero >= 1 (recibido: ${args.limit})`);
    process.exit(1);
  }
  return args;
}

const ARGS = parseArgs(process.argv.slice(2));

// ==========================================
// UTILIDADES
// ==========================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(text) {
  return String(text || 'unknown')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60) || 'unknown';
}

// ==========================================
// EXTRACCIÓN DE DOCUMENTOS DEL CATÁLOGO
// ==========================================

const ARRAY_KEYS = [
  'normas', 'jurisprudencia', 'sentencias', 'casaciones', 'resoluciones',
  'plazos', 'tipos', 'delitos', 'disclaimers', 'posts',
  'directivas_destacadas', 'normas_recientes_julio_2026',
  'boletines_jurisprudencia_2026', 'acuerdos_y_resoluciones_observancia_obligatoria',
  'compendios_documentos_normativos', 'precedentes_y_jurisprudencia_registral'
];

function extractDocuments(catalog) {
  for (const key of ARRAY_KEYS) {
    if (Array.isArray(catalog[key]) && catalog[key].length > 0) {
      return { docs: catalog[key], arrayKey: key };
    }
  }
  if (Array.isArray(catalog)) return { docs: catalog, arrayKey: 'root' };
  return { docs: [catalog], arrayKey: 'root' };
}

// ==========================================
// DETECCIÓN DE TIPO Y MATERIA
// ==========================================

function detectDocTipo(doc, sourceFile) {
  const raw = String(doc.tipo || '').toLowerCase().trim();
  if (raw === 'codigo' || raw === 'constitucion' || raw === 'codigo_legal') return 'codigo';
  if (Array.isArray(doc.articulos_mas_citados) && doc.articulos_mas_citados.length > 0) return 'codigo';
  if (sourceFile.includes('jurisprudencia') || sourceFile.includes('sentencias') || sourceFile.includes('casaciones')) return 'jurisprudencia';
  if (sourceFile.includes('resoluciones')) return 'resolucion';
  if (sourceFile.includes('plazos')) return 'plazo';
  if (sourceFile.includes('lpderecho')) return 'doctrina';
  if (raw === 'ley' || raw === 'decreto' || raw === 'decreto legislativo' || raw === 'decreto supremo') return 'norma';
  return 'norma';
}

function resolveMateria(doc, sourceFile, catalogKey) {
  if (doc.materia) return String(doc.materia).toLowerCase().replace(/\s+/g, '_');
  if (catalogKey === 'codigos-leyes') return MATERIA_MAP['codigos-leyes'][doc.id] || 'general';
  if (catalogKey === 'normas-especializadas') {
    const prefix = String(doc.id || '').split('-')[0].toUpperCase();
    return MATERIA_BY_PREFIX[prefix] || 'general';
  }
  return 'general';
}

function deriveVigente(doc) {
  // Derogación explícita → no vigente; si no hay señal, se asume vigente
  if (doc.derogada === true || doc.derogado === true) return false;
  if (String(doc.estado || '').toLowerCase().includes('derog')) return false;
  if (String(doc.estado || '').toLowerCase().includes('vigent')) return true;
  return true;
}

function normalizeRelevancia(value) {
  const v = String(value || 'MEDIA').toUpperCase();
  return v.includes('ALTA') ? 'ALTA' : v.includes('BAJA') ? 'BAJA' : 'MEDIA';
}

// ==========================================
// CONSTRUCCIÓN DE TEXTO INDEXABLE
// ==========================================

function buildCompositeText(doc) {
  const parts = [];
  if (doc.titulo) parts.push(`Título: ${doc.titulo}`);
  if (doc.nombre) parts.push(`Norma: ${doc.nombre}`);
  if (doc.numero) parts.push(`Número: ${doc.numero}`);
  if (doc.sumilla) parts.push(`Sumilla: ${doc.sumilla}`);
  if (doc.caso) parts.push(`Caso: ${doc.caso}`);
  if (doc.asunto) parts.push(`Asunto: ${doc.asunto}`);
  if (doc.descripcion) parts.push(doc.descripcion);
  if (doc.fundamento_principal) parts.push(`Fundamento principal: ${doc.fundamento_principal}`);
  if (doc.acto) parts.push(`Acto: ${doc.acto}`);
  if (doc.consecuencia_vencimiento) parts.push(`Consecuencia de vencimiento: ${doc.consecuencia_vencimiento}`);
  if (doc.dias) parts.push(`Plazo: ${doc.dias} días (${doc.tipo || 'hábiles'})`);
  if (doc.pena_minima) parts.push(`Pena mínima: ${doc.pena_minima}`);
  if (doc.pena_maxima) parts.push(`Pena máxima: ${doc.pena_maxima}`);
  if (Array.isArray(doc.palabras_clave) && doc.palabras_clave.length) {
    parts.push(`Palabras clave: ${doc.palabras_clave.join(', ')}`);
  }
  if (doc.contenido && typeof doc.contenido === 'string') parts.push(doc.contenido);
  return parts.filter(Boolean).join('\n\n');
}

// ==========================================
// METADATA RICA POR CHUNK
// ==========================================

function buildBaseMetadata(doc, sourceFile, catalogKey) {
  return {
    source: sourceFile,
    fuente: sourceFile.replace(/\.json$/, '').replace('lpderecho-snapshots/', ''),
    materia: resolveMateria(doc, sourceFile, catalogKey),
    codigo: doc.id || null,
    tipo: detectDocTipo(doc, sourceFile),
    vigente: deriveVigente(doc),
    relevancia: normalizeRelevancia(doc.relevancia_legalpro || doc.relevancia),
    url: doc.url_spij || doc.url_fuente || doc.url || doc.pdf_url || null,
    nombre: doc.nombre || doc.titulo || doc.caso || doc.acto || null,
    numero: doc.numero || null,
    fecha: doc.fecha_publicacion || doc.fecha_sentencia || doc.fecha || null,
    palabras_clave: Array.isArray(doc.palabras_clave) ? doc.palabras_clave : []
  };
}

function enrichChunk(chunk, doc, baseMeta) {
  const metadata = { ...baseMeta, ...chunk.metadata };
  // Normalizar número de artículo desde el chunker (metadata.numero) o del doc
  if (!metadata.articulo) {
    if (chunk.metadata.numero) metadata.articulo = String(chunk.metadata.numero);
    else if (doc.articulo) metadata.articulo = String(doc.articulo);
    else if (doc.articulo_cp) metadata.articulo = String(doc.articulo_cp);
  }
  // Asegurar tipo de chunk concreto (articulo/seccion/parrafo/preambulo)
  metadata.chunk_tipo = chunk.metadata.tipo || 'documento';
  return { id: chunk.id, content: chunk.content, metadata };
}

// ==========================================
// CHUNKING POR DOCUMENTO (router v2)
// ==========================================

function buildChunks(doc, sourceFile, catalogKey) {
  const baseMeta = buildBaseMetadata(doc, sourceFile, catalogKey);
  const docTipo = baseMeta.tipo;

  // 1) TEXTO COMPLETO DE ARTÍCULOS: chunkHibrido con tipo 'codigo'
  //    → chunkPorArticulo() detecta "Artículo N" y crea un chunk por artículo
  const fullText = doc.texto_completo || doc.texto || doc.cuerpo || doc.contenido_normativo;
  if (fullText && typeof fullText === 'string' && fullText.trim().length > 0) {
    const chunks = chunkHibrido(fullText, { tipo: 'codigo', codigo: doc.id || doc.nombre });
    if (chunks.length > 0) return chunks.map((c) => enrichChunk(c, doc, baseMeta));
  }

  // 2) CÓDIGO con artículos más citados (sin texto completo):
  //    → un chunk por artículo citado, metadata rica y citación verificable
  if (Array.isArray(doc.articulos_mas_citados) && doc.articulos_mas_citados.length > 0) {
    const chunks = doc.articulos_mas_citados.map((numero) => ({
      id: `${slugify(doc.id)}-art-${numero}`,
      content: `Artículo ${numero} de ${doc.nombre || doc.id}${doc.numero ? ` (${doc.numero})` : ''}. Referencia normativa: ${doc.nombre || doc.id}, artículo ${numero}.`,
      metadata: {
        tipo: 'articulo',
        articulo: String(numero),
        palabras: String(numero).length + 5
      }
    }));
    return chunks.map((c) => enrichChunk(c, doc, baseMeta));
  }

  // 3) NORMAS / JURISPRUDENCIA / RESOLUCIONES con sumilla:
  //    → texto compuesto + chunkHibrido (por sección para jurisprudencia)
  const compositeText = buildCompositeText(doc);
  if (compositeText.trim().length > 0) {
    const chunks = chunkHibrido(compositeText, {
      tipo: docTipo,
      id: doc.id,
      codigo: doc.id,
      titulo: doc.titulo || doc.nombre || doc.caso || doc.acto
    });
    if (chunks.length > 0) return chunks.map((c) => enrichChunk(c, doc, baseMeta));
  }

  // 4) FALLBACK: documento completo como un solo chunk
  const content = JSON.stringify(doc).substring(0, CONFIG.maxTokensChars);
  return [enrichChunk({
    id: slugify(doc.id || `${sourceFile}-fallback`),
    content,
    metadata: { tipo: 'documento', palabras: content.split(/\s+/).length }
  }, doc, baseMeta)];
}

// ==========================================
// EMBEDDINGS MiniMax embo-01 (1536 dims) con retry
// ==========================================

class RateLimitError extends Error {
  constructor(message, retryAfterMs) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

async function getEmbedding(text, attempt = 0) {
  const truncated = String(text || '').substring(0, CONFIG.maxTokensChars);
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

    // Rate limit / errores transitorios → retry con backoff
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

    // MiniMax embo-01 devuelve vectors[0] = [1536 floats]
    if (data.vectors && Array.isArray(data.vectors) && data.vectors[0]) {
      const vector = data.vectors[0];
      if (vector.length !== CONFIG.embeddingDimensions) {
        throw new Error(`Dimensiones inesperadas: ${vector.length} (esperado ${CONFIG.embeddingDimensions})`);
      }
      return vector;
    }

    // Error de negocio MiniMax (base_resp.status_code !== 0)
    if (data.base_resp && data.base_resp.status_code && Number(data.base_resp.status_code) !== 0) {
      const code = data.base_resp.status_code;
      if (code === 1004 || code === 1005 || code === 1032 || code === 1002) {
        // 1004 = rate limit, 1032 = QPS limit, 1002 = quota agotada
        throw new RateLimitError(`MiniMax base_resp ${code}: ${data.base_resp.status_msg || 'rate limit'}`, CONFIG.retryBackoffMs * 2);
      }
      throw new Error(`MiniMax base_resp ${code}: ${data.base_resp.status_msg || 'error'}`);
    }

    throw new Error('Embedding fallo: respuesta sin vectors');
  } catch (err) {
    if (attempt < CONFIG.maxRetries) {
      const delay = err instanceof RateLimitError
        ? Math.max(err.retryAfterMs || CONFIG.retryBackoffMs, CONFIG.retryBackoffMs) * (attempt + 1)
        : CONFIG.retryBackoffMs * (attempt + 1);
      console.warn(`   ⚠️  Embedding retry ${attempt + 1}/${CONFIG.maxRetries} tras ${delay}ms (${err.message})`);
      await sleep(delay);
      return getEmbedding(text, attempt + 1);
    }
    throw err;
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

    -- Índices para metadata filtering en retrieval
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

    -- RLS default-deny + policy de lectura para corpus legal público
    ALTER TABLE ${CONFIG.table} ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS rag_vectors_v2_select_public ON ${CONFIG.table};
    CREATE POLICY rag_vectors_v2_select_public
      ON ${CONFIG.table} FOR SELECT
      USING (true);
  `);
  console.log(`✅ Schema RAG v2 verificado/creado (tabla: ${CONFIG.table}, vector(${CONFIG.embeddingDimensions}))`);
}

async function upsertChunk(client, chunk, embedding) {
  const vectorStr = `[${embedding.join(',')}]`;
  await client.query(
    `
    INSERT INTO ${CONFIG.table} (id, source, content, embedding, metadata, updated_at)
    VALUES ($1, $2, $3, $4::vector, $5::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET
      source = EXCLUDED.source,
      content = EXCLUDED.content,
      embedding = EXCLUDED.embedding,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
  `,
    [chunk.id, chunk.metadata.source, chunk.content, vectorStr, JSON.stringify(chunk.metadata)]
  );
}

// ==========================================
// ORQUESTACIÓN PRINCIPAL
// ==========================================

async function main() {
  console.log('🚀 RAG Indexer V2 - Chunking por artículo + metadata rica');
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log(`Modelo embeddings: ${CONFIG.embeddingModel} (${CONFIG.embeddingDimensions} dims)`);
  console.log(`Modo: ${ARGS.dryRun ? 'DRY-RUN (sin BD/API)' : 'indexación real'}`);
  if (ARGS.limit) console.log(`Límite de documentos: ${ARGS.limit}`);
  if (ARGS.only) console.log(`Catálogo único: ${ARGS.only}`);
  console.log('');

  if (ARGS.dryRun) {
    console.log('🔬 DRY-RUN: validando chunking sin escribir en BD ni llamar a MiniMax...\n');
    const sources = CONFIG.sources.filter((s) => !ARGS.only || s.includes(ARGS.only));
    let docCount = 0;
    let chunkCount = 0;
    const allChunks = [];
    for (const sourceFile of sources) {
      const sourcePath = path.join(CATALOGS_DIR, sourceFile);
      if (!fs.existsSync(sourcePath)) {
        console.warn(`⚠️  No encontrado: ${sourceFile}`);
        continue;
      }
      let catalog;
      try {
        catalog = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
      } catch (err) {
        console.error(`❌ Error parseando ${sourceFile}: ${err.message}`);
        continue;
      }
      const { docs } = extractDocuments(catalog);
      for (const doc of docs) {
        if (ARGS.limit && docCount >= ARGS.limit) break;
        const catalogKey = sourceFile.includes('codigos-leyes')
          ? 'codigos-leyes'
          : sourceFile.includes('normas-especializadas') ? 'normas-especializadas' : null;
        const chunks = buildChunks(doc, sourceFile, catalogKey);
        allChunks.push(...chunks);
        chunkCount += chunks.length;
        docCount++;
      }
      if (ARGS.limit && docCount >= ARGS.limit) break;
    }
    const stats = estadisticasChunking(allChunks);
    console.log(`📊 DRY-RUN: ${docCount} documentos → ${chunkCount} chunks`);
    console.log(`   Tipos de chunk: ${JSON.stringify(stats.tipos, null, 2)}`);
    console.log(`   Promedio longitud: ${stats.longitud_promedio} chars`);
    console.log('\n✅ DRY-RUN completado. Chunking por artículo + metadata rica OK.');
    process.exit(0);
  }

  // Validar configuración
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL no configurada');
    process.exit(1);
  }
  if (!process.env.MINIMAX_API_KEY) {
    console.error('❌ MINIMAX_API_KEY no configurada (embeddings embo-01)');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('✅ Conectado a PostgreSQL');

  await ensureSchema(client);

  const sources = CONFIG.sources.filter((s) => !ARGS.only || s.includes(ARGS.only));
  let totalChunks = 0;
  let totalErrors = 0;
  let docCount = 0;
  let embeddingCalls = 0;

  for (const sourceFile of sources) {
    const sourcePath = path.join(CATALOGS_DIR, sourceFile);

    if (!fs.existsSync(sourcePath)) {
      console.warn(`⚠️  No encontrado: ${sourceFile}`);
      continue;
    }

    console.log(`\n📂 Procesando: ${sourceFile}`);

    let catalog;
    try {
      catalog = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    } catch (err) {
      console.error(`❌ Error parseando ${sourceFile}: ${err.message}`);
      totalErrors++;
      continue;
    }

    const { docs } = extractDocuments(catalog);
    console.log(`   Documentos: ${docs.length}`);

    let fileChunks = 0;
    for (const doc of docs) {
      if (ARGS.limit && docCount >= ARGS.limit) break;

      const catalogKey = sourceFile.includes('codigos-leyes')
        ? 'codigos-leyes'
        : sourceFile.includes('normas-especializadas') ? 'normas-especializadas' : null;

      const chunks = buildChunks(doc, sourceFile, catalogKey);

      for (const chunk of chunks) {
        try {
          const embedding = await getEmbedding(chunk.content);
          embeddingCalls++;
          await upsertChunk(client, chunk, embedding);
          fileChunks++;
          process.stdout.write(`   . ${fileChunks} chunks indexados (doc ${docCount + 1}): ${chunk.id}\r`);
          // Rate limit: MiniMax RPM bajo → esperar 2-3s entre llamadas
          await sleep(CONFIG.rateLimitMs);
        } catch (err) {
          console.error(`\n❌ Error indexando ${chunk.id}: ${err.message}`);
          totalErrors++;
          // ante error de rate limit agotado, esperar más antes de continuar
          if (err instanceof RateLimitError) {
            console.warn(`   ⏳ Pausa extendida por rate limit (${CONFIG.retryBackoffMs * 3}ms)`);
            await sleep(CONFIG.retryBackoffMs * 3);
          }
        }
      }

      docCount++;
    }

    console.log(`\n   ✅ ${fileChunks} chunks indexados de ${sourceFile}`);
    totalChunks += fileChunks;
    if (ARGS.limit && docCount >= ARGS.limit) {
      console.log(`\n🔒 Límite alcanzado (--limit=${ARGS.limit}). Deteniendo.`);
      break;
    }
  }

  await client.end();

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN INDEXER V2:');
  console.log(`   Documentos procesados: ${docCount}`);
  console.log(`   Total chunks indexados: ${totalChunks}`);
  console.log(`   Embeddings generados: ${embeddingCalls}`);
  console.log(`   Errores: ${totalErrors}`);
  console.log(`   Fuentes: ${sources.length}`);
  console.log(`   Tabla: ${CONFIG.table} (vector(${CONFIG.embeddingDimensions}))`);
  console.log(`   Modelo: ${CONFIG.embeddingModel}`);
  console.log('');

  if (totalErrors === 0) {
    console.log('✅ INDEXACIÓN V2 COMPLETADA EXITOSAMENTE');
    process.exit(0);
  } else {
    console.log('⚠️  INDEXACIÓN V2 COMPLETADA CON ERRORES');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});
