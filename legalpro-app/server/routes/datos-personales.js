import { Router } from 'express';
import db, { tenantQuery } from '../db.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { logAudit } from '../utils/audit.js';

const router = Router();

/**
 * Mapeo de tipo de `consentimientos` → tipo de `consent_history`.
 *
 * La tabla `consent_history` (FIX LPDP-3.5) usa nombres más descriptivos
 * para los documentos legales. Esto permite separar el lenguaje de la
 * tabla de estado vigente (`consentimientos`) del lenguaje de la bitácora
 * de auditoría (`consent_history`).
 *
 * Tipos definidos en CHECK constraint de consent_history:
 *   - terminos_condiciones
 *   - politica_privacidad
 *   - marketing
 *   - transferencia_internacional
 *   - cookies_analiticas
 *   - cookies_funcionales
 */
const TIPO_CONSENT_TO_HISTORY = Object.freeze({
  terminos: 'terminos_condiciones',
  privacidad: 'politica_privacidad',
  marketing: 'marketing',
  transferencia_internacional: 'transferencia_internacional',
  cookies_analiticas: 'cookies_analiticas',
  cookies_funcionales: 'cookies_funcionales',
  // Tipos no asociados a un documento legal específico: se registran como
  // politica_privacidad (cubre la base legal del tratamiento ARCO).
  eliminacion: 'politica_privacidad',
  oposicion: 'politica_privacidad',
});

/**
 * FIX LPDP-3.5: Registra una acción de consentimiento en `consent_history`
 * (LPDP Art. 21 + D.S. 016-2024-JUS Art. 21).
 *
 * Tabla append-only (solo INSERT) que mantiene una bitácora inmutable de
 * otorgamientos, revocaciones y modificaciones de consentimiento para
 * auditoría regulatoria.
 *
 * Implementación:
 *   - Lee `organization_id` del JWT (`req.user.organization_id`) en primera
 *     instancia. Si no está disponible (caso edge: tokens antiguos o sin
 *     organización), hace fallback a una consulta a `usuarios`.
 *   - Usa `db.query` (no `tenantQuery`) para evitar acoplar este log de
 *     auditoría al contexto tenant activo del request. La POLICY
 *     `consent_history_isolation` valida que `organization_id` coincida
 *     con `current_setting('app.current_org_id')`, así que solo se
 *     insertará correctamente cuando el contexto tenant esté activo.
 *   - Cualquier fallo se loguea pero NO rompe el flujo del usuario: la
 *     tabla `consent_history` es de auditoría, no de negocio.
 *
 * @param {object} req           — request Express (para IP y user-agent)
 * @param {string} usuarioId     — UUID del usuario titular
 * @param {string} tipo          — tipo en `consentimientos` (será mapeado)
 * @param {string} accion        — 'otorgado' | 'revocado' | 'modificado'
 * @param {string} [version]     — versión del documento (default: '1.0')
 * @param {string} [motivo]      — motivo de revocación (opcional)
 */
async function registrarConsentHistory(req, usuarioId, tipo, accion, version = '1.0', motivo = null) {
  try {
    // 1) Resolver organization_id (JWT primero, BD como fallback)
    let orgId = req.user?.organization_id ?? null;
    if (!orgId) {
      const { rows: orgRows } = await db.query(
        'SELECT organization_id FROM usuarios WHERE id = $1',
        [usuarioId]
      );
      orgId = orgRows[0]?.organization_id ?? null;
    }
    if (!orgId) {
      console.warn(`[consent_history] organization_id no encontrado para usuario ${usuarioId}; INSERT omitido.`);
      return;
    }

    // 2) Mapear tipo consentimientos → tipo consent_history
    const tipoHistory = TIPO_CONSENT_TO_HISTORY[tipo] ?? 'politica_privacidad';

    // 3) INSERT en consent_history
    await db.query(
      `INSERT INTO consent_history
         (organization_id, user_id, tipo, accion, version_documento,
          ip_address, user_agent, motivo_revocacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        orgId,
        usuarioId,
        tipoHistory,
        accion,
        version,
        req.ip ?? null,
        req.headers?.['user-agent'] ?? null,
        motivo,
      ]
    );
  } catch (err) {
    // FIX LPDP-3.5: fallo de auditoría NO debe romper el flujo del usuario.
    // El log principal sigue funcionando; consent_history es trazabilidad.
    console.warn(`[consent_history] No se pudo registrar acción '${accion}' tipo '${tipo}' para usuario ${usuarioId}:`, err.message);
  }
}

/**
 * GET /api/mis-datos
 * Retorna TODOS los datos personales del usuario autenticado (derecho de acceso ARCO).
 */
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const usuarioId = req.user.sub;

    // Datos del usuario
    const { rows: userRows } = await tenantQuery(
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
    const { rows: orgRows } = await tenantQuery(
      `SELECT o.id, o.nombre, o.slug, o.plan, mo.rol as rol_miembro
       FROM miembros_organizacion mo
       JOIN organizaciones o ON o.id = mo.organizacion_id
       WHERE mo.usuario_id = $1 AND mo.activo = TRUE
       LIMIT 1`,
      [usuarioId]
    );

    // Consentimientos
    const { rows: consentRows } = await tenantQuery(
      `SELECT tipo, version, aceptado, created_at
       FROM consentimientos
       WHERE usuario_id = $1
       ORDER BY created_at DESC`,
      [usuarioId]
    );

    // Estadísticas de uso (sin contenido sensible)
    const { rows: statsRows } = await tenantQuery(
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

    const { rows } = await tenantQuery(
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
 * POST /api/mis-datos/cancelar
 * Cancela (da de baja) los datos personales del usuario (derecho ARCO de cancelación).
 * Requiere confirmación explícita en el body: { confirmacion: true, motivo?: string }
 * Realiza un borrado lógico (soft-delete) preservando integridad referencial.
 */
router.post('/cancelar', authMiddleware, async (req, res, next) => {
  try {
    const usuarioId = req.user.sub;
    const { confirmacion, motivo } = req.body ?? {};

    if (confirmacion !== true) {
      return res.status(400).json({
        error: 'Debe confirmar la cancelación enviando confirmacion: true en el body.',
      });
    }

    // Verificar que el usuario existe y no está ya eliminado
    const { rows: userRows } = await tenantQuery(
      `SELECT id, email, nombre_completo FROM usuarios
       WHERE id = $1 AND eliminado_en IS NULL`,
      [usuarioId]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado o ya cancelado.' });
    }

    const usuario = userRows[0];

    // Soft-delete: marcar como eliminado lógicamente
    await tenantQuery(
      `UPDATE usuarios
       SET eliminado_en = NOW(), updated_at = NOW()
       WHERE id = $1 AND eliminado_en IS NULL`,
      [usuarioId]
    );

    // Auditar la cancelación ARCO
    await logAudit('ARCO_CANCELACION', {
      severity: 'HIGH',
      userId: usuarioId,
      ip: req.ip,
      motivo: motivo || 'No especificado',
      emailMasked: usuario.email ? `${usuario.email[0]}***@${usuario.email.split('@')[1]}` : '[unknown]',
    });

    return res.json({
      mensaje: 'Sus datos personales han sido cancelados. Se ha aplicado el borrado lógico de su cuenta.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/mis-datos/oposicion
 * Ejerce el derecho de OPOSICIÓN al tratamiento de datos (LPDP Art. 27).
 *
 * IMPORTANTE: Distinto de /cancelar (LPDP Art. 26).
 *   - /cancelar: borra la cuenta (soft-delete) → Art. 26 cancelación.
 *   - /oposicion: bloquea una finalidad ESPECÍFICA de tratamiento sin eliminar
 *     la cuenta ni los datos. Art. 27.
 *
 * El titular puede oponerse a UNO o VARIOS fines de tratamiento manteniendo
 * su cuenta activa para los fines necesarios (cumplimiento legal, ejecución
 * del contrato, etc.).
 *
 * Plazo de respuesta LPDP Art. 28: 10 días hábiles.
 */
router.post('/oposicion', authMiddleware, async (req, res, next) => {
  try {
    const { finalidad, motivo } = req.body ?? {};

    const finalidadesValidas = [
      'marketing',             // oposición a comunicaciones promocionales
      'ia_automatizada',       // oposición a decisiones automatizadas / IA
      'cesion_terceros',       // oposición a compartir datos con terceros
      'elaboracion_perfiles',  // oposición a profiling
      'tratamiento_estadistico', // oposición a uso estadístico
      'todos',                 // oposición total a fines no legales (cuenta sigue activa)
    ];

    if (!finalidad || !finalidadesValidas.includes(finalidad)) {
      return res.status(400).json({
        error: `finalidad requerida. Valores válidos: ${finalidadesValidas.join(', ')}`,
      });
    }

    const usuarioId = req.user.sub;

    // 1) Registrar la oposición en la tabla consentimientos (trazabilidad legal LPDP).
    //    Tipo 'oposicion' (sin aceptado=TRUE/FALSE → registrado como TRUE indicando
    //    que el titular EJERCIÓ su derecho; el sentido se interpreta por el tipo).
    await db.query(
      `INSERT INTO consentimientos (usuario_id, tipo, version, aceptado, ip_address, user_agent)
       VALUES ($1, 'oposicion', '1.0', TRUE, $2, $3)`,
      [usuarioId, req.ip, req.headers['user-agent']]
    );

    // 1.b) FIX LPDP-3.5: Registrar también en consent_history (LPDP Art. 21).
    //      Cada finalidad de oposición puede afectar uno o varios documentos
    //      legales. Mapeamos al tipo de documento cuyo flag se ve afectado.
    const finalidadToHistory = {
      marketing:             { tipo: 'marketing',                     accion: 'revocado' },
      ia_automatizada:       { tipo: 'transferencia_internacional',   accion: 'revocado' },
      cesion_terceros:       { tipo: 'transferencia_internacional',   accion: 'revocado' },
      elaboracion_perfiles:  { tipo: 'marketing',                     accion: 'revocado' },
      tratamiento_estadistico: { tipo: 'marketing',                   accion: 'revocado' },
      todos:                 { tipo: 'transferencia_internacional',   accion: 'revocado' },
    };
    const mapping = finalidadToHistory[finalidad];
    if (mapping) {
      const motivoCompleto = `Oposición registrada para finalidad '${finalidad}'` +
        (motivo ? ` — motivo: ${motivo}` : '');
      await registrarConsentHistory(
        req,
        usuarioId,
        mapping.tipo,
        mapping.accion,
        '1.0',
        motivoCompleto
      );
    }

    // 2) Aplicar el flag de oposición al flag correspondiente en `usuarios`.
    //    Solo se modifican columnas existentes (sin añadir columnas nuevas).
    if (finalidad === 'ia_automatizada' || finalidad === 'todos') {
      // El flag de transferencia internacional controla el acceso a la IA MiniMax.
      await db.query(
        `UPDATE usuarios
         SET acepta_transferencia_internacional = FALSE,
             transferencia_internacional_aceptada_en = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [usuarioId]
      );
    }

    // 3) Audit log — OBLIGATORIO para cumplimiento LPDP Art. 8 (principio de responsabilidad).
    await logAudit('OPOSICION_REGISTRADA', {
      severity: 'WARNING',
      userId: usuarioId,
      finalidad,
      motivo: motivo || 'No especificado',
      ip: req.ip,
      ua: req.headers['user-agent'],
    });

    // 4) Plazo de respuesta LPDP Art. 28: 10 días hábiles.
    //    Sumamos 14 días naturales como buffer (fines de semana + feriados).
    const plazoRespuesta = new Date();
    plazoRespuesta.setDate(plazoRespuesta.getDate() + 14);

    return res.json({
      success: true,
      mensaje: `Oposición al tratamiento registrada para la finalidad: ${finalidad}.`,
      finalidad,
      fecha_registro: new Date().toISOString(),
      plazo_respuesta: plazoRespuesta.toISOString(),
      nota: 'Conforme al Art. 28 LPDP, tu oposición será procesada en un plazo máximo de 10 días hábiles.',
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

    const { rows: userRows } = await tenantQuery(
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

    const { rows: orgRows } = await tenantQuery(
      `SELECT o.id, o.nombre, o.slug, o.plan, mo.rol as rol_miembro, mo.created_at as unido_en
       FROM miembros_organizacion mo
       JOIN organizaciones o ON o.id = mo.organizacion_id
       WHERE mo.usuario_id = $1 AND mo.activo = TRUE`,
      [usuarioId]
    );

    const { rows: consentRows } = await tenantQuery(
      `SELECT tipo, version, aceptado, created_at
       FROM consentimientos
       WHERE usuario_id = $1
       ORDER BY created_at DESC`,
      [usuarioId]
    );

    const { rows: expedientesRows } = await tenantQuery(
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

/**
 * FIX LPDP-3: Revocación COMPLETA de TODOS los consentimientos
 * Conforme a Ley 29733 Art. 21 — revocación sin efecto retroactivo imposible,
 * pero debe ser efectiva para futuros tratamientos.
 *
 * Diferencia vs endpoint específico:
 * - DELETE /consentimiento/:tipo → revoca UNO (términos, privacidad, marketing, transferencia)
 * - DELETE /consentimiento       → revoca TODOS
 *
 * IMPORTANTE: Este endpoint DEBE estar registrado ANTES de `/consentimiento/:tipo`
 * en el router para evitar que Express matchee la ruta raíz como si fuera
 * un `tipo` vacío.
 */
router.delete('/consentimiento', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { motivo } = req.body || {};

    // Actualizar TODOS los campos de consentimiento a false
    const result = await tenantQuery(
      `UPDATE usuarios
       SET terminos_aceptados_at = NULL,
           privacidad_aceptados_at = NULL,
           marketing_aceptado = false,
           acepto_transferencia_internacional = false,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, email`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Audit log
    await logAudit('CONSENTIMIENTO_REVOCADO_TOTAL', {
      userId,
      motivo: motivo || 'No especificado',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      correlationId: req.headers['x-correlation-id']
    });

    // FIX LPDP-3.5: Registrar también en consent_history (LPDP Art. 21).
    // Una entrada por cada tipo de documento revocado, para que la
    // bitácora de auditoría refleje la revocación TOTAL.
    const tiposARevocar = ['terminos', 'privacidad', 'marketing', 'transferencia_internacional'];
    const motivoRevocacion = `Revocación TOTAL de consentimientos` +
      (motivo ? ` — motivo: ${motivo}` : '');
    for (const tipo of tiposARevocar) {
      await registrarConsentHistory(req, userId, tipo, 'revocado', '1.0', motivoRevocacion);
    }

    // Notificar al DPO (registro de revocación)
    // En producción, esto debería enviar un email a dpo@legalpro.app
    console.log('[LPDP] Revocación total de consentimientos por usuario:', userId);

    res.json({
      success: true,
      message: 'Todos los consentimientos han sido revocados. Los tratamientos futuros requerirán nuevo consentimiento.',
      affectedFields: [
        'terminos_aceptados_at',
        'privacidad_aceptados_at',
        'marketing_aceptado',
        'acepto_transferencia_internacional'
      ]
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/mis-datos/consentimiento/:tipo
 * Revoca un consentimiento específico (LPDP Arts. 14, 15 — revocabilidad en cualquier momento).
 * Soft-revoke: inserta un nuevo registro con aceptado=FALSE preservando el historial para auditoría.
 *
 * - terminos / privacidad: revocación crítica → desactiva cuenta por seguridad.
 * - transferencia_internacional: desactiva el flag en `usuarios` (IA queda no disponible).
 * - marketing: solo registra revocación.
 */
router.delete('/consentimiento/:tipo', authMiddleware, async (req, res, next) => {
  try {
    const { tipo } = req.params;
    const tiposValidos = ['terminos', 'privacidad', 'marketing', 'transferencia_internacional'];

    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({
        error: `Tipo inválido. Debe ser uno de: ${tiposValidos.join(', ')}`,
      });
    }

    const usuarioId = req.user.sub;

    // Verificar que existe consentimiento activo para revocar
    const { rows: existing } = await tenantQuery(
      `SELECT id FROM consentimientos
       WHERE usuario_id = $1 AND tipo = $2 AND aceptado = TRUE
       ORDER BY created_at DESC LIMIT 1`,
      [usuarioId, tipo]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'No hay consentimiento activo de este tipo' });
    }

    // Insertar nuevo registro con aceptado=FALSE (soft-revoke preservando historial)
    await tenantQuery(
      `INSERT INTO consentimientos (usuario_id, tipo, version, aceptado, ip_address, user_agent)
       VALUES ($1, $2, '1.0', FALSE, $3, $4)`,
      [usuarioId, tipo, req.ip, req.headers['user-agent']]
    );

    // FIX LPDP-3.5: Registrar también en consent_history (LPDP Art. 21).
    // Acción = 'revocado' (soft-revoke). El motivo_revocacion captura el
    // contexto de la acción (cuenta desactivada, flag quitado, etc.).
    await registrarConsentHistory(
      req,
      usuarioId,
      tipo,
      'revocado',
      '1.0',
      `Revocación de consentimiento '${tipo}' vía DELETE /api/mis-datos/consentimiento/:tipo`
    );

    // Si se revoca transferencia internacional, también actualizar usuarios
    if (tipo === 'transferencia_internacional') {
      await tenantQuery(
        `UPDATE usuarios
         SET acepta_transferencia_internacional = FALSE,
             transferencia_internacional_aceptada_en = NULL
         WHERE id = $1`,
        [usuarioId]
      );
    }

    // Si se revocan términos o privacidad, es crítico: desactivar cuenta
    if (tipo === 'terminos' || tipo === 'privacidad') {
      await tenantQuery(
        `UPDATE usuarios
         SET esta_activo = FALSE,
             updated_at = NOW()
         WHERE id = $1`,
        [usuarioId]
      );

      await logAudit('CONSENTIMIENTO_REVOCADO_CRITICO', {
        severity: 'CRITICAL',
        userId: usuarioId,
        tipo,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });

      return res.json({
        success: true,
        mensaje:
          'Consentimiento revocado. Tu cuenta ha sido desactivada por seguridad. Contacta soporte para reactivarla.',
        cuenta_desactivada: true,
      });
    }

    // Audit log normal para marketing / transferencia_internacional
    await logAudit('CONSENTIMIENTO_REVOCADO', {
      severity: 'WARNING',
      userId: usuarioId,
      tipo,
      ip: req.ip,
      ua: req.headers['user-agent'],
    });

    return res.json({
      success: true,
      mensaje: 'Consentimiento revocado exitosamente',
      tipo,
      fecha_revocacion: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
