#!/usr/bin/env node
/**
 * validate-repo.js — Validación pre-commit (invocado por .git/hooks/pre-commit).
 * Verifica que los archivos STAGED no incluyan temporales ni secretos.
 * Exit 0 = OK | Exit 1 = bloquear commit.
 */
import { execSync } from 'child_process';

const PATRONES_PELIGROSOS = [
  /\.(log|tmp|cache)$/i,          // temporales
  /^d_.*\.xml$/i,                 // dumps
  /^datos\.txt$/,                 // secretos locales (API keys)
  /^\.env(\..+)?$/,               // envs reales (los .env.example SÍ pasan)
  /(^|\/)node_modules\//,         // dependencias
];

let staged = [];
try {
  staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
    .split('\n').map(s => s.trim()).filter(Boolean);
} catch {
  console.error('✗ No se pudo leer el índice de git');
  process.exit(1);
}

const problemas = staged.filter(f =>
  PATRONES_PELIGROSOS.some(re => new RegExp(re.source, re.flags).test(f))
);

if (problemas.length > 0) {
  console.error('✗ Archivos temporales/peligrosos detectados en staging:');
  problemas.forEach(f => console.error('   - ' + f));
  console.error('💡 Remuévelos del stage: git restore --staged <archivo>');
  process.exit(1);
}

console.log(`✓ ${staged.length} archivos staged validados — sin temporales ni secretos`);
process.exit(0);
