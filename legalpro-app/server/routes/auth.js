import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../db.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware.js';
import { logAudit } from '../utils/audit.js';
import logger from '../logger.js';

const router = Router();

// SEGURIDAD: las respuestas de autenticación NUNCA deben cachearse. Sin esto,
// el navegador puede cachear GET /api/auth/me y "resucitar" la sesión después
// del logout (la cookie ya no existe pero el navegador sirve la respuesta
// autenticada desde su caché). OWASP A07:2021.
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISSUER = 'LegalProAPI';
const JWT_AUDIENCE = 'LegalProClients';
const JWT_EXPIRY = process.env.JWT_EXPIRY_SECONDS ? parseInt(process.env.JWT_EXPIRY_SECONDS) : 3600;
const isProd = process.env.NODE_ENV === 'production';

// Configuración de la cookie de sesión. Segura por defecto (producción HTTPS,
// same-origin). Se puede relajar vía env para entornos de pruebas/E2E que
// corren sobre HTTP y/o con frontend y API en orígenes distintos:
//   COOKIE_SECURE=false   → permite enviar la cookie sobre HTTP (solo dev/test)
//   COOKIE_SAMESITE=lax    → permite navegación cross-site de nivel superior
// Nota: sameSite='none' EXIGE secure=true (lo fuerza el navegador).
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || 'strict').toLowerCase();
const COOKIE_SECURE = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === 'true'
  : isProd; // por defecto: seguro en producción, abierto fuera de producción

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: COOKIE_SAMESITE === 'none' ? true : COOKIE_SECURE,
  sameSite: COOKIE_SAMESITE,
  path: '/api',
  maxAge: JWT_EXPIRY * 1000,
};

function setTokenCookie(res, token) {
  res.cookie('token', token, COOKIE_OPTIONS);
}

function clearTokenCookie(res) {
  res.clearCookie('token', { path: '/api', sameSite: COOKIE_OPTIONS.sameSite, secure: COOKIE_OPTIONS.secure });
}

function getRequestIp(req) {
  return req.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
    || req.ip
    || req.socket?.remoteAddress
    || null;
}

/**
 * Normaliza el consentimiento LPDP soportando el contrato anidado y el plano.
 * Devuelve siempre la forma anidada: { terminos:{aceptado,version}, privacidad:{...}, ... }
 */
function normalizarConsentimientos(anidado, body) {
  if (anidado && typeof anidado === 'object') return anidado;
  const flag = (v) => v === true || v === 'true';
  return {
    terminos: { aceptado: flag(body.aceptaTerminos), version: body.terminosVersion ?? '1.0' },
    privacidad: { aceptado: flag(body.aceptaPrivacidad), version: body.privacidadVersion ?? '1.0' },
    marketing: { aceptado: flag(body.aceptaMarketing), version: '1.0' },
    transferencia: { aceptado: flag(body.aceptaTransferenciaInternacional), version: '1.0' },
  };
}

/**
 * Genera un JWT con los claims del usuario + contexto tenant.
 */
function generateToken(usuario, organizacion) {
  const payload = {
    sub: usuario.id.toString(),
    email: usuario.email,
    rol: usuario.rol,
    nombre_completo: usuario.nombre_completo,
    especialidad: usuario.especialidad,
  };

  if (organizacion) {
    payload.organization_id = organizacion.id;
    payload.organization_name = organizacion.nombre;
    payload.organization_slug = organizacion.slug;
    payload.plan = organizacion.plan;
    payload.usuarios_max = organizacion.max_usuarios;
    payload.expedientes_max = organizacion.max_expedientes;
    payload.rol_org = organizacion.rol_miembro;
    payload.is_org_admin = ['OWNER', 'ADMIN'].includes(organizacion.rol_miembro);
  }

  return jwt.sign(payload, JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: JWT_EXPIRY,
  });
}

/**
 * POST /api/auth/register
 * Registra un usuario nuevo (sin organización — debe crear/unirse después).
 * REQUIERE consentimiento explícito de Términos y Privacidad (LPDP Perú).
 */
router.post('/register', idempotencyMiddleware(), async (req, res, next) => {
  try {
    const {
      nombreCompleto: nombreCompletoRaw,
      nombre_completo,
      email,
      password,
      rol = 'ABOGADO',
      especialidad = 'GENERAL',
      consentimientos: consentimientosRaw,
    } = req.body ?? {};

    const nombreCompleto = nombreCompletoRaw ?? nombre_completo;

    // Normaliza el consentimiento aceptando AMBOS contratos:
    //  - Anidado:  { consentimientos: { terminos: { aceptado, version }, ... } }
    //  - Plano:    { aceptaTerminos: true, aceptaPrivacidad: true, ... }
    const consentimientos = normalizarConsentimientos(consentimientosRaw, req.body ?? {});

    if (!nombreCompleto || !email || !password) {
      return res.status(400).json({ error: 'nombreCompleto, email y password son obligatorios.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    // Validación de formato (rol) antes que las reglas de negocio (consentimiento).
    const rolesPermitidos = ['ABOGADO', 'JUEZ', 'FISCAL', 'CONTADOR'];
    if (!rolesPermitidos.includes(rol.toUpperCase())) {
      return res.status(400).json({ error: `Rol inválido. Valores permitidos: ${rolesPermitidos.join(', ')}.` });
    }

    if (!consentimientos?.terminos?.aceptado) {
      return res.status(400).json({ error: 'Debe aceptar los Términos y Condiciones para registrarse.' });
    }
    if (!consentimientos?.privacidad?.aceptado) {
      return res.status(400).json({ error: 'Debe aceptar la Política de Privacidad para registrarse.' });
    }

    // Verificar email duplicado (solo usuarios no eliminados)
    const { rows: existing } = await db.query(
      'SELECT id FROM usuarios WHERE email = $1 AND eliminado_en IS NULL',
      [email.toLowerCase().trim()]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'El email ya está registrado.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const ahora = new Date().toISOString();
    const versionTerminos = consentimientos?.terminos?.version ?? '1.0';
    const versionPrivacidad = consentimientos?.privacidad?.version ?? '1.0';

    const result = await db.query(
      `INSERT INTO usuarios (
         nombre_completo, email, password_hash, rol, especialidad, esta_activo,
         terminos_aceptados_en, terminos_version,
         privacidad_aceptada_en, privacidad_version,
         created_at
       )
       VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [
        nombreCompleto.trim(),
        email.toLowerCase().trim(),
        passwordHash,
        rol.toUpperCase(),
        especialidad.toUpperCase(),
        ahora,
        versionTerminos,
        ahora,
        versionPrivacidad,
      ]
    );
    const usuario = result.rows[0];
    if (!usuario) return res.status(500).json({ error: 'Error al crear usuario. Inténtelo de nuevo.' });

    // Registrar consentimientos en tabla de trazabilidad
    try {
      const consentValues = [
        [usuario.id, 'terminos',     versionTerminos,  true, req.ip ?? null, req.headers['user-agent'] ?? null],
        [usuario.id, 'privacidad',   versionPrivacidad, true, req.ip ?? null, req.headers['user-agent'] ?? null],
      ];
      if (consentimientos?.marketing?.aceptado) {
        consentValues.push([
          usuario.id, 'marketing',
          consentimientos.marketing.version ?? '1.0',
          true, req.ip ?? null, req.headers['user-agent'] ?? null,
        ]);
      }
      if (consentimientos?.transferencia?.aceptado) {
        consentValues.push([
          usuario.id, 'transferencia_internacional',
          consentimientos.transferencia.version ?? '1.0',
          true, req.ip ?? null, req.headers['user-agent'] ?? null,
        ]);
      }

      const placeholders = consentValues.map((_, i) => {
        const base = i * 6;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, NOW())`;
      }).join(',\n');

      const flatParams = consentValues.flat();

      await db.query(
        `INSERT INTO consentimientos (usuario_id, tipo, version, aceptado, ip_address, user_agent, created_at)
         VALUES ${placeholders}`,
        flatParams
      );
    } catch (consentErr) {
      // LPDP (Ley 29733): la trazabilidad del consentimiento es obligatoria.
      // NUNCA tragar el error: si el INSERT falla, el registro queda inválido.
      logger.error('[auth] No se pudo registrar consentimientos LPDP', {
        error: consentErr.message,
        code: consentErr.code ?? 'UNKNOWN',
        userId: usuario.id,
        ip: getRequestIp(req),
      });

      // Fallos de validación de datos (CHECK violation, NOT NULL, tipo inválido,
      // truncamiento) → 400 con detalle.
      if (['23514', '23502', '22P02', '22001'].includes(consentErr?.code)) {
        return res.status(400).json({
          error: 'Datos de consentimiento inválidos. Verifique los valores y vuelva a intentar.',
        });
      }
      // Cualquier otro fallo → 500 explícito (no continuar silenciosamente).
      return res.status(500).json({
        error: 'No se pudo registrar el consentimiento LPDP. Inténtelo de nuevo.',
      });
    }

    logAudit('USER_REGISTERED', {
      severity: 'INFO',
      userId: usuario.id,
      ip: getRequestIp(req),
      rol: usuario.rol,
    }).catch(() => {});

    const token = generateToken(usuario, null);
    setTokenCookie(res, token);
    return res.status(201).json({
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombreCompleto: usuario.nombre_completo,
        rol: usuario.rol,
      },
      mensaje: 'Usuario registrado. Crea o únete a una organización para continuar.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: 'email y password son obligatorios.' });
    }

    const { rows } = await db.query(
      `SELECT u.*,
              mo.rol  AS rol_miembro,
              mo.activo AS memb_activo,
              o.id    AS org_id,
              o.nombre AS org_nombre,
              o.slug  AS org_slug,
              o.plan  AS org_plan,
              o.max_usuarios,
              o.max_expedientes
       FROM usuarios u
       LEFT JOIN miembros_organizacion mo ON mo.usuario_id = u.id AND mo.activo = TRUE
       LEFT JOIN organizaciones o ON o.id = mo.organizacion_id
       WHERE u.email = $1 AND u.esta_activo = TRUE AND u.eliminado_en IS NULL
       LIMIT 1`,
      [email.toLowerCase().trim()]
    );
    const usuario = rows[0] || null;

    if (!usuario) {
      logAudit('LOGIN_FAILED', {
        severity: 'WARNING', ip: getRequestIp(req), reason: 'user_not_found',
      }).catch(() => {});
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const valid = await bcrypt.compare(password, usuario.password_hash);
    if (!valid) {
      logAudit('LOGIN_FAILED', {
        severity: 'WARNING', userId: usuario.id, ip: getRequestIp(req), reason: 'bad_password',
      }).catch(() => {});
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    // ── ADR-004-rev1: challenge MFA SOLO si mfa_enabled=true ────────────────
    // Este ES el handler vivo de POST /api/auth/login (montado antes que
    // auth-login-mfa.js en index.js). `SELECT u.*` expone mfa_enabled una vez
    // aplicada tools/migrations/2026-08-23-mfa-columns.sql; pre-migración la
    // columna no existe → undefined → falsy → login normal (sin 500).
    // Kill switch: FEATURE_MFA=false desactiva el segundo factor completo.
    // El segundo paso vive en POST /api/auth/login/mfa (auth-login-mfa.js).
    if (process.env.FEATURE_MFA !== 'false' && usuario.mfa_enabled === true) {
      logAudit('MFA_CHALLENGE', {
        severity: 'INFO', userId: usuario.id, ip: getRequestIp(req),
      }).catch(() => {});
      // Sin token ni cookie: la sesión solo se establece al verificar el
      // segundo factor. Contrato dual esperado por client.ts login().
      return res.json({
        success: true,
        mfaRequired: true,
        userId: usuario.id,
        data: {
          mfaRequired: true,
          userId: usuario.id,
          mfaMethods: ['totp', 'backup'],
          message: 'MFA token required. Use POST /api/auth/login/mfa',
        },
      });
    }

    const org = usuario.org_id
      ? {
          id: usuario.org_id,
          nombre: usuario.org_nombre,
          slug: usuario.org_slug,
          plan: usuario.org_plan,
          max_usuarios: usuario.max_usuarios,
          max_expedientes: usuario.max_expedientes,
          rol_miembro: (usuario.rol_miembro || 'MEMBER').toUpperCase(),
        }
      : null;

    const token = generateToken(usuario, org);
    setTokenCookie(res, token);

    logAudit('LOGIN_SUCCESS', {
      severity: 'INFO',
      userId: usuario.id,
      organizationId: org?.id ?? null,
      ip: getRequestIp(req),
    }).catch(() => {});

    return res.json({
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombreCompleto: usuario.nombre_completo,
        rol: usuario.rol,
      },
      organizacion: org
        ? {
            id: org.id,
            nombre: org.nombre,
            slug: org.slug,
            plan: org.plan,
            rolMiembro: org.rol_miembro,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (_req, res) => {
  clearTokenCookie(res);
  return res.json({ mensaje: 'Sesión cerrada.' });
});

/**
 * DELETE /api/auth/cuenta
 * Ejercicio del derecho al olvido (LPDP Perú / GDPR).
 * Soft delete + anonimización + eliminación hard de chats y datos sensibles.
 */
router.delete('/cuenta', authMiddleware, async (req, res, next) => {
  try {
    const usuarioId = req.user.sub;
    const ahora = new Date().toISOString();

    const { rows: userRows } = await db.query(
      'SELECT email FROM usuarios WHERE id = $1 AND eliminado_en IS NULL',
      [usuarioId]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado o ya eliminado.' });
    }
    const emailOriginal = userRows[0].email;

    const crypto = await import('crypto');
    const emailHash = crypto.createHash('sha256').update(emailOriginal + process.env.JWT_SECRET).digest('hex');

    await db.query(
      `UPDATE usuarios
       SET nombre_completo = 'Usuario Eliminado',
           email = $1,
           email_hash = $2,
           password_hash = '[REVOKED]',
           esta_activo = FALSE,
           datos_anonimizados = TRUE,
           eliminado_en = NOW(),
           updated_at = NOW()
       WHERE id = $3`,
      [`deleted-${emailHash.slice(0, 16)}@legalpro.pe`, emailHash, usuarioId]
    );

    await db.query('DELETE FROM mensajes_chat WHERE usuario_id = $1', [usuarioId]);

    const { rows: simRows } = await db.query('SELECT id FROM simulaciones WHERE usuario_id = $1', [usuarioId]);
    for (const sim of simRows) {
      await db.query('DELETE FROM eventos_simulacion WHERE simulacion_id = $1', [sim.id]);
    }
    await db.query('DELETE FROM simulaciones WHERE usuario_id = $1', [usuarioId]);

    await db.query('DELETE FROM refresh_tokens WHERE usuario_id = $1', [usuarioId]);

    try {
      await db.query(
        `INSERT INTO consentimientos (usuario_id, tipo, version, aceptado, ip_address, user_agent, created_at)
         VALUES ($1, 'eliminacion', '1.0', TRUE, $2, $3, NOW())`,
        [usuarioId, req.ip ?? null, req.headers['user-agent'] ?? null]
      );
    } catch (consentErr) {
      // La cuenta ya fue anonimizada; el fallo de trazabilidad no puede revertirse,
      // pero NO debe tragarse: queda en el log estructurado con masking PII.
      logger.error('[auth] No se pudo registrar consentimiento de eliminación', {
        error: consentErr.message,
        code: consentErr.code ?? 'UNKNOWN',
        userId: usuarioId,
        ip: getRequestIp(req),
      });
    }

    clearTokenCookie(res);

    return res.json({
      mensaje: 'Cuenta eliminada exitosamente. Sus datos personales han sido anonimizados y sus conversaciones eliminadas.',
      eliminadoEn: ahora,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me — Retorna perfil del usuario autenticado + JWT refrescado con claims tenant.
 */
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.nombre_completo, u.email, u.rol, u.especialidad, u.esta_activo, u.created_at,
              mo.rol  AS rol_miembro,
              o.id    AS org_id,
              o.nombre AS org_nombre,
              o.slug  AS org_slug,
              o.plan  AS org_plan,
              o.max_usuarios,
              o.max_expedientes
       FROM usuarios u
       LEFT JOIN miembros_organizacion mo ON mo.usuario_id = u.id AND mo.activo = TRUE
       LEFT JOIN organizaciones o ON o.id = mo.organizacion_id
       WHERE u.id = $1 AND u.eliminado_en IS NULL
       LIMIT 1`,
      [req.user.sub]
    );
    const usuario = rows[0] || null;

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const org = usuario.org_id
      ? {
          id: usuario.org_id,
          nombre: usuario.org_nombre,
          slug: usuario.org_slug,
          plan: usuario.org_plan,
          max_usuarios: usuario.max_usuarios,
          max_expedientes: usuario.max_expedientes,
          rol_miembro: (usuario.rol_miembro || 'MEMBER').toUpperCase(),
        }
      : null;

    const token = generateToken(usuario, org);
    setTokenCookie(res, token);

    return res.json({
      id: usuario.id,
      email: usuario.email,
      nombreCompleto: usuario.nombre_completo,
      rol: usuario.rol,
      especialidad: usuario.especialidad,
      estaActivo: usuario.esta_activo,
      creadoEn: usuario.created_at,
      token,
      organizacion: org
        ? {
            id: org.id,
            nombre: org.nombre,
            slug: org.slug,
            plan: org.plan,
            rolMiembro: org.rol_miembro,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/change-password
 * Cambia la contraseña del usuario autenticado.
 * Protegido con authMiddleware. Requiere contraseña actual + nueva.
 */
router.post('/change-password', authMiddleware, async (req, res, next) => {
  try {
    const body = req.body ?? {};
    // Compatibilidad de contrato ES/EN
    const currentPassword = body.passwordActual ?? body.currentPassword;
    const newPassword = body.nuevaPassword ?? body.newPassword;
    const confirmarPassword = body.confirmarPassword ?? body.confirmPassword ?? newPassword;

    // ── Validaciones ──────────────────────────────────────────────────────
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Campos obligatorios: contraseña actual y nueva contraseña.',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'La nueva contraseña debe tener al menos 8 caracteres.',
      });
    }

    if (newPassword !== confirmarPassword) {
      return res.status(400).json({
        success: false,
        error: 'La nueva contraseña y su confirmación no coinciden.',
      });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({
        success: false,
        error: 'La nueva contraseña debe ser diferente de la actual.',
      });
    }

    // ── Verificar contraseña actual ────────────────────────────────────────
    const { rows: usuarios } = await db.query(
      'SELECT id, password_hash FROM usuarios WHERE id = $1 AND eliminado_en IS NULL',
      [req.user.sub]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });
    }

    const usuario = usuarios[0];
    const passwordValida = await bcrypt.compare(currentPassword, usuario.password_hash);

    if (!passwordValida) {
      return res.status(401).json({ success: false, error: 'La contraseña actual es incorrecta.' });
    }

    // ── Hashear y actualizar ───────────────────────────────────────────────
    const nuevoHash = await bcrypt.hash(newPassword, 12);

    await db.query(
      'UPDATE usuarios SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [nuevoHash, req.user.sub]
    );

    // ── Audit event ────────────────────────────────────────────────────────
    logAudit('PASSWORD_CHANGED', {
      severity: 'INFO',
      userId: req.user.sub,
      organizationId: req.user.organization_id,
      ip: req.ip,
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Contraseña actualizada correctamente.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/forgot-password
 * Solicita restablecimiento de contraseña.
 * Genera y almacena un token temporal con expiración de 1 hora.
 * Siempre responde el mismo mensaje (seguridad por oscuridad).
 */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body ?? {};

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'El campo email es obligatorio.',
      });
    }

    // Buscar usuario activo por email
    const { rows: usuarios } = await db.query(
      'SELECT id, email FROM usuarios WHERE email = $1 AND esta_activo = TRUE AND eliminado_en IS NULL LIMIT 1',
      [email.toLowerCase().trim()]
    );

    if (usuarios.length > 0) {
      const usuario = usuarios[0];
      // Generar token seguro de 32 bytes hex
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      await db.query(
        'UPDATE usuarios SET reset_token = $1, reset_token_expiry = $2, updated_at = NOW() WHERE id = $3',
        [resetToken, expiry.toISOString(), usuario.id]
      );

      // Audit: registrar solicitud (sin incluir el token)
      logAudit('PASSWORD_RESET_REQUESTED', {
        severity: 'INFO',
        userId: usuario.id,
        email: usuario.email,
        ip: req.ip,
      }).catch(() => {});
    }

    // Siempre responder el mismo mensaje para no revelar si el email existe
    return res.json({
      success: true,
      message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
