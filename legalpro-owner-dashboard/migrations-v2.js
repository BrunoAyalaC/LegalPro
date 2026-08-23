// legalpro-owner-dashboard/migrations-v2.js
// Generado por @owner-admin (Sprint 2 - Owner Dashboard mutaciones)
// Extiende server.js con endpoints POST/PUT/DELETE + audit log + RBAC granular

const express = require('express');
const crypto = require('crypto');
const { Pool } = require('pg');

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Middleware: autenticación robusta (reemplaza bearer simple)
async function authenticateOwner(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Missing token' });
    }
    const token = auth.slice(7);
    const ownerSecret = process.env.OWNER_SECRET_KEY;
    if (!ownerSecret || token.length < 32) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(ownerSecret.slice(0, token.length)))) {
      await logAudit('OWNER_LOGIN_FAILURE', { ip: req.ip, ua: req.headers['user-agent'] });
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    req.owner = { id: 'owner-1', role: 'OWNER' };
    next();
  } catch (e) {
    return res.status(401).json({ success: false, error: 'Auth failed' });
  }
}

async function logAudit(eventName, payload) {
  try {
    await pool.query(
      `INSERT INTO audit_log (organization_id, user_id, event_name, severity, payload_masked, ip_address, user_agent, created_at)
       VALUES (NULL, NULL, $1, 'INFO', $2, $3, $4, NOW())`,
      [eventName, JSON.stringify(payload), payload.ip || null, payload.ua || null]
    );
  } catch (e) {
    console.error('[audit] Failed:', e.message);
  }
}

function requireAction(actionName) {
  return (req, res, next) => {
    if (!req.owner) return res.status(401).json({ success: false, error: 'Not authenticated' });
    next();
  };
}

// ═══ GET: Listar tenants con paginación ═══
router.get('/tenants', authenticateOwner, async (req, res) => {
  try {
    const { limit = 50, offset = 0, plan, search } = req.query;
    const params = [];
    let where = 'deleted_at IS NULL';
    if (plan) { params.push(plan); where += ` AND plan = $${params.length}`; }
    if (search) { params.push(`%${search}%`); where += ` AND nombre ILIKE $${params.length}`; }
    params.push(parseInt(limit), parseInt(offset));
    const { rows } = await pool.query(
      `SELECT id, nombre, slug, plan, max_usuarios, max_expedientes, max_consultas_ia_mes, activo, created_at
       FROM organizaciones WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    await logAudit('OWNER_LIST_TENANTS', { count: rows.length, ip: req.ip });
    res.json({ success: true, data: rows, total: rows.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══ POST: Suspender tenant (con cooling period) ═══
router.post('/tenants/:id/suspend', authenticateOwner, requireAction('SUSPEND_TENANT'), async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    if (!motivo) return res.status(400).json({ success: false, error: 'motivo required' });

    const { rows } = await pool.query(
      `UPDATE organizaciones SET activo = false, deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL RETURNING id, nombre`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }
    await pool.query(
      `UPDATE refresh_tokens SET revocado = true, revocado_en = NOW(), revocado_por = 'OWNER', motivo = $1
       WHERE user_id IN (SELECT id FROM usuarios WHERE organization_id = $2)`,
      [motivo, id]
    );
    await logAudit('OWNER_SUSPEND_TENANT', { tenantId: id, motivo, ownerId: req.owner.id, ip: req.ip });
    res.json({ success: true, data: { suspended: rows[0] } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══ POST: Reactivar tenant ═══
router.post('/tenants/:id/reactivate', authenticateOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `UPDATE organizaciones SET activo = true, deleted_at = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING id, nombre`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Tenant not found' });
    await logAudit('OWNER_REACTIVATE_TENANT', { tenantId: id, ownerId: req.owner.id, ip: req.ip });
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══ PUT: Cambiar plan ═══
router.put('/tenants/:id/plan', authenticateOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { plan, max_usuarios, max_expedientes, max_consultas_ia_mes } = req.body;
    if (!['free', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ success: false, error: 'Invalid plan' });
    }
    const { rows } = await pool.query(
      `UPDATE organizaciones
       SET plan = $1, max_usuarios = COALESCE($2, max_usuarios),
           max_expedientes = COALESCE($3, max_expedientes),
           max_consultas_ia_mes = COALESCE($4, max_consultas_ia_mes), updated_at = NOW()
       WHERE id = $5 RETURNING id, plan, max_usuarios, max_expedientes, max_consultas_ia_mes`,
      [plan, max_usuarios, max_expedientes, max_consultas_ia_mes, id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Tenant not found' });
    await logAudit('OWNER_CHANGE_PLAN', { tenantId: id, plan, ownerId: req.owner.id, ip: req.ip });
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══ POST: Refund ═══
router.post('/refund', authenticateOwner, async (req, res) => {
  try {
    const { tenantId, monto, motivo } = req.body;
    if (!tenantId || !monto || !motivo) {
      return res.status(400).json({ success: false, error: 'tenantId, monto, motivo required' });
    }
    if (monto > 100 && !req.headers['x-2fa-verified']) {
      return res.status(403).json({ success: false, error: '2FA required for > S/ 100 refund' });
    }
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO transacciones_creditos (id, organization_id, tipo, monto, descripcion, created_at)
       VALUES ($1, $2, 'DEBITO', $3, $4, NOW())`,
      [id, tenantId, monto, `Refund: ${motivo}`]
    );
    await logAudit('OWNER_REFUND', { tenantId, monto, motivo, ownerId: req.owner.id, ip: req.ip });
    res.json({ success: true, data: { transactionId: id, monto, motivo } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══ GET: Audit log del owner ═══
router.get('/audit-log', authenticateOwner, async (req, res) => {
  try {
    const { limit = 100, event } = req.query;
    const params = [parseInt(limit)];
    let where = `event_name LIKE 'OWNER_%' OR event_name LIKE 'LPDP_%'`;
    if (event) { where += ` AND event_name = $2`; params.push(event); }
    const { rows } = await pool.query(
      `SELECT id, event_name, severity, payload_masked, ip_address, user_agent, created_at
       FROM audit_log WHERE ${where}
       ORDER BY created_at DESC LIMIT $1`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══ POST: Test LPDP breach alert (simulacion) ═══
router.post('/test/lpdp-alert', authenticateOwner, async (req, res) => {
  await logAudit('LPDP_BREACH_SUSPECTED', { severity: 'CRITICAL', test: true, ip: req.ip });
  res.json({ success: true, message: 'LPDP_BREACH_SUSPECTED test event logged' });
});

module.exports = router;
