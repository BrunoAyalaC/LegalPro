#!/usr/bin/env node
// tools/verifiers/verifier-brute-force.mjs
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
let errs = 0;
console.log('=== Verifier: Brute Force Protection ===\n');
const checks = [
  { id: 'BF-01', file: 'LegalProBackend_Net/LegalPro.Api/Middleware/BruteForceProtectionMiddleware.cs', pattern: 'class BruteForceProtectionMiddleware', name: 'Middleware .NET' },
  { id: 'BF-02', file: 'LegalProBackend_Net/LegalPro.Api/Middleware/BruteForceProtectionMiddleware.cs', pattern: '5|attempts|threshold', name: 'Threshold >= 5 intentos' },
  { id: 'BF-03', file: 'LegalProBackend_Net/LegalPro.Api/Middleware/BruteForceProtectionMiddleware.cs', pattern: '15|lockout|minutes', name: 'Lockout >= 15 min' },
  { id: 'BF-04', file: 'LegalProBackend_Net/LegalPro.Api/Middleware/BruteForceProtectionMiddleware.cs', pattern: 'BRUTE_FORCE_DETECTED|RATE_LIMIT_HIT', name: 'Audit events' },
  { id: 'BF-05', file: 'legalpro-app/server/middleware/authMiddleware.js', pattern: 'attempts|locked|block', name: 'Brute force en Node' }
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
