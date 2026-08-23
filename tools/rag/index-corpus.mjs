#!/usr/bin/env node
/**
 * RAG Corpus Indexer para LegalPro
 *
 * Indexa todos los catalogos legales actualizados al 01/08/2026
 * en la base de datos vectorial (Supabase pgvector).
 *
 * Uso:
 *   node tools/rag/index-corpus.mjs
 *
 * Requiere:
 *   - DATABASE_URL (con pgvector habilitado)
 *   - OPENAI_API_KEY (o GEMINI_API_KEY) para embeddings
 *
 * @version 1.0.0
 * @date 2026-08-01
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CATALOGS_DIR = path.join(__dirname, '..', '..', 'catalogs');

// ==========================================
// CONFIGURACIÓN
// ==========================================

const CONFIG = {
  embeddingModel: process.env.RAG_EMBEDDING_MODEL || 'text-embedding-3-small',
  // [2026-08-07] Tabla objetivo: rag_vectors_v2 (la tabla v1 rag_vectors fue dropeada).
  // rag_vectors_v2 define embedding vector(1536). text-embedding-3-small (OpenAI)
  // devuelve 1536 dims por defecto. OJO: gemini embedding-001 devuelve 768 dims,
  // no usarlo como proveedor contra rag_vectors_v2 (dimension mismatch).
  embeddingDimensions: 1536, // debe coincidir con vector(1536) de rag_vectors_v2
  chunkSize: 512, // tokens
  chunkOverlap: 64,
  topK: 5,
  similarityThreshold: 0.75,
  batchSize: 10,
  sources: [
    // CATÁLOGOS BASE (existente)
    'codigos-leyes.json',
    'plazos-procesales.json',
    'tipos-penales-peru.json',
    'delitos-economicos.json',
    'disclaimers-ia.json',
    // CATÁLOGOS NUEVOS (actualizados al 01/08/2026)
    'jurisprudencia-tc-2026.json',
    'normas-minjusdh-2026.json',
    'resoluciones-indecopi-2026.json',
    // AMPLIACIÓN DE COBERTURA (30 nuevas materias del arnés)
    'normas-especializadas-2026.json'
  ]
};

// ==========================================
// CHUNKER (Estrategia inteligente por documento)
// ==========================================

function chunkLegalDocument(doc, sourceFile) {
  const chunks = [];
  const sourceId = doc.id || `${sourceFile}-${chunks.length}`;

  // Chunk por sección/objeto principal
  const content = JSON.stringify(doc);
  const baseMetadata = {
    source: sourceFile,
    tipo: doc.tipo || sourceFile.replace('.json', ''),
    materia: doc.materia || 'general',
    fecha: doc.fecha_sentencia || doc.fecha_publicacion || doc.fecha || null,
    url: doc.url_fuente || null,
    relevancia_legalpro: doc.relevancia_legalpro || 'MEDIA'
  };

  // Estrategia 1: Si el doc tiene 'sumilla' o contenido principal, hacer chunks específicos
  if (doc.sumilla) {
    chunks.push({
      id: `${sourceId}-sumilla`,
      content: doc.sumilla,
      metadata: {
        ...baseMetadata,
        seccion: 'sumilla',
        palabras_clave: doc.palabras_clave || []
      }
    });
  }

  if (doc.titulo) {
    chunks.push({
      id: `${sourceId}-titulo`,
      content: `${doc.titulo}. ${doc.sumilla || ''}`,
      metadata: {
        ...baseMetadata,
        seccion: 'titulo'
      }
    });
  }

  if (doc.caso) {
    chunks.push({
      id: `${sourceId}-caso`,
      content: `${doc.caso}. ${doc.sumilla || ''}`,
      metadata: {
        ...baseMetadata,
        seccion: 'caso'
      }
    });
  }

  // Si no hay campos específicos, hacer chunk del documento completo
  if (chunks.length === 0) {
    chunks.push({
      id: sourceId,
      content: content.substring(0, 2000),
      metadata: baseMetadata
    });
  }

  // Estrategia 2: Para arrays de jurisprudencia/normas, agregar chunk de palabras clave
  if (doc.palabras_clave && Array.isArray(doc.palabras_clave)) {
    chunks.push({
      id: `${sourceId}-keywords`,
      content: `Palabras clave: ${doc.palabras_clave.join(', ')}. ${doc.sumilla || doc.titulo || ''}`,
      metadata: {
        ...baseMetadata,
        seccion: 'keywords'
      }
    });
  }

  return chunks;
}

// ==========================================
// EMBEDDINGS (OpenAI / Gemini)
// ==========================================

async function generateEmbedding(text) {
  // Si usamos OpenAI
  if (process.env.OPENAI_API_KEY) {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: CONFIG.embeddingModel,
        input: text.substring(0, 8000), // Límite tokens
        encoding_format: 'float'
      })
    });
    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json();
    return data.data[0].embedding;
  }

  // Si usamos Gemini
  if (process.env.GEMINI_API_KEY) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/embedding-001',
          content: { parts: [{ text: text.substring(0, 8000) }] }
        })
      }
    );
    if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
    const data = await res.json();
    return data.embedding.values;
  }

  throw new Error('No embedding provider configured (OPENAI_API_KEY o GEMINI_API_KEY)');
}

// ==========================================
// STORAGE (PostgreSQL con pgvector)
// ==========================================

async function ensureSchema(client) {
  await client.query(`
    CREATE EXTENSION IF NOT EXISTS vector;

    CREATE TABLE IF NOT EXISTS rag_vectors_v2 (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding vector(${CONFIG.embeddingDimensions}),
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_v2_source
      ON rag_vectors_v2(source);

    CREATE INDEX IF NOT EXISTS idx_v2_materia
      ON rag_vectors_v2 USING GIN ((metadata->>'materia'));

    CREATE INDEX IF NOT EXISTS idx_v2_embedding
      ON rag_vectors_v2 USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 50);

    ALTER TABLE rag_vectors_v2 ENABLE ROW LEVEL SECURITY;
  `);
  console.log('✅ Schema RAG verificado/creado');
}

async function upsertChunk(client, chunk) {
  const embedding = await generateEmbedding(chunk.content);
  const vectorStr = `[${embedding.join(',')}]`;

  await client.query(
    `
    INSERT INTO rag_vectors_v2 (id, source, content, embedding, metadata, updated_at)
    VALUES ($1, $2, $3, $4::vector, $5::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET
      source = EXCLUDED.source,
      content = EXCLUDED.content,
      embedding = EXCLUDED.embedding,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
  `,
    [chunk.id, chunk.metadata.source, chunk.content, vectorStr, JSON.stringify(chunk.metadata)]
  );
}

// ==========================================
// ORQUESTACIÓN PRINCIPAL
// ==========================================

async function main() {
  console.log('🚀 RAG Corpus Indexer - LegalPro');
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log(`Modelo embeddings: ${CONFIG.embeddingModel}`);
  console.log('');

  // Validar configuración
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no configurada');
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    console.error('❌ Ningún proveedor de embeddings configurado');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('✅ Conectado a PostgreSQL');

  await ensureSchema(client);

  let totalChunks = 0;
  let totalErrors = 0;

  for (const sourceFile of CONFIG.sources) {
    const sourcePath = path.join(CATALOGS_DIR, sourceFile);

    if (!fs.existsSync(sourcePath)) {
      console.warn(`⚠️  No encontrado: ${sourceFile}`);
      continue;
    }

    console.log(`\n📂 Procesando: ${sourceFile}`);

    let catalog;
    try {
      catalog = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    } catch (err) {
      console.error(`❌ Error parseando ${sourceFile}: ${err.message}`);
      totalErrors++;
      continue;
    }

    // Extraer documentos del catálogo
    let documents = [];
    if (catalog.jurisprudencia) documents = catalog.jurisprudencia;
    else if (catalog.normas) documents = catalog.normas;
    else if (catalog.resoluciones) documents = catalog.resoluciones;
    else if (catalog.plazos) documents = catalog.plazos;
    else if (catalog.normas_array) documents = catalog.normas_array;
    else if (catalog.tipos) documents = catalog.tipos;
    else if (catalog.delitos) documents = catalog.delitos;
    else if (catalog.disclaimers) documents = catalog.disclaimers;
    else if (Array.isArray(catalog)) documents = catalog;
    else documents = [catalog];

    console.log(`   Documentos: ${documents.length}`);

    let fileChunks = 0;
    for (const doc of documents) {
      const chunks = chunkLegalDocument(doc, sourceFile);
      for (const chunk of chunks) {
        try {
          await upsertChunk(client, chunk);
          fileChunks++;
          process.stdout.write(`   . chunk ${fileChunks} indexado: ${chunk.id}\r`);
        } catch (err) {
          console.error(`\n❌ Error indexando ${chunk.id}: ${err.message}`);
          totalErrors++;
        }
      }
    }

    console.log(`\n   ✅ ${fileChunks} chunks indexados de ${sourceFile}`);
    totalChunks += fileChunks;
  }

  await client.end();

  console.log('\n' + '='.repeat(50));
  console.log(`📊 RESUMEN:`);
  console.log(`   Total chunks indexados: ${totalChunks}`);
  console.log(`   Errores: ${totalErrors}`);
  console.log(`   Fuentes: ${CONFIG.sources.length}`);
  console.log(`   Modelo: ${CONFIG.embeddingModel}`);
  console.log('');

  if (totalErrors === 0) {
    console.log('✅ INDEXACIÓN COMPLETADA EXITOSAMENTE');
    process.exit(0);
  } else {
    console.log('⚠️  INDEXACIÓN COMPLETADA CON ERRORES');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});