#!/usr/bin/env node
// tools/verifiers/verifier-arco.mjs
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
let errs = 0;
console.log('=== Verifier: ARCO (LPDP) ===\n');
const checks = [
  { id: 'ARCO-01', file: 'legalpro-app/server/routes/datos-personales.js', pattern: 'router\\.(get|put|delete)', name: 'Rutas datos-personales' },
  { id: 'ARCO-02', file: 'legalpro-app/server/routes/datos-personales.js', pattern: 'exportar|export', name: 'Endpoint exportar datos' },
  { id: 'ARCO-03', file: 'legalpro-app/server/routes/datos-personales.js', pattern: 'rectificar|update|put', name: 'Endpoint rectificar' },
  { id: 'ARCO-04', file: 'legalpro-app/server/routes/datos-personales.js', pattern: 'eliminar|delete|cancelar', name: 'Endpoint cancelar' },
  { id: 'ARCO-05', file: 'catalogs/audit-events.json', pattern: 'ARCO_REQUEST', name: 'Audit event ARCO' }
];
for (const c of checks) {
  const p = resolve(ROOT, c.file);
  if (!existsSync(p)) { console.error(`FAIL: [${c.id}] file not found: ${c.file}`); errs++; continue; }
  const content = readFileSync(p, 'utf8');
  if (content.match(new RegExp(c.pattern, 'i'))) console.log(`OK: [${c.id}] ${c.name}`);
  else { console.error(`FAIL: [${c.id}] ${c.name}`); errs++; }
}
console.log(`\nErrores: ${errs}`);
process.exit(errs > 0 ? 1 : 0);
