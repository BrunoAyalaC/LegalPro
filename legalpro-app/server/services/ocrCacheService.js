/**
 * ocrCacheService.js — Cache del TEXTO EXTRAÍDO por OCR, indexado por SHA-256.
 *
 * Por qué existe:
 *   Hoy cada upload de un documento (incluso si el archivo es IDÉNTICO byte a
 *   byte) reprocesa el OCR con Qwen VL / mimo / MiniMax. Esto cuesta créditos,
 *   tokens y latencia innecesariamente. Los documentos legales NO cambian: si
 *   un mismo archivo binario se subió antes y devolvió texto_ocr, devolver el
 *   mismo texto_ocr es determinista.
 *
 * Contrato:
 *   - getCachedOcr(hashSha256)   → { texto, modelo, provider, chars, cachedAt } | null
 *   - setCachedOcr(hashSha256, ...) → boolean (true si guardó)
 *   - invalidateOcr(hashSha256) → boolean
 *   - getCacheStats()            → métricas para health checks
 *
 * Implementación:
 *   Usa el wrapper de cache unificado `legalpro-app/server/cache.js`, que ya
 *   provee Redis (ioredis) con fallback transparente a memoria local. Las keys
 *   tienen prefijo `ocr:` para permitir limpieza/invalidación selectiva y no
 *   colisionar con `rag:cache:`, `idempotency:` u otros prefijos existentes.
 *
 *   TTL por defecto: 7 días (configurable vía OCR_CACHE_TTL_SECONDS). Los
 *   documentos legales son estáticos por naturaleza; 7 días es más que
 *   suficiente incluso para uploads repetidos durante semanas.
 *
 * Fail-open: cualquier error de Redis cae silenciosamente al fallback de
 * memoria o retorna null en lectura. NUNCA bloquea el upload.
 *
 * Cero hardcoding: prefijo, TTL y flag de desactivación se leen desde env vars.
 *
 * SKILL: backend-node v1.2.0 — pipeline visión→cerebro→juniors optimizado.
 *
 * @author BackendNode
 * @version 1.0.0 (2026-08-08)
 */

import { createHash } from 'node:crypto';
import * as cache from '../cache.js';
import logger from '../logger.js';

// ─── Configuración (env vars, sin hardcoding) ───────────────────────────────
const CACHE_PREFIX = process.env.OCR_CACHE_PREFIX || 'ocr:';
const CACHE_TTL_SECONDS = Math.max(
  60, // mínimo 1 minuto para evitar TTL inválido en Redis
  parseInt(process.env.OCR_CACHE_TTL_SECONDS || String(7 * 24 * 60 * 60), 10) // 7 días
);
const CACHE_DISABLED = process.env.OCR_CACHE_DISABLE === '1' || process.env.OCR_CACHE_DISABLE === 'true';

/**
 * Construye la clave de cache determinista.
 * El prefijo evita colisiones con otros consumidores de cache.js
 * (idempotency, rag, etc.) y permite escanear/invalidar selectivamente.
 *
 * @param {string} hashSha256 - Hash SHA-256 hexadecimal (64 chars) del archivo.
 * @returns {string} clave completa
 */
export function buildOcrCacheKey(hashSha256) {
  if (!hashSha256 || typeof hashSha256 !== 'string') {
    throw new Error('ocrCacheService: hashSha256 es obligatorio y debe ser string');
  }
  return `${CACHE_PREFIX}${hashSha256.toLowerCase()}`;
}

/**
 * Recupera el texto OCR cacheado para un archivo (por hash SHA-256).
 *
 * @param {string} hashSha256
 * @returns {Promise<{texto: string, modelo: string|null, provider: string|null, chars: number, cachedAt: string}|null>}
 *   null si no hay hit, cache deshabilitado, hash inválido o error de Redis
 *   (fail-open: nunca lanza excepción).
 */
export async function getCachedOcr(hashSha256) {
  if (CACHE_DISABLED) return null;
  if (!hashSha256 || typeof hashSha256 !== 'string') return null;

  try {
    const key = buildOcrCacheKey(hashSha256);
    const cached = await cache.get(key);
    if (!cached) return null;

    // Defensiva: si por alguna razón la estructura está corrupta, ignorar.
    if (typeof cached !== 'object' || typeof cached.texto !== 'string') {
      logger.warn('[ocr-cache] Entrada corrupta, ignorando', { key });
      return null;
    }

    return {
      texto: cached.texto,
      modelo: cached.modelo || null,
      provider: cached.provider || null,
      chars: typeof cached.chars === 'number' ? cached.chars : cached.texto.length,
      cachedAt: cached.cachedAt || null,
    };
  } catch (err) {
    logger.warn('[ocr-cache] Error en getCachedOcr (fail-open)', { error: err?.message });
    return null;
  }
}

/**
 * Persiste el resultado OCR en cache, asociado al hash SHA-256 del archivo.
 * Best-effort: si Redis falla, intenta memoria (vía cache.js). Si TODO falla,
 * retorna false pero NO lanza.
 *
 * @param {string} hashSha256
 * @param {object} data
 * @param {string} data.texto - Texto OCR extraído
 * @param {string} [data.modelo] - Modelo que produjo el texto (qwen3-vl-32b, etc.)
 * @param {string} [data.provider] - Proveedor (openrouter, opencode, minimax)
 * @returns {Promise<boolean>} true si se persistió, false en caso contrario
 */
export async function setCachedOcr(hashSha256, { texto, modelo = null, provider = null } = {}) {
  if (CACHE_DISABLED) return false;
  if (!hashSha256 || typeof hashSha256 !== 'string') return false;
  if (typeof texto !== 'string' || texto.trim() === '') return false;

  try {
    const key = buildOcrCacheKey(hashSha256);
    const payload = {
      texto,
      modelo,
      provider,
      chars: texto.length,
      cachedAt: new Date().toISOString(),
    };
    await cache.set(key, payload, CACHE_TTL_SECONDS);
    logger.info('[ocr-cache] OCR cacheado', {
      hash: hashSha256.slice(0, 12),
      provider,
      modelo,
      chars: texto.length,
      ttlSeconds: CACHE_TTL_SECONDS,
    });
    return true;
  } catch (err) {
    logger.warn('[ocr-cache] Error en setCachedOcr (fail-open)', { error: err?.message });
    return false;
  }
}

/**
 * Invalida una entrada específica de cache (útil si el usuario reemplaza un
 * archivo o si se detecta que el OCR previo tuvo errores críticos).
 *
 * @param {string} hashSha256
 * @returns {Promise<boolean>} true si se eliminó, false si no
 */
export async function invalidateOcr(hashSha256) {
  if (!hashSha256 || typeof hashSha256 !== 'string') return false;
  try {
    const key = buildOcrCacheKey(hashSha256);
    await cache.del(key);
    return true;
  } catch (err) {
    logger.warn('[ocr-cache] Error en invalidateOcr', { error: err?.message });
    return false;
  }
}

/**
 * Hash SHA-256 determinista del buffer (hex lowercase, 64 chars).
 * Helper para que el llamador no importe `crypto` por separado.
 *
 * @param {Buffer|string} data
 * @returns {string} hex SHA-256
 */
export function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Estadísticas del cache de OCR (health check / dashboard).
 * Cuenta las keys con el prefijo `ocr:` en Redis (o tamaño del map en memoria).
 *
 * @returns {Promise<{prefix: string, ttlSeconds: number, disabled: boolean, mode: 'redis'|'memory'|'unknown', approxKeys: number|null}>}
 */
export async function getCacheStats() {
  const base = {
    prefix: CACHE_PREFIX,
    ttlSeconds: CACHE_TTL_SECONDS,
    disabled: CACHE_DISABLED,
  };

  if (CACHE_DISABLED) {
    return { ...base, mode: 'disabled', approxKeys: 0 };
  }

  try {
    const client = await cache.getClient();
    if (!client) {
      return { ...base, mode: 'memory', approxKeys: null };
    }
    if (client.status !== 'ready') {
      return { ...base, mode: client.status, approxKeys: null };
    }
    // SCAN no bloquea Redis (a diferencia de KEYS). COUNT 200 = batch razonable.
    let cursor = '0';
    let total = 0;
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', `${CACHE_PREFIX}*`, 'COUNT', 200);
      cursor = next;
      total += keys.length;
    } while (cursor !== '0');
    return { ...base, mode: 'redis', approxKeys: total };
  } catch (err) {
    logger.warn('[ocr-cache] Error en getCacheStats', { error: err?.message });
    return { ...base, mode: 'unknown', approxKeys: null };
  }
}

export default {
  getCachedOcr,
  setCachedOcr,
  invalidateOcr,
  buildOcrCacheKey,
  sha256,
  getCacheStats,
};
