/**
 * LPDP Art. 21 — Bloquea llamadas a Gemini si el usuario no consintió
 * transferencia internacional de datos personales a Google (EE.UU.).
 */
import db from '../db.js';
import { logAudit } from '../utils/audit.js';

export function requireTransferenciaInternacional() {
  return async (req, res, next) => {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        return res.status(401).json({ error: 'Token de autenticación requerido.' });
      }

      const { rows } = await db.query(
        `SELECT
           COALESCE(acepta_transferencia_internacional, FALSE) AS flag_a,
           COALESCE(consentimiento_transferencia_internacional, FALSE) AS flag_b
         FROM usuarios
         WHERE id = $1 AND eliminado_en IS NULL`,
        [userId],
      );

      const row = rows[0];
      const consentido = row && (row.flag_a || row.flag_b);

      if (!consentido) {
        await logAudit('TRANSFERENCIA_INTERNACIONAL_DENEGADA', {
          severity: 'WARNING',
          userId,
          organizationId: req.organizationId,
          ip: req.ip,
          path: req.path,
        });
        return res.status(403).json({
          error: 'Debe aceptar la transferencia internacional de datos (Art. 21 LPDP) para usar funciones de IA.',
          code: 'TRANSFERENCIA_INTERNACIONAL_REQUIRED',
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

export default requireTransferenciaInternacional;
