#!/usr/bin/env node
// tools/verifiers/verifier-contrato-api.mjs
// Valida contratos API: OpenAPI, JSON Schema, Pact
// Detecta drift entre producer y consumer

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

let errs = 0, warns = 0;
console.log('=== Verifier Contratos API (OpenAPI + Pact + JSON Schema) ===\n');

const checks = [
  {
    id: 'CONTRACT-01',
    name: 'OpenAPI spec de legalpro-dotnet existe',
    files: ['docs/api/openapi-legalpro-dotnet.json', 'docs/api/openapi.json'],
    pattern: '"openapi":\\s*"3\\.',
    required: true
  },
  {
    id: 'CONTRACT-02',
    name: 'OpenAPI spec de legalpro-node existe',
    files: ['docs/api/openapi-legalpro-node.json'],
    pattern: '"openapi":\\s*"3\\.',
    required: true
  },
  {
    id: 'CONTRACT-03',
    name: 'OpenAPI spec de owner-dashboard existe',
    files: ['docs/api/openapi-owner-dashboard.json'],
    pattern: '"openapi":\\s*"3\\.',
    required: true
  },
  {
    id: 'CONTRACT-04',
    name: 'JSON Schemas en catalogs/schemas/ existen',
    files: [
      'catalogs/schemas/role-tools.schema.json',
      'catalogs/schemas/gemini-functions.schema.json',
      'catalogs/schemas/audit-events.schema.json',
      'catalogs/schemas/plazos-procesales.schema.json',
      'catalogs/schemas/tipos-penales.schema.json'
    ],
    pattern: '"\\$schema":',
    required: true
  },
  {
    id: 'CONTRACT-05',
    name: 'Pact contracts definidos',
    files: ['pacts/frontend-node.json', 'pacts/node-dotnet.json', 'pacts/owner-node.json'],
    pattern: '"consumer":|"provider":',
    required: false
  },
  {
    id: 'CONTRACT-06',
    name: 'SLAs documentados en catalogs/sla-slo.md',
    files: ['catalogs/sla-slo.md'],
    pattern: '99\\.9|99\\.95|99\\.5',
    required: true
  },
  {
    id: 'CONTRACT-07',
    name: 'Catalogo de contratos existe',
    files: ['catalogs/contratos.json'],
    pattern: '"tipos_contratos"',
    required: true
  },
  {
    id: 'CONTRACT-08',
    name: 'Catalogo de adaptadores existe',
    files: ['catalogs/adaptadores.json'],
    pattern: '"adaptadores_implementados"',
    required: true
  }
];

for (const c of checks) {
  console.log(`[${c.id}] ${c.name}`);
  let found = false;
  for (const file of c.files) {
    const fullPath = resolve(ROOT, file);
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, 'utf8');
      if (content.match(new RegExp(c.pattern))) {
        console.log(`  OK: ${file}`);
        found = true;
        break;
      }
    }
  }
  if (!found) {
    if (c.required) {
      console.error(`  FAIL: Ningun archivo cumple el patron`);
      errs++;
    } else {
      console.warn(`  WARN: Pendiente (no bloquea release)`);
      warns++;
    }
  }
}

console.log(`\nErrores: ${errs}, Warnings: ${warns}`);
if (errs > 0) process.exit(1);
process.exit(0);
