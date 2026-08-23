#!/usr/bin/env node
// tools/verifiers/verifier-multi-tenant.mjs
// Verifica aislamiento multi-tenant
// Ejecutar: node tools/verifiers/verifier-multi-tenant.mjs
// Cross-platform: funciona en Windows y Linux/Mac

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, extname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

let totalErrors = 0;
let totalWarnings = 0;

// ─── Helper: recursive file search ───────────────────────────────────────────
function findFiles(dir, predicate) {
  const results = [];
  function walk(current) {
    let entries;
    try { entries = readdirSync(current); } catch { return; }
    for (const entry of entries) {
      const fullPath = join(current, entry);
      let stat;
      try { stat = statSync(fullPath); } catch { continue; }
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (predicate(fullPath, entry)) {
        results.push(fullPath);
      }
    }
  }
  walk(dir);
  return results;
}

function findCSharpFiles(dir) {
  return findFiles(dir, (fullPath, entry) => entry.endsWith('.cs'));
}

function readFileSafe(filePath) {
  try { return readFileSync(filePath, 'utf8'); } catch { return ''; }
}

function grepFiles(files, pattern) {
  const results = [];
  for (const file of files) {
    const content = readFileSafe(file);
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(pattern)) {
        // Mostrar ruta relativa a ROOT
        const relPath = file.startsWith(ROOT) ? file.slice(ROOT.length + 1) : file;
        results.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
      }
    }
  }
  return results;
}

function grepFilesExcludeDirs(baseDir, pattern, excludeDirs) {
  const allFiles = findCSharpFiles(baseDir);
  const filtered = allFiles.filter(f => {
    const rel = f.startsWith(ROOT) ? f.slice(ROOT.length) : f;
    return !excludeDirs.some(d => rel.startsWith(sep + d) || rel.startsWith('/' + d));
  });
  return grepFiles(filtered, pattern);
}

// ─── Check 1: No IgnoreQueryFilters() ────────────────────────────────────────
console.log('[MT-01] Detectando IgnoreQueryFilters() en codigo de produccion');
const ignoreQueryFilterFiles = grepFilesExcludeDirs(
  join(ROOT, 'LegalProBackend_Net'),
  'IgnoreQueryFilters',
  ['UnitTests', 'IntegrationTests']
);
if (ignoreQueryFilterFiles.length > 0) {
  console.error('  FAIL: IgnoreQueryFilters() en produccion:');
  ignoreQueryFilterFiles.forEach(l => console.error('  ' + l));
  totalErrors++;
} else {
  console.log('  OK: Sin IgnoreQueryFilters() en produccion');
}

// ─── Check 2: TenantValidationBehavior ────────────────────────────────────────
console.log('\n[MT-02] Verificando TenantValidationBehavior');
const tvbFiles = findCSharpFiles(join(ROOT, 'LegalProBackend_Net'));
const tvbMatches = grepFiles(tvbFiles, 'TenantValidationBehavior');
if (tvbMatches.length > 0) {
  console.log('  OK: TenantValidationBehavior presente');
} else {
  console.error('  FAIL: TenantValidationBehavior no encontrado');
  totalErrors++;
}

// ─── Check 3: ITenantRequest ─────────────────────────────────────────────────
console.log('\n[MT-03] Verificando ITenantRequest');
const appFiles = findCSharpFiles(join(ROOT, 'LegalProBackend_Net', 'LegalPro.Application'));
const itrMatches = grepFiles(appFiles, 'ITenantRequest');
if (itrMatches.length > 0) {
  console.log('  OK: ITenantRequest presente');
} else {
  console.warn('  WARN: ITenantRequest no encontrado');
  totalWarnings++;
}

// ─── Check 4: organization_id en JWT (.NET) ──────────────────────────────────
console.log('\n[MT-04] Verificando organization_id en JWT');
const servicesFiles = findCSharpFiles(join(ROOT, 'LegalProBackend_Net', 'LegalPro.Infrastructure', 'Services'));
const orgIdMatches = grepFiles(servicesFiles, 'organization_id');
if (orgIdMatches.length > 0) {
  console.log('  OK: organization_id en JwtService');
} else {
  console.error('  FAIL: organization_id no encontrado en JwtService');
  totalErrors++;
}

// ─── Check 5: tenantMiddleware en Node ────────────────────────────────────────
console.log('\n[MT-05] Verificando tenantMiddleware en Node');
const authMiddlewarePath = join(ROOT, 'legalpro-app', 'server', 'middleware', 'authMiddleware.js');
const tenantMiddlewarePath = join(ROOT, 'legalpro-app', 'server', 'middleware', 'tenantMiddleware.js');

const authMwContent = readFileSafe(authMiddlewarePath);
const tenantMwContent = readFileSafe(tenantMiddlewarePath);

const hasTenantInAuth = authMwContent.includes('tenantMiddleware') || authMwContent.includes('requireTenant');
const hasTenantFile = tenantMwContent.length > 0 && tenantMwContent.includes('tenantMiddleware');

if (hasTenantInAuth && hasTenantFile) {
  console.log('  OK: tenantMiddleware presente en authMiddleware.js y tenantMiddleware.js');
} else if (hasTenantInAuth) {
  console.log('  OK: tenantMiddleware presente en authMiddleware.js');
} else if (hasTenantFile) {
  console.log('  OK: tenantMiddleware presente en tenantMiddleware.js');
} else {
  console.error('  FAIL: tenantMiddleware no encontrado');
  totalErrors++;
}

// ─── Check 6: RLS en catalogos ────────────────────────────────────────────────
console.log('\n[MT-06] Verificando que RLS este documentado en catalogos');
const supabaseSchemaPath = join(ROOT, 'catalogs', 'supabase-schema.md');
const schemaContent = readFileSafe(supabaseSchemaPath);
const rlsMatches = schemaContent.match(/ENABLE ROW LEVEL SECURITY/gi);
const count = rlsMatches ? rlsMatches.length : 0;
if (count >= 5) {
  console.log(`  OK: RLS documentado en ${count} tablas`);
} else {
  console.warn(`  WARN: RLS solo en ${count} tablas (esperaba >=5)`);
  totalWarnings++;
}

// ─── Resumen ──────────────────────────────────────────────────────────────────
console.log('\n=== Resumen ===');
console.log(`Errores: ${totalErrors}`);
console.log(`Warnings: ${totalWarnings}`);

if (totalErrors > 0) {
  console.error('\nFAIL: Multi-tenant violations detected');
  process.exit(1);
}

console.log('\nOK: Multi-tenant verification passed');
process.exit(0);
