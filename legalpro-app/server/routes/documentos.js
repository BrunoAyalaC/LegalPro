import { Router } from 'express';
import puppeteer from 'puppeteer';
import { authMiddleware, tenantMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

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

export default router;
