// legalpro-app/src/components/chat/LegalMarkdown.jsx
// Renderer markdown legal completo para el chat LexIA.
//
// Pipeline mdToHtml(text) — EN ESTE ORDEN:
//   1. Escape HTML (& < >)  ← SIEMPRE primero (defensa XSS base)
//   2. Tablas markdown      (| col | col | + fila separadora ---)
//   3. Blockquotes          (> texto → cita legal serif con borde cyan)
//   4. Headers ## y ###     (divs jerárquicos)
//   5. Listas numeradas/bullets (anidado simple: indentación 2+ espacios → ml extra)
//   6. Chips de citas legales ([Art. N CP], [Fuente: SPIJ], (D.S. XXX-XX), Ley N° XXXXX, TUO…)
//   7. Inline: code `x`, bold **x**, italic *x*
//   8. --- → <hr>
//   9. \n\n → párrafos (div.mb-2), \n simple → <br/>
//
// Seguridad:
//   - El escape ocurre ANTES de cualquier inserción de tags propios.
//   - Los spans de código se protegen con placeholders para que
//     bold/italic/chips no reescriban su contenido.
//   - La salida pasa por DOMPurify en el componente (ver sanitizeLegalHtml).
//
// Nota Tailwind: TODAS las clases van como literales completos en este archivo
// para que el scanner JIT de Tailwind 4 las extraiga (nada de clases dinámicas).

import { memo } from 'react';
import DOMPurify from 'dompurify';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de estilo (literales completos → JIT-safe)
// ─────────────────────────────────────────────────────────────────────────────

const CHIP_CLASS =
  'inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] font-medium align-middle';
const CODE_CLASS = 'bg-slate-800 rounded px-1 font-mono text-[12px]';
const H2_CLASS = 'text-cyan-300 font-bold text-sm mt-3 mb-1';
const H3_CLASS = 'text-cyan-200 font-semibold text-[13px] mt-2 mb-1';
const BLOCKQUOTE_CLASS =
  'border-l-2 border-cyan-400/50 pl-3 my-2 italic text-slate-300 font-serif';
const HR_CLASS = 'border-white/10 my-3';
const TABLE_CLASS = 'w-full text-xs border-collapse my-2';
const THEAD_ROW_CLASS = 'bg-slate-800/60';
const TH_CLASS =
  'px-2 py-1.5 text-left text-cyan-300 font-semibold border-b border-white/10';
const TD_CLASS = 'px-2 py-1.5 text-slate-200 border-b border-white/5 hover:bg-white/5';
const P_CLASS = 'mb-2';
const LI_BASE_CLASS = 'text-slate-300 my-0.5 leading-relaxed list-none';
// Nivel de anidamiento (indentación / 2) → margen izquierdo adicional.
const LIST_INDENT = ['ml-1', 'ml-4', 'ml-7', 'ml-10'];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

/** 1. Escape HTML — primera pasada, antes de insertar cualquier tag propio. */
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Fila de tabla " | a | b | " → ['a','b']. */
function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/** Línea separadora de tabla: solo |, -, :, espacios. */
function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{2,}.*\|/.test(line) && /^[\s|:-]+$/.test(line.trim());
}

/**
 * 6. Chips de citas legales — patrones peruanos frecuentes:
 *    [Art. 108 CP] · [Artículo 1490 CPC] · [Fuente: SPIJ]
 *    (D.S. 004-2019-JUS) · (D.Leg. 1049) · Ley N° 27444 · TUO
 */
function applyCitationChips(text) {
  let t = text;
  // Corchetes: [Art. …], [Artículo …], [Fuente: …]
  t = t.replace(
    /\[((?:Art(?:\.|ículo)?\s+[^\]]+)|(?:Fuente:[^\]]+))\]/gi,
    `<span class="${CHIP_CLASS}">$1</span>`,
  );
  // Paréntesis de normas: (D.S. …), (D.Leg. …), (R.M. …)
  t = t.replace(
    /\(\s*((?:D\.S\.|D\.Leg\.|D\.Urg\.|R\.M\.)\s*[A-Z0-9][^)]*)\)/gi,
    `<span class="${CHIP_CLASS}">$1</span>`,
  );
  // Ley N° 27444 / Decreto Legislativo N° 1412 (con o sin espacio en N°)
  t = t.replace(
    /\b((?:Ley|Decreto Supremo|Decreto Legislativo)\s*N[°ºo]?\s*[\d][\d.,\-–]*)/gi,
    `<span class="${CHIP_CLASS}">$1</span>`,
  );
  // TUO standalone (Texto Único Ordenado)
  t = t.replace(/\b(TUO)\b/g, `<span class="${CHIP_CLASS}">$1</span>`);
  return t;
}

/** 7. Inline: code (protegido), bold, italic, chips. */
function formatInlineMd(text) {
  const codes = [];
  let t = text;

  // Code primero, protegido con placeholder para no ser tocado después.
  t = t.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code class="${CODE_CLASS}">${c}</code>`);
    return `\u0000C${codes.length - 1}\u0000`;
  });

  // Bold **x** antes que italic *x*.
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong class="text-cyan-200 font-semibold">$1</strong>');
  // Italic *x* (sin cruzar asteriscos dobles).
  t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');

  // Chips al final del inline para no re-procesar su HTML interno.
  t = applyCitationChips(t);

  // Restaurar código.
  t = t.replace(/\u0000C(\d+)\u0000/g, (_, i) => codes[Number(i)]);
  return t;
}

/** Nivel de anidamiento de lista según indentación (2+ espacios por nivel). */
function listIndentClass(leadingSpaces) {
  const level = Math.min(3, Math.floor(leadingSpaces / 2));
  return LIST_INDENT[level];
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser de bloques (línea a línea)
// ─────────────────────────────────────────────────────────────────────────────

export function mdToHtml(input) {
  if (!input) return '';
  const lines = escapeHtml(String(input)).split('\n');
  const out = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── 8. HR: --- (fuera de tablas) ──
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push(`<hr class="${HR_CLASS}"/>`);
      i += 1;
      continue;
    }

    // ── 2. Tabla markdown ──
    if (
      trimmed.startsWith('|') &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const headers = splitTableRow(line);
      i += 2; // saltar header + separador
      const bodyRows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        bodyRows.push(splitTableRow(lines[i]));
        i += 1;
      }
      const thead = `<thead><tr class="${THEAD_ROW_CLASS}">${headers
        .map((h) => `<th class="${TH_CLASS}">${formatInlineMd(h)}</th>`)
        .join('')}</tr></thead>`;
      const tbody = `<tbody>${bodyRows
        .map(
          (row) =>
            `<tr>${row
              .map((c) => `<td class="${TD_CLASS}">${formatInlineMd(c)}</td>`)
              .join('')}</tr>`,
        )
        .join('')}</tbody>`;
      out.push(`<table class="${TABLE_CLASS}">${thead}${tbody}</table>`);
      continue;
    }

    // ── 3. Blockquote (> tras escape es &gt;) ──
    if (/^\s*&gt;/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^\s*&gt;/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*&gt;\s?/, ''));
        i += 1;
      }
      out.push(
        `<blockquote class="${BLOCKQUOTE_CLASS}">${quoteLines
          .map((l) => formatInlineMd(l))
          .join('<br/>')}</blockquote>`,
      );
      continue;
    }

    // ── 4. Headers ## y ### ──
    const h2 = line.match(/^\s*##\s+(.+)$/);
    if (h2) {
      out.push(`<div class="${H2_CLASS}">${formatInlineMd(h2[1])}</div>`);
      i += 1;
      continue;
    }
    const h3 = line.match(/^\s*###\s+(.+)$/);
    if (h3) {
      out.push(`<div class="${H3_CLASS}">${formatInlineMd(h3[1])}</div>`);
      i += 1;
      continue;
    }

    // ── 5. Listas (bullets • y numeradas), anidadas por indentación ──
    const asList = line.match(/^(\s*)([-*•]|\d+[.)])\s+(.*)$/);
    if (asList) {
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*•]|\d+[.)])\s+(.*)$/);
        if (!m) break;
        const [, indent, marker, content] = m;
        const isOrdered = /\d/.test(marker);
        const bullet =
          isOrdered === false
            ? '<span class="text-cyan-400 mr-1.5 select-none">•</span>'
            : `<span class="text-cyan-400 font-semibold mr-1.5 select-none">${marker}</span>`;
        items.push(
          `<li class="${LI_BASE_CLASS} ${listIndentClass(indent.length)}">${bullet}${formatInlineMd(content)}</li>`,
        );
        i += 1;
      }
      out.push(`<ul class="my-1">${items.join('')}</ul>`);
      continue;
    }

    // ── Línea vacía: separador de párrafos ──
    if (trimmed === '') {
      i += 1;
      continue;
    }

    // ── 9. Párrafo: líneas consecutivas → un div, \n interno → <br/> ──
    const paraLines = [];
    while (i < lines.length) {
      const cur = lines[i];
      const curTrimmed = cur.trim();
      if (
        curTrimmed === '' ||
        curTrimmed.startsWith('|') ||
        /^\s*&gt;/.test(cur) ||
        /^\s*(#{2,3})\s+/.test(cur) ||
        /^\s*(-{3,}|\*{3,})\s*$/.test(cur) ||
        /^(\s*)([-*•]|\d+[.)])\s+/.test(cur)
      ) {
        break;
      }
      paraLines.push(cur);
      i += 1;
    }
    if (paraLines.length > 0) {
      out.push(
        `<div class="${P_CLASS}">${paraLines.map((l) => formatInlineMd(l)).join('<br/>')}</div>`,
      );
    }
  }

  return out.join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Sanitización centralizada (reutilizable)
// ─────────────────────────────────────────────────────────────────────────────

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'strong', 'em', 'br', 'span', 'div', 'p',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'blockquote', 'hr', 'ul', 'ol', 'li', 'code',
  ],
  ALLOWED_ATTR: ['class'],
};

/** Escapa + parsea + sanitiza. Exportada para reuso fuera del componente. */
export function sanitizeLegalHtml(text) {
  return DOMPurify.sanitize(mdToHtml(text), SANITIZE_CONFIG);
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renderiza markdown legal completo a HTML sanitizado.
 *
 * @param {{ text: string, className?: string }} props
 */
function LegalMarkdownImpl({ text, className = '' }) {
  return (
    <div
      className={`chat-ai-content text-sm leading-relaxed text-slate-200 ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizeLegalHtml(text) }}
    />
  );
}

const LegalMarkdown = memo(LegalMarkdownImpl);
LegalMarkdown.displayName = 'LegalMarkdown';

export default LegalMarkdown;
