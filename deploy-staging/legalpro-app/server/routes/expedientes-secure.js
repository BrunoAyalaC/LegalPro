// legalpro-app/server/routes/expedientes-secure.js
// Generado por @backend-node
// FIX CRITICAL: Aplica tenant-validator a TODOS los endpoints
// Reemplaza al routes/expedientes.js original

import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/authMiddleware.js';
import { requireTenantAccess } from '../middleware/tenant-validator.js';
import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import db from '../db.js';
import { logAudit } from '../utils/audit.js';

const router = Router();

const createExpedienteSchema = z.object({
  numero: z.string().min(1).max(50),
  titulo: z.string().min(1).max(500),
  materia: z.enum(['penal', 'civil', 'laboral', 'constitucional', 'familia', 'administrativo', 'tributario', 'mercantil']),
  partes: z.object({}).passthrough().optional(),
  hechos: z.string().max(10000).optional(),
  es_urgente: z.boolean().optional(),
  es_dato_sensible: z.boolean().optional()
});

// GET /api/expedientes - Listar (con tenant filter automatico)
router.get('/',
  authMiddleware,
  async (req, res) => {
    try {
      const { organizationId } = req.user;
      const { limit = 50, offset = 0, materia, search, estado } = req.query;
      const params = [organizationId];
      let where = 'organization_id = $1 AND deleted_at IS NULL';
      let paramIdx = 2;
      if (estado) { where += ` AND estado = $${paramIdx++}`; params.push(estado); }
      if (materia) { where += ` AND materia = $${paramIdx++}`; params.push(materia); }
      if (search) { where += ` AND (titulo ILIKE $${paramIdx} OR numero ILIKE $${paramIdx})`; params.push(`%${search}%`); paramIdx++; }
      params.push(parseInt(limit), parseInt(offset));
      const { rows } = await db.query(
        `SELECT id, numero, titulo, materia, estado, partes, es_urgente, es_dato_sensible, created_at
         FROM expedientes WHERE ${where}
         ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
        params
      );
      res.json({ success: true, data: { items: rows, total: rows.length } });
    } catch (e) {
      console.error('[expedientes.list]', e);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  }
);

// GET /api/expedientes/:id - Con tenant validator (FIX IDOR)
router.get('/:id',
  authMiddleware,
  requireTenantAccess('expedientes'),
  async (req, res) => {
    try {
      const { organizationId } = req.user;
      const { rows } = await db.query(
        `SELECT * FROM expedientes WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
        [req.params.id, organizationId]
      );
      res.json({ success: true, data: rows[0] });
    } catch (e) {
      console.error('[expedientes.get]', e);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  }
);

// POST /api/expedientes - Crear (automatica-mente con organization_id del JWT)
router.post('/',
  authMiddleware,
  requireRole(['ABOGADO', 'FISCAL', 'JUEZ', 'ADMIN']),
  idempotencyMiddleware,
  validate(createExpedienteSchema),
  async (req, res) => {
    try {
      const { organizationId, userId } = req.user;
      const { numero, titulo, materia, partes, hechos, es_urgente, es_dato_sensible } = req.body;
      const { rows } = await db.query(
        `INSERT INTO expedientes (id, organization_id, user_id, numero, titulo, materia, estado, partes, hechos, es_urgente, es_dato_sensible, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'activo', $6, $7, COALESCE($8, false), COALESCE($9, false), NOW())
         RETURNING *`,
        [organizationId, userId, numero, titulo, materia, JSON.stringify(partes || {}), hechos, es_urgente, es_dato_sensible]
      );
      await logAudit('RESOURCE_CREATE', {
        severity: 'INFO',
        userId,
        organizationId,
        ip: req.ip,
        tableName: 'expedientes',
        recordKey: rows[0].id,
        pii: es_dato_sensible === true
      });
      if (es_dato_sensible) {
        await logAudit('LPDP_SENSITIVE_DATA_CREATED', {
          severity: 'HIGH',
          userId,
          organizationId,
          ip: req.ip,
          expedienteId: rows[0].id
        });
      }
      res.status(201).json({ success: true, data: rows[0] });
    } catch (e) {
      console.error('[expedientes.create]', e);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  }
);

// PUT /api/expedientes/:id - Con tenant validator
router.put('/:id',
  authMiddleware,
  requireTenantAccess('expedientes'),
  requireRole(['ABOGADO', 'FISCAL', 'JUEZ', 'ADMIN']),
  validate(createExpedienteSchema.partial()),
  async (req, res) => {
    try {
      const { organizationId, userId } = req.user;
      const fields = [];
      const values = [];
      let idx = 1;
      for (const key of ['titulo', 'materia', 'partes', 'hechos', 'estado', 'es_urgente']) {
        if (req.body[key] !== undefined) {
          fields.push(`${key} = $${idx++}`);
          values.push(key === 'partes' ? JSON.stringify(req.body[key]) : req.body[key]);
        }
      }
      if (fields.length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });
      values.push(req.params.id, organizationId);
      const { rows } = await db.query(
        `UPDATE expedientes SET ${fields.join(', ')}, updated_at = NOW()
         WHERE id = $${idx++} AND organization_id = $${idx} AND deleted_at IS NULL
         RETURNING *`,
        values
      );
      await logAudit('RESOURCE_UPDATE', {
        severity: 'INFO',
        userId,
        organizationId,
        ip: req.ip,
        tableName: 'expedientes',
        recordKey: req.params.id
      });
      res.json({ success: true, data: rows[0] });
    } catch (e) {
      console.error('[expedientes.update]', e);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  }
);

// DELETE /api/expedientes/:id - Soft delete con tenant validator
router.delete('/:id',
  authMiddleware,
  requireTenantAccess('expedientes'),
  requireRole(['ABOGADO', 'FISCAL', 'ADMIN']),
  async (req, res) => {
    try {
      const { organizationId, userId } = req.user;
      const { rows } = await db.query(
        `UPDATE expedientes SET deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
         RETURNING id`,
        [req.params.id, organizationId]
      );
      if (rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
      await logAudit('RESOURCE_DELETE', {
        severity: 'INFO',
        userId,
        organizationId,
        ip: req.ip,
        tableName: 'expedientes',
        recordKey: req.params.id
      });
      res.json({ success: true });
    } catch (e) {
      console.error('[expedientes.delete]', e);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  }
);

export default router;
