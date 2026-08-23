#!/usr/bin/env node
// tools/verifiers/verifier-rbac.mjs
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
let errs = 0, warns = 0;
console.log('=== Verifier: RBAC ===\n');
const checks = [
  { id: 'RBAC-01', name: 'requireRole en Node', file: 'legalpro-app/server/middleware/authMiddleware.js', pattern: 'function requireRole' },
  { id: 'RBAC-02', name: 'OWNER/ADMIN/MEMBER/VIEWER', file: 'legalpro-app/server/middleware/authMiddleware.js', pattern: 'requireRole|rol_org|allowedRoles' },
  { id: 'RBAC-03', name: '401 sin auth', file: 'legalpro-app/server/middleware/authMiddleware.js', pattern: 'status\\(401\\)' },
  { id: 'RBAC-04', name: '403 sin permisos', file: 'legalpro-app/server/middleware/authMiddleware.js', pattern: 'status\\(403\\)' },
  { id: 'RBAC-05', name: 'Authorize en .NET', file: 'LegalProBackend_Net/LegalPro.Api/Controllers/AuthController.cs', pattern: '\\[Authorize\\]' }
];
for (const c of checks) {
  const p = resolve(ROOT, c.file);
  if (!existsSync(p)) { console.error(`FAIL: [${c.id}] file not found`); errs++; continue; }
  const content = readFileSync(p, 'utf8');
  if (content.match(new RegExp(c.pattern))) console.log(`OK: [${c.id}] ${c.name}`);
  else { console.error(`FAIL: [${c.id}] ${c.name}`); errs++; }
}
console.log(`\nErrores: ${errs}, Warnings: ${warns}`);
process.exit(errs > 0 ? 1 : 0);
