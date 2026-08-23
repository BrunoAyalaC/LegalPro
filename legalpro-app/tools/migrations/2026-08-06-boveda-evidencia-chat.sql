-- ═══════════════════════════════════════════════════════════════════════════
-- 2026-08-06-boveda-evidencia-chat.sql
-- Bóveda de Evidencia desde Chat IA (guardar documento generado como evidencia)
--
-- REFUERZO IDEMPOTENTE de `evidencia_digital` (Bóveda):
--   La tabla ya existe en server/init.sql con trigger de inmutabilidad y RLS.
--   Esta migración garantiza que la feature POST /api/boveda/guardar-documento
--   funcione en cualquier base que no haya ejecutado init.sql (CI, staging,
--   nuevas instancias Railway).
--
-- NOTA DE CATÁLOGO: catalogs/supabase-schema.md documenta la tabla como
-- `evidencia`; el schema REAL de la BD usa `evidencia_digital`. El router
-- boveda-chat.js opera contra `evidencia_digital`.
--
-- Ley 27269 (Perú): evidencia digital inmutable — hash SHA-256 + cadena de
-- custodia. La inmutabilidad se impone vía trigger BEFORE UPDATE OR DELETE.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tabla (si no existe) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evidencia_digital (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id        UUID        REFERENCES usuarios(id),
    organization_id   UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
    expediente_id     UUID        REFERENCES expedientes(id),
    nombre_original   TEXT        NOT NULL,
    tipo_archivo      TEXT        NOT NULL,
    tamano_bytes      BIGINT      NOT NULL,
    hash_sha256       TEXT        NOT NULL UNIQUE,
    storage_path      TEXT        NOT NULL,
    descripcion       TEXT,
    etiqueta          TEXT,
    cadena_custodia   JSONB       NOT NULL DEFAULT '[]',
    creado_en         TIMESTAMPTZ DEFAULT now(),
    modificado_en     TIMESTAMPTZ DEFAULT now()
);

-- ── Índices de consulta por tenant/expediente/hash ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_evidencia_expediente_id ON evidencia_digital(expediente_id);
CREATE INDEX IF NOT EXISTS idx_evidencia_organization_id ON evidencia_digital(organization_id);
CREATE INDEX IF NOT EXISTS idx_evidencia_hash ON evidencia_digital(hash_sha256);

-- ── Inmutabilidad (Ley 27269): bloquea UPDATE y DELETE ──────────────────────
CREATE OR REPLACE FUNCTION fn_evidencia_inmutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Las evidencias registradas en la bóveda digital son inmutables por ley.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_evidencia_inmutable ON evidencia_digital;
CREATE TRIGGER trg_evidencia_inmutable
    BEFORE UPDATE OR DELETE ON evidencia_digital
    FOR EACH ROW EXECUTE FUNCTION fn_evidencia_inmutable();

-- ── RLS: aislamiento multi-tenant (filtra por app.current_org_id del JWT) ──
ALTER TABLE evidencia_digital ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_evidencia_digital_all ON evidencia_digital;
CREATE POLICY p_evidencia_digital_all ON evidencia_digital
    FOR ALL
    USING (organization_id = fn_rls_current_org_id())
    WITH CHECK (organization_id = fn_rls_current_org_id());

COMMENT ON POLICY p_evidencia_digital_all ON evidencia_digital IS
  'Evidencia digital visible solo para la propia organización. Mantiene inmutabilidad vía trigger separado.';
