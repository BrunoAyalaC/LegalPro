#!/usr/bin/env node
// tools/verifiers/verifier-lpdp.mjs
// Verifica cumplimiento LPDP (Ley 29733)
// Ejecutar: node tools/verifiers/verifier-lpdp.mjs

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

let totalErrors = 0;
let totalWarnings = 0;

console.log('=== Verifier: LPDP (Ley 29733) ===\n');

const checks = [
  {
    id: 'LPDP-01',
    name: 'Tabla consentimientos existe',
    file: 'legalpro-app/server/init.sql',
    pattern: 'CREATE TABLE IF NOT EXISTS consentimientos',
    required: true
  },
  {
    id: 'LPDP-02',
    name: 'Endpoints ARCO existen',
    file: 'legalpro-app/server/routes/datos-personales.js',
    pattern: 'router\\.(get|put|delete)\\(',
    required: true
  },
  {
    id: 'LPDP-03',
    name: 'Flag transferencia internacional en columnas de usuario',
    file: 'legalpro-app/server/init.sql',
    pattern: 'consentimiento_transferencia_internacional',
    required: true
  },
  {
    id: 'LPDP-04',
    name: 'Política de privacidad versionada',
    file: 'legalpro-app/docs/POLITICA_PRIVACIDAD.md',
    pattern: 'versión',
    required: true
  },
  {
    id: 'LPDP-05',
    name: 'Términos y condiciones versionados',
    file: 'legalpro-app/docs/TERMINOS_CONDICIONES.md',
    pattern: 'versión',
    required: true
  },
  {
    id: 'LPDP-06',
    name: 'Registro de tratamiento LPDP existe',
    file: 'docs/REGISTRO_TRATAMIENTO_LPDP.md',
    pattern: '[Ff]inalidad',
    required: true
  },
  {
    id: 'LPDP-07',
    name: 'Cláusula de transferencia internacional',
    file: 'docs/TRANSFERENCIA_INTERNACIONAL.md',
    pattern: 'Google',
    required: true
  },
  {
    id: 'LPDP-08',
    name: 'Audit log con eventos LPDP',
    file: 'catalogs/audit-events.json',
    pattern: 'LPDP',
    required: true
  },
  {
    id: 'LPDP-09',
    name: 'Plan de rotación de secrets',
    file: 'docs/SECRET_ROTATION_PLAN.md',
    pattern: 'JWT_SECRET',
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
    if (content.match(new RegExp(c.pattern, 'i'))) {
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
  } catch (e) {
    console.error(`ERROR: [${c.id}] ${c.name}: ${e.message}`);
    totalErrors++;
  }
}

console.log('\n=== Resumen ===');
console.log(`Errores: ${totalErrors}`);
console.log(`Warnings: ${totalWarnings}`);

if (totalErrors > 0) {
  console.error('\nFAIL: LPDP compliance violations');
  process.exit(1);
}

console.log('\nOK: LPDP compliance verified');
process.exit(0);
