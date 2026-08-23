-- ═══════════════════════════════════════════════════════════════════════
-- 2026-08-21-vector-fix.sql
-- FIX P1: Alinea base_legal_vectorial con supabase-schema.md:401 (vector 768 + ivfflat)
-- ═══════════════════════════════════════════════════════════════════════
-- HALLAZGO AUDITORÍA DB P1:
--   - init.sql:312-326 define base_legal_vectorial SIN columna embedding:
--       id, codigo_normativa, articulo, texto_literal, tipo_norma, jurisdiccion, created_at
--     No hay vector, no hay pgvector, no hay índice ivfflat.
--   - supabase-schema.md:401-417 define:
--       id UUID, tipo TEXT, norma_id TEXT, articulo TEXT, contenido TEXT NOT NULL,
--       embedding vector(768), metadata JSONB, created_at, updated_at
--       + CREATE EXTENSION IF NOT EXISTS vector
--       + CREATE INDEX ... USING ivfflat (embedding vector_cosine_ops)
--   - initDb.js:66-67 eliminó parche de base_legal_vectorial (tabla orfanada, 0 filas)
--     pero la auditoría exige alinear o DOCUMENTAR si es global USING true.
--   - Hay drift: si la tabla existe en prod con 0 filas, ¿es tenant o global?
--     supabase-schema no marca organization_id, init.sql tampoco — parece global.
--
-- DECISIÓN:
--   1. Habilitar extensión vector (pgvector) si está disponible en instancia.
--      En Railway PostgreSQL 15, vector puede no estar preinstalado → crear
--      condicionalmente y documentar fallback (usar rag_vectors_v2).
--   2. Si vector no disponible: documentar que base_legal_vectorial es legacy
--      y que el sistema usa rag_vectors_v2 (ver tools/rag/indexer-v2.mjs).
--   3. Si vector disponible: agregar columna embedding vector(768), metadata JSONB,
--      tipo, norma_id, contenido si faltan, y crear índice ivfflat.
--   4. Documentar si base_legal_vectorial es GLOBAL (sin organization_id) o
--      multi-tenant (con organization_id). Por defecto, es GLOBAL (USING true)
--      porque contiene normativa peruana compartida (no por tenant).
--   5. Si se decide hacerla tenant en futuro, agregar organization_id nullable
--      y RLS, pero por ahora se deja GLOBAL con comentario explícito.
--
-- BASE LEGAL:
--   - No LPDP directo (es base legal pública), pero sí performance RAG
--   - Supabase-schema.md:401 es canonical
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- PASO 1: Intentar habilitar pgvector (condicional)
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    -- Intentar crear extensión vector
    CREATE EXTENSION IF NOT EXISTS vector;
    RAISE NOTICE 'pgvector habilitada: vector extension disponible';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'pgvector NO disponible en esta instancia: % — se documenta como global sin embedding local. Usar rag_vectors_v2 (indexer-v2.mjs). Ver PASO 5.', SQLERRM;
  END;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- PASO 2: Asegurar que tabla existe (init.sql ya la crea, pero defensivo)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS base_legal_vectorial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_normativa TEXT,
  articulo TEXT,
  texto_literal TEXT,
  tipo_norma TEXT,
  jurisdiccion TEXT DEFAULT 'PERU',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────
-- PASO 3: Agregar columnas faltantes del schema canónico (si vector disponible)
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  has_vector BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector') INTO has_vector;

  IF has_vector THEN
    -- Agregar columnas canónicas si no existen
    -- embedding vector(768) — 768 dims (DeepSeek/MiniMax embeddings)
    BEGIN
      -- Verificar si columna embedding ya existe
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='base_legal_vectorial' AND column_name='embedding'
      ) THEN
        ALTER TABLE base_legal_vectorial ADD COLUMN embedding vector(768);
        RAISE NOTICE 'Columna embedding vector(768) agregada';
      ELSE
        RAISE NOTICE 'Columna embedding ya existe';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'No se pudo agregar embedding vector(768): %', SQLERRM;
    END;

    -- Otras columnas canónicas
    ALTER TABLE base_legal_vectorial ADD COLUMN IF NOT EXISTS tipo TEXT;
    ALTER TABLE base_legal_vectorial ADD COLUMN IF NOT EXISTS norma_id TEXT;
    ALTER TABLE base_legal_vectorial ADD COLUMN IF NOT EXISTS contenido TEXT;
    ALTER TABLE base_legal_vectorial ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE base_legal_vectorial ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

    -- Sincronizar tipo_norma <-> tipo, texto_literal <-> contenido si uno es NULL
    UPDATE base_legal_vectorial SET tipo = tipo_norma WHERE tipo IS NULL AND tipo_norma IS NOT NULL;
    UPDATE base_legal_vectorial SET contenido = texto_literal WHERE contenido IS NULL AND texto_literal IS NOT NULL;

    RAISE NOTICE 'Columnas canónicas (tipo, norma_id, contenido, metadata, updated_at) verificadas';
  ELSE
    RAISE NOTICE 'Vector no disponible — omitiendo columnas vectoriales, manteniendo schema legacy';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- PASO 4: Índices (condicional a vector)
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  has_vector BOOLEAN;
  has_embedding BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector') INTO has_vector;
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='base_legal_vectorial' AND column_name='embedding'
  ) INTO has_embedding;

  IF has_vector AND has_embedding THEN
    -- Índice ivfflat para búsqueda por coseno (requiere al menos algunas filas para lists)
    -- lists = rows / 1000, mínimo 1. Si tabla vacía, el índice se crea pero no se usa hasta tener datos.
    BEGIN
      -- Verificar si índice ya existe
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='base_legal_vectorial' AND indexname='idx_base_legal_vector'
      ) THEN
        -- ivfflat requiere que la tabla tenga datos o se puede crear vacío (con lists=10 default)
        EXECUTE 'CREATE INDEX idx_base_legal_vector ON base_legal_vectorial USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)';
        RAISE NOTICE 'Índice ivfflat idx_base_legal_vector creado';
      ELSE
        RAISE NOTICE 'Índice idx_base_legal_vector ya existe';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'No se pudo crear índice ivfflat (posible tabla vacía): % — crear manualmente tras poblar: CREATE INDEX ... USING ivfflat (embedding vector_cosine_ops)', SQLERRM;
    END;

    -- Índice adicional por tipo_norma/tipo
    CREATE INDEX IF NOT EXISTS idx_base_legal_tipo ON base_legal_vectorial(tipo_norma);
    CREATE INDEX IF NOT EXISTS idx_base_legal_tipo_canon ON base_legal_vectorial(tipo);
  ELSE
    -- Fallback: solo índices legacy
    CREATE INDEX IF NOT EXISTS idx_base_legal_tipo ON base_legal_vectorial(tipo_norma);
    RAISE NOTICE 'Solo índices legacy creados (sin vector)';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- PASO 5: Documentar si es GLOBAL (USING true) o tenant
-- ─────────────────────────────────────────────────────────────────
-- Decisión actual: base_legal_vectorial es GLOBAL (normativa peruana compartida)
-- No tiene organization_id, no tiene RLS, es de lectura para todos los tenants.
-- El sistema RAG usa rag_vectors_v2 (multi-tenant) como store principal.
-- Si en el futuro se requiere multi-tenant, agregar:
--   ALTER TABLE base_legal_vectorial ADD COLUMN organization_id UUID REFERENCES organizaciones(id);
--   ALTER TABLE base_legal_vectorial ENABLE ROW LEVEL SECURITY; FORCE; + policy
-- Pero por ahora se documenta explícitamente como GLOBAL.

COMMENT ON TABLE base_legal_vectorial IS
  'FIX 2026-08-21: Tabla GLOBAL (sin organization_id, sin RLS) con normativa peruana para RAG. Si pgvector disponible: embedding vector(768) + ivfflat. Fallback: rag_vectors_v2 (indexer-v2.mjs). Ver supabase-schema.md:401. GLOBAL USING true — lectura para todos los tenants.';

DO $$
DECLARE
  has_vector BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector') INTO has_vector;
  IF has_vector THEN
    COMMENT ON COLUMN base_legal_vectorial.embedding IS 'Embedding 768 dims (MiniMax/DeepSeek) para búsqueda semántica. Índice ivfflat vector_cosine_ops. Si tabla vacía, índice creado con lists=100.';
  ELSE
    COMMENT ON COLUMN base_legal_vectorial.codigo_normativa IS 'Código normativa (legacy). Si vector no disponible, usar rag_vectors_v2 como store principal.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- PASO 6: Verificación
-- ─────────────────────────────────────────────────────────────────
SELECT
  CASE WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector') THEN 'DISPONIBLE' ELSE 'NO DISPONIBLE' END AS pgvector_estado,
  (SELECT COUNT(*) FROM base_legal_vectorial) AS num_filas,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='base_legal_vectorial') AS num_columnas;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='base_legal_vectorial'
ORDER BY ordinal_position;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname='public' AND tablename='base_legal_vectorial'
ORDER BY indexname;

-- Verificar que NO tiene RLS (GLOBAL)
SELECT
  c.relname AS tabla,
  c.relrowsecurity AS rls_habilitada,
  c.relforcerowsecurity AS rls_forzada,
  'GLOBAL (sin RLS, normativa compartida)' AS nota
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='base_legal_vectorial';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- DOCUMENTACIÓN PARA AUDITOR:
-- ═══════════════════════════════════════════════════════════════════════
-- Si pgvector NO está disponible en Railway PG 15:
--   - Esta migración no falla (DO block captura excepción)
--   - base_legal_vectorial queda como tabla legacy GLOBAL sin embedding
--   - El sistema usa rag_vectors_v2 (tools/rag/indexer-v2.mjs) que sí tiene
--     embeddings y metadata GIN. No hay impacto funcional.
--   - Para habilitar vector en Railway:
--     1. Verificar que la imagen de PostgreSQL incluya pgvector (postgres:15 con vector)
--     2. Si no, usar Supabase o migrar a instance con pgvector
--     3. Re-ejecutar esta migración tras habilitar extensión
--
-- Si pgvector SÍ está disponible:
--   - Columna embedding vector(768) + índice ivfflat list=100
--   - Queries: SELECT * FROM base_legal_vectorial ORDER BY embedding <=> $query_vec LIMIT 10;
-- ═══════════════════════════════════════════════════════════════════════
