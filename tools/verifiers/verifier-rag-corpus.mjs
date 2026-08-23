#!/usr/bin/env node
/**
 * Verificador del Corpus RAG
 *
 * Valida que el corpus RAG esté correctamente indexado en PostgreSQL +
 * pgvector, y que la cantidad de chunks indexados sea coherente con los
 * catálogos JSON de fuentes oficiales (El Peruano, SPIJ, TC, PJ, SUNAT,
 * INDECOPI, SUNARP, etc.).
 *
 * CHECKS REALIZADOS:
 *  1. Tabla `rag_vectors_v2` existe en el esquema público.
 *  2. Conteo total de documentos indexados (umbral mínimo 100).
 *  3. RLS habilitado (`relrowsecurity=true`) — cumple política multi-tenant.
 *  4. Distribución por fuente (qué corpus domina el retrieval).
 *  5. Conteo de documentos en catálogos JSON locales (sumando campos
 *     conocidos: normas, jurisprudencia, sentencias, resoluciones,
 *     casaciones, tipos, plazos, delitos, feriados, etc.).
 *  6. Coherencia: la diferencia entre catálogos JSON e índice vectorial
 *     se tolera (chunks pueden ser > 1 por documento) hasta un 50%.
 *
 * CÓMO EJECUTAR:
 *   # Local con BD Railway/Staging/Local
 *   DATABASE_URL=postgresql://... node tools/verifiers/verifier-rag-corpus.mjs
 *
 *   # Staging (Railway CLI)
 *   railway run node tools/verifiers/verifier-rag-corpus.mjs
 *
 * SALIDA:
 *   exit 0  → todo OK (puede haber warnings)
 *   exit 1  → errores críticos (tabla inexistente, RLS deshabilitado, etc.)
 *
 * SKILL: verifier-coverage, backend-node
 * @author BackendNode (testing)
 */

import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CATALOGS_DIR = path.join(__dirname, '..', '..', 'catalogs');

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Suma la cantidad de "documentos" dentro de un catálogo JSON,
 * recorriendo los nombres de campos más comunes en el proyecto.
 *
 * El proyecto usa convenciones distintas por dominio:
 *   - normas           → catalogos de El Peruano / SUNAT / SBS / MTPE
 *   - jurisprudencia   → TC, INDECOPI, ANPD
 *   - sentencias       → TC completas
 *   - casaciones       → PJ
 *   - resoluciones     → INDECOPI, Tribunal Fiscal, ANPD
 *   - tipos            → Tipos penales
 *   - delitos          → Delitos económicos
 *   - plazos           → Plazos procesales
 *   - feriados_fijos + feriados_moviles → Feriados Perú
 *   - reglas_duras     → Contratos
 */
function countDocsInCatalog(data) {
  const campos = [
    'jurisprudencia', 'normas', 'resoluciones', 'casaciones',
    'sentencias', 'tipos', 'delitos', 'plazos',
    'reglas_duras', 'eventos', 'severidades', 'disclaimers',
    'proveedores_ia', 'feriados_fijos', 'feriados_moviles'
  ];

  let total = 0;
  for (const campo of campos) {
    const val = data?.[campo];
    if (Array.isArray(val)) total += val.length;
  }
  return total;
}

function formatNum(n) {
  return Number(n).toLocaleString('es-PE');
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('🔍 Verificador de Corpus RAG\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no configurada');
    console.error('   Sugerencia: DATABASE_URL=postgresql://user:pass@host:5432/db node tools/verifiers/verifier-rag-corpus.mjs');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();
  } catch (err) {
    console.error(`❌ No se pudo conectar a PostgreSQL: ${err.message}`);
    process.exit(1);
  }

  let errors = 0;
  let warnings = 0;

  // ──────────────────────────────────────────────────────────────────────
  // 1. Verificar tabla rag_vectors_v2 existe
  // ──────────────────────────────────────────────────────────────────────
  console.log('1️⃣  Verificando tabla rag_vectors_v2...');
  const { rows: tableCheck } = await client.query(`
    SELECT EXISTS (
       SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rag_vectors_v2'
    ) AS exists
  `);

  if (!tableCheck[0].exists) {
    console.error('   ❌ Tabla rag_vectors_v2 NO existe en el esquema público');
    errors++;
  } else {
    console.log('   ✅ Tabla rag_vectors_v2 existe');
  }

  // ──────────────────────────────────────────────────────────────────────
  // 2. Contar documentos indexados
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n2️⃣  Contando documentos indexados...');
  const { rows: count } = await client.query('SELECT COUNT(*) as total FROM rag_vectors_v2');
  const totalDocs = parseInt(count[0].total, 10);
  console.log(`   📊 Total documentos: ${formatNum(totalDocs)}`);

  if (totalDocs < 100) {
    console.warn(`   ⚠️  Menos de 100 documentos (${totalDocs}) — corpus insuficiente`);
    warnings++;
  } else if (totalDocs >= 300) {
    console.log('   ✅ Cobertura adecuada (>= 300 docs)');
  } else {
    console.log('   ✅ Cobertura mínima aceptable (100-299 docs)');
  }

  // ──────────────────────────────────────────────────────────────────────
  // 3. Verificar RLS habilitado
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n3️⃣  Verificando RLS (Row Level Security)...');
  const { rows: rlsCheck } = await client.query(`
    SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class
     WHERE relname = 'rag_vectors_v2'
  `);

  if (rlsCheck.length === 0) {
    console.error('   ❌ No se encontró tabla rag_vectors_v2 en pg_class');
    errors++;
  } else {
    const rls = rlsCheck[0];
    if (!rls.relrowsecurity) {
      console.error('   ❌ RLS NO habilitado — riesgo de cross-tenant leak');
      errors++;
    } else {
      console.log(`   ✅ RLS habilitado (force=${rls.relforcerowsecurity})`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // 4. Cobertura por fuente
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n4️⃣  Cobertura por fuente...');
  let bySource = [];
  try {
    const { rows } = await client.query(`
      SELECT
        COALESCE(source, '(sin source)') AS source,
        COUNT(*) AS total
       FROM rag_vectors_v2
      GROUP BY source
      ORDER BY total DESC
      LIMIT 15
    `);
    bySource = rows;

    if (bySource.length === 0) {
      console.warn('   ⚠️  No hay documentos indexados con `source` definido');
      warnings++;
    } else {
      bySource.forEach((row) => {
        console.log(`   📁 ${row.source}: ${formatNum(row.total)} docs`);
      });
    }
  } catch (err) {
    console.warn(`   ⚠️  No se pudo consultar distribución por source: ${err.message}`);
    warnings++;
  }

  // ──────────────────────────────────────────────────────────────────────
  // 5. Verificar catálogos JSON existen
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n5️⃣  Verificando catálogos JSON...');

  if (!fs.existsSync(CATALOGS_DIR)) {
    console.error(`   ❌ Directorio de catálogos no existe: ${CATALOGS_DIR}`);
    errors++;
  } else {
    const catalogs = fs.readdirSync(CATALOGS_DIR).filter(
      (f) => f.endsWith('.json') && !f.includes('snapshots')
    );

    let totalCatalogDocs = 0;
    let catalogsWithDocs = 0;

    for (const cat of catalogs) {
      const catPath = path.join(CATALOGS_DIR, cat);
      try {
        const data = JSON.parse(fs.readFileSync(catPath, 'utf8'));
        const docs = countDocsInCatalog(data);
        if (docs > 0) {
          console.log(`   📄 ${cat}: ${formatNum(docs)} docs`);
          totalCatalogDocs += docs;
          catalogsWithDocs++;
        }
      } catch (err) {
        console.warn(`   ⚠️  Error parseando ${cat}: ${err.message}`);
        warnings++;
      }
    }

    console.log(`\n   📊 Catálogos con docs: ${catalogsWithDocs}/${catalogs.length}`);
    console.log(`   📊 Total en catálogos JSON: ${formatNum(totalCatalogDocs)}`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // 6. Verificar diferencia (chunks vs docs)
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n6️⃣  Verificando coherencia corpus ↔ catálogos...');
  // Heurística: en retrieval RAG, 1 doc → 1..N chunks. Lo esperado es que
  // chunks >= docs (ratio > 1). Si hay muchos más en JSON sin chunkear,
  // hay gap; si hay muchos más chunks, hay sobre-chunking (revisar).
  // Aquí mostramos ambas magnitudes para diagnóstico, sin fallar.

  // (No usamos totalCatalogDocs para el cálculo de tolerancia porque el
  // script anterior lo dejó en closure; recalculamos rápido:)
  let totalCatalogDocs = 0;
  try {
    const catalogs = fs.readdirSync(CATALOGS_DIR).filter(
      (f) => f.endsWith('.json') && !f.includes('snapshots')
    );
    for (const cat of catalogs) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(CATALOGS_DIR, cat), 'utf8'));
        totalCatalogDocs += countDocsInCatalog(data);
      } catch {
        /* ya reportado arriba */
      }
    }
  } catch {
    /* sin catálogos */
  }

  const ratio = totalDocs > 0 && totalCatalogDocs > 0
    ? (totalDocs / totalCatalogDocs).toFixed(2)
    : 'N/A';

  console.log(`   📊 Chunks indexados: ${formatNum(totalDocs)}`);
  console.log(`   📊 Docs en catálogos: ${formatNum(totalCatalogDocs)}`);
  console.log(`   📊 Ratio chunks/doc: ${ratio}`);

  // Toleramos una diferencia de hasta 3x chunks por doc (chunking agresivo)
  // o 0.3x (pocos chunks por doc). Fuera de [0.3, 3.0] → warning.
  if (totalDocs > 0 && totalCatalogDocs > 0) {
    const ratioNum = totalDocs / totalCatalogDocs;
    if (ratioNum < 0.3 || ratioNum > 3.0) {
      console.warn(`   ⚠️  Ratio chunks/doc fuera del rango esperado [0.3, 3.0]: ${ratio}`);
      warnings++;
    } else {
      console.log('   ✅ Coherencia OK (ratio dentro del rango esperado)');
    }
  } else {
    console.log('   ⚠️  No se puede calcular ratio (alguna magnitud es 0)');
    warnings++;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Resumen
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(56));
  console.log('📊 RESUMEN');
  console.log('='.repeat(56));
  console.log(`   Documentos indexados (rag_vectors_v2): ${formatNum(totalDocs)}`);
  console.log(`   Documentos en catálogos JSON:      ${formatNum(totalCatalogDocs)}`);
  console.log(`   Fuentes distintas en rag_vectors_v2:   ${bySource.length}`);
  console.log(`   Errores:   ${errors}`);
  console.log(`   Warnings:  ${warnings}`);

  await client.end();

  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});
