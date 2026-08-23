import { Router } from 'express';
import crypto from 'crypto';
import db from '../db.js';
import { authMiddleware, tenantMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware.js';
import { createOrganizacionSchema } from '../schemas/organizacionSchema.js';
import { OrganizacionRepository } from '../repositories/OrganizacionRepository.js';

const router = Router();
const organizacionRepo = new OrganizacionRepository(db);

// ─── PLAN LIMITS ─────────────────────────────────────────────────────────────
const PLAN_LIMITS = {
  BASICO:       { dbValue: 'basico',       max_usuarios: 3,   max_expedientes: 10  },
  PROFESIONAL:  { dbValue: 'profesional',  max_usuarios: 15,  max_expedientes: 200 },
  EMPRESA:      { dbValue: 'empresa',      max_usuarios: 100, max_expedientes: 5000 },
};

const PLAN_ALIASES = {
  FREE: 'BASICO',
  PRO: 'PROFESIONAL',
  ENTERPRISE: 'EMPRESA',
};

function normalizePlan(plan) {
  const key = String(plan || 'BASICO').trim().toUpperCase();
  return PLAN_ALIASES[key] || key;
}

// ─── POST /api/organizaciones ─────────────────────────────────────────────────
// Crea una nueva organización y convierte al usuario en OWNER.
router.post('/', authMiddleware, idempotencyMiddleware(), validate(createOrganizacionSchema), async (req, res, next) => {
  try {
    const { nombre, plan } = req.body;
    const usuarioId = req.user.sub;

    const planKey = normalizePlan(plan);
    const limits = PLAN_LIMITS[planKey];
    if (!limits) {
      return res.status(400).json({ error: `Plan inválido. Valores: ${Object.keys(PLAN_LIMITS).join(', ')}.` });
    }

    // Slug único a partir del nombre
    const slug = nombre.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) + '-' + crypto.randomBytes(3).toString('hex');

    // Verificar que el usuario no tenga ya una organización como OWNER
    const ownerRol = await organizacionRepo.getMemberRole(null, usuarioId);
    // getMemberRole requiere orgId; usamos query directa para este check global
    const { rows: ownerCheck } = await db.query(
      `SELECT mo.id FROM miembros_organizacion mo
       WHERE mo.usuario_id = $1 AND mo.rol = 'OWNER' AND mo.activo = TRUE
       LIMIT 1`,
      [usuarioId]
    );
    if (ownerCheck.length > 0) {
      return res.status(409).json({ error: 'Ya eres propietario de una organización.' });
    }

    const org = await organizacionRepo.create(
      { nombre, slug, plan: limits.dbValue, maxUsuarios: limits.max_usuarios, maxExpedientes: limits.max_expedientes },
      usuarioId
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

    const org = await organizacionRepo.findById(orgId);

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
      creditosDisponibles: org.creditos_disponibles ?? 0,
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

    const miembros = await organizacionRepo.findMembers(orgId);

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
    const maxUsuarios = await organizacionRepo.getMaxUsuarios(orgId);
    const totalMiembros = await organizacionRepo.countActiveMembers(orgId);
    if (totalMiembros >= maxUsuarios) {
      return res.status(402).json({ error: 'Límite de usuarios del plan alcanzado. Actualiza tu plan.' });
    }

    // Verificar invitación duplicada pendiente
    const invExist = await organizacionRepo.findPendingInvitation(orgId, email);
    if (invExist) {
      return res.status(409).json({ error: 'Ya existe una invitación pendiente para este email.' });
    }

    const token = crypto.randomBytes(32).toString('hex');

    const invitacion = await organizacionRepo.createInvitation(orgId, email, rolInvitado, token, req.user.sub);

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

    const invitacion = await organizacionRepo.findInvitationByToken(token);

    if (!invitacion) {
      return res.status(404).json({ error: 'Invitación no encontrada o ya utilizada.' });
    }

    if (new Date(invitacion.expira_at) < new Date()) {
      return res.status(410).json({ error: 'La invitación ha expirado.' });
    }

    // Verificar que no sea ya miembro
    const yaMiembro = await organizacionRepo.isMember(invitacion.organization_id, usuarioId);
    if (yaMiembro) {
      return res.status(409).json({ error: 'Ya eres miembro de esta organización.' });
    }

    await organizacionRepo.acceptInvitation(
      invitacion.id,
      usuarioId,
      invitacion.organization_id,
      invitacion.rol
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

// ─── DELETE /api/organizaciones/me/miembros/:targetUserId ─────────────────────
router.delete('/me/miembros/:targetUserId', authMiddleware, tenantMiddleware, requireRole(['OWNER', 'ADMIN']), async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const { targetUserId } = req.params;

    if (req.user.sub === targetUserId) {
      return res.status(400).json({ error: 'No puedes removerte a ti mismo.' });
    }

    // No se puede remover al OWNER
    const targetRol = await organizacionRepo.getMemberRole(orgId, targetUserId);
    if (!targetRol) {
      return res.status(404).json({ error: 'Miembro no encontrado.' });
    }
    if (targetRol === 'OWNER') {
      return res.status(403).json({ error: 'No se puede remover al propietario de la organización.' });
    }

    await organizacionRepo.removeMember(orgId, targetUserId);

    return res.json({ mensaje: 'Miembro removido exitosamente.' });
  } catch (err) {
    next(err);
  }
});

export default router;
