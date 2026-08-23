import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

// GET /api/creditos/uso
router.get('/uso', async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const mesActual = new Date();
    mesActual.setDate(1);
    mesActual.setHours(0, 0, 0, 0);

    const { rows: consumo } = await db.query(
      `SELECT
        COUNT(*)::int as total_requests,
        COALESCE(SUM(total_tokens), 0)::int as total_tokens,
        COALESCE(SUM(costo_usd), 0)::float as costo_total_usd
       FROM consumo_tokens_ia
       WHERE organization_id = $1 AND created_at >= $2`,
      [orgId, mesActual]
    );

    const { rows: org } = await db.query(
      `SELECT plan, creditos_disponibles FROM organizaciones WHERE id = $1`,
      [orgId]
    );

    res.json({
      success: true,
      data: {
        plan: org[0]?.plan || 'free',
        creditos_disponibles: org[0]?.creditos_disponibles || 0,
        mes_actual: {
          desde: mesActual.toISOString(),
          total_requests: consumo[0]?.total_requests || 0,
          total_tokens: consumo[0]?.total_tokens || 0,
          costo_total_usd: consumo[0]?.costo_total_usd || 0,
        },
      },
    });
  } catch (err) { next(err); }
});

export default router;
