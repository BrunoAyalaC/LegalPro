-- ═══════════════════════════════════════════════════════════════════════
-- 2026-08-21-fix-p0-rls-force.sql
-- FIX P0-01: FORCE RLS en 13 tablas tenant de init.sql:883-1130
-- ═══════════════════════════════════════════════════════════════════════
-- HALLAZGO AUDITORÍA DB P0:
--   init.sql:883-1130 aplica `ENABLE ROW LEVEL SECURITY` + policies
--   pero NO aplica `FORCE ROW LEVEL SECURITY`. En PostgreSQL el owner
--   (postgres / railway) BYPASA RLS por defecto aunque ENABLE esté activo.
--   Sin FORCE, un backend conectado como owner puede leer cross-tenant.
--   OWASP A01:2021 — Broken Access Control.
--
-- TABLAS AFECTADAS (13):
--   expedientes, documentos, usuarios, clientes, simulaciones,
--   mensajes_chat, notificaciones_sinoe, evidencia_digital, audit_log,
--   consumo_tokens_ia, eventos_simulacion, invitaciones_organizacion,
--   transacciones_creditos
--
-- FIX:
--   ALTER TABLE ... FORCE ROW LEVEL SECURITY (idempotente, fuera de TX
--   si el rol tiene permisos). FORCE garantiza que policies apliquen incluso
--   al table owner. Equivalente a patch 2026-08-01-multitenant-hardening.sql
--   pero enfocado en las 13 tablas del bloque RLS documentado en init.sql.
--
-- BASE LEGAL:
--   - PostgreSQL 15 docs: FORCE RLS
--   - LPDP Art. 8 principio responsabilidad — aislamiento multi-tenant DB-level
--
-- CONVENCIONES:
--   - Multi-tenant via organization_id + fn_rls_current_org_id()
--   - Verificación final: SELECT relname, relforcerowsecurity FROM pg_class
--
-- ORDEN DE EJECUCIÓN:
--   1. Este fix P0 debe ejecutarse ANTES de exponer el servicio a tenants nuevos.
--   2. Requiere privilegio de superuser o owner de las tablas.
--   3. Idempotente: puede re-ejecutarse sin efectos colaterales.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- PASO 1: FORCE RLS en las 13 tablas (idempotente FOR LOOP defensivo)
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
  tbls TEXT[] := ARRAY[
    'usuarios',
    'expedientes',
    'documentos',
    'clientes',
    'simulaciones',
    'mensajes_chat',
    'notificaciones_sinoe',
    'evidencia_digital',
    'audit_log',
    'consumo_tokens_ia',
    'eventos_simulacion',
    'invitaciones_organizacion',
    'transacciones_creditos'
  ];
  v_count INT := 0;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      -- ENABLE ya existe desde init.sql; FORCE es el fix P0 faltante
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
      RAISE NOTICE 'FORCE RLS aplicado en: %', t;
      v_count := v_count + 1;
    ELSE
      RAISE WARNING 'Tabla no existe (omitida): %', t;
    END IF;
  END LOOP;
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'FORCE RLS completado: % tablas', v_count;
  RAISE NOTICE '═══════════════════════════════════════';
END $$;

-- ─────────────────────────────────────────────────────────────────
-- PASO 2: Verificación post-migración (lectura obligatoria para auditoría)
-- ─────────────────────────────────────────────────────────────────
-- 2a. Estado RLS + FORCE por tabla (relforcerowsecurity = TRUE esperado)
SELECT
  c.relname                              AS tabla,
  c.relrowsecurity                       AS rls_habilitada,
  c.relforcerowsecurity                  AS rls_forzada,
  COALESCE(p.policy_count, 0)           AS num_policies,
  pg_get_userbyid(c.relowner)           AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN (
  SELECT tablename, COUNT(*) AS policy_count
  FROM pg_policies
  WHERE schemaname='public'
  GROUP BY tablename
) p ON p.tablename = c.relname
WHERE n.nspname='public'
  AND c.relkind='r'
  AND c.relname IN (
    'usuarios','expedientes','documentos','clientes','simulaciones',
    'mensajes_chat','notificaciones_sinoe','evidencia_digital','audit_log',
    'consumo_tokens_ia','eventos_simulacion','invitaciones_organizacion',
    'transacciones_creditos'
  )
ORDER BY c.relname;

-- 2b. Verificación específica solicitada en hallazgo (formato exacto)
--     Debe devolver 13 filas con relforcerowsecurity = true
SELECT relname, relforcerowsecurity FROM pg_class
WHERE relname IN (
  'expedientes','documentos','usuarios','clientes','simulaciones',
  'mensajes_chat','notificaciones_sinoe','evidencia_digital','audit_log',
  'consumo_tokens_ia','eventos_simulacion','invitaciones_organizacion','transacciones_creditos'
)
AND relnamespace = 'public'::regnamespace
ORDER BY relname;

-- 2c. Detalle de policies por tabla (debe existir al menos 1 por tabla; audit_log = 2)
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN (
    'usuarios','expedientes','documentos','clientes','simulaciones',
    'mensajes_chat','notificaciones_sinoe','evidencia_digital','audit_log',
    'consumo_tokens_ia','eventos_simulacion','invitaciones_organizacion','transacciones_creditos'
  )
ORDER BY tablename, policyname;

-- 2d. Validar que rol de aplicación NO tenga BYPASSRLS (rolbypassrls = false)
--     Si bypassrls = true, FORCE igualmente lo contiene pero es defensa débil.
SELECT
  rolname            AS rol,
  rolsuper           AS es_superusuario,
  rolbypassrls       AS bypass_rls,
  rolcanlogin        AS puede_login
FROM pg_roles
WHERE rolname IN ('legalpro_app','legalpro_node','legalpro_dotnet','postgres')
ORDER BY rolname;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- TEST FUNCIONAL MANUAL (ejecutar con rol NOBYPASSRLS, NO como postgres)
-- ═══════════════════════════════════════════════════════════════════════
-- SET app.current_org_id  = '00000000-0000-0000-0000-000000000001';
-- SET app.current_user_id = '00000000-0000-0000-0000-000000000011';
-- SELECT COUNT(*) AS visibles_tenant1 FROM expedientes; -- >0 esperado
-- SET app.current_org_id  = '00000000-0000-0000-0000-0000000000ff';
-- SELECT COUNT(*) AS cross_tenant FROM expedientes;     -- DEBE ser 0, si >0 => FAIL P0
-- RESET app.current_org_id;
-- ═══════════════════════════════════════════════════════════════════════
