#!/usr/bin/env node
/**
 * Indexer TODOS - Corpus RAG completo para LegalPro / LexIA
 *
 * Pipeline de indexación RAG que cubre TODOS los catálogos legales de
 * `catalogs/*.json` (y snapshots), AÑADIENDO o ACTUALIZANDO chunks en
 * `rag_vectors_v2` SIN borrar nada (ON CONFLICT (id) DO UPDATE).
 *
 * Incluye los catálogos que el indexer-v2 NO tenía (FIX 2026-08-12):
 *   - casaciones-civiles-laborales-2026.json (creado 2026-08-07, sin indexar)
 *   - plazos-procesales.json, tipos-penales-peru.json, delitos-economicos.json
 * Y amplía la extracción con keys adicionales de metadata (normativa
 * relevante destacada, informes, boletines, etc.).
 *
 * EMBEDDINGS:
 *   - Default: MiniMax embo-01 si MINIMAX_API_KEY está y responde; si no,
 *     fallback al hash semántico-ligero de retrieve.mjs (tokenización español
 *     + bigramas + trigramas + IDF, 1536 dims, rango [0,1]) — el MISMO
 *     algoritmo que usa el retrieval, para consistencia query↔chunk.
 *   - `--hash` fuerza hash sin llamar a MiniMax (rápido y determinístico).
 *   - `--minimax` fuerza MiniMax (con fallback a hash ante rate limit).
 *
 * Uso:
 *   node tools/rag/index-todos.mjs                      # todos (MiniMax o hash)
 *   node tools/rag/index-todos.mjs --hash               # todos con hash (recomendado en modo degradado)
 *   node tools/rag/index-todos.mjs --solo-faltantes     # solo catálogos aún no indexados
 *   node tools/rag/index-todos.mjs --only=casaciones-civiles-laborales
 *   node tools/rag/index-todos.mjs --only=plazos-procesales --hash
 *   node tools/rag/index-todos.mjs --dry-run            # solo chunking, sin BD/API
 *
 * Requiere:
 *   - DATABASE_URL (PostgreSQL con pgvector)
 *
 * @version 1.0.0
 * @date    2026-08-12
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { chunkHibrido, estadisticasChunking } from './chunker-advanced.mjs';
import { hashEmbedding } from './retrieve.mjs';
import { buildChunk as buildChunkInterpFav } from './index-interpretaciones.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATABASE_URL = process.env.DATABASE_URL;
const CATALOGS_DIR = path.join(__dirname, '..', '..', 'catalogs');

// ==========================================
// CONFIGURACIÓN
// ==========================================

const CONFIG = {
  table: 'rag_vectors_v2',          // tabla propia v2 (1536 dims), no toca rag_vectors
  embeddingDimensions: 1536,        // MiniMax embo-01 / hash 1536 dims → vector(1536)
  embeddingModel: process.env.MINIMAX_EMBEDDING_MODEL || 'embo-01',
  embeddingType: process.env.MINIMAX_EMBEDDING_TYPE || 'document',
  embeddingEndpoint: process.env.MINIMAX_EMBEDDING_URL || 'https://api.minimax.io/v1/embeddings',
  rateLimitMs: Number(process.env.MINIMAX_RATE_LIMIT_MS || 1200),
  maxRetries: Number(process.env.MINIMAX_MAX_RETRIES || 3),
  retryBackoffMs: Number(process.env.MINIMAX_RETRY_BACKOFF_MS || 1500),
  maxTokensChars: 8000,             // límite duro de chars por embedding

  // TODOS los catálogos RAG del proyecto (orden: leyes → plazos → tipos →
  // delitos → jurisprudencia → resoluciones → doctrina). FIX 2026-08-12:
  // se añade casaciones-civiles-laborales-2026.json y se listan explícitos
  // los que antes quedaban fuera del indexer-v2.
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
    'casaciones-civiles-laborales-2026.json',
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
    // INTERPRETACIONES FAVORABLES (pro-cliente) — indexadas con id estable
    // `interp-fav-*` vía index-interpretaciones.mjs (UPSERT, sin duplicados)
    'interpretaciones-favorables.json',
    // SNAPSHOTS (doctrina/artículos LP Derecho)
    'lpderecho-snapshots/lpderecho-playwright-2026-08-07.json'
  ],

  // Claves de array con contenido LEGAL indexable. Ampliado (FIX 2026-08-12)
  // con las keys reales detectadas en los catálogos (normativa_relevante_
  // destacada, informes, boletines, acuerdos de observancia obligatoria, etc.)
  // para no dejar fuera chunks de fuentes como ANPDP/OSCE/INDECOPI.
  arrayKeys: [
    // Núcleo
    'normas', 'jurisprudencia', 'sentencias', 'casaciones', 'resoluciones',
    'plazos', 'tipos', 'delitos', 'disclaimers', 'posts',
    // Ampliación de cobertura
    'normativa_relevante_destacada', 'normativa_clave_vinculada',
    'boletines_jurisprudencia_2026', 'acuerdos_y_resoluciones_observancia_obligatoria',
    'compendios_documentos_normativos', 'precedentes_y_jurisprudencia_registral',
    'informes_destacados_2026', 'informes_destacados', 'publicaciones_relevantes_2026',
    'directivas_destacadas', 'normas_recientes_julio_2026',
    'proveedores_ia'
  ],

  // Keys que NUNCA deben tratarse como documentos (metadata, listas de URLs,
  // notas de investigación, estadísticas).
  skipKeys: [
    'metadata', 'estadisticas', 'urls_consultadas', 'notas_investigacion',
    'metodologia', 'fuente', 'fuente_oficial', 'changelog', 'descripcion',
    'version', 'ultima_actualizacion', 'fecha_consulta', 'total_', 'limite'
  ]
};

// ==========================================
// MAPAS DE MATERIA (metadata filtering)
// ==========================================

const MATERIA_MAP = {
  'codigos-leyes': {
    'const-1993': 'constitucional',
    cp: 'penal', cc: 'civil', cpc: 'civil', ncpp: 'penal',
    lpcl: 'laboral', cpcl: 'laboral', cts: 'laboral', gratificaciones: 'laboral',
    lpdp: 'datos_personales', 'firma-digital': 'comercio_electronico',
    'lavado-activos': 'penal_economico', igv: 'tributario', ir: 'tributario',
    ct: 'tributario', 'cpc-const': 'constitucional', arbitraje: 'arbitraje',
    'contencioso-administrativo': 'administrativo', sst: 'laboral',
    'hostigamiento-sexual': 'laboral', 'ley-general-sistema-financiero': 'bancario',
    'contrataciones-estado': 'contrataciones', 'ley-general-aduanas': 'aduanero',
    'conductas-anticompetitivas': 'competencia', 'banda-ancha': 'telecomunicaciones',
    'ley-organica-elecciones': 'electoral', 'organizaciones-politicas': 'electoral',
    'codigo-ejecucion-penal': 'penitenciario', 'violencia-mujeres': 'genero',
    migraciones: 'extranjeria', 'sistema-nacional-pensiones': 'previsional',
    'sistema-privado-pensiones': 'previsional', 'sistema-portuario-nacional': 'maritimo',
    'aeronautica-civil': 'aeronautico', 'ley-general-pesca': 'pesca',
    'recursos-hidricos': 'aguas', 'ley-forestal-fauna': 'forestal',
    'organica-municipalidades': 'municipal', 'contrato-seguro': 'seguros',
    'delitos-informaticos': 'ciberespacio', 'promocion-deporte': 'deporte',
    'ley-general-turismo': 'turismo', 'codigo-penal-militar-policial': 'militar',
    'patrimonio-cultural': 'cultura', 'persona-adulta-mayor': 'adulto_mayor',
    'persona-discapacidad': 'discapacidad', 'cooperativas-ahorro-credito': 'cooperativo'
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
const MATERIA_BY_PREFIX = MATERIA_MAP['normas-especializadas'];

// ==========================================
// PARSING DE ARGUMENTOS CLI
// ==========================================

function parseArgs(argv) {
  const args = { limit: null, dryRun: false, only: null, soloFaltantes: false, mode: 'auto' };
  for (const arg of argv) {
    if (arg.startsWith('--limit=')) args.limit = Number.parseInt(arg.split('=')[1], 10);
    if (arg === '--dry-run') args.dryRun = true;
    if (arg.startsWith('--only=')) args.only = arg.split('=')[1];
    if (arg === '--solo-faltantes') args.soloFaltantes = true;
    if (arg === '--hash') args.mode = 'hash';
    if (arg === '--minimax') args.mode = 'minimax';
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
// EXTRACCIÓN DE DOCUMENTOS DEL CATÁLOGO (ampliada)
// ==========================================

/**
 * Extrae documentos de un catálogo recorriendo TODAS las claves de array
 * que contengan objetos con contenido legal. Recorre en orden de prioridad
 * (arrayKeys) y salta claves de metadata/URLs. Devuelve { docs, arrayKey }.
 *
 * FIX 2026-08-12: ya no se detiene en la primera key: si un catálogo tiene
 * varias keys legales (ej. normas + normativa_relevante_destacada + informes)
 * se indexan todas (respetando ids estables → ON CONFLICT deduplica).
 */
function extractDocuments(catalog) {
  if (Array.isArray(catalog)) return { docs: catalog, arrayKey: 'root' };

  const docs = [];
  const foundKeys = [];

  for (const key of CONFIG.arrayKeys) {
    if (!Array.isArray(catalog[key]) || catalog[key].length === 0) continue;
    // Filtrar docs que no parezcan documentos (strings/URLs planas)
    const validDocs = catalog[key].filter((d) => d && typeof d === 'object');
    if (validDocs.length > 0) {
      docs.push(...validDocs);
      foundKeys.push(key);
    }
  }

  // Fallback: si no encontró keys conocidas, buscar keys de array genéricas
  // que no estén en skipKeys (evita indexar metadata/estadisticas/urls).
  if (docs.length === 0) {
    for (const key of Object.keys(catalog)) {
      if (CONFIG.skipKeys.some((s) => key.includes(s))) continue;
      if (!Array.isArray(catalog[key]) || catalog[key].length === 0) continue;
      const validDocs = catalog[key].filter((d) => d && typeof d === 'object');
      if (validDocs.length > 0) {
        docs.push(...validDocs);
        foundKeys.push(key);
      }
    }
  }

  return { docs, arrayKey: foundKeys.join(',') || 'root' };
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
  if (sourceFile.includes('tipos-penales')) return 'tipo_penal';
  if (sourceFile.includes('delitos-economicos')) return 'delito_economico';
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
  if (Array.isArray(doc.articulos) && doc.articulos.length) parts.push(`Artículos: ${doc.articulos.join(', ')}`);
  if (Array.isArray(doc.palabras_clave) && doc.palabras_clave.length) {
    parts.push(`Palabras clave: ${doc.palabras_clave.join(', ')}`);
  }
  if (doc.contenido && typeof doc.contenido === 'string') parts.push(doc.contenido);
  return parts.filter(Boolean).join('\n\n');
}

// ==========================================
// METADATA RICA POR CHUNK
// ==========================================

// FIX RAG-SOTA-GAP2 (2026-08-22): Parent-Child Retrieval (informe rag.txt §7,
// "Parent-document: Precision child + context parent — Muy recomendado").
// Cada chunk (hijo) lleva metadata.parent_text = contexto del contenedor
// (padre): para códigos de leyes, nombre de la norma + referencia del
// artículo siguiente si existe; para otros documentos, título del
// documento/sección. Máximo 300 chars. retrieve.mjs lo propaga como
// chunk.parent_text y buildAugmentedPrompt lo antepone como línea
// `[Contexto: ...]` → el generador recibe hijo preciso + padre contextual.
const PARENT_TEXT_MAX_CHARS = 300;

/** Colapsa whitespace y trunca a PARENT_TEXT_MAX_CHARS (con elipsis). */
function truncarParentText(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  if (t.length <= PARENT_TEXT_MAX_CHARS) return t || null;
  return t.substring(0, PARENT_TEXT_MAX_CHARS - 1).trimEnd() + '…';
}

/**
 * Construye el parent_text de un chunk según su documento contenedor.
 *
 * @param {object} doc - Documento del catálogo (norma/casación/resolución...)
 * @param {object} chunk - Chunk generado por chunkHibrido/buildChunks
 * @param {object} [ctx] - { numerosArticulo: [{n, raw}] } solo para chunks
 *   tipo 'articulo' provenientes de texto completo (permite referenciar el
 *   artículo siguiente dentro de la misma norma).
 * @returns {string|null} parent_text (<= 300 chars) o null si no hay título
 */
function buildParentText(doc, chunk, ctx = {}) {
  const partes = [];
  const nombreNorma = doc.nombre || doc.titulo || doc.caso || doc.acto || null;
  if (nombreNorma) {
    partes.push(nombreNorma);
    if (doc.numero) partes.push(`(${doc.numero})`);
  }

  // "Título del artículo siguiente si existe": en chunks tipo articulo de un
  // código, se añade la referencia del siguiente artículo de la misma norma
  // (delimita dónde termina el extracto del hijo).
  if (chunk.metadata?.tipo === 'articulo' && Array.isArray(ctx.numerosArticulo)) {
    const actual = Number.parseFloat(chunk.metadata.numero);
    if (Number.isFinite(actual)) {
      const siguiente = ctx.numerosArticulo.find((p) => p.n > actual);
      if (siguiente) partes.push(`· sigue Artículo ${siguiente.raw}`);
    }
  }

  // Otros documentos: título de sección (chunkPorSeccion setea metadata.titulo)
  if (partes.length === 0 && chunk.metadata?.titulo) partes.push(chunk.metadata.titulo);

  return partes.length > 0 ? truncarParentText(partes.join(' ')) : null;
}

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

function enrichChunk(chunk, doc, baseMeta, parentCtx = null) {
  const metadata = { ...baseMeta, ...chunk.metadata };
  if (!metadata.articulo) {
    if (chunk.metadata.numero) metadata.articulo = String(chunk.metadata.numero);
    else if (doc.articulo) metadata.articulo = String(doc.articulo);
    else if (doc.articulo_cp) metadata.articulo = String(doc.articulo_cp);
  }
  metadata.chunk_tipo = chunk.metadata.tipo || 'documento';
  // FIX RAG-SOTA-GAP2: contexto del contenedor (padre) para parent-child retrieval
  const parentText = buildParentText(doc, chunk, parentCtx || {});
  if (parentText) metadata.parent_text = parentText;
  return { id: chunk.id, content: chunk.content, metadata };
}

// ==========================================
// CHUNKING POR DOCUMENTO (router v2)
// ==========================================

function buildChunks(doc, sourceFile, catalogKey) {
  const baseMeta = buildBaseMetadata(doc, sourceFile, catalogKey);
  const docTipo = baseMeta.tipo;

  // 0) INTERPRETACIONES FAVORABLES: chunk dedicado con id estable
  //    `interp-fav-${id}`, tipo 'interpretacion' y texto rico (principio +
  //    base legal + estrategia + ejemplo + límites). Reutiliza el builder de
  //    index-interpretaciones.mjs para que TODAS las vías (script dedicado o
  //    index-todos) produzcan los MISMOS ids → ON CONFLICT deduplica.
  if (sourceFile === 'interpretaciones-favorables.json') {
    return [buildChunkInterpFav(doc)];
  }

  // 1) TEXTO COMPLETO DE ARTÍCULOS: chunkHibrido con tipo 'codigo'
  const fullText = doc.texto_completo || doc.texto || doc.cuerpo || doc.contenido_normativo;
  if (fullText && typeof fullText === 'string' && fullText.trim().length > 0) {
    const chunks = chunkHibrido(fullText, { tipo: 'codigo', codigo: doc.id || doc.nombre });
    if (chunks.length > 0) {
      // FIX RAG-SOTA-GAP2: índice de artículos de la norma para referenciar
      // el "artículo siguiente" en parent_text (solo chunks tipo articulo).
      const numerosArticulo = chunks
        .map((c) => ({ n: Number.parseFloat(c.metadata?.numero), raw: String(c.metadata?.numero || '') }))
        .filter((p) => Number.isFinite(p.n))
        .sort((a, b) => a.n - b.n);
      return chunks.map((c) => enrichChunk(c, doc, baseMeta, { numerosArticulo }));
    }
  }

  // 2) CÓDIGO con artículos más citados (sin texto completo)
  if (Array.isArray(doc.articulos_mas_citados) && doc.articulos_mas_citados.length > 0) {
    const chunks = doc.articulos_mas_citados.map((numero) => ({
      id: `${slugify(doc.id)}-art-${numero}`,
      content: `Artículo ${numero} de ${doc.nombre || doc.id}${doc.numero ? ` (${doc.numero})` : ''}. Referencia normativa: ${doc.nombre || doc.id}, artículo ${numero}.`,
      metadata: { tipo: 'articulo', articulo: String(numero), palabras: String(numero).length + 5 }
    }));
    return chunks.map((c) => enrichChunk(c, doc, baseMeta));
  }

  // 3) NORMAS / JURISPRUDENCIA / RESOLUCIONES con sumilla o campos ricos
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
// EMBEDDINGS: MiniMax embo-01 con retry → fallback hash (retrieve.mjs)
// ==========================================

class RateLimitError extends Error {
  constructor(message, retryAfterMs) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Genera el embedding de un chunk.
 *
 * Modos:
 *   - ARGS.mode === 'hash'        → SIEMPRE hash (rápido, determinístico).
 *   - ARGS.mode === 'minimax'     → MiniMax con retry; fallback hash si falla.
 *   - ARGS.mode === 'auto'        → MiniMax si hay MINIMAX_API_KEY; si no, hash.
 *
 * El hash es `hashEmbedding` de retrieve.mjs (el MISMO que usa el retrieval
 * en modo degradado) → consistencia perfecta query↔chunk.
 */
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
 * DO UPDATE). Devuelve 'inserted' | 'updated' usando el truco xmax:
 * PostgreSQL marca xmax=0 en filas insertadas por esta transacción.
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

/**
 * Consulta los sources YA indexados en la tabla (para --solo-faltantes).
 */
async function getIndexedSources(client) {
  const { rows } = await client.query(`SELECT DISTINCT source FROM ${CONFIG.table}`);
  return new Set(rows.map((r) => r.source));
}

// ==========================================
// ORQUESTACIÓN PRINCIPAL
// ==========================================

async function main() {
  console.log('🚀 RAG Indexer TODOS - corpus completo (sin borrar datos)');
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log(`Modo embeddings: ${ARGS.mode} (${ARGS.mode === 'hash' ? 'hash semántico-ligero' : ARGS.mode === 'minimax' ? 'MiniMax + fallback hash' : 'auto: MiniMax si hay key, si no hash'})`);
  console.log(`Dims: ${CONFIG.embeddingDimensions} (compatible vector(${CONFIG.embeddingDimensions}))`);
  console.log(`Modo: ${ARGS.dryRun ? 'DRY-RUN (sin BD/API)' : ARGS.soloFaltantes ? 'SOLO FALTANTES (añade sin tocar existentes)' : 'indexación real (add/update, sin delete)'}`);
  if (ARGS.limit) console.log(`Límite de documentos: ${ARGS.limit}`);
  if (ARGS.only) console.log(`Catálogo único: ${ARGS.only}`);
  console.log('');

  const sources = CONFIG.sources.filter((s) => !ARGS.only || s.includes(ARGS.only));

  // ── DRY-RUN ─────────────────────────────────────────────────────────────
  if (ARGS.dryRun) {
    console.log('🔬 DRY-RUN: validando chunking sin escribir en BD ni llamar a MiniMax...\n');
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

  // --solo-faltantes: detectar sources ya presentes → solo indexar los que faltan
  let sourcesFaltantes = null;
  if (ARGS.soloFaltantes) {
    const indexed = await getIndexedSources(client);
    const faltantes = sources.filter((s) => !indexed.has(s));
    console.log(`🔎 --solo-faltantes: ${indexed.size} sources ya indexados; ${faltantes.length} pendientes`);
    sourcesFaltantes = faltantes;
  }
  const fuentesAProcesar = sourcesFaltantes ?? sources;

  if (fuentesAProcesar.length === 0) {
    console.log('✅ Nada que indexar (todos los catálogos ya presentes en rag_vectors_v2).');
    await client.end();
    process.exit(0);
  }

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  let docCount = 0;
  let embeddingCalls = 0;

  for (const sourceFile of fuentesAProcesar) {
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

    let fileInserted = 0;
    let fileUpdated = 0;
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
          const result = await upsertChunk(client, chunk, embedding);
          if (result === 'inserted') {
            fileInserted++;
            totalInserted++;
          } else {
            fileUpdated++;
            totalUpdated++;
          }
          fileChunks++;
          process.stdout.write(`   . ${fileChunks} chunks (doc ${docCount + 1}): ${chunk.id}\r`);
          // Rate limit si se usa MiniMax real; con hash no hace falta esperar
          if (ARGS.mode === 'minimax' || (ARGS.mode === 'auto' && process.env.MINIMAX_API_KEY)) {
            await sleep(CONFIG.rateLimitMs);
          }
        } catch (err) {
          console.error(`\n❌ Error indexando ${chunk.id}: ${err.message}`);
          totalErrors++;
          if (err instanceof RateLimitError) {
            console.warn(`   ⏳ Pausa extendida por rate limit (${CONFIG.retryBackoffMs * 3}ms)`);
            await sleep(CONFIG.retryBackoffMs * 3);
          }
        }
      }

      docCount++;
    }

    console.log(`\n   ✅ ${fileChunks} chunks (${fileInserted} nuevos + ${fileUpdated} actualizados) de ${sourceFile}`);
    if (ARGS.limit && docCount >= ARGS.limit) {
      console.log(`\n🔒 Límite alcanzado (--limit=${ARGS.limit}). Deteniendo.`);
      break;
    }
  }

  await client.end();

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN INDEXER TODOS:');
  console.log(`   Documentos procesados: ${docCount}`);
  console.log(`   Chunks AÑADIDOS (nuevos): ${totalInserted}`);
  console.log(`   Chunks ACTUALIZADOS: ${totalUpdated}`);
  console.log(`   Errores: ${totalErrors}`);
  console.log(`   Fuentes: ${fuentesAProcesar.length}`);
  console.log(`   Tabla: ${CONFIG.table} (vector(${CONFIG.embeddingDimensions}))`);
  console.log(`   Embeddings: ${ARGS.mode === 'hash' ? 'hash semántico-ligero (sin API)' : 'MiniMax/hash'} | llamadas: ${embeddingCalls}`);
  console.log('');

  // Nota importante sobre la consistencia query↔chunk en modo degradado
  if (ARGS.mode === 'hash' || !process.env.MINIMAX_API_KEY) {
    console.log('ℹ️  Modo hash: el retrieval usa el MISMO algoritmo (tokenización español + bigramas + trigramas + IDF),');
    console.log('   así que las queries y los chunks quedan en el mismo espacio vectorial (1536 dims, [0,1]).');
    console.log('   Los chunks preexistentes se actualizaron in-place con el nuevo hash (sin borrar ids).');
  }

  if (totalErrors === 0) {
    console.log('✅ INDEXACIÓN COMPLETADA EXITOSAMENTE');
    process.exit(0);
  } else {
    console.log('⚠️  INDEXACIÓN COMPLETADA CON ERRORES');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});
