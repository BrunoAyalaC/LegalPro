#!/usr/bin/env node
/**
 * Junior RAG Wrapper - Wrapper de RAG para subagentes juniors
 * 
 * Los subagentes abogados (abogado-jr-civil, abogado-jr-penal, etc.)
 * DEBEN invocar este wrapper ANTES de generar una respuesta legal.
 * 
 * Esto garantiza que las respuestas tengan:
 * - Base legal actualizada al día
 * - Citaciones verificables
 * - Disclaimers IA correctos
 * - Cumplimiento LPDP
 * 
 * Uso desde un subagente junior:
 * 
 *   import { consultarBaseLegal } from './tools/rag/junior-rag-wrapper.mjs';
 *   const baseLegal = await consultarBaseLegal({
 *     materia: 'civil',
 *     consulta: 'plazo para contestar demanda',
 *     contexto: 'Caso de prescripción adquisitiva'
 *   });
 *   
 *   // baseLegal contiene: { contexto, citaciones, fuentes, disclaimers }
 */

import { retrieve, buildAugmentedPrompt } from './retrieve.mjs';
// FIX LDDE-GAP1 (2026-08-22): pipeline avanzado (multi-query + RRF + reranking)
// ahora es el path PRINCIPAL. Fallback a retrieve() básico si falla.
import { buscarAvanzado } from './rag-advanced.mjs';
import { getCachedResult, setCachedResult } from './redis-cache.mjs';
import { fileURLToPath } from 'node:url';

const DISCLAIMERS_OBLIGATORIOS = [
  '⚠️ Esta respuesta es generada por IA y NO constituye asesoría legal.',
  '⚠️ Siempre consulta con un abogado colegiado antes de tomar decisiones legales.',
  '⚠️ La información proviene de fuentes oficiales pero puede estar sujeta a cambios.',
  '⚠️ Verifica las citas consultando directamente las fuentes oficiales.'
];

const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hora (alineado con RAG_CACHE_TTL de redis-cache.mjs)

/**
 * Mapa canónico de alias de fuente (lo que pasa el usuario / el router) →
 * nombre del archivo JSON del catálogo (lo que se guarda en
 * `rag_vectors_v2.source` por indexer-v2.mjs).
 *
 * SKILL enrutamiento-intenciones-chat v1.2.0 (FIX 2026-08-09): el router
 * recibe `fuente` como enum estable ('pj'|'tc'|'indecopi'|'sunarp'|'minjus'|'auto')
 * y aquí se mapea al archivo indexado para filtrar el retrieval semántico.
 *
 * Si la fuente es 'auto', null o no reconocida → no se filtra por source y
 * el retrieval recorre todos los archivos (comportamiento histórico).
 */
const FUENTE_RAG_SOURCE_MAP = Object.freeze({
  pj: 'casaciones-pj-2026.json',
  tc: 'sentencias-tc-completas-2026.json', // archivo canónico; 'jurisprudencia-tc-2026.json' queda como fallback futuro
  indecopi: 'resoluciones-indecopi-2026.json',
  sunarp: 'directivas-sunarp-2026.json',
  minjus: 'normas-minjusdh-2026.json',
});

/**
 * Resuelve un alias de fuente (string) al nombre de archivo JSON canónico.
 * Devuelve `null` si la fuente no debe filtrar (auto / null / vacío / desconocida).
 *
 * @param {string|null|undefined} fuente
 * @returns {string|null}
 */
export function resolveFuenteToRagSource(fuente) {
  if (typeof fuente !== 'string') return null;
  const key = fuente.trim().toLowerCase();
  if (!key || key === 'auto') return null;
  return FUENTE_RAG_SOURCE_MAP[key] || null;
}

/**
 * Cache de respaldo en memoria (Map local).
 *
 * Se usa SOLO cuando Redis no está disponible (caído, no instalado,
 * REDIS_URL vacía). Permite que el wrapper siga funcionando en
 * entornos de desarrollo o cuando la infraestructura de cache
 * distribuido no está operativa.
 *
 * Mantiene la API previa (timestamp + data) y la misma política de
 * limpieza LRU-light (>100 entradas elimina la más vieja).
 *
 * La clave aquí es la "humana" (`${materia}:${consulta}:${contexto}`)
 * para debugging rápido; en Redis se usa hash SHA-256 determinístico.
 */
const memoryCache = new Map();

/**
 * Intenta leer del cache distribuido (Redis) y, si no hay hit o Redis
 * no está disponible, intenta el cache local en memoria.
 *
 * @returns {object|null} Resultado cacheado con `_cache_layer` marcado,
 *                        o null si no hay hit en ningún nivel.
 */
async function getFromCacheMultiTier(materia, consulta, contexto) {
  // Nivel 1: Redis distribuido
  const fromRedis = await getCachedResult(materia, consulta, contexto);
  if (fromRedis) {
    return { ...fromRedis, _cache_layer: fromRedis._cache_layer || 'redis' };
  }

  // Nivel 2: Map en memoria (fallback)
  // FIX 2026-08-22 (perf/correctness): truncado a 200 chars, alineado con la
  // normalización de Redis (generateCacheKey usa ctx.substring(0,200)). Antes
  // era 50 → dos contextos que compartieran los primeros 50 chars colisionaban
  // y el tier memoria servía resultados cruzados.
  const memKey = `${(materia || 'general').toLowerCase().trim()}:${consulta}:${(contexto || '').substring(0, 200)}`;
  const memEntry = memoryCache.get(memKey);
  if (memEntry && Date.now() - memEntry.timestamp < CACHE_TTL_MS) {
    return {
      ...memEntry.data,
      _from_cache: true,
      _cache_layer: 'memory',
      _cached_at: new Date(memEntry.timestamp).toISOString()
    };
  }

  // Si la entrada en memoria está expirada, la purgamos
  if (memEntry) memoryCache.delete(memKey);

  return null;
}

/**
 * Escribe el resultado en AMBOS caches (Redis + memoria) best-effort.
 * Si Redis falla, al menos queda en memoria para esta instancia.
 * Limpia el cache de memoria cuando supera 100 entradas.
 */
async function setInCacheMultiTier(materia, consulta, contexto, resultado) {
  // Nivel 1: Redis (best-effort, no lanza)
  const redisOk = await setCachedResult(materia, consulta, contexto, resultado);

  // Nivel 2: memoria local (best-effort, no lanza)
  try {
    // FIX 2026-08-22: misma clave que getFromCacheMultiTier (200 chars).
    const memKey = `${(materia || 'general').toLowerCase().trim()}:${consulta}:${(contexto || '').substring(0, 200)}`;
    memoryCache.set(memKey, {
      timestamp: Date.now(),
      data: { ...resultado, _cache_layer: 'memory' }
    });

    // Limpieza LRU-light: si supera 100 entradas, eliminar la más vieja
    if (memoryCache.size > 100) {
      const oldestKey = memoryCache.keys().next().value;
      memoryCache.delete(oldestKey);
    }
  } catch (err) {
    console.warn('[junior-rag] Error escribiendo cache memoria:', err.message);
  }

  return redisOk; // true si Redis aceptó (informativo)
}

/**
 * Consulta la base legal actualizada antes de responder
 * @param {object} options
 * @param {string} options.materia - civil/penal/laboral/etc
 * @param {string} options.consulta - Pregunta específica del usuario
 * @param {string} options.contexto - Contexto adicional del caso
 * @param {string} options.jurisdiccion - Perú (default)
 * @param {string} [options.fuente] - Alias de fuente ('pj'|'tc'|'indecopi'|'sunarp'|'minjus'|'auto').
 *   Si está presente y se reconoce, el retrieval filtra por `rag_vectors_v2.source`
 *   (mapeado vía FUENTE_RAG_SOURCE_MAP). Si es 'auto' o desconocido → sin filtro.
 *   SKILL enrutamiento-intenciones-chat v1.2.0 (FIX 2026-08-09).
 * @returns {Promise<object>}
 */
export async function consultarBaseLegal(options) {
  const { materia, consulta, contexto = '', jurisdiccion = 'Perú', fuente = null } = options;

  // FIX P0-F4 (2026-08-21): threshold parametrizable. Antes estaba hardcodeado
  // a 0.70 y el audit log de ragMiddleware registraba un RAG_THRESHOLD que
  // NUNCA se aplicaba (trazabilidad mentía). Ahora el caller (ragMiddleware)
  // pasa su RAG_THRESHOLD real y se propaga hasta retrieve().
  const threshold = typeof options.threshold === 'number' && options.threshold > 0
    ? options.threshold
    : 0.70;

  if (!consulta || consulta.length < 5) {
    throw new Error('consulta debe tener al menos 5 caracteres');
  }
  
  // Resolver filtro de fuente (alias → archivo canónico del catálogo RAG).
  const fuenteSource = resolveFuenteToRagSource(fuente);

  // Construir query enriquecida (mantenemos `contexto` por compatibilidad con
  // consumidores existentes; el filtro estricto es `filter.source` abajo).
  const queryEnriquecida = `${materia ? `[${materia}] ` : ''}${consulta}${contexto ? ` | Contexto: ${contexto}` : ''}${fuenteSource ? ` | Fuente: ${fuente}` : ''} | ${jurisdiccion} 2026`;
  
  // Verificar cache (Redis distribuido + fallback en memoria)
  // FIX 2026-08-09: la clave de cache incluye la fuente para no servir
  // resultados cruzados (un cache de 'tc' NO debe contestar una query 'pj').
  const cached = await getFromCacheMultiTier(materia, consulta, `${fuente || ''}|${contexto}`);
  if (cached) {
    console.log(`[junior-rag] Cache hit (${cached._cache_layer || 'unknown'}) para: ${materia}:${consulta.substring(0, 50)} [fuente=${fuente || 'auto'}]`);
    return cached;
  }
  
  // Retrieval semántico
  const filter = {};
  if (materia) filter.materia = materia.toLowerCase();
  if (fuenteSource) filter.source = fuenteSource;
  // FIX LDDE-GAP1 (2026-08-22): path principal = buscarAvanzado (multi-query +
  // RRF + reranking). Fallback a retrieve() básico si el avanzado falla
  // (p.ej. descomponerQuery sin LLM disponible). El threshold se pasa laxo a
  // los sub-queries: el reranking decide el top final.
  let rawChunks;
  try {
    rawChunks = await buscarAvanzado(queryEnriquecida, {
      topK: 5,
      filter,
      threshold
    });
  } catch (advErr) {
    console.warn(`[junior-rag] buscarAvanzado falló, fallback a retrieve básico: ${advErr?.message}`);
    rawChunks = await retrieve(queryEnriquecida, {
      topK: 5,
      threshold, // FIX P0-F4: ya no hardcodeado
      filter
    });
  }

  // Re-ranking híbrido: semántico (70%) + keyword matching exacto (30%)
  // Esto mejora precision para términos técnicos legales que el embedding
  // semántico puede sub-pesar (ej: "artículo 1234", "habeas corpus").
  const chunks = hybridScore(rawChunks, consulta);

  // FIX P0-F2 (2026-08-21): propagar flag degraded. Si el retrieval corrió en
  // modo hash-fallback, las similitudes son cross-space potencialmente
  // inválidas y NINGÚN chunk es presentable como jurisprudencia verificada.
  const ragDegraded = chunks.some((c) => c.degraded === true);

  if (chunks.length === 0) {
    console.warn(`[junior-rag] Sin resultados relevantes para: ${consulta}`);
    return {
      contexto: '⚠️ No se encontró base legal específica. Responder con conocimiento general + disclaimers.',
      citaciones: [],
      fuentes: [],
      chunks_usados: 0,
      necesita_revision_humana: true,
      degraded: false,
      motivo_degradacion: null,
      threshold_aplicado: threshold
    };
  }
  
  // Construir respuesta estructurada para el junior
  const resultado = {
    contexto: chunks.map(c => c.content).join('\n\n---\n\n'),
    citaciones: chunks.map((c, i) => ({
      numero: i + 1,
      fuente: c.source,
      similitud: c.similarity,
      metadata: c.metadata,
      url: c.metadata?.url || c.url
    })),
    fuentes: chunks.map(c => c.source).filter((v, i, a) => a.indexOf(v) === i),
    chunks_usados: chunks.length,
    fecha_consulta: new Date().toISOString(),
    sistema_origen: 'RAG-LegalPro-v1',
    necesita_revision_humana: true, // SIEMPRE por compliance LPDP
    
    // Prompt sugerido para el junior
    prompt_aumentado: buildAugmentedPrompt(
      consulta,
      construirSystemInstruction(materia, contexto),
      chunks
    ).prompt,
    
    // Disclaimers para incluir en respuesta
    disclaimers_obligatorios: DISCLAIMERS_OBLIGATORIOS,
    
    // Metadata para audit log
    audit_metadata: {
      materia,
      chunks_consultados: chunks.length,
      similitud_promedio: chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length,
      proveedor_embeddings: process.env.OPENAI_API_KEY ? 'openai' : (process.env.OPENCODE_API_KEY ? 'opencode' : 'hash_placeholder'),
      timestamp_consulta: new Date().toISOString(),
      // FIX P0-F2/F4: trazabilidad real del modo y umbral aplicado
      degraded: ragDegraded,
      threshold_aplicado: threshold
    },
    // FIX P0-F2: flags de degradación para downstream (ai.js → rag_verificado)
    degraded: ragDegraded,
    motivo_degradacion: ragDegraded ? 'hash_fallback' : null,
    threshold_aplicado: threshold
  };
  
  // Guardar en cache multi-tier (Redis + memoria)
  // setCachedResult() puede fallar silenciosamente; el wrapper no debe
  // romper si Redis está caído, solo no se compartirá entre instancias.
  // FIX 2026-08-22 (HIGH): la clave de ESCRITURA debe ser idéntica a la de
  // LECTURA (línea ~191): `${fuente||''}|${contexto}`. Antes se guardaba solo
  // `contexto` → la lectura nunca hitteaba desde FIX 2026-08-09 (cache muerto).
  await setInCacheMultiTier(materia, consulta, `${fuente || ''}|${contexto}`, resultado);

  return resultado;
}

function construirSystemInstruction(materia, contexto) {
  return `Eres un abogado junior especializado en ${materia || 'derecho peruano'}.

INSTRUCCIONES CRÍTICAS:
1. USA EXCLUSIVAMENTE el contexto normativo proporcionado como base
2. CITA las fuentes con formato [N] donde N es el número de citación
3. NUNCA inventes artículos o leyes
4. Si el contexto es insuficiente, di "No encuentro base normativa suficiente"
5. SIEMPRE incluye los 4 disclaimers IA al final
6. Idioma: es-PE
7. Contexto del caso: ${contexto || 'No especificado'}

OBJETIVO: Respuesta verificable y fundamentada en normativa vigente al 2026.`;
}

/**
 * Hybrid scoring: combina similitud semántica con keywords exactos.
 *
 * Esto mejora retrieval precision cuando hay términos técnicos legales
 * (ej: "artículo 123", "habeas corpus", "prescripción adquisitiva"),
 * porque el embedding semántico a veces pierde matches literales
 * de términos jurídicos clave.
 *
 * Fórmula:
 *   combinedScore = semantic * 0.7 + keyword * 0.3
 *
 *   - semantic: similitud coseno del embedding (0..1)
 *   - keyword : (# términos de la query presentes en el chunk) / (total términos)
 *
 * El breakdown se devuelve en `score_breakdown` para auditoría.
 *
 * FIX 2026-08-22 (HIGH): `similarity` conserva la señal semántica PURA (antes
 * se sobrescribía con combinedScore → doble boost léxico en modo hash y
 * thresholds evaluados sobre score inflado). El score combinado vive en
 * `combined_score`; los consumidores que filtran por umbral deben usar
 * `c.combined_score ?? c.similarity`.
 *
 * @param {Array} chunks        - Chunks retornados por retrieve()
 * @param {string} queryOriginal - Query original del usuario (sin enriquecer)
 * @returns {Array}             - Mismos chunks + combined_score, ordenados por él
 */
export function hybridScore(chunks, queryOriginal) {
  if (!Array.isArray(chunks) || chunks.length === 0) return [];

  // Tokenizar query y filtrar términos muy cortos (stopwords-like)
  const queryTerms = String(queryOriginal || '')
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\wáéíóúñü-]/g, ''))
    .filter((t) => t.length > 3);

  // Si por algún motivo no hay términos útiles, devolver orden original
  if (queryTerms.length === 0) return chunks;

  const totalTerms = queryTerms.length;

  return chunks
    .map((chunk) => {
      const content = String(chunk.content || '').toLowerCase();
      const keywordMatches = queryTerms.filter((term) => content.includes(term)).length;
      const semanticScore = typeof chunk.similarity === 'number' ? chunk.similarity : 0;
      const keywordScore = keywordMatches / totalTerms;

      // Score combinado: 70% semántico + 30% keywords
      const combinedScore = semanticScore * 0.7 + keywordScore * 0.3;

      return {
        ...chunk,
        similarity: semanticScore,
        combined_score: Number(combinedScore.toFixed(4)),
        score_breakdown: {
          semantic: semanticScore,
          keyword: keywordScore,
          matches: keywordMatches,
          total_terms: totalTerms,
          terms_hit: queryTerms.filter((t) => content.includes(t))
        }
      };
    })
    .sort((a, b) => b.combined_score - a.combined_score);
}

/**
 * Genera la respuesta legal enriquecida para el junior
 */
export async function generarRespuestaConRAG(options) {
  const { juniorNombre = 'abogado-jr', consulta, materia, contexto } = options;
  
  console.log(`[${juniorNombre}] Consultando RAG para: ${consulta.substring(0, 80)}...`);
  
  const baseLegal = await consultarBaseLegal({ materia, consulta, contexto });
  
  // Aquí se integraría con el LLM (MiniMax M3 o Gemini)
  // Por ahora retornamos la estructura preparada
  
  return {
    instrucciones_para_junior: {
      base_legal_disponible: baseLegal.chunks_usados > 0,
      usar_contexto_rag: baseLegal.chunks_usados > 0,
      prompt_sugerido: baseLegal.prompt_aumentado,
      citaciones_disponibles: baseLegal.citaciones,
      incluir_disclaimers: baseLegal.disclaimers_obligatorios
    },
    respuesta_estructurada: {
      contenido_recomendado: '', // El junior debe generar con el LLM
      citaciones: baseLegal.citaciones,
      fuentes: baseLegal.fuentes,
      disclaimers: baseLegal.disclaimers_obligatorios
    },
    metadata_audit: baseLegal.audit_metadata
  };
}

// CLI para testing
// CLI guard cross-platform (Windows usa backslashes, POSIX usa forward slashes)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const consulta = process.argv[2] || 'plazo para contestar demanda civil';
  const materia = process.argv[3] || 'civil';
  
  console.log('🧪 Test Junior RAG Wrapper');
  console.log(`Consulta: ${consulta}`);
  console.log(`Materia: ${materia}\n`);
  
  consultarBaseLegal({ materia, consulta })
    .then((r) => {
      console.log(`\n📊 Resultado:`);
      console.log(`   Chunks usados: ${r.chunks_usados}`);
      console.log(`   Fuentes: ${r.fuentes.join(', ')}`);
      console.log(`   Citaciones: ${r.citaciones.length}`);
      console.log(`   Disclaimers: ${r.disclaimers_obligatorios.length}`);
    })
    .catch((err) => {
      console.error('❌ Error:', err.message);
      process.exit(1);
    });
}