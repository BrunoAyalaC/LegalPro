#!/usr/bin/env node
// tools/verifiers/verifier-rls.mjs
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
let errs = 0;
console.log('=== Verifier: RLS ===\n');
const checks = [
  { id: 'RLS-01', file: 'catalogs/supabase-schema.md', pattern: 'ENABLE ROW LEVEL SECURITY', name: 'RLS documentado en catalogo' },
  { id: 'RLS-02', file: 'legalpro-app/server/init.sql', pattern: 'ENABLE ROW LEVEL SECURITY', name: 'RLS en init.sql' },
  { id: 'RLS-03', file: 'legalpro-app/server/initDb.js', pattern: 'ENABLE ROW LEVEL SECURITY', name: 'RLS en initDb.js' }
];
for (const c of checks) {
  const p = resolve(ROOT, c.file);
  if (!existsSync(p)) { console.warn(`SKIP: [${c.id}] file not found: ${c.file}`); continue; }
  const content = readFileSync(p, 'utf8');
  const matches = (content.match(new RegExp(c.pattern, 'g')) || []).length;
  if (matches > 0) console.log(`OK: [${c.id}] ${c.name} (${matches} tablas con RLS)`);
  else { console.error(`FAIL: [${c.id}] ${c.name}`); errs++; }
}
console.log(`\nErrores: ${errs}`);
process.exit(errs > 0 ? 1 : 0);
