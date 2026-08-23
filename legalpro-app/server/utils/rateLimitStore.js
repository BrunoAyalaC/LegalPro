import { RedisStore } from 'rate-limit-redis';
import { getClient } from '../cache.js';

/**
 * Crea un RedisStore para express-rate-limit si Redis está disponible.
 * Fallback a MemoryStore (undefined) si no hay Redis — mantiene DX local.
 *
 * @param {string} prefix  prefijo para namespace (ej: 'global', 'auth', 'minimax')
 * @returns {Promise<RedisStore|undefined>}
 */
export async function createRateLimitStore(prefix) {
  try {
    const client = await getClient();
    if (!client) {
      console.warn(`[rateLimitStore] Redis no disponible — usando MemoryStore para ${prefix}`);
      return undefined;
    }
    // Verificar conectividad real
    try {
      const pong = await client.ping();
      if (pong !== 'PONG') throw new Error('Redis ping failed');
    } catch {
      console.warn(`[rateLimitStore] Redis ping falló — MemoryStore para ${prefix}`);
      return undefined;
    }
    return new RedisStore({
      // ioredis: sendCommand espera (...args) => client.call(...args)
      sendCommand: (...args) => client.call(...args),
      prefix: `rl:${prefix}:`,
    });
  } catch (err) {
    console.warn(`[rateLimitStore] Error creando RedisStore para ${prefix}:`, err.message);
    return undefined;
  }
}

/**
 * Versión síncrona lazy que intenta crear store de forma asíncrona.
 * express-rate-limit permite store como objeto; si es undefined usa MemoryStore.
 * Para compat con init sincrónico, exportamos factory async y dejamos que index.js lo resuelva.
 */
export default createRateLimitStore;
