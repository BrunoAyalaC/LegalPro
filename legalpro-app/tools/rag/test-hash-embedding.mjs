#!/usr/bin/env node
/**
 * Test local del hash embedding semántico-ligero (sin BD, sin API).
 *
 * Verifica:
 *   1. Dimensión = 1536 (compatible con vector(1536) de rag_vectors_v2)
 *   2. Rango [0,1] y norma L2 ≈ 1 (coseno = producto punto ponderado)
 *   3. Similitud "demanda de alimentos" vs "alimentos" > 0.5 (requisito)
 *   4. Similitud entre textos con términos legales comunes > 0
 *   5. Determinismo (mismo texto → mismo vector)
 *   6. Discriminación (textos distintos → similitud baja)
 *
 * Uso:
 *   node tools/rag/test-hash-embedding.mjs
 */

import { hashEmbedding, cosineSimilarity, tokenizarEspanol } from './retrieve.mjs';

const DIMS = 1536;

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${msg}`);
  }
}

const vDemanda = hashEmbedding('demanda de alimentos', DIMS);
const vAlimentos = hashEmbedding('alimentos', DIMS);

// 1) Dimensión
assert(vDemanda.length === DIMS && vAlimentos.length === DIMS,
  `dimensión = ${DIMS} (vector(${DIMS})) — obtenida ${vDemanda.length}`);

// 2) Rango [0,1] y norma L2 ≈ 1
const rangoOK = vDemanda.every((x) => x >= 0 && x <= 1) && vAlimentos.every((x) => x >= 0 && x <= 1);
assert(rangoOK, 'rango [0,1] en ambos vectores');

const normL2 = (v) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
assert(Math.abs(normL2(vDemanda) - 1) < 1e-6 && Math.abs(normL2(vAlimentos) - 1) < 1e-6,
  `norma L2 ≈ 1 (${normL2(vDemanda).toFixed(6)}, ${normL2(vAlimentos).toFixed(6)})`);

// 3) Similitud "demanda de alimentos" vs "alimentos" > 0.5
const simAlimentos = cosineSimilarity(vDemanda, vAlimentos);
assert(simAlimentos > 0.5,
  `similitud('demanda de alimentos', 'alimentos') = ${simAlimentos.toFixed(4)} > 0.5`);

// 4) Términos legales comunes → similitud alta
const pares = [
  ['prescripción adquisitiva de dominio', 'prescripción adquisitiva'],
  ['pensión de alimentos para menor', 'obligación alimentaria'],
  ['desalojo por ocupación precaria', 'desalojo precario'],
  ['robo agravado con arma', 'robo agravado'],
  ['divorcio por causal de separación de hecho', 'separación de hecho']
];
for (const [a, b] of pares) {
  const s = cosineSimilarity(hashEmbedding(a, DIMS), hashEmbedding(b, DIMS));
  assert(s > 0.3, `similitud('${a.substring(0, 30)}…', '${b.substring(0, 30)}…') = ${s.toFixed(4)} > 0.3`);
}

// 5) Determinismo (mismo texto → vector idéntico, tolerancia floats)
const vDemanda2 = hashEmbedding('demanda de alimentos', DIMS);
const diffMax = Math.max(...vDemanda.map((x, i) => Math.abs(x - vDemanda2[i])));
assert(diffMax < 1e-9, `determinismo: mismo texto → mismo vector (max diff = ${diffMax.toExponential(2)})`);

// 6) Discriminación: textos de materias distintas → similitud baja
const vTributario = hashEmbedding('IGV impuesto general a las ventas tasa 18 por ciento', DIMS);
const vPenal = hashEmbedding('hurto simple pena privativa libertad código penal', DIMS);
const simDisc = cosineSimilarity(vTributario, vPenal);
assert(simDisc < 0.5, `discriminación: tributario vs penal = ${simDisc.toFixed(4)} < 0.5`);

// 7) Tokenización español exportada
const tokens = tokenizarEspanol('demanda de alimentos');
assert(Array.isArray(tokens) && tokens.includes('alimentos') && !tokens.includes('de'),
  `tokenizarEspanol quita stopwords: ['${tokens.join("', '")}']`);

console.log('');
if (process.exitCode) {
  console.log('❌ Test hash embedding: FALLÓ');
} else {
  console.log('🎉 Test hash embedding: PASS — similitud semántica ligera sin API, 1536 dims, rango [0,1]');
}
