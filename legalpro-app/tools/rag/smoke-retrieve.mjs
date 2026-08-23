#!/usr/bin/env node
/**
 * Prueba de humo del retrieval real contra rag_vectors_v2 (solo lectura).
 * Verifica que con el nuevo hash semántico-ligero el retrieval híbrido sigue
 * funcionando: cuenta chunks existentes y ejecuta una query real sin escribir.
 *
 * Uso:
 *   node --env-file=.env tools/rag/smoke-retrieve.mjs "demanda de alimentos"
 */
import { retrieve, retrieveHybrid, closeRetrievePool, fueHashFallback } from './retrieve.mjs';
import pg from 'pg';

const query = process.argv[2] || 'demanda de alimentos';
// node --env-file incluye comillas literales en algunos formatos de .env;
// se normaliza el valor para evitar "Invalid URL" en pg.
const DB = String(process.env.DATABASE_URL || '')
  .trim()
  .replace(/^["']|["']$/g, '');

if (!DB) {
  console.error('❌ DATABASE_URL no configurada');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DB });
await client.connect();

const { rows: countRows } = await client.query(
  `SELECT source, COUNT(*)::int AS n FROM rag_vectors_v2 GROUP BY source ORDER BY n DESC`
);
console.log('📦 Chunks actuales en rag_vectors_v2:');
for (const r of countRows) console.log(`   ${String(r.n).padStart(4)}  ${r.source}`);

const { rows: totalRows } = await client.query('SELECT COUNT(*)::int AS total FROM rag_vectors_v2');
console.log(`   TOTAL: ${totalRows[0].total}`);
await client.end();

console.log(`\n🔍 Query: "${query}"`);
const results = await retrieveHybrid(query, {
  topK: 5,
  threshold: 0.15,
  filter: {},
});
console.log(`   Modo hash fallback: ${fueHashFallback()}`);
console.log(`   Resultados: ${results.length}`);
results.forEach((r) => {
  const meta = r.metadata || {};
  console.log(`   [${r.rank}] ${r.source} | materia=${meta.materia || '-'} | tipo=${meta.tipo || '-'}`);
  console.log(`        score=${r.similarity} sem=${r.semanticSimilarity} kw=${r.keywordScore} boost=${r.keyword_boost ?? '-'}`);
  console.log(`        ${String(r.content).substring(0, 110)}...`);
});

await closeRetrievePool();
process.exit(0);
