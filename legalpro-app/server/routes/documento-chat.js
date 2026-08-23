/**
 * Router de Documentos desde Chat
 *
 *   POST /api/ai/detectar-documento → detecta el tipo de documento desde la conversación
 *   POST /api/ai/redactar-documento → redacta el escrito estructurado + genera PDF/DOCX
 *
 * Uso desde el frontend:
 *   1. Llamar detectar-documento con la conversación → obtiene { tipo, materia, titulo }
 *   2. Llamar redactar-documento con el tipo detectado → recibe el PDF/DOCX como buffer
 *
 * Seguridad (alineado con el resto de rutas IA):
 *   - authMiddleware + tenantMiddleware (multi-tenant: organization_id del JWT)
 *   - requireTransferenciaInternacional (LPDP Art. 21)
 *   - idempotencyMiddleware en el POST que genera archivo (anti doble submit)
 *   - quotaMiddleware (límite mensual de consultas IA por organización)
 *   - validate(Zod) — validación estricta de entrada
 *   - validarDisclaimerAceptado — el usuario debe aceptar el aviso de IA
 *   - Los mensajes se sanitizan en los servicios (prompt injection + LPDP Art. 21)
 */

import { Router } from 'express';
// FIX P0-C: tenantMiddleware REAL (tenantContext.run + AsyncLocalStorage → RLS).
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
import { requireTransferenciaInternacional } from '../middleware/requireTransferenciaInternacional.js';
import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware.js';
import { quotaMiddleware } from '../middleware/quotaMiddleware.js';
import { validate } from '../middleware/validate.js';
import { validarPermisoIA } from '../middleware/promptSanitizer.js';
import { detectarDocumentoSchema, redactarDocumentoSchema } from '../schemas/documentoChatSchema.js';
import { detectarTipoDocumento } from '../services/documentoDetector.js';
import { redactarDocumento } from '../services/documentoRedactor.js';
import { generarDocx, generarPdf, generarNombreArchivo } from '../services/documentoExportador.js';
import db from '../db.js';
import { TokenRepository } from '../repositories/TokenRepository.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
const tokenRepo = new TokenRepository(db);

// LPDP Art. 21: bloquea si el usuario no consintió transferencia internacional.
const iaTransferenciaGuard = requireTransferenciaInternacional();

router.use(authMiddleware, tenantMiddleware);

/**
 * Valida que el usuario haya aceptado el disclaimer de IA antes de generar contenido.
 * (Mismo criterio que routes/ai.js — trazabilidad legal LPDP).
 */
function validarDisclaimerAceptado(req, res, next) {
  const { disclaimerAceptado } = req.body ?? {};
  if (disclaimerAceptado !== true) {
    req.logger?.warn('[LEGAL] Intento de uso de IA sin aceptar disclaimer', {
      userId: req.user?.sub,
      path: req.path,
      ip: req.ip,
    });
    return res.status(403).json({
      error: 'Debe aceptar el disclaimer de IA antes de generar contenido.',
      code: 'DISCLAIMER_REQUIRED',
    });
  }
  req.logger?.info('[LEGAL] Disclaimer de IA aceptado', {
    userId: req.user?.sub,
    organizationId: req.organizationId,
    path: req.path,
    timestamp: new Date().toISOString(),
  });
  next();
}

/**
 * Construye el contenido de cuerpo del documento para el exportador
 * a partir del JSON estructurado del redactor. El exportador agrega
 * después sus secciones estándar (POR TANTO, OTROSÍ, firmas).
 */
function construirContenido(documento) {
  const partes = [];

  const fundamentos = Array.isArray(documento.fundamentos)
    ? documento.fundamentos.filter((f) => f && f.trim().length > 0)
    : [];
  if (fundamentos.length > 0) {
    partes.push(fundamentos.map((f, i) => `${i + 1}. ${f}`).join('\n\n'));
  }

  const baseLegal = Array.isArray(documento.base_legal)
    ? documento.base_legal.filter((b) => b && b.trim().length > 0)
    : [];
  if (baseLegal.length > 0) {
    partes.push(`BASE LEGAL:\n${baseLegal.map((b) => `- ${b}`).join('\n')}`);
  }

  if (documento.petitorio && documento.petitorio.trim()) {
    partes.push(`PETITORIO:\n${documento.petitorio.trim()}`);
  }

  if (documento.otrosi_primero && documento.otrosi_primero.trim()) {
    partes.push(`OTROSÍ PRIMERO.- ${documento.otrosi_primero.trim()}`);
  }

  if (documento.otrosi_segundo && documento.otrosi_segundo.trim()) {
    partes.push(`OTROSÍ SEGUNDO.- ${documento.otrosi_segundo.trim()}`);
  }

  return partes.join('\n\n') || 'Sin contenido generado por IA.';
}

/**
 * POST /api/ai/detectar-documento
 * Body: { conversacion: [{rol, contenido}], materia?, expediente_id?, disclaimerAceptado }
 */
router.post(
  '/detectar-documento',
  iaTransferenciaGuard,
  quotaMiddleware('documento_detectar'),
  validate(detectarDocumentoSchema),
  validarDisclaimerAceptado,
  async (req, res, next) => {
    try {
      const { conversacion, materia, expediente_id } = req.body;
      const orgId = req.organizationId;
      const userId = req.user?.sub;

      if (!validarPermisoIA(req.user?.rol, 'redactor')) {
        return res.status(403).json({ error: 'Su rol no tiene acceso a la generación de documentos.' });
      }

      const creditos = await tokenRepo.verificarCreditos(orgId);
      if (creditos <= 0) {
        return res.status(402).json({ error: 'Créditos insuficientes para realizar esta operación.', code: 'INSUFFICIENT_CREDITS' });
      }

      const deteccion = await detectarTipoDocumento(conversacion, {
        materia,
        numeroExpediente: expediente_id,
      });

      // Registrar consumo de tokens (no bloquea la respuesta si falla).
      const promptTokensEstimados = Math.round(JSON.stringify(conversacion).length / 4) || 1;
      const totalTokens = deteccion.tokens || 0;
      tokenRepo.registrarConsumo(
        userId,
        orgId,
        'documento_detectar',
        deteccion.model || 'unknown',
        promptTokensEstimados,
        Math.max(0, totalTokens - promptTokensEstimados),
        req.headers['x-idempotency-key'] || null
      ).catch((err) => {
        req.logger?.error('Error al registrar consumo en detectar-documento:', err);
      });

      // Debitar 1 crédito por detección de tipo de documento.
      try {
        await tokenRepo.debitarCreditos(userId, orgId, expediente_id || null, 1, 'Detección de tipo de documento desde chat');
      } catch (creditErr) {
        return res.status(402).json({ error: creditErr.message, code: 'INSUFFICIENT_CREDITS' });
      }

      // Audit event: la conversación puede contener datos personales (LPDP Art. 2).
      logAudit('DOCUMENTO_DETECTADO', {
        userId,
        organizationId: orgId,
        path: req.path,
        ip: req.ip,
        tipo_documento: deteccion.tipo,
        materia: deteccion.materia,
        confianza: deteccion.confianza,
      }).catch(() => {});

      return res.json({ success: true, data: deteccion });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/ai/redactar-documento
 * Body: { conversacion, tipo_documento, materia?, numero_expediente?, formato?: 'pdf'|'docx', disclaimerAceptado, ... }
 * Response: buffer PDF/DOCX con Content-Disposition para descarga.
 */
router.post(
  '/redactar-documento',
  iaTransferenciaGuard,
  idempotencyMiddleware(),
  quotaMiddleware('documento_redactar'),
  validate(redactarDocumentoSchema),
  validarDisclaimerAceptado,
  async (req, res, next) => {
    try {
      const {
        conversacion,
        tipo_documento,
        materia,
        numero_expediente,
        formato = 'pdf',
        juzgado,
        recurrente,
        abogado,
        colegiatura,
        organizacion,
      } = req.body;
      const orgId = req.organizationId;
      const userId = req.user?.sub;

      if (!validarPermisoIA(req.user?.rol, 'redactor')) {
        return res.status(403).json({ error: 'Su rol no tiene acceso a la generación de documentos.' });
      }

      const creditos = await tokenRepo.verificarCreditos(orgId);
      if (creditos <= 0) {
        return res.status(402).json({ error: 'Créditos insuficientes para realizar esta operación.', code: 'INSUFFICIENT_CREDITS' });
      }

      // 1. Redactar contenido estructurado con IA.
      const documento = await redactarDocumento({
        conversacion,
        tipoDocumento: tipo_documento,
        materia: materia || 'general',
        numeroExpediente: numero_expediente || '',
      });

      // Debitar 1 crédito por redacción + exportación (antes de gastar CPU en PDF).
      try {
        await tokenRepo.debitarCreditos(userId, orgId, null, 1, `Redacción y exportación de ${tipo_documento} desde chat`);
      } catch (creditErr) {
        return res.status(402).json({ error: creditErr.message, code: 'INSUFFICIENT_CREDITS' });
      }

      // 2. Generar archivo con formato PJ (membrete desde el usuario/org del JWT).
      const params = {
        tipo: tipo_documento,
        juzgado: juzgado || 'JUZGADO COMPETENTE',
        numeroExpediente: numero_expediente || 'S/N-2026',
        sumilla: documento.sumilla || 'Escrito presentado por el solicitante',
        contenido: construirContenido(documento),
        recurrente: recurrente || 'EL SOLICITANTE',
        abogado: abogado || req.user?.nombre_completo || 'ABOGADO COLEGIADO',
        colegiatura: colegiatura || '',
        organizacion: organizacion || req.user?.org_name,
      };

      const buffer = formato === 'docx' ? await generarDocx(params) : await generarPdf(params);
      const nombreArchivo = generarNombreArchivo(params, formato);

      res.setHeader('Content-Type', formato === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Registrar consumo de tokens (fire-and-forget, después de enviar el buffer).
      const promptTokensEstimados = Math.round(JSON.stringify(conversacion).length / 4) || 1;
      const totalTokens = documento.tokens || 0;
      tokenRepo.registrarConsumo(
        userId,
        orgId,
        'documento_redactar',
        documento.model || 'unknown',
        promptTokensEstimados,
        Math.max(0, totalTokens - promptTokensEstimados),
        req.headers['x-idempotency-key'] || null
      ).catch((err) => {
        req.logger?.error('Error al registrar consumo en redactar-documento:', err);
      });

      // Audit event: el documento redactado contiene datos personales del caso.
      logAudit('DOCUMENTO_GENERADO', {
        userId,
        organizationId: orgId,
        path: req.path,
        ip: req.ip,
        tipo_documento: tipo_documento,
        formato,
        numero_expediente: numero_expediente || null,
        sizeBytes: buffer.length,
      }).catch(() => {});

      req.logger?.info('[DOCUMENTO-CHAT] Documento generado', {
        tipo: tipo_documento,
        formato,
        expediente: numero_expediente || null,
        sizeBytes: buffer.length,
        orgId,
      });

      return res.send(buffer);
    } catch (err) {
      req.logger?.error('[DOCUMENTO-CHAT] Error generando documento:', err);

      // Errores específicos de Puppeteer (mismo criterio que documentos.js).
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

export default router;
