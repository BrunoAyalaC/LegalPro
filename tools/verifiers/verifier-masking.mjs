#!/usr/bin/env node
// tools/verifiers/verifier-masking.mjs
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
let errs = 0;
console.log('=== Verifier: Masking PII en Logs ===\n');
const checks = [
  { id: 'MASK-01', file: 'LegalProBackend_Net/LegalPro.Api/Middleware/MaskingTextFormatter.cs', pattern: 'mask|Mask|REDACT', name: 'MaskingTextFormatter .NET' },
  { id: 'MASK-02', file: 'legalpro-app/server/logger.js', pattern: 'mask|Mask|redact|hide', name: 'Logger.js Node' },
  { id: 'MASK-03', file: 'legalpro-app/server/middleware/promptSanitizer.js', pattern: 'envolverContenidoUsuario|sanitize', name: 'PromptSanitizer' },
  { id: 'MASK-04', file: 'catalogs/audit-events.json', pattern: 'pii_masking|masking', name: 'PII masking en audit events' }
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
