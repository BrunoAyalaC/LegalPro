import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const jwtConfigured = !!(JWT_SECRET && JWT_SECRET.length >= 32);

if (!jwtConfigured) {
  console.warn('[auth] ADVERTENCIA: JWT_SECRET no definido o menor de 32 caracteres.\n       El servidor arrancará pero todas las rutas autenticadas devolverán 503.');
}

/**
 * Middleware de autenticación JWT.
 * Extrae y valida el Bearer token del header Authorization.
 * Agrega `req.user` con los claims del JWT.
 *
 * Errores devueltos:
 *   401 — token ausente o inválido
 *   403 — token expirado
 *   503 — servidor mal configurado (JWT_SECRET ausente)
 */
export function authMiddleware(req, res, next) {
  if (!jwtConfigured) {
    return res.status(503).json({ error: 'Servidor no configurado: JWT_SECRET requerido.' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido.' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: 'LegalProAPI',
      audience: 'LegalProClients',
    });
    req.user = payload;
    next();
  } catch (err) {
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
