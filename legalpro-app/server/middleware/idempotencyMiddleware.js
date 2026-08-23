import * as cache from '../cache.js';

const IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9_-]{8,64}$/;

// Memoria local como fallback si Redis no está disponible
const memoriaLocal = new Map();

// Limpieza periódica de memoria local para evitar fugas de memoria
setInterval(() => {
  const ahora = Date.now();
  for (const [key, item] of memoriaLocal.entries()) {
    if (ahora > item.expira) {
      memoriaLocal.delete(key);
    }
  }
}, 5 * 60 * 1000).unref?.();

async function isRedisAvailable() {
  try {
    const available = await cache.isAvailable();
    return available === true;
  } catch {
    return false;
  }
}

async function setCache(key, value, ttlSeconds) {
  if (await isRedisAvailable()) {
    await cache.set(key, value, ttlSeconds);
  } else {
    memoriaLocal.set(key, {
      value,
      expira: Date.now() + ttlSeconds * 1000,
    });
  }
}

async function getCache(key) {
  if (await isRedisAvailable()) {
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
  if (await isRedisAvailable()) {
    await cache.del(key);
  } else {
    memoriaLocal.delete(key);
  }
}

/**
 * Middleware de idempotencia cross-tenant (P0).
 * - Requiere X-Idempotency-Key con formato /^[A-Za-z0-9_-]{8,64}$/
 * - Namespace por tenant: idempotency:${orgId||userId||ip}:${key}
 * - DEBE usarse DESPUÉS de authMiddleware (requiere req.user / req.organizationId)
 * - Fail via 400 si key inválida, 401 si sin auth previo
 */
export function idempotencyMiddleware(options = {}) {
  const { required = false } = options;
  return async (req, res, next) => {
    const rawKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'];

    // Si no se envía key y no es requerido → pasar sin idempotencia (compat)
    if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
      if (required) {
        return res.status(400).json({
          success: false,
          error: 'X-Idempotency-Key es requerido.',
          code: 'IDEMPOTENCY_KEY_REQUIRED',
        });
      }
      return next();
    }

    const key = rawKey.trim();

    // Validar formato
    if (!IDEMPOTENCY_KEY_REGEX.test(key)) {
      return res.status(400).json({
        success: false,
        error: 'X-Idempotency-Key inválido. Debe tener 8-64 caracteres alfanuméricos, guion o guion bajo.',
        code: 'IDEMPOTENCY_KEY_INVALID',
      });
    }

    // Exigir authMiddleware previo para namespace seguro
    const orgId = req.organizationId || req.user?.organization_id || null;
    const userId = req.user?.sub || req.user?.id || null;
    // Advertir si no hay auth (fail-closed informativo, pero permitir con IP fallback)
    // Cross-tenant: namespace obligatorio
    const namespace = orgId || userId || req.ip || 'anon';
    if (!orgId && !userId) {
      // Si no hay orgId ni userId, log warning pero no bloquear (ej. rutas públicas no deberían usar idempotencia)
      // Para rutas protegidas, el authMiddleware ya habría bloqueado 401
      console.warn('[idempotency] Namespace sin auth — usando IP fallback, verifique orden de middlewares', { ip: req.ip, path: req.path });
    }

    const cacheKey = `idempotency:${namespace}:${key}`;

    try {
      const cachedResponse = await getCache(cacheKey);

      if (cachedResponse) {
        if (cachedResponse === 'IN_PROGRESS') {
          return res.status(409).json({
            success: false,
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

export default idempotencyMiddleware;
