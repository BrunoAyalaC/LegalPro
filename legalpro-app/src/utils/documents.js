import { saveAs } from 'file-saver';

export async function exportToPDF(elementId, filename, options = {}) {
  const html2pdf = (await import('html2pdf.js')).default;
  try {
    const element = document.getElementById(elementId);
    if (!element) throw new Error(`No se encontró el elemento con id "${elementId}"`);

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

export async function exportToExcel(data, filename, sheetName = 'Hoja1') {
  const XLSX = await import('xlsx');
  try {
    if (!Array.isArray(data)) throw new Error('Los datos deben ser un array de objetos');

    const ws = XLSX.utils.json_to_sheet(data);
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

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

    const keys = data.length ? Object.keys(data[0]) : [];
    ws['!cols'] = keys.map((k) => {
      const maxLen = data.reduce((max, row) => Math.max(max, String(row[k] ?? '').length), k.length);
      return { wch: Math.min(maxLen + 3, 55) };
    });

    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename || 'datos.xlsx');
    return true;
  } catch (error) {
    console.error('[exportToExcel] Error:', error);
    throw error;
  }
}

export async function exportToDocx(content, filename, options = {}) {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, PageNumber, Table, TableCell, TableRow, WidthType, BorderStyle, HeadingLevel } = await import('docx');
  try {
    const {
      title = 'Documento', author = 'LegalPro', subject = 'Documento Legal',
      fontSize = 24, lineSpacing = 360,
    } = options;

    const paragraphsRaw = Array.isArray(content)
      ? content
      : String(content).split(/\r?\n/).filter((p) => p.trim());

    const children = [];

    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240, line: lineSpacing, lineRule: 'auto' },
      children: [new TextRun({ text: title, bold: true, size: 32, font: 'Times New Roman' })],
    }));

    paragraphsRaw.forEach((text) => {
      children.push(new Paragraph({
        alignment: AlignmentType.BOTH,
        spacing: { line: lineSpacing, lineRule: 'auto', after: 120 },
        children: [new TextRun({ text: text.trim(), size: fontSize, font: 'Times New Roman' })],
      }));
    });

    // Disclaimer de IA obligatorio
    children.push(new Paragraph({
      alignment: AlignmentType.BOTH,
      spacing: { line: lineSpacing, lineRule: 'auto', before: 240, after: 120 },
      children: [new TextRun({ 
        text: "AVISO DE DESCARGO DE RESPONSABILIDAD (DISCLAIMER): Este documento constituye un borrador preliminar y ha sido redactado con el soporte tecnológico de herramientas de Inteligencia Artificial (IA) provistas por la plataforma LegalPro. De conformidad con el artículo 290 de la Ley Orgánica del Poder Judicial de la República del Perú, el artículo 132 del Código Procesal Civil y el artículo IX del Título Preliminar del Código Procesal Penal, la dirección de la defensa y la asunción del contenido legal de todo escrito presentado ante los órganos judiciales o administrativos corresponde en forma exclusiva al abogado patrocinante. En consecuencia, el usuario/abogado asume la obligación ética y legal de revisar, corregir y validar de manera exhaustiva el presente texto antes de su suscripción, presentación o uso contractual. LegalPro S.A.C. queda exenta de toda responsabilidad civil extracontractual o contractual por decisiones tomadas en base a este documento (configurando una fractura del nexo causal por hecho propio del usuario de acuerdo al Art. 1972 del Código Civil peruano), así como de cualquier responsabilidad penal derivada del contenido o veracidad de la información contenida en el mismo (Art. 12 del Código Penal peruano).", 
        italics: true, 
        size: fontSize - 2, 
        font: 'Times New Roman' 
      })],
    }));

    const doc = new Document({
      creator: author, title, subject,
      sections: [{
        properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, filename || 'documento.docx');
    return true;
  } catch (error) {
    console.error('[exportToDocx] Error:', error);
    throw error;
  }
}

export async function generateLegalPDF(content, metadata = {}) {
  const html2pdf = (await import('html2pdf.js')).default;
  let container = null;
  try {
    const {
      abogado = 'Abogado', colegiatura = '', organizacion = 'Estudio Jurídico',
      direccion = '', tipoDocumento = 'DOCUMENTO LEGAL', numeroExpediente = '',
      fecha = new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }),
    } = metadata;

    container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-9999px;top:0;width:210mm;background:#fff;font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.5;color:#000';

    const bodyHtml = Array.isArray(content)
      ? content.map((p) => `<p style="margin:0 0 12pt 0;text-align:justify;">${p}</p>`).join('')
      : `<div style="text-align:justify;">${content}</div>`;

    container.innerHTML = `
      <div style="padding: 25mm 20mm;">
        <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:24px;">
          <div style="font-size:11pt;text-transform:uppercase;font-weight:bold;letter-spacing:1px;">${organizacion}</div>
          ${direccion ? `<div style="font-size:9pt;margin-top:4px;">${direccion}</div>` : ''}
          ${colegiatura ? `<div style="font-size:9pt;margin-top:4px;">CAL N° ${colegiatura}</div>` : ''}
        </div>
        <div style="text-align:right;font-size:10pt;margin-bottom:20px;">
          <div>${fecha}</div>
          ${numeroExpediente ? `<div style="margin-top:4px;"><strong>Expediente:</strong> ${numeroExpediente}</div>` : ''}
        </div>
        <div style="text-align:center;font-weight:bold;text-transform:uppercase;margin-bottom:24px;font-size:14pt;letter-spacing:0.5px;">${tipoDocumento}</div>
        <div>${bodyHtml}</div>
        <div style="margin-top:48px;text-align:center;">
          <div style="display:inline-block;width:240px;border-top:1px solid #000;padding-top:6px;margin-top:64px;">
            <div style="font-weight:bold;font-size:12pt;">${abogado}</div>
            <div style="font-size:10pt;">Abogado</div>
            ${colegiatura ? `<div style="font-size:9pt;">CAL N° ${colegiatura}</div>` : ''}
          </div>
        </div>
        <div style="margin-top:48px;border-top:1px dashed #ccc;padding-top:8px;font-size:8.5pt;color:#666;text-align:justify;font-style:italic;line-height:1.35;">
          <strong>AVISO DE DESCARGO DE RESPONSABILIDAD (DISCLAIMER):</strong> Este documento constituye un borrador preliminar y ha sido redactado con el soporte tecnológico de herramientas de Inteligencia Artificial (IA) provistas por la plataforma LegalPro. De conformidad con el artículo 290 de la Ley Orgánica del Poder Judicial de la República del Perú, el artículo 132 del Código Procesal Civil y el artículo IX del Título Preliminar del Código Procesal Penal, la dirección de la defensa y la asunción del contenido legal de todo escrito presentado ante los órganos judiciales o administrativos corresponde en forma exclusiva al abogado patrocinante. En consecuencia, el usuario/abogado asume la obligación ética y legal de revisar, corregir y validar de manera exhaustiva el presente texto antes de su suscripción, presentación o uso contractual. LegalPro S.A.C. queda exenta de toda responsabilidad civil extracontractual o contractual por decisiones tomadas en base a este documento (configurando una fractura del nexo causal por hecho propio del usuario de acuerdo al Art. 1972 del Código Civil peruano), así como de cualquier responsabilidad penal derivada del contenido o veracidad de la información contenida en el mismo (Art. 12 del Código Penal peruano).
        </div>
      </div>`;

    document.body.appendChild(container);

    await html2pdf().set({
      margin: 0,
      filename: `${tipoDocumento.replace(/\s+/g, '_')}_${numeroExpediente || Date.now()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    }).from(container).save();

    return true;
  } catch (error) {
    console.error('[generateLegalPDF] Error:', error);
    throw error;
  } finally {
    if (container && container.parentNode) document.body.removeChild(container);
  }
}

export async function generateCustodyPDF(evidencias = [], metadata = {}) {
  const html2pdf = (await import('html2pdf.js')).default;
  let container = null;
  try {
    const {
      caso = '', expediente = '', abogado = '',
      fecha = new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }),
    } = metadata;

    container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-9999px;top:0;width:210mm;background:#fff;font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.5;color:#000';

    const rows = evidencias.map((ev, idx) => `
      <tr>
        <td style="border:1px solid #000;padding:5px 6px;text-align:center;font-size:10pt;">${idx + 1}</td>
        <td style="border:1px solid #000;padding:5px 6px;font-size:10pt;">${ev.titulo || ''}</td>
        <td style="border:1px solid #000;padding:5px 6px;font-size:10pt;">${ev.descripcion || ''}</td>
        <td style="border:1px solid #000;padding:5px 6px;font-family:monospace;font-size:8pt;word-break:break-all;">${ev.hash || ''}</td>
        <td style="border:1px solid #000;padding:5px 6px;text-align:center;font-size:10pt;white-space:nowrap;">${ev.fecha || ''}</td>
        <td style="border:1px solid #000;padding:5px 6px;text-align:right;font-size:10pt;white-space:nowrap;">${ev.tamano || ''}</td>
        <td style="border:1px solid #000;padding:5px 6px;text-align:center;font-size:10pt;">${ev.tipo || ''}</td>
      </tr>`).join('');

    container.innerHTML = `
      <div style="padding: 20mm;">
        <div style="text-align:center;font-weight:bold;text-transform:uppercase;font-size:16pt;margin-bottom:6px;letter-spacing:1px;">Cadena de Custodia Digital</div>
        <div style="text-align:center;margin-bottom:24px;font-size:10pt;color:#333;">Sistema LegalPro · Generado el ${fecha}</div>
        <div style="margin-bottom:18px;font-size:11pt;">
          <strong>Caso:</strong> ${caso || '—'}<br/>
          <strong>Expediente:</strong> ${expediente || '—'}<br/>
          <strong>Abogado responsable:</strong> ${abogado || '—'}
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <thead><tr style="background-color:#f2f2f2;">
            <th style="border:1px solid #000;padding:6px;font-size:10pt;">N°</th>
            <th style="border:1px solid #000;padding:6px;font-size:10pt;">Título</th>
            <th style="border:1px solid #000;padding:6px;font-size:10pt;">Descripción</th>
            <th style="border:1px solid #000;padding:6px;font-size:10pt;">Hash SHA-256</th>
            <th style="border:1px solid #000;padding:6px;font-size:10pt;">Fecha</th>
            <th style="border:1px solid #000;padding:6px;font-size:10pt;">Tamaño</th>
            <th style="border:1px solid #000;padding:6px;font-size:10pt;">Tipo</th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="7" style="border:1px solid #000;padding:10px;text-align:center;font-size:10pt;">Sin evidencias registradas</td></tr>'}</tbody>
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
      </div>`;

    document.body.appendChild(container);

    await html2pdf().set({
      margin: 10,
      filename: `Cadena_Custodia_${expediente || Date.now()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    }).from(container).save();

    return true;
  } catch (error) {
    console.error('[generateCustodyPDF] Error:', error);
    throw error;
  } finally {
    if (container && container.parentNode) document.body.removeChild(container);
  }
}
