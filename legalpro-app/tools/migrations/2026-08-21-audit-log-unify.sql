-- ═══════════════════════════════════════════════════════════════════════
-- 2026-08-21-audit-log-unify.sql
-- FIX P0: Unifica drift audit_log (init.sql vs .NET Domain vs supabase-schema)
-- ═══════════════════════════════════════════════════════════════════════
-- HALLAZGO AUDITORÍA DB P0:
--   - init.sql:503-515 define audit_log con:
--       id BIGSERIAL, organization_id UUID NOT NULL FK, usuario_id UUID,
--       tabla TEXT NOT NULL, operacion TEXT CHECK, registro_id TEXT NOT NULL,
--       datos_anteriores JSONB, datos_nuevos JSONB, ip_address INET,
--       user_agent TEXT, created_at TIMESTAMPTZ
--   - LegalPro.Domain/Entities/AuditLog.cs define:
--       Id long, EventType, Severity, Timestamp, UserId, OrganizationId,
--       IpAddress, UserAgent, ResourceType, ResourceId, Action, Detail,
--       RequestId, Metadata
--   - LegalPro.Infrastructure/Persistence/Configurations/AuditLogConfiguration.cs
--     mapea a columnas: EventType, Severity, Timestamp, IpAddress, UserAgent,
--     ResourceType, ResourceId, Action, Detail, RequestId, Metadata (text)
--     → columnas camelCase que NO existen en init.sql (snake_case drift)
--   - supabase-schema.md:345 define audit_log con:
--       organization_id, user_id, event_name, severity, table_name, record_key,
--       correlation_id, ip_address, user_agent, payload_masked JSONB, created_at
--   - ApplicationDbContext.cs:157-160 hace:
--       INSERT INTO audit_log (table_name, action, record_key, created_at) ...
--       → columnas INEXISTENTES en init.sql + falta organization_id (NOT NULL)
--       + catch{} traga error → audit trail silenciosamente roto
--
-- IMPACTO:
--   - .NET SaveChangesAsync nunca persiste audit (INSERT falla, catch traga)
--   - Node quotaMiddleware INSERT con organization_id funciona, pero .NET no
--   - No hay payload JSONB ni correlation_id para trazabilidad distribuida
--
-- FIX:
--   1. Agregar columnas faltantes a audit_log para cubrir los 3 schemas:
--      - user_id (alias usuario_id), table_name (alias tabla),
--        record_key (alias registro_id), event_name/event_type, severity,
--        payload JSONB, payload_masked JSONB, correlation_id UUID,
--        request_id TEXT, resource_type, resource_id, action, detail,
--        metadata TEXT, datos_anteriores/datos_nuevos ya existen
--      Todas nullable excepto organization_id (ya NOT NULL)
--   2. Triggers de sincronización entre alias (usuario_id <-> user_id,
--      tabla <-> table_name, registro_id <-> record_key, created_at <-> timestamp)
--   3. Índices BRIN para retención + GIN parcial si payload existe
--   4. Función de purga fn_cleanup_old_audit_log(2 años) — LPDP retención
--   5. RLS FORCE ya aplicado en fix-p0-rls-force.sql (audit_log)
--   6. Comentarios LPDP Art. 18 (finalidad) y Art. 23 (trazabilidad)
--
-- COMPATIBILIDAD:
--   - Idempotente: ADD COLUMN IF NOT EXISTS + DO blocks
--   - No rompe Node (sigue usando organization_id, tabla/operacion/registro_id)
--   - Habilita .NET (puede usar EventType/Severity/ResourceType o tabla/operacion)
--   - supabase-schema payload/correlation_id ya disponibles
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- PASO 1: Agregar columnas faltantes (idempotente)
-- ─────────────────────────────────────────────────────────────────
-- Aliases snake_case <-> camelCase para EFCore sin romper Node
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS event_name TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS severity TEXT CHECK (severity IS NULL OR severity IN ('INFO','WARNING','ERROR','CRITICAL','WARN'));
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS table_name TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS record_key TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS correlation_id UUID;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS request_id TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS resource_type TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS resource_id TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS detail TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS metadata TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS payload_masked JSONB;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ;

-- Asegurar que organization_id sea NOT NULL (ya lo es en init.sql, pero defensivo)
-- No hacemos SET NOT NULL si hay filas con NULL (idempotente check)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='audit_log' AND column_name='organization_id' AND is_nullable='YES'
  ) THEN
    -- Solo si no hay NULLs, forzar NOT NULL
    IF NOT EXISTS (SELECT 1 FROM audit_log WHERE organization_id IS NULL) THEN
      ALTER TABLE audit_log ALTER COLUMN organization_id SET NOT NULL;
      RAISE NOTICE 'audit_log.organization_id forzado a NOT NULL';
    ELSE
      RAISE WARNING 'audit_log tiene filas con organization_id NULL — no se força NOT NULL hasta limpiar';
    END IF;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- PASO 2: Sincronización de alias vía trigger (mantiene coherencia)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_audit_log_sync_aliases()
RETURNS TRIGGER AS $$
BEGIN
  -- usuario_id <-> user_id
  IF NEW.usuario_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.usuario_id := NEW.user_id;
  ELSIF NEW.user_id IS NULL AND NEW.usuario_id IS NOT NULL THEN
    NEW.user_id := NEW.usuario_id;
  END IF;

  -- tabla <-> table_name <-> resource_type
  IF NEW.tabla IS NULL AND NEW.table_name IS NOT NULL THEN
    NEW.tabla := NEW.table_name;
  ELSIF NEW.table_name IS NULL AND NEW.tabla IS NOT NULL THEN
    NEW.table_name := NEW.tabla;
  END IF;
  IF NEW.resource_type IS NULL AND NEW.tabla IS NOT NULL THEN
    NEW.resource_type := NEW.tabla;
  ELSIF NEW.tabla IS NULL AND NEW.resource_type IS NOT NULL THEN
    NEW.tabla := NEW.resource_type;
    NEW.table_name := NEW.resource_type;
  END IF;

  -- registro_id <-> record_key <-> resource_id
  IF NEW.registro_id IS NULL AND NEW.record_key IS NOT NULL THEN
    NEW.registro_id := NEW.record_key;
  ELSIF NEW.record_key IS NULL AND NEW.registro_id IS NOT NULL THEN
    NEW.record_key := NEW.registro_id;
  END IF;
  IF NEW.resource_id IS NULL AND NEW.registro_id IS NOT NULL THEN
    NEW.resource_id := NEW.registro_id;
  ELSIF NEW.registro_id IS NULL AND NEW.resource_id IS NOT NULL THEN
    NEW.registro_id := NEW.resource_id;
    NEW.record_key := NEW.resource_id;
  END IF;

  -- operacion <-> action
  IF NEW.operacion IS NULL AND NEW.action IS NOT NULL THEN
    NEW.operacion := NEW.action;
  ELSIF NEW.action IS NULL AND NEW.operacion IS NOT NULL THEN
    NEW.action := NEW.operacion;
  END IF;

  -- created_at <-> timestamp
  IF NEW.created_at IS NULL AND NEW.timestamp IS NOT NULL THEN
    NEW.created_at := NEW.timestamp;
  ELSIF NEW.timestamp IS NULL AND NEW.created_at IS NOT NULL THEN
    NEW.timestamp := NEW.created_at;
  END IF;

  -- payload <-> payload_masked <-> datos_nuevos
  IF NEW.payload IS NULL AND NEW.payload_masked IS NOT NULL THEN
    NEW.payload := NEW.payload_masked;
  ELSIF NEW.payload_masked IS NULL AND NEW.payload IS NOT NULL THEN
    NEW.payload_masked := NEW.payload;
  END IF;
  IF NEW.datos_nuevos IS NULL AND NEW.payload IS NOT NULL THEN
    NEW.datos_nuevos := NEW.payload;
  END IF;

  -- event_name <-> event_type
  IF NEW.event_name IS NULL AND NEW.event_type IS NOT NULL THEN
    NEW.event_name := NEW.event_type;
  ELSIF NEW.event_type IS NULL AND NEW.event_name IS NOT NULL THEN
    NEW.event_type := NEW.event_name;
  END IF;

  -- correlation_id <-> request_id (UUID vs TEXT)
  IF NEW.correlation_id IS NULL AND NEW.request_id IS NOT NULL THEN
    BEGIN
      NEW.correlation_id := NEW.request_id::UUID;
    EXCEPTION WHEN OTHERS THEN
      -- request_id no es UUID válido, ignorar
    END;
  ELSIF NEW.request_id IS NULL AND NEW.correlation_id IS NOT NULL THEN
    NEW.request_id := NEW.correlation_id::TEXT;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_sync ON audit_log;
CREATE TRIGGER trg_audit_log_sync
  BEFORE INSERT OR UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log_sync_aliases();

-- Retro-corrección de filas existentes con alias NULL
UPDATE audit_log SET user_id = usuario_id WHERE user_id IS NULL AND usuario_id IS NOT NULL;
UPDATE audit_log SET usuario_id = user_id WHERE usuario_id IS NULL AND user_id IS NOT NULL;
UPDATE audit_log SET table_name = tabla WHERE table_name IS NULL AND tabla IS NOT NULL;
UPDATE audit_log SET tabla = table_name WHERE tabla IS NULL AND table_name IS NOT NULL;
UPDATE audit_log SET record_key = registro_id WHERE record_key IS NULL AND registro_id IS NOT NULL;
UPDATE audit_log SET registro_id = record_key WHERE registro_id IS NULL AND record_key IS NOT NULL;
UPDATE audit_log SET timestamp = created_at WHERE timestamp IS NULL AND created_at IS NOT NULL;
UPDATE audit_log SET created_at = timestamp WHERE created_at IS NULL AND timestamp IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- PASO 3: Índices (idempotentes) + BRIN para retención
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_log_org_created ON audit_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_org_tabla ON audit_log(organization_id, tabla, operacion);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC) WHERE timestamp IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_event ON audit_log(event_name, created_at DESC) WHERE event_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type) WHERE event_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_severity ON audit_log(severity) WHERE severity IN ('WARNING','ERROR','CRITICAL');
CREATE INDEX IF NOT EXISTS idx_audit_log_correlation ON audit_log(correlation_id) WHERE correlation_id IS NOT NULL;

-- BRIN para purga por fecha (muy eficiente para append-only time-series)
CREATE INDEX IF NOT EXISTS idx_audit_log_created_brin ON audit_log USING BRIN (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_org_created_brin ON audit_log USING BRIN (organization_id, created_at);

-- GIN para payload si se usa búsqueda JSON
CREATE INDEX IF NOT EXISTS idx_audit_log_payload_gin ON audit_log USING GIN (payload jsonb_path_ops) WHERE payload IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- PASO 4: Función de purga LPDP (retención 2 años, Art. 23 + D.S. 016)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_cleanup_old_audit_log(p_retention_years INT DEFAULT 2)
RETURNS TABLE(deleted_count BIGINT, cutoff_date TIMESTAMPTZ) AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := NOW() - (p_retention_years || ' years')::INTERVAL;
  v_count BIGINT;
BEGIN
  -- Solo borra audit_log anterior a cutoff; outbox_messages no se toca aquí
  DELETE FROM audit_log WHERE created_at < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count, v_cutoff;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_cleanup_old_audit_log IS
  'Purga audit_log anterior a N años (default 2). LPDP retención. Retorna count + cutoff. Ejecutar vía cron: SELECT * FROM fn_cleanup_old_audit_log(2);';

-- ─────────────────────────────────────────────────────────────────
-- PASO 5: Comentarios LPDP Art. 18 (finalidad)
-- ─────────────────────────────────────────────────────────────────
COMMENT ON TABLE audit_log IS
  'UNIFICADO 2026-08-21: Trazabilidad inmutable multi-tenant (LPDP Art. 23 + ISO 27001). Columnas alias sincronizadas vía trigger para compat Node (.NET). Retención 2 años via fn_cleanup_old_audit_log.';
COMMENT ON COLUMN audit_log.organization_id IS 'Tenant owner — NOT NULL, FK organizaciones(id). Obligatorio en todo INSERT (fix P0 organization_id).';
COMMENT ON COLUMN audit_log.payload IS 'JSONB con detalle enmascarado (NUNCA PII en claro). Sincronizado con payload_masked y datos_nuevos.';
COMMENT ON COLUMN audit_log.correlation_id IS 'UUID de correlación distribuida (request_id). Para trazas end-to-end Node/.NET.';
COMMENT ON COLUMN audit_log.event_name IS 'Alias de event_type (supabase-schema vs Domain). Sincronizado vía trigger.';

-- ─────────────────────────────────────────────────────────────────
-- PASO 6: Verificación
-- ─────────────────────────────────────────────────────────────────
SELECT
  c.relname AS tabla,
  c.relrowsecurity AS rls_habilitada,
  c.relforcerowsecurity AS rls_forzada,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename='audit_log') AS num_policies
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='audit_log';

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='audit_log'
ORDER BY ordinal_position;

SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies WHERE schemaname='public' AND tablename='audit_log';

COMMIT;
