import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISSUER = 'LegalProAPI';
const JWT_AUDIENCE = 'LegalProClients';
const JWT_EXPIRY = process.env.JWT_EXPIRY_SECONDS ? parseInt(process.env.JWT_EXPIRY_SECONDS) : 3600;

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
    payload.rol_org = organizacion.rol_miembro; // OWNER | ADMIN | MEMBER | VIEWER
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
 */
router.post('/register', async (req, res, next) => {
  try {
    // Guard: si req.body es undefined (Content-Type ausente o body vacío)
    const { nombreCompleto, email, password, rol = 'ABOGADO', especialidad = 'GENERAL' } = req.body ?? {};

    if (!nombreCompleto || !email || !password) {
      return res.status(400).json({ error: 'nombreCompleto, email y password son obligatorios.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    const rolesPermitidos = ['ABOGADO', 'JUEZ', 'FISCAL', 'CONTADOR'];
    if (!rolesPermitidos.includes(rol.toUpperCase())) {
      return res.status(400).json({ error: `Rol inválido. Valores permitidos: ${rolesPermitidos.join(', ')}.` });
    }

    // Verificar email duplicado
    const { rows: existing } = await db.query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'El email ya está registrado.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { rows: inserted } = await db.query(
      `INSERT INTO usuarios (nombre_completo, email, password_hash, rol, especialidad, esta_activo)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING *`,
      [
        nombreCompleto.trim(),
        email.toLowerCase().trim(),
        passwordHash,
        rol.toUpperCase(),
        especialidad.toUpperCase(),
      ]
    );
    const usuario = inserted[0];
    if (!usuario) return res.status(500).json({ error: 'Error al crear usuario. Inténtelo de nuevo.' });

    const token = generateToken(usuario, null);
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
    // Guard: si req.body es undefined (Content-Type ausente o body malformado)
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
       WHERE u.email = $1 AND u.esta_activo = TRUE
       LIMIT 1`,
      [email.toLowerCase().trim()]
    );
    const usuario = rows[0] || null;

    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const valid = await bcrypt.compare(password, usuario.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    // Construir org desde la fila JOIN
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
 * GET /api/auth/me — Retorna perfil del usuario autenticado + JWT refrescado con claims tenant.
 * NOTA: Regenera el token para que el frontend tenga claims actualizados
 * (p.ej. después de crear o unirse a una organización).
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
       WHERE u.id = $1
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

    // Regenerar token con claims actualizados
    const token = generateToken(usuario, org);

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

export default router;
