-- =============================================================================
-- LegalPro - Configuración completa de Multi-Tenancy en Supabase
-- =============================================================================
-- Ejecutar directamente en: Supabase Dashboard → SQL Editor
-- Orden de ejecución: secuencial (no cambiar el orden)
-- Fecha: 2026-03-16
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 0: EXTENSIONES REQUERIDAS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 1: TABLA ORGANIZACIONES (Tenant Root)
-- ─────────────────────────────────────────────────────────────────────────────
-- Cada organización representa un tenant independiente.
-- Un estudio jurídico, fiscalía o juzgado es una organización.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizaciones (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         TEXT        NOT NULL,
  slug           TEXT        UNIQUE NOT NULL,
  plan           TEXT        NOT NULL DEFAULT 'free'
                             CHECK (plan IN ('free', 'pro', 'enterprise')),
  max_usuarios   INT         NOT NULL DEFAULT 5,
  max_expedientes INT        NOT NULL DEFAULT 50,
  activo         BOOLEAN     NOT NULL DEFAULT true,
  metadata       JSONB       NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ
);

COMMENT ON TABLE  organizaciones               IS 'Tenant root: cada organización es un espacio aislado';
COMMENT ON COLUMN organizaciones.slug          IS 'Identificador URL-friendly único (ej: estudio-garcia)';
COMMENT ON COLUMN organizaciones.plan          IS 'Plan de suscripción: free | pro | enterprise';
COMMENT ON COLUMN organizaciones.max_usuarios  IS 'Límite de usuarios activos según el plan';
COMMENT ON COLUMN organizaciones.max_expedientes IS 'Límite de expedientes activos según el plan';
COMMENT ON COLUMN organizaciones.metadata      IS 'Datos adicionales: logo_url, ruc, direccion, etc.';

-- Trigger updated_at automático para organizaciones
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizaciones_updated_at
  BEFORE UPDATE ON organizaciones
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 2: TABLA SUSCRIPCIONES
-- ─────────────────────────────────────────────────────────────────────────────
-- Historial de planes y billing por organización.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS suscripciones (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  plan              TEXT        NOT NULL CHECK (plan IN ('free', 'pro', 'enterprise')),
  estado            TEXT        NOT NULL DEFAULT 'activa'
                                CHECK (estado IN ('activa', 'cancelada', 'vencida', 'trial')),
  fecha_inicio      DATE        NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  precio_mensual    NUMERIC(10,2) DEFAULT 0,
  moneda            TEXT        NOT NULL DEFAULT 'PEN',
  proveedor_pago    TEXT,                         -- stripe | izipay | culqi
  referencia_pago   TEXT,                         -- ID externo del proveedor
  metadata          JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ
);

COMMENT ON TABLE suscripciones IS 'Historial de suscripciones y billing por organización';

CREATE TRIGGER trg_suscripciones_updated_at
  BEFORE UPDATE ON suscripciones
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 3: TABLA INVITACIONES_ORGANIZACION
-- ─────────────────────────────────────────────────────────────────────────────
-- Permite invitar nuevos miembros por email con token firmado.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invitaciones_organizacion (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  email           TEXT        NOT NULL,
  rol             TEXT        NOT NULL DEFAULT 'ABOGADO'
                              CHECK (rol IN ('ABOGADO', 'FISCAL', 'JUEZ', 'CONTADOR', 'ADMIN')),
  token           TEXT        NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  estado          TEXT        NOT NULL DEFAULT 'pendiente'
                              CHECK (estado IN ('pendiente', 'aceptada', 'expirada', 'cancelada')),
  invitado_por    UUID,                           -- auth.uid() del que invita
  expira_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  aceptada_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)                 -- no duplicar invitaciones activas
);

COMMENT ON TABLE  invitaciones_organizacion         IS 'Invitaciones por email para incorporar usuarios a una organización';
COMMENT ON COLUMN invitaciones_organizacion.token   IS 'Token único de 64 chars hex para aceptar la invitación';
COMMENT ON COLUMN invitaciones_organizacion.expira_at IS 'Las invitaciones expiran a los 7 días por defecto';

-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 4: AGREGAR organization_id A TABLAS EXISTENTES
-- ─────────────────────────────────────────────────────────────────────────────
-- Se agrega como columna NULLABLE primero para no romper datos existentes.
-- Luego se puede hacer NOT NULL con un DEFAULT o script de backfill.
-- ─────────────────────────────────────────────────────────────────────────────

-- 4a. Tabla USUARIOS
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizaciones(id) ON DELETE SET NULL;

COMMENT ON COLUMN usuarios.organization_id IS 'Tenant al que pertenece el usuario';

-- 4b. Tabla EXPEDIENTES
ALTER TABLE expedientes
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizaciones(id) ON DELETE CASCADE;

COMMENT ON COLUMN expedientes.organization_id IS 'Tenant dueño del expediente';

-- 4c. Tabla SIMULACIONES
ALTER TABLE simulaciones
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizaciones(id) ON DELETE CASCADE;

COMMENT ON COLUMN simulaciones.organization_id IS 'Tenant dueño de la simulación';

-- 4d. Tabla EVENTOS_SIMULACION (hereda organización de su simulación padre)
--     Su aislamiento RLS se logra vía JOIN a simulaciones, no FK directa.
--     Pero agregamos la columna para queries directos y performance.
ALTER TABLE eventos_simulacion
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizaciones(id) ON DELETE CASCADE;

COMMENT ON COLUMN eventos_simulacion.organization_id IS 'Desnormalizado desde simulaciones para performance en RLS';

-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 5: TABLA AUDIT_LOG (Multi-tenant audit trail)
-- ─────────────────────────────────────────────────────────────────────────────
-- Registro inmutable de todas las operaciones críticas.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id               BIGSERIAL   PRIMARY KEY,
  organization_id  UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  usuario_id       UUID,                           -- auth.uid() del actor
  tabla            TEXT        NOT NULL,
  operacion        TEXT        NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
  registro_id      TEXT        NOT NULL,           -- PK del registro afectado
  datos_anteriores JSONB,                          -- NULL en INSERT
  datos_nuevos     JSONB,                          -- NULL en DELETE
  ip_address       INET,
  user_agent       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  audit_log                     IS 'Trazabilidad inmutable por tenant de todas las operaciones';
COMMENT ON COLUMN audit_log.usuario_id          IS 'auth.uid() del usuario que ejecutó la operación';
COMMENT ON COLUMN audit_log.datos_anteriores    IS 'Estado del registro ANTES del cambio (NULL en INSERT)';
COMMENT ON COLUMN audit_log.datos_nuevos        IS 'Estado del registro DESPUÉS del cambio (NULL en DELETE)';

-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 6: ÍNDICES DE PERFORMANCE
-- ─────────────────────────────────────────────────────────────────────────────

-- Expedientes: queries más frecuentes por tenant + estado + fecha
CREATE INDEX IF NOT EXISTS idx_expedientes_org_estado
  ON expedientes(organization_id, estado);

CREATE INDEX IF NOT EXISTS idx_expedientes_org_created
  ON expedientes(organization_id, created_at DESC);

-- Usuarios: búsqueda por tenant + rol para dashboards
CREATE INDEX IF NOT EXISTS idx_usuarios_org_rol
  ON usuarios(organization_id, rol);

-- Simulaciones: por tenant
CREATE INDEX IF NOT EXISTS idx_simulaciones_org
  ON simulaciones(organization_id);

-- Eventos simulación: JOIN frecuente con simulaciones
CREATE INDEX IF NOT EXISTS idx_eventos_simulacion_org
  ON eventos_simulacion(organization_id);

-- Audit log: queries de auditoría por tenant en orden cronológico
CREATE INDEX IF NOT EXISTS idx_audit_log_org_created
  ON audit_log(organization_id, created_at DESC);

-- Audit log: filtrado por tabla específica dentro de un tenant
CREATE INDEX IF NOT EXISTS idx_audit_log_org_tabla
  ON audit_log(organization_id, tabla, operacion);

-- Suscripciones: estado activo por organización
CREATE INDEX IF NOT EXISTS idx_suscripciones_org_estado
  ON suscripciones(organization_id, estado);

-- Invitaciones: búsqueda por token (para aceptar invitación)
CREATE INDEX IF NOT EXISTS idx_invitaciones_token
  ON invitaciones_organizacion(token) WHERE estado = 'pendiente';

-- Invitaciones: por organización
CREATE INDEX IF NOT EXISTS idx_invitaciones_org
  ON invitaciones_organizacion(organization_id, estado);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 7: FUNCIONES HELPER (JWT Claims)
-- ─────────────────────────────────────────────────────────────────────────────
-- El JWT de Supabase Auth puede llevar claims personalizados.
-- Estos claims se inyectan desde el backend .NET/Node al firmar el token,
-- o via Supabase Auth hooks (custom_access_token_hook).
-- ─────────────────────────────────────────────────────────────────────────────

-- Obtiene el organization_id del JWT actual
CREATE OR REPLACE FUNCTION current_organization_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'organization_id')::UUID,
    (auth.jwt() ->> 'organization_id')::UUID,
    NULL
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION current_organization_id() IS
  'Extrae organization_id del JWT claim (app_metadata.organization_id o claim directo)';

-- Obtiene el rol del usuario actual del JWT
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'rol'),
    (auth.jwt() ->> 'rol'),
    'ABOGADO'                                     -- rol por defecto si no hay claim
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION current_user_role() IS
  'Extrae el rol del usuario del JWT claim (app_metadata.rol o claim directo)';

-- Verifica si el usuario actual es ADMIN de su organización
CREATE OR REPLACE FUNCTION is_org_admin()
RETURNS BOOLEAN AS $$
  SELECT current_user_role() = 'ADMIN';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION is_org_admin() IS
  'Retorna TRUE si el usuario tiene rol ADMIN en su organización';

-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 8: FUNCIÓN check_plan_limits()
-- ─────────────────────────────────────────────────────────────────────────────
-- Valida si una organización puede crear más recursos según su plan.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_plan_limits(
  p_organization_id UUID,
  p_recurso         TEXT     -- 'usuario' | 'expediente'
)
RETURNS JSONB AS $$
DECLARE
  v_org           organizaciones%ROWTYPE;
  v_actual        INT;
  v_limite        INT;
  v_puede         BOOLEAN;
BEGIN
  -- Obtener la organización
  SELECT * INTO v_org
  FROM organizaciones
  WHERE id = p_organization_id AND activo = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'puede', false,
      'motivo', 'Organización no encontrada o inactiva'
    );
  END IF;

  -- Contar uso actual y obtener límite según el recurso
  IF p_recurso = 'usuario' THEN
    SELECT COUNT(*) INTO v_actual
    FROM usuarios
    WHERE organization_id = p_organization_id;
    v_limite := v_org.max_usuarios;

  ELSIF p_recurso = 'expediente' THEN
    SELECT COUNT(*) INTO v_actual
    FROM expedientes
    WHERE organization_id = p_organization_id;
    v_limite := v_org.max_expedientes;

  ELSE
    RETURN jsonb_build_object(
      'puede', false,
      'motivo', 'Recurso desconocido: ' || p_recurso
    );
  END IF;

  v_puede := v_actual < v_limite;

  RETURN jsonb_build_object(
    'puede',         v_puede,
    'plan',          v_org.plan,
    'recurso',       p_recurso,
    'uso_actual',    v_actual,
    'limite',        v_limite,
    'disponibles',   GREATEST(v_limite - v_actual, 0),
    'motivo',        CASE WHEN v_puede
                       THEN 'OK'
                       ELSE format('Límite de %s alcanzado (%s/%s) en plan %s',
                                   p_recurso, v_actual, v_limite, v_org.plan)
                     END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_plan_limits(UUID, TEXT) IS
  'Verifica si la organización puede crear más usuarios o expedientes según su plan';

-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 9: FUNCIÓN AUDIT TRIGGER (genérica)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id    UUID;
  v_reg_id    TEXT;
  v_old_data  JSONB;
  v_new_data  JSONB;
BEGIN
  -- Obtener organization_id según la operación
  IF TG_OP = 'DELETE' THEN
    v_org_id := OLD.organization_id;
    v_reg_id := OLD.id::TEXT;
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_org_id := NEW.organization_id;
    v_reg_id := NEW.id::TEXT;
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
  ELSE -- UPDATE
    v_org_id := NEW.organization_id;
    v_reg_id := NEW.id::TEXT;
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  END IF;

  -- Solo registrar si tiene organization_id (evitar ruido en datos no migrados)
  IF v_org_id IS NOT NULL THEN
    INSERT INTO audit_log (
      organization_id,
      usuario_id,
      tabla,
      operacion,
      registro_id,
      datos_anteriores,
      datos_nuevos
    ) VALUES (
      v_org_id,
      auth.uid(),
      TG_TABLE_NAME,
      TG_OP,
      v_reg_id,
      v_old_data,
      v_new_data
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_audit_trigger() IS
  'Trigger genérico que registra INSERT/UPDATE/DELETE en audit_log por tenant';

-- Aplicar trigger de auditoría a EXPEDIENTES
DROP TRIGGER IF EXISTS trg_expedientes_audit ON expedientes;
CREATE TRIGGER trg_expedientes_audit
  AFTER INSERT OR UPDATE OR DELETE ON expedientes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Aplicar trigger de auditoría a SIMULACIONES
DROP TRIGGER IF EXISTS trg_simulaciones_audit ON simulaciones;
CREATE TRIGGER trg_simulaciones_audit
  AFTER INSERT OR UPDATE OR DELETE ON simulaciones
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Trigger para propagar organization_id a eventos_simulacion automáticamente
CREATE OR REPLACE FUNCTION fn_propagar_org_a_eventos()
RETURNS TRIGGER AS $$
BEGIN
  -- Cuando se crea un evento, hereda la org de la simulación padre
  IF NEW.organization_id IS NULL AND NEW.simulacion_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM simulaciones
    WHERE id = NEW.simulacion_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_eventos_hereda_org ON eventos_simulacion;
CREATE TRIGGER trg_eventos_hereda_org
  BEFORE INSERT ON eventos_simulacion
  FOR EACH ROW EXECUTE FUNCTION fn_propagar_org_a_eventos();

-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 10: ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────────
-- PRINCIPIO: cada usuario solo ve datos de su organización.
-- El service_role de Supabase SIEMPRE bypasea RLS (comportamiento nativo).
-- El backend .NET/Node usa SUPABASE_SERVICE_KEY → acceso total sin RLS.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 10a. ORGANIZACIONES ──────────────────────────────────────────────────────
ALTER TABLE organizaciones ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede leer su propia organización
CREATE POLICY "org_select_miembro" ON organizaciones
  FOR SELECT
  USING (id = current_organization_id());

-- Solo ADMIN puede actualizar los datos de la organización
CREATE POLICY "org_update_admin" ON organizaciones
  FOR UPDATE
  USING (id = current_organization_id() AND is_org_admin())
  WITH CHECK (id = current_organization_id() AND is_org_admin());

-- Nadie crea organizaciones desde el cliente (solo service_role)
-- INSERT/DELETE queda denegado implícitamente.

-- ── 10b. USUARIOS ─────────────────────────────────────────────────────────────
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Cada usuario ve a todos los miembros de su organización
CREATE POLICY "usuarios_select_org" ON usuarios
  FOR SELECT
  USING (organization_id = current_organization_id());

-- Un usuario puede actualizar su propio perfil
CREATE POLICY "usuarios_update_self" ON usuarios
  FOR UPDATE
  USING (
    organization_id = current_organization_id()
    AND (
      auth.uid()::TEXT = id::TEXT   -- es el mismo usuario
      OR is_org_admin()             -- o es admin
    )
  )
  WITH CHECK (
    organization_id = current_organization_id()
  );

-- Solo ADMIN puede insertar nuevos usuarios (alta manual, raramente usada)
CREATE POLICY "usuarios_insert_admin" ON usuarios
  FOR INSERT
  WITH CHECK (
    organization_id = current_organization_id()
    AND is_org_admin()
  );

-- Solo ADMIN puede desactivar/eliminar usuarios
CREATE POLICY "usuarios_delete_admin" ON usuarios
  FOR DELETE
  USING (
    organization_id = current_organization_id()
    AND is_org_admin()
  );

-- ── 10c. EXPEDIENTES ─────────────────────────────────────────────────────────
ALTER TABLE expedientes ENABLE ROW LEVEL SECURITY;

-- Todos los miembros de la organización pueden leer expedientes
CREATE POLICY "expedientes_select_org" ON expedientes
  FOR SELECT
  USING (organization_id = current_organization_id());

-- Cualquier miembro autenticado puede crear expedientes (se validan límites de plan vía función)
CREATE POLICY "expedientes_insert_org" ON expedientes
  FOR INSERT
  WITH CHECK (organization_id = current_organization_id());

-- Cualquier miembro puede actualizar expedientes de su org
CREATE POLICY "expedientes_update_org" ON expedientes
  FOR UPDATE
  USING (organization_id = current_organization_id())
  WITH CHECK (organization_id = current_organization_id());

-- Solo ADMIN puede eliminar expedientes
CREATE POLICY "expedientes_delete_admin" ON expedientes
  FOR DELETE
  USING (
    organization_id = current_organization_id()
    AND is_org_admin()
  );

-- ── 10d. SIMULACIONES ────────────────────────────────────────────────────────
ALTER TABLE simulaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "simulaciones_select_org" ON simulaciones
  FOR SELECT
  USING (organization_id = current_organization_id());

CREATE POLICY "simulaciones_insert_org" ON simulaciones
  FOR INSERT
  WITH CHECK (organization_id = current_organization_id());

CREATE POLICY "simulaciones_update_org" ON simulaciones
  FOR UPDATE
  USING (organization_id = current_organization_id())
  WITH CHECK (organization_id = current_organization_id());

CREATE POLICY "simulaciones_delete_admin" ON simulaciones
  FOR DELETE
  USING (
    organization_id = current_organization_id()
    AND is_org_admin()
  );

-- ── 10e. EVENTOS_SIMULACION ───────────────────────────────────────────────────
ALTER TABLE eventos_simulacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eventos_select_org" ON eventos_simulacion
  FOR SELECT
  USING (organization_id = current_organization_id());

CREATE POLICY "eventos_insert_org" ON eventos_simulacion
  FOR INSERT
  WITH CHECK (organization_id = current_organization_id());

CREATE POLICY "eventos_update_org" ON eventos_simulacion
  FOR UPDATE
  USING (organization_id = current_organization_id())
  WITH CHECK (organization_id = current_organization_id());

CREATE POLICY "eventos_delete_admin" ON eventos_simulacion
  FOR DELETE
  USING (
    organization_id = current_organization_id()
    AND is_org_admin()
  );

-- ── 10f. AUDIT_LOG ────────────────────────────────────────────────────────────
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Solo lectura para ADMIN (el audit trail es inmutable desde el cliente)
CREATE POLICY "audit_select_admin" ON audit_log
  FOR SELECT
  USING (
    organization_id = current_organization_id()
    AND is_org_admin()
  );

-- INSERT solo via trigger (service_role) - no desde el cliente
-- UPDATE/DELETE denegados implícitamente (audit log es inmutable)

-- ── 10g. SUSCRIPCIONES ────────────────────────────────────────────────────────
ALTER TABLE suscripciones ENABLE ROW LEVEL SECURITY;

-- ADMIN puede ver las suscripciones de su organización
CREATE POLICY "suscripciones_select_admin" ON suscripciones
  FOR SELECT
  USING (
    organization_id = current_organization_id()
    AND is_org_admin()
  );

-- Insert/Update/Delete solo via service_role (backend) para evitar fraude

-- ── 10h. INVITACIONES_ORGANIZACION ────────────────────────────────────────────
ALTER TABLE invitaciones_organizacion ENABLE ROW LEVEL SECURITY;

-- ADMIN ve todas las invitaciones de su org
CREATE POLICY "invitaciones_select_admin" ON invitaciones_organizacion
  FOR SELECT
  USING (
    organization_id = current_organization_id()
    AND is_org_admin()
  );

-- ADMIN puede crear invitaciones dentro de su org
CREATE POLICY "invitaciones_insert_admin" ON invitaciones_organizacion
  FOR INSERT
  WITH CHECK (
    organization_id = current_organization_id()
    AND is_org_admin()
  );

-- ADMIN puede cancelar invitaciones
CREATE POLICY "invitaciones_update_admin" ON invitaciones_organizacion
  FOR UPDATE
  USING (
    organization_id = current_organization_id()
    AND is_org_admin()
  )
  WITH CHECK (organization_id = current_organization_id());

-- ── 10i. BASE_LEGAL_VECTORIAL (lectura pública) ───────────────────────────────
ALTER TABLE base_legal_vectorial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "base_legal_select_public" ON base_legal_vectorial
  FOR SELECT
  USING (true);                                   -- todos los autenticados pueden leer

-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 11: VISTAS ÚTILES
-- ─────────────────────────────────────────────────────────────────────────────

-- Vista: estadísticas agregadas por organización (uso del dashboard superadmin)
CREATE OR REPLACE VIEW org_stats AS
SELECT
  o.id,
  o.nombre,
  o.slug,
  o.plan,
  o.activo,
  o.max_usuarios,
  o.max_expedientes,
  COUNT(DISTINCT u.id)  AS total_usuarios,
  COUNT(DISTINCT e.id)  AS total_expedientes,
  COUNT(DISTINCT s.id)  AS total_simulaciones,
  o.created_at
FROM organizaciones o
LEFT JOIN usuarios    u ON u.organization_id = o.id
LEFT JOIN expedientes e ON e.organization_id = o.id
LEFT JOIN simulaciones s ON s.organization_id = o.id
WHERE o.activo = true
GROUP BY o.id, o.nombre, o.slug, o.plan, o.activo, o.max_usuarios, o.max_expedientes, o.created_at;

COMMENT ON VIEW org_stats IS
  'Estadísticas agregadas por tenant para el panel de superadmin';

-- Vista: uso vs límites del plan por organización
CREATE OR REPLACE VIEW org_plan_usage AS
SELECT
  o.id               AS organization_id,
  o.nombre,
  o.plan,
  o.max_usuarios,
  o.max_expedientes,
  COUNT(DISTINCT u.id)                        AS usuarios_activos,
  COUNT(DISTINCT e.id)                        AS expedientes_activos,
  ROUND(COUNT(DISTINCT u.id)::NUMERIC
        / NULLIF(o.max_usuarios, 0) * 100, 1) AS pct_usuarios,
  ROUND(COUNT(DISTINCT e.id)::NUMERIC
        / NULLIF(o.max_expedientes, 0) * 100, 1) AS pct_expedientes
FROM organizaciones o
LEFT JOIN usuarios    u ON u.organization_id = o.id
LEFT JOIN expedientes e ON e.organization_id = o.id
WHERE o.activo = true
GROUP BY o.id, o.nombre, o.plan, o.max_usuarios, o.max_expedientes;

COMMENT ON VIEW org_plan_usage IS
  'Uso real vs límites del plan por organización (útil para alertas de límite)';

-- Vista: actividad reciente de auditoría por organización
CREATE OR REPLACE VIEW audit_log_reciente AS
SELECT
  al.id,
  al.organization_id,
  o.nombre           AS organizacion,
  al.usuario_id,
  al.tabla,
  al.operacion,
  al.registro_id,
  al.ip_address,
  al.created_at
FROM audit_log al
JOIN organizaciones o ON o.id = al.organization_id
ORDER BY al.created_at DESC;

COMMENT ON VIEW audit_log_reciente IS
  'Vista de auditoría enriquecida con el nombre de la organización';

-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 12: DATOS SEED PARA DESARROLLO
-- ─────────────────────────────────────────────────────────────────────────────
-- IMPORTANTE: Ejecutar SOLO en entorno de desarrollo/staging.
-- En producción, crear organizaciones vía el flujo de onboarding.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO organizaciones (nombre, slug, plan, max_usuarios, max_expedientes, metadata)
VALUES
  (
    'Estudio García & Asociados',
    'estudio-garcia',
    'pro',
    20,
    500,
    '{"tipo": "estudio_privado", "ciudad": "Lima", "ruc": "20123456789"}'
  ),
  (
    'Fiscalía Lima Norte',
    'fiscalia-lima-norte',
    'enterprise',
    50,
    2000,
    '{"tipo": "fiscalia", "distrito_fiscal": "Lima Norte", "jurisdiccion": "Lima"}'
  ),
  (
    'Demo Organization',
    'demo',
    'free',
    5,
    50,
    '{"tipo": "demo", "descripcion": "Organización de prueba para demos"}'
  )
ON CONFLICT (slug) DO NOTHING;

-- Suscripciones iniciales para las organizaciones seed
INSERT INTO suscripciones (organization_id, plan, estado, fecha_inicio, precio_mensual)
SELECT id, plan, 'activa', CURRENT_DATE,
  CASE plan
    WHEN 'free'       THEN 0
    WHEN 'pro'        THEN 299.00
    WHEN 'enterprise' THEN 999.00
  END
FROM organizaciones
WHERE slug IN ('estudio-garcia', 'fiscalia-lima-norte', 'demo')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 13: VERIFICACIÓN FINAL
-- ─────────────────────────────────────────────────────────────────────────────
-- Ejecutar este bloque para confirmar que todo se creó correctamente.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_tablas_con_rls TEXT[];
  v_tabla          TEXT;
  v_tiene_rls      BOOLEAN;
  v_ok             BOOLEAN := true;
BEGIN
  -- Verificar tablas críticas tienen RLS activo
  v_tablas_con_rls := ARRAY[
    'organizaciones', 'usuarios', 'expedientes',
    'simulaciones', 'eventos_simulacion', 'audit_log',
    'suscripciones', 'invitaciones_organizacion', 'base_legal_vectorial'
  ];

  FOREACH v_tabla IN ARRAY v_tablas_con_rls LOOP
    SELECT rowsecurity INTO v_tiene_rls
    FROM pg_tables
    WHERE tablename = v_tabla AND schemaname = 'public';

    IF NOT COALESCE(v_tiene_rls, false) THEN
      RAISE WARNING 'ADVERTENCIA: Tabla "%" NO tiene RLS habilitado!', v_tabla;
      v_ok := false;
    END IF;
  END LOOP;

  IF v_ok THEN
    RAISE NOTICE '✓ Verificación completada: todas las tablas tienen RLS habilitado.';
  ELSE
    RAISE NOTICE '✗ Verificación fallida: revisar tablas sin RLS (ver advertencias arriba).';
  END IF;

  RAISE NOTICE '✓ Organizaciones seed: %', (SELECT COUNT(*) FROM organizaciones);
  RAISE NOTICE '✓ Suscripciones seed: %', (SELECT COUNT(*) FROM suscripciones);
  RAISE NOTICE '✓ Setup de multi-tenancy completado.';
END $$;
