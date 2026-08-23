#!/usr/bin/env node
// tools/verifiers/verifier-transferencia-internacional.mjs
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
let errs = 0;
console.log('=== Verifier: Transferencia Internacional (LPDP Art. 21) ===\n');
const checks = [
  { id: 'TI-01', file: 'catalogs/gemini-functions.json', pattern: 'consentimiento_internacional|consentimiento_transferencia', name: 'FC con flag consentimiento' },
  { id: 'TI-02', file: 'legalpro-app/server/initDb.js', pattern: 'acepta_transferencia_internacional', name: 'Columna consentimiento' },
  { id: 'TI-03', file: 'catalogs/disclaimers-ia.json', pattern: 'disclaimer_transferencia_internacional|Art. 21 LPDP', name: 'Disclaimer transfer internacional' },
  { id: 'TI-04', file: 'catalogs/audit-events.json', pattern: 'TRANSFERENCIA_INTERNACIONAL', name: 'Audit event transferencia' },
  { id: 'TI-05', file: 'docs/TRANSFERENCIA_INTERNACIONAL.md', pattern: 'Google|consentimiento', name: 'Doc de transferencia' }
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
