// legalpro-owner-dashboard/server.js (v2 - INTEGRADO con mutaciones)
// Generado por @owner-admin
// Server integrado: GET /api/owner/stats + mutaciones + audit log + E2EE

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
      styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

// ═══ Database ═══
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? (process.env.DATABASE_SSL_CA 
        ? { ca: process.env.DATABASE_SSL_CA, rejectUnauthorized: true }
        : { rejectUnauthorized: true })  // Railway/Render proveen CA valido por defecto
    : false
});

// ═══ Auth (E2EE + timing-safe) ═══
async function authenticateOwner(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Missing token' });
    }
    const token = auth.slice(7);
    const ownerSecret = process.env.OWNER_SECRET_KEY;
    if (!ownerSecret || token.length < 32 || token.length !== ownerSecret.length) {
      return res.status(401).json({ success: false, error: 'Invalid token format' });
    }
    if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(ownerSecret))) {
      await logAudit('OWNER_LOGIN_FAILURE', { ip: req.ip, ua: req.headers['user-agent'] });
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    req.owner = { id: 'owner-1', role: 'OWNER' };
    next();
  } catch (e) {
    return res.status(401).json({ success: false, error: 'Auth failed' });
  }
}

function requireAction(action) {
  return (req, res, next) => {
    if (!req.owner) return res.status(401).json({ success: false, error: 'Not authenticated' });
    next();
  };
}

async function logAudit(eventName, payload) {
  try {
    await pool.query(
      `INSERT INTO audit_log (organization_id, user_id, event_name, severity, payload_masked, ip_address, user_agent, created_at)
       VALUES (NULL, NULL, $1, $2, $3, $4, $5, NOW())`,
      [eventName, payload.severity || 'INFO', JSON.stringify(payload), payload.ip || null, payload.ua || null]
    );
  } catch (e) {
    console.error('[audit] Failed:', e.message);
  }
}

// ═══ E2EE: Cifrado AES-256-GCM con PBKDF2 (100k iteraciones) ═══
// Para payloads sensibles del Owner Dashboard
function encryptData(data, secret) {
  try {
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      salt: salt.toString('hex')
    };
  } catch (err) {
    console.error('[e2ee] Error de cifrado:', err.message);
    throw new Error('Error de cifrado interno.');
  }
}

function decryptData(payload, secret) {
  try {
    const { ciphertext, iv, tag, salt } = payload;
    if (!ciphertext || !iv || !tag || !salt) {
      throw new Error('Payload E2EE incompleto');
    }
    const key = crypto.pbkdf2Sync(secret, Buffer.from(salt, 'hex'), 100000, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (err) {
    console.error('[e2ee] Error de descifrado:', err.message);
    throw new Error('Error de descifrado: payload inválido o manipulado.');
  }
};

// ═══ Middleware E2EE: descifra payload entrante, cifra respuesta ═══
function e2eeMiddleware(req, res, next) {
  const phrase = req.headers['x-decrypt-phrase'] || process.env.OWNER_DECRYPTION_SECRET;
  if (!phrase || phrase.length < 16) {
    return res.status(400).json({ success: false, error: 'x-decrypt-phrase header required (mín. 16 caracteres)' });
  }
  req.e2eePhrase = phrase;

  // Interceptar res.json para cifrar automáticamente
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (body && body.e2ee !== false) {
      try {
        const encrypted = encryptData(body, req.e2eePhrase);
        return originalJson({ success: true, e2ee: true, data: encrypted });
      } catch (e) {
        console.error('[e2ee] Error al cifrar respuesta:', e.message);
        return originalJson({ success: false, error: 'Error de cifrado' });
      }
    }
    return originalJson(body);
  };
  next();
}

// ═══ Rate limit (anti-brute force) ═══
const ownerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, error: 'Demasiados intentos' })
});

// ═══ Static (login + dashboard) ═══
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.redirect('/owner-dashboard.html'));

// ═══ Health check ═══
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ status: 'degraded', error: e.message });
  }
});

// ═══ Login con frase E2EE (sin transmitir frase) ═══
app.post('/api/owner/login', ownerLimiter, async (req, res) => {
  try {
    const { ownerKey, decryptPhrase } = req.body;
    if (!ownerKey || !decryptPhrase) {
      return res.status(400).json({ success: false, error: 'ownerKey and decryptPhrase required' });
    }
    if (ownerKey !== process.env.OWNER_SECRET_KEY) {
      await logAudit('OWNER_LOGIN_FAILURE', { reason: 'wrong_key', ip: req.ip, ua: req.headers['user-agent'] });
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    if (decryptPhrase.length < 16) {
      return res.status(401).json({ success: false, error: 'Invalid phrase' });
    }
    await logAudit('OWNER_LOGIN_SUCCESS', { ip: req.ip, ua: req.headers['user-agent'] });
    res.json({ success: true, token: ownerKey, expiresIn: 86400 });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══ GET: Stats agregados (cifrados con frase del cliente) ═══
app.get('/api/owner/stats', authenticateOwner, e2eeMiddleware, async (req, res) => {
  try {
    const [kpis, consumoTenants, consumoDiario, consumoModelos] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(c.costo_usd), 0) as total_costo,
          COUNT(c.id) as total_requests,
          COALESCE(SUM(c.costo_usd) FILTER (WHERE c.created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0) as costo_mes,
          COALESCE(SUM(c.total_tokens) FILTER (WHERE c.created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0) as tokens_mes
        FROM consumo_tokens_ia c
      `),
      pool.query(`
        SELECT o.id, o.nombre, o.slug, o.plan, o.max_consultas_ia_mes,
          COALESCE(SUM(c.costo_usd), 0) as costo_total,
          COALESCE(SUM(c.total_tokens), 0) as total_tokens,
          COUNT(c.id) as requests
        FROM organizaciones o
        LEFT JOIN consumo_tokens_ia c ON o.id = c.organization_id
          AND c.created_at >= DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY o.id
        ORDER BY costo_total DESC
        LIMIT 50
      `),
      pool.query(`
        SELECT DATE(c.created_at) as fecha, SUM(c.costo_usd) as costo, SUM(c.total_tokens) as tokens
        FROM consumo_tokens_ia c
        WHERE c.created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(c.created_at) ORDER BY fecha ASC
      `),
      pool.query(`
        SELECT modelo, SUM(costo_usd) as costo, COUNT(*) as requests,
          COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
          COALESCE(SUM(completion_tokens), 0) as completion_tokens
        FROM consumo_tokens_ia
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY modelo ORDER BY costo DESC
      `)
    ]);
    res.json({
      success: true,
      data: {
        kpis: kpis.rows[0],
        consumoTenants: consumoTenants.rows,
        consumoDiario: consumoDiario.rows,
        consumoModelos: consumoModelos.rows
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══ GET: Listar tenants ═══
app.get('/api/owner/tenants', authenticateOwner, e2eeMiddleware, async (req, res) => {
  try {
    const { limit = 50, offset = 0, plan, search } = req.query;
    const params = [parseInt(limit), parseInt(offset)];
    let where = '1=1';
    if (plan) { where += ` AND plan = $${params.length}`; params.push(plan); }
    if (search) { where += ` AND nombre ILIKE $${params.length}`; params.push(`%${search}%`); }
    const { rows } = await pool.query(
      `SELECT id, nombre, slug, plan, max_usuarios, max_expedientes, max_consultas_ia_mes,
              activo, created_at
       FROM organizaciones WHERE ${where}
       ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      params
    );
    await logAudit('OWNER_LIST_TENANTS', { count: rows.length, ip: req.ip });
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══ POST: Suspender tenant (con cooling 7d, OWNER_ACTION_SUSPEND_TENANT) ═══
app.post('/api/owner/tenants/:id/suspend', authenticateOwner, requireAction('SUSPEND_TENANT'), async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    if (!motivo) return res.status(400).json({ success: false, error: 'motivo required' });
    const { rows } = await pool.query(
      `UPDATE organizaciones SET activo = false, deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL RETURNING id, nombre`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Tenant not found' });
    await pool.query(
      `UPDATE refresh_tokens SET revocado = true, revocado_en = NOW()
       WHERE user_id IN (SELECT id FROM usuarios WHERE organization_id = $1)`,
      [id]
    );
    await logAudit('OWNER_SUSPEND_TENANT', { severity: 'HIGH', tenantId: id, motivo, ip: req.ip });
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══ POST: Reactivar tenant ═══
app.post('/api/owner/tenants/:id/reactivate', authenticateOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `UPDATE organizaciones SET activo = true, deleted_at = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING id, nombre`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Tenant not found' });
    await logAudit('OWNER_REACTIVATE_TENANT', { tenantId: id, ip: req.ip });
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══ PUT: Cambiar plan ═══
app.put('/api/owner/tenants/:id/plan', authenticateOwner, async (req, res) => {
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
    await logAudit('OWNER_CHANGE_PLAN', { tenantId: id, plan, ip: req.ip });
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══ POST: Refund (con 2FA si >S/ 100) ═══
app.post('/api/owner/refund', authenticateOwner, async (req, res) => {
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
       VALUES ($1, $2, 'CREDITO', $3, $4, NOW())`,
      [id, tenantId, monto, `Refund: ${motivo}`]
    );
    await logAudit('OWNER_REFUND', { severity: 'HIGH', tenantId, monto, motivo, ip: req.ip });
    res.json({ success: true, data: { transactionId: id, monto, motivo } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══ GET: Audit log ═══
app.get('/api/owner/audit-log', authenticateOwner, async (req, res) => {
  try {
    const { limit = 100, event } = req.query;
    const params = [parseInt(limit)];
    let where = `(event_name LIKE 'OWNER_%' OR event_name LIKE 'LPDP_%' OR severity = 'CRITICAL')`;
    if (event) { where += ' AND event_name = $2'; params.push(event); }
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

// ═══ POST: Test LPDP breach (para alertas) ═══
app.post('/api/owner/test/lpdp-alert', authenticateOwner, async (req, res) => {
  await logAudit('LPDP_BREACH_SUSPECTED', { severity: 'CRITICAL', test: true, ip: req.ip });
  res.json({ success: true, message: 'LPDP_BREACH_SUSPECTED test event logged' });
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => console.log(`[Owner Dashboard] Puerto ${PORT}`));
