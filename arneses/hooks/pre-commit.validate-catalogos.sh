#!/usr/bin/env bash
# pre-commit.validate-catalogos.sh
# Valida que todos los catálogos JSON cumplan con su JSON Schema
set -e

cd "$(git rev-parse --show-toplevel)"

echo "==> Validando catálogos con JSON Schema"

# Validador con ajv
node -e "
const Ajv = require('ajv').default || require('ajv');
const fs = require('fs');
const path = require('path');

const ajv = new Ajv({ allErrors: true, strict: false });

const catalogs = [
  { name: 'role-tools', data: 'catalogs/role-tools.json', schema: 'catalogs/schemas/role-tools.schema.json' },
  { name: 'gemini-functions', data: 'catalogs/gemini-functions.json', schema: 'catalogs/schemas/gemini-functions.schema.json' },
  { name: 'tipos-penales', data: 'catalogs/tipos-penales-peru.json', schema: 'catalogs/schemas/tipos-penales.schema.json' },
  { name: 'plazos-procesales', data: 'catalogs/plazos-procesales.json', schema: 'catalogs/schemas/plazos-procesales.schema.json' },
  { name: 'delitos-economicos', data: 'catalogs/delitos-economicos.json', schema: 'catalogs/schemas/delitos-economicos.schema.json' },
  { name: 'codigos-leyes', data: 'catalogs/codigos-leyes.json', schema: 'catalogs/schemas/codigos-leyes.schema.json' },
  { name: 'reguladores', data: 'catalogs/reguladores-peru.json', schema: 'catalogs/schemas/reguladores.schema.json' },
  { name: 'audit-events', data: 'catalogs/audit-events.json', schema: 'catalogs/schemas/audit-events.schema.json' },
  { name: 'disclaimers-ia', data: 'catalogs/disclaimers-ia.json', schema: 'catalogs/schemas/disclaimers-ia.schema.json' },
];

let failed = 0;
for (const c of catalogs) {
  try {
    if (!fs.existsSync(c.schema)) {
      console.log('WARN: Schema not found ' + c.schema + ', skipping ' + c.name);
      continue;
    }
    const schema = JSON.parse(fs.readFileSync(c.schema, 'utf8'));
    const data = JSON.parse(fs.readFileSync(c.data, 'utf8'));
    const validate = ajv.compile(schema);
    const valid = validate(data);
    if (valid) {
      console.log('OK: ' + c.name);
    } else {
      console.error('FAIL: ' + c.name);
      console.error(JSON.stringify(validate.errors, null, 2));
      failed++;
    }
  } catch (e) {
    console.error('ERROR: ' + c.name + ': ' + e.message);
    failed++;
  }
}

if (failed > 0) {
  console.error(failed + ' catalogos con errores');
  process.exit(1);
}
console.log('OK: Todos los catalogos validados');
"
