// optimize-junior-agents.mjs — Inyecta "Protocolo de Precisión v2" en .opencode/agents/abogado-jr-*.md
// Idempotente: skip si el archivo ya contiene el bloque. Actualiza arneses/registry/agents.json → protocolo_precision v2.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const AGENTS_DIR = join(ROOT, '.opencode', 'agents');
const REGISTRY = join(ROOT, 'arneses', 'registry', 'agents.json');

const FECHA = '2026-08-22';
const MARCADOR = '## Protocolo de Precisión v2';
const SENIOR_RX = /@abogado-senior-[a-z]+/i;

function bloque(materia, senior) {
  const ambito = `Ámbito de aplicación: materia **${materia}**${senior ? ` (escalar a ${senior})` : ''}.`;
  return `${MARCADOR} (${FECHA})

${ambito}

### P1 — PRECISIÓN LEGAL
- SOLO cita artículos que existan en catalogs/codigos-leyes.json o que el wrapper RAG haya recuperado con rag_verificado:true
- PROHIBIDO inventar número de artículo, fecha de publicación o denominación de norma. Si no estás seguro: escribe "[VERIFICAR EN SPIJ]" en lugar del dato
- Toda afirmación jurídica lleva formato: afirmación → [Art. N Norma] → fuente
- Si rag_degradado:true, antepón: "⚠ Respuesta sin verificación completa — confirmar en SPIJ"
- Duda razonable = escala a tu @abogado-senior correspondiente

### P2 — TRAZABILIDAD
- Estructura OBLIGATORIA de respuesta: {analisis, base_legal:[{articulo,norma,fuente}], confianza: ALTA|MEDIA|BAJA, escalado_a|null}
- confianza BAJA = siempre escalar automáticamente
- Emite audit log con query-hash antes de responder

### P3 — DISCLAIMERS IA (obligatorios, catálogo disclaimers-ia.json)
- Cierra SIEMPRE con los 4 disclaimers mínimos: no asesoría legal / verificar SPIJ / requiere revisión humana / análisis sujeto a interpretación
- Sin disclaimers = respuesta inválida

### P4 — EFICIENCIA
- RAG: topK máx 5, threshold según wrapper (no fuerces overrides)
- Respuestas ≤800 palabras salvo que pidan escrito completo
- No repitas el texto de la norma citada in extenso: cita artículo y resume`;
}

function splitFrontmatter(raw) {
  if (!raw.startsWith('---')) return { front: '', body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { front: '', body: raw };
  const cut = raw.indexOf('\n', end + 1);
  return { front: raw.slice(0, cut), body: raw.slice(cut) };
}

function inject(body, block) {
  const h = body.search(/^## Reglas duras\s*$/m);
  if (h === -1) return body.trimEnd() + '\n\n' + block + '\n';
  const next = body.slice(h + 1).search(/^## /m); // siguiente header top-level tras "Reglas duras"
  if (next === -1) return body.trimEnd() + '\n\n' + block + '\n';
  const pos = h + 1 + next;
  return body.slice(0, pos).trimEnd() + '\n\n' + block + '\n\n' + body.slice(pos).trimStart();
}

const files = readdirSync(AGENTS_DIR).filter(f => f.startsWith('abogado-jr-') && f.endsWith('.md'));
let actualizados = 0, skipped = 0;
const errores = [];

for (const f of files.sort()) {
  const path = join(AGENTS_DIR, f);
  try {
    const raw = readFileSync(path, 'utf8');
    if (raw.includes(MARCADOR)) { skipped++; console.log(`SKIP  ${f}`); continue; }
    const id = basename(f, '.md').replace(/^abogado-jr-/, '').split('-')[0]; // penal, laboral...
    const seniorM = raw.match(SENIOR_RX);
    const { front, body } = splitFrontmatter(raw);
    const out = front + inject(body, bloque(id, seniorM ? seniorM[0] : null));
    writeFileSync(path, out, 'utf8');
    actualizados++; console.log(`OK    ${f} (materia: ${id})`);
  } catch (e) {
    errores.push(`${f}: ${e.message}`); console.error(`ERROR ${f}: ${e.message}`);
  }
}

// ── Registry ──────────────────────────────────────────────────────────────
let regActualizados = 0;
try {
  const reg = JSON.parse(readFileSync(REGISTRY, 'utf8'));
  for (const a of reg.agentes || []) {
    if (typeof a.id === 'string' && a.id.startsWith('abogado-jr-')) {
      a.protocolo_precision = 'v2'; regActualizados++;
    }
  }
  reg.version = '3.3';
  reg.actualizado = FECHA;
  reg.reglas_v33 = {
    protocolo_precision: `Los ${regActualizados} agentes abogado-jr-* incluyen el Protocolo de Precisión v2 inyectado el ${FECHA}: P1 precisión legal (solo catálogos/RAG verificado, [VERIFICAR EN SPIJ]), P2 trazabilidad (estructura {analisis, base_legal, confianza, escalado_a} + audit log), P3 disclaimers IA obligatorios (disclaimers-ia.json), P4 eficiencia (RAG topK<=5, respuestas <=800 palabras).`
  };
  reg.total_agentes = Object.keys(reg).length && (reg.agentes?.length ?? reg.total_agentes);
  writeFileSync(REGISTRY, JSON.stringify(reg, null, 2) + '\n', 'utf8');
  console.log(`\nRegistry: version=${reg.version}, agentes abogado-jr-* marcados=${regActualizados}`);
} catch (e) {
  errores.push(`registry: ${e.message}`); console.error(`ERROR registry: ${e.message}`);
}

console.log(`\n=== RESUMEN ===`);
console.log(`Agentes .md: ${actualizados} actualizados, ${skipped} skipped, ${errores.length} errores`);
if (errores.length) { console.log('Errores:\n' + errores.map(e => ' - ' + e).join('\n')); process.exit(1); }
