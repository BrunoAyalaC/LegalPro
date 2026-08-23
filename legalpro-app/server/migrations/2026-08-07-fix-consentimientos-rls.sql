-- ═══════════════════════════════════════════════════════════════════════════════
-- 2026-08-07-fix-consentimientos-rls.sql
-- FIX RLS: consentimientos, refresh_tokens, evidencia_accesos
-- ═══════════════════════════════════════════════════════════════════════════════
-- CONTEXTO AUDITADO (2026-08-07):
--   En la BD de producción (PostgreSQL 18.4 Railway) la tabla `consentimientos`
--   tiene RLS habilitado pero **0 policies** → deny-all para el rol de app
--   (`legalpro_app`). Los 23 registros solo son visibles para `postgres`.
--   Esto rompe el flujo LPDP de consentimientos (Ley 29733).
--
--   Además: `refresh_tokens`, `evidencia_accesos` (y otras) NO tienen RLS.
--   `refresh_tokens` es sensible (sesiones JWT) y debe quedar aislado por tenant.
--
-- BASE LEGAL:
--   - Ley 29733 — Ley de Protección de Datos Personales (Perú)
--   - Art. 8  LPDP: principio de responsabilidad — el titular del banco de datos
--     debe poder demostrar el consentimiento otorgado y su revocación.
--   - Art. 18 LPDP: registro de tratamiento (finalidad, base legal, retención).
--   - Art. 21 LPDP: el titular puede revocar su consentimiento en cualquier momento.
--
-- CONVENCIONES DEL PROYECTO (fuente: legalpro-app/server/init.sql):
--   - Patrón canónico de policies: `organization_id = fn_rls_current_org_id()`
--     con `FOR ALL ... USING (...) WITH CHECK (...)` (tablas expedientes,
--     documentos, clientes, simulaciones, mensajes_chat, evidencia_digital...).
--   - Patrón alternativo documentado en tools/migrations/2026-enable-rls.sql:
--     policies `tenant_isolation_*` con `current_setting('app.current_org_id', ...)`.
--   - Patrón moderno de tools/migrations/2026-08-01-consent-history.sql:
--     `current_setting('app.current_org_id')::UUID` (tabla hermana de consentimientos).
--   - tools/migrations/2026-08-01-multitenant-hardening.sql aplica
--     `ENABLE + FORCE ROW LEVEL SECURITY` a `consentimientos` y `refresh_tokens`
--     (entre las 19 tablas tenant). FORCE hace que las policies apliquen
--     INCLUSO al owner/superusuario.
--
-- DECISIÓN DE DISEÑO (esta migración):
--   1. Naming `tenant_isolation_*` (estándar del proyecto, ver 2026-enable-rls.sql).
--   2. Expresión `current_setting('app.current_org_id', TRUE)::UUID` — equivalente
--      NULL-safe a `fn_rls_current_org_id()` y consistente con consent-history.sql.
--   3. `consentimientos` y `refresh_tokens` NO tienen columna `organization_id`
--      (solo `usuario_id`), por lo que el tenant se resuelve vía subquery a
--      `usuarios`: `usuario_id IN (SELECT id FROM usuarios WHERE <columna_tenant> =
--      current_setting('app.current_org_id', TRUE)::UUID)`. La columna tenant de
--      `usuarios` se detecta en runtime (`organization_id` canónico en init.sql,
--      `organizacion_id` como fallback legacy), para funcionar en cualquier BD destino.
--   4. `evidencia_accesos` NO está versionada en init.sql; la policy se crea de
--      forma DEFENSIVA solo si la tabla y la columna `organization_id` existen.
--   5. Idempotencia: `DROP POLICY IF EXISTS` antes de cada `CREATE POLICY`.
--
-- ⚠️ NO EJECUTAR CONTRA LA BD DE PRODUCCIÓN SIN AUTORIZACIÓN EXPLÍCITA.
--    Requiere backup previo y revisión del plan (EXPLAIN/verify).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- BLOQUE 0: ENABLE + FORCE ROW LEVEL SECURITY (idempotente)
-- ───────────────────────────────────────────────────────────────────────────────
-- `consentimientos` ya tiene RLS habilitado en producción (0 policies).
-- `refresh_tokens` y `evidencia_accesos` NO tienen RLS: se habilita aquí.
-- FORCE ROW LEVEL SECURITY garantiza que las policies apliquen incluso cuando
-- la conexión usa el owner de la tabla (postgres) — defensa en profundidad,
-- igual que en tools/migrations/2026-08-01-multitenant-hardening.sql.

ALTER TABLE consentimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE consentimientos FORCE ROW LEVEL SECURITY;

ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'evidencia_accesos'
  ) THEN
    EXECUTE 'ALTER TABLE public.evidencia_accesos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.evidencia_accesos FORCE ROW LEVEL SECURITY';
    RAISE NOTICE 'RLS habilitada (ENABLE+FORCE) en evidencia_accesos';
  ELSE
    RAISE NOTICE 'evidencia_accesos no existe: se omite ENABLE/FORCE RLS';
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- BLOQUE 1: Policy RLS para `consentimientos`
-- ───────────────────────────────────────────────────────────────────────────────
-- La tabla `consentimientos` guarda la trazabilidad LPDP del consentimiento:
--   id, usuario_id (FK → usuarios), tipo, version, aceptado, ip_address,
--   user_agent, created_at. NO tiene `organization_id`: el tenant se resuelve
--   a través de `usuario_id` → `usuarios.organization_id`.
--
-- Semántica de la policy:
--   - SELECT/INSERT/UPDATE/DELETE permitidos SOLO para usuarios que pertenecen
--     a la organización activa (app.current_org_id).
--   - La subquery a `usuarios` es la misma técnica de "ownership via subconsulta"
--     que usa el patrón self de `p_usuarios_select` (init.sql) pero escalada a
--     nivel de organización, requerida porque la fila de consentimiento no
--     almacena el tenant directamente.
--   - fail-closed: si `app.current_org_id` no está seteada, `current_setting(...,TRUE)`
--     devuelve NULL → la comparación es NULL → ninguna fila pasa (deny).

DO $$
BEGIN
  -- Rama canónica: usuarios.organization_id (init.sql líneas 130/531)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usuarios'
      AND column_name = 'organization_id'
  ) THEN
    DROP POLICY IF EXISTS tenant_isolation_consentimientos ON consentimientos;
    CREATE POLICY tenant_isolation_consentimientos ON consentimientos
      FOR ALL
      USING (
        usuario_id IN (
          SELECT id FROM usuarios
          WHERE organization_id = current_setting('app.current_org_id', TRUE)::UUID
        )
      )
      WITH CHECK (
        usuario_id IN (
          SELECT id FROM usuarios
          WHERE organization_id = current_setting('app.current_org_id', TRUE)::UUID
        )
      );
    COMMENT ON POLICY tenant_isolation_consentimientos ON consentimientos IS
      'Consentimientos (LPDP): acceso solo a usuarios de la org activa vía subquery a usuarios.organization_id';

  -- Rama legacy: usuarios.organizacion_id (usada por 2026-enable-rls.sql)
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usuarios'
      AND column_name = 'organizacion_id'
  ) THEN
    DROP POLICY IF EXISTS tenant_isolation_consentimientos ON consentimientos;
    CREATE POLICY tenant_isolation_consentimientos ON consentimientos
      FOR ALL
      USING (
        usuario_id IN (
          SELECT id FROM usuarios
          WHERE organizacion_id = current_setting('app.current_org_id', TRUE)::UUID
        )
      )
      WITH CHECK (
        usuario_id IN (
          SELECT id FROM usuarios
          WHERE organizacion_id = current_setting('app.current_org_id', TRUE)::UUID
        )
      );
    COMMENT ON POLICY tenant_isolation_consentimientos ON consentimientos IS
      'Consentimientos (LPDP): acceso solo a usuarios de la org activa vía subquery a usuarios.organizacion_id (legacy)';

  ELSE
    RAISE EXCEPTION 'consentimientos-rls: usuarios no tiene columna organization_id ni organizacion_id — revisar esquema';
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- BLOQUE 2: Policy RLS para `refresh_tokens`
-- ───────────────────────────────────────────────────────────────────────────────
-- La tabla `refresh_tokens` guarda sesiones: id, token, usuario_id, expires_at,
-- revocado, created_at. Es SENSIBLE (permite renovar sesión JWT) y NO tiene
-- `organization_id` (solo `usuario_id`), por lo que se aplica el MISMO patrón
-- de subquery a `usuarios` que en consentimientos.
--
-- Semántica de la policy:
--   - SELECT: la app lee el token para rotarlo/validarlo (TokenRepository).
--   - INSERT: al emitir un refresh token tras login, el usuario DEBE pertenecer
--     a la org activa.
--   - UPDATE: al revocar/rotar (logout, revocación por seguridad).
--   - DELETE: al cerrar sesión (logout).
--   - fail-closed: sin app.current_org_id → deny.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usuarios'
      AND column_name = 'organization_id'
  ) THEN
    DROP POLICY IF EXISTS tenant_isolation_refresh_tokens ON refresh_tokens;
    CREATE POLICY tenant_isolation_refresh_tokens ON refresh_tokens
      FOR ALL
      USING (
        usuario_id IN (
          SELECT id FROM usuarios
          WHERE organization_id = current_setting('app.current_org_id', TRUE)::UUID
        )
      )
      WITH CHECK (
        usuario_id IN (
          SELECT id FROM usuarios
          WHERE organization_id = current_setting('app.current_org_id', TRUE)::UUID
        )
      );
    COMMENT ON POLICY tenant_isolation_refresh_tokens ON refresh_tokens IS
      'Refresh tokens (sesiones): acceso solo a tokens de usuarios de la org activa vía subquery a usuarios.organization_id';

  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usuarios'
      AND column_name = 'organizacion_id'
  ) THEN
    DROP POLICY IF EXISTS tenant_isolation_refresh_tokens ON refresh_tokens;
    CREATE POLICY tenant_isolation_refresh_tokens ON refresh_tokens
      FOR ALL
      USING (
        usuario_id IN (
          SELECT id FROM usuarios
          WHERE organizacion_id = current_setting('app.current_org_id', TRUE)::UUID
        )
      )
      WITH CHECK (
        usuario_id IN (
          SELECT id FROM usuarios
          WHERE organizacion_id = current_setting('app.current_org_id', TRUE)::UUID
        )
      );
    COMMENT ON POLICY tenant_isolation_refresh_tokens ON refresh_tokens IS
      'Refresh tokens (sesiones): acceso solo a tokens de usuarios de la org activa vía subquery a usuarios.organizacion_id (legacy)';

  ELSE
    RAISE EXCEPTION 'refresh_tokens-rls: usuarios no tiene columna organization_id ni organizacion_id — revisar esquema';
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- BLOQUE 3: Policy RLS para `evidencia_accesos` (DEFENSIVA)
-- ───────────────────────────────────────────────────────────────────────────────
-- `evidencia_accesos` registra accesos a la bóveda de evidencia digital y NO
-- está versionada en init.sql (solo aparece en tools/seed/reset-production.mjs).
-- Se asume el patrón tenant estándar: columna `organization_id` (como
-- `evidencia_digital`). La policy se crea ÚNICAMENTE si la tabla y la columna
-- existen; de lo contrario se emite NOTICE sin fallar (fail-safe).
--
-- Semántica de la policy: aislamiento multi-tenant clásico del proyecto,
-- idéntico a `p_evidencia_digital_all` (init.sql) y `tenant_isolation_*`:
--   USING (organization_id = current_setting('app.current_org_id', TRUE)::UUID)
--   WITH CHECK (misma condición) — evita INSERT cross-tenant.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'evidencia_accesos'
  ) THEN
    RAISE NOTICE 'evidencia_accesos no existe: policy NO creada (ejecutar tras crear la tabla)';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'evidencia_accesos'
      AND column_name = 'organization_id'
  ) THEN
    DROP POLICY IF EXISTS tenant_isolation_evidencia_accesos ON evidencia_accesos;
    CREATE POLICY tenant_isolation_evidencia_accesos ON evidencia_accesos
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', TRUE)::UUID)
      WITH CHECK (organization_id = current_setting('app.current_org_id', TRUE)::UUID);
    COMMENT ON POLICY tenant_isolation_evidencia_accesos ON evidencia_accesos IS
      'Accesos a evidencia digital: visibles solo para la propia organización';

  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'evidencia_accesos'
      AND column_name = 'organizacion_id'
  ) THEN
    DROP POLICY IF EXISTS tenant_isolation_evidencia_accesos ON evidencia_accesos;
    CREATE POLICY tenant_isolation_evidencia_accesos ON evidencia_accesos
      FOR ALL
      USING (organizacion_id = current_setting('app.current_org_id', TRUE)::UUID)
      WITH CHECK (organizacion_id = current_setting('app.current_org_id', TRUE)::UUID);
    COMMENT ON POLICY tenant_isolation_evidencia_accesos ON evidencia_accesos IS
      'Accesos a evidencia digital: visibles solo para la propia organización (columna organizacion_id)';

  ELSE
    RAISE NOTICE 'evidencia_accesos existe pero sin columna organization_id/organizacion_id: policy NO creada — revisar esquema';
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- BLOQUE 4: Verificación (solo lectura, no modifica la transacción)
-- ───────────────────────────────────────────────────────────────────────────────
-- Debe devolver al menos 1 fila por tabla con las policies creadas y el estado
-- de RLS (rls_habilitada = TRUE, rls_forzada = TRUE).
SELECT
  c.relname                              AS tabla,
  c.relrowsecurity                       AS rls_habilitada,
  c.relforcerowsecurity                  AS rls_forzada,
  COALESCE(p.policy_count, 0)            AS num_policies,
  pg_get_userbyid(c.relowner)            AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN (
  SELECT tablename, COUNT(*) AS policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('consentimientos', 'refresh_tokens', 'evidencia_accesos')
  GROUP BY tablename
) p ON p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN ('consentimientos', 'refresh_tokens', 'evidencia_accesos')
ORDER BY c.relname;

-- Detalle de policies creadas
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('consentimientos', 'refresh_tokens', 'evidencia_accesos')
ORDER BY tablename, policyname;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TEST FUNCIONAL SUGERIDO (ejecutar manualmente, NO incluido en esta transacción)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Conectar con rol de app (legalpro_app / legalpro_node) o un rol NOBYPASSRLS:
--
--   SET app.current_org_id = '00000000-0000-0000-0000-000000000001'; -- Estudio demo
--   SET app.current_user_id = '00000000-0000-0000-0000-000000000011';
--   SELECT COUNT(*) AS consentimientos_visibles FROM consentimientos;  -- debe ser > 0
--   SELECT COUNT(*) AS tokens_visibles FROM refresh_tokens;            -- debe ser > 0
--
--   SET app.current_org_id = '00000000-0000-0000-0000-0000000000ff';   -- otro tenant
--   SELECT COUNT(*) AS cross_tenant FROM consentimientos;              -- DEBE ser 0
--   SELECT COUNT(*) AS cross_tenant FROM refresh_tokens;               -- DEBE ser 0
--
-- Si cross_tenant > 0 → FALLO CRÍTICO de aislamiento: investigar y rollback.
-- ═══════════════════════════════════════════════════════════════════════════════
