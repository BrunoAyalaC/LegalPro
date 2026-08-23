-- ═══════════════════════════════════════════════════════════════════════
-- 2026-08-21-indices-compuestos.sql
-- FIX P1: Índices compuestos para queries hot + corrección SARGable
-- ═══════════════════════════════════════════════════════════════════════
-- HALLAZGO AUDITORÍA DB P1 (Performance):
--   - TokenRepository.js:84-89 hace:
--       WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
--     → No SARGable: no puede usar índice en created_at (función sobre columna).
--     Debe ser: WHERE created_at >= date_trunc('month', now())
--   - Faltan índices compuestos para queries frecuentes:
--       expedientes listado por org+estado, org+tipo, org+created
--       consumo_tokens_ia por org+month, documentos por org+estado
--   - Índices deben ser parciales WHERE deleted_at IS NULL (soft-delete)
--     y CONCURRENTLY en producción para no bloquear writes.
--
-- FIX:
--   1. Índices compuestos (IF NOT EXISTS, dentro de TX para idempotencia)
--      + versión CONCURRENTLY documentada para prod (fuera de TX)
--   2. Corrección SARGable documentada (el fix real está en TokenRepository.js)
--   3. EXPLAIN ANALYZE sugerido para validar p95 < 100ms
--
-- TABLAS:
--   expedientes, consumo_tokens_ia, documentos
--
-- BASE:
--   - supabase-schema.md:124-127 (expedientes indexes, parcial deleted_at)
--   - .opencode/rules/sql-postgres.md: índices parciales, SARGable
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- PASO 1: Índices compuestos idempotentes (dentro de TX, sin CONCURRENTLY)
-- En producción, ejecutar la variante CONCURRENTLY fuera de TX (ver PASO 3)
-- ─────────────────────────────────────────────────────────────────

-- 1a. expedientes: (organization_id, estado) WHERE deleted_at IS NULL
-- Uso: listado filtrado por estado (activo/archivado/cerrado) por tenant
CREATE INDEX IF NOT EXISTS idx_exp_org_estado
  ON expedientes(organization_id, estado)
  WHERE deleted_at IS NULL;

-- 1b. expedientes: (organization_id, tipo) WHERE deleted_at IS NULL
-- Uso: filtro por materia/tipo_proceso (penal/civil/laboral)
CREATE INDEX IF NOT EXISTS idx_exp_org_tipo
  ON expedientes(organization_id, tipo)
  WHERE deleted_at IS NULL;

-- 1c. expedientes: (organization_id, created_at DESC) WHERE deleted_at IS NULL
-- Uso: listado cronológico, paginación, stats mensuales
-- Ya existe idx_expedientes_org_created en init.sql pero sin parcial; este es parcial
CREATE INDEX IF NOT EXISTS idx_exp_org_created
  ON expedientes(organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- 1d. consumo_tokens_ia: (organization_id, created_at DESC) — billing + quota
-- Uso: quotaMiddleware, owner-dashboard, EXPLAIN ANALYZE para month queries
-- Ya existe idx_consumo_tokens_org_created pero lo reforzamos y añadimos month variant
CREATE INDEX IF NOT EXISTS idx_consumo_org_month
  ON consumo_tokens_ia(organization_id, created_at DESC);

-- Índice específico para range >= date_trunc('month', now()) — SARGable
CREATE INDEX IF NOT EXISTS idx_consumo_org_created_month
  ON consumo_tokens_ia(organization_id, created_at)
  WHERE created_at >= date_trunc('month', now() - interval '1 year');

-- 1e. documentos: (organization_id, tipo_documento) o estado si existe
-- Uso: listado de documentos por expediente + filtro tipo
CREATE INDEX IF NOT EXISTS idx_documentos_org_estado
  ON documentos(organization_id, tipo_documento)
  WHERE organization_id IS NOT NULL;

-- Adicional: documentos por expediente + org (hot path)
CREATE INDEX IF NOT EXISTS idx_documentos_org_exp
  ON documentos(organization_id, expediente_id)
  WHERE expediente_id IS NOT NULL;

-- Adicional: consumo por idempotency (prevención doble descuento)
CREATE INDEX IF NOT EXISTS idx_consumo_idempotency
  ON consumo_tokens_ia(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- PASO 2: Corrección SARGable — documentada aquí, fix real en código
-- ─────────────────────────────────────────────────────────────────
-- ANTES (no SARGable, no usa índice):
--   WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
--   → Seq Scan (función sobre columna, no puede usar índice B-Tree)
--
-- DESPUÉS (SARGable, usa índice en created_at):
--   WHERE created_at >= date_trunc('month', now())
--   → Index Scan using idx_consumo_org_month
--
-- El fix se aplica en:
--   legalpro-app/server/repositories/TokenRepository.js:84-93
--   (ver edit en ese archivo, commit 2026-08-21)
--
-- Validación EXPLAIN ANALYZE:
--   EXPLAIN (ANALYZE, BUFFERS) SELECT COUNT(*)::INTEGER as consultas_mes
--   FROM consumo_tokens_ia
--   WHERE organization_id = '00000000-0000-0000-0000-000000000001'
--     AND created_at >= date_trunc('month', now());
--   → Debe mostrar "Index Scan" o "Index Only Scan", no "Seq Scan"
--   → Buffers hit alto, tiempo p95 < 50ms para 100k filas

-- ─────────────────────────────────────────────────────────────────
-- PASO 3: Verificación (dentro de TX)
-- ─────────────────────────────────────────────────────────────────
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname='public'
  AND tablename IN ('expedientes','consumo_tokens_ia','documentos')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Validar que índices parciales tienen WHERE deleted_at IS NULL
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname='public'
  AND indexdef LIKE '%WHERE%'
  AND tablename = 'expedientes';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- PASO 4: Variantes CONCURRENTLY para producción (EJECUTAR FUERA DE TX)
-- ═══════════════════════════════════════════════════════════════════════
-- En producción con tráfico, los CREATE INDEX sin CONCURRENTLY bloquean writes.
-- Ejecutar los siguientes FUERA de transacción, con CONCURRENTLY:
--
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exp_org_estado
--     ON expedientes(organization_id, estado) WHERE deleted_at IS NULL;
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exp_org_tipo
--     ON expedientes(organization_id, tipo) WHERE deleted_at IS NULL;
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exp_org_created
--     ON expedientes(organization_id, created_at DESC) WHERE deleted_at IS NULL;
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consumo_org_month
--     ON consumo_tokens_ia(organization_id, created_at DESC);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documentos_org_estado
--     ON documentos(organization_id, tipo_documento);
--
-- Nota: CONCURRENTLY no puede ejecutarse dentro de BEGIN/COMMIT.
-- Si la migración se ejecuta en ventana de mantenimiento sin tráfico,
-- la versión dentro de TX (PASO 1) es suficiente y más rápida.
-- Para zero-downtime, ejecutar estas 5 líneas manualmente con psql
-- y luego marcar la migración como aplicada.
-- ═══════════════════════════════════════════════════════════════════════
