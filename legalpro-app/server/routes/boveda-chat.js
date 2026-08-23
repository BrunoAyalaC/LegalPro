/**
 * Bóveda desde Chat — Guardar documento generado por IA como evidencia
 *
 * POST /api/boveda/guardar-documento
 *   Body: { expediente_id, nombre?, descripcion?, contenido_base64, mime_type? }
 *   Response 201: { success, data: { id, hash_sha256, nombre, mime_type,
 *                                    tamano_bytes, cadena_custodia, creado_en, inmutable } }
 *
 * GET /api/boveda/por-expediente/:expedienteId
 *   Response 200: { success, data: [evidencias...] }
 *
 * La tabla física de la Bóveda es `evidencia_digital` (ver init.sql). Su
 * inmutabilidad se garantiza con el trigger `trg_evidencia_inmutable`
 * (BEFORE UPDATE OR DELETE) y el hash SHA-256 del contenido es la prueba de
 * integridad exigida por la Ley 27269 (firma digital / evidencias digitales).
 *
 * NOTA DE CATÁLOGO: `catalogs/supabase-schema.md` documenta la tabla como
 * `evidencia`; el init.sql real la crea como `evidencia_digital`. Este router
 * opera contra el schema REAL de la BD para no romper el despliegue.
 */

import { Router } from 'express';
import crypto from 'node:crypto';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware.js';
import { validate } from '../middleware/validate.js';
import { tenantQuery } from '../db.js';
import { logAudit } from '../utils/audit.js';
import { bovedaChatSchema } from '../schemas/bovedaChatSchema.js';

const router = Router();

/** Extensión derivada del MIME para construir el storage_path virtual */
const EXTENSIONES_POR_MIME = Object.freeze({
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/rtf': 'rtf',
  'text/plain': 'txt',
  'text/markdown': 'md',
});

/**
 * Genera el hash SHA-256 del contenido (prueba de integridad — Ley 27269).
 * @param {Buffer} buffer
 * @returns {string} hash hexadecimal
 */
function hashSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Deriva la extensión de archivo desde el MIME type.
 * @param {string} mimeType
 * @returns {string}
 */
function extensionDeMime(mimeType) {
  return EXTENSIONES_POR_MIME[mimeType] || 'bin';
}

/**
 * Crea el registro inicial de la cadena de custodia.
 * @param {{ userId: string, orgId: string, accion: string, hash: string }} params
 * @returns {Array<object>}
 */
function crearCadenaCustodia({ userId, orgId, accion, hash }) {
  const ahora = new Date().toISOString();
  return [{
    accion,
    hash_sha256: hash,
    usuario_id: userId,
    organizacion_id: orgId,
    timestamp: ahora,
    descripcion: 'Documento generado desde chat IA',
  }];
}

/**
 * POST /api/boveda/guardar-documento
 * Guarda un documento generado por IA como evidencia inmutable del expediente.
 *
 * Seguridad:
 *  - authMiddleware + tenantMiddleware: aislamiento multi-tenant por JWT.
 *  - idempotencyMiddleware: reintento seguro vía X-Idempotency-Key.
 *  - validate(bovedaChatSchema): validación estricta de entrada (Zod).
 *  - Verificación de pertenencia del expediente a la organización (anti-IDOR).
 *  - RLS de PostgreSQL: `p_evidencia_digital_all` exige organization_id = JWT.
 */
router.post(
  '/guardar-documento',
  authMiddleware,
  tenantMiddleware,
  validate(bovedaChatSchema),
  idempotencyMiddleware(),
  async (req, res, next) => {
    try {
      const {
        expediente_id,
        nombre,
        descripcion,
        contenido_base64,
        mime_type,
      } = req.body;
      const orgId = req.organizationId;
      const userId = req.user?.sub || req.user?.id;

      // 1. Decodificar contenido (express.json ya limitó el body a 1MB)
      const buffer = Buffer.from(contenido_base64, 'base64');
      if (buffer.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'contenido_base64 no es un documento válido (vacío).',
        });
      }

      // 2. Calcular SHA-256 → prueba de integridad e inmutabilidad (Ley 27269)
      const hash = hashSha256(buffer);

      // 3. Verificar que el expediente pertenece a la organización (anti-IDOR)
      const expCheck = await tenantQuery(
        'SELECT id FROM expedientes WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
        [expediente_id, orgId]
      );
      if (expCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Expediente no encontrado en esta organización.',
        });
      }

      // 4. Cadena de custodia inicial (GENERACION)
      const cadena = crearCadenaCustodia({
        userId,
        orgId,
        accion: 'GENERACION',
        hash,
      });

      // 5. Insertar en evidencia_digital (Bóveda). La RLS valida organization_id.
      //    storage_path es la ruta lógica del documento en el bucket `evidencia`
      //    (el repo es mock-first para storage; el binario queda referenciado por hash).
      const storagePath = `boveda/chat/${orgId}/${hash}.${extensionDeMime(mime_type)}`;
      const result = await tenantQuery(
        `INSERT INTO evidencia_digital
           (usuario_id, organization_id, expediente_id, nombre_original, tipo_archivo,
            tamano_bytes, hash_sha256, storage_path, descripcion, cadena_custodia)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
         RETURNING id, hash_sha256, nombre_original, tipo_archivo, tamano_bytes,
                   descripcion, cadena_custodia, creado_en`,
        [
          userId,
          orgId,
          expediente_id,
          nombre,
          mime_type,
          buffer.length,
          hash,
          storagePath,
          descripcion || null,
          JSON.stringify(cadena),
        ]
      );

      const evidencia = result.rows[0];

      // 6. Audit event (LPDP A09 / OWASP A09 — mutación de evidencia/PII)
      await logAudit('EVIDENCIA_GUARDADA_CHAT', {
        userId,
        organizationId: orgId,
        ip: req.ip,
        evidencia_id: evidencia.id,
        expediente_id,
        hash_sha256: hash,
        mime_type,
        tamano_bytes: buffer.length,
      });

      res.status(201).json({
        success: true,
        data: {
          id: evidencia.id,
          hash_sha256: evidencia.hash_sha256,
          nombre: evidencia.nombre_original,
          mime_type: evidencia.tipo_archivo,
          tamano_bytes: evidencia.tamano_bytes,
          descripcion: evidencia.descripcion,
          cadena_custodia: evidencia.cadena_custodia,
          creado_en: evidencia.creado_en,
          inmutable: true, // Ley 27269 — trigger trg_evidencia_inmutable
        },
      });
    } catch (err) {
      // 23505 = unique_violation: el hash ya existe → documento duplicado
      if (err?.code === '23505') {
        return res.status(409).json({
          success: false,
          error: 'El documento ya está registrado como evidencia (hash duplicado).',
        });
      }
      next(err);
    }
  }
);

/**
 * GET /api/boveda/por-expediente/:expedienteId
 * Lista las evidencias de un expediente (solo de la propia organización).
 */
router.get('/por-expediente/:expedienteId', authMiddleware, tenantMiddleware, async (req, res, next) => {
  try {
    const { expedienteId } = req.params;
    const orgId = req.organizationId;

    // Validación de formato UUID (anti-inyección/ruido en el path)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expedienteId)) {
      return res.status(400).json({
        success: false,
        error: 'expedienteId debe ser un UUID válido.',
      });
    }

    const result = await tenantQuery(
      `SELECT id, hash_sha256, nombre_original, tipo_archivo, tamano_bytes,
              descripcion, cadena_custodia, creado_en
       FROM evidencia_digital
       WHERE expediente_id = $1 AND organization_id = $2
       ORDER BY creado_en DESC`,
      [expedienteId, orgId]
    );

    res.json({
      success: true,
      data: result.rows.map((e) => ({
        id: e.id,
        hash_sha256: e.hash_sha256,
        nombre: e.nombre_original,
        mime_type: e.tipo_archivo,
        tamano_bytes: e.tamano_bytes,
        descripcion: e.descripcion,
        cadena_custodia: e.cadena_custodia,
        creado_en: e.creado_en,
        inmutable: true, // Ley 27269
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
