-- ═══════════════════════════════════════════════════════════════════════
-- 2026-08-21-pgcrypto-pii.sql
-- FIX P0-E (schema): columnas pgcrypto para PII de clientes (dni/ruc)
-- ═══════════════════════════════════════════════════════════════════════
-- NOTA DE RESTAURACIÓN:
--   Este archivo contenía por error una copia duplicada de
--   2026-08-21-fix-p0-d-policies.sql (mismo contenido, cabecera incluida),
--   por lo que la migración pgcrypto nunca existió y el typo reportado
--   PGCYPTO_KEY → PGCRYPTO_KEY no estaba presente (no había contenido que
--   corregir). Este archivo restaura la migración pgcrypto REAL usando la
--   variable correcta PGCRYPTO_KEY en todos los comentarios.
--
-- PROPÓSITO (LPDP Ley 29733, Art. 18 — finalidad documentada):
--   Minimizar exposición del documento de identidad (dni/ruc):
--     - *_hash: SHA-256 de lower(trim(valor)) — pseudonimización para
--       búsqueda exacta O(1) vía índice único (evita LIKE/full scan sobre
--       el dato claro).
--     - *_enc: pgp_sym_encrypt(valor, PGCRYPTO_KEY) en base64 — cifrado
--       simétrico OpenPGP para recuperación del dato cuando la app lo
--       requiera. La clave vive SOLO en env var del backend, nunca en BD.
--   TRANSICIÓN dual-write: las columnas claras dni/ruc se mantienen hasta
--   completar la migración de lectura a *_hash en app + .NET.
--
-- ALCANCE:
--   1. Extensión pgcrypto (idempotente).
--   2. ALTER TABLE clientes ADD COLUMN IF NOT EXISTS (4 columnas).
--   3. Backfill de *_hash para filas existentes (idempotente).
--   4. Índices únicos parciales espejo de los UNIQUE dni/ruc existentes.
--   5. Verificación embebida.
--   NOTA: el backfill de *_enc NO se hace aquí (requiere PGCRYPTO_KEY en
--   tiempo de migración); las filas nuevas/actualizadas vía API quedan
--   cifradas por dual-write en routes/clientes.js.
--
-- BASE LEGAL / CONVENCIONES:
--   - PostgreSQL 15 docs: pgcrypto, digest(), pgp_sym_encrypt()
--   - Regla repo #13: migración versionada (NO ALTER ad-hoc en app)
--   - Regla repo #12: finalidad documentada vía COMMENT (LPDP Art. 18)
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- PASO 1: Extensión pgcrypto (ya declarada en init.sql:14; re-afirmar
-- por si esta migración corre en entorno que no ejecutó init.sql)
-- ─────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────
-- PASO 2: Columnas PII en clientes
--   *_hash TEXT  — hex SHA-256 (64 chars), nullable (cliente puede no
--                  tener dni/ruc según tipo_persona)
--   *_enc  TEXT  — base64 de pgp_sym_encrypt (se usa encode(...,'base64')
--                  para evitar ambigüedad bytea↔text y facilitar manejo
--                  desde Node sin Buffers)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS dni_hash TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS dni_enc  TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS ruc_hash TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS ruc_enc  TEXT;

COMMENT ON COLUMN clientes.dni_hash IS
  'FIX P0-E: SHA-256 hex de lower(trim(dni)). Búsqueda exacta pseudonimizada (índice uq_clientes_dni_hash). No reversible.';
COMMENT ON COLUMN clientes.dni_enc IS
  'FIX P0-E: pgp_sym_encrypt(dni, PGCRYPTO_KEY) en base64. Clave solo en env del backend. NULL si PGCRYPTO_KEY no configurada (degradación solo-hash).';
COMMENT ON COLUMN clientes.ruc_hash IS
  'FIX P0-E: SHA-256 hex de lower(trim(ruc)). Búsqueda exacta pseudonimizada (índice uq_clientes_ruc_hash). No reversible.';
COMMENT ON COLUMN clientes.ruc_enc IS
  'FIX P0-E: pgp_sym_encrypt(ruc, PGCRYPTO_KEY) en base64. Clave solo en env del backend. NULL si PGCRYPTO_KEY no configurada (degradación solo-hash).';

-- ─────────────────────────────────────────────────────────────────
-- PASO 3: Backfill de hashes (idempotente — solo filas pendientes)
--   Misma normalización que usará la app: lower(trim(valor)).
--   Los UNIQUE existentes sobre dni/ruc garantizan que el backfill no
--   puede violar la unicidad de los nuevos índices hash.
-- ─────────────────────────────────────────────────────────────────
UPDATE public.clientes
   SET dni_hash = encode(digest(lower(trim(dni)), 'sha256'), 'hex')
 WHERE dni IS NOT NULL
   AND dni_hash IS NULL;

UPDATE public.clientes
   SET ruc_hash = encode(digest(lower(trim(ruc)), 'sha256'), 'hex')
 WHERE ruc IS NOT NULL
   AND ruc_hash IS NULL;

-- ─────────────────────────────────────────────────────────────────
-- PASO 4: Índices únicos parciales (espejo de UNIQUE dni/ruc)
--   Parciales sobre NOT NULL: filas sin documento no consumen índice.
--   Regla repo #9: índice para toda columna usada en WHERE — la búsqueda
--   GET /api/clientes pasa a filtrar por *_hash.
-- ─────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_dni_hash
    ON public.clientes (dni_hash) WHERE dni_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_ruc_hash
    ON public.clientes (ruc_hash) WHERE ruc_hash IS NOT NULL;

COMMIT;

-- ─────────────────────────────────────────────────────────────────
-- VERIFICACIÓN EMBEBIDA (lectura obligatoria post-migración)
-- ─────────────────────────────────────────────────────────────────
-- 5a. Columnas creadas — esperado: 4 filas (dni_hash, dni_enc, ruc_hash, ruc_enc)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'clientes'
  AND column_name IN ('dni_hash', 'dni_enc', 'ruc_hash', 'ruc_enc')
ORDER BY column_name;

-- 5b. Índices hash activos — esperado: uq_clientes_dni_hash, uq_clientes_ruc_hash
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'clientes'
  AND indexname IN ('uq_clientes_dni_hash', 'uq_clientes_ruc_hash');

-- 5c. Backfill completo — esperado: 0 en ambas columnas
SELECT COUNT(*) FILTER (WHERE dni IS NOT NULL AND dni_hash IS NULL) AS dni_sin_hash,
       COUNT(*) FILTER (WHERE ruc IS NOT NULL AND ruc_hash IS NULL) AS ruc_sin_hash
FROM public.clientes;

-- 5d. RLS intacto tras ALTER (relrowsecurity debe seguir true)
SELECT c.relname, c.relrowsecurity AS rls_activa, c.relforcerowsecurity AS rls_forzada
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'clientes';

-- ═══════════════════════════════════════════════════════════════════════
-- TEST FUNCIONAL MANUAL:
--   SELECT encode(digest(lower(trim('12345678')),'sha256'),'hex');
--   -- debe devolver el mismo valor que clientes.dni_hash para ese cliente
--   SET enable_seqscan = off;
--   EXPLAIN SELECT id FROM clientes
--    WHERE dni_hash = encode(digest(lower(trim('12345678')),'sha256'),'hex');
--   -- esperado: Index Scan using uq_clientes_dni_hash
-- ═══════════════════════════════════════════════════════════════════════
