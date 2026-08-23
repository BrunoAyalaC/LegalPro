#!/usr/bin/env node
/**
 * Daily Update Job - Actualiza el corpus RAG con normas recientes
 * 
 * Ejecutar diariamente vía CRON o Railway Scheduled Job
 * 
 * Cron sugerido: 0 6 * * * (todos los días a las 6am PET)
 * 
 * Uso:
 *   node tools/rag/daily-update.mjs                 # Actualización completa
 *   node tools/rag/daily-update.mjs --quick         # Solo normas del día
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, '..', '..', 'logs', 'rag-updates');

const SCRIPTS = {
  elperuano: 'tools/scrapers/elperuano-scraper.mjs',
  tc: 'tools/scrapers/tc-scraper.mjs',
  spij: 'tools/scrapers/spij-scraper.mjs',
  indexer: 'tools/rag/index-corpus.mjs'
};

async function runScript(name, args = []) {
  const script = SCRIPTS[name];
  const startTime = Date.now();
  console.log(`\n▶️  Ejecutando ${name} (${script})...`);
  
  try {
    const output = execSync(`node ${script} ${args.join(' ')}`, {
      cwd: path.join(__dirname, '..', '..'),
      encoding: 'utf8',
      timeout: 600000, // 10 minutos máximo
      stdio: 'inherit'
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ ${name} completado en ${elapsed}s`);
    return { success: true, output, elapsed };
  } catch (err) {
    console.error(`❌ Error en ${name}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function main() {
  const startTime = new Date();
  console.log('🚀 Daily RAG Update - LegalPro');
  console.log(`Inicio: ${startTime.toISOString()}\n`);
  
  // Crear directorio de logs
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
  
  const results = {};
  const args = process.argv.slice(2);
  const quick = args.includes('--quick');
  
  // 1. Scrapers en paralelo
  console.log('📥 FASE 1: Scraping de fuentes');
  if (!quick) {
    results.elperuano = await runScript('elperuano', ['--days=1']);
    results.tc = await runScript('tc', ['--limit=30']);
  } else {
    results.elperuano = await runScript('elperuano', ['--days=1']);
  }
  
  // 2. Re-indexar
  console.log('\n🔄 FASE 2: Re-indexación en pgvector');
  results.indexer = await runScript('indexer');
  
  // 3. Resumen
  const totalElapsed = ((Date.now() - startTime.getTime()) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN DE ACTUALIZACIÓN');
  console.log('='.repeat(50));
  
  for (const [name, result] of Object.entries(results)) {
    const status = result.success ? '✅' : '❌';
    console.log(`  ${status} ${name}: ${result.elapsed || 0}s`);
  }
  
  console.log(`\n⏱️  Tiempo total: ${totalElapsed}s`);
  
  // 4. Audit log
  const logFile = path.join(LOG_DIR, `update-${startTime.toISOString().split('T')[0]}.json`);
  const logData = {
    timestamp: startTime.toISOString(),
    duracion_segundos: parseFloat(totalElapsed),
    modo: quick ? 'quick' : 'completo',
    resultados: results,
    exitoso: Object.values(results).every(r => r.success)
  };
  fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
  console.log(`📋 Log: ${logFile}`);
  
  process.exit(logData.exitoso ? 0 : 1);
}

main().catch(err => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});
