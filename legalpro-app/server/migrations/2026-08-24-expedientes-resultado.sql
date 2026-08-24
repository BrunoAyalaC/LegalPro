-- ═══════════════════════════════════════════════════════════════════════════════
-- 2026-08-24-expedientes-resultado.sql
-- FIX anti-mock A: columna `resultado` para KPI tasa_exito REAL
-- ═══════════════════════════════════════════════════════════════════════════════
-- CONTEXTO (2026-08-24):
--   El endpoint GET /api/expedientes/stats calculaba la "tasa de éxito" con la
--   fórmula inventada Math.min(95, 60 + total*2) → dato falso mostrado al cliente.
--   Ahora calcula favorables/(favorables+desfavorables)*100 sobre expedientes
--   cerrados/resueltos CON resultado registrado (<5 casos → null + motivo).
--
--   Esta migración crea la columna que alimenta ese cálculo. Es idempotente:
--   puede re-ejecutarse sin error (ADD COLUMN IF NOT EXISTS).
--
-- NOTA RLS: la tabla expedientes ya tiene RLS por organization_id (patrón
--   canónico de init.sql). La nueva columna hereda ese aislamiento; no se
--   requieren policies adicionales.
--
-- CONSUMIDORES:
--   - server/routes/expedientes.js (GET /stats, PUT/PATCH /:id campo `resultado`)
--   - server/schemas/expedienteSchema.js (expedienteUpdateSchema.resultado)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE expedientes
  ADD COLUMN IF NOT EXISTS resultado TEXT;

-- Solo valores del dominio del KPI (o NULL = aún sin resultado)
ALTER TABLE expedientes
  DROP CONSTRAINT IF EXISTS chk_expedientes_resultado;
ALTER TABLE expedientes
  ADD CONSTRAINT chk_expedientes_resultado
  CHECK (resultado IS NULL OR resultado IN ('favorable', 'desfavorable'));

-- Índice parcial para el agregado de /stats (solo filas que alimentan el KPI)
CREATE INDEX IF NOT EXISTS idx_expedientes_resultado_stats
  ON expedientes (organization_id)
  WHERE estado IN ('cerrado', 'resuelto')
    AND resultado IN ('favorable', 'desfavorable');
