-- ══════════════════════════════════════════════════════════════════════════════
-- TABLA DE HISTORIAL DE CONSENTIMIENTOS — 1 de agosto de 2026
-- ══════════════════════════════════════════════════════════════════════════════
-- FIX LPDP-3.5: Cumplimiento Art. 21 LPDP — registro de consentimientos
-- Permite auditoría de quién consintió qué y cuándo, y revocaciones
--
-- BASE LEGAL:
--   - Ley 29733 — Ley de Protección de Datos Personales (Perú)
--   - D.S. 016-2024-JUS — Reglamento de la LPDP (publicado 2024-2025)
--   - Art. 21 LPDP: el titular tiene derecho a revocar su consentimiento
--     en cualquier momento, sin efectos retroactivos.
--   - Art. 8 LPDP: principio de responsabilidad — el titular del banco de
--     datos debe poder demostrar el consentimiento otorgado y, en su caso,
--     la revocación.
--   - Art. 18 LPDP: registro de tratamiento (finalidad, base legal,
--     plazo de retención, transferencias).
--
-- PROPÓSITO:
--   Tabla append-only (solo INSERT) que registra cada acción de otorgamiento
--   o revocación de un consentimiento. Diferencia conceptual con la tabla
--   `consentimientos` (que mantiene el estado vigente por usuario):
--
--     - `consentimientos`   → estado actual (último valor por usuario/tipo)
--     - `consent_history`   → bitácora inmutable de TODAS las acciones
--
--   Ambas son necesarias para auditoría LPDP: el estado vigente vive en
--   `consentimientos` y la historia completa en `consent_history`.
--
-- CONVENCIONES DEL PROYECTO:
--   - snake_case en nombres de tabla/columna
--   - organization_id UUID NOT NULL en toda tabla tenant
--   - RLS policies con `current_setting('app.current_org_id')::UUID`
--   - FORCE ROW LEVEL SECURITY para hacerla efectiva incluso al owner
--
-- INTEGRIDAD REFERENCIAL:
--   - FK a `organizaciones(id)` — registra el tenant en el momento de la acción
--   - FK a `usuarios(id)`      — registra el titular del dato
--   - No FK a `consentimientos` — son tablas independientes (estado vs historia)
-- ══════════════════════════════════════════════════════════════════════════════

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

CREATE INDEX idx_consent_history_user ON consent_history(user_id, created_at DESC);
CREATE INDEX idx_consent_history_org ON consent_history(organization_id, created_at DESC);
CREATE INDEX idx_consent_history_tipo ON consent_history(tipo, accion);

ALTER TABLE consent_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_history FORCE ROW LEVEL SECURITY;

CREATE POLICY consent_history_isolation ON consent_history
  USING (organization_id = current_setting('app.current_org_id')::UUID);

COMMENT ON TABLE consent_history IS
  'Registro histórico de consentimientos LPDP Art. 21 — para auditoría';
COMMENT ON COLUMN consent_history.version_documento IS
  'Versión del doc legal (términos, privacidad) que el usuario aceptó';
