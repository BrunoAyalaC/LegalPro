import { Router } from 'express';
import crypto from 'crypto';
import db from '../db.js';
import { authMiddleware, tenantMiddleware, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// ─── PLAN LIMITS ─────────────────────────────────────────────────────────────
const PLAN_LIMITS = {
  FREE:       { max_usuarios: 3,   max_expedientes: 10  },
  PRO:        { max_usuarios: 15,  max_expedientes: 200 },
  ENTERPRISE: { max_usuarios: 100, max_expedientes: 5000 },
};

// ─── POST /api/organizaciones ─────────────────────────────────────────────────
// Crea una nueva organización y convierte al usuario en OWNER.
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { nombre, plan = 'FREE' } = req.body;
    const usuarioId = req.user.sub;

    if (!nombre?.trim()) {
      return res.status(400).json({ error: 'El nombre de la organización es obligatorio.' });
    }

    const planesValidos = Object.keys(PLAN_LIMITS);
    if (!planesValidos.includes(plan.toUpperCase())) {
      return res.status(400).json({ error: `Plan inválido. Valores: ${planesValidos.join(', ')}.` });
    }

    const planKey = plan.toUpperCase();
    const limits = PLAN_LIMITS[planKey];

    // Slug único a partir del nombre
    const slug = nombre.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) + '-' + crypto.randomBytes(3).toString('hex');

    // Verificar que el usuario no tenga ya una organización como OWNER
    const { rows: ownerCheck } = await db.query(
      `SELECT mo.id FROM miembros_organizacion mo
       WHERE mo.usuario_id = $1 AND mo.rol = 'OWNER' AND mo.activo = TRUE
       LIMIT 1`,
      [usuarioId]
    );
    if (ownerCheck.length > 0) {
      return res.status(409).json({ error: 'Ya eres propietario de una organización.' });
    }

    const { rows: orgRows } = await db.query(
      `INSERT INTO organizaciones (nombre, slug, plan, max_usuarios, max_expedientes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nombre.trim(), slug, planKey.toLowerCase(), limits.max_usuarios, limits.max_expedientes]
    );
    const org = orgRows[0];

    // Crear membresía OWNER
    await db.query(
      `INSERT INTO miembros_organizacion (organizacion_id, usuario_id, rol, activo)
       VALUES ($1, $2, 'OWNER', TRUE)`,
      [org.id, usuarioId]
    );

    return res.status(201).json({
      organizacion: org,
      mensaje: 'Organización creada exitosamente.',
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/organizaciones/me ───────────────────────────────────────────────
// Retorna la organización actual y sus métricas.
router.get('/me', authMiddleware, tenantMiddleware, async (req, res, next) => {
  try {
    const orgId = req.organizationId;

    const { rows } = await db.query(
      `SELECT o.*,
              (SELECT COUNT(*) FROM miembros_organizacion WHERE organizacion_id = o.id AND activo = TRUE) AS usuarios_usados,
              (SELECT COUNT(*) FROM expedientes WHERE organization_id = o.id) AS expedientes_usados
       FROM organizaciones o
       WHERE o.id = $1`,
      [orgId]
    );
    const org = rows[0] || null;

    if (!org) {
      return res.status(404).json({ error: 'Organización no encontrada.' });
    }

    return res.json({
      id: org.id,
      nombre: org.nombre,
      slug: org.slug,
      plan: org.plan,
      maxUsuarios: org.max_usuarios,
      maxExpedientes: org.max_expedientes,
      usuariosUsados: parseInt(org.usuarios_usados, 10),
      expedientesUsados: parseInt(org.expedientes_usados, 10),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/organizaciones/me/miembros ─────────────────────────────────────
router.get('/me/miembros', authMiddleware, tenantMiddleware, async (req, res, next) => {
  try {
    const orgId = req.organizationId;

    const { rows: miembros } = await db.query(
      `SELECT mo.id, mo.rol, mo.activo, mo.created_at,
              u.id AS u_id, u.nombre_completo, u.email, u.rol AS u_rol, u.especialidad
       FROM miembros_organizacion mo
       JOIN usuarios u ON u.id = mo.usuario_id
       WHERE mo.organizacion_id = $1 AND mo.activo = TRUE
       ORDER BY mo.created_at ASC`,
      [orgId]
    );

    return res.json({
      miembros: miembros.map(m => ({
        id: m.id,
        rol: m.rol,
        activo: m.activo,
        created_at: m.created_at,
        usuarios: {
          id: m.u_id,
          nombre_completo: m.nombre_completo,
          email: m.email,
          rol: m.u_rol,
          especialidad: m.especialidad,
        },
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/organizaciones/invitar ────────────────────────────────────────
// Solo OWNER o ADMIN pueden invitar.
router.post('/invitar', authMiddleware, tenantMiddleware, requireRole(['OWNER', 'ADMIN']), async (req, res, next) => {
  try {
    const orgId = req.organizationId;

    const { email, rolInvitado = 'MEMBER' } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'El email del invitado es obligatorio.' });
    }

    const rolesValidos = ['ABOGADO', 'FISCAL', 'JUEZ', 'CONTADOR', 'ADMIN'];
    if (!rolesValidos.includes(rolInvitado.toUpperCase())) {
      return res.status(400).json({ error: `Rol inválido. Valores: ${rolesValidos.join(', ')}.` });
    }

    // Verificar límite de usuarios del plan
    const { rows: orgRows } = await db.query(
      'SELECT max_usuarios FROM organizaciones WHERE id = $1',
      [orgId]
    );
    const { rows: countRows } = await db.query(
      'SELECT COUNT(*) AS total FROM miembros_organizacion WHERE organizacion_id = $1 AND activo = TRUE',
      [orgId]
    );
    if (parseInt(countRows[0].total, 10) >= (orgRows[0]?.max_usuarios ?? 3)) {
      return res.status(402).json({ error: 'Límite de usuarios del plan alcanzado. Actualiza tu plan.' });
    }

    // Verificar invitación duplicada pendiente
    const { rows: invExist } = await db.query(
      `SELECT id FROM invitaciones_organizacion
       WHERE organization_id = $1 AND email = $2 AND esta_aceptada = FALSE`,
      [orgId, email.toLowerCase().trim()]
    );
    if (invExist.length > 0) {
      return res.status(409).json({ error: 'Ya existe una invitación pendiente para este email.' });
    }

    const token = crypto.randomBytes(32).toString('hex');

    const { rows: invRows } = await db.query(
      `INSERT INTO invitaciones_organizacion
         (organization_id, email, rol, token, expira_at, invitado_por)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days', $5)
       RETURNING *`,
      [orgId, email.toLowerCase().trim(), rolInvitado.toUpperCase(), token, req.user.sub]
    );
    const invitacion = invRows[0];

    return res.status(201).json({
      invitacion: {
        id: invitacion.id,
        email: invitacion.email,
        rol: invitacion.rol,
        expiresAt: invitacion.expira_at,
      },
      mensaje: 'Invitación creada. Comparte el token con el invitado.',
      token: process.env.NODE_ENV !== 'production' ? token : undefined,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/organizaciones/aceptar-invitacion ─────────────────────────────
router.post('/aceptar-invitacion', authMiddleware, async (req, res, next) => {
  try {
    const { token } = req.body;
    const usuarioId = req.user.sub;

    if (!token) {
      return res.status(400).json({ error: 'El token de invitación es obligatorio.' });
    }

    const { rows: invRows } = await db.query(
      `SELECT inv.*, o.id AS o_id, o.nombre AS o_nombre, o.slug AS o_slug,
              o.plan AS o_plan, o.max_usuarios, o.max_expedientes
       FROM invitaciones_organizacion inv
       JOIN organizaciones o ON o.id = inv.organization_id
       WHERE inv.token = $1 AND inv.esta_aceptada = FALSE
       LIMIT 1`,
      [token]
    );
    const invitacion = invRows[0] || null;

    if (!invitacion) {
      return res.status(404).json({ error: 'Invitación no encontrada o ya utilizada.' });
    }

    if (new Date(invitacion.expira_at) < new Date()) {
      return res.status(410).json({ error: 'La invitación ha expirado.' });
    }

    // Verificar que no sea ya miembro
    const { rows: memCheck } = await db.query(
      `SELECT id FROM miembros_organizacion
       WHERE organizacion_id = $1 AND usuario_id = $2
       LIMIT 1`,
      [invitacion.organization_id, usuarioId]
    );
    if (memCheck.length > 0) {
      return res.status(409).json({ error: 'Ya eres miembro de esta organización.' });
    }

    // Crear membresía (rol MEMBER por defecto; invitacion.rol es el rol legal del usuario)
    await db.query(
      `INSERT INTO miembros_organizacion (organizacion_id, usuario_id, rol, activo)
       VALUES ($1, $2, 'MEMBER', TRUE)`,
      [invitacion.organization_id, usuarioId]
    );

    // Marcar invitación como aceptada
    await db.query(
      `UPDATE invitaciones_organizacion
       SET esta_aceptada = TRUE, aceptada_at = NOW()
       WHERE id = $1`,
      [invitacion.id]
    );

    const org = {
      id: invitacion.o_id,
      nombre: invitacion.o_nombre,
      slug: invitacion.o_slug,
      plan: invitacion.o_plan,
    };
    return res.json({
      organizacion: org,
      rol: invitacion.rol,
      mensaje: `Te uniste a "${org.nombre}" exitosamente.`,
    });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/organizaciones/me/miembros/:usuarioId ───────────────────────
router.delete('/me/miembros/:targetUserId', authMiddleware, tenantMiddleware, requireRole(['OWNER', 'ADMIN']), async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const { targetUserId } = req.params;

    if (req.user.sub === targetUserId) {
      return res.status(400).json({ error: 'No puedes removerte a ti mismo.' });
    }

    // No se puede remover al OWNER
    const { rows: targetRows } = await db.query(
      `SELECT rol FROM miembros_organizacion
       WHERE organizacion_id = $1 AND usuario_id = $2
       LIMIT 1`,
      [orgId, targetUserId]
    );
    if (targetRows.length === 0) {
      return res.status(404).json({ error: 'Miembro no encontrado.' });
    }
    if (targetRows[0].rol === 'OWNER') {
      return res.status(403).json({ error: 'No se puede remover al propietario de la organización.' });
    }

    await db.query(
      `UPDATE miembros_organizacion SET activo = FALSE
       WHERE organizacion_id = $1 AND usuario_id = $2`,
      [orgId, targetUserId]
    );

    return res.json({ mensaje: 'Miembro removido exitosamente.' });
  } catch (err) {
    next(err);
  }
});

export default router;
