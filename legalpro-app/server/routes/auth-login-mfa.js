// legalpro-app/server/routes/auth-login-mfa.js
// Generado por @auditor-seguridad + @backend-node
// FIX CRITICAL: Login con soporte MFA + gestión de enrolamiento TOTP
//
// ADR-004-rev1 (2026-08-23): el router se ACTIVA. La migración
// tools/migrations/2026-08-23-mfa-columns.sql (+ espejo initDb.js) crea las
// columnas mfa_* que faltaban. Kill switch de emergencia: FEATURE_MFA=false
// desactiva TODOS los endpoints MFA (el login vuelve a ser password-only y
// /refresh sigue vivo — es crítico para sesiones, CRIT-03).
//
// Endpoints:
//   POST /api/auth/login        → challenge MFA solo si mfa_enabled=true
//   POST /api/auth/login/mfa    → segundo paso (TOTP o backup code)
//   POST /api/auth/refresh      → rotación refresh token (SIEMPRE activo)
//   GET  /api/auth/mfa/status   → { enabled }            (router gestión)
//   POST /api/auth/mfa/setup    → secret + otpauth URI    (router gestión)
//   POST /api/auth/mfa/verify   → confirma enrolamiento + 8 backup codes
//   POST /api/auth/mfa/disable  → exige password actual
//
// Nota multi-tenant: `usuarios` es tabla GLOBAL (lookup por email/id), por lo
// que estas queries usan el pool directo (db.query) — NO tenantQuery.

import crypto from 'crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { logAudit } from '../utils/audit.js';
import { generateTokenPair, validateAndRotateRefreshToken } from '../utils/jwt.js';
import { bruteForceMiddleware } from '../middleware/bruteForce.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// ── Feature flag ADR-004-rev1 ────────────────────────────────────────────────
// Default: ACTIVADO. FEATURE_MFA=false en .env apaga MFA en emergencia sin
// redeploy de frontend: el login deja de exigir segundo factor y los endpoints
// de gestión responden 503. /refresh NUNCA pasa por este guard.
function mfaDisabled() {
  return process.env.FEATURE_MFA === 'false';
}

// ── Cookie de sesión (espejo de routes/auth.js COOKIE_OPTIONS) ───────────────
// HTTPS-only: httpOnly + secure en prod + sameSite strict. El segundo paso del
// login (/login/mfa) DEBE setear la cookie igual que /login para que la SPA
// rehidrate la sesión vía getSessionFromCookie() → GET /api/auth/me.
const JWT_EXPIRY = process.env.JWT_EXPIRY_SECONDS ? parseInt(process.env.JWT_EXPIRY_SECONDS) : 3600;
const isProd = process.env.NODE_ENV === 'production';
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || 'strict').toLowerCase();
const COOKIE_SECURE = process.env.COOKIE_SAMESITE
  ? undefined // sameSite='none' fuerza secure=true a nivel navegador
  : (process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd);
const MFA_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: COOKIE_SAMESITE === 'none' ? true : COOKIE_SECURE,
  sameSite: COOKIE_SAMESITE,
  path: '/api',
  maxAge: JWT_EXPIRY * 1000,
};

// ── Compatibilidad otplib v12 (authenticator) / v13 (API funcional) ─────────
let _totp = null;
async function getTotp() {
  if (_totp) return _totp;
  const otplib = await import('otplib');
  if (typeof otplib.generateSecret === 'function') {
    // v13+: API funcional (generateSecret/generateURI/verify)
    _totp = {
      generateSecret: () => otplib.generateSecret(),
      keyuri: (label, issuer, secret) =>
        otplib.generateURI({ secret, label, issuer }),
      verify: async ({ token, secret }) => {
        const r = await otplib.verify({ token, secret });
        return !!(r?.valid ?? r);
      },
    };
  } else {
    // v12: API clásica authenticator.*
    const { authenticator } = otplib;
    _totp = {
      generateSecret: () => authenticator.generateSecret(),
      keyuri: (label, issuer, secret) => authenticator.keyuri(label, issuer, secret),
      verify: ({ token, secret }) => Promise.resolve(!!authenticator.verify({ token, secret })),
    };
  }
  return _totp;
}

// ── Backup codes: 8 códigos XXXX-XXXX, se guardan hasheados (SHA-256) ────────
function generarBackupCodes(n = 8) {
  const plain = [];
  for (let i = 0; i < n; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 hex chars
    plain.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  const hashes = plain.map(c => sha256(c));
  return { plain, hashes };
}
function sha256(texto) {
  return crypto.createHash('sha256').update(String(texto).trim().toUpperCase()).digest('hex');
}

// Nombre del servicio en la app autenticadora
const MFA_ISSUER = process.env.MFA_ISSUER || 'LegalPro';

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/auth/login
// NOTA: este handler está sombreado por routes/auth.js (montado antes en
// index.js), que replica esta misma lógica MFA tras validar password. Se
// mantiene aquí como referencia canónica del contrato mfaRequired.
// Regla ADR-004-rev1: SOLO se exige TOTP si mfa_enabled=true; si no, login
// normal (sin setup forzado — eso vive en Perfil → /api/auth/mfa/setup).
// ═════════════════════════════════════════════════════════════════════════════
router.post('/login', bruteForceMiddleware, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email y password requeridos' });
    }

    const { rows: users } = await db.query(
      `SELECT id, email, password_hash, nombre_completo, rol, organization_id,
              mfa_enabled, mfa_secret, acepta_transferencia_internacional,
              esta_activo
       FROM usuarios WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );

    if (users.length === 0 || !users[0].esta_activo) {
      await logAudit('AUTH_LOGIN_FAILURE', {
        severity: 'WARNING',
        email,
        ip: req.ip,
        reason: 'user_not_found_or_inactive'
      });
      return res.status(401).json({ success: false, error: 'Credenciales invalidas' });
    }

    const user = users[0];
    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
      await logAudit('AUTH_LOGIN_FAILURE', {
        severity: 'WARNING',
        userId: user.id,
        email,
        ip: req.ip,
        reason: 'wrong_password'
      });
      return res.status(401).json({ success: false, error: 'Credenciales invalidas' });
    }

    // ADR-004-rev1: challenge SOLO si el usuario tiene MFA habilitado.
    // Sin MFA → login normal (NO se fuerza setup aquí).
    if (!mfaDisabled() && user.mfa_enabled === true) {
      await logAudit('MFA_CHALLENGE', {
        severity: 'INFO',
        userId: user.id,
        email,
        ip: req.ip
      });
      return res.json({
        success: true,
        // Flag top-level: lo detecta client.ts login() sin lanzar error de "token faltante"
        mfaRequired: true,
        userId: user.id,
        data: {
          mfaRequired: true,
          userId: user.id,
          mfaMethods: ['totp', 'backup'],
          message: 'MFA token required. Use POST /api/auth/login/mfa'
        }
      });
    }

    // Login exitoso sin MFA
    const tokens = await generateTokenPair({
      userId: user.id,
      email: user.email,
      rol: user.rol,
      organizationId: user.organization_id
    });

    await db.query(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at, ip_address, user_agent, created_at)
       VALUES (gen_random_uuid(), $1, $2, NOW() + INTERVAL '30 days', $3, $4, NOW())`,
      [user.id, tokens.refreshToken, req.ip, req.headers['user-agent']]
    );

    await logAudit('AUTH_LOGIN_SUCCESS', {
      severity: 'INFO',
      userId: user.id,
      email,
      ip: req.ip,
      mfa: false
    });

    // Resolver organización activa (mismo patrón que routes/auth.js login).
    let organizacion = null;
    if (user.organization_id) {
      const { rows: orgRows } = await db.query(
        `SELECT o.id, o.nombre, o.slug, o.plan,
                COALESCE(mo.rol, 'MEMBER') AS rol_miembro
         FROM organizaciones o
         LEFT JOIN miembros_organizacion mo
           ON mo.organizacion_id = o.id
          AND mo.usuario_id = $1
          AND mo.activo = TRUE
         WHERE o.id = $2
           AND o.activo = TRUE
         LIMIT 1`,
        [user.id, user.organization_id]
      );
      if (orgRows.length > 0) {
        const o = orgRows[0];
        organizacion = {
          id: o.id,
          nombre: o.nombre,
          slug: o.slug,
          plan: o.plan,
          rolMiembro: (o.rol_miembro || 'MEMBER').toUpperCase(),
        };
      }
    }

    // ── Contrato DUAL de respuesta (fix de compatibilidad con el frontend) ──
    res.json({
      success: true,
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      usuario: {
        id: user.id,
        email: user.email,
        nombreCompleto: user.nombre_completo,
        rol: user.rol,
      },
      organizacion,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          nombre_completo: user.nombre_completo,
          rol: user.rol,
          organization_id: user.organization_id,
          acepta_transferencia_internacional: user.acepta_transferencia_internacional,
        },
      },
    });
  } catch (e) {
    console.error('[login]', e);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/auth/login/mfa - Login con MFA (segundo paso)
// Acepta código TOTP de 6 dígitos o un backup code XXXX-XXXX (un solo uso).
// Al éxito emite tokens + cookie httpOnly (contrato dual igual que /login).
// ═════════════════════════════════════════════════════════════════════════════
router.post('/login/mfa', async (req, res) => {
  try {
    if (mfaDisabled()) {
      return res.status(503).json({ success: false, error: 'MFA deshabilitado' });
    }
    const { userId, mfaToken, mfaType } = req.body;
    if (!userId || !mfaToken) {
      return res.status(400).json({ success: false, error: 'userId y mfaToken requeridos' });
    }

    const totp = await getTotp();
    const { rows: users } = await db.query(
      `SELECT id, email, nombre_completo, rol, organization_id,
              mfa_secret, mfa_backup_codes, mfa_enabled,
              acepta_transferencia_internacional
       FROM usuarios WHERE id = $1`,
      [userId]
    );
    if (users.length === 0 || users[0].mfa_enabled !== true) {
      return res.status(401).json({ success: false, error: 'Invalid' });
    }

    const user = users[0];
    let isValid = false;
    let usedBackup = false;

    if (mfaType === 'backup') {
      // Backup codes: comparar hash SHA-256 y consumir el usado (un solo uso).
      const hashes = user.mfa_backup_codes || [];
      const h = sha256(mfaToken);
      const idx = hashes.indexOf(h);
      if (idx >= 0) {
        isValid = true;
        usedBackup = true;
        hashes.splice(idx, 1);
        await db.query(
          `UPDATE usuarios SET mfa_backup_codes = $1 WHERE id = $2`,
          [hashes, userId]
        );
      }
    } else {
      isValid = await totp.verify({
        token: String(mfaToken).replace(/\s/g, ''),
        secret: user.mfa_secret
      });
    }

    if (!isValid) {
      await logAudit('MFA_LOGIN_FAILED', {
        severity: 'WARNING',
        userId,
        ip: req.ip,
        type: mfaType || 'totp'
      });
      return res.status(401).json({ success: false, error: 'Invalid MFA token' });
    }

    // Emitir tokens (contrato dual idéntico al login normal)
    const tokens = await generateTokenPair({
      userId: user.id,
      email: user.email,
      rol: user.rol,
      organizationId: user.organization_id
    });

    await db.query(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at, ip_address, user_agent, created_at)
       VALUES (gen_random_uuid(), $1, $2, NOW() + INTERVAL '30 days', $3, $4, NOW())`,
      [user.id, tokens.refreshToken, req.ip, req.headers['user-agent']]
    );

    // Cookie httpOnly para que TenantProvider rehidrate vía /api/auth/me
    res.cookie('token', tokens.accessToken, MFA_COOKIE_OPTIONS);

    await logAudit('AUTH_LOGIN_SUCCESS', {
      severity: 'INFO',
      userId: user.id,
      email: user.email,
      ip: req.ip,
      mfa: true,
      mfaType: mfaType || 'totp',
      usedBackup
    });

    const usuarioPayload = {
      id: user.id,
      email: user.email,
      nombre_completo: user.nombre_completo,
      rol: user.rol,
      organization_id: user.organization_id,
      acepta_transferencia_internacional: user.acepta_transferencia_internacional,
    };

    res.json({
      success: true,
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      usuario: {
        id: user.id,
        email: user.email,
        nombreCompleto: user.nombre_completo,
        rol: user.rol,
      },
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: usuarioPayload,
        mfaVerified: true
      }
    });
  } catch (e) {
    console.error('[login.mfa]', e);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// ─── POST /api/auth/refresh ──────────────────────────────────────────────────
// Rotación de refresh token: valida, invalida el viejo, genera uno nuevo.
// CRIT-03: Fix — evita que un token robado sirva por 30 días.
// ⚠ SIEMPRE montado (independiente de FEATURE_MFA): las sesiones dependen de él.
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'refreshToken requerido' });
    }

    const result = await validateAndRotateRefreshToken(refreshToken, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      rotation: true
    });

    if (!result.valid) {
      await logAudit('REFRESH_TOKEN_INVALID', {
        severity: 'WARNING',
        ip: req.ip,
        reason: 'token_invalid_expired_or_revoked'
      });
      return res.status(401).json({ success: false, error: 'Refresh token inválido o expirado' });
    }

    await logAudit('REFRESH_TOKEN_ROTATED', {
      severity: 'INFO',
      userId: result.userData.usuario_id,
      ip: req.ip
    });

    return res.json({
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.newRefreshToken,
      }
    });
  } catch (e) {
    console.error('[refresh]', e);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTER DE GESTIÓN MFA — montado en index.js bajo /api/auth/mfa SOLO si
// FEATURE_MFA !== 'false'. Requiere JWT (authMiddleware). Todas las operaciones
// son sobre la fila del PROPIO usuario (req.user.sub) — sin parámetros de id.
// ═════════════════════════════════════════════════════════════════════════════
export const mfaManagementRouter = Router();

// Helper: cargar usuario actual desde el claim sub del JWT
async function loadSelf(userId) {
  const { rows } = await db.query(
    `SELECT id, email, password_hash, rol, mfa_secret, mfa_enabled, mfa_enrolled_at
     FROM usuarios WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  return rows[0] || null;
}

// ─── GET /api/auth/mfa/status → { enabled } ──────────────────────────────────
mfaManagementRouter.get('/status', authMiddleware, async (req, res) => {
  try {
    if (mfaDisabled()) {
      return res.status(503).json({ success: false, error: 'MFA deshabilitado' });
    }
    const user = await loadSelf(req.user?.sub);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    res.json({
      success: true,
      data: {
        enabled: user.mfa_enabled === true,
        enrolledAt: user.mfa_enrolled_at || null,
      },
    });
  } catch (e) {
    console.error('[mfa.status]', e);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// ─── POST /api/auth/mfa/setup → genera secret + otpauth URI SIN habilitar ────
// El secreto queda guardado pero mfa_enabled sigue FALSE hasta verify().
mfaManagementRouter.post('/setup', authMiddleware, async (req, res) => {
  try {
    if (mfaDisabled()) {
      return res.status(503).json({ success: false, error: 'MFA deshabilitado' });
    }
    const user = await loadSelf(req.user?.sub);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    if (user.mfa_enabled === true) {
      return res.status(409).json({ success: false, error: 'MFA ya está activado' });
    }

    const totp = await getTotp();
    const secret = totp.generateSecret();
    const otpauth = totp.keyuri(user.email, MFA_ISSUER, secret);

    await db.query(`UPDATE usuarios SET mfa_secret = $1 WHERE id = $2`, [secret, user.id]);

    await logAudit('MFA_SETUP_INITIATED', {
      severity: 'INFO',
      userId: user.id,
      ip: req.ip
    });

    // QR vía generador gratuito (imagen remota) + URI copiable como fallback.
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(otpauth)}`;

    res.json({
      success: true,
      data: { otpauth, qrUrl, issuer: MFA_ISSUER },
    });
  } catch (e) {
    console.error('[mfa.setup]', e);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// ─── POST /api/auth/mfa/verify { code } → confirma y activa + backup codes ───
// Verifica el primer código TOTP contra el secret del setup; si es correcto
// activa mfa_enabled, sella mfa_enrolled_at y devuelve 8 backup codes EN
// TEXTO PLANO una única vez (en BD solo quedan los hashes SHA-256).
mfaManagementRouter.post('/verify', authMiddleware, async (req, res) => {
  try {
    if (mfaDisabled()) {
      return res.status(503).json({ success: false, error: 'MFA deshabilitado' });
    }
    const { code } = req.body ?? {};
    if (!code) {
      return res.status(400).json({ success: false, error: 'code requerido' });
    }
    const user = await loadSelf(req.user?.sub);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    if (!user.mfa_secret) {
      return res.status(400).json({ success: false, error: 'Primero ejecuta POST /api/auth/mfa/setup' });
    }

    const totp = await getTotp();
    const ok = await totp.verify({
      token: String(code).replace(/\s/g, ''),
      secret: user.mfa_secret
    });
    if (!ok) {
      await logAudit('MFA_VERIFY_FAILED', { severity: 'WARNING', userId: user.id, ip: req.ip });
      return res.status(401).json({ success: false, error: 'Código inválido. Verifica tu app autenticadora.' });
    }

    const { plain, hashes } = generarBackupCodes(8);
    await db.query(
      `UPDATE usuarios
       SET mfa_enabled = TRUE, mfa_backup_codes = $1, mfa_enrolled_at = NOW()
       WHERE id = $2`,
      [hashes, user.id]
    );

    await logAudit('MFA_ENABLED', {
      severity: 'INFO',
      userId: user.id,
      ip: req.ip,
      backupCodes: hashes.length
    });

    res.json({
      success: true,
      data: { enabled: true, backupCodes: plain },
    });
  } catch (e) {
    console.error('[mfa.verify]', e);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// ─── POST /api/auth/mfa/disable { password } → exige contraseña vigente ──────
// Desactiva MFA y limpia secret/backup codes/enrolamiento.
mfaManagementRouter.post('/disable', authMiddleware, async (req, res) => {
  try {
    if (mfaDisabled()) {
      return res.status(503).json({ success: false, error: 'MFA deshabilitado' });
    }
    const { password } = req.body ?? {};
    if (!password) {
      return res.status(400).json({ success: false, error: 'password requerida para desactivar MFA' });
    }
    const user = await loadSelf(req.user?.sub);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    if (user.mfa_enabled !== true) {
      return res.status(409).json({ success: false, error: 'MFA no está activado' });
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
      await logAudit('MFA_DISABLE_FAILED', { severity: 'WARNING', userId: user.id, ip: req.ip });
      return res.status(401).json({ success: false, error: 'Contraseña incorrecta' });
    }

    await db.query(
      `UPDATE usuarios
       SET mfa_enabled = FALSE, mfa_secret = NULL,
           mfa_backup_codes = NULL, mfa_enrolled_at = NULL
       WHERE id = $1`,
      [user.id]
    );

    await logAudit('MFA_DISABLED', { severity: 'WARNING', userId: user.id, ip: req.ip });

    res.json({ success: true, data: { enabled: false } });
  } catch (e) {
    console.error('[mfa.disable]', e);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export default router;
