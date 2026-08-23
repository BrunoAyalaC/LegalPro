import { Router } from 'express';
import multer from 'multer';
import { MiniMaxAI } from '../utils/minimaxClient.js';
import db, { tenantQuery } from '../db.js';
import { TokenRepository } from '../repositories/TokenRepository.js';
import crypto from 'crypto';
// FIX P0-C: tenantMiddleware REAL desde tenantMiddleware.js (activa RLS vía
// AsyncLocalStorage); la versión lite de authMiddleware.js NO envuelve en
// tenantContext.run(...) y dejaba las queries sin aislamiento RLS.
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware.js';
import { validate } from '../middleware/validate.js';
import { documentoExportarSchema, documentoAnalizarSchema } from '../schemas/documentoExportarSchema.js';
import { generarDocx, generarPdf, generarNombreArchivo } from '../services/documentoExportador.js';
import { extraerTextoOcr } from '../services/ocrQwenService.js';
import ocrCacheService from '../services/ocrCacheService.js';
import { ejecutarHerramienta } from '../utils/intentRouter.js';
import logger from '../logger.js';

const router = Router();

import path from 'path';
import os from 'os';
import fs from 'fs';

const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB P0 validación

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const tmpDir = os.tmpdir();
      cb(null, tmpDir);
    },
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      cb(null, unique);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      const err = new Error(`Tipo de archivo no permitido: ${file.mimetype}. Solo se permiten PDF, JPEG, PNG.`);
      err.code = 'INVALID_FILE_TYPE';
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

const tokenRepo = new TokenRepository(db);

function getFileBuffer(file) {
  if (file.buffer) return file.buffer;
  if (file.path) {
    try {
      return fs.readFileSync(file.path);
    } catch (e) {
      logger.error('[upload] No se pudo leer archivo temporal', { error: e.message, path: file.path });
      return Buffer.alloc(0);
    }
  }
  return Buffer.alloc(0);
}

function cleanupTmpFile(file) {
  if (file?.path) {
    fs.unlink(file.path, () => {});
  }
}

// Inicialización perezosa: la ausencia de la clave de IA no debe impedir el arranque
// ni el resto de funcionalidad de documentos (subida/listado). El OCR falla por-petición (503).
let _ai = null;
function getAi() {
  if (!process.env.MINIMAX_API_KEY) {
    const err = new Error('El servicio de IA no está disponible (MINIMAX_API_KEY no configurada).');
    err.status = 503;
    err.code = 'IA_NO_DISPONIBLE';
    throw err;
  }
  if (!_ai) _ai = new MiniMaxAI({ apiKey: process.env.MINIMAX_API_KEY });
  return _ai;
}

/**
 * POST /api/documentos/upload
 *
 * Sube un documento (imagen/PDF), realiza la extracción de texto mediante OCR multimodal
 * con MiniMax, guarda el texto extraído en el expediente y debita 2 créditos.
 */
router.post('/upload', authMiddleware, tenantMiddleware, idempotencyMiddleware(), upload.single('file'), async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.sub;

    if (!userId || !orgId) {
      return res.status(401).json({ error: 'No autorizado.' });
    }

    // 1. FIX P1-C (LPDP): verificación de consentimiento de transferencia
    // internacional ANTES del OCR. El pipeline OCR envía el documento a
    // proveedores de IA internacionales (Qwen VL / MiniMax); sin consentimiento
    // explícito registrado en la organización, se bloquea el flujo.
    const { rows: [orgConsent] } = await db.query(
      'SELECT acepta_transferencia_internacional FROM organizaciones WHERE id=$1',
      [orgId]
    );
    if (!orgConsent || orgConsent.acepta_transferencia_internacional !== true) {
      return res.status(403).json({
        code: 'TRANSFERENCIA_INTERNACIONAL_REQUIRED',
        mensaje: 'Se requiere consentimiento para procesar documentos con IA (proveedores internacionales). Actívalo en tu perfil.'
      });
    }

    // 2. Verificar créditos
    const creditos = await tokenRepo.verificarCreditos(orgId);
    if (creditos < 2) {
      return res.status(402).json({
        error: 'Créditos insuficientes para realizar la extracción OCR (requiere 2 créditos).',
        code: 'INSUFFICIENT_CREDITS'
      });
    }

    // 2. Validar archivo
    if (!req.file) {
      return res.status(400).json({ error: 'El archivo es obligatorio (parámetro "file").' });
    }

    // 3. Validar expediente_id
    const expedienteId = req.body.expediente_id || req.query.expediente_id;
    if (!expedienteId) {
      return res.status(400).json({ error: 'El expediente_id es obligatorio.' });
    }

    // Verificar que el expediente pertenezca a la organización
    const { rows: [exp] } = await tenantQuery(
      'SELECT id FROM expedientes WHERE id=$1 AND organization_id=$2',
      [expedienteId, orgId]
    );
    if (!exp) {
      return res.status(404).json({ error: 'Expediente no encontrado o no pertenece a su organización.' });
    }

    // 4.5. Cache OCR por hash SHA-256 (FIX 2026-08-08 — pipeline visión→cerebro→juniors).
    // Si el mismo archivo (mismo hash) ya fue procesado antes, devolvemos el texto
    // cacheado SIN volver a llamar al modelo de visión. Esto ahorra tokens y latencia
    // significativamente: un mismo PDF subido N veces solo consume visión 1 vez.
    // Fail-open: si Redis falla o el cache devuelve null, seguimos con OCR fresco.
    const fileBuffer = getFileBuffer(req.file);
    const hashSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    let ocrResponse;
    let ocrFromCache = false;
    let ocrCacheMetadata = null;

    try {
      const cached = await ocrCacheService.getCachedOcr(hashSha256);
      if (cached && cached.texto && cached.texto.trim()) {
        logger.info('[OCR-CACHE] HIT — saltando OCR fresh', {
          hash: hashSha256.slice(0, 12),
          provider: cached.provider,
          modelo: cached.modelo,
          chars: cached.chars,
        });
        ocrResponse = {
          text: cached.texto,
          modelo: cached.modelo || 'cache_ocr',
          provider: cached.provider || 'cache',
          usageMetadata: null, // cache hit: no incurrió en tokens
        };
        ocrFromCache = true;
        ocrCacheMetadata = {
          cached: true,
          modelo: cached.modelo,
          provider: cached.provider,
          hash: hashSha256,
          cachedAt: cached.cachedAt,
        };
      }
    } catch (cacheErr) {
      // Fail-open: nunca bloquear el upload por un fallo de cache
      logger.warn('[OCR-CACHE] Error en lookup (siguiendo con OCR fresh)', { error: cacheErr?.message });
    }

    if (!ocrFromCache) {
      // 5. OCR con Qwen VL (visión) — FIX 2026-08-07: reemplaza a MiniMax OCR
      //    (rate-limited). Qwen VL extrae el texto y el cerebro DeepSeek V4 Flash
      //    lo analiza después. NO se usan modelos más grandes que qwen3.6-plus.
      try {
        const ocr = await extraerTextoOcr({
          base64Data: fileBuffer.toString('base64'),
          mimeType: req.file.mimetype,
        });
        ocrResponse = { text: ocr.texto, modelo: ocr.modelo, provider: ocr.provider, usageMetadata: ocr.usageMetadata };
      } catch (ocrErr) {
        logger.error('[OCR-QWEN] Falló la extracción con Qwen VL, degradando a MiniMax:', ocrErr?.message);
        // Fallback a MiniMax OCR (si está disponible) para no romper el upload.
        const filePart = {
          inlineData: {
            data: fileBuffer.toString('base64'),
            mimeType: req.file.mimetype,
          },
        };
        const mm = await getAi().models.generateContent({
          model: process.env.MINIMAX_MODEL_DEFAULT || 'MiniMax-M3',
          contents: [
            filePart,
            'Realiza un OCR (Reconocimiento Óptico de Caracteres) preciso de este documento legal peruano. Extrae todo el texto legible con exactitud, manteniendo la estructura general del documento y sin omitir nada de información. No agregues introducciones, resúmenes ni comentarios adicionales; solo devuelve el texto extraído.'
          ],
        });
        ocrResponse = { text: mm.text ?? '', modelo: process.env.MINIMAX_MODEL_DEFAULT || 'MiniMax-M3', provider: 'minimax' };
      }

      // FIX 2026-08-08: persistir el resultado OCR en cache por hash SHA-256
      // para que próximos uploads del mismo archivo sean instantáneos y sin
      // costo de visión. Best-effort: si Redis falla, NO bloquea el upload.
      if (ocrResponse?.text && ocrResponse.text.trim()) {
        ocrCacheService.setCachedOcr(hashSha256, {
          texto: ocrResponse.text,
          modelo: ocrResponse.modelo || null,
          provider: ocrResponse.provider || null,
        }).catch((cacheErr) => {
          logger.warn('[OCR-CACHE] No se pudo persistir OCR en cache', { error: cacheErr?.message });
        });
      }
    }

    const textoOcr = ocrResponse.text ?? 'No se pudo extraer texto del documento.';

    // 6. Actualizar expedientes con el texto OCR
    // FIX BUG #3: agregar filtro organization_id para defensa en profundidad
    // contra TOCTOU cross-tenant. Aunque tenantContext + RLS ya aíslan,
    // un futuro cambio de policy (o uso fuera de tenantMiddleware) podría
    // exponer el endpoint. Patrón dinámico $${params.length} — NUNCA hardcodear $N.
    const updateParams = [textoOcr, expedienteId, orgId];
    await tenantQuery(
      `UPDATE expedientes SET texto_ocr = $1
       WHERE id = $2 AND organization_id = $${updateParams.length}`,
      updateParams
    );

    // 8. Registrar el documento en la base de datos
    const { rows: [doc] } = await tenantQuery(
      `INSERT INTO documentos (
        expediente_id,
        usuario_id,
        organization_id,
        nombre,
        tipo_documento,
        descripcion,
        archivo_url,
        archivo_nombre,
        archivo_tipo,
        archivo_tamano,
        hash_sha256
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        expedienteId,
        userId,
        orgId,
        req.file.originalname,
        req.body.tipo_documento || 'escrito',
        req.body.descripcion || (ocrFromCache ? 'Documento (OCR desde cache)' : 'Documento procesado con OCR multimodal'),
        `/uploads/${hashSha256}-${req.file.originalname}`,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        hashSha256
      ]
    );

    // 9. Registrar consumo de tokens del OCR solo si NO vino de cache
    // (FIX 2026-08-08: cache hit = 0 tokens consumidos; coherente con /upload).
    if (!ocrFromCache) {
      const promptTokens = ocrResponse.usageMetadata?.promptTokenCount || 0;
      const completionTokens = ocrResponse.usageMetadata?.candidatesTokenCount || 0;
      tokenRepo.registrarConsumo(
        userId,
        orgId,
        'document_ocr',
        ocrResponse.modelo || process.env.OPENCODE_VISION_MODEL || 'qwen3.6-plus',
        promptTokens,
        completionTokens,
        req.headers['x-idempotency-key'] || null
      ).catch(err => {
        console.error('Error al registrar consumo de OCR:', err);
      });

      // 10. Debitar 2 créditos por el OCR fresco
      await tokenRepo.debitarCreditos(
        userId,
        orgId,
        expedienteId,
        2,
        `Extracción OCR Multimodal - Archivo: ${req.file.originalname}`
      );
    } else {
      logger.info('[OCR-CACHE] HIT — no se debitan créditos ni se registran tokens', {
        userId, orgId, hash: hashSha256.slice(0, 12),
      });
    }

    cleanupTmpFile(req.file);
    return res.status(200).json({
      success: true,
      mensaje: ocrFromCache
        ? 'Documento procesado (texto extraído desde cache OCR).'
        : 'Documento procesado con OCR y registrado exitosamente.',
      documento: doc,
      textoOcr: textoOcr,
      ocr_cache: {
        hit: ocrFromCache,
        metadata: ocrCacheMetadata,
      },
    });

  } catch (err) {
    cleanupTmpFile(req.file);
    console.error('Error en POST /api/documentos/upload:', err);
    next(err);
  }
});

/**
 * POST /api/documentos/exportar
 *
 * Exporta un documento legal peruano en formato DOCX (Word) o PDF.
 * Incluye el formato oficial requerido por el Poder Judicial peruano:
 *   - Márgenes: 3cm izquierdo, 2cm derecho, 2cm superior, 2cm inferior
 *   - Fuente: Times New Roman 12pt
 *   - Interlineado: 1.5
 *   - Encabezado con datos del juzgado y expediente
 *   - Sumilla, Fundamentos, Petitorio, Firmas, Disclaimer legal
 *   - Numeración de páginas
 *
 * @param {string} tipo - Tipo de documento (demanda, apelacion, casacion, etc.)
 * @param {string} juzgado - Nombre del juzgado
 * @param {string} numeroExpediente - Número de expediente
 * @param {string} sumilla - Sumilla del documento
 * @param {string} contenido - Cuerpo del documento (texto plano con saltos de línea)
 * @param {string} recurrente - Nombre del recurrente
 * @param {string} abogado - Nombre del abogado
 * @param {string} formato - Formato de exportación ("docx" | "pdf")
 * @param {string} [colegiatura] - Número de colegiatura (opcional)
 * @param {string} [organizacion] - Nombre del estudio jurídico (opcional)
 *
 * @returns {Buffer} Archivo binario con Content-Disposition adecuado
 */
router.post('/exportar',
  authMiddleware,
  tenantMiddleware,
  requireRole(['OWNER', 'ADMIN', 'MEMBER']),
  validate(documentoExportarSchema),
  async (req, res, next) => {
    try {
      const {
        tipo,
        juzgado,
        numeroExpediente,
        sumilla,
        contenido,
        recurrente,
        abogado,
        colegiatura,
        organizacion,
        formato,
      } = req.body;

      const orgId = req.organizationId;
      const userId = req.user?.sub;

      if (!userId || !orgId) {
        return res.status(401).json({ error: 'No autorizado.' });
      }

      logger.info('exportar_documento_inicio', {
        tipo,
        formato,
        expediente: numeroExpediente,
        orgId,
        userId,
      });

      const params = {
        tipo,
        juzgado,
        numeroExpediente,
        sumilla,
        contenido,
        recurrente,
        abogado,
        colegiatura,
        organizacion: organizacion || req.user?.org_name,
      };

      const nombreArchivo = generarNombreArchivo(params, formato);
      let buffer;

      if (formato === 'docx') {
        buffer = await generarDocx(params);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      } else if (formato === 'pdf') {
        buffer = await generarPdf(params);
        res.setHeader('Content-Type', 'application/pdf');
      }

      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
      res.setHeader('Content-Length', buffer.length);
      // Cache-Control: no cache para archivos descargables
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      logger.info('exportar_documento_exito', {
        tipo,
        formato,
        expediente: numeroExpediente,
        sizeBytes: buffer.length,
        orgId,
        userId,
      });

      return res.send(buffer);
    } catch (err) {
      logger.error('exportar_documento_error', {
        error: err.message,
        stack: err.stack?.split('\n')[1],
        body: req.body,
      });

      // Errores específicos de Puppeteer
      if (err.message?.includes('Could not find Chromium') || err.message?.includes('Failed to launch')) {
        return res.status(500).json({
          error: 'El servicio de generación de PDF no está disponible. Contacte al administrador.',
          code: 'PDF_SERVICE_UNAVAILABLE',
        });
      }

      next(err);
    }
  }
);

/**
 * POST /api/documentos/:id/analizar
 *
 * FIX 2026-08-08 (pipeline visión→cerebro→juniors): endpoint opcional que
 * ejecuta el pipeline completo de análisis legal sobre un documento ya
 * subido. Es el "siguiente paso natural" después del upload:
 *
 *   upload (OCR + cache)  →  analizar (DeepSeek V4 Flash + RAG + prompt OCR-aware)
 *
 * Carga el texto OCR del documento (o el texto_ocr del expediente asociado
 * si el documento no tiene su propio OCR), invoca `ejecutarHerramienta` con
 * `analizar_expediente` y devuelve el análisis estructurado con shape
 * canónico v3 (resumen, fortalezas, riesgos, estrategia, inconsistencias).
 *
 * Multi-tenant: la consulta a la BD filtra por `organization_id` del JWT.
 * Anti-IDOR: el middleware `requireTenantAccess('documentos')` ya está
 * registrado globalmente en index.js para `/api/documentos/:id`.
 *
 * Costo: 1 crédito IA por análisis (vs. 2 del OCR del upload).
 *
 * Request body (opcional, validado con documentoAnalizarSchema):
 *   {
 *     materia?:        string  default 'general'
 *     tipo_analisis?:  enum    default 'completo'
 *     consulta?:       string  default ''
 *     incluir_rag?:    boolean default true
 *     usar_cache_ocr?: boolean default true
 *   }
 *
 * Response 200 (éxito):
 *   {
 *     success: true,
 *     tipo_respuesta: 'analisis',
 *     analisis: { texto, data: { resumen, fortalezas, riesgos, ... } },
 *     ocr_metadata: { modelo, provider, cached, hash }
 *   }
 */
router.post('/:id/analizar',
  authMiddleware,
  tenantMiddleware,
  requireRole(['OWNER', 'ADMIN', 'MEMBER']),
  validate(documentoAnalizarSchema),
  async (req, res, next) => {
    try {
      const orgId = req.organizationId;
      const userId = req.user?.sub;
      const documentoId = req.params.id;

      if (!userId || !orgId) {
        return res.status(401).json({ error: 'No autorizado.' });
      }

      // 1. Cargar el documento (multi-tenant: WHERE organization_id=$2).
      const { rows: docs } = await tenantQuery(
        `SELECT d.id, d.expediente_id, d.nombre, d.tipo_documento, d.hash_sha256,
                e.texto_ocr AS expediente_texto_ocr
         FROM documentos d
         JOIN expedientes e ON e.id = d.expediente_id
         WHERE d.id = $1 AND d.organization_id = $2
         LIMIT 1`,
        [documentoId, orgId]
      );
      const doc = docs[0];
      if (!doc) {
        return res.status(404).json({ error: 'Documento no encontrado o no pertenece a su organización.' });
      }

      // 2. Resolver el texto OCR a analizar.
      //    Prioridad:
      //    a) cache_ocr_service (por hash_sha256) — solo si usar_cache_ocr=true.
      //    b) texto_ocr del expediente asociado.
      //    c) Fallback vacío → pedimos al usuario ejecutar OCR primero.
      let textoAnalisis = '';
      let ocrMetadata = null;

      if (req.body.usar_cache_ocr && doc.hash_sha256) {
        try {
          const cached = await ocrCacheService.getCachedOcr(doc.hash_sha256);
          if (cached?.texto) {
            textoAnalisis = cached.texto;
            ocrMetadata = {
              cached: true,
              modelo: cached.modelo || null,
              provider: cached.provider || null,
              hash: doc.hash_sha256,
              cachedAt: cached.cachedAt || null,
            };
            logger.info('[ANALIZAR-DOC] OCR obtenido desde cache', {
              hash: doc.hash_sha256.slice(0, 12),
              provider: cached.provider,
            });
          }
        } catch (cacheErr) {
          logger.warn('[ANALIZAR-DOC] Cache lookup falló (siguiendo con texto_ocr DB)', { error: cacheErr?.message });
        }
      }

      if (!textoAnalisis && doc.expediente_texto_ocr) {
        textoAnalisis = doc.expediente_texto_ocr;
        ocrMetadata = {
          cached: false,
          modelo: null,
          provider: null,
          hash: doc.hash_sha256 || null,
          cachedAt: null,
        };
      }

      if (!textoAnalisis) {
        return res.status(409).json({
          error: 'El documento no tiene texto OCR disponible. Sube primero el archivo (POST /api/documentos/upload) o ejecuta el OCR.',
          code: 'OCR_NOT_AVAILABLE',
        });
      }

      // 3. Verificar créditos (1 crédito por análisis IA).
      const CREDITO_ANALISIS = 1;
      const creditos = await tokenRepo.verificarCreditos(orgId);
      if (creditos < CREDITO_ANALISIS) {
        return res.status(402).json({
          error: `Créditos insuficientes para el análisis IA (requiere ${CREDITO_ANALISIS} crédito).`,
          code: 'INSUFFICIENT_CREDITS',
        });
      }

      // 4. Ejecutar análisis via el handler REAL (servicios + RAG + LLM).
      //    Pasamos `ocr_metadata` para activar el prompt OCR-aware en el system prompt.
      const analisis = await ejecutarHerramienta('analizar_expediente', {
        expediente_id: doc.expediente_id,
        tipo_analisis: req.body.tipo_analisis || 'completo',
        materia: req.body.materia || 'general',
        _texto: req.body.consulta || '',
        ocr_metadata: ocrMetadata,
      }, {
        organizationId: orgId,
        user: req.user,
        logger: req.logger || logger,
      });

      // 5. Debitar 1 crédito por el análisis.
      try {
        await tokenRepo.debitarCreditos(
          userId,
          orgId,
          doc.expediente_id,
          CREDITO_ANALISIS,
          `Análisis IA de documento ${doc.id} (${doc.nombre})`
        );
      } catch (creditErr) {
        // El análisis YA se hizo; loguear pero no revertir la respuesta.
        logger.error('[ANALIZAR-DOC] No se pudo debitar crédito (análisis exitoso)', {
          error: creditErr?.message,
        });
      }

      return res.status(200).json({
        success: true,
        tipo_respuesta: 'analisis',
        documento: {
          id: doc.id,
          nombre: doc.nombre,
          tipo_documento: doc.tipo_documento,
        },
        ocr_metadata: ocrMetadata,
        analisis: {
          texto: analisis.texto,
          data: analisis.data || null,
        },
        tokens: analisis.tokens || null,
      });
    } catch (err) {
      logger.error('[ANALIZAR-DOC] Error procesando análisis', {
        error: err?.message,
        docId: req.params.id,
      });
      next(err);
    }
  }
);

export default router;
