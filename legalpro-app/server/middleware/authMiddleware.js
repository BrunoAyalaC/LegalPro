import jwt from 'jsonwebtoken';
import * as cache from '../cache.js';

// FIX TEST-REGRESSION (2026-08-22): lectura LAZY del secreto por invocación.
// Antes se congelaba al importar (module-level) → en vitest (sin .env cargado)
// jwtConfigured=false y TODA la suite RBAC recibía 503 en vez de 401/403.
// Semántica prod idéntica: sin JWT_SECRET válido → 503 fail-closed por request.
function getJwtSecret() {
  return process.env.JWT_SECRET;
}
function jwtConfigured() {
  const s = getJwtSecret();
  return !!(s && s.length >= 32);
}

if (!jwtConfigured()) {
  console.warn('[auth] ADVERTENCIA: JWT_SECRET no definido o menor de 32 caracteres.\n       El servidor arrancará pero todas las rutas autenticadas devolverán 503.');
}

const BRUTE_FORCE = {
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'auth:brute:',
};

const failedAttempts = new Map();

// Fallback sweep for memory
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of failedAttempts) {
    if (now - entry.windowStart > BRUTE_FORCE.windowMs) failedAttempts.delete(ip);
  }
}, SWEEP_INTERVAL_MS);
sweepTimer.unref?.();

// FIX MEDIUM: no confiar ciegamente en x-forwarded-for (spoofable). Express
// con app.set('trust proxy', 1) ya resuelve req.ip desde el proxy de confianza
// (Railway = 1 hop); sin esa config, req.ip = IP del socket (seguro por defecto).
// ⚠ index.js DEBE tener: app.set('trust proxy', 1);
function getClientIp(req) {
  return req.ip
    || req.socket?.remoteAddress
    || 'unknown';
}

function getCacheKey(ip) {
  return `${BRUTE_FORCE.keyPrefix}${ip}`;
}

async function isIpBlocked(ip) {
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
  } catch { /* fallback */ }
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
      // FIX MEDIUM (fail-open): espejo SIEMPRE en memoria con la misma lógica
      // de ventana. Si Redis cae a mitad de ventana, isIpBlocked cae al Map
      // y el contador no se pierde (fail-closed).
      if (!entry || (now - entry.windowStart > BRUTE_FORCE.windowMs)) {
        const next = { attempts: 1, windowStart: now };
        await cache.set(getCacheKey(ip), next, ttlSeconds);
        failedAttempts.set(ip, next);
      } else {
        const next = { attempts: entry.attempts + 1, windowStart: entry.windowStart };
        await cache.set(getCacheKey(ip), next, ttlSeconds);
        failedAttempts.set(ip, next);
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

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  if (req.cookies?.token) return req.cookies.token;
  return null;
}

export async function authMiddleware(req, res, next) {
  const JWT_SECRET = getJwtSecret();
  if (!jwtConfigured()) {
    return res.status(503).json({ error: 'Servidor no configurado: JWT_SECRET requerido.' });
  }

  const ip = getClientIp(req);

  if (await isIpBlocked(ip)) {
    return res.status(429).json({
      success: false,
      error: 'Demasiados intentos fallidos. Cuenta bloqueada temporalmente.',
      code: 'BRUTE_FORCE_BLOCKED',
      retryAfter: Math.ceil(BRUTE_FORCE.windowMs / 1000),
    });
  }

  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Token de autenticación requerido.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: 'LegalProAPI',
      audience: 'LegalProClients',
    });
    req.user = payload;
    next();
  } catch (err) {
    await recordFailedAttempt(ip).catch(() => {});
    if (err.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token expirado. Inicia sesión nuevamente.' });
    }
    return res.status(401).json({ error: 'Token inválido.' });
  }
}

/**
 * [FIX P0-C] Middleware de aislamiento tenant LITE — renombrado desde
 * `tenantMiddleware` para dejar claro que es la versión SIN AsyncLocalStorage.
 * Solo agrega `req.organizationId` desde el JWT. NO envuelve next() en
 * tenantContext.run(...) → NO activa las policies RLS en PostgreSQL.
 *
 * ⚠ USO RESTRINGIDO: health checks, rutas públicas y tests unitarios.
 * Para cualquier ruta protegida usar SIEMPRE el middleware real:
 *   import { tenantMiddleware } from './tenantMiddleware.js';
 */
export function requireOrganizationLite(req, res, next) {
  const orgId = req.user?.organization_id;
  if (!orgId) {
    return res.status(403).json({
      error: 'No pertenece a ninguna organización. Cree o únase a una antes de continuar.',
    });
  }
  req.organizationId = orgId;
  next();
}

// FIX P0-C: el combo canónico `requireTenant` ya NO se define aquí (usaba la
// versión lite sin RLS). Vive ahora en middleware/tenantMiddleware.js, que lo
// construye con el middleware real: [authMiddleware, tenantMiddleware].

export function requireRole(allowedRoles) {
  return function (req, res, next) {
    const rolOrg = req.user?.rol_org;
    if (!rolOrg) {
      return res.status(403).json({
        error: 'No tiene rol asignado en la organización.',
      });
    }
    if (!allowedRoles.map(r => r.toUpperCase()).includes(rolOrg.toUpperCase())) {
      return res.status(403).json({
        error: `Permisos insuficientes. Se requiere uno de: ${allowedRoles.join(', ')}.`,
      });
    }
    next();
  };
}

export async function resetFailedAttempts(ip) {
  try {
    const redisAvailable = await cache.isAvailable().catch(() => false);
    if (redisAvailable) await cache.del(getCacheKey(ip)).catch(() => {});
  } catch {}
  failedAttempts.delete(ip);
}
