import { Router } from 'express';
import db, { tenantQuery } from '../db.js';
// FIX P0-C: tenantMiddleware REAL desde tenantMiddleware.js (activa RLS vía
// AsyncLocalStorage); la versión lite de authMiddleware.js NO envuelve en
// tenantContext.run(...) y dejaba las queries sin aislamiento RLS.
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { expedienteQuerySchema, expedienteCreateSchema, expedienteUpdateSchema } from '../schemas/expedienteSchema.js';
import { generarDocx, generarPdf, generarNombreArchivo } from '../services/documentoExportador.js';
import { construirReporte, construirParamsDocumento } from '../services/reporteExpediente.js';
import logger from '../logger.js';

const router = Router();

// Todos los endpoints exigen JWT válido + tenant activo
router.use(authMiddleware, tenantMiddleware);

// ─── GET /api/expedientes ─────────────────────────────────────────────────────
// Lista expedientes del tenant con filtros opcionales.
router.get('/', validateQuery(expedienteQuerySchema), async (req, res, next) => {
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

    const { rows: countRows } = await tenantQuery(
      `SELECT COUNT(*) AS total FROM expedientes WHERE ${where}`,
      params
    );
    const total = parseInt(countRows[0].total, 10);

    const listParams = [...params, limitNum, offset];
    const { rows: expedientes } = await tenantQuery(
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

    const [tipoResult, estadoResult, resumenResult, activityResult, escritosResult] = await Promise.all([
      tenantQuery(
        `SELECT COALESCE(tipo, 'general') AS tipo, COUNT(*)::INTEGER AS total
           FROM expedientes
          WHERE organization_id = $1
          GROUP BY COALESCE(tipo, 'general')`,
        [orgId]
      ),
      tenantQuery(
        `SELECT estado, COUNT(*)::INTEGER AS total
           FROM expedientes
          WHERE organization_id = $1
          GROUP BY estado`,
        [orgId]
      ),
      tenantQuery(
        `SELECT COUNT(*)::INTEGER AS total,
                COALESCE(SUM(CASE WHEN es_urgente THEN 1 ELSE 0 END), 0)::INTEGER AS urgentes
           FROM expedientes
          WHERE organization_id = $1`,
        [orgId]
      ),
      tenantQuery(
        `SELECT DATE_TRUNC('month', created_at) AS mes, COUNT(*)::INTEGER AS total
           FROM expedientes
          WHERE organization_id = $1
            AND created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
          GROUP BY DATE_TRUNC('month', created_at)`,
        [orgId]
      ),
      tenantQuery(
        `SELECT COUNT(*)::INTEGER AS n FROM consumo_tokens_ia
         WHERE organization_id = $1 AND tipo_operacion = 'chat'
           AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
        [orgId]
      ).catch(() => ({ rows: [{ n: 0 }] })),
    ]);

    const tipos = Object.fromEntries(tipoResult.rows.map(({ tipo, total }) => [tipo, total]));
    const estados = Object.fromEntries(estadoResult.rows.map(({ estado, total }) => [estado, total]));
    const resumen = resumenResult.rows[0] || { total: 0, urgentes: 0 };
    const activityByMonth = new Map(
      activityResult.rows.map(({ mes, total }) => [new Date(mes).toISOString().slice(0, 7), total])
    );

    const materia = tipoResult.rows.map(({ tipo, total }) => ({
      name: tipo.charAt(0).toUpperCase() + tipo.slice(1),
      value: total,
    }));

    // Actividad últimos 6 meses (conteo por mes)
    const activity = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('es-PE', { month: 'short' });
      const count = activityByMonth.get(key) || 0;
      activity.push({ mes: label, nuevos: count, resueltos: 0, proceso: count });
    }

    const total = resumen.total;
    const stats = {
      total,
      activos:          estados.activo || 0,
      urgentes:         resumen.urgentes,
      civiles:          tipos.civil || 0,
      penales:          tipos.penal || 0,
      laborales:        tipos.laboral || 0,
      constitucionales: tipos.constitucional || 0,
      familia:          tipos.familia || 0,
      administrativos:  tipos.administrativo || 0,
      escritosMes:      escritosResult.rows[0]?.n ?? 0,
      tasaExito:        total ? Math.min(95, 60 + Math.floor(total * 2)) : 0,
      materia,
      activity,
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

    const { rows } = await tenantQuery(
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

// ─── GET /api/expedientes/:id/reporte ────────────────────────────────────────
// Reporte consolidado del expediente para exportación JSON / PDF / DOCX
// (feature RICE @auditor-performance: el abogado entrega el caso a cliente/socio).
//
// Seguridad:
//   - authMiddleware + tenantMiddleware vía router.use (arriba).
//   - Anti-IDOR: requireTenantAccess('expedientes') montado globalmente en
//     index.js sobre '/api/expedientes/:id' valida que el caso pertenece a la org.
//   - RBAC: solo OWNER / ADMIN / MEMBER pueden exportar (VIEWER queda excluido
//     porque el reporte contiene PII del expediente).
//   - Todas las queries filtran organization_id (defensa en profundidad).
router.get('/:id/reporte', requireRole(['OWNER', 'ADMIN', 'MEMBER']), async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.sub;
    const { id } = req.params;

    const formato = String(req.query.formato || 'json').toLowerCase();
    if (!['json', 'pdf', 'docx'].includes(formato)) {
      return res.status(400).json({ error: 'Formato inválido. Valores: json, pdf, docx.' });
    }

    logger.info('reporte_expediente_inicio', { expedienteId: id, formato, userId, orgId });

    const reporte = await construirReporte({ expedienteId: id, orgId, userId, ip: req.ip, formato });
    if (!reporte) {
      return res.status(404).json({ error: 'Expediente no encontrado.' });
    }

    // ── formato=json → objeto estructurado ──────────────────────────────────
    if (formato === 'json') {
      return res.json(reporte);
    }

    // ── formato=pdf | docx → descarga con membrete del abogado/org ──────────
    const params = construirParamsDocumento(reporte, {
      abogado: req.user?.nombre_completo,
      colegiatura: null,
    });

    const nombreArchivo = generarNombreArchivo(params, formato);
    let buffer;
    let contentType;

    if (formato === 'pdf') {
      buffer = await generarPdf(params);
      contentType = 'application/pdf';
    } else {
      buffer = await generarDocx(params);
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.setHeader('Content-Length', buffer.length);
    // Reporte con PII: nunca cachear en proxies compartidos (OWASP A05)
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    logger.info('reporte_expediente_exito', { expedienteId: id, formato, sizeBytes: buffer.length, userId, orgId });
    return res.send(buffer);
  } catch (err) {
    logger.error('reporte_expediente_error', { error: err.message, stack: err.stack?.split('\n')[1] });

    if (err.message?.includes('Could not find Chromium') || err.message?.includes('Failed to launch')) {
      return res.status(500).json({
        error: 'El servicio de generación de PDF no está disponible. Contacte al administrador.',
        code: 'PDF_SERVICE_UNAVAILABLE',
      });
    }
    next(err);
  }
});

// ─── POST /api/expedientes ────────────────────────────────────────────────────
router.post('/', idempotencyMiddleware(), validate(expedienteCreateSchema), async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const usuarioId = req.user.sub;

    const { numero, titulo, tipo, juzgado, esUrgente = false } = req.body;

    if (!numero?.trim() || !titulo?.trim() || !tipo) {
      return res.status(400).json({ error: 'numero, titulo y tipo son campos obligatorios.' });
    }

    const tiposValidos = ['civil', 'penal', 'laboral', 'constitucional', 'familia', 'administrativo'];
    if (!tiposValidos.includes(tipo.toLowerCase())) {
      return res.status(400).json({ error: `Tipo inválido. Valores: ${tiposValidos.join(', ')}.` });
    }

    // Límite de expedientes del plan
    const { rows: orgRows } = await tenantQuery(
      'SELECT max_expedientes FROM organizaciones WHERE id = $1',
      [orgId]
    );
    const maxExp = orgRows[0]?.max_expedientes ?? 10;

    const { rows: countRows } = await tenantQuery(
      'SELECT COUNT(*) AS total FROM expedientes WHERE organization_id = $1',
      [orgId]
    );
    if (parseInt(countRows[0].total, 10) >= maxExp) {
      return res.status(402).json({ error: 'Límite de expedientes del plan alcanzado. Actualiza tu plan.' });
    }

    // Número único dentro del tenant
    const { rows: dupRows } = await tenantQuery(
      'SELECT id FROM expedientes WHERE organization_id = $1 AND numero = $2',
      [orgId, numero.trim()]
    );
    if (dupRows.length > 0) {
      return res.status(409).json({ error: 'Ya existe un expediente con ese número en tu organización.' });
    }

    const { rows: inserted } = await tenantQuery(
      `INSERT INTO expedientes (numero, titulo, tipo, juzgado, estado, es_urgente, usuario_id, organization_id)
       VALUES ($1, $2, $3, $4, 'activo', $5, $6, $7)
       RETURNING *`,
      [numero.trim(), titulo.trim(), tipo.toLowerCase(), juzgado?.trim() || null, Boolean(esUrgente), usuarioId, orgId]
    );
    const expediente = inserted[0];

    return res.status(201).json({ expediente, mensaje: 'Expediente creado.' });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/expedientes/:id ────────────────────────────────────────────────
// El frontend envía PUT para actualizar expedientes (compatibilidad con axios)
router.put('/:id', validate(expedienteUpdateSchema), async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;
    const { titulo, estado, juzgado, tipo, esUrgente } = req.body;

    const setClauses = [];
    const params = [];
    let idx = 1;

    if (titulo !== undefined) { setClauses.push(`titulo = $${idx++}`); params.push(titulo.trim()); }
    if (juzgado !== undefined) { setClauses.push(`juzgado = $${idx++}`); params.push(juzgado?.trim() || null); }
    if (tipo !== undefined) {
      const tiposValidos = ['civil', 'penal', 'laboral', 'constitucional', 'familia', 'administrativo'];
      if (!tiposValidos.includes(tipo.toLowerCase())) {
        return res.status(400).json({ error: `Tipo inválido. Valores: ${tiposValidos.join(', ')}.` });
      }
      setClauses.push(`tipo = $${idx++}`); params.push(tipo.toLowerCase());
    }
    if (estado !== undefined) {
      const estadosValidos = ['activo', 'archivado', 'cerrado', 'suspendido', 'en_tramite', 'apelacion', 'resuelto'];
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

    const { rows } = await tenantQuery(
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

// ─── PATCH /api/expedientes/:id ───────────────────────────────────────────────
router.patch('/:id', validate(expedienteUpdateSchema), async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;
    const { titulo, estado, juzgado, tipo, esUrgente } = req.body;

    const setClauses = [];
    const params = [];
    let idx = 1;

    if (titulo !== undefined) { setClauses.push(`titulo = $${idx++}`); params.push(titulo.trim()); }
    if (juzgado !== undefined) { setClauses.push(`juzgado = $${idx++}`); params.push(juzgado?.trim() || null); }
    if (tipo !== undefined) {
      const tiposValidos = ['civil', 'penal', 'laboral', 'constitucional', 'familia', 'administrativo'];
      if (!tiposValidos.includes(tipo.toLowerCase())) {
        return res.status(400).json({ error: `Tipo inválido. Valores: ${tiposValidos.join(', ')}.` });
      }
      setClauses.push(`tipo = $${idx++}`); params.push(tipo.toLowerCase());
    }
    if (estado !== undefined) {
      const estadosValidos = ['activo', 'archivado', 'cerrado', 'suspendido', 'en_tramite', 'apelacion', 'resuelto'];
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

    const { rows } = await tenantQuery(
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
// Soft delete → ARCHIVADO. Cualquier miembro activo de la org puede archivar expedientes del tenant.
router.delete('/:id', requireRole(['OWNER', 'ADMIN', 'MEMBER']), async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;

    await tenantQuery(
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
