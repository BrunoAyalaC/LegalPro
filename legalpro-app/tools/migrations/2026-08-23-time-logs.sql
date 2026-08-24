-- ═══════════════════════════════════════════════════════════════════════════
-- 2026-08-23-time-logs.sql — Control de Horas (time tracking por abogado)
--
-- Registra minutos trabajados por usuario y expediente dentro de una
-- organización. Multi-tenant: organization_id NOT NULL + RLS (defensa en
-- profundidad además del WHERE explícito en cada query del router).
--
-- Idempotente: seguro ejecutar múltiples veces.
-- Espejo idempotente en server/initDb.js (patch de arranque).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS time_logs (
  id              BIGSERIAL    PRIMARY KEY,
  organization_id UUID         NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  user_id         UUID         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expediente_id   UUID         NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  descripcion     TEXT         NOT NULL,
  minutos         INTEGER      NOT NULL CHECK (minutos BETWEEN 1 AND 1440),
  fecha           DATE         NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Índice principal: consultas "horas del mes del usuario" (GET /api/horas)
CREATE INDEX IF NOT EXISTS idx_time_logs_org_user_fecha
  ON time_logs (organization_id, user_id, fecha);

-- Resumen anual agrupa solo por mes, pero sigue filtrando por org+user
CREATE INDEX IF NOT EXISTS idx_time_logs_expediente
  ON time_logs (expediente_id);

-- ── RLS multi-tenant (mismo patrón que vencimientos_overrides) ──────────────
ALTER TABLE time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_time_logs_all ON time_logs;
CREATE POLICY p_time_logs_all ON time_logs
    FOR ALL
    USING (organization_id = fn_rls_current_org_id())
    WITH CHECK (organization_id = fn_rls_current_org_id());

COMMENT ON TABLE time_logs IS
  'Control de Horas: minutos trabajados por abogado (user_id) en un expediente. Multi-tenant con RLS.';
COMMENT ON POLICY p_time_logs_all ON time_logs IS
  'time_logs visible solo para la propia organizacion (multi-tenant)';
