// legalpro-app/src/utils/feriadosPeru.js
// Fuente ÚNICA de feriados peruanos para el frontend (cliente).
//
// IMPORTANTE: este módulo es la contraparte cliente de
// `legalpro-app/server/utils/feriados.js`, que es la fuente autoritativa
// del backend. Ambos módulos leen del mismo catálogo canónico:
//   `catalogs/feriados-peru.json`
//
// Por construcción el backend ya valida el cálculo real con
// `sumarDiasHabiles()` y entrega la `fecha_limite` definitiva vía
// `GET /api/plazos/vencimientos` — el frontend SOLO usa esta lista para:
//   1) Colorear celdas del grid mensual (hábil / inhábil / feriado)
//   2) Mostrar el nombre del feriado en tooltip
//
// NO se usa para calcular vencimientos en el cliente: ya vienen del backend.
//
// Si añades/modificas un feriado, actualiza AMBOS lugares:
//   - `catalogs/feriados-peru.json`       (canónico)
//   - `legalpro-app/server/utils/feriados.js` (backend)
//   - `legalpro-app/src/utils/feriadosPeru.js` (frontend — este archivo)
//
// Feriados móviles (Semana Santa) NO se incluyen como fechas fijas porque
// dependen del cálculo de Pascua (algoritmo de Gauss). El frontend los
// ignora en el grid — el backend ya los considera en `sumarDiasHabiles`.

/**
 * @typedef {Object} Feriado
 * @property {string} mmdd  Fecha en formato "MM-DD" (se completa con el año en runtime)
 * @property {string} nombre Nombre legible del feriado
 * @property {'nacional'|'regional_lima'|'religioso'} tipo
 */

/** @type {Feriado[]} Feriados fijos sincronizados con catalogs/feriados-peru.json */
export const FERIADOS_FIJOS = [
  { mmdd: '01-01', nombre: 'Año Nuevo',                                 tipo: 'nacional' },
  { mmdd: '05-01', nombre: 'Día del Trabajo',                            tipo: 'nacional' },
  { mmdd: '06-29', nombre: 'San Pedro y San Pablo',                      tipo: 'nacional' },
  { mmdd: '07-28', nombre: 'Fiestas Patrias (Independencia)',            tipo: 'nacional' },
  { mmdd: '07-29', nombre: 'Fiestas Patrias',                            tipo: 'nacional' },
  { mmdd: '08-06', nombre: 'Batalla de Junín',                           tipo: 'nacional' },
  { mmdd: '08-30', nombre: 'Santa Rosa de Lima',                         tipo: 'regional_lima' },
  { mmdd: '10-08', nombre: 'Combate de Angamos',                         tipo: 'nacional' },
  { mmdd: '11-01', nombre: 'Día de Todos los Santos',                    tipo: 'nacional' },
  { mmdd: '12-08', nombre: 'Inmaculada Concepción',                      tipo: 'nacional' },
  { mmdd: '12-09', nombre: 'Batalla de Ayacucho',                        tipo: 'nacional' },
  { mmdd: '12-25', nombre: 'Navidad',                                    tipo: 'nacional' },
];

/**
 * Devuelve un Set de fechas en formato YYYY-MM-DD para un año concreto.
 * @param {number} year
 * @returns {Set<string>}
 */
export function getFeriadosDelAnio(year) {
  const set = new Set();
  for (const f of FERIADOS_FIJOS) {
    set.add(`${year}-${f.mmdd}`);
  }
  return set;
}

/**
 * Busca el nombre de un feriado para una fecha YYYY-MM-DD concreta.
 * Si no es feriado, devuelve null.
 * @param {string} fechaStr YYYY-MM-DD
 * @returns {string|null}
 */
export function getNombreFeriado(fechaStr) {
  if (!fechaStr || typeof fechaStr !== 'string' || fechaStr.length < 10) return null;
  const mmdd = fechaStr.slice(5, 10);
  const found = FERIADOS_FIJOS.find(f => f.mmdd === mmdd);
  return found ? found.nombre : null;
}

/**
 * Determina si una fecha es día hábil en Perú.
 * Regla: lunes a viernes que no sea feriado.
 * @param {string} fechaStr YYYY-MM-DD
 * @returns {boolean}
 */
export function esDiaHabil(fechaStr) {
  if (!fechaStr) return false;
  const d = new Date(fechaStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return false;
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false; // sábado/domingo
  const feriados = getFeriadosDelAnio(d.getFullYear());
  return !feriados.has(fechaStr);
}
