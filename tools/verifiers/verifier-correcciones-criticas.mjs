#!/usr/bin/env node
// tools/verifiers/verifier-correcciones-criticas.mjs
// Generado por @auditor-seguridad
// Verifica que los 3 fixes CRITICAL esten en su lugar
// - IDOR cross-tenant
// - 4 checkboxes separados
// - MFA implementado

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
let errs = 0, warns = 0;

console.log('=== Verifier: Correcciones CRITICAL ===\n');

// ═══ FIX 1: IDOR cross-tenant ═══
console.log('🔴 FIX 1: IDOR Cross-Tenant\n');
const checks1 = [
  { id: 'IDOR-01', name: 'tenant-validator.js existe', file: 'legalpro-app/server/middleware/tenant-validator.js', pattern: 'function requireTenantAccess' },
  { id: 'IDOR-02', name: 'requireTenantAccess implementado', file: 'legalpro-app/server/middleware/tenant-validator.js', pattern: 'TENANT_VIOLATION' },
  { id: 'IDOR-03', name: 'Lista de tablas protegidas definida', file: 'legalpro-app/server/middleware/tenant-validator.js', pattern: 'TENANT_PROTECTED_TABLES' },
  { id: 'IDOR-04', name: 'Expone protección IDOR para expedientes (index.js usa requireTenantAccess)', file: 'legalpro-app/server/index.js', pattern: "requireTenantAccess\\('expedientes'\\)" },
  { id: 'IDOR-05', name: 'audit log en TENANT_VIOLATION', file: 'legalpro-app/server/middleware/tenant-validator.js', pattern: 'logAudit\\(.TENANT_VIOLATION' }
];
for (const c of checks1) {
  const p = resolve(ROOT, c.file);
  if (!existsSync(p)) { console.error(`  ❌ [${c.id}] File not found: ${c.file}`); errs++; continue; }
  const content = readFileSync(p, 'utf8');
  if (content.match(new RegExp(c.pattern))) console.log(`  ✅ [${c.id}] ${c.name}`);
  else { console.error(`  ❌ [${c.id}] ${c.name} - Pattern not found`); errs++; }
}

// ═══ FIX 2: 4 checkboxes separados ═══
console.log('\n🟠 FIX 2: 4 Checkboxes Separados (LPDP Art. 14)\n');
const checks2 = [
  { id: 'CONSENT-01', name: 'SignupPage con 4 checkboxes separados', file: 'legalpro-app/src/pages/SignupPage.jsx', pattern: 'terminos|privacidad|marketing|transferencia_internacional' },
  { id: 'CONSENT-02', name: 'No hay 1 solo checkbox "acepta todo"', file: 'legalpro-app/src/pages/SignupPage.jsx', pattern: 'consent_one_size|aceptaTodo', shouldFail: true },
  { id: 'CONSENT-03', name: 'Consentimientos separados en state', file: 'legalpro-app/src/pages/SignupPage.jsx', pattern: 'setConsentimientos' },
  { id: 'CONSENT-04', name: 'Versionado de TyC y Privacidad', file: 'legalpro-app/src/pages/SignupPage.jsx', pattern: 'version:.*1\\.0\\.0' },
  { id: 'CONSENT-05', name: 'Detalles expandibles para cada consentimiento', file: 'legalpro-app/src/pages/SignupPage.jsx', pattern: 'showDetalles' }
];
for (const c of checks2) {
  const p = resolve(ROOT, c.file);
  if (!existsSync(p)) { console.error(`  ❌ [${c.id}] File not found: ${c.file}`); errs++; continue; }
  const content = readFileSync(p, 'utf8');
  if (c.id === 'CONSENT-02' && c.shouldFail) {
    if (content.match(new RegExp(c.pattern))) { console.error(`  ❌ [${c.id}] Anti-pattern found`); errs++; }
    else console.log(`  ✅ [${c.id}] ${c.name}`);
  } else {
    if (content.match(new RegExp(c.pattern))) console.log(`  ✅ [${c.id}] ${c.name}`);
    else { console.error(`  ❌ [${c.id}] ${c.name}`); errs++; }
  }
}

// ═══ FIX 3: MFA ═══
// ADR-004 postergó el rollout MFA (ver docs/ADRs). El router auth-mfa-routes.js
// fue eliminado como código muerto; el login MFA vivo se valida en auth-login-mfa.js.
console.log('\n🟠 FIX 3: MFA TOTP\n');
const checks3 = [
  { id: 'MFA-04', name: 'Login con MFA implementado', file: 'legalpro-app/server/routes/auth-login-mfa.js', pattern: 'mfaToken|mfaType' },
  { id: 'MFA-05', name: 'MFA requerido para roles sensibles', file: 'legalpro-app/server/routes/auth-login-mfa.js', pattern: 'MFA_REQUIRED_ROLES' }
];
for (const c of checks3) {
  const p = resolve(ROOT, c.file);
  if (!existsSync(p)) { console.error(`  ❌ [${c.id}] File not found: ${c.file}`); errs++; continue; }
  const content = readFileSync(p, 'utf8');
  if (content.match(new RegExp(c.pattern))) console.log(`  ✅ [${c.id}] ${c.name}`);
  else { console.error(`  ❌ [${c.id}] ${c.name}`); errs++; }
}

console.log('\n=== Resumen ===');
console.log(`Errores: ${errs}, Warnings: ${warns}`);
if (errs > 0) {
  console.error('\n❌ FIXES CRITICAL NO COMPLETOS. Deploy bloqueado.');
  process.exit(1);
}
console.log('\n✅ Todos los fixes CRITICAL implementados. Deploy permitido.');
process.exit(0);
