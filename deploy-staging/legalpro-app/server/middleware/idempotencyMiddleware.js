import * as cache from '../cache.js';

// Memoria local como fallback si Redis no está disponible
const memoriaLocal = new Map();
const MEMORY_TTL_MS = 60 * 60 * 1000; // 1 hora en ms

// Limpieza periódica de memoria local para evitar fugas de memoria
setInterval(() => {
  const ahora = Date.now();
  for (const [key, item] of memoriaLocal.entries()) {
    if (ahora > item.expira) {
      memoriaLocal.delete(key);
    }
  }
}, 5 * 60 * 1000); // Cada 5 minutos

async function setCache(key, value, ttlSeconds) {
  if (cache.isAvailable()) {
    await cache.set(key, value, ttlSeconds);
  } else {
    memoriaLocal.set(key, {
      value,
      expira: Date.now() + ttlSeconds * 1000,
    });
  }
}

async function getCache(key) {
  if (cache.isAvailable()) {
    return await cache.get(key);
  } else {
    const item = memoriaLocal.get(key);
    if (!item) return null;
    if (Date.now() > item.expira) {
      memoriaLocal.delete(key);
      return null;
    }
    return item.value;
  }
}

async function delCache(key) {
  if (cache.isAvailable()) {
    await cache.del(key);
  } else {
    memoriaLocal.delete(key);
  }
}

export function idempotencyMiddleware() {
  return async (req, res, next) => {
    const key = req.headers['x-idempotency-key'];
    if (!key || typeof key !== 'string' || !key.trim()) {
      return next();
    }

    const cacheKey = `idempotency:${key.trim()}`;

    try {
      const cachedResponse = await getCache(cacheKey);

      if (cachedResponse) {
        if (cachedResponse === 'IN_PROGRESS') {
          return res.status(409).json({
            error: 'Esta petición ya está siendo procesada. Por favor, espere.',
            code: 'REQUEST_IN_PROGRESS',
          });
        }

        // Devolver respuesta duplicada desde la caché
        res.setHeader('X-Cache-Idempotent', 'HIT');
        return res.status(cachedResponse.status).json(cachedResponse.body);
      }

      // Registrar estado en progreso
      await setCache(cacheKey, 'IN_PROGRESS', 60); // 60 segundos de bloqueo mutuo

      // Interceptar la respuesta de Express para guardarla una vez finalizada
      const originalJson = res.json;
      
      res.json = function (body) {
        const status = res.statusCode || 200;
        
        // Solo cachear respuestas exitosas (2xx) para permitir reintentos en caso de errores temporales (5xx, 4xx)
        if (status >= 200 && status < 300) {
          setCache(cacheKey, { status, body }, 3600).catch(() => {}); // 1 hora de caché
        } else {
          // Si falló, liberamos la llave de idempotencia para que puedan reintentar de inmediato
          delCache(cacheKey).catch(() => {});
        }

        return originalJson.call(this, body);
      };

      // Si ocurre un error antes de responder, liberamos la llave
      res.on('finish', () => {
        // En caso de que se haya respondido de otra forma que no sea JSON
        if (res.statusCode >= 300) {
          delCache(cacheKey).catch(() => {});
        }
      });

      next();
    } catch (err) {
      console.error('[idempotency] Error en middleware:', err);
      next();
    }
  };
}
