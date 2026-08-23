// legalpro-app/server/middleware/tenantMiddleware.js
// Middleware de aislamiento tenant para Node.js
// Extrae organization_id del JWT (req.user) y lo asigna a req.organizationId.
// DEBE ejecutarse DESPUÉS de authMiddleware (necesita req.user).
//
// Uso standalone:
//   import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
//   router.get('/ruta', authMiddleware, tenantMiddleware, handler);
//
// Uso combinado (re-exportado desde authMiddleware):
//   import { requireTenant } from '../middleware/authMiddleware.js';

/**
 * Middleware de aislamiento tenant.
 * Requiere que el JWT contenga organization_id.
 * Agrega req.organizationId para que las rutas lo usen directamente.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
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
 * Uso: import { requireTenant } from './tenantMiddleware.js';
 *       router.get('/ruta', ...requireTenant, handler)
 */
export { requireTenant } from './authMiddleware.js';

export default tenantMiddleware;
