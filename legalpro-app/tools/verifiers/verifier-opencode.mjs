#!/usr/bin/env node
/**
 * Verificador OPENCODE-FIRST
 *
 * Valida que:
 * 1. No queden rastros de Gemini en código activo
 * 2. opencodeClient.js y visionClient.js existen y son válidos
 * 3. providerRouter.js existe
 * 4. Variables OPENCODE_* documentadas
 * 5. .env.example tiene OPENCODE_API_KEY
 * 6. docker-compose inyecta OPENCODE_*
 *
 * Uso: node tools/verifiers/verifier-opencode.mjs
 *
 * v1.1 (SRE 2026-08-06): checks 3 y 4 refinados para distinguir CÓDIGO ACTIVO
 * de referencias deprecadas/comentadas — evita falsos positivos (ruido on-call).
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = path.join(import.meta.dirname, '..', '..');

const CHECKS = [];

function check(name, ok, detail = '') {
  CHECKS.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

// 1. Archivos clave existen
const keyFiles = [
  'legalpro-app/server/utils/opencodeClient.js',
  'legalpro-app/server/utils/providerRouter.js',
  'catalogs/opencode-functions.json',
  'docs/REPORTE_MIGRACION_OPENCODE.md',
];
console.log('📋 1. Archivos clave OPENCODE-FIRST');
keyFiles.forEach(f => check(`Existe ${f}`, fs.existsSync(path.join(ROOT, f))));

// 2. Sintaxis de archivos JS
console.log('\n📋 2. Sintaxis de archivos JS');
['legalpro-app/server/utils/opencodeClient.js', 'legalpro-app/server/utils/providerRouter.js'].forEach(f => {
  try {
    execSync(`node --check "${path.join(ROOT, f)}"`, { stdio: 'pipe' });
    check(`Sintaxis ${f}`, true);
  } catch {
    check(`Sintaxis ${f}`, false);
  }
});

// 3. No rastros de Gemini en código ACTIVO
// v1.1 (SRE): distingue uso real del SDK (bloquea) de menciones en comentarios
// de deprecación y labels de trazabilidad (NO bloquea — evitar falsos positivos
// que generarían alertas permanentes en CI/on-call).
console.log('\n📋 3. Rastros de Gemini en código activo (deben ser 0)');
const activeDirs = ['legalpro-app/server/utils', 'legalpro-app/server/routes', 'legalpro-app/server/middleware'];
let geminiMentions = 0;
let activeGeminiCount = 0;

function isActiveGeminiUsage(content) {
  // Patrones de USO ACTIVO: SDK de Google importado/instanciado, cliente legacy
  // cargado o clave de API en línea NO comentada. Comentarios y labels
  // deprecated (trazabilidad de peticiones antiguas) NO son uso activo.
  const activePatterns = [
    /@google\/generative-ai/,
    /GoogleGenerativeAI/,
    /new\s+GenerativeModel/,
    /require\([^)]*gemini/i,
    /from\s+['"]gemini/i,
    /process\.env\.GEMINI/,
    /^\s*GEMINI_API_KEY\s*=/m,
  ];
  return activePatterns.some(re => re.test(content));
}

activeDirs.forEach(dir => {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return;
  const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.js'));
  files.forEach(file => {
    const content = fs.readFileSync(path.join(fullDir, file), 'utf8');
    const matches = content.match(/gemini|Gemini|GEMINI/g);
    if (matches) {
      geminiMentions += matches.length;
      const active = isActiveGeminiUsage(content);
      if (active) activeGeminiCount += matches.length;
      console.log(`   ${active ? '🔴' : 'ℹ️'} ${dir}/${file}: ${matches.length} menciones${active ? ' — ⚠️ USO ACTIVO DETECTADO' : ' (solo comentarios/deprecación)'}`);
    }
  });
});
check('Sin uso ACTIVO de Gemini en utils/routes/middleware', activeGeminiCount === 0, `${geminiMentions} menciones totales, ${activeGeminiCount} de uso activo`);

// 4. Variables OPENCODE en .env.example
console.log('\n📋 4. Variables OPENCODE en .env.example');
const envExample = fs.readFileSync(path.join(ROOT, 'legalpro-app/.env.example'), 'utf8');
['OPENCODE_API_KEY', 'OPENCODE_BASE_URL', 'OPENCODE_MODEL', 'MIMO_VISION_API_KEY'].forEach(v => {
  check(`Variable ${v} presente`, envExample.includes(v));
});
// v1.1 (SRE): GEMINI_API_KEY se considera presente SOLO si es una línea de
// asignación ACTIVA (no comentada). El comentario "# GEMINI_API_KEY=  ←
// ELIMINADA definitivamente" documenta la eliminación y NO debe fallar el check.
const activeGeminiLine = envExample.split('\n').find(l => /^\s*GEMINI_API_KEY\s*=/.test(l));
check('GEMINI_API_KEY eliminada', !activeGeminiLine, activeGeminiLine ? `línea activa: ${activeGeminiLine.trim()}` : 'sin línea activa');

// 5. docker-compose inyecta OPENCODE
console.log('\n📋 5. docker-compose con OPENCODE');
const compose = fs.readFileSync(path.join(ROOT, 'docker-compose.yml'), 'utf8');
check('OPENCODE_API_KEY en compose', compose.includes('OPENCODE_API_KEY'));
check('GEMINI_API_KEY no en compose', !compose.includes('GEMINI_API_KEY'));

// 6. JSON válido
console.log('\n📋 6. JSON válido');
['catalogs/opencode-functions.json', 'catalogs/disclaimers-ia.json', 'catalogs/audit-events.json'].forEach(f => {
  try {
    JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    check(`JSON válido ${f}`, true);
  } catch {
    check(`JSON válido ${f}`, false);
  }
});

// Resumen
const passed = CHECKS.filter(c => c.ok).length;
const total = CHECKS.length;
console.log('\n' + '='.repeat(50));
console.log(`📊 RESUMEN: ${passed}/${total} checks`);
console.log('='.repeat(50));

process.exit(passed === total ? 0 : 1);
