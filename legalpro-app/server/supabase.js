/**
 * supabase.js — Shim de compatibilidad (DEPRECADO)
 * Las rutas del servidor ahora usan server/db.js (pg Pool Railway).
 * Este módulo se mantiene únicamente para que los mocks de tests
 * (vi.mock('../supabase.js')) sigan funcionando sin cambios.
 *
 * NO usar este módulo en código nuevo — importar '../db.js' directamente.
 */

console.warn(
  '[supabase] Este módulo está deprecado. ' +
  'Las rutas ya usan pg Pool (server/db.js). ' +
  'Si ves este mensaje en producción, hay un import desactualizado.'
);

// Exporta un objeto nulo para que los old imports no rompan al arrancar
export const supabaseAdmin = null;
export function createUserClient() {
  throw new Error('supabase.js está deprecado. Usar server/db.js.');
}
export default null;

