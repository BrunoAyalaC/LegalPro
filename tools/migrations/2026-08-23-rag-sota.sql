-- ═════════════════════════════════════════════════════════════════════
-- 2026-08-23-rag-sota.sql — Informe SOTA RAG: índice HNSW + versionado
-- ═════════════════════════════════════════════════════════════════════
-- OBJETIVO (informe SOTA RAG §índices):
--   1. Reemplazar el índice ANN ivfflat de rag_vectors_v2 por HNSW
--      (m=16, ef_construction=128): mejor recall@k con listas pequeñas,
--      sin re-tuning de lists al crecer el corpus.
--   2. Agregar columnas de VERSIONADO de chunks (content_hash,
--      document_version, parser_version, embedding_model,
--      embedding_version) para re-indexación incremental segura.
--   3. Índice BRIN parcial sobre created_at (tabla append-only).
--
-- ESTADO PREVIO VERIFICADO EN REPO (NO inventado):
--   - Tabla rag_vectors_v2: id TEXT PK, source TEXT, content TEXT,
--     embedding vector(1536), metadata JSONB, created_at, updated_at
--     (tools/rag/index-corpus.mjs:191-199). Sin soft-delete.
--   - Índices ivfflat existentes según quién creó la tabla:
--       idx_v2_embedding                (populate-lento.mjs:133, index-corpus.mjs:207, lists=50)
--       idx_rag_vectors_v2_embedding    (index-todos.mjs:601, indexer-v2.mjs:480, lists=100)
--     → el DROP se hace DINÁMICAMENTE sobre pg_indexes (indexdef LIKE
--       '%ivfflat%'), cubre ambos nombres y cualquier stray.
--
-- DECISIÓN DE ORDEN (seguridad operativa):
--   Se crea HNSW PRIMERO y solo si existe se dropean los ivfflat.
--   Dropear primero dejaría la tabla sin índice ANN (seq scan en cada
--   retrieve) durante la construcción de HNSW. Así nunca hay ventana
--   sin ANN. Si pgvector < 0.5.0 (sin soporte hnsw), se conserva el
--   ivfflat existente y se emite WARNING (fail-open documentado).
--
-- NOTAS DE OPERACIÓN:
--   - Idempotente: re-ejecutable sin efectos adversos.
--   - CREATE INDEX (no CONCURRENTLY) dentro de transacción: bloquea
--     escrituras durante la construcción. Aceptable para tabla de
--     tooling RAG (escrituras batch nocturnas). Si el corpus crece,
--     ejecutar el CREATE INDEX de HNSW aparte con CONCURRENTLY.
--   - hnsw.ef_search (default 40) se ajusta por sesión en retrieve.mjs;
--     esta migración no fija valores de sesión.
-- ═════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- PASO 1: extensión pgvector (idempotente; la tabla ya usa vector(1536))
-- ─────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────────────────────────
-- PASO 2: columnas de versionado (ADD COLUMN IF NOT EXISTS)
--   - content_hash: SHA-256 del contenido → detecta cambios reales
--     sin re-embeddear chunks idénticos (re-index incremental).
--   - document_version: versión lógica del documento fuente (+1 por
--     edición del catálogo).
--   - parser_version: versión del chunker/indexer que produjo el chunk.
--   - embedding_model / embedding_version: trazabilidad del embedder
--     (hash fallback vs MiniMax embo-01) — base para filtrar chunks
--     cross-space degradados (ver TODO P1 en retrieve.mjs:927).
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE rag_vectors_v2 ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE rag_vectors_v2 ADD COLUMN IF NOT EXISTS document_version INT DEFAULT 1;
ALTER TABLE rag_vectors_v2 ADD COLUMN IF NOT EXISTS parser_version TEXT DEFAULT 'index-todos-1.1';
ALTER TABLE rag_vectors_v2 ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'hashEmbedding-v2';
ALTER TABLE rag_vectors_v2 ADD COLUMN IF NOT EXISTS embedding_version TEXT DEFAULT '1';

-- ─────────────────────────────────────────────────────────────────
-- PASO 3: HNSW (m=16, ef_construction=128) + drop condicional ivfflat
--   DO block idempotente:
--     a) Si ya existe un índice hnsw válido sobre embedding → no-op.
--     b) Intenta crear HNSW; si pgvector no soporta hnsw (< 0.5.0)
--        captura la excepción, WARNING y NO dropea ivfflat.
--     c) Solo tras crear HNSW: dropea TODOS los ivfflat restantes
--        detectados dinámicamente en pg_indexes.
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  hnsw_ok BOOLEAN := false;
  r RECORD;
BEGIN
  -- (a) ¿Ya existe un índice hnsw sobre embedding?
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'rag_vectors_v2'
      AND indexdef ILIKE '%USING hnsw%'
  ) INTO hnsw_ok;

  IF NOT hnsw_ok THEN
    BEGIN
      EXECUTE 'CREATE INDEX idx_rag_vectors_v2_hnsw
                 ON rag_vectors_v2 USING hnsw (embedding vector_cosine_ops)
                 WITH (m = 16, ef_construction = 128)';
      hnsw_ok := true;
      RAISE NOTICE 'Índice HNSW idx_rag_vectors_v2_hnsw creado (m=16, ef_construction=128)';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'pgvector sin soporte hnsw (%): se CONSERVA el ivfflat existente. Actualizar pgvector >= 0.5.0 y re-ejecutar.', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'Índice HNSW ya existe — no-op';
  END IF;

  -- (c) Drop ivfflat SOLO si HNSW está operativo (nunca quedarse sin ANN)
  IF hnsw_ok THEN
    FOR r IN
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename  = 'rag_vectors_v2'
        AND indexdef ILIKE '%ivfflat%'
    LOOP
      EXECUTE format('DROP INDEX IF EXISTS public.%I', r.indexname);
      RAISE NOTICE 'Eliminado índice ivfflat obsoleto: %', r.indexname;
    END LOOP;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- PASO 4: BRIN parcial sobre created_at (si no existe)
--   rag_vectors_v2 es append-only (UPSERT por id, sin borrados masivos)
--   → correlación física con el tiempo ideal para BRIN (~1/1000 del
--   costo de un b-tree, mismo patrón que idx_audit_log_created_brin).
--   Predicado parcial: filas SIN embedding son inservibles para
--   retrieval (la tabla no tiene deleted_at); excluirlas reduce el
--   rango escaneado en consultas temporales de chunks válidos.
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rag_vectors_v2_created_brin
  ON rag_vectors_v2 USING brin (created_at)
  WITH (pages_per_range = 32)
  WHERE embedding IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- PASO 5: comentarios de columna (trazabilidad auditoría)
-- ─────────────────────────────────────────────────────────────────
COMMENT ON COLUMN rag_vectors_v2.content_hash IS 'SHA-256 hex del contenido del chunk. Igual hash => saltar re-embedding en re-index incremental.';
COMMENT ON COLUMN rag_vectors_v2.document_version IS 'Versión lógica del documento fuente; +1 por cada edición del catálogo origen.';
COMMENT ON COLUMN rag_vectors_v2.parser_version IS 'Versión del chunker/indexer productor (default index-todos-1.1).';
COMMENT ON COLUMN rag_vectors_v2.embedding_model IS 'Modelo generador del embedding: hashEmbedding-v2 (fallback local) | embo-01 (MiniMax).';
COMMENT ON COLUMN rag_vectors_v2.embedding_version IS 'Versión del espacio de embeddings; cambiar => re-index completo obligatorio.';

-- Comentarios sobre índices ANN/BRIN SOLO si existen (si pgvector < 0.5
-- no creó el hnsw, un COMMENT ON INDEX inexistente abortaría la migración).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_rag_vectors_v2_hnsw') THEN
    COMMENT ON INDEX idx_rag_vectors_v2_hnsw IS 'ANN HNSW m=16 ef_construction=128 (informe SOTA RAG). Ajustar hnsw.ef_search por sesión (default 40).';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_rag_vectors_v2_created_brin') THEN
    COMMENT ON INDEX idx_rag_vectors_v2_created_brin IS 'BRIN parcial created_at (append-only); excluye filas sin embedding.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- PASO 6: verificación inline (debe listar HNSW + BRIN, sin ivfflat)
-- ─────────────────────────────────────────────────────────────────
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'rag_vectors_v2'
ORDER BY indexname;

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'rag_vectors_v2'
  AND column_name IN ('content_hash','document_version','parser_version','embedding_model','embedding_version')
ORDER BY ordinal_position;

COMMIT;

-- ═════════════════════════════════════════════════════════════════════
-- COMANDO DE VERIFICACIÓN POST-MIGRACIÓN (ejecutar tras aplicar):
-- ═════════════════════════════════════════════════════════════════════
--   psql "$DATABASE_URL" -c "\di idx_rag_vectors_v2*" -c "\d rag_vectors_v2"
--
-- Esperado:
--   - idx_rag_vectors_v2_hnsw        ... USING hnsw (embedding vector_cosine_ops) WITH (m='16', ef_construction='128')
--   - idx_rag_vectors_v2_created_brin ... USING brin (created_at) WHERE (embedding IS NOT NULL)
--   - CERO índices con ivfflat en la tabla
--   - Columnas nuevas presentes con sus defaults
-- Sanity funcional opcional (usa el índice HNSW):
--   psql "$DATABASE_URL" -c "SET enable_seqscan=off; EXPLAIN ANALYZE SELECT id FROM rag_vectors_v2 ORDER BY embedding <=> (SELECT embedding FROM rag_vectors_v2 LIMIT 1) LIMIT 5;"
-- ═════════════════════════════════════════════════════════════════════
