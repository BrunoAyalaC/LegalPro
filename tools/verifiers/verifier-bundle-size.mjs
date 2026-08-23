#!/usr/bin/env node
// tools/verifiers/verifier-bundle-size.mjs
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
let errs = 0;
console.log('=== Verifier: Bundle Size ===\n');
// Check si dist existe
try {
  const out = execSync('du -sh legalpro-app/dist 2>/dev/null || echo MISSING', { encoding: 'utf8', cwd: ROOT });
  if (out.includes('MISSING')) {
    console.warn('WARN: dist/ no existe (ejecutar build primero)');
  } else {
    console.log(`OK: dist size: ${out.trim()}`);
    // Parse size in KB
    const sizeMatch = out.match(/(\d+(?:\.\d+)?)([KMG])/);
    if (sizeMatch) {
      const value = parseFloat(sizeMatch[1]);
      const unit = sizeMatch[2];
      const sizeInKB = unit === 'M' ? value * 1024 : unit === 'G' ? value * 1024 * 1024 : value;
      if (sizeInKB > 1024) { console.error(`FAIL: bundle > 1MB (${sizeInKB}KB)`); errs++; }
      else console.log(`OK: bundle < 1MB`);
    }
  }
} catch (e) { console.warn('WARN: no se pudo medir bundle'); }
// Check vite config
try {
  const out = execSync('grep -E "manualChunks|chunkSize" legalpro-app/vite.config.js 2>/dev/null || echo MISSING', { encoding: 'utf8', cwd: ROOT });
  if (out.includes('MISSING')) console.warn('WARN: vite.config.js no tiene manualChunks');
  else console.log('OK: vite config tiene code splitting');
} catch (e) {}
console.log(`\nErrores: ${errs}`);
process.exit(errs > 0 ? 1 : 0);
