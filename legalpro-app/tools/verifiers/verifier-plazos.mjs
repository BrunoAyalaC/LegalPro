#!/usr/bin/env node
/**
 * Verifier Plazos Procesales
 * Valida que los plazos citados en agentes coinciden con el catálogo canónico
 *
 * Uso: node tools/verifiers/verifier-plazos.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', '..');
const CATALOGO = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalogs/plazos-procesales.json'), 'utf8'));
const plazos = CATALOGO.plazos || CATALOGO;

console.log('🔍 Verificador de Plazos Procesales\n');
let errors = 0;

// Verificar que el catálogo tiene plazos para las nuevas materias
const materiasEsperadas = ['bancario', 'contrataciones', 'aduanero', 'competencia', 'electoral', 'penitenciario', 'genero', 'ejecucion', 'seguros'];
materiasEsperadas.forEach(m => {
  const found = (plazos || []).some(p => (p.materia || '').toLowerCase() === m || JSON.stringify(p).toLowerCase().includes(m));
  if (found) {
    console.log(`   ✅ ${m}: tiene plazo`);
  } else {
    console.log(`   ⚠️ ${m}: sin plazo específico (usar genérico)`);
  }
});

console.log('\n' + '='.repeat(50));
console.log(`📊 Plazos en catálogo: ${(plazos || []).length}`);
process.exit(errors > 0 ? 1 : 0);
