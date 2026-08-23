#!/usr/bin/env node
// tools/verifiers/verifier-deprecation-modelos.mjs
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
let errs = 0;
console.log('=== Verifier: Modelos Gemini Deprecados (migración a MiniMax) ===\n');
const DEPRECATED = ['gemini-1.0-pro', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5', 'gemini-3.1'];
// Check codigo por modelos deprecados
try {
  const out = execSync(
    `grep -rE "gemini-1\\.0-pro|gemini-1\\.5-pro|gemini-1\\.5-flash|gemini-2\\.0-flash|gemini-2\\.5|gemini-3\\.1" --include="*.cs" --include="*.js" --include="*.ts" LegalProBackend_Net/ legalpro-app/ 2>/dev/null || true`,
    { encoding: 'utf8', cwd: ROOT, maxBuffer: 5 * 1024 * 1024 }
  );
  if (out.trim()) {
    console.error('FAIL: Modelos Gemini deprecados encontrados en codigo:');
    out.trim().split('\n').forEach(l => console.error(`  ${l.trim()}`));
    errs++;
  } else {
    console.log('OK: Sin modelos Gemini deprecados en codigo');
  }
} catch (e) { console.log('OK: Sin modelos Gemini deprecados'); }
// Check catalogo
const cat = resolve(ROOT, 'catalogs/gemini-functions.json');
if (existsSync(cat)) {
  const content = readFileSync(cat, 'utf8');
  for (const model of DEPRECATED) {
    if (content.includes(`"${model}"`)) {
      console.error(`FAIL: Modelo deprecado en catalogo: ${model}`);
      errs++;
    }
  }
  console.log('OK: Catalogo sin modelos deprecados');
}
console.log(`\nErrores: ${errs}`);
process.exit(errs > 0 ? 1 : 0);
