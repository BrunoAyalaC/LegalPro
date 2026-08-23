#!/usr/bin/env node
/**
 * verifier-ldde-loop.mjs — Valida el Loop Driven Development Engine (LDDE).
 *
 * Checks:
 *   [LDDE-01] ldde-loop.json existe, parsea y tiene las 6 etapas S1-S6
 *   [LDDE-02] Toda skill en skills.json está cubierta por algún loop de categoría
 *   [LDDE-03] Todos los agentes referenciados en loops existen en agents.json y son mode:subagent
 *   [LDDE-04] Ningún agente del arnés declara campo model propio (regla v3.2: heredan del primary)
 *   [LDDE-05] Solo lexia-orchestrator es mode:primary (primary único)
 *   [LDDE-06] Todos los gates_verifiers existen en tools/verifiers/
 *   [LDDE-07] Coherencia skills.json.agente_owner ⊆ skill-access-control.skills_por_agente
 *   [LDDE-08] loop_roles_ldde: ningún refutador/optimizador es owner de la skill que evalúa (anti-robo)
 *
 * Uso: node tools/verifiers/verifier-ldde-loop.mjs
 * Exit: 0 = PASS, 1 = FAIL
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

let failures = 0;
let checks = 0;
const ok = (id, msg) => { checks++; console.log(`OK: [${id}] ${msg}`); };
const fail = (id, msg) => { checks++; failures++; console.log(`❌ [${id}] ${msg}`); };

function loadJson(path, label) {
  const p = join(ROOT, path);
  if (!existsSync(p)) { fail('LOAD', `No existe ${label}: ${path}`); return null; }
  try { return JSON.parse(readFileSync(p, 'utf-8')); }
  catch (e) { fail('LOAD', `${label} JSON inválido: ${e.message}`); return null; }
}

console.log('=== VERIFIER LDDE LOOP ===\n');

// ─── Cargas ───────────────────────────────────────────────────────────────
const ldde = loadJson('arneses/registry/ldde-loop.json', 'ldde-loop.json');
const agents = loadJson('arneses/registry/agents.json', 'agents.json');
const skills = loadJson('arneses/registry/skills.json', 'skills.json');
const access = loadJson('catalogs/skill-access-control.json', 'skill-access-control.json');
if (!ldde || !agents || !skills || !access) { console.log(`\nResultado: ${failures} FAIL`); process.exit(1); }

const agentIds = new Set((agents.agentes || []).map(a => a.id));
const agentById = new Map((agents.agentes || []).map(a => [a.id, a]));
const skillNames = new Set((skills.skills_creados || []).map(s => s.name));

// ─── LDDE-01: estructura del loop ─────────────────────────────────────────
const etapaIds = (ldde.etapas || []).map(e => e.id);
const esperadas = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
if (esperadas.every(id => etapaIds.includes(id))) ok('LDDE-01', `6 etapas presentes (${etapaIds.join(',')})`);
else fail('LDDE-01', `Etapas incompletas: faltan ${esperadas.filter(id => !etapaIds.includes(id)).join(',')}`);

// ─── LDDE-02: cobertura de skills por loops ───────────────────────────────
const cats = ldde.loops_por_categoria || {};
const coveredSkills = new Set();
for (const [cat, cfg] of Object.entries(cats)) {
  for (const s of cfg.skills || []) coveredSkills.add(s);
}
const sinLoop = [...skillNames].filter(s => !coveredSkills.has(s));
if (sinLoop.length === 0) ok('LDDE-02', `Todas las ${skillNames.size} skills cubiertas por un loop`);
else fail('LDDE-02', `Skills SIN loop LDDE: ${sinLoop.join(', ')}`);

// ─── LDDE-03: agentes de loops existen y son subagent ─────────────────────
let refsInvalidas = [], refsPrimary = [];
const cleanRef = (r) => r.replace('@', '');
for (const [cat, cfg] of Object.entries(cats)) {
  const refs = [
    ...(cfg.auditores || []), ...(cfg.refutadores || []),
    ...(cfg.optimizadores || []), ...(cfg.seguridad || [])
  ].map(cleanRef);
  for (const ref of refs) {
    if (!agentIds.has(ref)) refsInvalidas.push(`${cat}:${ref}`);
    else if (agentById.get(ref).mode !== 'subagent') refsPrimary.push(`${cat}:${ref}`);
  }
}
if (refsInvalidas.length === 0) ok('LDDE-03a', 'Todos los agentes de loops existen en agents.json');
else fail('LDDE-03a', `Agentes inexistentes referenciados: ${refsInvalidas.join(', ')}`);
if (refsPrimary.length === 0) ok('LDDE-03b', 'Ningún agente de loop es primary (todos subagent)');
else fail('LDDE-03b', `Agentes primary en loops (prohibido): ${refsPrimary.join(', ')}`);

// ─── LDDE-04: ningún agente con model propio ──────────────────────────────
const conModel = (agents.agentes || [])
  .filter(a => a.model !== null && a.model !== undefined && a.model !== '' )
  .map(a => a.id);
if (conModel.length === 0) ok('LDDE-04', 'Ningún agente declara model propio (todos model:null → heredan del primary)');
else fail('LDDE-04', `Agentes con model propio (violación v3.2): ${conModel.join(', ')}`);

// ─── LDDE-05: primary único ───────────────────────────────────────────────
const primaries = (agents.agentes || []).filter(a => a.mode === 'primary').map(a => a.id);
if (primaries.length === 1 && primaries[0] === 'lexia-orchestrator') ok('LDDE-05', 'Primary único: lexia-orchestrator');
else fail('LDDE-05', `Primaries detectados (${primaries.length}): ${primaries.join(', ')} — debe ser solo lexia-orchestrator`);

// ─── LDDE-06: verifiers de gate existen en disco ──────────────────────────
const verifiersDir = join(ROOT, 'tools/verifiers');
let gatesFaltantes = [];
for (const [cat, cfg] of Object.entries(cats)) {
  for (const g of cfg.gates_verifiers || []) {
    if (!existsSync(join(verifiersDir, g))) gatesFaltantes.push(`${cat}:${g}`);
  }
}
if (gatesFaltantes.length === 0) ok('LDDE-06', 'Todos los gates_verifiers existen en tools/verifiers/');
else fail('LDDE-06', `Gates verifiers FALTANTES en disco: ${gatesFaltantes.join(', ')}`);

// ─── LDDE-07: ownership coherente con matriz de acceso ────────────────────
const spa = access.skills_por_agente || {};
let ownersSinAcceso = [];
for (const s of skills.skills_creados || []) {
  const owner = (s.agente_owner || '').replace('@', '').split(' o ')[0].trim();
  if (!owner || owner === 'lexia-orchestrator') continue;
  const permitidas = spa[owner];
  if (!permitidas) { ownersSinAcceso.push(`${s.name}: owner ${owner} no está en la matriz`); continue; }
  if (!permitidas.includes('*') && !permitidas.includes(s.name)) {
    ownersSinAcceso.push(`${s.name}: owner ${owner} no la tiene autorizada`);
  }
}
if (ownersSinAcceso.length === 0) ok('LDDE-07', 'Owners de skills tienen acceso autorizado en la matriz');
else fail('LDDE-07', `Incoherencias owner/matriz: ${ownersSinAcceso.join(' | ')}`);

// ─── LDDE-08: anti-robo — refutador/optimizador no es owner de skill evaluada ──
let roboDetectado = [];
const rolesPlanos = [];
for (const [cat, cfg] of Object.entries(cats)) {
  for (const r of cfg.refutadores || []) rolesPlanos.push({ cat, rol: 'refutador', agent: cleanRef(r), skills: cfg.skills });
  for (const r of cfg.optimizadores || []) rolesPlanos.push({ cat, rol: 'optimizador', agent: cleanRef(r), skills: cfg.skills });
}
for (const s of skills.skills_creados || []) {
  const owner = (s.agente_owner || '').replace('@', '').split(' o ')[0].trim();
  for (const rp of rolesPlanos) {
    if (rp.agent === owner && rp.skills.includes(s.name)) {
      // Excepción legítima: auditor-performance optimiza su propia skill performance
      if (!(rp.rol === 'optimizador' && rp.agent === 'auditor-performance')) {
        roboDetectado.push(`${rp.agent} es ${rp.rol} de '${s.name}' cuya skill posee (conflicto builder/refuter)`);
      }
    }
  }
}
if (roboDetectado.length === 0) ok('LDDE-08', 'Anti-robo: ningún refutador/optimizador evalúa skills que él mismo construye');
else fail('LDDE-08', `Conflictos builder/refuter: ${roboDetectado.join(' | ')}`);

// ─── Resumen ──────────────────────────────────────────────────────────────
console.log(`\nChecks ejecutados: ${checks}`);
console.log(`Resultado: ${failures} FAIL`);
process.exit(failures > 0 ? 1 : 0);
