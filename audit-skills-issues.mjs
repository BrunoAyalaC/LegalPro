// Auditar usos INCORRECTOS de skills: agentes usando skills que no les corresponden
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const agentsDir = join('C:/Users/Pc/Desktop/Abogacia/.opencode/agents');
const skillsDir = join('C:/Users/Pc/Desktop/Abogacia/.opencode/skills');
const skills = readdirSync(skillsDir).filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
const agents = readdirSync(agentsDir).filter(f => f.endsWith('.md'));

// Mapa esperado: skill -> agentes que DEBEN usarla (por competencia)
const skillOwners = {
  'auditar-lpdp': ['auditor-lpdp', 'refutador-lpdp', 'gobernanza-chief', 'lexia-orchestrator'],
  'auditar-seguridad': ['auditor-seguridad', 'refutador-seguridad', 'red-team', 'lexia-orchestrator'],
  'analizar-expediente': ['ia-analista-expedientes', 'abogado-jr-*', 'lexia-orchestrator'],
  'buscar-jurisprudencia': ['ia-buscador-jurisprudencia', 'ia-comparador-precendentes', 'ia-predictor-judicial', 'ia-chat-legal', 'abogado-jr-*', 'lexia-orchestrator'],
  'redactar-escrito-legal': ['ia-redactor-escritos', 'ia-generador-alegatos', 'abogado-asistente-redaccion', 'abogado-jr-*', 'lexia-orchestrator'],
  'rag-busqueda-semantica': ['ia-buscador-jurisprudencia', 'ia-analista-expedientes', 'ia-chat-legal', 'backend-node', 'database', 'lexia-orchestrator'],
  'enrutamiento-intenciones-chat': ['ia-chat-legal', 'ia-analista-expedientes', 'ia-buscador-jurisprudencia', 'backend-node', 'lexia-orchestrator'],
  'crear-endpoint': ['backend-node', 'backend-dotnet', 'lexia-orchestrator'],
  'crear-pagina': ['frontend', 'ux-ui', 'lexia-orchestrator'],
  'deploy-backend': ['devops', 'backend-node', 'lexia-orchestrator'],
  'configurar-minimax': ['backend-node', 'prompt-engineer', 'lexia-orchestrator'],
  'adaptadores-externos': ['backend-node', 'integraciones-peru', 'lexia-orchestrator'],
  'decoradores-patterns': ['backend-node', 'backend-dotnet', 'lexia-orchestrator'],
  'observadores-eventos': ['backend-node', 'backend-dotnet', 'lexia-orchestrator'],
  'protocolos-pipeline': ['backend-node', 'backend-dotnet', 'lexia-orchestrator'],
  'optimizadores-rendimiento': ['backend-node', 'frontend', 'auditor-performance', 'lexia-orchestrator'],
  'liquidacion-laboral': ['contador-laboralista', 'contador-senior-laboral', 'contador-jr-forense', 'contador-chief', 'lexia-orchestrator'],
  'analisis-riesgos-procesales': ['ia-analista-expedientes', 'abogado-jr-*', 'ia-predictor-judicial', 'lexia-orchestrator'],
  'objetivos-y-metas': ['planner-chief', 'product-owner', 'lexx-orchestrator', 'lexia-orchestrator']
};

console.log('=== USOS INCORRECTOS DE SKILLS ===');
let issues = 0;
for (const agentFile of agents) {
  const agentName = agentFile.replace('.md', '');
  const content = readFileSync(join(agentsDir, agentFile), 'utf-8');
  for (const s of skills) {
    const uses = content.includes(`- ${s}`) || content.includes(`/${s}`) || content.includes(`\`${s}\``) || content.includes(`skills/${s}`);
    if (!uses) continue;
    const owners = skillOwners[s] || ['lexia-orchestrator'];
    const allowed = owners.some(o => o === '*' || agentName === o || (o.endsWith('*') && agentName.startsWith(o.replace('*', ''))));
    if (!allowed) {
      console.log(`❌ ${agentName} usa skill '${s}' que NO le corresponde`);
      issues++;
    }
  }
}
console.log(`\nTotal usos incorrectos: ${issues}`);

console.log('\n=== AGENTES TÉCNICOS SIN SKILLS (deberían listar sus skills) ===');
const tecnicos = ['backend-node', 'frontend', 'database', 'devops', 'auditor-seguridad', 'auditor-lpdp', 'contador-laboralista', 'ia-redactor-escritos'];
for (const t of tecnicos) {
  const f = join(agentsDir, t + '.md');
  if (existsSync(f)) {
    const content = readFileSync(f, 'utf-8');
    const skillsUsed = skills.filter(s => content.includes(`- ${s}`) || content.includes(`/${s}`) || content.includes(`\`${s}\``));
    console.log(`  ${t}: usa ${skillsUsed.length} skills [${skillsUsed.join(', ')}]`);
  }
}
