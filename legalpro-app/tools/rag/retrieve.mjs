#!/usr/bin/env node
/**
 * RAG Retriever - Búsqueda híbrida (semántica + full-text) para LegalPro
 *
 * Realiza búsqueda en la base vectorial pgvector combinando dos señales:
 *
 *   1. SEMÁNTICA: similitud coseno del embedding (pgvector <=>)
 *   2. KEYWORD:   full-text de PostgreSQL con configuración 'spanish'
 *                 (to_tsvector + ts_rank + plainto_tsquery)
 *
 * El score final es una media ponderada configurable:
 *   score = weightSemantic * similitud_coseno + weightKeyword * ts_rank_normalizado
 *
 * Uso:
 *   import { retrieve, retrieveHybrid, retrieveVectorial } from './tools/rag/retrieve.mjs';
 *   const results = await retrieve('habeas corpus plazo razonable');
 *   const soloVector = await retrieveVectorial('termino tecnico legal');
 *
 * FIX 2026-08-08 (perf): retrieve() ahora reutiliza un pg.Pool singleton
 *   en lugar de abrir/crear un pg.Client nuevo por cada llamada. Cada Client
 *   nuevo paga un round-trip de TCP+TLS (~50-150ms en Railway) que se
 *   multiplica en endpoints como /jurisprudencia (1 retrieve/request) y
 *   panel-expertos (1 retrieve × N especialistas). El pool es lazy y seguro
 *   para tests (cierre con `await closeRetrievePool()`).
 *
 * FIX 2026-08-08 (perf): cache distribuido opcional (Redis) por clave
 *   estable (query+topK+threshold+filter+tabla). TTL corto configurable
 *   vía RAG_RETRIEVE_CACHE_TTL (default 300s = 5min) para mantener
 *   coherencia cuando se reindexa el corpus. Invalida con
 *   `await invalidateRetrieveCache()` cuando se actualizan los embeddings.
 *
 * FIX 2026-08-12 (semántica degradada): hashEmbedding ahora usa
 *   tokenización español + bigramas + trigramas de caracteres + IDF léxico
 *   embebido + normalización L2 [0,1] (1536 dims, compatible vector(1536)).
 *   Así, chunks con términos legales similares obtienen similitud coseno > 0
 *   (ej. "demanda de alimentos" vs "alimentos" > 0.5) sin llamar a ninguna
 *   API. Además, cuando el embedding de la query cae al fallback hash
 *   (`fueHashFallback()`), retrieveHybrid rebalancea pesos hacia keyword
 *   (RAG_DEGRADED_WEIGHT_*) y aplica `applyKeywordBoost` (TF-IDF local de
 *   tokens+bigramas) sobre el resultado.
 *
 * FIX 2026-08-22 (precisión): exporta SINONIMOS_LEGALES + expandirConSinonimos()
 * para la expansión de queries en rag-advanced.mjs (+1 sub-query máx con
 * sinónimos legales es-PE de términos presentes en la query original).
 *
 * @version 2.3.0
 * @date 2026-08-22
 */

import pg from 'pg';
import { createHash } from 'node:crypto';

const CONFIG = {
  embeddingModel: process.env.RAG_EMBEDDING_MODEL || 'text-embedding-3-small',
  // FIX 2026-08-07: rag_vectors_v2 usa vector(1536) (MiniMax embo-01).
  // El fallback hash debe generar 1536 dims para comparar contra la columna.
  embeddingDimensions: parseInt(process.env.RAG_EMBEDDING_DIMS || '1536', 10),
  topK: 5,
  similarityThreshold: 0.75,

  // FIX 2026-08-08: cache del resultado crudo de retrieve() (antes de hybridScore).
  // TTL corto para no servir resultados obsoletos cuando se reindexa el corpus.
  // El cache del HybridScore ya existe en junior-rag-wrapper.mjs (TTL 3600s).
  retrieveCacheTTL: Math.max(0, parseInt(process.env.RAG_RETRIEVE_CACHE_TTL || '300', 10)),
  retrieveCachePrefix: process.env.RAG_RETRIEVE_CACHE_PREFIX || 'rag:retrieve:',
  // RAG_RETRIEVE_CACHE_DISABLE=1 desactiva el cache (para tests o debugging)
  retrieveCacheDisabled: process.env.RAG_RETRIEVE_CACHE_DISABLE === '1',

  // ==========================================
  // INDEXER V2 (MiniMax embo-01, 1536 dims)
  // ==========================================
  // Tabla rag_vectors_v2 creada por indexer-v2.mjs con metadata rica
  // (materia, codigo, articulo, tipo, vigente, relevancia, url).
  // Activar con: RAG_USE_V2=true (o pasar { table: 'rag_vectors_v2' })
  tableV2: 'rag_vectors_v2',
  tableV1: 'rag_vectors',
  minimaxModel: process.env.MINIMAX_EMBEDDING_MODEL || 'embo-01',
  minimaxEndpoint: process.env.MINIMAX_EMBEDDING_URL || 'https://api.minimax.io/v1/embeddings',

  // ==========================================
  // HYBRID SEARCH (BM25 full-text + vectorial)
  // ==========================================
  // Configuración de búsqueda full-text de PostgreSQL.
  // 'spanish' es la configuración de texto predefinida de PostgreSQL
  // usada para stemming/stopwords del español (ya usada en init.sql).
  ftsConfig: process.env.RAG_FTS_CONFIG || 'spanish',

  // Pesos de la combinación híbrida (deben sumar 1).
  // 0.6 semántico + 0.4 keyword: prioriza relevancia semántica pero
  // da peso a coincidencia exacta de términos técnicos legales.
  hybridWeights: {
    semantic: parseFloat(process.env.RAG_WEIGHT_SEMANTIC || '0.6'),
    keyword: parseFloat(process.env.RAG_WEIGHT_KEYWORD || '0.4')
  },

  // FIX 2026-08-12: en modo degradado (embeddings placeholder/hash) la señal
  // semántica es débil, así que se rebalancea el peso hacia la señal keyword
  // (full-text ts_rank + boost TF-IDF local). Configurable por env:
  //   RAG_DEGRADED_WEIGHT_SEMANTIC / RAG_DEGRADED_WEIGHT_KEYWORD (default 0.4/0.6)
  //   RAG_KEYWORD_BOOST=0 desactiva el boost post-query (para comparativas)
  degradedWeights: {
    semantic: parseFloat(process.env.RAG_DEGRADED_WEIGHT_SEMANTIC || '0.4'),
    keyword: parseFloat(process.env.RAG_DEGRADED_WEIGHT_KEYWORD || '0.6')
  },
  // Peso del boost TF-IDF local sobre el score final (0 = desactivado).
  // Se aplica SOLO cuando el embedding de la query cayó al fallback hash.
  keywordBoostWeight: parseFloat(process.env.RAG_KEYWORD_BOOST_WEIGHT || '0.25'),

  // Normalización del ts_rank. La doc oficial de PostgreSQL indica que
  // ts_rank NO está normalizado a [0,1]; la opción 32 (rank/(rank+1))
  // escala el resultado al rango [0,1] para poder ponderarlo contra
  // la similitud coseno. Ver https://www.postgresql.org/docs/current/textsearch-controls.html
  ftsRankNormalization: parseInt(process.env.RAG_FTS_RANK_NORMALIZATION || '32', 10)
};

// ==========================================
// EMBEDDINGS
// ==========================================

// FIX 2026-08-12: flag de modo degradado. `generateEmbedding` lo marca cuando
// el vector devuelto proviene del fallback hash (no de un proveedor real).
// `retrieveHybrid` lo lee para ajustar dinámicamente el peso keyword (TF-IDF)
// y aplicar un boost post-query cuando la señal semántica es placeholder.
//
// FIX P0-F3 (2026-08-21): el flag global mutable tenía RACE CONDITION bajo
// concurrencia (query A hash podía leer `false` seteado por query B real).
// Ahora generateEmbedding retorna { vector, esHash } y las decisiones se
// toman con el valor LOCAL de cada llamada. El global se mantiene SOLO para
// backward-compat del export fueHashFallback() (deprecado para lógica interna).
let _ultimoEmbeddingFueHash = false;

/** @deprecated Usar el `esHash` retornado por generateEmbedding. Solo para compat. */
export function fueHashFallback() {
  return _ultimoEmbeddingFueHash;
}

/**
 * Genera el embedding de un texto.
 * FIX P0-F3: retorna { vector, esHash } — sin estado global compartido.
 * @returns {Promise<{vector: number[], esHash: boolean}>}
 */
async function generateEmbedding(text, { miniMax = false } = {}) {
  // Indexer V2: MiniMax embo-01 (1536 dims) cuando la tabla v2 está activa
  if (miniMax || (process.env.RAG_USE_V2 === 'true' && process.env.MINIMAX_API_KEY)) {
    try {
      const res = await fetch(CONFIG.minimaxEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`
        },
        body: JSON.stringify({
          model: CONFIG.minimaxModel,
          texts: [text.substring(0, 8000)],
          type: 'query'
        })
      });
      if (!res.ok) throw new Error(`MiniMax error: ${res.status}`);
      const data = await res.json();
      if (data.vectors && data.vectors[0]) {
        _ultimoEmbeddingFueHash = false; // backward-compat only
        return { vector: data.vectors[0], esHash: false };
      }
      throw new Error('MiniMax embedding fallo');
    } catch (e) {
      // FIX 2026-08-07: si MiniMax falla (rate limit 1002, caída), degradar a
      // hash determinístico en lugar de lanzar error (el retrieval híbrido
      // full-text + keywords sigue funcionando).
      if (process.env.RAG_HASH_FALLBACK !== 'false') {
        _ultimoEmbeddingFueHash = true; // backward-compat only
        return { vector: hashEmbedding(text, CONFIG.embeddingDimensions || 1536), esHash: true };
      }
      throw e;
    }
  }

  if (process.env.OPENAI_API_KEY) {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: CONFIG.embeddingModel,
        input: text.substring(0, 8000)
      })
    });
    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json();
    _ultimoEmbeddingFueHash = false; // backward-compat only
    return { vector: data.data[0].embedding, esHash: false };
  }

  if (process.env.GEMINI_API_KEY) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/embedding-001',
          content: { parts: [{ text: text.substring(0, 8000) }] }
        })
      }
    );
    if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
    const data = await res.json();
    _ultimoEmbeddingFueHash = false; // backward-compat only
    return { vector: data.embedding.values, esHash: false };
  }

  // FALLBACK DETERMINÍSTICO (FIX 2026-08-07): cuando ningún proveedor de
  // embeddings está disponible (MiniMax rate-limited, Gemini suspendida, sin
  // OPENAI_API_KEY), se genera un vector 1536-dim determinístico basado en el
  // texto. FIX 2026-08-12: ahora con tokenización español + bigramas +
  // trigramas + IDF (ver hashEmbedding) para mejorar la precisión semántica
  // del modo degradado. Compatible con los placeholders ya indexados en
  // rag_vectors_v2 (rango [0,1], 1536 dims).
  _ultimoEmbeddingFueHash = true; // backward-compat only
  const fallback = hashEmbedding(text, CONFIG.embeddingDimensions || 1536);
  return { vector: fallback, esHash: true };
}

// ==========================================
// HASH EMBEDDING SEMÁNTICO-LIGERO (FIX 2026-08-12)
// ==========================================
//
// Fallback determinístico sin API externa (MiniMax rate-limited, sin
// OPENAI_API_KEY). Mejora la precisión del retrieval degradado frente al
// hash 1-token anterior:
//
//   1. Tokenización del español: lowercase, sin acentos (NFD), stopwords y
//      términos jurídicos ultra-frecuentes con IDF bajo.
//   2. Features: tokens (peso TF·IDF) + bigramas de tokens consecutivos
//      (contexto local) + trigramas de caracteres (capturan raíces
//      compartidas: "aliment-" en "alimentos"/"alimentario").
//   3. IDF léxico embebido (sin librerías): términos legales que aparecen en
//      casi todos los chunks bajan su peso; términos distintivos pesan más.
//   4. Hashing posicional FNV-1a a dims fijas (default 1536 = vector(1536)).
//   5. Normalización L2 → componentes en [0,1]; como todos los pesos son no
//      negativos, la similitud coseno de pgvector se comporta como un
//      TF-IDF coseno clásico (norma=1 → coseno = producto punto ponderado).
//
// Con este esquema, chunks con términos legales similares obtienen similitud
// coseno > 0 (p.ej. "demanda de alimentos" vs "alimentos" > 0.5), lo que
// mejora el retrieval híbrido (semántica + full-text) sin llamar a ninguna API.
// La dimensión 1536 se mantiene para compatibilidad con la columna vector(1536)
// de rag_vectors_v2 y con los placeholders ya almacenados (rango [0,1]).

// Stopwords del español (vocabulario cerrado, sin dependencias).
const STOPWORDS_ES = new Set([
  'de', 'la', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para',
  'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'mas', 'pero', 'sus', 'le',
  'ya', 'o', 'este', 'si', 'porque', 'esta', 'entre', 'cuando', 'muy', 'sin',
  'sobre', 'también', 'tambien', 'me', 'hasta', 'hay', 'donde', 'que', 'es',
  'son', 'fue', 'ser', 'tiene', 'haber', 'estar', 'está', 'estan', 'están', 'ha',
  'han', 'fue', 'era', 'fue', 'son', 'ello', 'ella', 'ellos', 'ellas', 'usted',
  'ustedes', 'nos', 'os', 'les', 'mis', 'tus', 'sus', 'su', 'mi', 'tu', 'cada',
  'uno', 'una', 'unos', 'unas', 'otro', 'otra', 'otros', 'otras', 'todo', 'toda',
  'todos', 'todas', 'cual', 'cuales', 'quien', 'quienes', 'ante', 'bajo',
  'cabe', 'contra', 'desde', 'durante', 'mediante', 'según', 'segun', 'tras',
  'tambien', 'tampoco', 'asi', 'así', 'aun', 'aún', 'bien', 'solo', 'sólo'
]);

// IDF léxico embebido: términos jurídicos que aparecen en casi todos los
// chunks del corpus legal (df alto → idf bajo). Los términos NO listados
// obtienen idf = 1.0 (máximo), por lo que los términos distintivos del
// derecho (alimentos, prescripción, desalojo, peculado…) pesan más que los
// genéricos (artículo, ley, derecho, proceso…).
const IDF_LEGAL = {
  articulo: 0.30, art: 0.30, ley: 0.32, codigo: 0.35, derecho: 0.38, norma: 0.40,
  proceso: 0.40, tribunal: 0.42, sentencia: 0.42, persona: 0.45, estado: 0.45,
  disposicion: 0.45, pena: 0.48, delito: 0.48, juez: 0.50, fiscal: 0.50,
  caso: 0.50, resolucion: 0.50, materia: 0.55, justicia: 0.55, publico: 0.55,
  general: 0.60, parte: 0.60, podra: 0.60, debera: 0.60, conforme: 0.65,
  presente: 0.65, forma: 0.65, fecha: 0.65, pleno: 0.70, sala: 0.70,
  corte: 0.70, suprema: 0.70, constitucional: 0.72, peru: 0.72
};

/**
 * Normaliza texto: lowercase + quita acentos (NFD) + conserva solo
 * alfanuméricos (incluye ñ/ü) + colapsa espacios.
 */
export function normalizarEspanol(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñü]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokeniza texto en español para el hash embedding: palabras de >= 2 chars
 * excluyendo stopwords. Devuelve el array de tokens (preserva orden y
 * duplicados para bigramas y frecuencias).
 */
export function tokenizarEspanol(text) {
  const norm = normalizarEspanol(text);
  if (!norm) return [];
  return norm.split(' ').filter((t) => t.length >= 2 && !STOPWORDS_ES.has(t));
}

// ==========================================
// SINÓNIMOS LEGALES (FIX 2026-08-22 — precisión RAG)
// ==========================================
//
// El corpus legal peruano usa términos con variación léxica real (la demanda
// se llama "requerimiento" en sede administrativa; el despido, "cese"; etc.).
// El mapa alimenta la expansión de queries en rag-advanced.mjs
// (descomponerQuery agrega MÁXIMO +1 sub-query con los sinónimos de los
// términos presentes en la query original).
//
// Claves en español normalizado SIN acentos (la detección usa
// normalizarEspanol); el reemplazo sobre el texto original es tolerante a
// acentos vía regexDeTermino().
export const SINONIMOS_LEGALES = {
  demanda: ['requerimiento', 'petitorio'],
  sentencia: ['fallo', 'ejecutoria'],
  despido: ['cese', 'termino de contrato'],
  alimentos: ['pension alimenticia'],
  prescripcion: ['caducidad'],
  nulidad: ['invalidacion', 'nulidad absoluta'],
  embargo: ['secuestro conservativo']
};

/**
 * Construye una RegExp tolerante a acentos para un término en clave normal:
 * vocales → clase [letra|acentuada], n → [nñ], con fronteras no-palabra
 * custom (los \b nativos rompen con caracteres acentuados) y sufijo flexible
 * para capturar derivadas ("demanda" matchea "demandas", "demanda").
 * @param {string} termino - Término sin acentos (clave de SINONIMOS_LEGALES)
 */
function regexDeTermino(termino) {
  const clases = { a: '[aáà]', e: '[eéè]', i: '[iíì]', o: '[oóò]', u: '[uúùü]', n: '[nñ]' };
  const cuerpo = [...termino].map((ch) => clases[ch] || ch).join('');
  const B = '[a-z0-9áéíóúñü]';
  return new RegExp(`(?<!${B})${cuerpo}${B}*(?!${B})`, 'i');
}

/**
 * Expande una query reemplazando los términos con sinónimos registrados.
 *
 * Reglas:
 *   - Solo reemplaza términos que APARECEN en la query original (detección
 *     insensible a acentos vía normalizarEspanol).
 *   - Reemplaza la PRIMERA ocurrencia de cada término presente.
 *   - Si ningún término del mapa aparece, retorna null (no hay sub-query extra).
 *
 * @param {string} query - Query original del usuario
 * @returns {string|null} Query expandida, o null si no aplica
 */
export function expandirConSinonimos(query) {
  const q = String(query || '').trim();
  if (!q) return null;
  const tokens = new Set(normalizarEspanol(q).split(' ').filter(Boolean));
  let salida = q;
  let cambio = false;
  for (const [termino, sinonimos] of Object.entries(SINONIMOS_LEGALES)) {
    if (!tokens.has(termino)) continue;
    const re = regexDeTermino(termino);
    if (!re.test(salida)) continue;
    salida = salida.replace(re, sinonimos.join(' o '));
    cambio = true;
  }
  return cambio ? salida : null;
}

/** IDF ligero de un token (1.0 para términos distintivos, < 1 para genéricos). */
function idfDeTermino(token) {
  const v = IDF_LEGAL[token];
  return typeof v === 'number' ? v : 1.0;
}

/** Peso TF: 1 + log(frecuencia) (frecuencia 1 → peso 1, frecuencia 3 → ~2.1). */
function pesoTF(frecuencia) {
  return 1 + Math.log(frecuencia || 1);
}

/** FNV-1a hash (32-bit) de un string. */
function hashFNV1a(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Stemming ligero SIN librerías para el hash embedding.
 *
 * Normaliza variantes flexivas/derivativas comunes del español legal a una
 * raíz aproximada, para que "alimentos"/"alimentaria"/"alimenticia" → "aliment"
 * y "prescripción"/"prescriptivo" compartan la misma posición de token.
 *
 * Reglas (conservadoras, solo si queda raíz >= 4):
 *   - quitar -aria/-ario  (alimentaria → aliment)
 *   - quitar -mente       (legalmente → legal)
 *   - quitar -s/-es plural (alimentos → alimento, casaciones → casacion)
 *   - quitar -dad/-idad   (nulidad → nuli, solidaridad → solidari)
 *
 * IMPORTANTE: se aplica a la MISMA función tanto en queries como en chunks
 * (hashEmbedding es el único punto), por lo que la consistencia del espacio
 * vectorial se mantiene aunque la raíz no sea lingüísticamente perfecta.
 */
export function stemLigeroEspanol(token) {
  if (typeof token !== 'string' || token.length < 5) return token;
  let s = token;

  if (s.length >= 9 && s.endsWith('mente')) s = s.slice(0, -5);   // juridicamente → juridic
  if (s.length >= 7 && s.endsWith('aria')) s = s.slice(0, -4);    // alimentaria → aliment
  else if (s.length >= 7 && s.endsWith('ario')) s = s.slice(0, -4); // alimentario → aliment
  if (s.length >= 6 && (s.endsWith('idad') || s.endsWith('edad'))) s = s.slice(0, -4); // nulidad → nuli

  // Plural: -es / -s sobre vocal (deja raíz >= 4)
  if (s.length >= 5 && s.endsWith('es')) s = s.slice(0, -2);      // casaciones → casacion
  else if (s.length >= 5 && /[aeiouáéíóú]s$/.test(s)) s = s.slice(0, -1); // alimentos → alimento

  // Vocal final de género (-o/-a/-e) para unificar masculino/femenino:
  // alimentos → aliment, demanda → demand, precario → precari.
  // Solo si la raíz resultante queda >= 4 (conservador con palabras cortas).
  if (s.length >= 5 && /[aeiouáéíóú]$/.test(s)) s = s.slice(0, -1);

  return s.length >= 4 ? s : token;
}

/**
 * Genera un embedding determinístico (hash) de dimensión fija a partir del
 * texto, con tokenización español + stemming ligero + bigramas + trigramas
 * + IDF léxico embebido.
 *
 * - dims default 1536 → compatible con vector(1536) de rag_vectors_v2.
 * - Todos los pesos son no negativos y el vector se normaliza por L2:
 *   componentes en [0,1] y coseno = producto punto ponderado (TF-IDF coseno).
 * - Determinístico: el mismo texto produce SIEMPRE el mismo vector.
 */
export function hashEmbedding(text, dims = 1536) {
  const vec = new Array(dims).fill(0);
  const tokens = tokenizarEspanol(text);
  const raices = tokens.map(stemLigeroEspanol);

  if (tokens.length === 0) {
    // Texto sin tokens útiles (solo stopwords/números): sesgo determinístico
    // para que no sea un vector cero (evita coseno indefinido en pgvector).
    vec[hashFNV1a('legalpro:empty') % dims] = 1.0;
    return vec;
  }

  // Frecuencias por raíz (para TF).
  const freqs = new Map();
  for (const r of raices) freqs.set(r, (freqs.get(r) || 0) + 1);

  // 1) TOKENS (raíz): peso TF·IDF en posición derivada de la raíz.
  for (const [r, f] of freqs) {
    const pos = hashFNV1a('T:' + r) % dims;
    vec[pos] += pesoTF(f) * idfDeTermino(r);
  }

  // 2) BIGRAMAS de tokens consecutivos (sobre raíces): contexto local.
  for (let i = 0; i + 1 < raices.length; i++) {
    const a = raices[i];
    const b = raices[i + 1];
    const idf = (idfDeTermino(a) + idfDeTermino(b)) / 2;
    const pos = hashFNV1a('B:' + a + '|' + b) % dims;
    vec[pos] += 0.7 * idf;
  }

  // 3) TRIGRAMAS de caracteres de la raíz: capturan raíces morfológicas
  //    compartidas ("aliment" aparece en "alimentos", "alimentaria"…).
  for (const r of raices) {
    if (r.length < 3) continue;
    const idf = idfDeTermino(r);
    const base = 0.4 * idf;
    for (let i = 0; i + 3 <= r.length; i++) {
      const tri = r.slice(i, i + 3);
      const pos = hashFNV1a('C:' + tri) % dims;
      vec[pos] += base;
    }
  }

  // 4) Normalización L2 → norma 1. Componentes no negativos ⇒ [0,1].
  let norm = 0;
  for (let i = 0; i < dims; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm === 0) {
    vec[hashFNV1a('legalpro:empty') % dims] = 1.0;
    return vec;
  }
  for (let i = 0; i < dims; i++) vec[i] /= norm;
  return vec;
}

/**
 * Similitud coseno entre dos vectores (para tests y debugging sin pgvector).
 */
export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  return den === 0 ? 0 : dot / den;
}

// ==========================================
// CONNECTION POOL (FIX 2026-08-08 perf)
// ==========================================
//
// Reutilizar un pg.Pool evita abrir/crear un pg.Client nuevo por cada
// retrieve() (round-trip TCP+TLS ~50-150ms en Railway). Es lazy: la primera
// llamada crea el pool; las siguientes lo reutilizan. Tests pueden cerrarlo
// con `await closeRetrievePool()` para shutdown limpio.
//
// SSL: reutilizamos la misma política que db.js — PGSSLMODE=disable desactiva
// TLS, el resto exige cifrado (con rejectUnauthorized=false salvo verify-*).
let _pool = null;
function getPool() {
  if (_pool) return _pool;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not configured');
  }
  _pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable'
      ? false
      : { rejectUnauthorized: false },
    // Pool pequeño: el retrieve es CPU-bound (tsvector+embedding), no
    // necesita 20 conexiones como el backend principal. 5 evita contention
    // con db.js en Railway free tier (límite ~20 conexiones total).
    max: parseInt(process.env.RAG_RETRIEVE_POOL_SIZE || '5', 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 8_000,
    query_timeout: 8_000,
  });
  _pool.on('error', (err) => {
    console.error('[retrieve] Pool error:', err.message);
  });
  return _pool;
}

/**
 * Cierra el pool singleton (tests / shutdown graceful).
 */
export async function closeRetrievePool() {
  if (_pool) {
    await _pool.end().catch(() => {});
    _pool = null;
  }
}

// ==========================================
// CACHE DISTRIBUIDO DE RETRIEVE (FIX 2026-08-08)
// ==========================================
//
// Cachea el resultado crudo de retrieveHybrid/retrieveVectorial (antes del
// hybridScore). El hybridScore se ejecuta DESPUÉS del retrieve, en el wrapper,
// así que cachear el retrieve reduce trabajo de DB y de embedding generation.
//
// La clave es estable: query (lowercase+trim) + topK + threshold + filter
// ordenado + tabla. NO incluye weights porque la rama SQL los usa directo.
// Los embeddings placeholder (hash) son determinísticos para el mismo texto,
// así que cachear es seguro incluso en modo degradado.
let _redisModule = null;
async function getRedisClient() {
  if (CONFIG.retrieveCacheDisabled) return null;
  if (_redisModule !== null) return _redisModule; // null = ya intentó y falló
  if (!process.env.REDIS_URL) {
    _redisModule = null;
    return null;
  }
  try {
    const mod = await import('ioredis');
    _redisModule = (mod.default || mod.Redis || mod);
    return _redisModule;
  } catch {
    _redisModule = null;
    return null;
  }
}

let _redisClient = null;
async function getRedis() {
  if (CONFIG.retrieveCacheDisabled) return null;
  if (_redisClient && _redisClient.status === 'ready') return _redisClient;
  if (_redisClient) {
    // Reconectar si estaba caído (status: 'reconnecting'|'close'|'end')
    try { await _redisClient.quit(); } catch { /* ignore */ }
    _redisClient = null;
  }
  const Redis = await getRedisClient();
  if (!Redis || !process.env.REDIS_URL) return null;
  try {
    _redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: false,
      enableOfflineQueue: false,
    });
    _redisClient.on('error', () => { /* silencioso — fail-open */ });
    return _redisClient;
  } catch {
    return null;
  }
}

function buildRetrieveCacheKey(query, options, table) {
  // Ordenar filter keys para que {a:1,b:2} y {b:2,a:1} generen la MISMA clave.
  const filterStr = options.filter
    ? JSON.stringify(Object.keys(options.filter).sort().reduce((acc, k) => {
        acc[k] = options.filter[k];
        return acc;
      }, {}))
    : '{}';
  const norm = [
    'q', String(query || '').toLowerCase().trim().substring(0, 500),
    'k', options.topK ?? CONFIG.topK,
    't', options.threshold ?? CONFIG.similarityThreshold,
    's', options.strategy || 'hybrid',
    'ws', options.weightSemantic ?? CONFIG.hybridWeights.semantic,
    'wk', options.weightKeyword ?? CONFIG.hybridWeights.keyword,
    'f', filterStr,
    'tab', table,
    // FIX 2026-08-22 (LOW): discriminar modo embedding vs hash-fallback para
    // que un cache generado con embeddings reales no se sirva en modo degradado
    // (y viceversa). `table` ya está en la clave ('tab').
    // TODO: idealmente incluir el `esHash` REAL del embedding de esta query,
    // pero generateEmbedding() corre DESPUÉS del cache lookup — no disponible
    // aquí. El flag env es el proxy más barato y determinístico.
    'm', process.env.RAG_FORCE_HASH === 'true' ? 'hash' : 'emb',
  ].join('|');
  // Hash determinístico (mismo patrón que redis-cache.mjs)
  return CONFIG.retrieveCachePrefix + createHash('sha256').update(norm).digest('hex');
}

// IMPORTANTE: buildRetrieveCacheKey es sync (usa createHash importado arriba)
// para minimizar latencia del cache lookup. Solo se llama 1 vez por retrieve.

async function getCachedRetrieve(key) {
  if (CONFIG.retrieveCacheDisabled) return null;
  if (CONFIG.retrieveCacheTTL <= 0) return null;
  const client = await getRedis();
  if (!client || client.status !== 'ready') return null;
  try {
    const v = await client.get(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

async function setCachedRetrieve(key, value) {
  if (CONFIG.retrieveCacheDisabled) return;
  if (CONFIG.retrieveCacheTTL <= 0) return;
  const client = await getRedis();
  if (!client || client.status !== 'ready') return;
  try {
    await client.setex(key, CONFIG.retrieveCacheTTL, JSON.stringify(value));
  } catch {
    /* fail-open */
  }
}

/**
 * Invalida todas las claves del cache de retrieve (usar tras reindexar corpus).
 * Implementa SCAN no KEYS para no bloquear Redis en producción.
 */
export async function invalidateRetrieveCache() {
  if (CONFIG.retrieveCacheDisabled) return 0;
  const client = await getRedis();
  if (!client || client.status !== 'ready') return 0;
  try {
    let cursor = '0';
    let deleted = 0;
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', `${CONFIG.retrieveCachePrefix}*`, 'COUNT', 200);
      cursor = next;
      if (keys.length > 0) deleted += await client.del(...keys);
    } while (cursor !== '0');
    return deleted;
  } catch {
    return 0;
  }
}

// ==========================================
// RETRIEVAL
// ==========================================

/**
 * Normaliza los pesos híbridos a sumatoria 1 (evita pesos > 1 por config).
 *
 * @param {number} semantic - Peso de la señal semántica
 * @param {number} keyword - Peso de la señal keyword/full-text
 * @returns {{ semantic: number, keyword: number }} Pesos normalizados
 */
function normalizeWeights(semantic, keyword) {
  const total = semantic + keyword;
  if (!Number.isFinite(total) || total <= 0) {
    return { semantic: 0.6, keyword: 0.4 };
  }
  return { semantic: semantic / total, keyword: keyword / total };
}

/**
 * Construye el filtro SQL por metadata (compartido por ambas estrategias).
 *
 * Soporta metadata rica del Indexer V2:
 *   - tipo: 'codigo' | 'articulo' | 'norma' | 'jurisprudencia' | 'resolucion' | ...
 *   - materia: 'penal' | 'civil' | 'laboral' | 'tributario' | ...
 *   - codigo: id de la norma (ej: 'cp', 'cc', 'cpc', 'ncpp')
 *   - articulo: número de artículo (ej: '473')
 *   - vigente: true | false
 *   - relevancia: 'ALTA' | 'MEDIA' | 'BAJA'
 *   - source: archivo fuente (ej: 'codigos-leyes.json')
 *   - url: fuente oficial (parcial)
 *
 * @param {object} filter - Filtros por metadata (ej: {materia: 'penal', codigo: 'cpc'})
 * @param {Array} params - Array de parámetros existente (se muta)
 * @returns {string} Clausula WHERE (vacía si no hay filtros)
 */
function buildFilterWhere(filter, params) {
  const whereClauses = [];
  const addEq = (key, value) => {
    params.push(value);
    whereClauses.push(`metadata->>'${key}' = $${params.length}`);
  };

  if (filter.tipo) addEq('tipo', filter.tipo);
  if (filter.materia) addEq('materia', filter.materia);
  if (filter.codigo) addEq('codigo', filter.codigo);
  if (filter.articulo) addEq('articulo', String(filter.articulo));
  if (filter.vigente != null) addEq('vigente', String(filter.vigente));
  if (filter.relevancia) addEq('relevancia', String(filter.relevancia).toUpperCase());
  if (filter.source) {
    params.push(filter.source);
    whereClauses.push(`source = $${params.length}`);
  }
  if (filter.url) {
    params.push(filter.url);
    whereClauses.push(`metadata->>'url' LIKE $${params.length}`);
  }
  // Filtro texto-libre dentro de metadata (ej: buscar por nombre de norma)
  if (filter.search_metadata) {
    params.push(`%${filter.search_metadata}%`);
    whereClauses.push(`metadata::text ILIKE $${params.length}`);
  }
  return whereClauses.length > 0 ? `AND ${whereClauses.join(' AND ')}` : '';
}

/**
 * Mapea filas SQL a la estructura de resultado estándar.
 *
 * @param {Array} rows - Filas de PostgreSQL
 * @param {object} labels - Etiquetas de columnas (similarity, semantic, keyword)
 * @returns {Array} Resultados con rank, id, source, content, metadata, similarity y breakdown
 */
function mapRows(rows, labels) {
  const { similarity: simCol = 'similarity', semantic: semCol = null, keyword: kwCol = null } = labels;
  return rows.map((row, idx) => {
    const result = {
      rank: idx + 1,
      id: row.id,
      source: row.source,
      content: row.content,
      metadata: row.metadata,
      similarity: parseFloat(row[simCol].toFixed(4))
    };
    // Breakdown para auditoría/trazabilidad (opcional)
    if (semCol && row[semCol] != null) result.semanticSimilarity = parseFloat(row[semCol].toFixed(4));
    if (kwCol && row[kwCol] != null) result.keywordScore = parseFloat(row[kwCol].toFixed(4));
    if (row.score != null) result.score = parseFloat(row.score.toFixed(4));
    return result;
  });
}

/**
 * Boost TF-IDF local (sin BD): re-rankea los chunks retornados por el SQL
 * con una similitud keyword ligera entre la query y el contenido del chunk.
 *
 * Por qué: en modo degradado (embeddings hash placeholder) la señal semántica
 * es débil, y aunque el SQL ya combina ts_rank (full-text de PostgreSQL), un
 * boost local con tokenización español + bigramas refuerza la coincidencia de
 * términos técnicos legales que el embedding hash puede sub-pesar.
 *
 * Fórmula (configurable):
 *   final = original * (1 - w) + keywordLocal * w
 *   con w = CONFIG.keywordBoostWeight (default 0.25)
 *   keywordLocal = overlap de tokens + bigramas entre query y chunk (0..1)
 *
 * NO rompe el retrieval: solo recalcula `similarity` (y añade breakdown
 * `keyword_boost`) conservando el resto de campos del chunk.
 *
 * @param {Array} results - Chunks de retrieveHybrid/retrieveVectorial
 * @param {string} query - Query original del usuario
 * @returns {Array} Mismos chunks con similarity re-rankeada y breakdown
 */
export function applyKeywordBoost(results, query) {
  if (!Array.isArray(results) || results.length === 0) return results;
  const w = CONFIG.keywordBoostWeight;
  if (!(w > 0)) return results;

  const queryTokens = tokenizarEspanol(query);
  if (queryTokens.length === 0) return results;

  // Bigramas de la query (contexto local de 2 términos).
  const queryBigrams = [];
  for (let i = 0; i + 1 < queryTokens.length; i++) {
    queryBigrams.push(`${queryTokens[i]} ${queryTokens[i + 1]}`);
  }

  const totalTerms = queryTokens.length;
  const totalBigrams = queryBigrams.length;

  return results.map((chunk) => {
    const contentTokens = tokenizarEspanol(chunk.content);
    const contentSet = new Set(contentTokens);
    const tokenHits = queryTokens.filter((t) => contentSet.has(t)).length;

    // Bigramas: usar el Set de bigramas del contenido.
    const contentBigramSet = new Set();
    for (let i = 0; i + 1 < contentTokens.length; i++) {
      contentBigramSet.add(`${contentTokens[i]} ${contentTokens[i + 1]}`);
    }
    const bigramHits = queryBigrams.filter((b) => contentBigramSet.has(b)).length;

    // keywordLocal: 70% tokens + 30% bigramas (misma filosofía que hybridScore
    // del wrapper, pero a nivel de chunk completo y sin cortar en stopwords).
    const keywordLocal = (totalTerms > 0 ? tokenHits / totalTerms : 0) * 0.7
      + (totalBigrams > 0 ? bigramHits / totalBigrams : 0) * 0.3;

    const original = typeof chunk.similarity === 'number' ? chunk.similarity : 0;
    const boosted = original * (1 - w) + keywordLocal * w;

    // FIX P0-F1 (2026-08-21): NO sobrescribir `similarity` con el score
    // inflado por boost léxico. El threshold debe evaluarse contra la señal
    // semántica ORIGINAL; el score combinado va en `boosted_score` (solo para
    // ranking en modo degradado). Así un chunk con similitud semántica 0.05 +
    // overlap léxico alto NO puede presentarse como "jurisprudencia verificada".
    return {
      ...chunk,
      similarity: Number(original.toFixed(4)),
      boosted_score: Number(boosted.toFixed(4)),
      score: Number(boosted.toFixed(4)),
      keyword_boost: Number(keywordLocal.toFixed(4)),
      keyword_boost_breakdown: {
        token_hits: tokenHits,
        token_total: totalTerms,
        bigram_hits: bigramHits,
        bigram_total: totalBigrams
      }
    };
  }).sort((a, b) => (b.boosted_score ?? b.similarity) - (a.boosted_score ?? a.similarity));
}

/**
 * Búsqueda HÍBRIDA: combina similitud coseno (semántica) con full-text
 * de PostgreSQL (ts_rank, config 'spanish') para mejor precisión en
 * términos técnicos legales que el embedding semántico puede sub-pesar.
 *
 * Score final = weightSemantic * coseno + weightKeyword * ts_rank_normalizado
 *
 * @param {string} query - Consulta del usuario
 * @param {object} options - Opciones de búsqueda
 * @param {number} options.topK - Número de resultados (default CONFIG.topK)
 * @param {number} options.threshold - Umbral mínimo de similitud coseno para la rama OR (default CONFIG.similarityThreshold)
 * @param {object} options.filter - Filtros por metadata (ej: {tipo: 'codigo_legal', materia: 'penal'})
 * @param {number} options.weightSemantic - Peso semántico (default CONFIG.hybridWeights.semantic)
 * @param {number} options.weightKeyword - Peso keyword (default CONFIG.hybridWeights.keyword)
 * @param {string} options.table - Tabla vectorial (default: rag_vectors_v2 si RAG_USE_V2, si no rag_vectors)
 * @returns {Promise<Array>} - Chunks relevantes con score híbrido
 */
export async function retrieveHybrid(query, options = {}) {
  const {
    topK = CONFIG.topK,
    threshold = CONFIG.similarityThreshold,
    filter = {},
    weightSemantic = CONFIG.hybridWeights.semantic,
    weightKeyword = CONFIG.hybridWeights.keyword,
    table = process.env.RAG_USE_V2 === 'true' ? CONFIG.tableV2 : CONFIG.tableV1
  } = options;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new Error('query debe ser un texto no vacío');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not configured');
  }

  const ftsConfig = CONFIG.ftsConfig;
  const normalization = CONFIG.ftsRankNormalization;

  // FIX 2026-08-08: cache distribuido opcional (TTL corto). La clave es estable
  // por (query, topK, threshold, strategy, weights, filter, table) — NO incluye
  // el embedding crudo (1536 floats) para mantener la clave compacta.
  // FIX 2026-08-22 (CRITICAL): buildRetrieveCacheKey es sync puro — llamada
  // directa SIN await (un await sobre un string era inocuo, pero inducía a
  // error y provocó el bug "[object Promise]" en retrieveVectorial).
  const cacheKey = buildRetrieveCacheKey(query, { topK, threshold, strategy: 'hybrid', weightSemantic, weightKeyword, filter }, table);
  const cached = await getCachedRetrieve(cacheKey);
  if (cached) {
    return cached;
  }

  // FIX 2026-08-08 (perf): pg.Pool singleton en lugar de pg.Client nuevo.
  // Reutiliza conexiones TCP+TLS; amortiza ~50-150ms por retrieve en Railway.
  const pool = getPool();

  // FIX 2026-08-12: en modo degradado (embedding hash placeholder) se usa la
  // configuración degradedWeights (default 0.4 semántico / 0.6 keyword) para
  // rebalancear hacia el full-text + boost TF-IDF, que es más fiable que la
  // señal semántica débil. Con proveedor real se mantiene hybridWeights.
  let weights = normalizeWeights(weightSemantic, weightKeyword);
  // FIX P0-F3 (2026-08-21): { vector, esHash } local — sin race condition.
  const { vector: queryEmbedding, esHash } = await generateEmbedding(query, { miniMax: table === CONFIG.tableV2 });
  if (esHash) {
    weights = normalizeWeights(CONFIG.degradedWeights.semantic, CONFIG.degradedWeights.keyword);
  }
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  // 2. Parámetros: $1 vector, $2 query full-text, $3 umbral coseno, $4 LIMIT
  //    (los filtros se agregan después: $5, $6, ...)
  const params = [vectorStr, query, threshold, topK];
  const whereSQL = buildFilterWhere(filter, params);

  // 3. Búsqueda híbrida:
  //    - Rama full-text: to_tsvector('spanish') @@ plainto_tsquery('spanish', $2)
  //    - Rama semántica: 1 - (embedding <=> $1::vector) > $3  (OR, rescata términos
  //      que el full-text no matchea, p.ej. stopwords o sinónimos semánticos)
  //    - ts_rank con normalización CONFIG.ftsRankNormalization (32 => [0,1])
  const sql = `
    SELECT
      id,
      source,
      content,
      metadata,
      (${weights.semantic} * (1 - (embedding <=> $1::vector))) +
      (${weights.keyword} * ts_rank(to_tsvector('${ftsConfig}', content), plainto_tsquery('${ftsConfig}', $2), ${normalization}))
      AS score,
      1 - (embedding <=> $1::vector) AS semantic_similarity,
      ts_rank(to_tsvector('${ftsConfig}', content), plainto_tsquery('${ftsConfig}', $2), ${normalization}) AS keyword_score
    FROM ${table}
    WHERE (
        to_tsvector('${ftsConfig}', content) @@ plainto_tsquery('${ftsConfig}', $2)
        OR 1 - (embedding <=> $1::vector) > $3
      )
      ${whereSQL}
    ORDER BY score DESC
    LIMIT $4
  `;

  const { rows } = await pool.query(sql, params);
  let results = mapRows(rows, { similarity: 'score', semantic: 'semantic_similarity', keyword: 'keyword_score' });

  // FIX 2026-08-12: en modo degradado, re-rankeo con boost TF-IDF local
  // (tokens + bigramas) para reforzar términos técnicos legales. El boost es
  // determinístico (mismo texto → mismo resultado), así que cachear tras el
  // boost es seguro. Con proveedor real, results queda sin modificar.
  //
  // FIX P0-F1/F2 (2026-08-21): applyKeywordBoost ya NO sobrescribe `similarity`
  // (va a `boosted_score`). Post-filtro estricto:
  //   - Pasa `similarity >= threshold` (señal semántica real) → chunk normal.
  //   - En modo degradado, pasa `boosted_score >= threshold` → chunk DEGRADED
  //     (nunca presentable como "jurisprudencia verificada").
  //   - Lo demás se descarta.
  if (esHash) {
    results = applyKeywordBoost(results, query);
  }

  results = results.filter((r) => {
    if ((r.similarity ?? 0) >= threshold) return true;
    if (esHash && (r.boosted_score ?? 0) >= threshold) {
      r.degraded = true; // solo superó el umbral vía boost léxico
      return true;
    }
    return false;
  });

  // FIX P0-F2/F3 (2026-08-21): si la QUERY se embedió con hash, TODA la
  // similitud coseno es cross-space potencialmente inválida (corpus puede
  // estar indexado con embo-01). Marcar todos los chunks como degraded para
  // que downstream (wrapper/ai.js) reporte rag_verificado:false.
  // TODO(P1): añadir columna embedding_es_hash a rag_vectors_v2 + filtro SQL
  // para comparar solo contra chunks del mismo espacio vectorial.
  if (esHash) {
    for (const r of results) r.degraded = true;
  }

  // Cache best-effort (fire-and-forget, NO await para no añadir latencia)
  setCachedRetrieve(cacheKey, results).catch(() => {});

  return results;
}

/**
 * Búsqueda SOLO VECTORIAL (similitud coseno pura).
 * Se mantiene para compatibilidad y para casos donde se requiera
 * exclusivamente la señal semántica.
 *
 * @param {string} query - Consulta del usuario
 * @param {object} options - Opciones de búsqueda
 * @param {number} options.topK - Número de resultados (default CONFIG.topK)
 * @param {number} options.threshold - Umbral de similitud (default CONFIG.similarityThreshold)
 * @param {object} options.filter - Filtros por metadata (ej: {tipo: 'codigo_legal', materia: 'penal'})
 * @param {string} options.table - Tabla vectorial (default: rag_vectors_v2 si RAG_USE_V2, si no rag_vectors)
 * @returns {Promise<Array>} - Chunks relevantes con similitud coseno
 */
export async function retrieveVectorial(query, options = {}) {
  const {
    topK = CONFIG.topK,
    threshold = CONFIG.similarityThreshold,
    filter = {},
    table = process.env.RAG_USE_V2 === 'true' ? CONFIG.tableV2 : CONFIG.tableV1
  } = options;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new Error('query debe ser un texto no vacío');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not configured');
  }

  // FIX 2026-08-08 (perf): cache distribuido + pg.Pool singleton (mismo patrón
  // que retrieveHybrid) — ver comentarios arriba para justificación detallada.
  const cacheKey = buildRetrieveCacheKey(query, { topK, threshold, strategy: 'vectorial', filter }, table);
  const cached = await getCachedRetrieve(cacheKey);
  if (cached) {
    return cached;
  }

  const pool = getPool();

  // 1. Generar embedding de la query
  // FIX P0-F3: { vector, esHash } local — sin race condition.
  const { vector: queryEmbedding, esHash } = await generateEmbedding(query, { miniMax: table === CONFIG.tableV2 });
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  // 2. Parámetros: $1 vector, $2 LIMIT, $3 umbral coseno (los filtros se
  //    agregan después vía buildFilterWhere, que indexa dinámicamente).
  // FIX 2026-08-22 (MEDIUM): threshold parametrizado como $3 (igual que
  // retrieveHybrid) — antes se interpolaba crudo (${threshold}) en el SQL.
  const params = [vectorStr, topK, threshold];
  const whereSQL = buildFilterWhere(filter, params);

  // 3. Búsqueda por similitud coseno
  const sql = `
    SELECT
      id,
      source,
      content,
      metadata,
      1 - (embedding <=> $1::vector) AS similarity
    FROM ${table}
    WHERE 1 - (embedding <=> $1::vector) > $3
      ${whereSQL}
    ORDER BY embedding <=> $1::vector
    LIMIT $2
  `;

  const { rows } = await pool.query(sql, params);
  const results = mapRows(rows, { similarity: 'similarity' });

  // FIX P0-F2/F3 (2026-08-21): query hash → todo el resultado es cross-space
  // potencialmente inválido. Marcar degraded (ver retrieveHybrid).
  if (esHash) {
    for (const r of results) r.degraded = true;
  }

  // Cache best-effort (fire-and-forget)
  setCachedRetrieve(cacheKey, results).catch(() => {});

  return results;
}

/**
 * Retriever por defecto: HÍBRIDO (semántica + full-text).
 *
 * Se puede forzar la estrategia vectorial pura con:
 *   retrieve(query, { strategy: 'vectorial' })
 *
 * @param {string} query - Consulta del usuario
 * @param {object} options - Opciones de búsqueda
 * @param {'hybrid'|'vectorial'} options.strategy - Estrategia de retrieval (default 'hybrid')
 * @param {number} options.topK - Número de resultados (default 5)
 * @param {number} options.threshold - Umbral de similitud (default 0.75)
 * @param {object} options.filter - Filtros por metadata (ej: {tipo: 'codigo_legal', materia: 'penal'})
 * @returns {Promise<Array>} - Chunks relevantes con score
 */
export async function retrieve(query, options = {}) {
  const { strategy = 'hybrid' } = options;
  if (strategy === 'vectorial') {
    return retrieveVectorial(query, options);
  }
  return retrieveHybrid(query, options);
}

/**
 * Construye un prompt aumentado con citaciones para el LLM.
 *
 * @param {string} query - Consulta del usuario
 * @param {string} systemInstruction - Instrucción de sistema
 * @param {Array} chunks - Chunks relevantes
 * @returns {object} - Prompt y sources
 */
export function buildAugmentedPrompt(query, systemInstruction, chunks) {
  const context = chunks
    .map(
      (chunk, i) =>
        `[${i + 1}] FUENTE: ${chunk.source} | SIMILARIDAD: ${(chunk.similarity * 100).toFixed(1)}%\n${chunk.content}\n`
    )
    .join('\n---\n\n');

  const prompt = `${systemInstruction}

CONTEXTO NORMATIVO VERIFICADO:
${context}

CONSULTA DEL USUARIO:
${query}

INSTRUCCIONES:
- Basa tu respuesta EXCLUSIVAMENTE en el contexto normativo proporcionado.
- Cita las fuentes con formato [N] donde N es el número de fuente.
- NUNCA inventes artículos o leyes.
- Si no encuentras la respuesta en el contexto, di "No encuentro base normativa suficiente".
- Incluye los 4 disclaimers IA obligatorios.
- Idioma: es-PE.

RESPUESTA:`;

  const sources = chunks.map((c) => ({
    id: c.id,
    source: c.source,
    similarity: c.similarity,
    metadata: c.metadata
  }));

  return { prompt, sources };
}

// ==========================================
// CLI (para testing)
// ==========================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const query = process.argv[2] || 'plazo razonable habeas corpus';
  const strategy = process.argv[3] === 'vectorial' ? 'vectorial' : 'hybrid';
  const useV2 = process.argv.includes('--v2');
  const filterArgIdx = process.argv.indexOf('--filter');
  const filter = {};
  if (filterArgIdx !== -1 && process.argv[filterArgIdx + 1]) {
    for (const pair of process.argv[filterArgIdx + 1].split(',')) {
      const [k, v] = pair.split(':');
      if (k && v) filter[k.trim()] = v.trim();
    }
  }
  console.log(`🔍 Buscando (${strategy}): "${query}"`);
  if (useV2) console.log(`📦 Tabla: rag_vectors_v2 (MiniMax)`);
  if (Object.keys(filter).length > 0) console.log(`🔎 Filtros: ${JSON.stringify(filter)}`);
  console.log('');

  retrieve(query, { topK: 5, strategy, table: useV2 ? 'rag_vectors_v2' : undefined, filter })
    .then((results) => {
      if (results.length === 0) {
        console.log('❌ Sin resultados relevantes');
        process.exit(1);
      }

      console.log(`✅ ${results.length} resultados encontrados:\n`);
      results.forEach((r) => {
        const breakdown =
          r.semanticSimilarity != null
            ? ` | sem: ${(r.semanticSimilarity * 100).toFixed(1)}% | kw: ${(r.keywordScore * 100).toFixed(1)}%`
            : '';
        console.log(`[${r.rank}] ${r.source} (score: ${(r.similarity * 100).toFixed(1)}%${breakdown})`);
        console.log(`    ID: ${r.id}`);
        if (r.metadata?.materia) console.log(`    Materia: ${r.metadata.materia} | Artículo: ${r.metadata.articulo || '-'} | Vigente: ${r.metadata.vigente}`);
        console.log(`    ${r.content.substring(0, 200)}...`);
        console.log('');
      });

      process.exit(0);
    })
    .catch((err) => {
      console.error('💥 Error:', err.message);
      process.exit(1);
    });
}