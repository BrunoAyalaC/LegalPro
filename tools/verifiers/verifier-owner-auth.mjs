#!/usr/bin/env node
// tools/verifiers/verifier-owner-auth.mjs
// Verifica la autenticacion del Owner Dashboard
// Ejecutar: node tools/verifiers/verifier-owner-auth.mjs

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

let totalErrors = 0;
let totalWarnings = 0;

console.log('=== Verifier: Owner Auth ===\n');

const checks = [
  {
    id: 'OAUTH-01',
    name: 'Middleware authenticateOwner existe',
    file: 'legalpro-owner-dashboard/server.js',
    pattern: 'function authenticateOwner',
    required: true
  },
  {
    id: 'OAUTH-02',
    name: 'Header Authorization usado',
    file: 'legalpro-owner-dashboard/server.js',
    pattern: "headers\\.authorization|headers\\['authorisation'\\]|headers\\['authorization'\\]",
    required: true
  },
  {
    id: 'OAUTH-03',
    name: 'OWNER_SECRET_KEY desde variable de entorno',
    file: 'legalpro-owner-dashboard/server.js',
    pattern: "process\\.env\\.OWNER_SECRET_KEY",
    required: true
  },
  {
    id: 'OAUTH-04',
    name: 'No se expone el secret en logs',
    file: 'legalpro-owner-dashboard/server.js',
    pattern: 'console\\.log.*OWNER_SECRET_KEY',
    required: false,
    shouldFail: true
  },
  {
    id: 'OAUTH-05',
    name: 'Manejo de error 401 sin authorization',
    file: 'legalpro-owner-dashboard/server.js',
    pattern: 'status\\(401\\)',
    required: true
  },
  {
    id: 'OAUTH-06',
    name: 'Manejo de error 403 con token invalido',
    file: 'legalpro-owner-dashboard/server.js',
    pattern: 'status\\(403\\)',
    required: true
  },
  {
    id: 'OAUTH-07',
    name: 'Tests de autenticacion',
    file: 'legalpro-owner-dashboard/crypto.test.js',
    pattern: 'test\\(',
    required: true
  }
];

for (const c of checks) {
  const fullPath = resolve(ROOT, c.file);
  if (!existsSync(fullPath)) {
    if (c.required) {
      console.error(`FAIL: [${c.id}] ${c.name} - File not found: ${c.file}`);
      totalErrors++;
    } else {
      console.warn(`WARN: [${c.id}] ${c.name} - File not found: ${c.file}`);
      totalWarnings++;
    }
    continue;
  }

  try {
    const content = readFileSync(fullPath, 'utf8');
    const found = content.match(new RegExp(c.pattern)) !== null;

    if (c.shouldFail) {
      if (found) {
        console.error(`FAIL: [${c.id}] ${c.name} - Patron encontrado (no deberia existir): ${c.pattern}`);
        totalErrors++;
      } else {
        console.log(`OK: [${c.id}] ${c.name}`);
      }
    } else {
      if (found) {
        console.log(`OK: [${c.id}] ${c.name}`);
      } else {
        if (c.required) {
          console.error(`FAIL: [${c.id}] ${c.name} - Pattern not found: ${c.pattern}`);
          totalErrors++;
        } else {
          console.warn(`WARN: [${c.id}] ${c.name} - Pattern not found: ${c.pattern}`);
          totalWarnings++;
        }
      }
    }
  } catch (e) {
    console.error(`ERROR: [${c.id}] ${c.name}: ${e.message}`);
    totalErrors++;
  }
}

console.log('\n=== Resumen ===');
console.log(`Errores: ${totalErrors}`);
console.log(`Warnings: ${totalWarnings}`);

if (totalErrors > 0) {
  console.error('\nFAIL: Owner auth verifications failed');
  process.exit(1);
}

console.log('\nOK: Owner auth verification passed');
process.exit(0);
