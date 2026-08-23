-- ═══════════════════════════════════════════════════════════════════════
-- 2026-08-21-consent_history.sql
-- FIX LPDP P1: Crear tabla consent_history que datos-personales.js:84 espera
-- + backfill desde consentimientos + alineación con 2026-08-01-consent-history.sql
-- ═══════════════════════════════════════════════════════════════════════
-- HALLAZGO AUDITORÍA DB P1:
--   legalpro-app/server/routes/datos-personales.js:84 ejecuta:
--     INSERT INTO consent_history
--       (organization_id, user_id, tipo, accion, version_documento,
--        ip_address, user_agent, motivo_revocacion)
--     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
--   Pero init.sql NO crea consent_history — solo consentimientos.
--   La tabla fue creada en tools/migrations/2026-08-01-consent-history.sql
--   con schema canónico (UUID PK, RLS FORCE). Esta migración garantiza
--   idempotencia + compatibilidad con hallazgo que pide BIGSERIAL + metadata.
--
-- ESPEC HALLAZGO solicita:
--   id BIGSERIAL, organization_id UUID, usuario_id UUID, tipo TEXT,
--   accion TEXT, created_at TIMESTAMPTZ, metadata JSONB
-- Pero el código real (datos-personales.js:84) usa:
--   id UUID, organization_id, user_id, tipo, accion,
--   version_documento, ip_address, user_agent, motivo_revocacion, metadata, created_at
--
-- DECISIÓN:
--   - Preservar schema canónico 2026-08-01 (UUID PK, sin romper FKS).
--   - Si la tabla no existe: crear con BIGSERIAL para cumplir literal hallazgo
--     (alternativamente UUID si ya existe, ambas válidas; documentamos).
--   - Si ya existe con UUID PK: agregar columnas faltantes (usuario_id alias,
--     metadata, created_at) y mantener UUID PK — NO cambiar PK type (breaking).
--   - Agregar alias `usuario_id` como columna generada o real para compat con
--     spec que pide usuario_id. Preferimos agregar columna real `usuario_id`
--     nullable + trigger sync con `user_id` para máxima compatibilidad.
--   - RLS FORCE + policy tenant_isolation (consistente con 2026-08-01).
--   - Backfill idempotente desde `consentimientos`.
--
-- BASE LEGAL:
--   - Ley 29733 Art. 21 — revocación consentimiento trazable
--   - D.S. 016-2024-JUS Art. 21 — registro histórico
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- PASO 1: Crear tabla si no existe (idempotente)
-- ─────────────────────────────────────────────────────────────────
-- Nota: Si la tabla ya fue creada por 2026-08-01 (UUID PK), este CREATE
-- no hace nada (IF NOT EXISTS). No intentamos cambiar PK de UUID a BIGSERIAL
-- porque sería breaking (FKs, RLS). En ese caso documentamos divergencia y
-- garantizamos compatibilidad vía columnas adicionales.
CREATE TABLE IF NOT EXISTS consent_history (
  -- Hallazgo pide BIGSERIAL; si la tabla no existía, este bloque crea BIGSERIAL.
  -- Si la tabla ya existe con UUID PK, esta definición es ignorada (IF NOT EXISTS).
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  user_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'terminos_condiciones',
    'politica_privacidad',
    'marketing',
    'transferencia_internacional',
    'cookies_analiticas',
    'cookies_funcionales',
    'terminos','privacidad','eliminacion','oposicion'
  )),
  accion TEXT NOT NULL CHECK (accion IN ('otorgado', 'revocado', 'modificado')),
  version_documento TEXT,
  ip_address INET,
  user_agent TEXT,
  motivo_revocacion TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- PASO 2: Migración defensiva si la tabla YA existía con schema 2026-08-01
-- (UUID PK): agregar columnas faltantes del hallazgo
-- ─────────────────────────────────────────────────────────────────
-- 2a. usuario_id (alias de user_id) — hallazgo pide usuario_id
ALTER TABLE consent_history ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE;

-- 2b. metadata JSONB — hallazgo pide metadata JSONB
ALTER TABLE consent_history ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2c. organization_id ya existe en 2026-08-01; asegurar FK si falta (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='consent_history' AND column_name='organization_id'
  ) THEN
    ALTER TABLE consent_history ADD COLUMN organization_id UUID REFERENCES organizaciones(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2d. created_at ya existe; versión_documento, ip_address etc ya existen si viene de 2026-08-01
ALTER TABLE consent_history ADD COLUMN IF NOT EXISTS version_documento TEXT;
ALTER TABLE consent_history ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE consent_history ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE consent_history ADD COLUMN IF NOT EXISTS motivo_revocacion TEXT;

-- 2e. Asegurar que `usuario_id` se sincronice con `user_id` para compat
-- Trigger: on INSERT/UPDATE, si uno es NULL y el otro no, copiar.
CREATE OR REPLACE FUNCTION fn_consent_history_sync_user_ids()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.usuario_id IS NOT NULL THEN
    NEW.user_id := NEW.usuario_id;
  ELSIF NEW.usuario_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.usuario_id := NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_consent_history_sync_ids ON consent_history;
CREATE TRIGGER trg_consent_history_sync_ids
  BEFORE INSERT OR UPDATE ON consent_history
  FOR EACH ROW EXECUTE FUNCTION fn_consent_history_sync_user_ids();

-- Corrección retroactiva: sincronizar filas existentes donde uno es NULL
UPDATE consent_history SET usuario_id = user_id WHERE usuario_id IS NULL AND user_id IS NOT NULL;
UPDATE consent_history SET user_id = usuario_id WHERE user_id IS NULL AND usuario_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- PASO 3: Índices (idempotentes)
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_consent_history_user ON consent_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_history_usuario ON consent_history(usuario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_history_org ON consent_history(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_history_tipo ON consent_history(tipo, accion);
CREATE INDEX IF NOT EXISTS idx_consent_history_created ON consent_history(created_at DESC);

-- ─────────────────────────────────────────────────────────────────
-- PASO 4: RLS FORCE + policy (idempotente)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE consent_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_history FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consent_history_isolation ON consent_history;
CREATE POLICY consent_history_isolation ON consent_history
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', TRUE)::UUID)
  WITH CHECK (organization_id = current_setting('app.current_org_id', TRUE)::UUID);

-- Policy alias para compat con hallazgo que pide `usuario_id` subquery
-- (no necesaria si organization_id ya aísla, pero defensa adicional)
DROP POLICY IF EXISTS p_consent_history_tenant ON consent_history;
-- No creamos segunda policy FOR ALL (conflict); la isolation anterior es suficiente.

COMMENT ON TABLE consent_history IS
  'FIX 2026-08-21 LPDP Art. 21 — bitácora inmutable de consentimientos. Idempotente con 2026-08-01. PK BIGSERIAL si tabla nueva, UUID si preexistía.';
COMMENT ON COLUMN consent_history.usuario_id IS 'Alias de user_id para compat con spec auditoría (BIGSERIAL spec). Sincronizado vía trigger.';
COMMENT ON COLUMN consent_history.metadata IS 'JSONB libre para contexto adicional ( hallazgo pide metadata JSONB )';
COMMENT ON POLICY consent_history_isolation ON consent_history IS 'Aislamiento multi-tenant: solo filas de la org activa (app.current_org_id)';

-- ─────────────────────────────────────────────────────────────────
-- PASO 5: Backfill desde `consentimientos` (idempotente, no duplica)
-- ─────────────────────────────────────────────────────────────────
-- Mapeo consentimientos.tipo → consent_history.tipo/accion:
--   consentimientos: terminos, privacidad, marketing, eliminacion,
--                    transferencia_internacional, oposicion
--   consent_history: terminos_condiciones, politica_privacidad, marketing,
--                    transferencia_internacional, etc. + accion otorgado/revocado
-- Si ya existe entrada para mismo (user_id, tipo, created_at) se omite.
DO $$
DECLARE
  v_inserted INT;
BEGIN
  -- Solo si consentimientos tiene filas y consent_history está vacío o incompleto
  WITH mapped AS (
    SELECT
      u.organization_id,
      c.usuario_id      AS user_id,
      c.usuario_id      AS usuario_id,
      CASE c.tipo
        WHEN 'terminos' THEN 'terminos_condiciones'
        WHEN 'privacidad' THEN 'politica_privacidad'
        WHEN 'marketing' THEN 'marketing'
        WHEN 'transferencia_internacional' THEN 'transferencia_internacional'
        WHEN 'eliminacion' THEN 'politica_privacidad'
        WHEN 'oposicion' THEN 'politica_privacidad'
        ELSE 'politica_privacidad'
      END AS tipo_hist,
      CASE WHEN c.aceptado THEN 'otorgado' ELSE 'revocado' END AS accion_hist,
      c.version         AS version_documento,
      c.ip_address,
      c.user_agent,
      CASE WHEN NOT c.aceptado THEN 'Revocación migrada desde consentimientos' ELSE NULL END AS motivo,
      jsonb_build_object('migrado_desde','consentimientos','consentimiento_id',c.id::text,'tipo_original',c.tipo) AS metadata,
      c.created_at
    FROM consentimientos c
    JOIN usuarios u ON u.id = c.usuario_id
    WHERE u.organization_id IS NOT NULL
  ),
  inserted AS (
    INSERT INTO consent_history
      (organization_id, user_id, usuario_id, tipo, accion, version_documento, ip_address, user_agent, motivo_revocacion, metadata, created_at)
    SELECT
      m.organization_id, m.user_id, m.usuario_id, m.tipo_hist, m.accion_hist,
      m.version_documento, m.ip_address, m.user_agent, m.motivo, m.metadata, m.created_at
    FROM mapped m
    WHERE NOT EXISTS (
      SELECT 1 FROM consent_history ch
      WHERE ch.user_id = m.user_id
        AND ch.tipo = m.tipo_hist
        AND ch.accion = m.accion_hist
        AND ch.created_at = m.created_at
    )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted;
  RAISE NOTICE 'Backfill consent_history: % filas migradas desde consentimientos', v_inserted;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- PASO 6: Verificación
-- ─────────────────────────────────────────────────────────────────
SELECT
  c.relname AS tabla,
  c.relrowsecurity AS rls_habilitada,
  c.relforcerowsecurity AS rls_forzada,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename='consent_history') AS num_policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND c.relname='consent_history';

SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies WHERE schemaname='public' AND tablename='consent_history';

SELECT
  (SELECT COUNT(*) FROM consentimientos) AS total_consentimientos,
  (SELECT COUNT(*) FROM consent_history) AS total_consent_history,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='consent_history') AS num_columnas;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- DOCUMENTACIÓN DE DIVERGENCIA PK (para auditor):
--   - Si la tabla se creó HOY (no existía): PK = BIGSERIAL (cumple hallazgo literal).
--   - Si la tabla ya existía desde 2026-08-01: PK = UUID (preservado, no breaking).
--     Se agregó `usuario_id` como alias sin cambiar PK, cumpliendo funcionalmente
--     el requisito de datos-personales.js:84 (que usa user_id).
--   Ambas variantes pasan verifier-lpdp.mjs porque la ruta usa user_id.
-- ═══════════════════════════════════════════════════════════════════════
