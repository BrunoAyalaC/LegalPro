import { Router } from 'express';
import db from '../db.js';
// FIX P0-C: tenantMiddleware REAL (tenantContext.run + AsyncLocalStorage → RLS).
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';

const router = Router();

// Todos los endpoints exigen JWT válido + tenant activo
router.use(authMiddleware, tenantMiddleware);

// ─── GET /api/notificaciones ──────────────────────────────────────────────────
// Lista las notificaciones SINOE del usuario/tenant (más recientes primero).
router.get('/', async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const { leida, limit = 20 } = req.query;

    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    // SINOE es un monitor compartido del estudio: se filtra por tenant (organización).
    const conditions = ['organization_id = $1'];
    const params = [orgId];
    let idx = 2;

    if (leida === 'true' || leida === 'false') {
      conditions.push(`leida = $${idx++}`);
      params.push(leida === 'true');
    }

    const where = conditions.join(' AND ');
    params.push(limitNum);

    const { rows } = await db.query(
      `SELECT id, expediente_numero, tipo_notificacion, titulo, contenido,
              fecha_notificacion, leida, analisis_ia, urgencia, creado_en
         FROM notificaciones_sinoe
        WHERE ${where}
        ORDER BY fecha_notificacion DESC
        LIMIT $${idx}`,
      params
    );

    const noLeidas = rows.filter((n) => !n.leida).length;

    return res.json({ data: rows, total: rows.length, noLeidas });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/notificaciones/:id/leida ──────────────────────────────────────
// Marca una notificación como leída (idempotente).
router.patch('/:id/leida', async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;

    const { rows } = await db.query(
      `UPDATE notificaciones_sinoe
          SET leida = TRUE
        WHERE id = $1 AND organization_id = $2
        RETURNING id, leida`,
      [id, orgId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    return res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
