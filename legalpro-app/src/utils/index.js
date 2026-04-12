/* ═══════════════════════════════════════════════════════════
   UTILS — LegalPro
   Helpers puros sin side effects
═══════════════════════════════════════════════════════════ */

/* ── Fechas ─────────────────────────────────────────────── */

const MONTHS = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
];

/**
 * Formatea una fecha como "15 de marzo de 2026"
 * @param {string|Date} date
 */
export function formatDate(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d)) return '—';
  return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}

/**
 * Formatea fecha corta: "15/03/2026"
 */
export function formatDateShort(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('es-PE');
}

/**
 * Tiempo relativo: "hace 3 horas", "hace 2 días"
 */
export function timeAgo(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diff = now - d; // ms

  const s  = Math.floor(diff / 1000);
  const m  = Math.floor(s / 60);
  const h  = Math.floor(m / 60);
  const days = Math.floor(h / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (s < 60)      return 'hace un momento';
  if (m < 60)      return `hace ${m} min`;
  if (h < 24)      return `hace ${h} h`;
  if (days === 1)  return 'ayer';
  if (days < 7)    return `hace ${days} días`;
  if (weeks === 1) return 'hace 1 semana';
  if (weeks < 4)   return `hace ${weeks} semanas`;
  if (months === 1) return 'hace 1 mes';
  return `hace ${months} meses`;
}

/**
 * Countdown hacia una fecha futura: "en 2 días", "vence hoy", "vencido"
 */
export function countdownTo(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diff = d - now; // ms
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0)   return { label: 'Vencido', urgency: 'danger' };
  if (days === 0) return { label: 'Vence hoy', urgency: 'danger' };
  if (days === 1) return { label: 'Vence mañana', urgency: 'warning' };
  if (days <= 3)  return { label: `En ${days} días`, urgency: 'warning' };
  if (days <= 7)  return { label: `En ${days} días`, urgency: 'info' };
  return { label: `En ${days} días`, urgency: 'success' };
}

/* ── Expedientes ────────────────────────────────────────── */

/**
 * Formatea número de expediente peruano
 * Ej: "00147-2024-0-1801-JR-CI-01" → "00147-2024"
 */
export function formatExpNum(num) {
  if (!num) return '—';
  const parts = String(num).split('-');
  if (parts.length >= 2) return `${parts[0]}-${parts[1]}`;
  return num;
}

/**
 * Genera un número de expediente de demo
 */
export function genExpNum(year = new Date().getFullYear()) {
  const seq = String(Math.floor(Math.random() * 9999)).padStart(5, '0');
  const juzgado = String(Math.floor(Math.random() * 20)).padStart(2, '0');
  return `${seq}-${year}-0-1801-JR-CI-${juzgado}`;
}

/* ── Texto ──────────────────────────────────────────────── */

/**
 * Trunca un string con elipsis
 */
export function truncate(str, maxLen = 80) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen).trimEnd() + '…' : str;
}

/**
 * Capitaliza primera letra
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convierte "NOMBRE_COMPLETO" → "Nombre Completo"
 */
export function titleCase(str) {
  if (!str) return '';
  return str
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Resalta coincidencias de búsqueda en un texto
 * Devuelve partes: [{ text, highlight }]
 */
export function highlightMatches(text, query) {
  if (!query || !text) return [{ text: text ?? '', highlight: false }];
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map(part => ({
    text: part,
    highlight: regex.test(part),
  }));
}

/* ── Números ────────────────────────────────────────────── */

/**
 * Formatea moneda PEN
 */
export function formatPEN(amount) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formatea número con separadores peruanos
 */
export function formatNumber(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('es-PE').format(n);
}

/* ── DOM / UI ───────────────────────────────────────────── */

/**
 * Genera un id único simple
 */
export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Copia texto al portapapeles con feedback
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Descarga un string como archivo
 */
export function downloadText(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Array helpers ──────────────────────────────────────── */

/**
 * Agrupa un array por clave
 */
export function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] ??= []).push(item);
    return acc;
  }, {});
}

/**
 * Elimina duplicados por clave
 */
export function uniqueBy(arr, keyFn) {
  const seen = new Set();
  return arr.filter(item => {
    const k = keyFn(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ── Validaciones ───────────────────────────────────────── */

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidCAL(cal) {
  // CAL Perú: 5-6 dígitos
  return /^\d{5,6}$/.test(String(cal).trim());
}
