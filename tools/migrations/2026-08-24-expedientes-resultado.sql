-- 2026-08-24-expedientes-resultado.sql
-- FIX anti-mock A (2026-08-24): KPI tasa_exito REAL.
--
-- Antes: /api/expedientes/stats devolvía `Math.min(95, 60 + total*2)` — número
-- inventado. Ahora la tasa se calcula SOLO con expedientes cerrados/resueltos
-- que tengan un resultado real registrado ('favorable' | 'desfavorable').
--
-- Esta migración agrega la columna que respalda ese cálculo. Idempotente.
-- Aplicar en staging/prod ANTES de desplegar el backend Node; si la columna no
-- existe, el endpoint hace fail-open y responde tasaExito:null + motivo
-- 'datos insuficientes' (nunca un número inventado).

ALTER TABLE expedientes
    ADD COLUMN IF NOT EXISTS resultado TEXT
    CHECK (resultado IN ('favorable', 'desfavorable'));

COMMENT ON COLUMN expedientes.resultado IS
    'Resultado real del caso al cerrar/resolver: favorable|desfavorable. NULL = sin resultado registrado. Alimenta el KPI tasa_exito (min. 5 casos con resultado).';

CREATE INDEX IF NOT EXISTS idx_expedientes_org_resultado
    ON expedientes(organization_id, estado, resultado)
    WHERE resultado IS NOT NULL;
