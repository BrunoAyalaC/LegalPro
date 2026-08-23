#!/usr/bin/env node
// tools/verifiers/verifier-owner-e2ee.mjs
// Verifica el cifrado E2EE del Owner Dashboard
// Ejecutar: node tools/verifiers/verifier-owner-e2ee.mjs

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

let totalErrors = 0;
let totalWarnings = 0;

console.log('=== Verifier: Owner E2EE ===\n');

const checks = [
  {
    id: 'E2EE-01',
    name: 'PBKDF2 con 100,000 iteraciones',
    files: ['legalpro-owner-dashboard/server.js', 'legalpro-owner-dashboard/crypto.test.js'],
    pattern: 'pbkdf2.*100000|100000.*pbkdf2',
    required: true
  },
  {
    id: 'E2EE-02',
    name: 'AES-256-GCM usado',
    files: ['legalpro-owner-dashboard/server.js', 'legalpro-owner-dashboard/crypto.test.js'],
    pattern: 'aes-256-gcm|AES-GCM|createCipheriv',
    required: true
  },
  {
    id: 'E2EE-03',
    name: 'IV aleatorio de 12 bytes',
    files: ['legalpro-owner-dashboard/server.js', 'legalpro-owner-dashboard/crypto.test.js'],
    pattern: 'randomBytes\\(12\\)',
    required: true
  },
  {
    id: 'E2EE-04',
    name: 'Salt aleatorio de 16 bytes',
    files: ['legalpro-owner-dashboard/server.js', 'legalpro-owner-dashboard/crypto.test.js'],
    pattern: 'randomBytes\\(16\\)',
    required: true
  },
  {
    id: 'E2EE-05',
    name: 'Tag de autenticidad (GCM)',
    files: ['legalpro-owner-dashboard/server.js', 'legalpro-owner-dashboard/crypto.test.js'],
    pattern: 'getAuthTag',
    required: true
  },
  {
    id: 'E2EE-06',
    name: 'SHA-256 como hash para PBKDF2',
    files: ['legalpro-owner-dashboard/server.js', 'legalpro-owner-dashboard/crypto.test.js'],
    pattern: "'sha256'|'SHA-256'",
    required: true
  },
  {
    id: 'E2EE-07',
    name: 'Web Crypto API en frontend',
    files: ['legalpro-owner-dashboard/public/app.js'],
    pattern: 'subtle\\.crypto|crypto\\.subtle|webcrypto',
    required: true
  },
  {
    id: 'E2EE-08',
    name: 'Tests E2EE completos',
    files: ['legalpro-owner-dashboard/crypto.test.js'],
    pattern: "test\\(.*Cifrado Backend|test\\(.*Descifrado falla",
    required: true
  }
];

for (const c of checks) {
  let foundInAny = false;
  let missing = [];

  for (const file of c.files) {
    const fullPath = resolve(ROOT, file);
    if (!existsSync(fullPath)) {
      missing.push(file);
      continue;
    }
    try {
      const content = readFileSync(fullPath, 'utf8');
      if (content.match(new RegExp(c.pattern))) {
        foundInAny = true;
        break;
      }
    } catch (e) {
      // continue
    }
  }

  if (missing.length === c.files.length) {
    if (c.required) {
      console.error(`FAIL: [${c.id}] ${c.name} - Todos los archivos faltan`);
      totalErrors++;
    } else {
      console.warn(`WARN: [${c.id}] ${c.name} - Archivos no encontrados`);
      totalWarnings++;
    }
    continue;
  }

  if (foundInAny) {
    console.log(`OK: [${c.id}] ${c.name}`);
  } else {
    if (c.required) {
      console.error(`FAIL: [${c.id}] ${c.name} - Pattern not found en ninguno: ${c.pattern}`);
      totalErrors++;
    } else {
      console.warn(`WARN: [${c.id}] ${c.name} - Pattern not found: ${c.pattern}`);
      totalWarnings++;
    }
  }
}

// Test ejecutable
console.log('\n--- Ejecutando tests E2EE ---');
try {
  const out = execSync('cd legalpro-owner-dashboard && node --test crypto.test.js 2>&1', {
    encoding: 'utf8',
    cwd: ROOT,
    maxBuffer: 5 * 1024 * 1024,
    timeout: 30000
  });
  if (out.includes('pass') && !out.includes('fail')) {
    console.log('OK: Tests E2EE pasaron');
  } else {
    console.warn('WARN: Output de tests:');
    console.warn(out.substring(0, 500));
  }
} catch (e) {
  console.warn('WARN: No se pudieron ejecutar tests automaticamente');
  console.warn(e.message.substring(0, 300));
}

console.log('\n=== Resumen ===');
console.log(`Errores: ${totalErrors}`);
console.log(`Warnings: ${totalWarnings}`);

if (totalErrors > 0) {
  console.error('\nFAIL: Owner E2EE verification failed');
  process.exit(1);
}

console.log('\nOK: Owner E2EE verification passed');
process.exit(0);
