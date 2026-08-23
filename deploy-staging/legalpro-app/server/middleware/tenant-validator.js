// legalpro-app/server/middleware/tenant-validator.js
// Generado por @backend-node + @refutador-seguridad
// FIX CRITICAL: Valida que TODA operacion de lectura/escritura valide organization_id
// Anti-IDOR: previene que un usuario de Org A acceda a datos de Org B

import db from '../db.js';
import { logAudit } from '../utils/audit.js';

const TENANT_PROTECTED_TABLES = new Set([
  'usuarios', 'expedientes', 'documentos', 'consentimientos',
  'organizaciones', 'planes_suscripcion', 'transacciones_creditos',
  'mensajes_chat', 'escritos_legales', 'analisis_ia', 'evidencia',
  'notificaciones_sinoe', 'pagos', 'facturas', 'auditorias',
  'consentimientos_arc0', 'solicitudes_arco'
]);

const PII_TABLES = new Set([
  'usuarios', 'consentimientos', 'documentos', 'expedientes',
  'evidencia', 'escritos_legales'
]);

/**
 * Middleware que valida que el recurso solicitado pertenece al tenant del JWT.
 * USO: router.get('/api/expedientes/:id', authenticateUser, requireTenantAccess('expedientes'), handler);
 */
export function requireTenantAccess(tableName, options = {}) {
  if (!TENANT_PROTECTED_TABLES.has(tableName)) {
    throw new Error(`Tabla no protegida: ${tableName}. Agregar a TENANT_PROTECTED_TABLES.`);
  }
  const isPii = PII_TABLES.has(tableName);

  return async (req, res, next) => {
    try {
      const resourceId = req.params.id || req.params[options.idParam || 'id'];
      if (!resourceId) {
        return res.status(400).json({ success: false, error: 'ID required' });
      }

      const { organizationId, userId } = req.user;
      if (!organizationId) {
        await logAudit('TENANT_VIOLATION_NO_ORG', {
          severity: 'ERROR',
          userId,
          ip: req.ip,
          table: tableName,
          resourceId
        });
        return res.status(403).json({ success: false, error: 'Forbidden: no tenant in JWT' });
      }

      // Solo UUID validos
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resourceId)) {
        return res.status(400).json({ success: false, error: 'Invalid ID format' });
      }

      // Query parametrizada con tenant_id
      const query = `SELECT id, organization_id FROM ${tableName} WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`;
      const { rows } = await db.query(query, [resourceId, organizationId]);
      if (rows.length === 0) {
        await logAudit('TENANT_VIOLATION', {
          severity: 'ERROR',
          userId,
          organizationId,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          table: tableName,
          resourceId,
          piiAccess: isPii
        });
        return res.status(404).json({ success: false, error: 'Resource not found' });
      }

      req.tenantValidated = { resource: rows[0], isPii, table: tableName };
      next();
    } catch (e) {
      console.error('[tenant-validator] error:', e);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  };
}

/**
 * Valida que TODAS las queries de listado incluyan filtro por organization_id
 * USO: db.query(sql, params, { requireTenant: req.user.organizationId })
 */
export function requireTenantInQuery(sql, organizationId) {
  if (!organizationId) {
    throw new Error('organizationId required for tenant-protected query');
  }
  if (!TENANT_PROTECTED_TABLES) return sql;

  // Detectar tablas en el SQL
  const tablesInQuery = [];
  for (const table of TENANT_PROTECTED_TABLES) {
    const regex = new RegExp(`\\b(FROM|JOIN|UPDATE|INTO)\\s+${table}\\b`, 'gi');
    if (regex.test(sql)) {
      tablesInQuery.push(table);
    }
  }

  if (tablesInQuery.length === 0) return sql;

  // Verificar que organization_id este en el WHERE
  const lowerSql = sql.toLowerCase();
  if (lowerSql.includes('organization_id')) return sql;

  throw new Error(
    `Tenant violation: SQL no incluye filtro organization_id para tablas: ${tablesInQuery.join(', ')}. ` +
    'Esto es una proteccion contra IDOR cross-tenant.'
  );
}

export { TENANT_PROTECTED_TABLES, PII_TABLES };
export default requireTenantAccess;
