-- ═══════════════════════════════════════════════════════════════════════
-- 2026-08-21-outbox-alignment.sql
-- FIX P1: Alinea outbox_messages drift (content TEXT vs payload JSONB + correlation_id)
-- + retención/purga + BRIN + FOR UPDATE SKIP LOCKED en job
-- ═══════════════════════════════════════════════════════════════════════
-- HALLAZGO AUDITORÍA DB P0-P1:
--   - init.sql:582-591 define outbox_messages con:
--       id UUID PK, type VARCHAR(255), content TEXT NOT NULL,
--       occurred_on_utc TIMESTAMPTZ, processed_on_utc TIMESTAMPTZ,
--       error TEXT, retry_count INTEGER
--     Sin payload JSONB, sin correlation_id, sin BRIN.
--   - supabase-schema.md:345 define:
--       id UUID PK, type TEXT, payload JSONB NOT NULL, correlation_id UUID,
--       created_at TIMESTAMPTZ, processed_at TIMESTAMPTZ, retry_count, etc.
--     Drift: content TEXT vs payload JSONB, falta correlation_id.
--   - OutboxMessage.cs (Domain) usa: Type, Content (TEXT), OccurredOnUtc,
--     ProcessedOnUtc, Error, RetryCount — alineado con init.sql pero no con
--     catálogo canónico.
--   - OutboxMessageConfiguration.cs mapea Content -> text, retry filter
--     pero no payload/correlation_id.
--   - ProcessOutboxMessagesJob.cs:49 hace:
--       .Where(m => m.ProcessedOnUtc == null && m.RetryCount < Max)
--       .OrderBy(m => m.OccurredOnUtc).Take(20)
--     sin FOR UPDATE SKIP LOCKED → race condition con múltiples workers:
--     dos instancias pueden tomar el mismo mensaje (doble publish).
--   - Sin retención/purga documentada: outbox crece infinito, audit_log también.
--     LPDP Art. 40 retención + BRIN para time-series.
--
-- FIX:
--   1. Agregar columnas faltantes a outbox_messages:
--        payload JSONB (alias content), correlation_id UUID
--        created_at alias occurred_on_utc, processed_at alias processed_on_utc
--   2. Trigger sync content <-> payload, correlation_id handling
--   3. Índices BRIN para retención time-series + GIN para payload
--   4. Función de purga fn_cleanup_old_outbox(90 días) + fn_cleanup_old_audit_log(2 años)
--      ya existe en audit-log-unify.sql, aquí se agrega outbox purge.
--   5. Documentar FOR UPDATE SKIP LOCKED para job (ver edit en ProcessOutboxMessagesJob.cs)
--   6. Comentarios LPDP retención
--
-- COMPATIBILIDAD:
--   - Idempotente, no rompe Domain (Content sigue funcionando vía trigger sync)
--   - .NET puede migrar a usar payload JSONB en futuro sin breaking
--   - Node no usa outbox_messages directamente (solo .NET), pero se alinea para
--     observabilidad cross-service.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- PASO 1: Agregar columnas faltantes (idempotente)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE outbox_messages ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE outbox_messages ADD COLUMN IF NOT EXISTS correlation_id UUID;
ALTER TABLE outbox_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE outbox_messages ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE outbox_messages ADD COLUMN IF NOT EXISTS max_retries INT DEFAULT 5;
ALTER TABLE outbox_messages ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;
ALTER TABLE outbox_messages ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Sincronizar created_at <-> occurred_on_utc, processed_at <-> processed_on_utc
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outbox_messages' AND column_name='occurred_on_utc') THEN
    UPDATE outbox_messages SET created_at = occurred_on_utc WHERE created_at IS NULL AND occurred_on_utc IS NOT NULL;
    UPDATE outbox_messages SET payload = content::jsonb WHERE payload IS NULL AND content IS NOT NULL AND content LIKE '{%';
    -- Si content no es JSON válido, guardarlo como JSON string
    UPDATE outbox_messages SET payload = jsonb_build_object('content', content) WHERE payload IS NULL AND content IS NOT NULL AND content NOT LIKE '{%';
    RAISE NOTICE 'outbox_messages: sincronizado created_at/payload desde columnas legacy';
  END IF;
END $$;

-- Trigger sync content <-> payload, occurred_on_utc <-> created_at, processed_on_utc <-> processed_at
CREATE OR REPLACE FUNCTION fn_outbox_sync_aliases()
RETURNS TRIGGER AS $$
BEGIN
  -- content <-> payload
  IF NEW.content IS NULL AND NEW.payload IS NOT NULL THEN
    NEW.content := NEW.payload::TEXT;
  ELSIF NEW.payload IS NULL AND NEW.content IS NOT NULL THEN
    BEGIN
      NEW.payload := NEW.content::JSONB;
    EXCEPTION WHEN OTHERS THEN
      NEW.payload := jsonb_build_object('content', NEW.content);
    END;
  END IF;

  -- occurred_on_utc <-> created_at
  IF NEW.occurred_on_utc IS NULL AND NEW.created_at IS NOT NULL THEN
    NEW.occurred_on_utc := NEW.created_at;
  ELSIF NEW.created_at IS NULL AND NEW.occurred_on_utc IS NOT NULL THEN
    NEW.created_at := NEW.occurred_on_utc;
  END IF;

  -- processed_on_utc <-> processed_at
  IF NEW.processed_on_utc IS NULL AND NEW.processed_at IS NOT NULL THEN
    NEW.processed_on_utc := NEW.processed_at;
  ELSIF NEW.processed_at IS NULL AND NEW.processed_on_utc IS NOT NULL THEN
    NEW.processed_at := NEW.processed_on_utc;
  END IF;

  -- error <-> failure_reason
  IF NEW.error IS NULL AND NEW.failure_reason IS NOT NULL THEN
    NEW.error := NEW.failure_reason;
  ELSIF NEW.failure_reason IS NULL AND NEW.error IS NOT NULL THEN
    NEW.failure_reason := NEW.error;
  END IF;

  -- failed_at derivado de retry_count
  IF NEW.failed_at IS NULL AND NEW.retry_count >= 3 AND NEW.processed_on_utc IS NULL THEN
    -- No auto-set failed_at, lo maneja MarkAsFailed
    NULL;
  END IF;

  -- correlation_id: generar si no existe (para trazabilidad)
  IF NEW.correlation_id IS NULL THEN
    NEW.correlation_id := gen_random_uuid();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_outbox_sync ON outbox_messages;
CREATE TRIGGER trg_outbox_sync
  BEFORE INSERT OR UPDATE ON outbox_messages
  FOR EACH ROW EXECUTE FUNCTION fn_outbox_sync_aliases();

-- Retro-sync filas existentes sin correlation_id
UPDATE outbox_messages SET correlation_id = gen_random_uuid() WHERE correlation_id IS NULL;

-- ─────────────────────────────────────────────────────────────────
-- PASO 2: Índices (idempotentes) — incluyendo BRIN para retención
-- ─────────────────────────────────────────────────────────────────
-- Índices existentes de OutboxMessageConfiguration (preservados):
--   ix_outbox_messages_processed_on_utc
--   ix_outbox_messages_pending (WHERE processed_on_utc IS NULL AND retry_count < 3)
-- Nuevos:
CREATE INDEX IF NOT EXISTS ix_outbox_messages_pending ON outbox_messages(processed_on_utc, retry_count)
  WHERE processed_on_utc IS NULL AND retry_count < 3;

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_messages(created_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_outbox_correlation ON outbox_messages(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outbox_type ON outbox_messages(type);

-- BRIN para time-series (muy eficiente para outbox append-only, purga por fecha)
CREATE INDEX IF NOT EXISTS idx_outbox_created_brin ON outbox_messages USING BRIN (created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_occurred_brin ON outbox_messages USING BRIN (occurred_on_utc);
CREATE INDEX IF NOT EXISTS idx_outbox_processed_brin ON outbox_messages USING BRIN (processed_on_utc);

-- GIN para payload JSONB búsquedas
CREATE INDEX IF NOT EXISTS idx_outbox_payload_gin ON outbox_messages USING GIN (payload jsonb_path_ops) WHERE payload IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- PASO 3: Funciones de purga / retención (LPDP + operativa)
-- ─────────────────────────────────────────────────────────────────
-- Purga outbox procesados antiguos (90 días por defecto, procesados)
CREATE OR REPLACE FUNCTION fn_cleanup_old_outbox(p_retention_days INT DEFAULT 90)
RETURNS TABLE(deleted_count BIGINT, cutoff_date TIMESTAMPTZ) AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := NOW() - (p_retention_days || ' days')::INTERVAL;
  v_count BIGINT;
BEGIN
  DELETE FROM outbox_messages
  WHERE processed_on_utc IS NOT NULL
    AND processed_on_utc < v_cutoff;
  -- También limpiar alias processed_at
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count, v_cutoff;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_cleanup_old_outbox IS
  'Purga outbox_messages procesados anteriores a N días (default 90). Solo borra procesados, preserva pendientes/retry. Ejecutar vía cron: SELECT * FROM fn_cleanup_old_outbox(90);';

-- Purga outbox fallidos permanentes (opcional, 30 días)
CREATE OR REPLACE FUNCTION fn_cleanup_failed_outbox(p_retention_days INT DEFAULT 30)
RETURNS TABLE(deleted_count BIGINT, cutoff_date TIMESTAMPTZ) AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := NOW() - (p_retention_days || ' days')::INTERVAL;
  v_count BIGINT;
BEGIN
  DELETE FROM outbox_messages
  WHERE retry_count >= 3
    AND processed_on_utc IS NULL
    AND occurred_on_utc < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count, v_cutoff;
END;
$$ LANGUAGE plpgsql;

-- Nota: fn_cleanup_old_audit_log(2 años) ya existe en 2026-08-21-audit-log-unify.sql

-- ─────────────────────────────────────────────────────────────────
-- PASO 4: Comentarios LPDP / operativa
-- ─────────────────────────────────────────────────────────────────
COMMENT ON TABLE outbox_messages IS
  'UNIFICADO 2026-08-21: Outbox pattern (transactional outbox). Drift content TEXT → payload JSONB + correlation_id UUID. Trigger sync mantiene compat. BRIN para purga time-series. Job debe usar FOR UPDATE SKIP LOCKED LIMIT 20 (ver ProcessOutboxMessagesJob.cs). Retención: 90 días procesados, 30 días fallidos.';
COMMENT ON COLUMN outbox_messages.payload IS 'JSONB canónico (supabase-schema.md:345). Sincronizado con content TEXT vía trigger. Usar payload para nuevos eventos.';
COMMENT ON COLUMN outbox_messages.correlation_id IS 'UUID de correlación distribuida (payload vs DomainEvent). Generado si NULL. Para trazas Node/.NET.';
COMMENT ON COLUMN outbox_messages.correlation_id IS 'UUID de correlación — coincide con audit_log.correlation_id para traza end-to-end.';
COMMENT ON COLUMN outbox_messages.created_at IS 'Alias de occurred_on_utc (supabase-schema). Sincronizado vía trigger.';
COMMENT ON COLUMN outbox_messages.processed_at IS 'Alias de processed_on_utc.';

-- ─────────────────────────────────────────────────────────────────
-- PASO 5: Verificación
-- ─────────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='outbox_messages'
ORDER BY ordinal_position;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname='public' AND tablename='outbox_messages'
ORDER BY indexname;

SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE processed_on_utc IS NULL) AS pendientes,
  COUNT(*) FILTER (WHERE processed_on_utc IS NOT NULL) AS procesados,
  COUNT(*) FILTER (WHERE retry_count >= 3) AS fallidos_perm,
  COUNT(correlation_id) AS con_correlation
FROM outbox_messages;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- DOCUMENTACIÓN PARA JOB (ProcessOutboxMessagesJob.cs):
-- ═══════════════════════════════════════════════════════════════════════
-- ANTES (race condition con 2 workers):
--   var messages = await context.OutboxMessages
--       .Where(m => m.ProcessedOnUtc == null && m.RetryCount < Max)
--       .OrderBy(m => m.OccurredOnUtc).Take(20).ToListAsync();
--
-- DESPUÉS (FOR UPDATE SKIP LOCKED — evita doble publish):
--   var messages = await context.OutboxMessages
--       .FromSqlRaw(@"
--         SELECT * FROM outbox_messages
--         WHERE processed_on_utc IS NULL AND retry_count < {0}
--         ORDER BY occurred_on_utc
--         LIMIT 20 FOR UPDATE SKIP LOCKED", MaxRetryCount)
--       .ToListAsync();
-- O vía transacción explícita:
--   await using var tx = await context.Database.BeginTransactionAsync();
--   var messages = await context.OutboxMessages
--       .FromSqlRaw("SELECT * ... FOR UPDATE SKIP LOCKED")...
--   // procesar
--   await tx.CommitAsync();
--
-- Si se mantiene LINQ, agregar al menos:
--   .TagWith("FOR UPDATE SKIP LOCKED") + hint en comentario
-- y documentar que múltiples workers requieren SKIP LOCKED.
-- Ver edit en LegalPro.Infrastructure/BackgroundJobs/ProcessOutboxMessagesJob.cs
-- ═══════════════════════════════════════════════════════════════════════
