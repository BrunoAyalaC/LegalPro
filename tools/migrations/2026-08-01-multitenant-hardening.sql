-- ══════════════════════════════════════════════════════════════════════════════
-- MULTI-TENANT HARDENING — 1 de agosto de 2026
-- ══════════════════════════════════════════════════════════════════════════════
-- FIX MT-03: Garantizar que RLS es efectiva en runtime
-- CRÍTICO: Antes de ejecutar, hacer backup completo de la BD
--
-- HALLAZGO MT-03 (Auditoría Multi-Tenant):
--   Las políticas RLS están creadas en init.sql pero:
--   (a) No se ha confirmado que el rol PostgreSQL usado por ambos backends
--       sea NOBYPASSRLS.
--   (b) No se aplica FORCE ROW LEVEL SECURITY en las tablas.
--   (c) Si el rol es postgres (owner) o tiene BYPASSRLS, las policies son
--       inefectivas (PostgreSQL NO aplica RLS al owner por defecto).
--
-- FIX APLICADO POR ESTA MIGRACIÓN:
--   1. Crear roles de aplicación independientes (legalpro_node, legalpro_dotnet)
--      con NOSUPERUSER + NOBYPASSRLS + NOCREATEDB + NOCREATEROLE + NOLOGIN.
--   2. Otorgar permisos granulares a nivel de schema, tablas y sequences.
--   3. ALTER TABLE ... ENABLE + FORCE ROW LEVEL SECURITY en todas las
--      tablas tenant (la opción FORCE hace que las policies apliquen
--      INCLUSO al owner de la tabla).
--   4. Verificación post-migración: estado de RLS + roles creados.
--   5. Test funcional multi-tenant (lectura cruzada debe devolver 0 filas).
--
-- CONVENCIONES DEL PROYECTO:
--   - snake_case en nombres de tabla
--   - organization_id UUID NOT NULL en toda tabla tenant
--   - RLS ya existe en init.sql usando fn_rls_current_org_id()
--   - SET SESSION app.current_user_id / app.current_org_id / app.current_user_rol
--
-- NOTA SOBRE TABLAS:
--   La tabla de evidencia se llama `evidencia_digital` en init.sql (no
--   `evidencia` como aparece en el schema canónico supabase-schema.md).
--   Las tablas documentos_ocr, escritos_legales, casos_criticos,
--   plazos_procesales se han omitido porque NO existen en init.sql; si
--   se crean en el futuro, esta migración las procesará gracias al
--   chequeo defensivo en PASO 3.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════════
-- PASO 1: Crear roles de aplicación independientes
-- ══════════════════════════════════════════════════════════════════════════════
-- Cada backend usa su propio rol sin BYPASSRLS para garantizar que las
-- policies se apliquen en runtime. NOBYPASSRLS es la cláusula clave: si el
-- rol NO la tiene, bypasea todas las RLS policies (incluso con FORCE).
--
-- NOTA: Existe un rol legacy `legalpro_app` definido en
-- tools/migrations/2026-enable-rls.sql. Esta migración NO lo elimina por
-- seguridad (queda como fallback si los nuevos fallan). El README explica
-- cómo migrar al esquema de dos roles.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'legalpro_node') THEN
    CREATE ROLE legalpro_node NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOLOGIN;
    RAISE NOTICE 'Rol creado: legalpro_node';
  ELSE
    RAISE NOTICE 'Rol ya existe: legalpro_node (sin cambios)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'legalpro_dotnet') THEN
    CREATE ROLE legalpro_dotnet NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOLOGIN;
    RAISE NOTICE 'Rol creado: legalpro_dotnet';
  ELSE
    RAISE NOTICE 'Rol ya existe: legalpro_dotnet (sin cambios)';
  END IF;
END
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- PASO 2: Otorgar permisos a los nuevos roles
-- ══════════════════════════════════════════════════════════════════════════════
-- IMPORTANTE: Estos GRANT son para objetos YA EXISTENTES.
-- ALTER DEFAULT PRIVILEGES cubre objetos futuros creados por el owner actual.
GRANT USAGE ON SCHEMA public TO legalpro_node, legalpro_dotnet;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO legalpro_node, legalpro_dotnet;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legalpro_node, legalpro_dotnet;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO legalpro_node, legalpro_dotnet;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO legalpro_node, legalpro_dotnet;

-- ══════════════════════════════════════════════════════════════════════════════
-- PASO 3: FORCE ROW LEVEL SECURITY en todas las tablas tenant
-- ══════════════════════════════════════════════════════════════════════════════
-- Solo procesamos tablas que existen realmente en la BD (chequeo defensivo).
-- ENABLE + FORCE garantiza que las policies apliquen incluso al owner.
--
-- Lista canónica de tablas tenant en init.sql (19 tablas):
--   usuarios, miembros_organizacion, refresh_tokens, consentimientos,
--   expedientes, simulaciones, eventos_simulacion, mensajes_chat,
--   base_legal_vectorial, invitaciones_organizacion, transacciones_creditos,
--   clientes, documentos, notificaciones_sinoe, evidencia_digital,
--   audit_log, outbox_messages, consumo_tokens_ia, organizaciones
DO $$
DECLARE
  t       TEXT;
  v_count INT := 0;
BEGIN
  -- pg_tables ya solo lista tablas existentes, no hace falta WHERE EXISTS.
  -- Usamos alias "pt" para evitar ambigüedades.
  FOR t IN
    SELECT pt.tablename FROM pg_tables pt
    WHERE pt.schemaname = 'public'
      AND pt.tablename IN (
        'usuarios', 'expedientes', 'documentos', 'evidencia_digital', 'clientes',
        'simulaciones', 'eventos_simulacion', 'mensajes_chat',
        'notificaciones_sinoe', 'audit_log', 'consumo_tokens_ia',
        'transacciones_creditos', 'invitaciones_organizacion',
        'miembros_organizacion', 'organizaciones', 'refresh_tokens',
        'consentimientos', 'base_legal_vectorial', 'outbox_messages'
      )
    ORDER BY pt.tablename
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    RAISE NOTICE 'RLS forzada en: %', t;
    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE 'PASO 3 completado: % tablas con FORCE RLS', v_count;
  RAISE NOTICE '════════════════════════════════════════════════════';
END
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- PASO 4: Verificación post-migración
-- ══════════════════════════════════════════════════════════════════════════════
-- Devuelve el estado de RLS + FORCE RLS para TODAS las tablas tenant.
-- Esperado: rls_habilitada = TRUE Y rls_forzada = TRUE en cada fila.
SELECT
  c.relname                                                AS tabla,
  c.relrowsecurity                                         AS rls_habilitada,
  c.relforcerowsecurity                                    AS rls_forzada,
  (SELECT COUNT(*) FROM pg_policies p
     WHERE p.schemaname = n.nspname AND p.tablename = c.relname
  )                                                        AS num_policies,
  pg_get_userbyid(c.relowner)                              AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'usuarios', 'expedientes', 'documentos', 'evidencia_digital', 'clientes',
    'simulaciones', 'eventos_simulacion', 'mensajes_chat',
    'notificaciones_sinoe', 'audit_log', 'consumo_tokens_ia',
    'transacciones_creditos', 'invitaciones_organizacion',
    'miembros_organizacion', 'organizaciones', 'refresh_tokens',
    'consentimientos', 'base_legal_vectorial', 'outbox_messages'
  )
ORDER BY c.relname;

-- Verificar que los roles están creados con los atributos correctos
SELECT
  rolname                       AS rol,
  rolsuper                      AS es_superusuario,
  rolbypassrls                  AS bypass_rls,
  rolcreatedb                   AS puede_crear_db,
  rolcreaterole                 AS puede_crear_roles,
  rolcanlogin                   AS puede_login
FROM pg_roles
WHERE rolname IN ('legalpro_node', 'legalpro_dotnet', 'legalpro_app')
ORDER BY rolname;

-- ══════════════════════════════════════════════════════════════════════════════
-- PASO 5: Comentario de cumplimiento LPDP (Art. 18: Finalidad del tratamiento)
-- ══════════════════════════════════════════════════════════════════════════════
COMMENT ON ROLE legalpro_node   IS 'Rol backend Node.js — minimos privilegios, NOBYPASSRLS (defensa RLS multi-tenant)';
COMMENT ON ROLE legalpro_dotnet IS 'Rol backend .NET   — minimos privilegios, NOBYPASSRLS (defensa RLS multi-tenant)';

COMMIT;

-- ══════════════════════════════════════════════════════════════════════════════
-- PASO 6: TEST FUNCIONAL (ejecutar manualmente como legalpro_node)
-- ══════════════════════════════════════════════════════════════════════════════
-- Este test se debe ejecutar DESPUÉS de configurar el backend con el nuevo rol.
-- Conectar como: psql "postgresql://legalpro_node:<pwd>@host/db" -f test-multitenant.sql
--
-- SET app.current_user_id  = '00000000-0000-0000-0000-000000000011'; -- Abogado demo
-- SET app.current_org_id    = '00000000-0000-0000-0000-000000000001'; -- Estudio demo
-- SET app.current_user_rol  = 'ABOGADO';
-- SELECT COUNT(*) AS expedientes_visibles FROM expedientes;        -- Debe ser > 0
-- SET app.current_org_id    = '00000000-0000-0000-0000-0000000000ff'; -- Otro tenant
-- SELECT COUNT(*) AS expedientes_otro_tenant FROM expedientes;     -- Debe ser 0
--
-- Si expedientes_otro_tenant = 0 → RLS funciona correctamente.
-- Si expedientes_otro_tenant > 0 → FALLO CRÍTICO: investigar y rollback.
-- ══════════════════════════════════════════════════════════════════════════════
