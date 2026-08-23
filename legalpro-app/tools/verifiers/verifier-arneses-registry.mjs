#!/usr/bin/env node
// tools/verifiers/verifier-arneses-registry.mjs
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
let errs = 0;
console.log('=== Verifier: Arnés Registry ===\n');
const checks = [
  { id: 'REG-01', file: 'arneses/registry/INDEX.json', pattern: '"agentes"|"catalogs"|"verifiers"', name: 'INDEX.json' },
  { id: 'REG-02', file: 'arneses/registry/agents.json', pattern: '"id":|"categoria":', name: 'agents.json' },
  { id: 'REG-03', file: 'arneses/registry/CHANGELOG.md', pattern: '# Changelog|## \\[', name: 'CHANGELOG.md' },
  { id: 'REG-04', file: 'opencode.json', pattern: '"agent":', name: 'opencode.json' },
  { id: 'REG-05', file: '.opencode/agents/arquitecto-chief.md', pattern: 'ArquitectoChief|description:', name: 'Agentes en .opencode' }
];
for (const c of checks) {
  const p = resolve(ROOT, c.file);
  if (!existsSync(p)) { console.error(`FAIL: [${c.id}] file not found: ${c.file}`); errs++; continue; }
  const content = readFileSync(p, 'utf8');
  if (content.match(new RegExp(c.pattern))) console.log(`OK: [${c.id}] ${c.name}`);
  else { console.error(`FAIL: [${c.id}] ${c.name}`); errs++; }
}
console.log(`\nErrores: ${errs}`);
process.exit(errs > 0 ? 1 : 0);
