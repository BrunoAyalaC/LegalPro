// legalpro-app/server/middleware/bruteForce.js
// Middleware de protección contra fuerza bruta en login — DISTRIBUIDO via Redis
// Bloquea IP tras N intentos fallidos en una ventana de tiempo (15 min)
// Usa cache.js (ioredis) con fallback a Map local si Redis no disponible

import * as cache from '../cache.js';

const BRUTE_FORCE = {
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000, // 15 minutos
  keyPrefix: 'brute:',
};

const failedAttempts = new Map();

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || 'unknown';
}

function getCacheKey(ip) {
  return `${BRUTE_FORCE.keyPrefix}${ip}`;
}

async function isIpBlocked(ip) {
  // 1. Intentar Redis primero (distribuido)
  try {
    const redisAvailable = await cache.isAvailable().catch(() => false);
    if (redisAvailable) {
      const entry = await cache.get(getCacheKey(ip));
      if (!entry) return false;
      if (Date.now() - entry.windowStart > BRUTE_FORCE.windowMs) {
        await cache.del(getCacheKey(ip)).catch(() => {});
        return false;
      }
      return entry.attempts >= BRUTE_FORCE.maxAttempts;
    }
  } catch { /* fallback a memoria */ }

  // 2. Fallback memoria local
  const entry = failedAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.windowStart > BRUTE_FORCE.windowMs) {
    failedAttempts.delete(ip);
    return false;
  }
  return entry.attempts >= BRUTE_FORCE.maxAttempts;
}

async function recordFailedAttempt(ip) {
  const now = Date.now();
  const ttlSeconds = Math.ceil(BRUTE_FORCE.windowMs / 1000);
  try {
    const redisAvailable = await cache.isAvailable().catch(() => false);
    if (redisAvailable) {
      const entry = await cache.get(getCacheKey(ip));
      if (!entry || (now - entry.windowStart > BRUTE_FORCE.windowMs)) {
        await cache.set(getCacheKey(ip), { attempts: 1, windowStart: now }, ttlSeconds);
      } else {
        await cache.set(getCacheKey(ip), { attempts: entry.attempts + 1, windowStart: entry.windowStart }, ttlSeconds);
      }
      return;
    }
  } catch { /* fallback */ }

  const entry = failedAttempts.get(ip);
  if (!entry || (now - entry.windowStart > BRUTE_FORCE.windowMs)) {
    failedAttempts.set(ip, { attempts: 1, windowStart: now });
  } else {
    entry.attempts += 1;
  }
}

export async function bruteForceMiddleware(req, res, next) {
  const ip = getClientIp(req);

  if (await isIpBlocked(ip)) {
    return res.status(429).json({
      success: false,
      error: 'Demasiados intentos. Cuenta bloqueada temporalmente.',
      code: 'BRUTE_FORCE_BLOCKED',
      retryAfter: Math.ceil(BRUTE_FORCE.windowMs / 1000),
    });
  }

  // Interceptar res.json para detectar fallos de autenticación
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode === 401 || (body && !body.success)) {
      recordFailedAttempt(ip).catch(() => {});
    }
    return originalJson(body);
  };

  next();
}

export async function resetFailedAttempts(ip) {
  try {
    const redisAvailable = await cache.isAvailable().catch(() => false);
    if (redisAvailable) await cache.del(getCacheKey(ip)).catch(() => {});
  } catch {}
  failedAttempts.delete(ip);
}

// Limpieza periódica de memoria local
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of failedAttempts) {
    if (now - entry.windowStart > BRUTE_FORCE.windowMs) failedAttempts.delete(ip);
  }
}, SWEEP_INTERVAL_MS);
sweepTimer.unref?.();

export default bruteForceMiddleware;
