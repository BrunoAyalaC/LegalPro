#!/usr/bin/env node
// tools/verifiers/verifier-firma-digital.mjs
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
let errs = 0;
console.log('=== Verifier: Firma Digital (Ley 27269) ===\n');
const checks = [
  { id: 'FD-01', file: 'catalogs/supabase-schema.md', pattern: 'firma_digital_id|FIRMA_DIGITAL', name: 'Columna firma_digital_id' },
  { id: 'FD-02', file: 'catalogs/supabase-schema.md', pattern: 'hash_sha256|SHA.256', name: 'Hash SHA-256' },
  { id: 'FD-03', file: 'catalogs/supabase-schema.md', pattern: 'timestamp_autoridad_tiempo|TSA', name: 'TSA timestamp' },
  { id: 'FD-04', file: 'catalogs/codigos-leyes.json', pattern: 'firma-digital.*27269|Ley 27269', name: 'Ley 27269 en catalogo' },
  { id: 'FD-05', file: 'catalogs/audit-events.json', pattern: 'FIRMA_DIGITAL_GENERATED', name: 'Audit event firma' }
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
