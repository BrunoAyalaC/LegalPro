// Auditar skills usadas por cada agente (busca referencias a skills en archivos de agentes)
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const agentsDir = join('C:/Users/Pc/Desktop/Abogacia/.opencode/agents');
const skillsDir = join('C:/Users/Pc/Desktop/Abogacia/.opencode/skills');
const skills = readdirSync(skillsDir).filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
const agents = readdirSync(agentsDir).filter(f => f.endsWith('.md'));

// Mapa: skill -> agentes que la referencian
const skillUsage = {};
for (const s of skills) skillUsage[s] = [];

for (const agentFile of agents) {
  const content = readFileSync(join(agentsDir, agentFile), 'utf-8');
  for (const s of skills) {
    // Buscar menciones: - skill-name, `skill-name`, /skills/skill-name
    if (content.includes(`- ${s}`) || content.includes(`/${s}`) || content.includes(`\`${s}\``) || content.includes(`skills/${s}`)) {
      skillUsage[s].push(agentFile.replace('.md', ''));
    }
  }
}

console.log('=== SKILLS Y AGENTES QUE LAS USAN ===');
for (const s of skills) {
  const users = skillUsage[s];
  console.log(`\n[${s}] (${users.length} agentes)`);
  if (users.length) console.log('  ', users.join(', '));
  else console.log('   (sin agentes que la referencien explícitamente)');
}
