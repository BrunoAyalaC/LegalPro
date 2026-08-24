/**
 * horas.js — Control de Horas (/api/horas)
 *
 * Registro de tiempo trabajado por abogado (user_id) en expedientes de su
 * organización. Multi-tenant REAL: authMiddleware + tenantMiddleware +
 * tenantQuery (RLS como defensa en profundidad) — mismo patrón que clientes.js.
 *
 * Endpoints:
 *   GET    /api/horas?mes=YYYY-MM        → horas del mes agrupadas por expediente
 *   GET    /api/horas/detalle?mes=YYYY-MM → registros individuales del mes (para borrar)
 *   POST   /api/horas/registro           → crea registro (Zod + FK validada)
 *   DELETE /api/horas/registro/:id       → elimina SOLO un registro propio (user_id = JWT)
 *   GET    /api/horas/resumen?anio=YYYY  → total minutos por mes del año (gráfico)
 */
import { Router } from 'express';
import { tenantQuery } from '../db.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
import { validate, validateQuery } from '../middleware/validate.js';
import {
  horaRegistroSchema,
  horasMesQuerySchema,
  horasAnioQuerySchema,
} from '../schemas/horaSchema.js';
import { logAudit } from '../utils/audit.js';

const router = Router();

// Multi-tenant obligatorio: sin auth y org no hay datos que mostrar.
router.use(authMiddleware, tenantMiddleware);

// ── GET /api/horas?mes=YYYY-MM ────────────────────────────────────────────────
// Horas del mes del usuario autenticado agrupadas por expediente.
// LEFT JOIN: si el expediente fue borrado (ON DELETE CASCADE borra los logs,
// pero ante drift de datos mostramos un título neutro en vez de perder horas).
router.get('/', validateQuery(horasMesQuerySchema), async (req, res, next) => {
  try {
    const { rows } = await tenantQuery(
      `SELECT t.expediente_id AS "expedienteId",
              COALESCE(e.titulo, 'Expediente eliminado') AS titulo,
              SUM(t.minutos)::INT AS minutos,
              COUNT(*)::INT AS registros
       FROM time_logs t
       LEFT JOIN expedientes e ON e.id = t.expediente_id
       WHERE t.organization_id = $1
         AND t.user_id = $2
         AND to_char(t.fecha, 'YYYY-MM') = $3
       GROUP BY t.expediente_id, e.titulo
       ORDER BY minutos DESC`,
      [req.user.organization_id, req.user.sub, req.query.mes]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── GET /api/horas/detalle?mes=YYYY-MM ───────────────────────────────────────
// Registros individuales del mes (el frontend los lista con botón eliminar).
router.get('/detalle', validateQuery(horasMesQuerySchema), async (req, res, next) => {
  try {
    const { rows } = await tenantQuery(
      `SELECT t.id,
              t.expediente_id AS "expedienteId",
              COALESCE(e.titulo, 'Expediente eliminado') AS titulo,
              t.descripcion,
              t.minutos,
              to_char(t.fecha, 'YYYY-MM-DD') AS fecha,
              t.created_at AS "createdAt"
       FROM time_logs t
       LEFT JOIN expedientes e ON e.id = t.expediente_id
       WHERE t.organization_id = $1
         AND t.user_id = $2
         AND to_char(t.fecha, 'YYYY-MM') = $3
       ORDER BY t.fecha DESC, t.created_at DESC`,
      [req.user.organization_id, req.user.sub, req.query.mes]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── GET /api/horas/resumen?anio=YYYY ─────────────────────────────────────────
// Total de minutos por mes del año del usuario autenticado (barras simples).
router.get('/resumen', validateQuery(horasAnioQuerySchema), async (req, res, next) => {
  try {
    const anio = parseInt(req.query.anio, 10);
    const { rows } = await tenantQuery(
      `SELECT EXTRACT(MONTH FROM fecha)::INT AS mes,
              SUM(minutos)::INT AS minutos,
              COUNT(*)::INT AS registros
       FROM time_logs
       WHERE organization_id = $1
         AND user_id = $2
         AND fecha >= make_date($3, 1, 1)
         AND fecha <  make_date($3 + 1, 1, 1)
       GROUP BY 1
       ORDER BY 1`,
      [req.user.organization_id, req.user.sub, anio]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── POST /api/horas/registro ─────────────────────────────────────────────────
// Crea un registro. El expediente DEBE pertenecer a la organización del JWT
// (la FK global no basta: impediría cross-tenant pero no validaría pertenencia).
router.post('/registro', validate(horaRegistroSchema), async (req, res, next) => {
  try {
    const { expediente_id, descripcion, minutos, fecha } = req.body;

    const exp = await tenantQuery(
      `SELECT id FROM expedientes
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [expediente_id, req.user.organization_id]
    );
    if (exp.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Expediente no encontrado' });
    }

    const { rows } = await tenantQuery(
      `INSERT INTO time_logs (organization_id, user_id, expediente_id, descripcion, minutos, fecha)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, expediente_id AS "expedienteId", descripcion, minutos,
                 to_char(fecha, 'YYYY-MM-DD') AS fecha, created_at AS "createdAt"`,
      [req.user.organization_id, req.user.sub, expediente_id, descripcion, minutos, fecha]
    );

    // Audit event (fire-and-forget): mutación de datos de actividad laboral
    logAudit('TIME_LOG_CREATE', {
      severity: 'INFO',
      userId: req.user.sub,
      organizationId: req.user.organization_id,
      resourceType: 'time_log',
      resourceId: String(rows[0]?.id ?? ''),
      metadata: { expediente_id, minutos, fecha },
    }).catch(() => {});

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// ── DELETE /api/horas/registro/:id ───────────────────────────────────────────
// Solo el autor puede borrar su registro (user_id = sub del JWT), dentro de su org.
router.delete('/registro/:id', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    const { rows } = await tenantQuery(
      `DELETE FROM time_logs
       WHERE id = $1 AND organization_id = $2 AND user_id = $3
       RETURNING id`,
      [id, req.user.organization_id, req.user.sub]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Registro no encontrado' });
    }

    logAudit('TIME_LOG_DELETE', {
      severity: 'INFO',
      userId: req.user.sub,
      organizationId: req.user.organization_id,
      resourceType: 'time_log',
      resourceId: String(id),
    }).catch(() => {});

    res.json({ success: true, message: 'Registro eliminado' });
  } catch (err) { next(err); }
});

export default router;
