// Corregir: quitar skill auditar-lpdp de los 10 abogados-jr (no les corresponde)
import { readFileSync, writeFileSync } from 'fs';

const juniors = ['adulto-mayor','ciberespacio','cooperativo','cultura','deporte','discapacidad','militar','policial','seguros','turismo'];
const skillLine = '- `auditar-lpdp`\n';
let fixed = 0;

for (const j of juniors) {
  const f = `.opencode/agents/abogado-jr-${j}.md`;
  let content = readFileSync(f, 'utf-8');
  if (content.includes(skillLine)) {
    content = content.replace(skillLine, '');
    writeFileSync(f, content, 'utf-8');
    fixed++;
    console.log('✅ corregido:', f);
  } else {
    console.log('⚠️ patrón no encontrado en', f, '(revisar formato)');
  }
}
console.log('Total corregidos:', fixed);
