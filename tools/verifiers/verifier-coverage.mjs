#!/usr/bin/env node
// tools/verifiers/verifier-coverage.mjs
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
let errs = 0;
console.log('=== Verifier: Cobertura de Tests ===\n');
// Check si hay configuracion de coverage
const coverageConfigs = [
  'LegalProBackend_Net/LegalPro.UnitTests/coverlet.json',
  'legalpro-app/vitest.config.server.js',
  'legalpro-app/vitest.config.prod.js'
];
for (const cfg of coverageConfigs) {
  const p = resolve(ROOT, cfg);
  if (existsSync(p)) console.log(`OK: ${cfg} existe`);
  else console.warn(`WARN: ${cfg} no existe`); }
// Check tests existentes
try {
  const out = execSync('find LegalProBackend_Net -name "*.cs" -path "*Tests*" | wc -l', { encoding: 'utf8', cwd: ROOT });
  const count = parseInt(out.trim(), 10);
  if (count > 5) console.log(`OK: ${count} tests .NET encontrados`);
  else { console.error(`FAIL: solo ${count} tests .NET`); errs++; }
} catch (e) { console.warn('WARN: no se pudieron contar tests'); }
try {
  const out = execSync('find legalpro-app/server/__tests__ -name "*.test.js" | wc -l', { encoding: 'utf8', cwd: ROOT });
  const count = parseInt(out.trim(), 10);
  if (count > 5) console.log(`OK: ${count} tests Node encontrados`);
  else { console.error(`FAIL: solo ${count} tests Node`); errs++; }
} catch (e) { console.warn('WARN: no se pudieron contar tests Node'); }
try {
  const out = execSync('find legalpro-app/e2e -name "*.spec.js" | wc -l', { encoding: 'utf8', cwd: ROOT });
  const count = parseInt(out.trim(), 10);
  if (count > 5) console.log(`OK: ${count} tests E2E encontrados`);
  else { console.error(`FAIL: solo ${count} tests E2E`); errs++; }
} catch (e) { console.warn('WARN: no se pudieron contar tests E2E'); }
console.log(`\nErrores: ${errs}`);
process.exit(errs > 0 ? 1 : 0);
