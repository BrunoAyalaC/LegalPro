#!/usr/bin/env node
// tools/verifiers/verifier-quota.mjs
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
let errs = 0;
console.log('=== Verifier: Quota / Plan Limits ===\n');
const checks = [
  { id: 'QUOTA-01', file: 'legalpro-app/server/middleware/quotaMiddleware.js', pattern: 'limiteDiario|costoTotalHoy|QUOTA_EXCEEDED', name: 'Middleware de cuota' },
  { id: 'QUOTA-02', file: 'LegalProBackend_Net/LegalPro.Application/Common/Behaviours/PlanLimitsBehavior.cs', pattern: 'VerificarLimites|PlanLimit', name: 'PlanLimitsBehavior .NET' },
  { id: 'QUOTA-03', file: 'catalogs/role-tools.json', pattern: 'max_consultas_ia_mes|max_expedientes|max_usuarios', name: 'Limites en catalogo' }
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
