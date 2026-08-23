// validador-fix-lpdp2.mjs
// Ejecuta: node tools/validador-fix-lpdp2.mjs
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

let pass = 0, fail = 0;

function check(label, ok) {
  const status = ok ? 'OK' : 'FAIL';
  if (ok) pass++; else fail++;
  console.log(`  [${status}] ${label}`);
}

console.log('=== VALIDACIÓN FIX LPDP-2 ===\n');

// 1. TRANSFERENCIA_INTERNACIONAL.md
console.log('[1] docs/TRANSFERENCIA_INTERNACIONAL.md');
const doc = readFileSync(resolve(ROOT, 'docs/TRANSFERENCIA_INTERNACIONAL.md'), 'utf8');
check('Sección 8 "Proveedores de Inteligencia Artificial"', doc.includes('## 8. Proveedores de Inteligencia Artificial'));
check('Subsección 8.1 MiniMax M3', doc.includes('### 8.1 MiniMax M3 (Proveedor Principal)'));
check('Subsección 8.2 Google Gemini (secundario/legacy)', doc.includes('### 8.2 Google Gemini (Proveedor Secundario / Legacy)'));
check('Sección 8.3 Etiquetado en la Aplicación', doc.includes('### 8.3 Etiquetado en la Aplicación'));
check('Sección 8.4 Asignación del proveedor por endpoint', doc.includes('### 8.4 Asignación del proveedor por endpoint'));
check('Sección 8.5 Principio de minimización', doc.includes('### 8.5 Principio de minimización'));
check('Versión v2.1 con fecha 2026-08-01', /\| 2\.1 \| 2026-08-01/.test(doc));
check('FIX LPDP-2 mencionado', doc.includes('FIX LPDP-2'));
check('Art. 21 LPDP mencionado', doc.includes('Art. 21'));
check('Badge "Procesado por [...]" documentado', doc.includes('Procesado por [MiniMax M3 | Google Gemini]'));
check('Variable MINIMAX_API_KEY', doc.includes('MINIMAX_API_KEY'));
check('Variable GOOGLE_GEMINI_API_KEY', doc.includes('GOOGLE_GEMINI_API_KEY'));

// 2. disclaimers-ia.json
console.log('\n[2] catalogs/disclaimers-ia.json');
const disc = JSON.parse(readFileSync(resolve(ROOT, 'catalogs/disclaimers-ia.json'), 'utf8'));
check('Versión 1.1.0', disc.version === '1.1.0');
check('proveedores_ia[] tiene 2 elementos', Array.isArray(disc.proveedores_ia) && disc.proveedores_ia.length === 2);
check('proveedor minimax en catálogo', disc.proveedores_ia?.some(p => p.id === 'minimax'));
check('proveedor gemini en catálogo', disc.proveedores_ia?.some(p => p.id === 'gemini'));
const ti = disc.disclaimers.find(d => d.id === 'disclaimer_transferencia_internacional');
check('disclaimer_transferencia_internacional presente', !!ti);
check('disclaimer TI incluye "art. 21"', ti?.texto?.includes('art. 21'));
check('disclaimer TI proveedores_aplicables=[minimax,gemini]', JSON.stringify(ti?.proveedores_aplicables) === '["minimax","gemini"]');
check('disclaimer TI parametrizable', !!ti?.parametrizable);
const provEsp = disc.disclaimers.find(d => d.id === 'disclaimer_proveedor_especifico');
check('disclaimer_proveedor_especifico presente', !!provEsp);

// 3. routes/ai.js
console.log('\n[3] legalpro-app/server/routes/ai.js');
const ai = readFileSync(resolve(ROOT, 'legalpro-app/server/routes/ai.js'), 'utf8');
check('IA_PROVIDER_DEFAULT definida', ai.includes('const IA_PROVIDER_DEFAULT'));
check('IA_PROVIDER_LABEL definida', ai.includes('const IA_PROVIDER_LABEL'));
check('Función resolveProvider()', ai.includes('function resolveProvider'));
check('Función withProvider()', ai.includes('function withProvider'));
check('withProvider en /chat (success)', ai.includes('return res.json(withProvider({ respuesta, tokens: response.usageMetadata'));
check('withProvider en /chat (cache hit)', ai.includes('return res.json(withProvider({ respuesta: cached, desdeCache: true'));
check('withProvider en /consulta (struct)', ai.includes('const payload = withProvider({ resultado, tipo, tokens:'));
check('withProvider en /consulta (free)', ai.includes('const payload = withProvider({ resultado: response.text'));
check('withProvider en /consulta (cache hit)', ai.includes('return res.json(withProvider(cached, req, model || MODEL));'));
check('withProvider en /jurisprudencia (cache hit)', ai.includes('return res.json(withProvider(cachedJuris'));
check('withProvider en /jurisprudencia (success)', ai.includes('const jurisPayload = withProvider'));
check('withProvider en /panel-expertos (cache hit)', ai.includes('return res.json(withProvider({ ...cachedConsolidado'));
check('withProvider en /panel-expertos (success)', /const payload = withProvider\(\{[\s\S]*?especialidades: espSeleccionados/.test(ai));
check('SSE provider start event (consulta/stream)', ai.includes("status: 'start', provider: streamProvider"));
check('SSE provider done event (consulta/stream)', ai.includes("done: true, tokens: totalTokens, provider: streamProvider"));
check('SSE provider start event (panel-expertos/stream)', ai.includes('panelStreamProvider'));
check('SSE provider done event (panel-expertos/stream)', ai.includes('panelStreamProvider'));

// 4. AIAssistantPanel.jsx
console.log('\n[4] legalpro-app/src/components/legal/AIAssistantPanel.jsx');
const panel = readFileSync(resolve(ROOT, 'legalpro-app/src/components/legal/AIAssistantPanel.jsx'), 'utf8');
check('IA_PROVIDERS catálogo', panel.includes('const IA_PROVIDERS'));
check('ProviderBadge componente', panel.includes('function ProviderBadge'));
check('Icon Cpu importado', panel.includes('Cpu'));
check('Estado activeProvider', panel.includes('useState(DEFAULT_PROVIDER)'));
check('Lee data.provider en sendMessage', panel.includes('data?.provider || DEFAULT_PROVIDER'));
check('Lee data.provider_label', panel.includes('data?.provider_label'));
check('ProviderBadge en header del panel', panel.includes('providerId={activeProvider}'));
check('ProviderBadge en MsgBubble', panel.includes('providerId={msg.provider}'));
check('"Powered by Gemini" hardcodeado eliminado', !panel.includes('Powered by Gemini'));
check('aria-label "Procesado por"', panel.includes('aria-label={`Procesado por'));
check('FIX LPDP-2 mencionado en comentarios', panel.includes('FIX LPDP-2'));

console.log(`\n=== RESULTADO: ${pass} OK / ${fail} FAIL ===`);
process.exit(fail > 0 ? 1 : 0);
