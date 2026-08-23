// legalpro-app/server/utils/audit.js
// Sistema de auditoría para LegalPro
// Registra eventos importantes con severidad para cumplimiento LPDP y OWASP A09

import logger from '../logger.js';

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

  // Sanitizar: no loguear PII sensible en texto plano
  const sanitized = { ...rest };
  if (sanitized.query && typeof sanitized.query === 'string') {
    sanitized.query = sanitized.query.slice(0, 200);
  }
  if (sanitized.token) sanitized.token = '[REDACTED]';
  if (sanitized.password) sanitized.password = '[REDACTED]';
  if (sanitized.secret) sanitized.secret = '[REDACTED]';

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
    await db.query(
      `INSERT INTO audit_log (evento, severidad, usuario_id, organization_id, ip, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        eventName,
        severity,
        userId || null,
        organizationId || null,
        ip || null,
        JSON.stringify(sanitized)
      ]
    );
  } catch (dbError) {
    // Fallback silencioso: si la tabla no existe o DB no disponible, solo log
    logger.debug({ err: dbError.message }, '[audit] DB insert failed (non-critical)');
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
