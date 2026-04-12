import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, tenantMiddleware, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Todos los endpoints exigen JWT válido + tenant activo
router.use(authMiddleware, tenantMiddleware);

// ─── GET /api/expedientes ─────────────────────────────────────────────────────
// Lista expedientes del tenant con filtros opcionales.
router.get('/', async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const { estado, tipo, urgente, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const conditions = ['organization_id = $1'];
    const params = [orgId];
    let idx = 2;

    if (estado) { conditions.push(`estado = $${idx++}`); params.push(estado.toLowerCase()); }
    if (tipo)   { conditions.push(`tipo = $${idx++}`);   params.push(tipo.toLowerCase()); }
    if (urgente === 'true') { conditions.push(`es_urgente = TRUE`); }

    const where = conditions.join(' AND ');

    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) AS total FROM expedientes WHERE ${where}`,
      params
    );
    const total = parseInt(countRows[0].total, 10);

    const listParams = [...params, limitNum, offset];
    const { rows: expedientes } = await db.query(
      `SELECT * FROM expedientes WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      listParams
    );

    return res.json({
      expedientes,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/expedientes/stats ───────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const orgId = req.organizationId;

    const { rows } = await db.query(
      `SELECT tipo, estado, es_urgente FROM expedientes WHERE organization_id = $1`,
      [orgId]
    );

    const stats = {
      total: rows.length,
      activos:          rows.filter(e => e.estado === 'activo').length,
      urgentes:         rows.filter(e => e.es_urgente).length,
      civiles:          rows.filter(e => e.tipo === 'civil').length,
      penales:          rows.filter(e => e.tipo === 'penal').length,
      laborales:        rows.filter(e => e.tipo === 'laboral').length,
      constitucionales: rows.filter(e => e.tipo === 'constitucional').length,
      familia:          rows.filter(e => e.tipo === 'familia').length,
      administrativos:  rows.filter(e => e.tipo === 'administrativo').length,
    };

    return res.json(stats);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/expedientes/:id ─────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;

    const { rows } = await db.query(
      `SELECT e.*, json_agg(d.*) FILTER (WHERE d.id IS NOT NULL) AS documentos
       FROM expedientes e
       LEFT JOIN documentos d ON d.expediente_id = e.id
       WHERE e.id = $1 AND e.organization_id = $2
       GROUP BY e.id`,
      [id, orgId]
    );
    const expediente = rows[0] || null;

    if (!expediente) {
      return res.status(404).json({ error: 'Expediente no encontrado.' });
    }

    return res.json(expediente);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/expedientes ────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const usuarioId = req.user.sub;

    const { numero, titulo, tipo, esUrgente = false } = req.body;

    if (!numero?.trim() || !titulo?.trim() || !tipo) {
      return res.status(400).json({ error: 'numero, titulo y tipo son campos obligatorios.' });
    }

    const tiposValidos = ['civil', 'penal', 'laboral', 'constitucional', 'familia', 'administrativo'];
    if (!tiposValidos.includes(tipo.toLowerCase())) {
      return res.status(400).json({ error: `Tipo inválido. Valores: ${tiposValidos.join(', ')}.` });
    }

    // Límite de expedientes del plan
    const { rows: orgRows } = await db.query(
      'SELECT max_expedientes FROM organizaciones WHERE id = $1',
      [orgId]
    );
    const maxExp = orgRows[0]?.max_expedientes ?? 10;

    const { rows: countRows } = await db.query(
      'SELECT COUNT(*) AS total FROM expedientes WHERE organization_id = $1',
      [orgId]
    );
    if (parseInt(countRows[0].total, 10) >= maxExp) {
      return res.status(402).json({ error: 'Límite de expedientes del plan alcanzado. Actualiza tu plan.' });
    }

    // Número único dentro del tenant
    const { rows: dupRows } = await db.query(
      'SELECT id FROM expedientes WHERE organization_id = $1 AND numero = $2',
      [orgId, numero.trim()]
    );
    if (dupRows.length > 0) {
      return res.status(409).json({ error: 'Ya existe un expediente con ese número en tu organización.' });
    }

    const { rows: inserted } = await db.query(
      `INSERT INTO expedientes (numero, titulo, tipo, estado, es_urgente, usuario_id, organization_id)
       VALUES ($1, $2, $3, 'activo', $4, $5, $6)
       RETURNING *`,
      [numero.trim(), titulo.trim(), tipo.toLowerCase(), Boolean(esUrgente), usuarioId, orgId]
    );
    const expediente = inserted[0];

    return res.status(201).json({ expediente, mensaje: 'Expediente creado.' });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/expedientes/:id ───────────────────────────────────────────────
router.patch('/:id', async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;
    const { titulo, estado, esUrgente } = req.body;

    const setClauses = [];
    const params = [];
    let idx = 1;

    if (titulo !== undefined) { setClauses.push(`titulo = $${idx++}`); params.push(titulo.trim()); }
    if (estado !== undefined) {
      const estadosValidos = ['activo', 'archivado', 'cerrado', 'suspendido'];
      if (!estadosValidos.includes(estado.toLowerCase())) {
        return res.status(400).json({ error: `Estado inválido. Valores: ${estadosValidos.join(', ')}.` });
      }
      setClauses.push(`estado = $${idx++}`); params.push(estado.toLowerCase());
    }
    if (esUrgente !== undefined) { setClauses.push(`es_urgente = $${idx++}`); params.push(Boolean(esUrgente)); }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos para actualizar.' });
    }

    setClauses.push('updated_at = NOW()');
    params.push(id, orgId);

    const { rows } = await db.query(
      `UPDATE expedientes SET ${setClauses.join(', ')}
       WHERE id = $${idx++} AND organization_id = $${idx}
       RETURNING *`,
      params
    );
    const expediente = rows[0] || null;

    if (!expediente) {
      return res.status(404).json({ error: 'Expediente no encontrado.' });
    }

    return res.json({ expediente, mensaje: 'Expediente actualizado.' });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/expedientes/:id ──────────────────────────────────────────────
// Solo OWNER o ADMIN pueden eliminar (soft delete → ARCHIVADO).
router.delete('/:id', requireRole(['OWNER', 'ADMIN']), async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;

    await db.query(
      `UPDATE expedientes SET estado = 'archivado', updated_at = NOW()
       WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    );

    return res.json({ mensaje: 'Expediente archivado.' });
  } catch (err) {
    next(err);
  }
});

export default router;
