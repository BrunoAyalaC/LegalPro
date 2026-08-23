import * as cache from '../cache.js';

/**
 * Store distribuido para express-rate-limit basado en cache.js (ioredis) + fallback memoria.
 * Compatible con express-rate-limit v8 store interface: { increment, decrement, resetKey }
 *
 * @param {string} prefix   namespace, ej 'rl:global'
 * @param {number} windowMs ventana en ms para TTL
 */
export function createDistributedStore(prefix, windowMs) {
  const memory = new Map();

  // Sweep memoria cada 10 min
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of memory) {
      if (now > v.resetTime) memory.delete(k);
    }
  }, 10 * 60 * 1000).unref?.();

  return {
    async increment(key) {
      const fullKey = `${prefix}:${key}`;
      const ttlSec = Math.ceil(windowMs / 1000);
      // Intentar Redis
      try {
        const redisAvailable = await cache.isAvailable().catch(() => false);
        if (redisAvailable) {
          const client = await cache.getClient();
          if (client) {
            // Usar INCR + EXPIRE atómico vía pipeline
            const pipeline = client.pipeline();
            pipeline.incr(fullKey);
            pipeline.ttl(fullKey);
            const results = await pipeline.exec();
            // results = [[null, count], [null, ttl]]
            const count = results?.[0]?.[1] ?? 1;
            let ttl = results?.[1]?.[1] ?? -1;
            if (count === 1 || ttl === -1) {
              await client.expire(fullKey, ttlSec).catch(() => {});
              ttl = ttlSec;
            }
            if (ttl < 0) ttl = ttlSec;
            const resetTime = new Date(Date.now() + ttl * 1000);
            return { totalHits: Number(count), resetTime };
          }
        }
      } catch (e) {
        // fallback a memoria
      }
      // Fallback memoria
      const now = Date.now();
      let entry = memory.get(fullKey);
      if (!entry || now > entry.resetTime) {
        entry = { totalHits: 1, resetTime: now + windowMs };
        memory.set(fullKey, entry);
      } else {
        entry.totalHits += 1;
      }
      return { totalHits: entry.totalHits, resetTime: new Date(entry.resetTime) };
    },

    async decrement(key) {
      const fullKey = `${prefix}:${key}`;
      try {
        const redisAvailable = await cache.isAvailable().catch(() => false);
        if (redisAvailable) {
          const client = await cache.getClient();
          if (client) {
            await client.decr(fullKey).catch(() => {});
            return;
          }
        }
      } catch {}
      const entry = memory.get(fullKey);
      if (entry && entry.totalHits > 0) entry.totalHits -= 1;
    },

    async resetKey(key) {
      const fullKey = `${prefix}:${key}`;
      try {
        const redisAvailable = await cache.isAvailable().catch(() => false);
        if (redisAvailable) {
          const client = await cache.getClient();
          if (client) {
            await client.del(fullKey).catch(() => {});
          }
        }
      } catch {}
      memory.delete(fullKey);
    },
  };
}

export default createDistributedStore;
