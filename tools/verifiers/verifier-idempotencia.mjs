#!/usr/bin/env node
// tools/verifiers/verifier-idempotencia.mjs
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
let errs = 0;
console.log('=== Verifier: Idempotencia ===\n');
const checks = [
  { id: 'IDEM-01', file: 'legalpro-app/server/middleware/idempotencyMiddleware.js', pattern: 'Idempotency-Key', name: 'Header Idempotency-Key' },
  { id: 'IDEM-02', file: 'legalpro-app/server/middleware/idempotencyMiddleware.js', pattern: 'cache|store|Map', name: 'Cache/store' },
  { id: 'IDEM-03', file: 'legalpro-app/server/middleware/idempotencyMiddleware.js', pattern: 'ttl|expir|3600', name: 'TTL/expiracion' }
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
