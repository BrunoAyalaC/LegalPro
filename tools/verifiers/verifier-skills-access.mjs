#!/usr/bin/env node
/**
 * verifier-skills-access.mjs — Verifica que ningún subagente use skills que no le corresponden.
 * Fuente: catalogs/skill-access-control.json
 * Uso: node tools/verifiers/verifier-skills-access.mjs
 * Exit: 0 = PASS, 1 = FAIL
 */
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const agentsDir = join(ROOT, '.opencode/agents');
const skillsDir = join(ROOT, '.opencode/skills');
const controlPath = join(ROOT, 'catalogs/skill-access-control.json');

if (!existsSync(controlPath)) { console.error('❌ No existe catalogs/skill-access-control.json'); process.exit(1); }
if (!existsSync(skillsDir)) { console.error('❌ No existe .opencode/skills'); process.exit(1); }
if (!existsSync(agentsDir)) { console.error('❌ No existe .opencode/agents'); process.exit(1); }

const control = JSON.parse(readFileSync(controlPath, 'utf-8'));
const skills = readdirSync(skillsDir).filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
const agents = readdirSync(agentsDir).filter(f => f.endsWith('.md'));
const juniors = control.juniors_legales;

let failures = 0;
let checked = 0;

function usaLSkill(content, skill) {
  return content.includes(`- ${skill}`) || content.includes(`/${skill}`) || content.includes(`\`${skill}\``) || content.includes(`skills/${skill}`);
}

console.log('=== VERIFIER SKILLS ACCESS ===');
for (const agentFile of agents) {
  const agentName = agentFile.replace('.md', '');
  const content = readFileSync(join(agentsDir, agentFile), 'utf-8');

  // Determinar skills permitidas para este agente
  let permitidas = [];
  if (agentName === 'lexia-orchestrator') {
    permitidas = ['*']; // puede usar todas (re-delega)
  } else if (control.skills_por_agente[agentName]) {
    permitidas = control.skills_por_agente[agentName];
  } else if (juniors.pattern && agentName.startsWith(juniors.pattern.replace('*', ''))) {
    permitidas = juniors.skills_permitidas;
  }

  if (permitidas.includes('*')) continue; // orquestador: permitido todo

  for (const skill of skills) {
    if (!usaLSkill(content, skill)) continue;
    checked++;
    const permitida = permitidas.includes(skill);
    if (!permitida) {
      console.log(`❌ ${agentName} usa skill '${skill}' que NO le corresponde`);
      failures++;
    }
  }
}

console.log(`\nSkills referenciadas verificadas: ${checked}`);
console.log(`Resultado: ${failures} FAIL`);
process.exit(failures > 0 ? 1 : 0);
