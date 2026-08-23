-- ═══════════════════════════════════════════════════════════════════════════════
-- 2026-08-12-b5-b2-prod-fixes.sql
-- FIX B5 (RLS inefectivo) + B2 (migraciones faltantes) — PRODUCCIÓN
-- ═══════════════════════════════════════════════════════════════════════════════
-- CONTEXTO (auditor-lpdp + auditor-seguridad):
--   B5: El backend Node conecta como `postgres` (superuser, BYPASSRLS=true) →
--       las policies RLS no aplican. El rol `legalpro_app` existe pero no se usa.
--       ESTA MIGRACIÓN ES PREPARATORIA: verifica/asegura el rol NOBYPASSRLS y
--       sus privilegios. NO cambia la DATABASE_URL del backend (se documenta
--       como paso preparatorio; el cambio de conexión es decisión de backend).
--   B2: Las tablas `consent_history` y `solicitudes_arco` no existen en BD
--       aunque el código las referencia (tenant-validator.js, datos-personales.js).
--
-- SEGURIDAD:
--   - NO rota ninguna credencial existente (no se toca el password de
--     legalpro_app; ya existe con NOBYPASSRLS).
--   - Backup previo obligatorio: backup-before-prod-fixes-2026-08-12.sql
--   - Idempotente (CREATE TABLE IF NOT EXISTS / DROP POLICY IF EXISTS).
--
-- CONVENCIONES (fuente: init.sql + tools/migrations/2026-08-07-fix-consentimientos-rls.sql):
--   - Patrón canónico de policy NULL-safe:
--       `current_setting('app.current_org_id', TRUE)::UUID`
--     equivalente a `fn_rls_current_org_id()`.
--   - FORCE ROW LEVEL SECURITY en toda tabla tenant.
--   - snake_case, created_at/updated_at, soft-delete deleted_at.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- BLOQUE B5: Rol de aplicación NOBYPASSRLS (preparatorio)
-- ───────────────────────────────────────────────────────────────────────────────
-- Verificación en PASO 2: `legalpro_app` EXISTE con rolbypassrls=f,
-- rolsuper=f, rolcanlogin=t → cumple el requisito. No se crea ni se altera su
-- password (NO rotar credenciales existentes). Aquí solo se aseguran los
-- privilegios de forma idempotente (GRANT repetido es un no-op si ya existe).

GRANT USAGE ON SCHEMA public TO legalpro_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO legalpro_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legalpro_app;

-- Cubrir objetos futuros creados por postgres (owner) de forma automática.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO legalpro_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO legalpro_app;

-- ───────────────────────────────────────────────────────────────────────────────
-- BLOQUE B2.1: consent_history (bitácora LPDP Art. 21)
-- ───────────────────────────────────────────────────────────────────────────────
-- Estructura canónica: tools/migrations/2026-08-01-consent-history.sql
-- Tabla append-only (solo INSERT) de auditoría de consentimientos/revocaciones.
-- No lleva updated_at/deleted_at por diseño: la bitácora es inmutable.

CREATE TABLE IF NOT EXISTS consent_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizaciones(id),
  user_id UUID NOT NULL REFERENCES usuarios(id),
  tipo TEXT NOT NULL CHECK (tipo IN (
    'terminos_condiciones',
    'politica_privacidad',
    'marketing',
    'transferencia_internacional',
    'cookies_analiticas',
    'cookies_funcionales'
  )),
  accion TEXT NOT NULL CHECK (accion IN ('otorgado', 'revocado', 'modificado')),
  version_documento TEXT,
  ip_address INET,
  user_agent TEXT,
  motivo_revocacion TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_history_user ON consent_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_history_org ON consent_history(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_history_tipo ON consent_history(tipo, accion);

ALTER TABLE consent_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_history FORCE ROW LEVEL SECURITY;

-- Policy multi-tenant NULL-safe (fail-closed): si app.current_org_id no está
-- seteada, la comparación devuelve NULL → ninguna fila visible (deny).
DROP POLICY IF EXISTS consent_history_isolation ON consent_history;
CREATE POLICY consent_history_isolation ON consent_history
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', TRUE)::UUID)
  WITH CHECK (organization_id = current_setting('app.current_org_id', TRUE)::UUID);

COMMENT ON TABLE consent_history IS
  'Registro histórico de consentimientos LPDP Art. 21 — bitácora inmutable para auditoría';
COMMENT ON COLUMN consent_history.version_documento IS
  'Versión del doc legal (términos, privacidad) que el usuario aceptó';

-- ───────────────────────────────────────────────────────────────────────────────
-- BLOQUE B2.2: solicitudes_arco (derechos ARCO — LPDP Arts. 24-28)
-- ───────────────────────────────────────────────────────────────────────────────
-- Referenciada por legalpro-app/server/middleware/tenant-validator.js:16
-- (TENANT_PROTECTED_TABLES) → DEBE tener organization_id y deleted_at porque
-- el middleware consulta: `WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL`.

CREATE TABLE IF NOT EXISTS solicitudes_arco (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'acceso',          -- Art. 24 LPDP: derecho de acceso
    'rectificacion',   -- Art. 25 LPDP: derecho de rectificación
    'cancelacion',     -- Art. 26 LPDP: derecho de cancelación
    'oposicion'        -- Art. 27 LPDP: derecho de oposición
  )),
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_proceso', 'completado', 'rechazado')),
  datos_solicitados JSONB NOT NULL DEFAULT '{}',
  respuesta TEXT,
  respondido_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  respondido_en TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS trg_solicitudes_arco_updated_at ON solicitudes_arco;
CREATE TRIGGER trg_solicitudes_arco_updated_at
  BEFORE UPDATE ON solicitudes_arco
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_solicitudes_arco_org ON solicitudes_arco(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_solicitudes_arco_usuario ON solicitudes_arco(usuario_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_arco_estado ON solicitudes_arco(estado) WHERE deleted_at IS NULL;

ALTER TABLE solicitudes_arco ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_arco FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_solicitudes_arco_all ON solicitudes_arco;
CREATE POLICY p_solicitudes_arco_all ON solicitudes_arco
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', TRUE)::UUID)
  WITH CHECK (organization_id = current_setting('app.current_org_id', TRUE)::UUID);

COMMENT ON TABLE solicitudes_arco IS
  'Solicitudes de derechos ARCO (LPDP Arts. 24-28): acceso, rectificación, cancelación, oposición. Aislada por organización.';
COMMENT ON COLUMN solicitudes_arco.estado IS
  'Estado del trámite: pendiente | en_proceso | completado | rechazado (plazo LPDP Art. 28: 10 días hábiles)';

-- ───────────────────────────────────────────────────────────────────────────────
-- BLOQUE B5/B2: Grants explícitos para las tablas nuevas (idempotente)
-- ───────────────────────────────────────────────────────────────────────────────
-- Los ALTER DEFAULT PRIVILEGES ya cubren tablas futuras creadas por postgres;
-- los GRANT explícitos documentan y aseguran las dos tablas de esta migración.
GRANT SELECT, INSERT, UPDATE, DELETE ON consent_history TO legalpro_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON solicitudes_arco TO legalpro_app;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN POST (ejecutar manualmente tras aplicar la migración)
-- ═══════════════════════════════════════════════════════════════════════════════
-- SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname IN ('postgres','legalpro_app');
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('consent_history','solicitudes_arco');
-- SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('consent_history','solicitudes_arco');
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname='public' AND tablename IN ('consent_history','solicitudes_arco');
-- ═══════════════════════════════════════════════════════════════════════════════
