// legalpro-app/server/utils/audit.js
// Sistema de auditoría para LegalPro
// Registra eventos importantes con severidad para cumplimiento LPDP y OWASP A09

import logger, { maskPII } from '../logger.js';

/**
 * Registra un evento de auditoría
 * @param {string} eventName - Nombre del evento (ej: 'LEGAL_QUERY_PROCESSED')
 * @param {object} payload - Datos del evento
 * @param {string} payload.severity - DEBUG|INFO|WARNING|ERROR|CRITICAL
 * @param {string} payload.userId - ID del usuario
 * @param {string} payload.organizationId - ID de la organización
 * @param {string} payload.ip - Dirección IP
 * @param {string} payload.query - Consulta del usuario (truncado a 200 chars)
 * @param {any} payload... - Otros campos
 */
export async function logAudit(eventName, payload = {}) {
  const { severity = 'INFO', userId, organizationId, ip, ...rest } = payload;

  // Sanitizar: no loguear PII sensible en texto plano + maskPII (DNI, email, telefono) LPDP
  const sanitizedRaw = { ...rest };
  if (sanitizedRaw.query && typeof sanitizedRaw.query === 'string') {
    sanitizedRaw.query = sanitizedRaw.query.slice(0, 200);
  }
  if (sanitizedRaw.token) sanitizedRaw.token = '[REDACTED]';
  if (sanitizedRaw.password) sanitizedRaw.password = '[REDACTED]';
  if (sanitizedRaw.secret) sanitizedRaw.secret = '[REDACTED]';
  // Mask PII en todos los campos (DNI 8dig, email, telefono 9dig) antes de log e INSERT
  const sanitized = maskPII(sanitizedRaw);

  const entry = {
    event: eventName,
    severity,
    timestamp: new Date().toISOString(),
    userId: userId || '[anonymous]',
    organizationId: organizationId || '[none]',
    ip: ip || '[unknown]',
    ...sanitized
  };

  // Log estructurado
  logger.info({ ...entry, type: 'audit' }, `[AUDIT] ${eventName}`);

  // En producción, también insertar en la tabla audit_log si está disponible
  try {
    const { default: db } = await import('../db.js');
    // FIX P1-B: organization_id es NOT NULL en audit_log. Los eventos globales
    // del sistema (organizationId null) usan el UUID cero como marcador de
    // "sistema global" para que el INSERT nunca falle por constraint.
    const ORG_GLOBAL_UUID = '00000000-0000-0000-0000-000000000000';
    await db.query(
      `INSERT INTO audit_log (tabla, operacion, registro_id, datos_anteriores, datos_nuevos, usuario_id, organization_id, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        'audit',
        'INSERT',
        eventName,
        null,
        JSON.stringify(sanitized),
        userId || null,
        organizationId || ORG_GLOBAL_UUID,
        ip || null,
        'internal'
      ]
    );
  } catch (dbError) {
    // FIX P1-B: un fallo de auditoría NUNCA debe ser silencioso (OWASP A09).
    // Si la tabla no existe o la DB no está disponible, se registra como error.
    logger.error(
      { err: dbError.message, event: eventName, severity },
      '[audit] DB insert failed — evento de auditoría NO persistido'
    );
  }
}

/**
 * Versión sincrónica para casos donde async no es posible
 */
export function logAuditSync(eventName, payload = {}) {
  const { severity = 'INFO', userId, ...rest } = payload;
  logger.info({ event: eventName, severity, userId, ...rest, type: 'audit' }, `[AUDIT] ${eventName}`);
}

export default { logAudit, logAuditSync };
