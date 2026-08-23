// ─── Validador de citas legales en RUNTIME (anti-alucinación) ────────────────
// Cuando la IA genera una respuesta con citas ("Artículo 149 del Código Penal",
// "Ley 30077", "D.Leg. 1249"), cada cita se valida contra catalogs/codigos-leyes.json
// ANTES de devolverla al usuario. Citas no verificables → se MARCAN (estado +
// aviso_degradacion_citas), NUNCA bloquean el flujo (best-effort).
//
// Estados por cita:
//  - 'verificada'                          → norma existe Y artículo está en articulos_mas_citados
//                                            (o cita de ley/dispositivo completo encontrada)
//  - 'norma_existe_articulo_desconocido'   → norma existe pero el artículo no figura en el catálogo
//  - 'no_encontrada'                       → ni la norma existe en el catálogo
//
// Catálogo: 258 normas (id/nombre/numero/articulos_mas_citados). Se carga UNA vez
// en memoria (module-level cache). Fuente oficial: https://spij.minjus.gob.pe
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// El catálogo vive en la RAÍZ del repo (catalogs/), no dentro de legalpro-app.
// Desde server/utils se necesitan 3 niveles: ../../../catalogs (patrón feriados.js).
const CATALOG_PATH = join(__dirname, '../../../catalogs/codigos-leyes.json');

// ─── Cache module-level del catálogo (carga única) ───────────────────────────
let _catalogo = null;
function getCatalogo() {
  if (_catalogo) return _catalogo;
  try {
    _catalogo = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
  } catch {
    // Fail-open: catálogo ausente/corrupto → sin normas conocidas. Las citas
    // saldrán 'no_encontrada' pero el flujo NUNCA se bloquea.
    _catalogo = { normas: [] };
  }
  return _catalogo;
}

// ─── Normalización de texto (tildes, mayúsculas, espacios) ───────────────────
export function quitarTildes(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizarNombre(s) {
  return quitarTildes(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokensDe(s) {
  return normalizarNombre(s).split(/[^a-z0-9]+/).filter(t => t.length > 2);
}

/**
 * Fuzzy-match determinista entre dos nombres de norma (0..1).
 * - 1.0 si idénticos tras normalizar tildes/mayúsculas
 * - 0.9 si uno contiene al otro (ambos > 5 chars)
 * - cobertura de tokens SIMÉTRICA: comunes/max(tokens), con ≥2 comunes.
 *   Se divide por MAX (no min) para que "Código Procesal Penal" NO puntúe
 *   1.0 contra "Código Penal" (tokens del corto contenidos en el largo) —
 *   ese sesgo verificaba citas contra códigos parecidos equivocados.
 */
function similitudNombres(a, b) {
  const na = normalizarNombre(a);
  const nb = normalizarNombre(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.length > 5 && nb.length > 5 && (nb.includes(na) || na.includes(nb))) {
    return 0.9;
  }
  const ta = new Set(tokensDe(a));
  const tb = new Set(tokensDe(b));
  if (!ta.size || !tb.size) return 0;
  let comunes = 0;
  for (const t of ta) if (tb.has(t)) comunes++;
  if (comunes < 2) return 0; // 1 token suelto no basta (evita falsos positivos "Código X")
  return comunes / Math.max(ta.size, tb.size);
}

// Umbral alto a propósito: en un validador ANTI-alucinación es preferible marcar
// una cita como sospechosa (falso positivo) antes que verificarla por error
// contra una norma parecida (falso 'verificada').
const UMBRAL_MATCH_NORMA = 0.75;

/** Escape para armar regex de búsqueda por número de dispositivo */
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Busca una norma en el catálogo:
 * 1. Por número de dispositivo/ley ("30077", "1249", "011-2024-JUS") contra los
 *    campos `numero` y `nombre` (los nombres traen "(Ley 29733)" embebido).
 * 2. Por fuzzy-match del nombre normalizado (tildes-insensible).
 * @returns {object|null} norma del catálogo o null
 */
function buscarNorma({ tipo, numero, norma }) {
  const normas = getCatalogo().normas || [];

  // 1) Match por número (ley N° XXXXX / dispositivo D.Leg/D.S/TUO)
  if (numero && (tipo === 'ley' || tipo === 'dispositivo')) {
    const reNum = new RegExp(`(?<![\\w-])${escapeRegex(numero)}(?![\\w-])`);
    const porNumero = normas.find(n =>
      reNum.test(String(n.numero ?? '')) || reNum.test(String(n.nombre ?? ''))
    );
    if (porNumero) return porNumero;
  }

  // 2) Fuzzy-match por nombre (para citas tipo "Artículo X del <norma>")
  if (norma) {
    let mejor = null;
    let mejorScore = 0;
    for (const n of normas) {
      const score = similitudNombres(norma, n.nombre);
      if (score > mejorScore) {
        mejor = n;
        mejorScore = score;
      }
    }
    if (mejor && mejorScore >= UMBRAL_MATCH_NORMA) return mejor;
  }

  return null;
}

/**
 * Verifica si un artículo citado figura en articulos_mas_citados de la norma.
 * Acepta variantes: "185-A" ≈ "185", "139.16" exacto.
 */
function articuloConocido(norma, numeroArticulo) {
  const arts = norma?.articulos_mas_citados;
  if (!Array.isArray(arts) || arts.length === 0) return false;
  const num = String(numeroArticulo ?? '').trim();
  if (arts.includes(num)) return true;
  // Variante: quitar sufijo -X o letra final ("21-A" → "21")
  const base = num.split('-')[0].replace(/[A-Z]$/, '');
  return Boolean(base) && base !== num && arts.includes(base);
}

// ─── 1. Extracción de citas ──────────────────────────────────────────────────
// [Aa]rt[ií]culo: la IA cita indistintamente "Artículo" y "artículo" (el resto
// del patrón mantiene el requisito de norma con mayúscula inicial).
const RE_ARTICULO = /[Aa]rt[ií]culo\s+(\d+[A-Z]?(?:-\w+)?)\s+(?:del|de la|de)\s+([A-ZÁÉÍÓÚ][^.,;)\n]{3,60})/g;
const RE_LEY = /Ley\s+N?[°º]?\s*(\d{5})/g;
const RE_DISPOSITIVO = /(D\.?Leg\.?|D\.?S\.?|TUO)\s+N?[°º]?\s*([\dA-Z-]+)/g;

/**
 * Extrae citas legales de un texto usando 3 patrones:
 *  - Artículo: "Artículo 149 del Código Penal", "artículo 2 de la Constitución..."
 *  - Ley:      "Ley 30077", "Ley N° 29733"
 *  - Dispositivo: "D.Leg. 1053", "D.S. 017-93-JUS", "TUO 18834"
 * @param {string} texto
 * @returns {Array<{tipo:'articulo'|'ley'|'dispositivo', numero:string, norma:string, match:string}>}
 */
export function extraerCitas(texto) {
  const citas = [];
  const vistos = new Set();
  const push = (tipo, numero, norma, match) => {
    const key = `${tipo}|${numero}|${normalizarNombre(norma)}`;
    if (vistos.has(key)) return;
    vistos.add(key);
    citas.push({ tipo, numero, norma: norma.trim(), match });
  };

  const src = String(texto ?? '');
  for (const m of src.matchAll(RE_ARTICULO)) push('articulo', m[1], m[2], m[0]);
  for (const m of src.matchAll(RE_LEY)) push('ley', m[1], m[0], m[0]);
  for (const m of src.matchAll(RE_DISPOSITIVO)) push('dispositivo', m[2], m[0], m[0]);

  return citas;
}

// ─── 2. Validación de citas contra el catálogo ───────────────────────────────
/**
 * Valida cada cita contra codigos-leyes.json (cacheado en memoria).
 * @param {Array} citas salida de extraerCitas()
 * @returns {Promise<Array<{...cita, estado:'verificada'|'norma_existe_articulo_desconocido'|'no_encontrada', norma_id?:string}>>}
 */
export async function validarCitas(citas) {
  const lista = Array.isArray(citas) ? citas : [];
  return lista.map((cita) => {
    try {
      const norma = buscarNorma(cita);
      if (!norma) return { ...cita, estado: 'no_encontrada' };
      if (cita.tipo === 'articulo') {
        return articuloConocido(norma, cita.numero)
          ? { ...cita, estado: 'verificada', norma_id: norma.id }
          : { ...cita, estado: 'norma_existe_articulo_desconocido', norma_id: norma.id };
      }
      // Cita de ley/dispositivo completo: basta con que la norma exista.
      return { ...cita, estado: 'verificada', norma_id: norma.id };
    } catch {
      // Best-effort: cualquier error de matching marca la cita como sospechosa
      // sin propagar la excepción (nunca romper el flujo de respuesta).
      return { ...cita, estado: 'no_encontrada' };
    }
  });
}

// ─── 3. Validación completa de una respuesta IA ──────────────────────────────
/**
 * Combina extracción + validación y produce el resumen que consume routes/ai.js.
 * @param {string} texto respuesta IA final
 * @returns {Promise<{texto:string, citas_total:number, verificadas:number,
 *                     sospechosas:Array, ratio_verificacion:number}>}
 */
export async function validarRespuestaIA(texto) {
  const base = {
    texto,
    citas_total: 0,
    verificadas: 0,
    sospechosas: [],
    ratio_verificacion: 1, // sin citas no hay nada sospechoso
  };
  if (!texto || typeof texto !== 'string') return base;

  try {
    const citas = await validarCitas(extraerCitas(texto));
    const verificadas = citas.filter(c => c.estado === 'verificada');
    const sospechosas = citas
      .filter(c => c.estado !== 'verificada')
      .map(({ tipo, numero, norma, estado }) => ({ tipo, numero, norma, estado }));
    return {
      texto,
      citas_total: citas.length,
      verificadas: verificadas.length,
      sospechosas,
      ratio_verificacion: citas.length === 0
        ? 1
        : Math.round((verificadas.length / citas.length) * 100) / 100,
    };
  } catch {
    // Fail-open total: si la validación explota, devolvemos el texto intacto
    // sin métricas (el endpoint nunca debe bloquearse por el validador).
    return base;
  }
}
