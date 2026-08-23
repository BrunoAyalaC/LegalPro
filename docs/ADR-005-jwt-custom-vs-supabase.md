# ADR-005 — JWT custom con pg Pool vs Supabase JS en server

**Fecha:** 2026-08-21  
**Estado:** Aceptado  
**Autores:** BackendNode, ArquitectoChief  
**Contexto:** Auditoría P0/P1 Backend Node — hallazgo "Supabase vs JWT doc"

## Contexto

El proyecto LegalPro/LexIA arrancó con Supabase (Auth + Storage) como backend. En la evolución hacia Railway + PostgreSQL nativo, el equipo migró el server Node a autenticación propia:

- **DB:** `pg` Pool (PostgreSQL nativo, Railway), sin dependencia de `auth.uid()` de Supabase.
- **Auth:** JWT custom firmado con `JWT_SECRET` (HS256), `issuer=LegalProAPI`, `audience=LegalProClients`, validado en `middleware/authMiddleware.js`.
- **Multi-tenant:** claim `organization_id` en JWT + `X-Organization-Id` header, policies RLS con `fn_rls_current_org_id()` y `tenantQuery`/`tenantContext` (AsyncLocalStorage).
- **Storage:** Evidencia digital actualmente en disco temporal (`os.tmpdir()`) + futura migración a S3 compatible; no usa `SUPABASE_STORAGE_BUCKET_EVIDENCIA` en código productivo.

Sin embargo, `legalpro-app/package.json` aún declaraba `@supabase/supabase-js@^2.50.0` y `server/.env.example` exponía `SUPABASE_URL/ANON_KEY/SERVICE_KEY`, lo que generaba ambigüedad:

- ¿El server usa Supabase Auth o JWT custom?
- ¿El shimming de `setup.js` (`SUPABASE_URL` fake) oculta un acoplamiento real?
- El verificador OWASP podría asumir que secretos Supabase son críticos en prod, cuando el server ya no los consume.

## Decisión

**Opción A (adoptada):** Mantener `JWT custom + pg Pool` como única fuente de verdad para el server Node, y eliminar `@supabase/supabase-js` de `legalpro-app/package.json:dependencies`. 

- El server **NO** importa `@supabase/supabase-js` en ningún módulo productivo (`server/**/*.js` no tiene import de supabase). La única referencia es `server/init.sql` que documenta explícitamente `SIN dependencias de Supabase Auth`.
- El frontend (`src/api/client.ts`) ya declara `sin Supabase` y usa `nodeClient`/`dotnetClient` contra `/api/*`; no necesita el SDK de Supabase.
- Los tests (`server/__tests__/setup.js`) mantienen `SUPABASE_URL` fake solo por compatibilidad de shim histórico, pero no ejercen código Supabase real.
- `.env.example` conservará las variables `SUPABASE_*` comentadas como legado por una versión más, con nota `DEPRECADO: server usa JWT custom — estas vars no son requeridas para `npm run server``.

**Alternativa B (rechazada):** Mantener `@supabase/supabase-js` y re-introducir `supabaseAuthMiddleware` paralelo a JWT. Rechazada porque duplica superficie de auth, complica RLS, y rompe el principio de fail-closed multi-tenant (dos issuers distintos).

## Consecuencias

- **Seguridad:** Se cierra la duda de `JWT_SECRET` vs `SUPABASE_SERVICE_KEY` como secreto crítico. El arranque en prod (`index.js` validación `REQUIRED_SECRETS`) solo exige `JWT_SECRET` + `DATABASE_URL`; `SUPABASE_*` no bloquea.
- **Performance:** Menos bytes en bundle server, menos cold-start (no se carga el SDK).
- **Compatibilidad:** Si en el futuro se reactiva Supabase Storage, se reintroducirá el SDK bajo feature flag `FEATURE_SUPABASE_STORAGE` con ADR específico, sin tocar el flujo de auth.
- **Verificación:** `grep -r supabase legalpro-app/server --include="*.js"` debe devolver 0 hits (o solo comentarios). `npm ls @supabase/supabase-js` en `legalpro-app` debe reportar no instalado.

## Validación

- `node tools/verifiers/verifier-owasp.mjs` — sin falsos positivos por `SUPABASE_SERVICE_KEY` hardcodeado.
- `node tools/verifiers/verifier-multi-tenant.mjs` — `organization_id` en JWT verificado, sin `auth.uid()`.
- Tests: `npm run test:server` — 0 imports de supabase en server.

## Referencias

- `legalpro-app/server/db.js` — Pool + `tenantContext`/`tenantQuery` + `set_config('app.current_org_id', ...)`
- `legalpro-app/server/middleware/authMiddleware.js` — `jwt.verify` con `issuer/audience`
- `legalpro-app/server/init.sql` — `SIN dependencias de Supabase Auth`
- `catalogs/supabase-schema.md` — documentación RLS (legado, pero sin dependencia runtime)
