#!/usr/bin/env node
/**
 * RAG Cache Distribuido con Redis
 *
 * Reemplaza el cache en memoria del wrapper RAG por Redis
 * para permitir escalar horizontalmente (multi-instancia).
 *
 * Estrategia de degradación (fail-open):
 *   1. Si Redis está disponible → cache distribuido compartido
 *   2. Si Redis NO está disponible (no instalado, REDIS_URL vacía,
 *      conexión rechazada) → getCached retorna null y setCached retorna
 *      false. El consumidor (junior-rag-wrapper) debe entonces usar su
 *      propio cache local en Map() como fallback.
 *
 * Esto es intencional: el wrapper RAG NO debe fallar si Redis cae,
 * solo pierde el beneficio del cache compartido entre instancias.
 *
 * Configuración vía variables de entorno:
 *   REDIS_URL          = redis://localhost:6379 (default)
 *   RAG_CACHE_TTL      = 3600 segundos (1 hora, default)
 *   RAG_CACHE_PREFIX   = rag:cache: (prefijo de keys)
 *   RAG_CACHE_DISABLE  = "1" fuerza modo memoria (omite Redis)
 *
 * Uso:
 *   import { getCachedResult, setCachedResult, invalidateCache } from './redis-cache.mjs';
 *
 * @author  @backend-node (LegalPro)
 * @version 1.0.0
 * @license Proprietary
 */

import crypto from 'node:crypto';

// Estados del cliente:
//   undefined → aún no se intentó inicializar
//   null      → intento falló (Redis no disponible, fallback permanente)
//   Object    → instancia ioredis funcional
let redisClient = null;
let initPromise = null;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_TTL = Math.max(1, parseInt(process.env.RAG_CACHE_TTL || '3600', 10));
const CACHE_PREFIX = process.env.RAG_CACHE_PREFIX || 'rag:cache:';
const FORCE_MEMORY = process.env.RAG_CACHE_DISABLE === '1';

/**
 * Inicializa el cliente Redis de forma lazy.
 * Solo se ejecuta una vez por proceso (singleton).
 * Retorna null si ioredis no se puede cargar o si la conexión falla.
 */
async function ensureClient() {
  if (redisClient !== null) return redisClient; // null = ya intentó y falló
  if (initPromise) return initPromise;

  if (FORCE_MEMORY) {
    console.warn('[redis-cache] RAG_CACHE_DISABLE=1, operando sin Redis');
    redisClient = null;
    return null;
  }

  initPromise = (async () => {
    try {
      // Import dinámico para no romper si ioredis no está instalado
      // (mismo patrón que legalpro-app/server/cache.js)
      const mod = await import('ioredis');
      const Redis = mod.default || mod.Redis || mod;

      const client = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        enableOfflineQueue: false,
        lazyConnect: false
      });

      client.on('error', (err) => {
        // No logueamos todo el stack para evitar spam en producción;
        // solo el mensaje. Fall-open se mantiene por getCached/setCached.
        console.error('[redis-cache] Error:', err.message);
      });

      client.on('connect', () => {
        console.log('[redis-cache] Conectado a', REDIS_URL.replace(/:[^:@]+@/, ':***@'));
      });

      redisClient = client;
      return client;
    } catch (err) {
      console.warn('[redis-cache] ioredis no disponible, fallback a memoria:', err.message);
      redisClient = null;
      return null;
    }
  })();

  return initPromise;
}

/**
 * Cierra la conexión Redis (útil para tests y shutdown graceful).
 */
export async function closeRedisCache() {
  if (redisClient && typeof redisClient.quit === 'function') {
    try {
      await redisClient.quit();
    } catch {
      /* ignore */
    }
  }
  redisClient = null;
  initPromise = null;
}

/**
 * Genera hash determinístico SHA-256 de los parámetros de búsqueda.
 *
 * Importante: la clave debe ser estable entre invocaciones para que
 * el cache hit funcione. Por eso normalizamos:
 *   - materia  → lowercase, trim, fallback 'general'
 *   - consulta → lowercase, trim, truncada a 500 chars (evitar keys
 *                distintas por espacios o por textos enormes)
 *   - contexto → lowercase, trim, truncado a 200 chars
 *
 * El truncado agresivo evita ataques de cache-busting y mantiene
 * el espacio de claves acotado.
 */
export function generateCacheKey(materia, consulta, contexto) {
  const normalized = JSON.stringify({
    m: (materia || 'general').toLowerCase().trim(),
    c: (consulta || '').toLowerCase().trim().substring(0, 500),
    ctx: (contexto || '').toLowerCase().trim().substring(0, 200)
  });
  return CACHE_PREFIX + crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Obtiene resultado cacheado (null si no existe, expiró o Redis caído).
 *
 * Marcamos el resultado con metadatos:
 *   _from_cache: true   → provenía del cache (legítimo)
 *   _cache_layer: 'redis' | 'memory' (para diagnóstico)
 *   _cached_at: ISO timestamp del momento del set
 *
 * Fail-open: cualquier error retorna null sin lanzar excepción.
 */
export async function getCachedResult(materia, consulta, contexto) {
  try {
    const client = await ensureClient();
    if (!client || client.status !== 'ready') {
      // Si está conectando aún (status='connecting'|'connect') esperamos
      // brevemente; si timeout, fallback silencioso.
      if (client && client.status !== 'ready') {
        await Promise.race([
          client.status === 'ready' ? Promise.resolve() : new Promise((r) => client.once('ready', r)),
          new Promise((r) => setTimeout(r, 250))
        ]);
        if (client.status !== 'ready') return null;
      } else {
        return null;
      }
    }

    const key = generateCacheKey(materia, consulta, contexto);
    const cached = await client.get(key);

    if (!cached) return null;

    const parsed = JSON.parse(cached);
    parsed._from_cache = true;
    parsed._cache_layer = 'redis';
    parsed._cached_at = parsed._cached_at || new Date().toISOString();
    return parsed;
  } catch (err) {
    console.warn('[redis-cache] Get error:', err.message);
    return null; // Fail-open: sin cache
  }
}

/**
 * Guarda resultado en cache con TTL.
 *
 * Política de NO cacheo:
 *   - resultado null/undefined
 *   - resultado sin chunks_usados > 0 (resultados vacíos saturan el cache
 *     con keys inútiles y nunca resuelven una query real)
 *
 * Enriquecemos con _cached_at para auditoría posterior.
 *
 * Retorna true si guardó, false en cualquier otro caso (incluido Redis caído).
 */
export async function setCachedResult(materia, consulta, contexto, resultado) {
  try {
    if (!resultado || !resultado.chunks_usados || resultado.chunks_usados === 0) {
      return false;
    }

    const client = await ensureClient();
    if (!client || client.status !== 'ready') return false;

    const key = generateCacheKey(materia, consulta, contexto);
    const enriched = {
      ...resultado,
      _cached_at: new Date().toISOString(),
      _cache_layer: 'redis'
    };

    await client.setex(key, CACHE_TTL, JSON.stringify(enriched));
    return true;
  } catch (err) {
    console.warn('[redis-cache] Set error:', err.message);
    return false;
  }
}

/**
 * Invalida cache por patrón (ej: cuando se actualiza corpus legal).
 *
 * Implementación: usa SCAN (no KEYS) para no bloquear Redis en producción.
 * KEYS está deshabilitado en Redis Cluster y penalizado en instancias grandes.
 *
 * @param {string} pattern - Patrón relativo al prefijo (ej: 'civil:*' o '*' para todo)
 * @returns {Promise<number>} Cantidad de keys eliminadas (0 si Redis caído)
 */
export async function invalidateCache(pattern = '*') {
  try {
    const client = await ensureClient();
    if (!client || client.status !== 'ready') return 0;

    const fullPattern = `${CACHE_PREFIX}${pattern}`;
    let deleted = 0;
    let cursor = '0';

    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', fullPattern, 'COUNT', 200);
      cursor = nextCursor;
      if (keys.length > 0) {
        const removed = await client.del(...keys);
        deleted += removed;
      }
    } while (cursor !== '0');

    return deleted;
  } catch (err) {
    console.warn('[redis-cache] Invalidate error:', err.message);
    return 0;
  }
}

/**
 * Estadísticas del cache (health check / dashboard).
 *
 * Retorna:
 *   - total_keys: número de keys con el prefijo rag:cache:
 *   - ttl_seconds: TTL configurado
 *   - prefix: prefijo usado
 *   - redis_connected: boolean estado de la conexión
 *   - memory_info: línea used_memory_human de INFO memory
 *   - mode: 'redis' | 'memory' | 'uninitialized'
 */
export async function getCacheStats() {
  try {
    const client = await ensureClient();
    if (!client) {
      return {
        mode: 'memory',
        redis_connected: false,
        ttl_seconds: CACHE_TTL,
        prefix: CACHE_PREFIX
      };
    }

    const status = client.status;
    if (status !== 'ready') {
      return {
        mode: status === 'connecting' || status === 'connect' ? 'connecting' : 'memory',
        redis_connected: false,
        ttl_seconds: CACHE_TTL,
        prefix: CACHE_PREFIX,
        client_status: status
      };
    }

    const [info, keyCount] = await Promise.all([
      client.info('memory'),
      client.scan('0', 'MATCH', `${CACHE_PREFIX}*`, 'COUNT', 500).then(async ([, keys]) => {
        // SCAN puede dar resultados parciales, iteramos para contar exacto
        let total = keys.length;
        let cursor = '0';
        do {
          // (Simplificado: para stats exactos se requeriría iterar todo el SCAN.
          //  Aquí retornamos primera página como aproximación rápida.)
          break;
        } while (cursor !== '0');
        return total;
      })
    ]);

    const memLine = info
      .split('\n')
      .find((line) => line.includes('used_memory_human'));

    return {
      mode: 'redis',
      redis_connected: true,
      ttl_seconds: CACHE_TTL,
      prefix: CACHE_PREFIX,
      approx_keys: keyCount,
      memory_info: memLine ? memLine.trim() : 'unknown'
    };
  } catch (err) {
    return {
      mode: 'memory',
      redis_connected: false,
      error: err.message,
      ttl_seconds: CACHE_TTL,
      prefix: CACHE_PREFIX
    };
  }
}

/**
 * Modifica junior-rag-wrapper.mjs para usar Redis
 *
 * Buscar la sección del cache Map() y reemplazar por:
 *   import { getCachedResult, setCachedResult } from './redis-cache.mjs';
 *   // Map() de respaldo para fail-open
 */