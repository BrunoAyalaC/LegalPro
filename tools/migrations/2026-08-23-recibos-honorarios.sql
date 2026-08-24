-- ═══════════════════════════════════════════════════════════════════════
-- 2026-08-23-recibos-honorarios.sql
-- Facturación de Honorarios: recibos electrónicos RHE por organización.
-- ═══════════════════════════════════════════════════════════════════════
-- FEATURE: /api/facturacion (server/routes/facturacion.js)
--   - numero secuencial 'RHE-YYYY-NNNN' por organización
--     (UNIQUE(organization_id, numero) garantiza no colisión cross-tenant).
--   - IGV 18% desglosado: monto_base + igv = total (NUMERIC(12,2)).
--   - expediente_id NULLable con ON DELETE SET NULL: el recibo es un registro
--     contable — NO se borra en cascada si desaparece el expediente.
--   - RLS ENABLE + FORCE (patrón 2026-08-21-fix-p0-rls-force.sql): sin FORCE,
--     el table owner bypasea las policies (OWASP A01 Broken Access Control).
--
-- MULTI-TENANT:
--   - organization_id UUID NOT NULL + policy fn_rls_current_org_id().
--   - Defensa en profundidad: el router TAMBIÉN filtra WHERE organization_id.
--
-- BASE LEGAL:
--   - Ley IGV/ISC (D.Leg. 816 Art. 17): tasa IGV 18% (calculada en backend).
--   - LPDP Art. 8: aislamiento multi-tenant a nivel DB.
--
-- IDEMPOTENTE: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- PASO 1: Tabla recibos_honorarios
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recibos_honorarios (
  id              BIGSERIAL     PRIMARY KEY,
  organization_id UUID          NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  numero          TEXT          NOT NULL,
  cliente_nombre  TEXT,
  cliente_ruc     TEXT,
  concepto        TEXT,
  monto_base      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monto_base >= 0),
  igv             NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (igv >= 0),
  total           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  expediente_id   UUID          NULL REFERENCES expedientes(id) ON DELETE SET NULL,
  estado          TEXT          NOT NULL DEFAULT 'emitido'
                                CHECK (estado IN ('emitido', 'pagado', 'anulado')),
  fecha_emision   DATE          NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- Secuencial por org: dos organizaciones pueden tener ambas RHE-2026-0001
  CONSTRAINT uq_recibos_org_numero UNIQUE (organization_id, numero)
);

-- ─────────────────────────────────────────────────────────────────
-- PASO 2: Índice de consulta principal (listado + resumen mensual)
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_recibos_honorarios_org_fecha
  ON recibos_honorarios (organization_id, fecha_emision);

-- ─────────────────────────────────────────────────────────────────
-- PASO 3: RLS ENABLE + FORCE + policy multi-tenant
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE recibos_honorarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE recibos_honorarios FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_recibos_honorarios_all ON recibos_honorarios;
CREATE POLICY p_recibos_honorarios_all ON recibos_honorarios
    FOR ALL
    USING (organization_id = fn_rls_current_org_id())
    WITH CHECK (organization_id = fn_rls_current_org_id());

COMMENT ON TABLE recibos_honorarios IS
  'Recibos por Honorarios Electrónicos (RHE-YYYY-NNNN) por organización. IGV 18% desglosado. Feature /api/facturacion.';
COMMENT ON POLICY p_recibos_honorarios_all ON recibos_honorarios IS
  'recibos_honorarios visibles solo para la propia organizacion (multi-tenant, FORCE RLS)';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN POST-MIGRACIÓN
-- ═══════════════════════════════════════════════════════════════════════
SELECT relname, relrowsecurity AS rls_habilitada, relforcerowsecurity AS rls_forzada
FROM pg_class
WHERE relname = 'recibos_honorarios'
  AND relnamespace = 'public'::regnamespace;

SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'recibos_honorarios';

-- TEST FUNCIONAL MANUAL (con rol NOBYPASSRLS):
--   SET app.current_org_id = '<org-A>';
--   SELECT COUNT(*) FROM recibos_honorarios;            -- solo filas de org-A
--   SET app.current_org_id = '<org-B>';
--   INSERT INTO recibos_honorarios (organization_id, numero, monto_base)
--     VALUES ('<org-A>', 'RHE-2026-9999', 100);         -- DEBE fallar por WITH CHECK
--   RESET app.current_org_id;
