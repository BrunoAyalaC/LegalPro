#!/usr/bin/env node
// tools/verifiers/verifier-owasp.mjs
// Verifica controles OWASP Top 10
// Ejecutar: node tools/verifiers/verifier-owasp.mjs
// Cross-platform: escaneo nativo en Node (sin depender de `grep`).

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

let totalErrors = 0;
let totalWarnings = 0;

console.log('=== Verifier: OWASP Top 10 ===\n');

const SCAN_EXT = new Set(['.js', '.ts', '.jsx', '.tsx', '.cs', '.kt']);
const EXCLUDE_DIR = new Set(['node_modules', '.git', 'dist', 'build', 'bin', 'obj', '.gradle', 'coverage', 'test-results']);

function walk(dir, acc) {
  let entries;
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (EXCLUDE_DIR.has(entry)) continue;
      walk(full, acc);
    } else if (SCAN_EXT.has(extname(entry))) {
      acc.push(full);
    }
  }
  return acc;
}

function toRegex(pattern) {
  if (pattern instanceof RegExp) {
    const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
    return new RegExp(pattern.source, flags);
  }
  // String: soporta alternancia simple "a|b" como regex literal
  return new RegExp(pattern, 'g');
}

function scan(pattern, relPath) {
  const base = resolve(ROOT, relPath);
  if (!existsSync(base)) return [];
  const files = walk(base, []);
  const re = toRegex(pattern);
  const hits = [];
  for (const f of files) {
    if (f.includes('node_modules') || f.includes('.test.') || f.includes('__tests__')) continue;
    let content;
    try { content = readFileSync(f, 'utf8'); } catch { continue; }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      re.lastIndex = 0;
      if (re.test(lines[i])) {
        const rel = f.startsWith(ROOT) ? f.slice(ROOT.length + 1) : f;
        hits.push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
      }
    }
  }
  return hits;
}

const checks = [
  {
    id: 'A01:2021', name: 'Broken Access Control',
    grep: [
      { pattern: 'IgnoreQueryFilters\\(\\)', paths: ['LegalProBackend_Net'], severity: 'ERROR' },
    ],
  },
  {
    id: 'A02:2021', name: 'Cryptographic Failures',
    grep: [
      { pattern: '\\bcreateHash\\([\'"]md5[\'"]\\)', paths: ['legalpro-app', 'LegalProBackend_Net'], severity: 'ERROR' },
    ],
  },
  {
    id: 'A03:2021', name: 'Injection (template SQL/shell)',
    grep: [
      { pattern: 'query\\(\\s*`[^`]*\\$\\{', paths: ['legalpro-app/server'], severity: 'ERROR' },
    ],
  },
  {
    id: 'A07:2021', name: 'Auth Failures (secret hardcodeado)',
    grep: [
      { pattern: 'JWT_SECRET\\s*=\\s*[\'"][^\'"]{8,}[\'"]', paths: ['legalpro-app/src', 'legalpro-app/server', 'LegalProBackend_Net'], severity: 'ERROR' },
    ],
  },
  {
    id: 'GENERAL', name: 'Hardcoded secrets',
    grep: [
      { pattern: 'sk-[a-zA-Z0-9]{20,}', paths: ['legalpro-app/src', 'legalpro-app/server'], severity: 'ERROR' },
      { pattern: 'AIza[a-zA-Z0-9_\\-]{30,}', paths: ['legalpro-app/src', 'legalpro-app/server'], severity: 'ERROR' },
    ],
  },
];

let totalScanned = 0;
for (const check of checks) {
  console.log(`\n[${check.id}] ${check.name}`);
  for (const g of check.grep) {
    for (const p of g.paths) {
      const hits = scan(g.pattern, p);
      totalScanned++;
      for (const line of hits) {
        if (g.severity === 'ERROR') { console.error(`  ERROR: ${line}`); totalErrors++; }
        else { console.warn(`  WARN: ${line}`); totalWarnings++; }
      }
    }
  }
}

console.log('\n=== Resumen ===');
console.log(`Patrones evaluados: ${totalScanned}`);
console.log(`Errores: ${totalErrors}`);
console.log(`Warnings: ${totalWarnings}`);

if (totalErrors > 0) {
  console.error('\nFAIL: OWASP violations detected');
  process.exit(1);
}

console.log('\nOK: No critical OWASP violations');
process.exit(0);
