// Plantilla ruta Express 5 ESM
// Ruta: legalpro-app/server/routes/xxx.js

import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
import { requireRole } from '../middleware/authMiddleware.js';
import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { db } from '../db.js';
import { logAudit } from '../utils/audit.js';

const router = Router();

const createXxxSchema = z.object({
  nombre: z.string().min(1).max(200),
  descripcion: z.string().max(2000).optional()
});

// GET /api/xxx
router.get('/',
  authMiddleware,
  tenantMiddleware,
  async (req, res) => {
    const { organizationId } = req.user;
    const { rows } = await db.query(
      'SELECT * FROM xxxs WHERE organization_id = $1 AND deleted_at IS NULL',
      [organizationId]
    );
    res.json({ success: true, data: rows });
  }
);

// GET /api/xxx/:id
router.get('/:id',
  authMiddleware,
  tenantMiddleware,
  async (req, res) => {
    const { id } = req.params;
    const { organizationId } = req.user;
    const { rows } = await db.query(
      'SELECT * FROM xxxs WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [id, organizationId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    res.json({ success: true, data: rows[0] });
  }
);

// POST /api/xxx
router.post('/',
  authMiddleware,
  tenantMiddleware,
  requireRole(['ABOGADO', 'FISCAL']),
  idempotencyMiddleware,
  validate(createXxxSchema),
  async (req, res) => {
    const { organizationId, userId } = req.user;
    const { nombre, descripcion } = req.body;
    const { rows } = await db.query(
      `INSERT INTO xxxs (id, organization_id, nombre, descripcion, created_at, created_by)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW(), $4)
       RETURNING *`,
      [organizationId, nombre, descripcion, userId]
    );
    await logAudit({
      organizationId,
      userId,
      eventName: 'RESOURCE_CREATE',
      severity: 'INFO',
      tableName: 'xxxs',
      recordKey: rows[0].id
    });
    res.status(201).json({ success: true, data: rows[0] });
  }
);

export default router;
