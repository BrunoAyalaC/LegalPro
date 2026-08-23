// legalpro-app/server/routes/auth-login-mfa.js
// Generado por @auditor-seguridad + @backend-node
// FIX CRITICAL: Login con soporte MFA para roles sensibles
// Reemplaza al routes/auth.js en el endpoint POST /api/auth/login

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { logAudit } from '../utils/audit.js';
import { generateTokenPair, validateAndRotateRefreshToken } from '../utils/jwt.js';
import { bruteForceMiddleware } from '../middleware/bruteForce.js';

const router = Router();
const MFA_REQUIRED_ROLES = new Set(['ABOGADO', 'FISCAL', 'JUEZ', 'ADMIN', 'OWNER']);

// POST /api/auth/login
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

    // Si MFA esta habilitado y es rol sensible, requerir token
    if (MFA_REQUIRED_ROLES.has(user.rol) && user.mfa_enabled) {
      return res.json({
        success: true,
        // Flag top-level: lo detecta client.ts login() sin lanzar error de "token faltante"
        mfaRequired: true,
        data: {
          mfaRequired: true,
          userId: user.id,
          mfaMethods: ['totp', 'backup'],
          message: 'MFA token required. Use POST /api/auth/mfa/verify'
        }
      });
    }

    // Si rol sensible SIN MFA habilitado, forzar setup
    if (MFA_REQUIRED_ROLES.has(user.rol) && !user.mfa_enabled) {
      return res.json({
        success: true,
        // Flag top-level: lo detecta client.ts login() sin lanzar error de "token faltante"
        mfaSetupRequired: true,
        data: {
          mfaSetupRequired: true,
          userId: user.id,
          message: 'MFA setup required for this role. Use POST /api/auth/mfa/setup'
        }
      });
    }

    // Login exitoso sin MFA (roles no sensibles)
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

    // Resolver organización activa (mismo patrón que routes/auth.js login: líneas 254-343).
    // Replica el LEFT JOIN a miembros_organizacion + organizaciones para obtener rolMiembro.
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
    // Nivel raíz (token/usuario/organizacion): lo que espera la SPA
    //   legalpro-app/src/api/client.ts login() → setTokens(data.token, '')
    //   y TenantContext.parseJwt/buildStateFromPayload.
    // data.* (accessToken/refreshToken/user): compatibilidad hacia atrás con
    //   e2e/critical-fixes.spec.js (b.data.accessToken) y smoke-production-final.mjs
    //   (body.token || body.accessToken).
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

// POST /api/auth/login/mfa - Login con MFA (segundo paso)
router.post('/login/mfa', async (req, res) => {
  try {
    const { userId, mfaToken, mfaType } = req.body;
    if (!userId || !mfaToken) {
      return res.status(400).json({ success: false, error: 'userId y mfaToken requeridos' });
    }

    const { authenticator } = await import('otplib');
    const { rows: users } = await db.query(
      `SELECT id, email, mfa_secret, mfa_backup_codes, mfa_enabled, mfa_required_setup
       FROM usuarios WHERE id = $1`,
      [userId]
    );
    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid' });
    }

    const user = users[0];
    let isValid = false;
    let usedBackup = false;

    if (mfaType === 'backup') {
      const codes = user.mfa_backup_codes || [];
      const idx = codes.indexOf(mfaToken.toUpperCase());
      if (idx >= 0) {
        isValid = true;
        usedBackup = true;
        codes.splice(idx, 1);
        await db.query(
          `UPDATE usuarios SET mfa_backup_codes = $1 WHERE id = $2`,
          [JSON.stringify(codes), userId]
        );
      }
    } else {
      isValid = authenticator.verify({
        token: String(mfaToken).replace(/\s/g, ''),
        secret: user.mfa_secret
      });
    }

    if (!isValid) {
      await logAudit('MFA_LOGIN_FAILED', {
        severity: 'WARNING',
        userId,
        ip: req.ip,
        type: mfaType
      });
      return res.status(401).json({ success: false, error: 'Invalid MFA token' });
    }

    // Emitir tokens
    const { rows: fullUser } = await db.query(
      `SELECT id, email, nombre_completo, rol, organization_id, acepta_transferencia_internacional
       FROM usuarios WHERE id = $1`,
      [userId]
    );
    const u = fullUser[0];
    const { generateTokenPair } = await import('../utils/jwt.js');
    const tokens = await generateTokenPair({
      userId: u.id,
      email: u.email,
      rol: u.rol,
      organizationId: u.organization_id
    });

    await logAudit('AUTH_LOGIN_SUCCESS', {
      severity: 'INFO',
      userId: u.id,
      email: u.email,
      ip: req.ip,
      mfa: true,
      mfaType,
      usedBackup
    });

    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: u,
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

export default router;
