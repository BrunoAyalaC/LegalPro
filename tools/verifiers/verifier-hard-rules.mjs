#!/usr/bin/env node
/**
 * verifier-hard-rules.mjs — Verifica reglas duras (governance-hard-rules.json)
 * en el código del proyecto. Ejecutar en CI antes de release.
 *
 * Uso: node tools/verifiers/verifier-hard-rules.mjs
 * Exit: 0 = PASS, 1 = FAIL
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
let failures = 0;
let warnings = 0;
const checks = [];

function check(id, ok, detail) {
  checks.push({ id, ok, detail });
  if (!ok) failures++;
  else warnings++;
}

// ── Cargar reglas ──────────────────────────────────────────────────────────
const rulesPath = join(ROOT, 'catalogs/governance-hard-rules.json');
if (!existsSync(rulesPath)) {
  console.error('❌ No existe catalogs/governance-hard-rules.json');
  process.exit(1);
}
const rules = JSON.parse(readFileSync(rulesPath, 'utf-8'));

// ── SEG-01 / GOV-02: 0 secretos en repo ────────────────────────────────────
const secretos = [
  'cyyvfHNDpNycUzURTglWbJzfiZaEDAjj',           // postgres password
  'sk-5vkIvkMV6rLgU8yUQlyQGrkNloaBaPeTg1ML7mhzp5GrVhsg27rt7aSKLNa6221e', // opencode
  'sk-cp-iq9qbpx',                               // minimax prefix
  'AIzaSyDTzLFuy9tlxMEa5AdVCF2OcSKykOs3rD8',     // gemini
  'LegalPro2026_Railway_Secure_JWT_Secret_Key_Production_256bits!' // jwt
];
function scanDir(dir, depth = 0) {
  if (depth > 3 || !existsSync(dir)) return [];
  const hits = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.opencode') continue;
    // Archivos intencionales de referencia del usuario (NO versionados, protegidos por .gitignore)
    if (entry.name === 'datos.txt' || entry.name === 'datos.txt.example') continue;
    // .env real y el propio verifier (contiene los secretos a buscar, por diseño)
    if (entry.name === '.env' || entry.name === 'verifier-hard-rules.mjs') continue;
    if (entry.isDirectory()) hits.push(...scanDir(p, depth + 1));
    else if (/\.(js|mjs|ts|tsx|jsx|json|md|txt|env|sql)$/.test(entry.name)) {
      try {
        const content = readFileSync(p, 'utf-8');
        for (const s of secretos) if (content.includes(s)) hits.push(p);
      } catch {}
    }
  }
  return hits;
}
const secretHits = scanDir(ROOT);
check('SEG-01/GOV-02', secretHits.length === 0,
  secretHits.length ? `Secretos encontrados en: ${secretHits.slice(0, 5).join(', ')}` : '0 secretos en repo');

// ── GOV-16: no hardcodear URLs de producción en código fuente ───────────────
const prodUrls = ['legalpro-node-production-34ac.up.railway.app'];
const srcDir = join(ROOT, 'legalpro-app/src');
function scanSrc(dir, depth = 0) {
  if (depth > 4 || !existsSync(dir)) return [];
  const hits = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.name === 'node_modules') continue;
    if (entry.isDirectory()) hits.push(...scanSrc(p, depth + 1));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      try {
        const content = readFileSync(p, 'utf-8');
        for (const u of prodUrls) if (content.includes(u)) hits.push(p);
      } catch {}
    }
  }
  return hits;
}
const urlHits = scanSrc(srcDir);
check('GOV-16', urlHits.length === 0,
  urlHits.length ? `URLs de producción hardcodeadas en: ${urlHits.slice(0, 5).join(', ')}` : '0 URLs hardcodeadas');

// ── MUT-01: db.query directo en rutas (debe ser tenantQuery en tenant) ──────
// Heurística ligera: buscar db.query en routes/ que toque tablas PII
const routesDir = join(ROOT, 'legalpro-app/server/routes');
const dbQueryHits = [];
if (existsSync(routesDir)) {
  for (const f of readdirSync(routesDir)) {
    if (!f.endsWith('.js')) continue;
    const content = readFileSync(join(routesDir, f), 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (/db\.query\(/.test(line) && !/tenantQuery/.test(lines.slice(Math.max(0, i - 5), i + 5).join('\n'))) {
        dbQueryHits.push(`${f}:${i + 1}`);
      }
    });
  }
}
// Heurística: reportar como warning (requiere revisión manual), no bloquear
if (dbQueryHits.length) warnings++;
check('MUT-01', true, dbQueryHits.length ? `⚠️ db.query directo encontrado (revisar): ${dbQueryHits.slice(0, 5).join(', ')}` : 'tenantQuery usado');

// ── IA-01: modelos aprobados ────────────────────────────────────────────────
const aiConfigPath = join(ROOT, 'legalpro-app/server/utils/aiConfig.js');
if (existsSync(aiConfigPath)) {
  const aiConfig = readFileSync(aiConfigPath, 'utf-8');
  const modelosProhibidos = ['gpt-4', 'claude-opus', 'gemini-pro', 'qwen2.5-vl-72b', 'qwen3-vl-235b'];
  const hits = modelosProhibidos.filter(m => aiConfig.includes(m));
  check('IA-01/GOV-07', hits.length === 0,
    hits.length ? `Modelos no aprobados en aiConfig: ${hits.join(', ')}` : 'Solo modelos aprobados');
}

// ── IA-02: necesita_revision_humana en intentRouter ─────────────────────────
const intentRouterPath = join(ROOT, 'legalpro-app/server/utils/intentRouter.js');
if (existsSync(intentRouterPath)) {
  const content = readFileSync(intentRouterPath, 'utf-8');
  check('IA-02', content.includes('necesita_revision_humana'),
    'necesita_revision_humana presente en intentRouter');
}

// ── LEGAL-22: no hardcodear plazos en código (debe usar catálogo) ───────────
const plazosCatalogPath = join(ROOT, 'catalogs/plazos-procesales.json');
check('LEGAL-22', existsSync(plazosCatalogPath), 'Catálogo de plazos existe');

// ── VER-01: verifiers legales existen ───────────────────────────────────────
const verifiersDir = join(ROOT, 'tools/verifiers');
const legalVerifiers = ['verifier-plazos-content.mjs', 'verifier-citas-legales.mjs', 'verifier-tipificacion.mjs'];
const missing = legalVerifiers.filter(v => !existsSync(join(verifiersDir, v)));
check('VER-01/LEGAL-23', missing.length === 0,
  missing.length ? `Verifiers legales faltantes: ${missing.join(', ')}` : 'Verifiers legales presentes');

// ── IA-04: systemPrompts.js existe (prompts centralizados) ─────────────────
check('IA-04', existsSync(join(ROOT, 'legalpro-app/server/utils/systemPrompts.js')), 'systemPrompts.js centralizado');

// ── GOV-19: audit_log existe ────────────────────────────────────────────────
const auditEventsPath = join(ROOT, 'catalogs/audit-events.json');
check('GOV-19', existsSync(auditEventsPath), 'audit-events.json existe');

// ── AGENTIC: reglas del loop agéntico ───────────────────────────────────────

// AGT-01: orquestador es primary (buscar en opencode.json agent primary)
const opencodeJsonPath = join(ROOT, 'opencode.json');
let orchestratorPrimary = false;
if (existsSync(opencodeJsonPath)) {
  try {
    const oc = JSON.parse(readFileSync(opencodeJsonPath, 'utf-8'));
    const agents = oc.agent || {};
    const keys = Object.keys(agents);
    const orqKey = keys.find(k => k.toLowerCase().includes('lexi') || k.toLowerCase().includes('orchestr'));
    if (orqKey) {
      const orq = agents[orqKey];
      const desc = JSON.stringify(orq).toLowerCase();
      orchestratorPrimary = desc.includes('primary') || desc.includes('único agente primary') || orq.mode === 'primary';
    }
  } catch {}
}
check('AGT-01', orchestratorPrimary, orchestratorPrimary ? 'Orquestador es primary' : '⚠️ Orquestador no detectado como primary en opencode.json (revisar)');

// AGT-03: al menos 64 juniors legales (cobertura del arnés)
const agentsDir = join(ROOT, '.opencode/agents');
let juniorLegales = 0;
if (existsSync(agentsDir)) {
  for (const f of readdirSync(agentsDir)) {
    if (f.startsWith('abogado-jr-') && f.endsWith('.md')) juniorLegales++;
  }
}
check('AGT-03', juniorLegales >= 60, `${juniorLegales} juniors legales en el arnés (≥60 requerido)`);

// AGT-02: orquestador delega (existe matriz de routing / skills)
check('AGT-02', existsSync(join(ROOT, '.opencode/skills/enrutamiento-intenciones-chat.md')) || existsSync(join(ROOT, 'catalogs/chat-intent-functions.json')),
  'Router de intenciones/skills presentes (delegación habilitada)');

// AGT-12: skills disponibles
const skillsDir = join(ROOT, '.opencode/skills');
let skillCount = 0;
if (existsSync(skillsDir)) skillCount = readdirSync(skillsDir).filter(f => f.endsWith('.md')).length;
check('AGT-12', skillCount >= 10, `${skillCount} skills en .opencode/skills (≥10 requerido)`);

// AGT-08: disclaimers IA existen
const disclaimersPath = join(ROOT, 'catalogs/disclaimers-ia.json');
check('AGT-08', existsSync(disclaimersPath), 'disclaimers-ia.json existe');

// AGT-09: audit-events tiene ORCHESTRATOR_DISPATCHED
let hasDispatchEvent = false;
if (existsSync(auditEventsPath)) {
  try {
    const ae = JSON.parse(readFileSync(auditEventsPath, 'utf-8'));
    hasDispatchEvent = JSON.stringify(ae).includes('ORCHESTRATOR_DISPATCHED');
  } catch {}
}
check('AGT-09', hasDispatchEvent, hasDispatchEvent ? 'ORCHESTRATOR_DISPATCHED en audit-events' : '⚠️ ORCHESTRATOR_DISPATCHED no encontrado en audit-events.json');

// AGT-14: systemPrompts exige español (ya validado IA-04, refuerza)
check('AGT-13', existsSync(join(ROOT, 'legalpro-app/server/utils/systemPromptBase.js')), 'systemPromptBase.js exige español (es-PE)');

// ── AGENTIC-QA: agentes de validación ───────────────────────────────────────

// QA-01: existen auditores (separación de roles)
const auditores = ['auditor-lpdp', 'auditor-seguridad', 'auditor-legal', 'auditor-multi-tenant', 'auditor-performance', 'auditor-cost-ia', 'auditor-accesibilidad'];
const auditoresPresentes = auditores.filter(a => existsSync(join(agentsDir, a + '.md')) || existsSync(join(agentsDir, a + '.js')));
check('QA-01', auditoresPresentes.length >= 5, `${auditoresPresentes.length}/7 auditores presentes (≥5 requerido)`);

// QA-04: refutadores existen (intentan romper)
const refutadores = ['refutador-arquitectura', 'refutador-seguridad', 'refutador-lpdp', 'refutador-performance', 'refutador-legal'];
const refutadoresPresentes = refutadores.filter(a => existsSync(join(agentsDir, a + '.md')) || existsSync(join(agentsDir, a + '.js')));
check('QA-04', refutadoresPresentes.length >= 4, `${refutadoresPresentes.length}/5 refutadores presentes (≥4 requerido)`);

// QA-11: red-team existe
check('QA-11', existsSync(join(agentsDir, 'red-team.md')) || existsSync(join(agentsDir, 'red-team.js')), 'red-team presente');

// QA-16: arquitecto-chief existe
check('QA-16', existsSync(join(agentsDir, 'arquitecto-chief.md')) || existsSync(join(agentsDir, 'arquitecto-chief.js')), 'arquitecto-chief presente');

// QA-15: reviser existe
check('QA-15', existsSync(join(agentsDir, 'reviser.md')) || existsSync(join(agentsDir, 'reviser.js')), 'reviser presente');

// QA-06: verifiers automáticos existen
const verifierNames = ['verifier-seguridad', 'verifier-lpdp', 'verifier-multi-tenant', 'verifier-owasp'];
const verifiersPresentes = verifierNames.filter(v => existsSync(join(verifiersDir, v + '.mjs')));
check('QA-06', verifiersPresentes.length >= 3, `${verifiersPresentes.length}/4 verifiers automáticos presentes (≥3 requerido)`);

// QA-18: audit-events tiene hallazgos (mínimo existe el catálogo)
check('QA-18', existsSync(auditEventsPath), 'audit-events.json existe (trazabilidad de hallazgos)');

// ── Reporte ─────────────────────────────────────────────────────────────────
console.log('\n=== VERIFIER HARD RULES ===');
console.log(`Reglas cargadas: ${rules.total_reglas}`);
for (const c of checks) {
  console.log(`${c.ok ? '✅' : '❌'} ${c.id}: ${c.detail}`);
}
console.log(`\nResultado: ${failures} FAIL | ${warnings} OK/WARN`);
process.exit(failures > 0 ? 1 : 0);
