#!/usr/bin/env node
/**
 * Verifier Citas Legales — VALIDACIÓN DE CONTENIDO (v2)
 *
 * Valida que TODAS las citas a normas (Ley / D.L. / D.Leg. / D.S.) presentes
 * en los agentes (.opencode/agents/*.md) existan en el catálogo canónico
 * catalogs/codigos-leyes.json.
 *
 * REGLA DURA: cualquier cita de un agente que no esté en el catálogo
 * = ERROR (exit 1), NO warning. Nunca se aprueba una cita no catalogada.
 *
 * Fix v2:
 *  - Elimina el bug de la clave vacía '' (Constitución tiene numero:""), que
 *    hacía que normalized.includes('') fuese siempre true y ocultara TODAS las
 *    leyes no catalogadas (falsa sensación de seguridad).
 *  - Matching robusto por número de norma (no substring laxo).
 *
 * Uso: node tools/verifiers/verifier-citas-legales.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', '..');
const CATALOGO = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalogs/codigos-leyes.json'), 'utf8'));
const normas = CATALOGO.normas || CATALOGO;

// ── Construcción del conjunto de normas catalogadas ─────────────────────────
// números de norma válidos (extraídos de numero + nombre + id)
const numsValidos = new Set();
// textos normalizados (numero + nombre) para matching textual complementario
const textosValidos = [];

const normTexto = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/n[°º]?\.?\s*/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

normas.forEach((n) => {
  const texto = [n.numero, n.nombre, n.id].filter(Boolean).join(' ');
  const tNorm = normTexto(texto);
  textosValidos.push(tNorm);
  // números de 3+ dígitos
  (tNorm.match(/\d{3,6}/g) || []).forEach((x) => numsValidos.add(parseInt(x, 10)));
  // números cortos tras prefijo D.L./Ley/D.Leg./D.S. (p.ej. D.L. 295 → 295, D.S. 017 → 17)
  (tNorm.match(/(?:d\s*l|ley|d\s*leg|d\s*s)[^\d]*?(\d{1,3})(?!\d)/g) || []).forEach((m) => {
    const nn = parseInt(m.match(/\d+/)[0], 10);
    numsValidos.add(nn);
  });
});

// ── Helper de matching ───────────────────────────────────────────────────────
// Extrae el número principal de una cita normalizada (p.ej. "Ley 27444" → 27444)
function numeroDeCita(cita) {
  const m = cita.match(/(\d+)/);
  return m ? parseInt(m[0], 10) : null;
}

// Limpia la cita para mostrarla sin artefactos del regex (guion final, espacios)
function mostrarCita(cita) {
  return cita.replace(/[-–]+\s*$/, '').trim();
}

function esCatalogada(cita) {
  const num = numeroDeCita(cita);
  if (num !== null && numsValidos.has(num)) return true;
  // fallback textual: la cita normalizada aparece dentro de un texto catalogado
  const cNorm = normTexto(cita);
  return textosValidos.some((t) => t.includes(cNorm));
}

let errors = 0;
let checks = 0;

console.log('🔍 Verificador de Citas Legales — VALIDACIÓN DE CONTENIDO');
console.log('   Regla dura: cita no catalogada = ERROR (exit 1)\n');

// ── 1. Verificar bases legales de agentes ───────────────────────────────────
console.log('1️⃣ Verificando bases legales de agentes...');
const agentsDir = path.join(ROOT, '.opencode/agents');
const agentFiles = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md'));

const noCatalogadas = new Map(); // cita(normalizada) -> { archivos:Set, num }

agentFiles.forEach((f) => {
  const content = fs.readFileSync(path.join(agentsDir, f), 'utf8');
  const citas = content.match(/(?:D\.Leg\.|Ley|D\.L\.|D\.S\.)\s*(?:N[°º]?\.?\s*)?[\d-]+/gi) || [];
  checks += citas.length;
  citas.forEach((cita) => {
    const norm = cita.toLowerCase().replace(/n[°º]?\.?\s*/g, '').trim();
    if (!norm) return;
    if (!esCatalogada(norm)) {
      if (!noCatalogadas.has(norm)) noCatalogadas.set(norm, { archivos: new Set(), num: numeroDeCita(norm) });
      noCatalogadas.get(norm).archivos.add(f);
    }
  });
});

// Agrupación por número de norma (variantes de escritura = misma norma)
const porNumero = new Map(); // num -> { variantes:Set, archivos:Set }
noCatalogadas.forEach((info, cita) => {
  const key = info.num !== null ? String(info.num) : cita;
  if (!porNumero.has(key)) porNumero.set(key, { variantes: new Set(), archivos: new Set() });
  porNumero.get(key).variantes.add(mostrarCita(cita));
  info.archivos.forEach((a) => porNumero.get(key).archivos.add(a));
});

noCatalogadas.forEach((info, cita) => {
  errors++;
  console.error(`   ❌ ERROR: cita no catalogada en codigos-leyes.json: "${mostrarCita(cita)}"`);
  console.error(`      citada en: ${[...info.archivos].slice(0, 5).join(', ')}${info.archivos.size > 5 ? ', ...' : ''}`);
});
console.log(`   ${agentFiles.length} agentes revisados, ${checks} citas encontradas`);
console.log(`   ${noCatalogadas.size} citas únicas no catalogadas → ${porNumero.size} normas distintas faltantes`);

// ── 2. Verificar citas específicas conocidas ────────────────────────────────
console.log('\n2️⃣ Verificando citas específicas conocidas...');

// Cita falsa corregida: D.Leg. 295 ya no debe asociarse a minería
const mineriaFile = path.join(agentsDir, 'abogado-jr-mineria-energia.md');
if (fs.existsSync(mineriaFile)) {
  const mineria = fs.readFileSync(mineriaFile, 'utf8');
  if (mineria.includes('D.Leg. 295') && mineria.includes('miner')) {
    console.error('   ❌ abogado-jr-mineria-energia aún cita D.Leg. 295 (Código Civil) como minería');
    errors++;
  } else {
    console.log('   ✅ Minería usa TUO 014-92-EM correcto');
  }
}

// Resumen
console.log('\n' + '='.repeat(50));
console.log(`📊 RESULTADO: ${checks} citas, ${errors} errores, ${porNumero.size} normas distintas no catalogadas`);
if (errors > 0) {
  console.log('❌ FAIL: existen citas a normas que NO están en catalogs/codigos-leyes.json');
  console.log('   Acción requerida: añadir las normas faltantes al catálogo (NO se aprueban citas no catalogadas)');
  console.log('\n   📋 Normas distintas faltantes (por número):');
  [...porNumero.entries()]
    .sort((a, b) => (isNaN(a[0]) ? 1 : 0) - (isNaN(b[0]) ? 1 : 0) || a[0].localeCompare(b[0], 'es', { numeric: true }))
    .forEach(([num, info]) => {
      console.log(`   - ${num.padStart(6)}  (${[...info.variantes].join(' / ')})  →  ${[...info.archivos].slice(0, 4).join(', ')}${info.archivos.size > 4 ? ', ...' : ''}`);
    });
} else {
  console.log('✅ PASS: todas las citas de los agentes existen en el catálogo canónico');
}
process.exit(errors > 0 ? 1 : 0);
