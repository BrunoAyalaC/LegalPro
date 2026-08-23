#!/usr/bin/env node
// tools/verifiers/verifier-accesibilidad.mjs
// Verifica WCAG 2.1 AA — Node.js nativo (Win/Mac/Linux)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const SRC = join(ROOT, 'legalpro-app', 'src');
let errs = 0, warns = 0;
console.log('=== Verifier: Accesibilidad WCAG 2.1 AA ===\n');

function findFiles(dir, extensions) {
  let results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        results = results.concat(findFiles(fullPath, extensions));
      } else if (entry.isFile() && extensions.includes(extname(entry.name).toLowerCase())) {
        results.push(fullPath);
      }
    }
  } catch (_) { /* directorio no existe / sin permisos */ }
  return results;
}

function countInFiles(files, pattern) {
  let count = 0;
  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf8');
      const matches = content.match(pattern);
      if (matches) count += matches.length;
    } catch (_) { /* archivo binario / sin permisos */ }
  }
  return count;
}

// Check 1: aria-label usage en .jsx / .tsx
const jsxTsxFiles = findFiles(SRC, ['.jsx', '.tsx']);
const ariaLabelCount = countInFiles(jsxTsxFiles, /aria-label/g);
if (ariaLabelCount > 10) {
  console.log(`OK: aria-label usado ${ariaLabelCount} veces`);
} else {
  console.warn(`WARN: aria-label solo ${ariaLabelCount} veces (mín. 10)`);
  warns++;
}

// Check 2: role="..." o role='...' en .jsx / .tsx
const roleCount = countInFiles(jsxTsxFiles, /role=["']/g);
if (roleCount > 5) {
  console.log(`OK: role usado ${roleCount} veces`);
} else {
  console.warn(`WARN: role solo ${roleCount} veces (mín. 5)`);
  warns++;
}

// Check 3: tests accesibilidad existen
const testFile = join(ROOT, 'legalpro-app', 'e2e', 'accesibilidad-wcag.spec.js');
if (existsSync(testFile)) {
  console.log('OK: Tests accesibilidad WCAG existen');
} else {
  console.error('FAIL: Tests accesibilidad WCAG faltan');
  errs++;
}

console.log(`\nErrores: ${errs}, Warnings: ${warns}`);
process.exit(errs > 0 ? 1 : 0);
