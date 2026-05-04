import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * GET /api/mis-datos
 * Retorna TODOS los datos personales del usuario autenticado (derecho de acceso ARCO).
 */
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const usuarioId = req.user.sub;

    // Datos del usuario
    const { rows: userRows } = await db.query(
      `SELECT id, nombre_completo, email, rol, especialidad, esta_activo,
              terminos_aceptados_en, terminos_version,
              privacidad_aceptada_en, privacidad_version,
              created_at, updated_at
       FROM usuarios
       WHERE id = $1 AND eliminado_en IS NULL`,
      [usuarioId]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    const usuario = userRows[0];

    // Organización actual
    const { rows: orgRows } = await db.query(
      `SELECT o.id, o.nombre, o.slug, o.plan, mo.rol as rol_miembro
       FROM miembros_organizacion mo
       JOIN organizaciones o ON o.id = mo.organizacion_id
       WHERE mo.usuario_id = $1 AND mo.activo = TRUE
       LIMIT 1`,
      [usuarioId]
    );

    // Consentimientos
    const { rows: consentRows } = await db.query(
      `SELECT tipo, version, aceptado, created_at
       FROM consentimientos
       WHERE usuario_id = $1
       ORDER BY created_at DESC`,
      [usuarioId]
    );

    // Estadísticas de uso (sin contenido sensible)
    const { rows: statsRows } = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM expedientes WHERE usuario_id = $1) as total_expedientes,
         (SELECT COUNT(*) FROM mensajes_chat WHERE usuario_id = $1) as total_mensajes_chat,
         (SELECT COUNT(*) FROM simulaciones WHERE usuario_id = $1) as total_simulaciones`,
      [usuarioId]
    );

    return res.json({
      usuario: {
        id: usuario.id,
        nombreCompleto: usuario.nombre_completo,
        email: usuario.email,
        rol: usuario.rol,
        especialidad: usuario.especialidad,
        estaActivo: usuario.esta_activo,
        terminosAceptadosEn: usuario.terminos_aceptados_en,
        terminosVersion: usuario.terminos_version,
        privacidadAceptadaEn: usuario.privacidad_aceptada_en,
        privacidadVersion: usuario.privacidad_version,
        creadoEn: usuario.created_at,
        actualizadoEn: usuario.updated_at,
      },
      organizacion: orgRows[0] ?? null,
      consentimientos: consentRows,
      estadisticasUso: statsRows[0] ?? null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/mis-datos
 * Permite actualizar datos personales (derecho de rectificación ARCO).
 */
router.put('/', authMiddleware, async (req, res, next) => {
  try {
    const usuarioId = req.user.sub;
    const { nombreCompleto, especialidad } = req.body ?? {};

    if (!nombreCompleto && !especialidad) {
      return res.status(400).json({ error: 'Debe proporcionar al menos nombreCompleto o especialidad para actualizar.' });
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (nombreCompleto) {
      updates.push(`nombre_completo = $${idx++}`);
      values.push(nombreCompleto.trim());
    }
    if (especialidad) {
      updates.push(`especialidad = $${idx++}`);
      values.push(especialidad.trim().toUpperCase());
    }
    updates.push(`updated_at = NOW()`);
    values.push(usuarioId);

    const { rows } = await db.query(
      `UPDATE usuarios SET ${updates.join(', ')} WHERE id = $${idx} AND eliminado_en IS NULL RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const u = rows[0];
    return res.json({
      mensaje: 'Datos actualizados correctamente.',
      usuario: {
        id: u.id,
        nombreCompleto: u.nombre_completo,
        email: u.email,
        rol: u.rol,
        especialidad: u.especialidad,
        actualizadoEn: u.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/mis-datos/export
 * Genera un JSON descargable con todos los datos personales (portabilidad ARCO/GDPR).
 */
router.get('/export', authMiddleware, async (req, res, next) => {
  try {
    const usuarioId = req.user.sub;

    const { rows: userRows } = await db.query(
      `SELECT id, nombre_completo, email, rol, especialidad, esta_activo,
              terminos_aceptados_en, terminos_version,
              privacidad_aceptada_en, privacidad_version,
              created_at, updated_at
       FROM usuarios
       WHERE id = $1 AND eliminado_en IS NULL`,
      [usuarioId]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    const usuario = userRows[0];

    const { rows: orgRows } = await db.query(
      `SELECT o.id, o.nombre, o.slug, o.plan, mo.rol as rol_miembro, mo.created_at as unido_en
       FROM miembros_organizacion mo
       JOIN organizaciones o ON o.id = mo.organizacion_id
       WHERE mo.usuario_id = $1 AND mo.activo = TRUE`,
      [usuarioId]
    );

    const { rows: consentRows } = await db.query(
      `SELECT tipo, version, aceptado, created_at
       FROM consentimientos
       WHERE usuario_id = $1
       ORDER BY created_at DESC`,
      [usuarioId]
    );

    const { rows: expedientesRows } = await db.query(
      `SELECT id, numero, titulo, tipo, estado, juzgado, materia, created_at, updated_at
       FROM expedientes
       WHERE usuario_id = $1
       ORDER BY created_at DESC`,
      [usuarioId]
    );

    const exportData = {
      exportadoEn: new Date().toISOString(),
      plataforma: 'LegalPro',
      versionExport: '1.0',
      usuario: {
        id: usuario.id,
        nombreCompleto: usuario.nombre_completo,
        email: usuario.email,
        rol: usuario.rol,
        especialidad: usuario.especialidad,
        estaActivo: usuario.esta_activo,
        terminosAceptadosEn: usuario.terminos_aceptados_en,
        terminosVersion: usuario.terminos_version,
        privacidadAceptadaEn: usuario.privacidad_aceptada_en,
        privacidadVersion: usuario.privacidad_version,
        creadoEn: usuario.created_at,
        actualizadoEn: usuario.updated_at,
      },
      organizaciones: orgRows,
      consentimientos: consentRows,
      expedientes: expedientesRows,
    };

    const filename = `legalpro-datos-${usuario.email.split('@')[0]}-${Date.now()}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    next(err);
  }
});

export default router;
