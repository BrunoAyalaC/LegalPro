-- ═════════════════════════════════════════════════════════════════════
-- 2026-08-22-perf-indices.sql — Índices de performance (AuditorPerformance)
-- ═════════════════════════════════════════════════════════════════════
-- OBJETIVO: cubrir hot paths listados/estadísticos con <200ms p95.
--
-- ESTADO PREVIO (verificado contra migraciones existentes — NO duplicar):
--   ✅ expedientes(organization_id, estado) WHERE deleted_at IS NULL
--      → ya existe como idx_exp_org_estado (2026-08-21-indices-compuestos.sql:39)
--   ✅ documentos(organization_id) WHERE deleted_at IS NULL
--      → ya existe como idx_documentos_org (supabase-schema.md:158)
--   ✅ consumo_tokens_ia(organization_id, created_at)
--      → ya existe como idx_consumo_org_month (2026-08-21-indices-compuestos.sql:59;
--        b-tree DESC sirve scans ASC recorriendo al revés)
--   ❌ mensajes_chat(expediente_id, created_at)  → NUEVO (solo había user_id,created_at)
--   ❌ audit_log(created_at) BRIN                → NUEVO (solo había b-trees org/event)
--
-- NOTAS DE OPERACIÓN:
--   - CREATE INDEX CONCURRENTLY no puede correr dentro de una transacción:
--     ejecutar este archivo COMPLETO con psql sin BEGIN (autocommit por statement).
--     Ej: psql $DATABASE_URL -f tools/migrations/2026-08-22-perf-indices.sql
--   - Idempotente: IF NOT EXISTS con los nombres canónicos ya desplegados.
--   - Limpieza previa: un CREATE INDEX CONCURRENTLY interrumpido deja un índice
--     INVALID con el mismo nombre; IF NOT EXISTS lo saltaría creyendo que existe.
--     El DO block inicial elimina esos residuos para permitir reintento limpio.
-- ═════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- PASO 0: purgar índices INVALID de intentos CONCURRENTLY previos
-- (permite re-ejecutar la migración tras una corrida interrumpida)
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT i.relname AS index_name
    FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND NOT x.indisvalid
      AND i.relname IN (
        'idx_mensajes_chat_exp_fecha',
        'idx_audit_log_created_brin',
        'idx_exp_org_estado',
        'idx_documentos_org',
        'idx_consumo_org_month'
      )
  LOOP
    EXECUTE format('DROP INDEX CONCURRENTLY IF EXISTS public.%I', r.index_name);
    RAISE NOTICE 'Eliminado índice INVALID residual: %', r.index_name;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 1. expedientes(organization_id, estado) WHERE deleted_at IS NULL
--    Nombre canónico ya desplegado el 2026-08-21 → no-op si existe.
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exp_org_estado
  ON expedientes(organization_id, estado)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────
-- 2. documentos(organization_id) WHERE deleted_at IS NULL
--    Nombre canónico del schema base → no-op si existe.
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documentos_org
  ON documentos(organization_id)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────
-- 3. mensajes_chat(expediente_id, created_at)  [NUEVO]
--    Hot path: hilo de chat por expediente ordenado cronológico
--    (routes/expedientes.js / documento-chat / boveda-chat).
--    Parcial: mensajes borrados (soft-delete) quedan fuera del índice.
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mensajes_chat_exp_fecha
  ON mensajes_chat(expediente_id, created_at)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────
-- 4. audit_log(created_at) USING BRIN  [NUEVO]
--    audit_log es append-only y físicamente correlacionado con el tiempo
--    → BRIN da range-scan temporal (retención, auditoría LPDP) a ~1/1000
--    del costo de almacenamiento de un b-tree equivalente.
--    Los b-trees existentes (organization_id,created_at)/(event_name,created_at)
--    siguen cubriendo los filtros por org/evento.
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_created_brin
  ON audit_log USING BRIN (created_at);

-- ─────────────────────────────────────────────────────────────────
-- 5. consumo_tokens_ia(organization_id, created_at)
--    Nombre canónico ya desplegado el 2026-08-21 → no-op si existe.
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consumo_org_month
  ON consumo_tokens_ia(organization_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────
-- PASO FINAL: verificación (debe listar los 5, todos válidos)
-- ─────────────────────────────────────────────────────────────────
SELECT t.relname AS tabla, i.relname AS indice, x.indisvalid AS valido
FROM pg_index x
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_class t ON t.oid = x.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND i.relname IN (
    'idx_exp_org_estado',
    'idx_documentos_org',
    'idx_mensajes_chat_exp_fecha',
    'idx_audit_log_created_brin',
    'idx_consumo_org_month'
  )
ORDER BY t.relname, i.relname;
