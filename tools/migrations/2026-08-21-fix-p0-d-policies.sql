-- ═══════════════════════════════════════════════════════════════════════
-- 2026-08-21-fix-p0-d-policies.sql
-- FIX P0-D: Policies RLS faltantes en 2 tablas con FORCE RLS (deny-all)
-- ═══════════════════════════════════════════════════════════════════════
-- HALLAZGO AUDITORÍA DB P0:
--   2026-08-01-multitenant-hardening.sql:96-126 aplicó ENABLE + FORCE ROW
--   LEVEL SECURITY a 19 tablas, incluyendo outbox_messages y
--   base_legal_vectorial (línea 112), pero NINGUNA migración creó policies
--   para esas 2 tablas. En PostgreSQL, tabla con RLS + FORCE y 0 policies =
--   DENY-ALL para todo rol no-owner sin BYPASSRLS:
--     - outbox_messages: .NET (ProcessOutboxMessagesJob) no puede leer ni
--       escribir → outbox pattern roto en producción.
--     - base_legal_vectorial: búsqueda semántica RAG devuelve 0 filas.
--   OWASP A01:2021 — Broken Access Control (por bloqueo indebido).
--
-- FIX:
--   1. outbox_messages: tabla de SISTEMA cross-tenant (sin organization_id,
--      eventos de integración cross-service) → policy FOR ALL USING(true)
--      TO roles de aplicación. Se mantiene FORCE RLS (defensa en profundidad).
--   2. base_legal_vectorial: corpus normativo GLOBAL compartido (decisión
--      documentada en 2026-08-21-vector-fix.sql:156 — sin organization_id)
--      → SELECT público para roles de app; INSERT/UPDATE/DELETE solo el rol
--      owner de la tabla (seeders/admin). FORCE RLS se mantiene.
--   3. Verificación embebida vía pg_policies.
--
-- NOTA .NET: dual-write pgcrypto pendiente para LegalProBackend_Net
-- (siguiente sprint). Esta migración NO depende de eso.
--
-- BASE LEGAL / CONVENCIONES:
--   - PostgreSQL 15 docs: CREATE POLICY, FORCE ROW LEVEL SECURITY
--   - Regla repo #7: policy por operación; aquí FOR ALL cubre I/U/D/S
--   - Idempotente: DROP POLICY IF EXISTS antes de cada CREATE
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- PASO 0: Re-afirmar ENABLE + FORCE RLS (idempotente, mantiene defensa)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.outbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbox_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.base_legal_vectorial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_legal_vectorial FORCE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────
-- PASO 1: outbox_messages — tabla de sistema cross-tenant
-- ─────────────────────────────────────────────────────────────────
-- Policy FOR ALL para los roles de aplicación. Si los roles nombrados no
-- existen aún (entornos bootstrap), cae a PUBLIC para no dejar deny-all.
DROP POLICY IF EXISTS outbox_system_all ON public.outbox_messages;

DO $$
DECLARE
  v_roles_exist BOOLEAN;
BEGIN
  SELECT COUNT(*) = 2 INTO v_roles_exist
  FROM pg_roles
  WHERE rolname IN ('legalpro_node', 'legalpro_dotnet');

  IF v_roles_exist THEN
    EXECUTE $sql$
      CREATE POLICY outbox_system_all ON public.outbox_messages
        FOR ALL
        USING (true)
        WITH CHECK (true)
        TO legalpro_node, legalpro_dotnet
    $sql$;
    RAISE NOTICE 'outbox_messages: policy outbox_system_all creada TO legalpro_node, legalpro_dotnet';
  ELSE
    EXECUTE $sql$
      CREATE POLICY outbox_system_all ON public.outbox_messages
        FOR ALL
        USING (true)
        WITH CHECK (true)
        TO PUBLIC
    $sql$;
    RAISE WARNING 'outbox_messages: roles legalpro_node/legalpro_dotnet no existen — policy creada TO PUBLIC. Restringir cuando los roles existan.';
  END IF;
END $$;

COMMENT ON POLICY outbox_system_all ON public.outbox_messages IS
  'FIX P0-D: outbox es tabla de sistema cross-tenant (sin organization_id); acceso pleno a roles de app. FORCE RLS se mantiene como defensa. No exponer a tenants vía API.';

-- ─────────────────────────────────────────────────────────────────
-- PASO 2: base_legal_vectorial — corpus global público (solo lectura)
-- ─────────────────────────────────────────────────────────────────
-- 2a. SELECT libre para roles de aplicación (búsqueda semántica RAG).
DROP POLICY IF EXISTS base_legal_select_public ON public.base_legal_vectorial;
DO $$
DECLARE
  v_roles_exist BOOLEAN;
BEGIN
  SELECT COUNT(*) = 2 INTO v_roles_exist
  FROM pg_roles
  WHERE rolname IN ('legalpro_node', 'legalpro_dotnet');

  IF v_roles_exist THEN
    EXECUTE $sql$
      CREATE POLICY base_legal_select_public ON public.base_legal_vectorial
        FOR SELECT
        USING (true)
        TO legalpro_node, legalpro_dotnet
    $sql$;
    RAISE NOTICE 'base_legal_vectorial: policy base_legal_select_public creada TO legalpro_node, legalpro_dotnet';
  ELSE
    EXECUTE $sql$
      CREATE POLICY base_legal_select_public ON public.base_legal_vectorial
        FOR SELECT
        USING (true)
        TO PUBLIC
    $sql$;
    RAISE WARNING 'base_legal_vectorial: policy SELECT creada TO PUBLIC (roles de app no existen aún).';
  END IF;
END $$;

-- 2b. INSERT/UPDATE/DELETE solo el OWNER de la tabla (seeders/admin).
--     Con FORCE RLS el owner TAMBIÉN está sujeto a policies, por lo que se
--     le crea una policy explícita de escritura (resuelta dinámicamente).
DROP POLICY IF EXISTS base_legal_write_owner ON public.base_legal_vectorial;
DO $$
DECLARE
  v_owner TEXT;
BEGIN
  SELECT pg_get_userbyid(c.relowner) INTO v_owner
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'base_legal_vectorial';

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'base_legal_vectorial no existe — abortando';
  END IF;

  EXECUTE format(
    'CREATE POLICY base_legal_write_owner ON public.base_legal_vectorial
       FOR ALL
       USING (true)
       WITH CHECK (true)
       TO %I',
    v_owner
  );
  RAISE NOTICE 'base_legal_vectorial: policy base_legal_write_owner creada TO % (owner)', v_owner;
END $$;

COMMENT ON POLICY base_legal_select_public ON public.base_legal_vectorial IS
  'FIX P0-D: corpus normativo peruano GLOBAL compartido entre tenants (sin organization_id, decisión en vector-fix.sql:156). Lectura libre para app; escritura solo owner.';
COMMENT ON POLICY base_legal_write_owner ON public.base_legal_vectorial IS
  'FIX P0-D: escritura (INSERT/UPDATE/DELETE) restringida al rol owner de la tabla (seeders/admin). FORCE RLS obliga a que esta policy aplique también al owner.';

-- ─────────────────────────────────────────────────────────────────
-- PASO 3: Verificación embebida (lectura obligatoria post-migración)
-- ─────────────────────────────────────────────────────────────────
-- 3a. Policies creadas — esperado: outbox_system_all, base_legal_select_public,
--     base_legal_write_owner (3 filas mínimo).
SELECT policyname, tablename, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('outbox_messages', 'base_legal_vectorial')
ORDER BY tablename, policyname;

-- 3b. FORCE RLS sigue activo en ambas (relforcerowsecurity = true esperado)
SELECT c.relname              AS tabla,
       c.relrowsecurity       AS rls_habilitada,
       c.relforcerowsecurity  AS rls_forzada,
       (SELECT COUNT(*) FROM pg_policies p
          WHERE p.schemaname='public' AND p.tablename=c.relname) AS num_policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('outbox_messages', 'base_legal_vectorial');

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- TEST FUNCIONAL MANUAL (con rol legalpro_node o legalpro_dotnet, NO owner):
-- ═══════════════════════════════════════════════════════════════════════
-- SELECT COUNT(*) FROM outbox_messages;                    -- >0 o 0 sin error (antes: permission denied)
-- INSERT INTO outbox_messages (type, content) VALUES ('test','{}');  -- OK
-- UPDATE outbox_messages SET processed_on_utc = NOW() WHERE type='test'; -- OK
-- DELETE FROM outbox_messages WHERE type='test';           -- OK
-- SELECT COUNT(*) FROM base_legal_vectorial;               -- OK (antes: permission denied)
-- INSERT INTO base_legal_vectorial (...) VALUES (...);     -- DENEGADO salvo owner (esperado)
-- ═══════════════════════════════════════════════════════════════════════
