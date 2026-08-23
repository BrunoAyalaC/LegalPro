import { Router } from 'express';
import puppeteer from 'puppeteer';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import db from '../db.js';
import { TokenRepository } from '../repositories/TokenRepository.js';
import crypto from 'crypto';
import { authMiddleware, tenantMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware.js';
import { validate } from '../middleware/validate.js';
import { documentoExportarSchema } from '../schemas/documentoExportarSchema.js';
import { generarDocx, generarPdf, generarNombreArchivo } from '../services/documentoExportador.js';
import logger from '../logger.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

const tokenRepo = new TokenRepository(db);

// Inicialización perezosa: la ausencia de la clave de IA no debe impedir el arranque
// ni el resto de funcionalidad de documentos (subida/listado). El OCR falla por-petición (503).
let _ai = null;
function getAi() {
  if (!process.env.GEMINI_API_KEY) {
    const err = new Error('El servicio de IA no está disponible (GEMINI_API_KEY no configurada).');
    err.status = 503;
    err.code = 'IA_NO_DISPONIBLE';
    throw err;
  }
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _ai;
}

const TIPOS_VALIDOS = ['escrito', 'alegato', 'resumen', 'custodia'];

const TIPO_LABELS = {
  escrito: 'ESCRITO',
  alegato: 'ALEGATO',
  resumen: 'RESUMEN EJECUTIVO',
  custodia: 'SOLICITUD DE CUSTODIA',
};

/**
 * Construye el HTML completo con membrete legal peruano profesional.
 */
function buildHtmlTemplate(contenidoHtml, metadata, tipo) {
  const {
    numeroExpediente = '',
    abogado = '',
    colegiatura = '',
    organizacion = '',
    direccion = '',
    fecha = new Date().toISOString().split('T')[0],
  } = metadata ?? {};

  const tipoLabel = TIPO_LABELS[tipo] ?? 'DOCUMENTO';

  // Escapar contenido HTML para evitar inyección maliciosa si el frontend no lo sanitiza
  const safeContent = contenidoHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${tipoLabel}</title>
  <style>
    @page {
      size: A4;
      margin: 2.5cm;
      @bottom-center {
        content: counter(page) " / " counter(pages);
        font-family: 'Times New Roman', Times, serif;
        font-size: 10pt;
        color: #555;
      }
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #000;
      margin: 0;
      padding: 0;
    }
    .membrete {
      text-align: center;
      border-bottom: 2px solid #1a365d;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    .membrete .org-nombre {
      font-size: 14pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #1a365d;
    }
    .membrete .org-direccion,
    .membrete .org-cal {
      font-size: 10pt;
      color: #333;
      margin-top: 2px;
    }
    .meta-box {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      font-size: 11pt;
    }
    .meta-box .left,
    .meta-box .right {
      width: 48%;
    }
    .meta-box .label {
      font-weight: bold;
      color: #1a365d;
    }
    .tipo-documento {
      text-align: center;
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 18px;
      color: #1a365d;
      border-bottom: 1px solid #ccc;
      padding-bottom: 6px;
    }
    .contenido {
      text-align: justify;
      hyphens: auto;
    }
    .contenido p {
      margin: 0 0 12px 0;
    }
    .firma-area {
      margin-top: 48px;
      text-align: center;
    }
    .firma-linea {
      border-top: 1px solid #000;
      width: 60%;
      margin: 0 auto;
      padding-top: 4px;
    }
    .firma-nombre {
      font-weight: bold;
      margin-top: 4px;
    }
    .firma-cal {
      font-size: 10pt;
      color: #333;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="membrete">
    <div class="org-nombre">${escapeHtml(organizacion) || 'ESTUDIO JURÍDICO'}</div>
    <div class="org-direccion">${escapeHtml(direccion) || 'Lima, Perú'}</div>
    ${colegiatura ? `<div class="org-cal">C.A.L. N° ${escapeHtml(colegiatura)}</div>` : ''}
  </div>

  <div class="meta-box">
    <div class="left">
      <div><span class="label">Expediente:</span> ${escapeHtml(numeroExpediente) || 'N/A'}</div>
      <div><span class="label">Fecha:</span> ${escapeHtml(fecha)}</div>
    </div>
    <div class="right">
      <div><span class="label">Abogado:</span> ${escapeHtml(abogado) || 'N/A'}</div>
    </div>
  </div>

  <div class="tipo-documento">${tipoLabel}</div>

  <div class="contenido">
    ${safeContent}
  </div>

  ${abogado ? `
  <div class="firma-area">
    <div class="firma-linea"></div>
    <div class="firma-nombre">${escapeHtml(abogado)}</div>
    ${colegiatura ? `<div class="firma-cal">C.A.L. N° ${escapeHtml(colegiatura)}</div>` : ''}
  </div>
  ` : ''}
</body>
</html>`;
}

function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * POST /api/documentos/exportar-pdf
 *
 * Genera un PDF profesional a partir de contenido HTML con membrete legal peruano.
 */
router.post('/exportar-pdf', authMiddleware, tenantMiddleware, async (req, res, next) => {
  let browser;
  try {
    const { contenidoHtml, tipo, metadata } = req.body;

    // ── Validaciones ─────────────────────────────────────────────────────────
    if (!contenidoHtml || typeof contenidoHtml !== 'string') {
      return res.status(400).json({ error: 'El campo contenidoHtml es obligatorio y debe ser una cadena HTML.' });
    }

    if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({
        error: `Tipo inválido. Valores permitidos: ${TIPOS_VALIDOS.join(', ')}.`,
      });
    }

    // ── Generar HTML completo ────────────────────────────────────────────────
    const html = buildHtmlTemplate(contenidoHtml, metadata, tipo);

    // ── Renderizar PDF con Puppeteer ─────────────────────────────────────────
    // Args optimizados para entornos Docker / Alpine Linux (Railway)
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '2.5cm',
        right: '2.5cm',
        bottom: '2.5cm',
        left: '2.5cm',
      },
      preferCSSPageSize: true,
    });

    await browser.close();
    browser = null;

    // ── Enviar respuesta como archivo PDF ────────────────────────────────────
    const filename = `documento-${tipo}-${metadata?.numeroExpediente || Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    if (browser) {
      try { await browser.close(); } catch (_) { /* ignore */ }
    }
    console.error('[PDF] Error generando PDF:', err.message);
    // Si es un error de Puppeteer (ej. Chromium no disponible), devolver 500 con mensaje claro
    if (err.message?.includes('Could not find Chromium') || err.message?.includes('Failed to launch')) {
      return res.status(500).json({ error: 'El servicio de generación de PDF no está disponible. Contacte al administrador.' });
    }
    next(err);
  }
});

/**
 * POST /api/documentos/upload
 *
 * Sube un documento (imagen/PDF), realiza la extracción de texto mediante OCR multimodal
 * con Gemini, guarda el texto extraído en el expediente y debita 2 créditos.
 */
router.post('/upload', authMiddleware, tenantMiddleware, idempotencyMiddleware(), upload.single('file'), async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.sub;

    if (!userId || !orgId) {
      return res.status(401).json({ error: 'No autorizado.' });
    }

    // 1. Verificar créditos
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
    const { rows: [exp] } = await db.query(
      'SELECT id FROM expedientes WHERE id=$1 AND organization_id=$2',
      [expedienteId, orgId]
    );
    if (!exp) {
      return res.status(404).json({ error: 'Expediente no encontrado o no pertenece a su organización.' });
    }

    // 4. Preparar el archivo para Gemini OCR
    const filePart = {
      inlineData: {
        data: req.file.buffer.toString('base64'),
        mimeType: req.file.mimetype,
      },
    };

    // 5. Llamar a Gemini para realizar el OCR multimodal
    const ocrResponse = await getAi().models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        filePart,
        'Realiza un OCR (Reconocimiento Óptico de Caracteres) preciso de este documento legal peruano. Extrae todo el texto legible con exactitud, manteniendo la estructura general del documento y sin omitir nada de información. No agregues introducciones, resúmenes ni comentarios adicionales; solo devuelve el texto extraído.'
      ],
    });

    const textoOcr = ocrResponse.text ?? 'No se pudo extraer texto del documento.';

    // 6. Actualizar expedientes con el texto OCR
    await db.query(
      'UPDATE expedientes SET texto_ocr=$1 WHERE id=$2',
      [textoOcr, expedienteId]
    );

    // 7. Calcular hash SHA256 del archivo
    const hashSha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    // 8. Registrar el documento en la base de datos
    const { rows: [doc] } = await db.query(
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
        req.body.descripcion || 'Documento procesado con OCR multimodal de Gemini',
        `/uploads/${hashSha256}-${req.file.originalname}`,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        hashSha256
      ]
    );

    // 9. Registrar consumo de tokens de Gemini
    const promptTokens = ocrResponse.usageMetadata?.promptTokenCount || 0;
    const completionTokens = ocrResponse.usageMetadata?.candidatesTokenCount || 0;
    tokenRepo.registrarConsumo(
      userId,
      orgId,
      'document_ocr',
      'gemini-1.5-flash',
      promptTokens,
      completionTokens,
      req.headers['x-idempotency-key'] || null
    ).catch(err => {
      console.error('Error al registrar consumo de OCR:', err);
    });

    // 10. Debitar 2 créditos por el OCR
    await tokenRepo.debitarCreditos(
      userId,
      orgId,
      expedienteId,
      2,
      `Extracción OCR Multimodal - Archivo: ${req.file.originalname}`
    );

    return res.status(200).json({
      success: true,
      mensaje: 'Documento procesado con OCR y registrado exitosamente.',
      documento: doc,
      textoOcr: textoOcr
    });

  } catch (err) {
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

export default router;
