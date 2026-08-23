// legalpro-app/server/cache-redis.js
// Generado por @backend-node (Sprint 2 - Capa de caching)
// Cache con Redis para Gemini y listados frecuentes

import Redis from 'ioredis';
import crypto from 'node:crypto';

const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3, enableOfflineQueue: false })
  : null;

const TTL = {
  GEMINI_RESPONSE: 24 * 60 * 60,  // 24h
  EXPEDIENTE_LIST: 5 * 60,         // 5 min
  USER_PROFILE: 60 * 60,           // 1h
  JURISPRUDENCIA: 7 * 24 * 60 * 60, // 7 dÃƒÂ­as
  BCRP_TASA: 24 * 60 * 60,           // 24h
  EMBEDDINGS: 7 * 24 * 60 * 60,      // 7 dÃƒÂ­as (vectores de embeddings)
  CATALOGOS: 30 * 24 * 60 * 60       // 30 dÃƒÂ­as (catÃƒÂ¡logos legales)
};

function hashKey(prefix, params) {
  const hash = crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex').slice(0, 16);
  return `${prefix}:${hash}`;
}

export class Cache {
  static async get(key) {
    if (!redis) return null;
    try {
      const val = await redis.get(key);
      return val ? JSON.parse(val) : null;
    } catch (e) {
      console.warn('[cache] get failed:', e.message);
      return null;
    }
  }

  static async set(key, value, ttl = 300) {
    if (!redis) return false;
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[cache] set failed:', e.message);
      return false;
    }
  }

  static async del(key) {
    if (!redis) return;
    try {
      await redis.del(key);
    } catch (e) {}
  }

  static async invalidatePattern(pattern) {
    if (!redis) return;
    try {
      const stream = redis.scanStream({ match: pattern, count: 100 });
      const pipeline = redis.pipeline();
      for await (const keys of stream) {
        keys.forEach(k => pipeline.del(k));
        await pipeline.exec();
      }
    } catch (e) {
      console.warn('[cache] invalidate pattern failed:', e.message);
    }
  }

  static async getOrSet(key, ttl, fn) {
    const cached = await this.get(key);
    if (cached) return { data: cached, cached: true };
    const fresh = await fn();
    await this.set(key, fresh, ttl);
    return { data: fresh, cached: false };
  }

  static geminiResponseKey(prompt, systemInstruction) {
    return hashKey('gemini', { p: prompt, s: systemInstruction });
  }

  static expedienteListKey(organizationId, opts) {
    return hashKey(`exp:${organizationId}`, opts);
  }

  static jurisKey(query, fuente) {
    return hashKey(`juris:${fuente}`, { q: query });
  }

  /** Key para embeddings semanticos (TTL: 7 dias) */
  static embeddingsKey(documentType, docId, modelo) {
    return hashKey('embed', { t: documentType, id: docId, m: modelo });
  }

  /** Key para catalogos legales (TTL: 30 dias) */
  static catalogosKey(catalogoNombre, version) {
    return hashKey('catalogo', { n: catalogoNombre, v: version || 'latest' });
  }

}

export { redis, TTL };
export default Cache;
