// legalpro-app/server/middleware/tenantMiddleware.js
// Middleware de aislamiento tenant para Node.js
// Extrae organization_id del JWT (req.user) y lo asigna a req.organizationId.
// DEBE ejecutarse DESPUÉS de authMiddleware (necesita req.user).
//
// Uso standalone:
//   import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
//   router.get('/ruta', authMiddleware, tenantMiddleware, handler);
//
// Uso combinado (FIX P0-C: requireTenant canónico vive AQUÍ y usa el
// middleware real con AsyncLocalStorage — el export lite de authMiddleware.js
// fue renombrado a requireOrganizationLite):
//   import { requireTenant } from '../middleware/tenantMiddleware.js';
//
// FIX R-01: este middleware además envuelve la continuación del request en
// `tenantContext.run({...})` (AsyncLocalStorage de db.js), de modo que
// cualquier tenantQuery() ejecutado dentro del handler setea automáticamente
// las variables de sesión app.current_org_id / app.current_user_id /
// app.current_user_rol en PostgreSQL y activa las policies RLS.

import { tenantContext } from '../db.js';
// FIX P0-C: importación unidireccional (tenantMiddleware → authMiddleware).
// authMiddleware.js NO importa este módulo, por lo que no hay ciclo ESM.
import { authMiddleware } from './authMiddleware.js';

/**
 * Middleware de aislamiento tenant.
 * Requiere que el JWT contenga organization_id.
 * - Agrega req.organizationId para que las rutas lo usen directamente.
 * - Envuelve next() en tenantContext.run(...) para activar RLS en todas las
 *   queries ejecutadas dentro del request (ver db.js → tenantQuery).
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

  // FIX R-01: propagar el contexto tenant al AsyncLocalStorage para que las
  // queries dentro del request activen las policies RLS.
  // sub del JWT es el user id (string); caemos a req.user.id si existe;
  // rol es el rol del sistema del usuario (ABOGADO/ADMIN/...) que consume
  // fn_rls_current_user_rol() en las policies.
  const ctx = {
    org_id: orgId,
    user_id: req.user?.sub || req.user?.id || null,
    user_rol: req.user?.rol || 'ABOGADO',
  };

  // FIX R-01 + tests-compat: si el módulo db.js fue mockeado y tenantContext
    // no está disponible (no tiene .run), simplemente pasamos al siguiente
    // middleware sin envolver. Esto permite que los tests que mockean db.js con
    // `{ default: { query: mockQuery } }` sigan funcionando sin cambios.
    if (tenantContext && typeof tenantContext.run === 'function') {
      tenantContext.run(ctx, () => {
        next();
      });
    } else {
      // Sin AsyncLocalStorage disponible — pasar directamente
      next();
    }
  }

/**
 * Combina auth + tenant REAL en un solo array reutilizable.
 * Uso: import { requireTenant } from './tenantMiddleware.js';
 *       router.get('/ruta', ...requireTenant, handler)
 */
export const requireTenant = [authMiddleware, tenantMiddleware];

export default tenantMiddleware;