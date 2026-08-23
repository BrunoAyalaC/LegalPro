// Lee catalogs/feriados-peru.json y expone funciones para calcular plazos procesales
// considerando solo días hábiles (lunes a viernes, excluyendo feriados)
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// FIX 2026-08-07: el catálogo vive en la RAÍZ del repo (catalogs/), no dentro de
// legalpro-app/catalogs. Desde server/utils se necesitan 3 niveles: server/utils → ../../../catalogs.
const CATALOG_PATH = join(__dirname, '../../../catalogs/feriados-peru.json');

let cache = null;

function loadCatalog() {
  if (!cache) {
    cache = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
  }
  return cache;
}

// FIX TZ: toISOString serializa en UTC; con fechas a medianoche local (UTC-5)
// retrocede un día y desalinea feriados móviles (Jueves/Viernes Santo).
function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Calcula la Pascua cristiana para un año (algoritmo de Gauss)
 */
function calcularPascua(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const month = Math.floor((h + L - 7 * m + 114) / 31);
  const day = ((h + L - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Devuelve el Set de feriados de un año en formato YYYY-MM-DD
 */
function getFeriadosDelAnio(year) {
  const catalog = loadCatalog();
  const feriados = new Set();

  // Fijos
  for (const f of catalog.feriados_fijos) {
    feriados.add(`${year}-${f.fecha}`);
  }

  // Móviles: Semana Santa (Jueves Santo y Viernes Santo)
  const pascua = calcularPascua(year);
  const juevesSanto = new Date(pascua);
  juevesSanto.setDate(juevesSanto.getDate() - 3);
  const viernesSanto = new Date(pascua);
  viernesSanto.setDate(viernesSanto.getDate() - 2);
  feriados.add(formatDate(juevesSanto));
  feriados.add(formatDate(viernesSanto));

  return feriados;
}

/**
 * Determina si una fecha es día hábil en Perú
 */
export function esDiaHabil(fechaStr, year = null) {
  const d = new Date(fechaStr + 'T00:00:00');
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false; // sábado/domingo

  const y = year || d.getFullYear();
  const feriados = getFeriadosDelAnio(y);
  return !feriados.has(formatDate(d));
}

/**
 * Suma N días hábiles a una fecha
 * Si el resultado cae en día inhábil, lo prorroga al siguiente hábil
 */
export function sumarDiasHabiles(fechaInicio, n) {
  const inicio = new Date(fechaInicio + 'T00:00:00');
  const cursor = new Date(inicio);
  let contador = 0;

  while (contador < n) {
    cursor.setDate(cursor.getDate() + 1);
    const cursorStr = formatDate(cursor);
    if (esDiaHabil(cursorStr)) contador++;
  }

  // Prórroga si último día es inhábil
  let finalStr = formatDate(cursor);
  let safety = 0;
  while (!esDiaHabil(finalStr) && safety < 30) {
    cursor.setDate(cursor.getDate() + 1);
    finalStr = formatDate(cursor);
    safety++;
  }

  return finalStr;
}

export function getDiasNoHabilesDelAnio(year) {
  const feriados = getFeriadosDelAnio(year);
  const result = [];
  for (const f of feriados) {
    result.push({
      fecha: f,
      motivo: 'feriado',
    });
  }
  return result;
}