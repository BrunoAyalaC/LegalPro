import { createHash } from 'crypto';

let redisClient = null;
const memoryCache = new Map(); // Fallback en memoria local

function getRedisUrl() {
  return process.env.REDIS_URL || '';
}

export async function getClient() {
  if (redisClient) return redisClient;
  const url = getRedisUrl();
  if (!url) return null;
  try {
    const { default: Redis } = await import('ioredis');
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });
    await redisClient.connect();
    redisClient.on('error', (err) => console.error('[cache] Redis error:', err.message));
    return redisClient;
  } catch (err) {
    console.warn('[cache] Redis no disponible, operando con caché en memoria:', err.message);
    return null;
  }
}

export function hashKey(prefix, ...parts) {
  const raw = parts.join('::');
  const h = createHash('sha256').update(raw).digest('hex').slice(0, 16);
  return `${prefix}:${h}`;
}

export async function get(key) {
  try {
    const client = await getClient();
    if (!client) {
      const item = memoryCache.get(key);
      if (!item) return null;
      if (Date.now() > item.expiresAt) {
        memoryCache.delete(key);
        return null;
      }
      return item.value;
    }
    const val = await client.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

export async function set(key, value, ttlSeconds = 3600) {
  try {
    const client = await getClient();
    if (!client) {
      memoryCache.set(key, {
        value,
        expiresAt: Date.now() + (ttlSeconds * 1000)
      });
      return;
    }
    await client.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    /* silently fail */
  }
}

export async function del(key) {
  try {
    const client = await getClient();
    if (!client) {
      memoryCache.delete(key);
      return;
    }
    await client.del(key);
  } catch {
    /* silently fail */
  }
}

export function isAvailable() {
  return true; // Siempre disponible gracias al fallback en memoria
}

