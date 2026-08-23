-- Plantilla de migracion SQL versionada
-- Formato: V<NUMBER>__<descripcion>.sql
-- Ejemplo: V015__add_consentimientos_table.sql

-- ============================================
-- V015: Add consentimientos table
-- ============================================

BEGIN;

-- 1. Extensions necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabla
CREATE TABLE IF NOT EXISTS consentimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  finalidades JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {marketing: bool, ia_analisis: bool, transferencia_internacional: bool, ...}
  terminos_aceptados BOOLEAN NOT NULL DEFAULT false,
  privacidad_aceptados BOOLEAN NOT NULL DEFAULT false,
  ip_consentimiento INET,
  user_agent TEXT,
  version_terminos TEXT NOT NULL,
  version_privacidad TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT
);

-- 3. Indices
CREATE INDEX IF NOT EXISTS idx_consentimientos_user_created
  ON consentimientos(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consentimientos_org
  ON consentimientos(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consentimientos_active
  ON consentimientos(user_id) WHERE revoked_at IS NULL;

-- 4. RLS (multi-tenant)
ALTER TABLE consentimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY consentimientos_isolation ON consentimientos
  USING (organization_id = current_setting('app.organization_id')::UUID);

-- 5. Audit trigger
CREATE OR REPLACE FUNCTION trg_consentimientos_audit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    organization_id, user_id, event_name, severity, table_name, record_key
  ) VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    COALESCE(NEW.user_id, OLD.user_id),
    CASE
      WHEN TG_OP = 'INSERT' THEN 'CONSENTIMIENTO_GRANTED'
      WHEN TG_OP = 'UPDATE' AND NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL THEN 'CONSENTIMIENTO_REVOKED'
    END,
    'INFO',
    'consentimientos',
    NEW.id::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_consentimientos_audit
  AFTER INSERT OR UPDATE ON consentimientos
  FOR EACH ROW EXECUTE FUNCTION trg_consentimientos_audit();

-- 6. Comentarios de tabla y columnas
COMMENT ON TABLE consentimientos IS 'Registro de consentimientos LPDP 29733 por finalidad';
COMMENT ON COLUMN consentimientos.finalidades IS 'JSON con flags por finalidad: marketing, ia_analisis, transferencia_internacional, etc.';
COMMENT ON COLUMN consentimientos.version_terminos IS 'Version semver de los TyC aceptados';
COMMENT ON COLUMN consentimientos.version_privacidad IS 'Version semver de la Politica de Privacidad aceptada';

COMMIT;

-- ============================================
-- Rollback (guardar como V015__add_consentimientos_table.down.sql)
-- ============================================
-- DROP TRIGGER IF EXISTS tr_consentimientos_audit ON consentimientos;
-- DROP FUNCTION IF EXISTS trg_consentimientos_audit();
-- DROP POLICY IF EXISTS consentimientos_isolation ON consentimientos;
-- DROP TABLE IF EXISTS consentimientos;
