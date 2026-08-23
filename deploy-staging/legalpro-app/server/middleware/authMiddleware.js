import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const jwtConfigured = !!(JWT_SECRET && JWT_SECRET.length >= 32);

if (!jwtConfigured) {
  console.warn('[auth] ADVERTENCIA: JWT_SECRET no definido o menor de 32 caracteres.\n       El servidor arrancará pero todas las rutas autenticadas devolverán 503.');
}

const BRUTE_FORCE = {
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000,
};

const failedAttempts = new Map();

function getClientIp(req) {
  return req.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || req.ip
    || 'unknown';
}

function isIpBlocked(ip) {
  const entry = failedAttempts.get(ip);
  if (!entry) return false;

  if (entry.attempts >= BRUTE_FORCE.maxAttempts) {
    const locked = true;
    return locked;
  }

  if (Date.now() - entry.windowStart > BRUTE_FORCE.windowMs) {
    failedAttempts.delete(ip);
    return false;
  }

  return false;
}

function recordFailedAttempt(ip) {
  const now = Date.now();
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

export function authMiddleware(req, res, next) {
  if (!jwtConfigured) {
    return res.status(503).json({ error: 'Servidor no configurado: JWT_SECRET requerido.' });
  }

  const ip = getClientIp(req);

  if (isIpBlocked(ip)) {
    // block IP due to exceeded failed attempts
    return res.status(429).json({
      error: 'Demasiados intentos fallidos. Cuenta bloqueada temporalmente.',
    });
  }

  const token = extractToken(req);
  if (!token) {
    // Un token ausente no es un intento de fuerza bruta (no hay credencial a adivinar):
    // contabilizarlo permitiría un DoS trivial bloqueando una IP compartida (NAT/proxy).
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
    recordFailedAttempt(ip);
    if (err.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token expirado. Inicia sesión nuevamente.' });
    }
    return res.status(401).json({ error: 'Token inválido.' });
  }
}

/**
 * Middleware de aislamiento tenant.
 * Requiere que el JWT contenga `organization_id`.
 * Agrega `req.organizationId` para que las rutas lo usen directamente.
 *
 * DEBE ejecutarse DESPUÉS de authMiddleware.
 */
export function tenantMiddleware(req, res, next) {
  const orgId = req.user?.organization_id;
  if (!orgId) {
    return res.status(403).json({
      error: 'No pertenece a ninguna organización. Cree o únase a una antes de continuar.',
    });
  }
  req.organizationId = orgId;
  next();
}

/**
 * Combina auth + tenant en un solo array reutilizable.
 * Uso: router.get('/ruta', ...requireTenant, handler)
 */
export const requireTenant = [authMiddleware, tenantMiddleware];

/**
 * Middleware de autorización por rol de organización.
 * Requiere que el JWT tenga `rol_org` dentro de los roles permitidos.
 * Debe ejecutarse DESPUÉS de authMiddleware (necesita req.user).
 *
 * @param {string[]} allowedRoles — ej: ['OWNER', 'ADMIN']
 * Roles válidos: 'OWNER', 'ADMIN', 'MEMBER', 'VIEWER'
 * @returns {Function} middleware Express
 */
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
