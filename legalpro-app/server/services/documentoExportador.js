/**
 * Servicio de Exportación de Documentos Legales Peruanos
 *
 * Genera documentos en formato DOCX (Word) y PDF con el formato
 * oficial requerido por el Poder Judicial peruano.
 *
 * Formato:
 *   - Márgenes: 3cm izquierdo, 2cm derecho, 2cm superior, 2cm inferior
 *   - Fuente: Times New Roman 12pt
 *   - Interlineado: 1.5
 *   - Encabezado: juzgado y expediente
 *   - Sumilla, Fundamentos, Petitorio, Firmas, Disclaimer legal
 *
 * Dependencias:
 *   - docx: generación de documentos Word
 *   - puppeteer: generación de PDFs (ya instalado en el proyecto)
 */

import { Document, Packer, Paragraph, TextRun, AlignmentType, 
         Header, Footer, PageNumber, TabStopPosition, TabStopType,
         HeadingLevel, BorderStyle, Table, TableRow, TableCell,
         WidthType, convertInchesToTwip, LevelFormat } from 'docx';
import puppeteer from 'puppeteer';
import logger from '../logger.js';

// ── Constantes de formato legal peruano ──────────────────────────────────────

/** Márgenes en twips (1/1440 de pulgada). 1cm = 567 twips aprox. */
const MARGINS = {
  top:    1134,  // ~2cm
  right:  1134,  // ~2cm
  bottom: 1134,  // ~2cm
  left:   1701,  // ~3cm (margen de encuadernación)
};

/** Tamaño de fuente en medias-puntos (12pt * 2 = 24 medios-puntos) */
const FONT_SIZE = 24; // 12pt en medios-puntos (half-points)

/** Nombre de la fuente */
const FONT_FAMILY = 'Times New Roman';

/** Factor de interlineado 1.5 en 240ths de línea */
const LINE_SPACING = 360; // 1.5 líneas = 360 (240 * 1.5)

/** Espaciado entre párrafos */
const PARAGRAPH_SPACING = {
  after: 120, // 6pt después de cada párrafo
  before: 0,
  line: LINE_SPACING,
};

// ── Disclaimer legal canónico (basado en disclaimers-ia.json) ─────────────────

const DISCLAIMER_LEGAL = [
  'AVISO IMPORTANTE: Este documento ha sido generado con el apoyo de un sistema',
  'de Inteligencia Artificial y NO constituye asesoría legal. Para tomar decisiones',
  'legales, consulte con un abogado colegiado. Verifique siempre las citas legales',
  'y la información con fuentes oficiales (SPIJ).',
  '',
  'Conforme al artículo 290 de la LOPJ, las resoluciones deben estar fundamentadas.',
  'Conforme al artículo 132 del CPC, los participantes deben actuar con buena fe procesal.',
  'Conforme a la Ley 27269, los documentos pueden ser firmados digitalmente.',
  '',
  'Este contenido fue generado por LegalPro IA — www.legalpro.pe',
].join('\n');

// ── Mapeo de tipos a etiquetas legibles ───────────────────────────────────────

const TIPO_LABELS = {
  demanda:         'DEMANDA',
  contestacion:    'CONTESTACIÓN DE DEMANDA',
  apelacion:       'RECURSO DE APELACIÓN',
  casacion:        'RECURSO DE CASACIÓN',
  amparo:          'DEMANDA DE AMPARO',
  habeas_corpus:   'HÁBEAS CORPUS',
  escrito_simple:  'ESCRITO',
  alegato:         'ALEGATO',
  denuncia:        'DENUNCIA',
  contrato:        'CONTRATO',
  dictamen:        'DICTAMEN',
  pericial:        'INFORME PERICIAL',
  medida_cautelar: 'SOLICITUD DE MEDIDA CAUTELAR',
  resumen:         'RESUMEN EJECUTIVO',
  custodia:        'SOLICITUD DE CUSTODIA',
};

// ── Funciones auxiliares ─────────────────────────────────────────────────────

/**
 * Escapa caracteres HTML para prevenir XSS en la plantilla PDF.
 */
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
 * Obtiene la fecha actual en formato peruano: "Lima, 19 de junio de 2026"
 */
function getFechaPeruana() {
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const now = new Date();
  const dia = now.getDate();
  const mes = meses[now.getMonth()];
  const anio = now.getFullYear();
  return `Lima, ${dia} de ${mes} de ${anio}`;
}

/**
 * Limpia el contenido de entrada eliminando scripts y HTML malicioso.
 */
function sanitizarContenido(texto) {
  if (typeof texto !== 'string') return '';
  return texto
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
}

// ── Generación DOCX ──────────────────────────────────────────────────────────

/**
 * Convierte texto plano a párrafos DOCX respetando saltos de línea.
 * Cada línea separada por \n se convierte en un Paragraph.
 *
 * @param {string} texto - Contenido textual
 * @param {object} options - Opciones de formato
 * @param {'left'|'center'|'right'|'justified'} options.alignment - Alineación
 * @param {boolean} options.bold - Negrita
 * @param {number} options.fontSize - Tamaño en half-points
 * @returns {Paragraph[]}
 */
function textoAParrafos(texto, options = {}) {
  if (!texto) return [new Paragraph({ children: [new TextRun('')] })];

  const {
    alignment = AlignmentType.JUSTIFIED,
    bold = false,
    fontSize = FONT_SIZE,
  } = options;

  const lineas = texto.split('\n');

  return lineas.map((linea) => {
    const trimmed = linea.trim();

    if (trimmed === '') {
      // Línea vacía → espacio entre párrafos
      return new Paragraph({
        spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: '', size: fontSize })],
      });
    }

    return new Paragraph({
      alignment,
      spacing: { ...PARAGRAPH_SPACING, line: LINE_SPACING },
      children: [
        new TextRun({
          text: trimmed,
          font: FONT_FAMILY,
          size: fontSize,
          bold,
        }),
      ],
    });
  });
}

/**
 * Genera un buffer DOCX con formato legal peruano.
 *
 * @param {object} params - Datos del documento
 * @returns {Promise<Buffer>} Buffer del archivo DOCX
 */
export async function generarDocx({
  tipo,
  juzgado,
  numeroExpediente,
  sumilla,
  contenido,
  recurrente,
  abogado,
  colegiatura,
  organizacion,
}) {
  const tipoLabel = TIPO_LABELS[tipo] || tipo.toUpperCase();
  const fecha = getFechaPeruana();

  // ── Contenido principal ────────────────────────────────────────────────
  const children = [];

  // --- Membrete / Encabezado del documento ---
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: organizacion || 'ESTUDIO JURÍDICO',
          font: FONT_FAMILY,
          size: FONT_SIZE + 4, // 14pt
          bold: true,
        }),
      ],
    }),
  );

  if (colegiatura) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: `C.A.L. N° ${colegiatura}`,
            font: FONT_FAMILY,
            size: FONT_SIZE - 4, // 10pt
          }),
        ],
      }),
    );
  }

  // Línea separadora
  children.push(
    new Paragraph({
      spacing: { after: 200 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: '1a365d' },
      },
      children: [new TextRun({ text: '', size: FONT_SIZE })],
    }),
  );

  // --- Metadatos: Juzgado, Expediente, Fecha ---
  const metadataItems = [
    { label: 'SEÑOR JUEZ',     value: juzgado },
    { label: 'Expediente',     value: numeroExpediente },
    { label: 'Recurrente',     value: recurrente },
    { label: 'Abogado',        value: abogado },
    { label: 'Fecha',          value: fecha },
  ];

  for (const item of metadataItems) {
    children.push(
      new Paragraph({
        spacing: { after: 40, line: LINE_SPACING },
        children: [
          new TextRun({
            text: `${item.label}: `,
            font: FONT_FAMILY,
            size: FONT_SIZE,
            bold: true,
          }),
          new TextRun({
            text: item.value,
            font: FONT_FAMILY,
            size: FONT_SIZE,
          }),
        ],
      }),
    );
  }

  // Espacio extra
  children.push(
    new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text: '', size: FONT_SIZE })],
    }),
  );

  // --- Título del documento ---
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 4, color: '999999' },
      },
      children: [
        new TextRun({
          text: tipoLabel,
          font: FONT_FAMILY,
          size: FONT_SIZE + 2, // 13pt
          bold: true,
        }),
      ],
    }),
  );

  // Espacio
  children.push(
    new Paragraph({
      spacing: { before: 60, after: 60 },
      children: [new TextRun({ text: '', size: FONT_SIZE })],
    }),
  );

  // --- Sumilla ---
  children.push(
    new Paragraph({
      spacing: { after: 40, line: LINE_SPACING },
      children: [
        new TextRun({
          text: 'SUMILLA: ',
          font: FONT_FAMILY,
          size: FONT_SIZE,
          bold: true,
        }),
        new TextRun({
          text: sumilla,
          font: FONT_FAMILY,
          size: FONT_SIZE,
        }),
      ],
    }),
  );

  // Espacio
  children.push(
    new Paragraph({
      spacing: { before: 60, after: 60 },
      children: [new TextRun({ text: '', size: FONT_SIZE })],
    }),
  );

  // --- Contenido / Fundamentos ---
  children.push(
    new Paragraph({
      spacing: { after: 120, line: LINE_SPACING },
      children: [
        new TextRun({
          text: 'FUNDAMENTOS',
          font: FONT_FAMILY,
          size: FONT_SIZE,
          bold: true,
          underline: { type: 'single' },
        }),
      ],
    }),
  );

  // Agregar el contenido como párrafos
  const parrafosContenido = textoAParrafos(contenido);
  children.push(...parrafosContenido);

  // --- Petitorio ---
  children.push(
    new Paragraph({
      spacing: { before: 200, after: 80, line: LINE_SPACING },
      children: [
        new TextRun({
          text: 'PETITORIO',
          font: FONT_FAMILY,
          size: FONT_SIZE,
          bold: true,
          underline: { type: 'single' },
        }),
      ],
    }),
  );

  children.push(
    new Paragraph({
      spacing: { after: 40, line: LINE_SPACING },
      children: [
        new TextRun({
          text: 'POR TANTO: ',
          font: FONT_FAMILY,
          size: FONT_SIZE,
          bold: true,
        }),
        new TextRun({
          text: `A usted Señor(a) Juez(a), solicito se sirva admitir la presente ${tipoLabel.toLowerCase()} y tramitarla conforme a su naturaleza, declarándola fundada en su oportunidad, con lo demás que en derecho corresponda.`,
          font: FONT_FAMILY,
          size: FONT_SIZE,
        }),
      ],
    }),
  );

  // --- Primer otrosí (abogado patrocinante) ---
  children.push(
    new Paragraph({
      spacing: { before: 200, after: 40, line: LINE_SPACING },
      children: [
        new TextRun({
          text: 'OTROSÍ PRIMERO.- ',
          font: FONT_FAMILY,
          size: FONT_SIZE,
          bold: true,
        }),
        new TextRun({
          text: `Delegamos en el Dr. ${abogado} las facultades generales del mandato judicial`, // Se usa "Delegamos" para mantener coherencia
          font: FONT_FAMILY,
          size: FONT_SIZE,
        }),
      ],
    }),
  );

  // --- Segundo otrosí (domicilio procesal) ---
  children.push(
    new Paragraph({
      spacing: { after: 40, line: LINE_SPACING },
      children: [
        new TextRun({
          text: 'OTROSÍ SEGUNDO.- ',
          font: FONT_FAMILY,
          size: FONT_SIZE,
          bold: true,
        }),
        new TextRun({
          text: 'Señalamos como domicilio procesal la casilla electrónica del estudio, y como domicilio real el consignado en autos.',
          font: FONT_FAMILY,
          size: FONT_SIZE,
        }),
      ],
    }),
  );

  // --- Espacio para firmas ---
  children.push(
    new Paragraph({
      spacing: { before: 400 },
      children: [new TextRun({ text: '', size: FONT_SIZE })],
    }),
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      },
      children: [
        new TextRun({
          text: abogado,
          font: FONT_FAMILY,
          size: FONT_SIZE,
          bold: true,
        }),
      ],
    }),
  );

  if (colegiatura) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: `C.A.L. N° ${colegiatura}`,
            font: FONT_FAMILY,
            size: FONT_SIZE - 4, // 10pt
          }),
        ],
      }),
    );
  }

  // --- Disclaimer legal ---
  children.push(
    new Paragraph({
      spacing: { before: 400 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      },
      children: [new TextRun({ text: '', size: FONT_SIZE })],
    }),
  );

  const disclaimerParrafos = textoAParrafos(DISCLAIMER_LEGAL, {
    alignment: AlignmentType.CENTER,
    fontSize: FONT_SIZE - 6, // 9pt
  });
  children.push(...disclaimerParrafos);

  // ── Construir el documento DOCX ────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT_FAMILY,
            size: FONT_SIZE,
          },
          paragraph: {
            spacing: PARAGRAPH_SPACING,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top:    MARGINS.top,
              right:  MARGINS.right,
              bottom: MARGINS.bottom,
              left:   MARGINS.left,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 0 },
                children: [
                  new TextRun({
                    text: `${juzgado} | Exp. ${numeroExpediente}`,
                    font: FONT_FAMILY,
                    size: FONT_SIZE - 6, // 9pt
                    italics: true,
                    color: '555555',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [
                  new TextRun({
                    text: 'Página ',
                    font: FONT_FAMILY,
                    size: FONT_SIZE - 8, // 8pt
                    color: '888888',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT_FAMILY,
                    size: FONT_SIZE - 8,
                    color: '888888',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

// ── Generación PDF (vía Puppeteer) ──────────────────────────────────────────

/**
 * Construye el HTML completo con membrete legal peruano profesional.
 *
 * @param {object} params - Datos del documento
 * @returns {string} HTML listo para renderizar
 */
function buildHtmlParaPdf({
  tipo,
  juzgado,
  numeroExpediente,
  sumilla,
  contenido,
  recurrente,
  abogado,
  colegiatura,
  organizacion,
}) {
  const tipoLabel = TIPO_LABELS[tipo] || tipo.toUpperCase();
  const fecha = getFechaPeruana();

  const safeContenido = sanitizarContenido(contenido);
  const safeSumilla = escapeHtml(sumilla);
  const safeJuzgado = escapeHtml(juzgado);
  const safeExpediente = escapeHtml(numeroExpediente);
  const safeRecurrente = escapeHtml(recurrente);
  const safeAbogado = escapeHtml(abogado);
  const safeColegiatura = escapeHtml(colegiatura || '');
  const safeOrganizacion = escapeHtml(organizacion || 'ESTUDIO JURÍDICO');
  const safeFecha = escapeHtml(fecha);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${tipoLabel}</title>
  <style>
    @page {
      size: A4;
      margin: 2cm;
      @bottom-center {
        content: counter(page);
        font-family: 'Times New Roman', Times, serif;
        font-size: 9pt;
        color: #888;
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
      padding: 0 1cm 0 1.5cm; /* margen izquierdo extra de 3cm */
    }
    .membrete {
      text-align: center;
      border-bottom: 2px solid #1a365d;
      padding-bottom: 8px;
      margin-bottom: 20px;
    }
    .membrete .org-nombre {
      font-size: 14pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #1a365d;
    }
    .membrete .org-cal {
      font-size: 10pt;
      color: #333;
      margin-top: 2px;
    }
    .meta-datos {
      margin-bottom: 20px;
      font-size: 12pt;
    }
    .meta-datos .label {
      font-weight: bold;
    }
    .tipo-documento {
      text-align: center;
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 16px;
      color: #1a365d;
      border-bottom: 1px solid #ccc;
      padding-bottom: 4px;
    }
    .sumilla {
      margin-bottom: 16px;
      text-align: justify;
    }
    .sumilla .label {
      font-weight: bold;
    }
    .contenido {
      text-align: justify;
      hyphens: auto;
    }
    .contenido p {
      margin: 0 0 8px 0;
    }
    .seccion-titulo {
      font-weight: bold;
      text-decoration: underline;
      margin-top: 16px;
      margin-bottom: 8px;
    }
    .firma-area {
      margin-top: 48px;
      text-align: center;
    }
    .firma-linea {
      border-top: 1px solid #000;
      width: 50%;
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
    .disclaimer {
      margin-top: 60px;
      border-top: 1px solid #ccc;
      padding-top: 8px;
      font-size: 9pt;
      color: #666;
      text-align: center;
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
    <div class="org-nombre">${safeOrganizacion}</div>
    ${safeColegiatura ? `<div class="org-cal">C.A.L. N° ${safeColegiatura}</div>` : ''}
  </div>

  <div class="meta-datos">
    <div><span class="label">SEÑOR JUEZ:</span> ${safeJuzgado}</div>
    <div><span class="label">Expediente:</span> ${safeExpediente}</div>
    <div><span class="label">Recurrente:</span> ${safeRecurrente}</div>
    <div><span class="label">Abogado:</span> ${safeAbogado}</div>
    <div><span class="label">Fecha:</span> ${safeFecha}</div>
  </div>

  <div class="tipo-documento">${tipoLabel}</div>

  <div class="sumilla">
    <span class="label">SUMILLA:</span> ${safeSumilla}
  </div>

  <div class="seccion-titulo">FUNDAMENTOS</div>

  <div class="contenido">
    ${safeContenido}
  </div>

  <div class="seccion-titulo">PETITORIO</div>
  <p><strong>POR TANTO:</strong> A usted Señor(a) Juez(a), solicito se sirva admitir la presente ${tipoLabel.toLowerCase()} y tramitarla conforme a su naturaleza, declarándola fundada en su oportunidad, con lo demás que en derecho corresponda.</p>

  <p><strong>OTROSÍ PRIMERO.-</strong> Delegamos en el Dr. ${safeAbogado} las facultades generales del mandato judicial.</p>

  <p><strong>OTROSÍ SEGUNDO.-</strong> Señalamos como domicilio procesal la casilla electrónica del estudio, y como domicilio real el consignado en autos.</p>

  <div class="firma-area">
    <div class="firma-linea"></div>
    <div class="firma-nombre">${safeAbogado}</div>
    ${safeColegiatura ? `<div class="firma-cal">C.A.L. N° ${safeColegiatura}</div>` : ''}
  </div>

  <div class="disclaimer">
    AVISO IMPORTANTE: Este documento ha sido generado con el apoyo de un sistema de Inteligencia Artificial y NO constituye asesoría legal.<br>
    Verifique siempre las citas legales y la información con fuentes oficiales (SPIJ).<br>
    Conforme a la Ley 27269, los documentos pueden ser firmados digitalmente.<br>
    Este contenido fue generado por LegalPro IA &mdash; www.legalpro.pe
  </div>
</body>
</html>`;
}

/**
 * Genera un buffer PDF usando Puppeteer para renderizar el HTML.
 *
 * @param {object} params - Datos del documento
 * @returns {Promise<Buffer>} Buffer del archivo PDF
 */
export async function generarPdf(params) {
  let browser;
  try {
    const html = buildHtmlParaPdf(params);

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
        top: '2cm',
        right: '2cm',
        bottom: '2cm',
        left: '2cm',
      },
      preferCSSPageSize: true,
    });

    await browser.close();
    browser = null;

    return pdfBuffer;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) { /* ignore */ }
    }
  }
}

/**
 * Genera el nombre de archivo apropiado para el documento.
 *
 * @param {object} params - Datos del documento
 * @param {'docx'|'pdf'} formato - Formato de exportación
 * @returns {string} Nombre de archivo
 */
export function generarNombreArchivo({ tipo, numeroExpediente, recurrente }, formato) {
  const sanitizedRecurrente = (recurrente || 'documento')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 30)
    .toLowerCase();

  const exp = (numeroExpediente || 'sin_expediente').replace(/[^a-zA-Z0-9-]/g, '_');

  return `LEXIA_${tipo}_${exp}_${sanitizedRecurrente}.${formato}`;
}
