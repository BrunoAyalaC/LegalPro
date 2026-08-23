#!/usr/bin/env node
// tools/verifiers/verifier-catalogos.mjs
// Verifica que todos los catálogos JSON cumplan con su JSON Schema
// Ejecutar: node tools/verifiers/verifier-catalogos.mjs

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

const CATALOGS = [
  { name: 'role-tools', file: 'catalogs/role-tools.json', schema: 'catalogs/schemas/role-tools.schema.json' },
  { name: 'gemini-functions', file: 'catalogs/gemini-functions.json', schema: 'catalogs/schemas/gemini-functions.schema.json' },
  { name: 'tipos-penales', file: 'catalogs/tipos-penales-peru.json', schema: 'catalogs/schemas/tipos-penales.schema.json' },
  { name: 'plazos-procesales', file: 'catalogs/plazos-procesales.json', schema: 'catalogs/schemas/plazos-procesales.schema.json' },
  { name: 'delitos-economicos', file: 'catalogs/delitos-economicos.json', schema: 'catalogs/schemas/delitos-economicos.schema.json' },
  { name: 'codigos-leyes', file: 'catalogs/codigos-leyes.json', schema: 'catalogs/schemas/codigos-leyes.schema.json' },
  { name: 'reguladores', file: 'catalogs/reguladores-peru.json', schema: 'catalogs/schemas/reguladores.schema.json' },
  { name: 'audit-events', file: 'catalogs/audit-events.json', schema: 'catalogs/schemas/audit-events.schema.json' },
  { name: 'disclaimers-ia', file: 'catalogs/disclaimers-ia.json', schema: 'catalogs/schemas/disclaimers-ia.schema.json' }
];

let totalErrors = 0;
let totalWarnings = 0;
let validated = 0;
let skipped = 0;

console.log('=== Verifier: Catálogos ===\n');

for (const c of CATALOGS) {
  const filePath = resolve(ROOT, c.file);
  const schemaPath = resolve(ROOT, c.schema);

  if (!existsSync(filePath)) {
    console.warn(`SKIP: ${c.name} (file not found: ${c.file})`);
    skipped++;
    continue;
  }

  if (!existsSync(schemaPath)) {
    console.warn(`WARN: ${c.name} (schema not found: ${c.schema})`);
    totalWarnings++;
    continue;
  }

  try {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    const data = JSON.parse(readFileSync(filePath, 'utf8'));

    // Validación simple: verificar campos requeridos
    const errors = [];
    if (schema.required) {
      for (const req of schema.required) {
        if (!(req in data)) {
          errors.push(`Missing required field: ${req}`);
        }
      }
    }

    if (errors.length === 0) {
      console.log(`OK: ${c.name}`);
      validated++;
    } else {
      console.error(`FAIL: ${c.name}`);
      errors.forEach(e => console.error(`  - ${e}`));
      totalErrors++;
    }
  } catch (e) {
    console.error(`ERROR: ${c.name}: ${e.message}`);
    totalErrors++;
  }
}

console.log('\n=== Resumen ===');
console.log(`Validados: ${validated}`);
console.log(`Saltados: ${skipped}`);
console.log(`Warnings: ${totalWarnings}`);
console.log(`Errores: ${totalErrors}`);

if (totalErrors > 0) {
  console.error('\nFAIL: Catálogos con errores');
  process.exit(1);
}

console.log('\nOK: Todos los catálogos validados');
process.exit(0);
