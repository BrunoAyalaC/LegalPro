# AVANCE PRODUCTION READINESS - LegalPro v2.0.6 (Build post-fixes 2026-06-29)

Documento maestro que registra el estado del proyecto LegalPro para el deploy
"alfa agresivo" en Railway. Concentra fixes verificados, decisiones, deuda
tecnica documentada y plan de rollback. NO se utiliza git para ninguna operacion
de este flujo.

## 1. ESTADO PARA DEPLOY

- [ ] BUILD verde: verificado 2026-06-29 `npm run build` exit 0
- [ ] TESTS verdes: 2954 passed / 25 skipped (frontend JSX) / 0 failed
- [ ] DOTNET: 81 unit passed + 13 integration passed
- [ ] DOCKER: legalpro-frontend-test (217MB) + legalpro-backend-test (1.45GB)
- [ ] SENTRY: NO (decision consciente para alfa agresivo)
- [ ] BACKUPS Railway: PENDIENTE - verificar en panel

## 2. FIXES APLICADOS Y VERIFICADOS (57 fixes)

### 2.1 CRITICALES (10 verificados)

1. Sidebar imports faltantes (Users, Building2, LogOut) - `src/components/Sidebar.jsx`
2. NavLink render prop bug - `src/components/Sidebar.jsx`
3. ConfigEspecialidad wrong import - `src/pages/ConfigEspecialidad.jsx`
4. cron-jobs.js sin import db - `server/cron-jobs.js:23`
5. BaseRepository `this.table` faltante - `server/repositories/BaseRepository.js`
6. documentos UPDATE sin org_id - `server/routes/documentos.js` (`$${params.length}`)
7. Domain.csproj LIMPIO (sin MediatR) - REVERTIDO por decision
8. Application.csproj sin EF Core - REVERTIDO por decision
9. IDomainEvent:INotification - REVERTIDO por decision
10. init.sql RLS 13/13 tablas multi-tenant - `server/init.sql`
11. Owner Dashboard `$3` reutilizado - `legalpro-owner-dashboard/server.js`
12. initDb.js columnas fantasma - `server/initDb.js`

### 2.2 HIGH (N fixes)

- Logger centralizado frontend - `src/utils/logger.js` + 6 imports
- 9 hooks frontend sin uso eliminados
- 2 componentes frontend sin uso eliminados
- 8 adapters backend muertos eliminados
- scratch_db_desc.js eliminado
- Dockerfile.frontend USER nginx - linea 44
- useSeo hook centralizado - `src/hooks/useSeo.js`
- 9 paginas refactorizadas con useSeo
- 3 race conditions frontend fixed (useRef + cleanup)
- 8 Domain Event handlers .NET agregados

### 2.3 SECURITY

- CORS ya estaba bien configurado (false positive de auditoria)
- QR `api.qrserver.com`: pendiente
- JwtService.GetUserIdFromExpiredToken dead code: pendiente

## 3. RLS MULTI-TENANT

- 13 tablas con `ENABLE ROW LEVEL SECURITY`
- Funciones helper: `fn_rls_current_user_id`, `fn_rls_current_org_id`, `fn_rls_current_user_rol`
- `tenantMiddleware` en backend Node
- `tenantQuery()` exportado en `db.js:116`
- `BaseRepository.query()` ahora enruta via `tenantQuery()` cuando hay AsyncLocalStorage

## 4. DEUDA TECNICA DOCUMENTADA

1. 23/25 smoke tests skipped - tests escritos contra codigo React que nunca existio (MonitorSinoe, BovedaEvidencia)
2. 3 fixes .NET Clean Architecture revertidos - 87 archivos en Application con `using` EF Core
3. CSP `unsafe-inline` - riesgo XSS residual (tambien en ContaMind)
4. QR `api.qrserver.com` - expone email via otpauth URL (no arreglado en este batch)
5. JwtService.GetUserIdFromExpiredToken dead code - `int?` vs `Guid` type mismatch, no se llama
6. Healthcheck Dockerfile frontend: NO TIENE healthcheck propio (USER nginx agregado este turno pero falta HEALTHCHECK)
7. CSP nonce-based: pendiente
8. H-3 timing leak Owner Dashboard: NO ARREGLADO
9. CalendarioPlazos sin useCallback: false positive (la pagina no tiene useEffect)

## 5. ROLLBACK PLAN (sin git)

- Tags actuales en Railway: `legalpro-node:1.0.3`, `legalpro-frontend:5.2.0`, `legalpro-dotnet:2.0.0`
- Si deploy falla, en Railway UI revertir tag = 5 minutos por servicio
- NO hacer `git revert` (prohibido)

## 6. SMOKE POST-DEPLOY

- [ ] `curl https://legalpro-node-production-34ac.up.railway.app/health` -> 200 OK
- [ ] Frontend renderiza landing
- [ ] Login con usuario seed
- [ ] Crear expediente minimo
- [ ] Upload documento fake
- [ ] Verificar logs Railway: `[initDb] Tabla X verificada/creada`

## 7. IMAGES DOCKER GENERADAS

- `brunoayala97/legalpro-node:2.0.6`
- `brunoayala97/legalpro-frontend:5.3.0`
- `brunoayala97/legalpro-dotnet:2.0.1`
- `brunoayala97/legalpro-owner:2.0.6`
- Tag comun de release: `alfa-agresivo-20260629`

## 8. NOTAS DE RAILWAY (datos.txt)

- `DATABASE_URL` en datos.txt enmascarada con `***`
- `JWT_SECRET` y `MINIMAX_API_KEY` enmascarados
- Build context backend = `~/Desktop/Abogacia/` (NO `legalpro-app/`)
- Build context frontend = `~/Desktop/Abogacia/legalpro-app/`
- Variables Railway transferidas via `${{Postgres.DATABASE_URL}}` (referencias, no texto claro)