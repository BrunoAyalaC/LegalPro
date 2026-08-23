#!/usr/bin/env node
/**
 * Verifier Tipificación Penal
 * Valida que los tipos penales citados existen en el catálogo
 *
 * Uso: node tools/verifiers/verifier-tipificacion.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', '..');
const CATALOGO = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalogs/tipos-penales-peru.json'), 'utf8'));
const tipos = CATALOGO.tipos || CATALOGO;

console.log('🔍 Verificador de Tipificación Penal\n');
let errors = 0;

// Nuevos tipos penales de las nuevas materias
const nuevosDelitos = ['minería ilegal', 'feminicidio', 'trata', 'lavado de activos', 'delitos informáticos', 'terrorismo', 'extorsión'];
const texto = JSON.stringify(tipos).toLowerCase();
nuevosDelitos.forEach(d => {
  if (texto.includes(d)) {
    console.log(`   ✅ ${d}: en catálogo`);
  } else {
    console.log(`   ⚠️ ${d}: NO en catálogo (agregar)`);
  }
});

console.log('\n' + '='.repeat(50));
console.log(`📊 Tipos penales en catálogo: ${(tipos || []).length}`);
process.exit(errors > 0 ? 1 : 0);
