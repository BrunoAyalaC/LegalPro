/**
 * @file documents.js
 * @description Utilidades profesionales para exportación de documentos legales.
 * Soporta PDF, Excel, Word y documentos con membrete legal peruano.
 */

import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  Header,
  Footer,
  PageNumber,
  Table,
  TableCell,
  TableRow,
  WidthType,
  BorderStyle,
} from 'docx';
import { saveAs } from 'file-saver';

/* ───────────────────────────────────────────────────────────
   1. Exportar elemento HTML a PDF (html2pdf.js)
   ─────────────────────────────────────────────────────────── */

/**
 * Exporta un elemento del DOM a PDF utilizando html2pdf.js.
 *
 * @param {string} elementId - ID del elemento HTML a convertir.
 * @param {string} filename - Nombre del archivo resultante (incluir .pdf).
 * @param {object} [options={}] - Opciones adicionales para html2pdf.js.
 * @param {number|number[]} [options.margin=10] - Márgenes en mm.
 * @param {string} [options.filename] - Sobreescribe el nombre del archivo.
 * @param {object} [options.image] - Configuración de imagen { type, quality }.
 * @param {object} [options.html2canvas] - Opciones de html2canvas { scale }.
 * @param {object} [options.jsPDF] - Opciones de jsPDF { unit, format, orientation }.
 * @returns {Promise<boolean>} Resuelve al finalizar la descarga.
 * @throws {Error} Si el elemento no existe o falla la generación.
 */
export async function exportToPDF(elementId, filename, options = {}) {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`No se encontró el elemento con id "${elementId}"`);
    }

    const opt = {
      margin: options.margin ?? 10,
      filename: filename || 'documento.pdf',
      image: { type: 'jpeg', quality: 0.98, ...options.image },
      html2canvas: { scale: 2, useCORS: true, ...options.html2canvas },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', ...options.jsPDF },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    await html2pdf().set(opt).from(element).save();
    return true;
  } catch (error) {
    console.error('[exportToPDF] Error:', error);
    throw error;
  }
}

/* ───────────────────────────────────────────────────────────
   2. Exportar datos a Excel (xlsx + file-saver)
   ─────────────────────────────────────────────────────────── */

/**
 * Exporta un array de objetos a un archivo Excel (.xlsx).
 * Aplica estilos básicos al encabezado (negrita, fondo azul, bordes).
 *
 * @param {object[]} data - Array de objetos planos (ej: lista de expedientes).
 * @param {string} filename - Nombre del archivo resultante (incluir .xlsx).
 * @param {string} [sheetName='Hoja1'] - Nombre de la hoja de cálculo.
 * @returns {Promise<boolean>} Resuelve al finalizar la descarga.
 * @throws {Error} Si los datos no son un array válido.
 */
export async function exportToExcel(data, filename, sheetName = 'Hoja1') {
  try {
    if (!Array.isArray(data)) {
      throw new Error('Los datos deben ser un array de objetos');
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

    // ── Estilos de encabezado ──
    for (let c = range.s.c; c <= range.e.c; ++c) {
      const addr = XLSX.utils.encode_cell({ r: range.s.r, c });
      if (!ws[addr]) continue;
      ws[addr].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 11 },
        fill: { patternType: 'solid', fgColor: { rgb: '1F4E78' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } },
        },
      };
    }

    // ── Auto-ajuste de anchos ──
    const keys = data.length ? Object.keys(data[0]) : [];
    ws['!cols'] = keys.map((k) => {
      const maxLen = data.reduce((max, row) => {
        const val = row[k] ?? '';
        return Math.max(max, String(val).length);
      }, k.length);
      return { wch: Math.min(maxLen + 3, 55) };
    });

    // ── Congelar paneles en la primera fila ──
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, filename || 'datos.xlsx');
    return true;
  } catch (error) {
    console.error('[exportToExcel] Error:', error);
    throw error;
  }
}

/* ───────────────────────────────────────────────────────────
   3. Exportar a Word (.docx) — docx + file-saver
   ─────────────────────────────────────────────────────────── */

/**
 * Genera y descarga un documento Word (.docx) profesional.
 * Aplica tipografía legal (Times New Roman, 12pt, interlineado 1.5).
 *
 * @param {string|string[]} content - Texto plano o array de párrafos.
 * @param {string} filename - Nombre del archivo resultante (incluir .docx).
 * @param {object} [options={}] - Opciones de personalización.
 * @param {string} [options.title='Documento'] - Título del documento.
 * @param {string} [options.author='LegalPro'] - Autor / Creador.
 * @param {string} [options.subject='Documento Legal'] - Asunto.
 * @param {number} [options.fontSize=24] - Tamaño de fuente del cuerpo en half-points (24 = 12pt).
 * @param {number} [options.lineSpacing=360] - Interlineado (360 = 1.5 líneas).
 * @returns {Promise<boolean>} Resuelve al finalizar la descarga.
 * @throws {Error} Si falla la generación del documento.
 */
export async function exportToDocx(content, filename, options = {}) {
  try {
    const {
      title = 'Documento',
      author = 'LegalPro',
      subject = 'Documento Legal',
      fontSize = 24,
      lineSpacing = 360,
    } = options;

    const paragraphsRaw = Array.isArray(content)
      ? content
      : String(content).split(/\r?\n/).filter((p) => p.trim());

    const children = [];

    // Título principal
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240, line: lineSpacing, lineRule: 'auto' },
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 32, // 16pt
            font: 'Times New Roman',
          }),
        ],
      })
    );

    // Párrafos del contenido
    paragraphsRaw.forEach((text) => {
      children.push(
        new Paragraph({
          alignment: AlignmentType.BOTH,
          spacing: { line: lineSpacing, lineRule: 'auto', after: 120 },
          children: [
            new TextRun({
              text: text.trim(),
              size: fontSize,
              font: 'Times New Roman',
            }),
          ],
        })
      );
    });

    const doc = new Document({
      creator: author,
      title,
      subject,
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440, // 1 pulgada = 1440 twips
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          children,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, filename || 'documento.docx');
    return true;
  } catch (error) {
    console.error('[exportToDocx] Error:', error);
    throw error;
  }
}

/* ───────────────────────────────────────────────────────────
   4. Generar PDF Legal con membrete peruano
   ─────────────────────────────────────────────────────────── */

/**
 * Genera un PDF legal profesional con membrete peruano estándar.
 * Crea un contenedor HTML temporal con estilos legales y lo convierte a PDF.
 *
 * @param {string|string[]} content - Texto o array de párrafos del cuerpo.
 * @param {object} [metadata={}] - Metadatos del documento.
 * @param {string} [metadata.abogado=''] - Nombre del abogado.
 * @param {string} [metadata.colegiatura=''] - Número de CAL.
 * @param {string} [metadata.organizacion=''] - Nombre del estudio / organización.
 * @param {string} [metadata.direccion=''] - Dirección fiscal.
 * @param {string} [metadata.fecha=''] - Fecha del documento (formato libre).
 * @param {string} [metadata.tipoDocumento='DOCUMENTO LEGAL'] - Tipo de documento.
 * @param {string} [metadata.numeroExpediente=''] - Número de expediente.
 * @returns {Promise<boolean>} Resuelve al finalizar la descarga.
 * @throws {Error} Si falla la generación del PDF.
 */
export async function generateLegalPDF(content, metadata = {}) {
  let container = null;
  try {
    const {
      abogado = 'Abogado',
      colegiatura = '',
      organizacion = 'Estudio Jurídico',
      direccion = '',
      fecha = new Date().toLocaleDateString('es-PE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      tipoDocumento = 'DOCUMENTO LEGAL',
      numeroExpediente = '',
    } = metadata;

    container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '210mm';
    container.style.background = '#ffffff';
    container.style.fontFamily = "'Times New Roman', Times, serif";
    container.style.fontSize = '12pt';
    container.style.lineHeight = '1.5';
    container.style.color = '#000000';

    const bodyHtml = Array.isArray(content)
      ? content.map((p) => `<p style="margin:0 0 12pt 0;text-align:justify;">${p}</p>`).join('')
      : `<div style="text-align:justify;">${content}</div>`;

    container.innerHTML = `
      <div style="padding: 25mm 20mm;">
        <!-- Membrete -->
        <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:24px;">
          <div style="font-size:11pt;text-transform:uppercase;font-weight:bold;letter-spacing:1px;">${organizacion}</div>
          ${direccion ? `<div style="font-size:9pt;margin-top:4px;">${direccion}</div>` : ''}
          ${colegiatura ? `<div style="font-size:9pt;margin-top:4px;">CAL N° ${colegiatura}</div>` : ''}
        </div>

        <!-- Metadata derecha -->
        <div style="text-align:right;font-size:10pt;margin-bottom:20px;">
          <div>${fecha}</div>
          ${numeroExpediente ? `<div style="margin-top:4px;"><strong>Expediente:</strong> ${numeroExpediente}</div>` : ''}
        </div>

        <!-- Tipo de documento -->
        <div style="text-align:center;font-weight:bold;text-transform:uppercase;margin-bottom:24px;font-size:14pt;letter-spacing:0.5px;">
          ${tipoDocumento}
        </div>

        <!-- Cuerpo -->
        <div>${bodyHtml}</div>

        <!-- Firma -->
        <div style="margin-top:48px;text-align:center;">
          <div style="display:inline-block;width:240px;border-top:1px solid #000;padding-top:6px;margin-top:64px;">
            <div style="font-weight:bold;font-size:12pt;">${abogado}</div>
            <div style="font-size:10pt;">Abogado</div>
            ${colegiatura ? `<div style="font-size:9pt;">CAL N° ${colegiatura}</div>` : ''}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    const opt = {
      margin: 0,
      filename: `${String(tipoDocumento).replace(/\s+/g, '_')}_${numeroExpediente || Date.now()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    await html2pdf().set(opt).from(container).save();
    return true;
  } catch (error) {
    console.error('[generateLegalPDF] Error:', error);
    throw error;
  } finally {
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
  }
}

/* ───────────────────────────────────────────────────────────
   5. Generar PDF de Cadena de Custodia Digital
   ─────────────────────────────────────────────────────────── */

/**
 * Genera un PDF de Cadena de Custodia Digital con tabla de evidencias,
 * declaración de integridad y placeholders de firmas.
 *
 * @param {object[]} [evidencias=[]] - Lista de evidencias digitales.
 * @param {string} [evidencias[].titulo=''] - Título o nombre del archivo.
 * @param {string} [evidencias[].descripcion=''] - Descripción de la evidencia.
 * @param {string} [evidencias[].hash=''] - Hash SHA-256 de integridad.
 * @param {string} [evidencias[].fecha=''] - Fecha de incorporación.
 * @param {string} [evidencias[].tamano=''] - Tamaño del archivo.
 * @param {string} [evidencias[].tipo=''] - Tipo MIME o extensión.
 * @param {object} [metadata={}] - Metadatos del caso.
 * @param {string} [metadata.caso=''] - Nombre del caso.
 * @param {string} [metadata.expediente=''] - Número de expediente.
 * @param {string} [metadata.abogado=''] - Abogado responsable.
 * @param {string} [metadata.fecha=''] - Fecha de emisión.
 * @returns {Promise<boolean>} Resuelve al finalizar la descarga.
 * @throws {Error} Si falla la generación del PDF.
 */
export async function generateCustodyPDF(evidencias = [], metadata = {}) {
  let container = null;
  try {
    const {
      caso = '',
      expediente = '',
      abogado = '',
      fecha = new Date().toLocaleDateString('es-PE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    } = metadata;

    container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '210mm';
    container.style.background = '#ffffff';
    container.style.fontFamily = "'Times New Roman', Times, serif";
    container.style.fontSize = '12pt';
    container.style.lineHeight = '1.5';
    container.style.color = '#000000';

    const rows = evidencias
      .map(
        (ev, idx) => `
          <tr>
            <td style="border:1px solid #000;padding:5px 6px;text-align:center;font-size:10pt;">${idx + 1}</td>
            <td style="border:1px solid #000;padding:5px 6px;font-size:10pt;">${ev.titulo || ''}</td>
            <td style="border:1px solid #000;padding:5px 6px;font-size:10pt;">${ev.descripcion || ''}</td>
            <td style="border:1px solid #000;padding:5px 6px;font-family:monospace;font-size:8pt;word-break:break-all;">${ev.hash || ''}</td>
            <td style="border:1px solid #000;padding:5px 6px;text-align:center;font-size:10pt;white-space:nowrap;">${ev.fecha || ''}</td>
            <td style="border:1px solid #000;padding:5px 6px;text-align:right;font-size:10pt;white-space:nowrap;">${ev.tamano || ''}</td>
            <td style="border:1px solid #000;padding:5px 6px;text-align:center;font-size:10pt;">${ev.tipo || ''}</td>
          </tr>
        `
      )
      .join('');

    container.innerHTML = `
      <div style="padding: 20mm;">
        <div style="text-align:center;font-weight:bold;text-transform:uppercase;font-size:16pt;margin-bottom:6px;letter-spacing:1px;">
          Cadena de Custodia Digital
        </div>
        <div style="text-align:center;margin-bottom:24px;font-size:10pt;color:#333;">
          Sistema LegalPro · Generado el ${fecha}
        </div>

        <div style="margin-bottom:18px;font-size:11pt;">
          <strong>Caso:</strong> ${caso || '—'}<br/>
          <strong>Expediente:</strong> ${expediente || '—'}<br/>
          <strong>Abogado responsable:</strong> ${abogado || '—'}
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <thead>
            <tr style="background-color:#f2f2f2;">
              <th style="border:1px solid #000;padding:6px;font-size:10pt;">N°</th>
              <th style="border:1px solid #000;padding:6px;font-size:10pt;">Título</th>
              <th style="border:1px solid #000;padding:6px;font-size:10pt;">Descripción</th>
              <th style="border:1px solid #000;padding:6px;font-size:10pt;">Hash SHA-256</th>
              <th style="border:1px solid #000;padding:6px;font-size:10pt;">Fecha</th>
              <th style="border:1px solid #000;padding:6px;font-size:10pt;">Tamaño</th>
              <th style="border:1px solid #000;padding:6px;font-size:10pt;">Tipo</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="7" style="border:1px solid #000;padding:10px;text-align:center;font-size:10pt;">Sin evidencias registradas</td></tr>'}
          </tbody>
        </table>

        <div style="margin-top:28px;text-align:justify;font-size:11pt;">
          <strong>Declaración de Integridad</strong><br/>
          El suscrito declara bajo juramento que las evidencias digitales listadas en el presente documento han sido recopiladas, almacenadas y transferidas garantizando su integridad y autenticidad. Los valores hash SHA-256 aquí consignados permiten verificar que los archivos no han sido alterados desde su incorporación al sistema LegalPro.
        </div>

        <div style="margin-top:48px;">
          <table style="width:100%;border:none;">
            <tr>
              <td style="width:50%;text-align:center;border:none;vertical-align:top;">
                <div style="display:inline-block;width:200px;border-top:1px solid #000;padding-top:6px;margin-top:64px;">
                  <div style="font-weight:bold;font-size:11pt;">${abogado || '_______________________'}</div>
                  <div style="font-size:10pt;">Abogado / Custodio Digital</div>
                </div>
              </td>
              <td style="width:50%;text-align:center;border:none;vertical-align:top;">
                <div style="display:inline-block;width:200px;border-top:1px solid #000;padding-top:6px;margin-top:64px;">
                  <div style="font-weight:bold;font-size:11pt;">Firma Digital / Sello Electrónico</div>
                  <div style="font-size:10pt;">Representante / Perito</div>
                </div>
              </td>
            </tr>
          </table>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    const opt = {
      margin: 10,
      filename: `Cadena_Custodia_${expediente || Date.now()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    await html2pdf().set(opt).from(container).save();
    return true;
  } catch (error) {
    console.error('[generateCustodyPDF] Error:', error);
    throw error;
  } finally {
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
  }
}
