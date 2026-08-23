#!/usr/bin/env node
/**
 * Setup RAG - Configuración inicial del sistema RAG
 * 
 * Uso: node tools/rag/setup-rag.mjs
 * 
 * 1. Verifica prerequisites (playwright, pg, etc.)
 * 2. Crea schema en BD
 * 3. Indexa corpus inicial
 * 4. Configura CRON jobs
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';

const CHECKS = [
  { name: 'node', cmd: 'node --version', minVersion: '20.0.0' },
  { name: 'npm', cmd: 'npm --version', minVersion: '10.0.0' },
  { name: 'playwright', cmd: 'npx playwright --version' },
  { name: 'pg', cmd: 'npm list pg' },
];

const REQUIRED_ENV = [
  'DATABASE_URL',
  'OPENAI_API_KEY' // o GEMINI_API_KEY
];

console.log('🚀 Setup RAG - LegalPro\n');

// 1. Verificar prerequisites
console.log('📋 Verificando prerequisites...');
for (const check of CHECKS) {
  try {
    const output = execSync(check.cmd, { encoding: 'utf8', stdio: 'pipe' }).trim();
    console.log(`   ✅ ${check.name}: ${output.split('\n')[0]}`);
  } catch (err) {
    console.log(`   ⚠️  ${check.name}: No encontrado`);
  }
}

// 2. Verificar env vars
console.log('\n🔐 Verificando variables de entorno...');
const missing = REQUIRED_ENV.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error(`   ❌ Faltantes: ${missing.join(', ')}`);
  console.log('\n   Configúralas en .env:');
  console.log('   DATABASE_URL=postgresql://...');
  console.log('   OPENAI_API_KEY=sk-...');
  process.exit(1);
} else {
  console.log('   ✅ Todas las variables configuradas');
}

// 3. Verificar conexión a BD
console.log('\n💾 Verificando conexión a PostgreSQL...');
try {
  execSync(`node -e "import('pg').then(async ({default: pg}) => { const c = new pg.Client({connectionString: process.env.DATABASE_URL}); await c.connect(); const r = await c.query('SELECT version()'); console.log('   ✅', r.rows[0].version.split(' ').slice(0,2).join(' ')); await c.end(); })"`, { stdio: 'inherit' });
} catch (err) {
  console.error('   ❌ Error conectando a BD');
  process.exit(1);
}

// 4. Crear schema
console.log('\n📐 Creando schema RAG...');
try {
  execSync('node tools/rag/index-corpus.mjs', { stdio: 'inherit' });
} catch (err) {
  console.error('   ❌ Error creando schema');
  process.exit(1);
}

console.log('\n✅ Setup RAG completado');
console.log('\nPróximos pasos:');
console.log('   1. Configurar CRON en Railway (ver legalpro-app/railway.cron.json)');
console.log('   2. Verificar: node tools/rag/retrieve.mjs "tu consulta de prueba"');
console.log('   3. Integrar en /api/ai/consulta (feature flag)');
