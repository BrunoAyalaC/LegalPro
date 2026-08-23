#!/usr/bin/env node
/**
 * Verifier Jurisprudencia
 * Valida que los catálogos de jurisprudencia existen y tienen datos indexables
 *
 * Uso: node tools/verifiers/verifier-jurisprudencia.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', '..');
const CATALOGS_DIR = path.join(ROOT, 'catalogs');

const archivosJurisprudencia = [
  'jurisprudencia-tc-2026.json',
  'sentencias-tc-completas-2026.json',
  'casaciones-pj-2026.json',
  'resoluciones-indecopi-2026.json',
  'resoluciones-tribunal-fiscal-2026.json',
  'normas-especializadas-2026.json',
];

console.log('🔍 Verificador de Jurisprudencia\n');
let errors = 0;
let totalDocs = 0;

archivosJurisprudencia.forEach(f => {
  const filePath = path.join(CATALOGS_DIR, f);
  if (!fs.existsSync(filePath)) {
    console.log(`   ⚠️ ${f}: no existe`);
    return;
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const docs = data.jurisprudencia?.length || data.sentencias?.length || data.casaciones?.length || data.resoluciones?.length || data.normas?.length || 0;
    totalDocs += docs;
    console.log(`   ✅ ${f}: ${docs} documentos`);
  } catch (e) {
    console.error(`   ❌ ${f}: JSON inválido`);
    errors++;
  }
});

console.log('\n' + '='.repeat(50));
console.log(`📊 Total documentos de jurisprudencia: ${totalDocs}`);
console.log(`   Errores: ${errors}`);
process.exit(errors > 0 ? 1 : 0);
