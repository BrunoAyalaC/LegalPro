// legalpro-app/tests/openapi-client-gen.mjs
// Generado por @frontend (Sprint 2 - Type generation)
// Genera TypeScript types desde OpenAPI specs del .NET y Node

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const SPECS = [
  { name: 'node', spec: 'docs/api/openapi-legalpro-node.json' },
  { name: 'dotnet', spec: 'docs/api/openapi-legalpro-dotnet.json' }
];
const OUT_DIR = resolve(ROOT, 'legalpro-app/src/api/generated');

function refToTs(schema, schemas, depth = 0) {
  if (depth > 5) return 'any';
  if (schema?.$ref) {
    const refName = schema.$ref.split('/').pop();
    return refName;
  }
  if (schema?.type === 'array') {
    return `Array<${refToTs(schema.items, schemas, depth + 1)}>`;
  }
  if (schema?.type === 'object' || schema?.properties) {
    const props = schema?.properties || {};
    const required = schema?.required || [];
    const lines = Object.entries(props).map(([k, v]) => {
      const opt = required.includes(k) ? '' : '?';
      const tsType = refToTs(v, schemas, depth + 1);
      return `  ${k}${opt}: ${tsType};`;
    });
    return `{\n${lines.join('\n')}\n}`;
  }
  if (schema?.enum) return schema.enum.map(v => `'${v}'`).join(' | ');
  if (schema?.type === 'integer' || schema?.type === 'number') return 'number';
  if (schema?.type === 'boolean') return 'boolean';
  return 'string';
}

function generateTypes(spec, name) {
  const content = readFileSync(spec, 'utf8');
  const api = JSON.parse(content);
  const schemas = api.components?.schemas || {};
  const lines = [
    `// Auto-generated from ${spec}`,
    `// Do not edit manually`,
    `// ${new Date().toISOString()}`,
    ``,
    `export namespace ${name.toUpperCase()} {`
  ];
  for (const [schemaName, schema] of Object.entries(schemas)) {
    const tsType = refToTs(schema, schemas, 0);
    lines.push(`  export interface ${schemaName} ${tsType.replace(/^/gm, '  ')}`);
  }
  lines.push('}');
  lines.push('export default ' + name.toUpperCase() + ';');
  return lines.join('\n');
}

function generatePaths(spec, name) {
  const content = readFileSync(spec, 'utf8');
  const api = JSON.parse(content);
  const paths = api.paths || {};
  const lines = [
    `// Auto-generated paths from ${spec}`,
    `export const ${name.toUpperCase()}_PATHS = {`
  ];
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (typeof op === 'object' && op.summary) {
        const safePath = path.replace(/[{}]/g, '').replace(/\//g, '_');
        lines.push(`  ${method.toUpperCase()}_${safePath}: { method: '${method.toUpperCase()}', path: '${path}' },`);
      }
    }
  }
  lines.push('} as const;');
  return lines.join('\n');
}

if (!existsSync(OUT_DIR)) {
  const { mkdirSync } = await import('node:fs');
  mkdirSync(OUT_DIR, { recursive: true });
}

for (const { name, spec } of SPECS) {
  const specPath = resolve(ROOT, spec);
  if (!existsSync(specPath)) {
    console.warn(`Spec not found: ${spec}, skipping`);
    continue;
  }
  const types = generateTypes(specPath, name);
  const paths = generatePaths(specPath, name);
  writeFileSync(resolve(OUT_DIR, `${name}.types.ts`), types);
  writeFileSync(resolve(OUT_DIR, `${name}.paths.ts`), paths);
  console.log(`Generated ${name}.types.ts and ${name}.paths.ts`);
}

console.log(`\n✅ Generated in ${OUT_DIR}`);
console.log('\nUso:');
console.log('  import { NODE, NODE_PATHS } from "@/api/generated/node";');
console.log('  import { DOTNET, DOTNET_PATHS } from "@/api/generated/dotnet";');
