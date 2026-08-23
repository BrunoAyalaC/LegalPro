#!/usr/bin/env node
// tools/verifiers/verifier-owner-secrets.mjs
// Verifica que los secretos del Owner no estén hardcoded ni commiteados
// Ejecutar: node tools/verifiers/verifier-owner-secrets.mjs

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

let totalErrors = 0;
let totalWarnings = 0;

console.log('=== Verifier: Owner Secrets ===\n');

const FORBIDDEN_PATTERNS = [
  {
    pattern: 'LegalProOwnerSecret2026_SecureToken!',
    name: 'Default OWNER_SECRET_KEY hardcoded',
    severity: 'CRITICAL'
  },
  {
    pattern: 'LegalProOwnerDecryptionPassword2026!',
    name: 'Default OWNER_DECRYPTION_SECRET hardcoded',
    severity: 'CRITICAL'
  }
];

const filesToCheck = [
  'legalpro-owner-dashboard/server.js',
  'legalpro-owner-dashboard/public/app.js',
  'legalpro-owner-dashboard/crypto.test.js',
  'legalpro-owner-dashboard/.env.example',
  'legalpro-owner-dashboard/README.md',
  'legalpro-owner-dashboard/package.json'
];

let foundAnyForbidden = false;
for (const file of filesToCheck) {
  const fullPath = resolve(ROOT, file);
  if (!existsSync(fullPath)) continue;

  const content = readFileSync(fullPath, 'utf8');
  for (const p of FORBIDDEN_PATTERNS) {
    if (content.includes(p.pattern)) {
      console.error(`FAIL: [${file}] ${p.name} (${p.severity})`);
      totalErrors++;
      foundAnyForbidden = true;
    }
  }
}

if (!foundAnyForbidden) {
  console.log('OK: Sin secrets hardcoded en archivos del owner');
}

// Check .env.example no contiene valores reales
const envExample = resolve(ROOT, 'legalpro-owner-dashboard/.env.example');
if (existsSync(envExample)) {
  const content = readFileSync(envExample, 'utf8');
  // .env.example DEBE tener placeholders
  if (content.includes('=') && !content.includes('CHANGE_ME') && !content.includes('<') && !content.includes('xxxxxx')) {
    console.warn('WARN: .env.example podria tener valores reales en lugar de placeholders');
    totalWarnings++;
  } else {
    console.log('OK: .env.example usa placeholders');
  }
}

// Verificar que .env no esté commiteado
try {
  const out = execSync('git check-ignore legalpro-owner-dashboard/.env 2>&1 || echo NOT_IGNORED', {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 5000
  });
  if (out.trim() === 'NOT_IGNORED') {
    console.error('FAIL: .env del owner NO está en .gitignore');
    totalErrors++;
  } else {
    console.log('OK: .env del owner está en .gitignore');
  }
} catch (e) {
  console.warn('WARN: No se pudo verificar .gitignore (¿no es un repo git?)');
  totalWarnings++;
}

// Verificar longitud mínima de OWNER_SECRET_KEY
try {
  const serverContent = readFileSync(resolve(ROOT, 'legalpro-owner-dashboard/server.js'), 'utf8');
  const match = serverContent.match(/OWNER_SECRET_KEY.*\?\s*'([^']+)'/);
  if (match) {
    const defaultKey = match[1];
    if (defaultKey.length < 32) {
      console.error(`FAIL: Default OWNER_SECRET_KEY tiene ${defaultKey.length} chars (minimo 32)`);
      totalErrors++;
    } else {
      console.warn(`WARN: Default OWNER_SECRET_KEY tiene ${defaultKey.length} chars (cumple minimo)`);
    }
  }
} catch (e) {
  // ignore
}

console.log('\n=== Resumen ===');
console.log(`Errores: ${totalErrors}`);
console.log(`Warnings: ${totalWarnings}`);

if (totalErrors > 0) {
  console.error('\nFAIL: Owner secrets violations detected');
  process.exit(1);
}

console.log('\nOK: Owner secrets verification passed');
process.exit(0);
