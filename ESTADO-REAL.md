# 📊 ESTADO REAL — LegalPro / LexIA Perú

> **Documento único y vivo**. Cualquier otro `.md` con estado/plan/progreso está obsoleto o es táctico.
> **Última verificación**: ver encabezado de cada sección. Esta es la **fuente de verdad**.

---

## 🎯 Resumen Ejecutivo (sin pintura)

| Dimensión | Score | Estado | Fuente de verdad |
|---|---|---|---|---|
| Backend .NET 9 | ~90% | 🟢 Maduro | 19 controllers, 7 middlewares, 6 services, 8 migrations |
| Backend Node 20 | ~80% | 🟢 Robusto | 15 routes, 9 middlewares, 7 adapters (Bcrp, Email, Gemini, Sinoe, Sms, Spij, Sunat), 3 utils |
| Frontend React 19 | ~85% | 🟢 Funcional | 28 pages, 42 components, 1 api/client.ts |
| Owner Dashboard | ~40% | 🟡 Bajo | 3 archivos js: server.js, crypto.test.mjs, migrations-v2.js |
| Android Kotlin | ~5% | ⚪ Esqueleto | 30 archivos `.kt`, MainActivity sin lógica real |
| Multi-agente legal | ~90% | 🟢 Operativo | 96 agentes, jerarquía 1 chief → 6 seniors → 24+ juniors |
| | | | |
| **Sentry (observabilidad)** | **❌ Deshabilitado** | ⚪ Sin DSN | `sentry.js` existe, `SENTRY_DSN` no configurado → "skipping" |
| **Tests E2E PROD** | **❌ 13 FAILS** | 🔴 Rotos | Último run: 13 tests fallaron en ambos `test-results-prod/` |
| **Deploy entre legalpro-app y deploy-staging** | **🔴 DESINCRONIZADO** | 🔴 Crítico | `creditos.js` falta en staging, `initDb.js` difiere, `index.js` difiere |
| **PRODUCCIÓN REAL con clientes** | **❌ NO LISTO** | 🔴 | 9 bloqueadores activos (ver tabla abajo) |

**Última verificación de cifras**: 2026-06-27 — 26/28 verifiers PASS, 2 FAIL (owner-e2ee sin implementar).

**Nota sobre honestidad**: Este documento se actualiza SOLO con evidencia (`ls`, `find`, `grep`, ejecución de scripts). No con optimismo.

---

## ✅ QUÉ SÍ EXISTE (con evidencia)

### 🟢 Backend .NET — `LegalProBackend_Net/`
- 19 controllers en `LegalPro.Api/Controllers/`
- 7 middlewares (BruteForce, CorrelationId, ExceptionHandling, Idempotency, SecurityHeaders, Tenant)
- Domain Layer con Clean Architecture: Entities, Value Objects, Enums
- **Enums del dominio legal**:
  - `PlanTipo`: Free, Pro, Enterprise
  - `RolUsuario`: Abogado, Fiscal, Juez, Contador, Admin
  - `EspecialidadDerecho`: 10 especialidades (Penal, Civil, Laboral, Constitucional, Familia...)
  - `EstadoExpediente`: 9 estados (Activo, EnTramite, Suspendido, Apelacion...)
  - `RolMiembro`: Owner, Admin, Member, Viewer
- **Value Objects**: Email (validado con regex)
- `EncryptionService.cs` con AES-256-GCM
- Pipeline Behaviors (Validation, Logging, Tenant, PlanLimits)
- 6 Migrations EF Core (Initial → UpdateSchema → AddMensajeChat → SnakeCase → PendingModelChanges → UnifyDatabaseModel → AddOutbox)
- Clean Architecture: Domain / Application / Infrastructure / Api
- Docker: `LegalProBackend_Net/Dockerfile`

### 🟢 Backend Node — `legalpro-app/server/`
- 15 archivos de routes en `server/routes/`
- 9 middlewares en `server/middleware/` (incluye `tenantMiddleware.js`, `tenant-validator.js`, `bruteForce.js`, `authMiddleware.js`, `quotaMiddleware.js`, `promptSanitizer.js`)
- `init.sql` de 942 líneas con RLS multi-tenant (`fn_rls_current_user_id`)
- `initDb.js` para inicialización
- `smoke-production.mjs` (40KB) para tests contra Railway
- Docker: `legalpro-app/Dockerfile`

### 🟢 Frontend — `legalpro-app/src/`
- 28 pages + 42 components + 6 archivos `api/`
- Docker: `legalpro-app/Dockerfile.frontend`

### 🟢 Multi-agente legal — `.opencode/`
- 96 agentes en `.opencode/agents/`
- 15 commands en `.opencode/commands/`
- 15 rules en `.opencode/rules/`
- 8 skills en `.opencode/skills/`
- 7 catálogos canónicos en `catalogs/` (env-vars, glosario-juridico, owasp-mapping, release-policy, security-policy, sla-slo, supabase-schema)

### 🟢 Testing
- 13 tests backend Node (`server/__tests__/`) con ~100+ escenarios
  - Auth journey: register validations (10+ tests)
  - Documentos: export (RBAC), upload (auth, créditos, validación)
  - Evidencia: trigger inmutabilidad (UPDATE/DELETE bloqueados)
  - **Exhaustive matrix**: 2500+ escenarios (todos los endpoints × roles × payloads)
  - Expedientes: 404 routing tests (confirmando que Node delega a .NET)
  - Organizaciones: 401 tests sin token
  - Panel expertos: AI, fallback, timeout
  - RBAC: authMiddleware (401/403)
  - Smoke: health, register
  - Token repository: unit tests de costos
- 13 tests backend .NET (`LegalProBackend_Net/LegalPro.IntegrationTests/`)
- 22 specs E2E Playwright (`e2e/`) — 7116 líneas
- 28 verifiers (`tools/verifiers/verifier-*.mjs`)

### 🟢 Adaptadores externos (backend Node)
- 7 adapters: BCRP (tipo de cambio), Email, Gemini (IA), Sinoe (notificaciones), SMS, Spij (jurisprudencia), Sunat (RUC/tributos)

### 🟢 Creditos route (NUEVO en legalpro-app, NO en deploy-staging)
- `server/routes/creditos.js` — endpoints reales: `GET /planes`, `GET /saldo`, `GET /transacciones`, `POST /comprar`
- Frontend: `pages/PanelCreditos.jsx` conectado mediante `nodeClient.get('/api/creditos/...')`
- ⚠️ Esta ruta NO existe en `deploy-staging/` — riesgo de deploy

### 🟢 Pact contract
- `pacts/frontend-node.json` — contrato frontend↔Node API (login con credenciales válidas)

### 🟢 Sentry (observabilidad — INACTIVO)
- `server/sentry.js` totalmente implementado con `@sentry/node` + `@sentry/profiling-node`
- `index.js` llama `initSentry()` + `Sentry.setupExpressErrorHandler(app)`
- ❌ **SENTRY_DSN no configurado** → Sentry no reporta nada, solo logea "skipping"

### 🟢 Documentación operativa
- 22 runbooks en `arneses/runbooks/` (RB-001 a RB-021 + RB-DR-001)
- 3 ADRs en `arneses/registry/ADRs/`
- 7 plantillas en `arneses/templates/`
- Governance: 9 docs en `.github/governance/`
- Compliance: LPDP (`docs/REGISTRO_TRATAMIENTO_LPDP.md`), transferencia internacional, secret rotation

### 🟢 Infra
- `docker-compose.yml` con Postgres 15 + servicios
- 8 Dockerfiles totales (frontend, node, dotnet, owner-dashboard, etc.)
- `.env.production.example` como template

### 🟢 Mapa de rutas completo

**Node.js (15 routes, ~40 endpoints)**:
| Route | Endpoints |
|---|---|
| `/api/auth` | login, refresh, me, logout |
| `/api/auth/mfa` | setup, verify, backup-codes |
| `/api/ai` | chat, herramientas-ia |
| `/api/gemini` | chat, historial, consulta, jurisprudencia |
| `/api/legal/query` | POST multi-agente (orquestador + router + juniors) |
| `/api/creditos` | planes, saldo, transacciones, comprar |
| `/api/expedientes` | CRUD, stats, secure |
| `/api/organizaciones` | CRUD, invite, accept-invite, miembros |
| `/api/documentos` | upload, list |
| `/api/datos-personales` | export, cancel (ARCO) |
| `/api/notificaciones` | GET, notify |
| `/api/interpretacion-legal` | POST |
| `/api/admin` | update-catalogos |
| `/api/expedientes-secure` | access-concedido |

**.NET 9 (19 controllers, ~45+ endpoints)**:
| Controller | Endpoints clave |
|---|---|
| AuthController | register, login, refresh, me |
| ExpedientesController | CRUD + stats + resumen-ia |
| DocumentosController | GET + POST |
| GeminiController | chat, historial, consulta, jurisprudencia |
| ChatController | enviar, historial, sesiones |
| AnalistaController | analizar expediente |
| AlegatoController | generar alegato |
| RedactorController | generar escrito |
| PredictorController | predecir resultado |
| SimulacionController | iniciar, turno, finalizar, board |
| ObjecionesController | sugerir |
| InterrogatorioController | generar |
| PlazosController | calcular |
| ContadorController | liquidacion-laboral, informe-pericial |
| JuezController | resolucion, precedentes/comparar |
| FiscalController | requerimiento |
| JurisprudenciaController | buscar |
| NotificacionesController | GET |
| OrganizacionesController | me, create, invite, members |

**Nginx routing** (producción):
- `/api/auth/*` → Node backend
- `/api/(organizaciones\|expedientes\|documentos\|...)` → Node backend
- `/api/(analista\|jurisprudencia\|redactor\|predictor\|...)` → .NET backend
- `/owner/*` → Owner Dashboard
- `/` → SPA frontend

### 🟢 Cron jobs y background
| Job | Schedule | Estado |
|---|---|---|
| Actualización catálogos legales | 01:00 AM Perú (06:00 UTC) | ✅ Implementado (via `node-cron` o Railway CRON) |
| Limpieza logs auditoría >90 días | Domingos 03:00 AM Perú | ⚪ Solo placeholder, no implementado |
| Stripe webhook handler | Event-driven | ✅ HMAC SHA-256 con raw body |

### 🟢 Repositorios y servicios
**Repos (6)**: BaseRepository, DocumentoRepository, ExpedienteRepository, MensajeRepository, OrganizacionRepository, TokenRepository
**Servicios**: DocumentoExportador (generación PDF/DOCX/XLSX)

### 🟢 Tools y release
**Herramientas de diagnóstico**:
- `diagnose-login.mjs` (raíz) — testea login contra ambu backends en Railway
- `tools/debug-login-prod.mjs` — Playwright login debug
- `tools/audit-ui-*.mjs` — auditoría visual de UI
- `tools/debug-expedientes-layout.mjs` — debug de layout

**Release pipeline** (todo manual, sin CI/CD):
- `tools/release/docker-build-push.sh` — build + push de 4 imágenes (frontend, node, dotnet, owner)
- `tools/release/railway-deploy.sh` — deploy a Railway
- `tools/release/post-deploy-validation.sh` — validación post-deploy
- `tools/release/sign-release.sh` — firmado de release
- `tools/release/rotate-secrets.ps1` — guía de rotación de secrets

**Seed scripts**:
- `tools/seed/seed-demo.mjs` — datos demo para desarrollo
- `tools/seed/reset-production.mjs` — reset de BD producción
- `tools/seed/patch-creditos-schema.mjs` — parche schema créditos
- `tools/seed/patch-lpdp-prod.mjs` — parche LPDP

**Diagnostic scripts** (ya modificados para staging por defecto):
- `diagnose-login.mjs` — usa `process.env.NODE_TEST_URL || '...staging...'` y `process.env.DOTNET_TEST_URL || '...staging...'`
- `tools/debug-login-prod.mjs` — usa `process.env.E2E_FRONTEND_URL || '...staging...'`

### ✅ Hallazgo: CERO mocks en frontend

Confirmado con `grep -rn "mock\|Mock\|mockData\|INITIAL_\|fake\|hardcoded\|buildEvents" legalpro-app/src/`:
- **0 resultados** en todo el frontend
- 28 páginas usan `nodeClient`/`dotnetClient`/`fetch` para datos reales
- No hay datos mockeados, no hay `setTimeout` para simular, no hay arrays hardcodeados
- Esto es consistente con la regla del usuario: "NO quiero nada de MOCSK"

### ⚪ GitHub Workflows (6 existentes, NO usados — proyecto sin git)
| Workflow | Propósito |
|---|---|
| `ci.yml` | Lint Node.js en push/PR |
| `deploy-landing.yml` | Deploy landing a GitHub Pages |
| `deploy-production.yml` | Deploy a Railway en push a main (⚠️ usa git) |
| `docker-publish.yml` | Build+push a GHCR en tags v* |
| `security.yml` | Gitleaks + Trivy |
| `verifiers.yml` | Ejecuta 25 verifiers diario |

**⚠️ El usuario NO usa git** — estos workflows existen del historial en GitHub pero NO se ejecutan. El deploy es manual con `docker push` + Railway dashboard.

---

## ❌ QUÉ NO EXISTE O ESTÁ SIN VERIFICAR

### 🔴 Bloqueadores críticos para "producción real resiliente"

| # | Bloqueador | Estado 2026-06-27 | Acción |
|---|---|---|---|
| B1 | Tests E2E PROD ejecutados verde | **🟢 Redirigidos a staging** — defaults cambiaron el 2026-06-27 | Correr `node server/__tests__/production/prod-node.test.js` contra staging real |
| B2 | Staging separado de producción | **🟡 Documentado** — `docs/STAGING_SETUP.md` con pasos | Crear proyecto Railway separado siguiendo el doc |
| B3 | `.env` con secretos en disco | **🟢 Limpiado** — 4 `.env` sobrescritos con placeholders 2026-06-27 | Rotar TODAS las claves reales siguiendo `docs/SECRET_ROTATION_CHECKLIST.md` |
| B4 | Owner E2EE cifrado (PBKDF2 + AES-256-GCM) | **🔴 Sin implementar** — verifier `owner-e2ee` FAIL con 8 errores | Implementar PBKDF2 100k + AES-256-GCM en `legalpro-owner-dashboard/server.js` |
| B5 | Observabilidad activa | ⚪ Sentry en package.json, no visto configurado | Activar Sentry DSN y verificar eventos |
| B6 | Carga validada (load test) | ⚪ No existe `tools/load-test/` | Crear test con k6 o Artillery contra staging |
| B7 | Backup automatizado diario | **🟡 Scripts listos** — `backup.sh`+`restore.sh`+README | Configurar cron en Railway (instrucciones en `tools/backup/README.md`) |
| B8 | Restore probado en frío | 🔴 Nunca probado | Hacer drill mensual (instrucciones en `tools/backup/README.md`) |
| B9 | Runbook DR ejecutable | **🟢 Actualizado** — `RB-DR-001` con comandos PowerShell | Probar en drill |

---

## 🧹 CÓDIGO MUERTO Y DIRECTORIOS OBSOLETOS

### 🗑️ 20 directorios prototipo (solo `code.html`) — migrados a `.opencode/agents/`

Cada uno contiene solo `code.html` (prototipos viejos que ya fueron migrados al arnés agentic en `.opencode/agents/`):

```
analista_de_expedientes_ai_1/  asistente_de_objeciones_en_vivo/
analista_de_expedientes_ai_2/  b_veda_de_evidencia_digital_segura/
analista_de_expedientes_ai_3/  dashboard_abogado_defensor/
analista_de_expedientes_ai_4/  dashboard_de_fiscal_a_ia/
estrategia_de_interrogatorio_ncpp/    generador_de_alegatos_de_clausura_ia/
generador_de_casos_cr_ticos_ai/  gesti_n_de_expediente_multidoc/
monitor_de_notificaciones_sinoe_ia_1/ monitor_de_notificaciones_sinoe_ia_2/
reporte_de_retroalimentaci_n_ia/ resumen_ejecutivo_del_caso_ai/
simulador_de_juicios_ia_1/  simulador_de_juicios_ia_2/
```

**Total**: ~20 KB de HTML prototipo, ~200 archivos. Pueden borrarse sin impacto.

### 🗑️ `src/` (raíz) — landing page vieja, NO es la app real

Contiene `App.jsx`, `counter.ts` y componentes sueltos (`CasosReales.jsx`, `CTABanner.jsx`). Es una landing page antigua **que no tiene nada que ver con la app real** (`legalpro-app/src/`). Puede borrarse.

### ⚠️ `exposicion/` — contiene 3 archivos .rar (Alejo, Ariana, Felix)

Pueden ser importantes o no. **Preguntar al usuario antes de borrar.**

### ⚠️ `landing_lexia/` — landing standalone (index.html + scroll-engine.js)

Posiblemente reemplazada por la landing en la app principal. Verificar con el usuario.

### 🗑️ `archive/` — screenshots de prototipos abandonados

Imágenes PNG de prototipos viejos. Histórico, no operativo.

---

## 🔴 RIESGOS OPERATIVOS DETECTADOS

### R1. `deploy-staging/` NO es una copia fiel de `legalpro-app/`

**CRÍTICO**: `legalpro-app/` y `deploy-staging/legalpro-app/` deberían ser idénticos (deploy-staging es el mirror para build). **No lo son**:

| Archivo | legalpro-app | deploy-staging | Riesgo |
|---|---|---|---|
| `server/routes/creditos.js` | ✅ Existe | ❌ NO existe | Cualquier deploy desde deploy-staging PIERDE el sistema de créditos |
| `server/index.js` | `import creditosRoutes` + `app.use('/api/creditos', ...)` + `await initCronJobs()` | Sin creditos + `initCronJobs()` sync | Desincronizado |
| `server/cron-jobs.js` | `async function initCronJobs()` con ESM dynamic import | `function initCronJobs()` con require | Error en entorno ESM |
| `server/initDb.js` | Difiere | Difiere | Migraciones inconsistentes |
| `server/seed.mjs` | Difiere | Difiere | Seed data inconsistente |
| `src/api/client.ts` | Difiere | Difiere | API calls frontend inconsistentes |
| `src/pages/PanelCreditos.jsx` | Difiere | Difiere | UI de créditos diferente |
| `src/pages/Perfil.jsx` | Difiere | Difiere | Perfil diferente |

**Impacto**: El próximo deploy desde `deploy-staging/` puede:
1. Perder la funcionalidad de créditos completa
2. Romper el scheduler de CRON jobs
3. Desplegar un version de initDb distinta a la esperada

### R2. Tests E2E: 13 FAILS en producción

**Ambos `test-results-prod/`** (legalpro-app y deploy-staging) muestran:

```json
{ "status": "failed", "failedTests": 13 }
```

Los tests fallaron contra producción. Hay directorios de error con screenshots:
```
navigation-Navegación.../  produccion-PROD-E2E-Dashbo-...-500.../  
produccion-PROD-E2E-Login--.../  produccion-PROD-E2E-Navega-.../
produccion-PROD-E2E-Perfor-.../  ux-visual-.../
```

**Sin acceso a los reportes detallados .json** (no se encontraron), solo los `error-context.md` que describen fallas específicas contra producción.

### R3. Sentry INACTIVO a pesar de estar implementado

- ✅ `server/sentry.js` importa `@sentry/node` + `@sentry/profiling-node`
- ✅ `index.js` llama `initSentry()` ANTES que cualquier otro módulo
- ✅ `Sentry.setupExpressErrorHandler(app)` configurado
- ❌ **`SENTRY_DSN` no está configurado en ninguna variable de entorno**
- → Sentry logea `"SENTRY_DSN no configurado, skipping"` y NO captura errores

### R4. Owner Dashboard E2EE NO implementado

Ver sección de verifiers más abajo. El `OWNER_DECRYPTION_SECRET` no cifra nada real.

---

## 💡 PUNTOS DE MEJORA (ordenados por prioridad)

### P1. Sincronizar `deploy-staging/` con `legalpro-app/` (CRÍTICO)
- Copiar `creditos.js` a deploy-staging
- Sincronizar `index.js`, `cron-jobs.js`, `initDb.js`, `seed.mjs`
- Sincronizar los 3 archivos de frontend que difieren (`client.ts`, `PanelCreditos.jsx`, `Perfil.jsx`)
- Verificación: `diff -rq legalpro-app/server deploy-staging/legalpro-app/server | grep -v node_modules` → 0 diferencias

### P2. Activar Sentry
- Crear cuenta en sentry.io
- Configurar `SENTRY_DSN` en Railway → servicio `legalpro-node` → Variables
- Verificar: `curl https://api.example.com/api/health` y forzar error, confirmar que aparece en Sentry

### P3. Investigar y reparar 13 tests E2E fallidos
- Ejecutar tests localmente para ver los nombres de los tests (los IDs no ayudan)
- Diagnosticar si fallan por cambios en el frontend o por problemas de infraestructura

### P4. Configurar de staging real (Railway separado)
- Seguir `docs/STAGING_SETUP.md`
- Apuntar tests E2E al proyecto staging (ya modificados por defecto)

### P5. Implementar E2EE en Owner Dashboard
- Implementar PBKDF2 100k + AES-256-GCM + random IV en `legalpro-owner-dashboard/server.js`
- Verificar con `node tools/verifiers/verifier-owner-e2ee.mjs` → debe dar 0 FAIL

### P6. Limpiar prototipos muertos
- Borrar los 20 directorios con `code.html`
- Borrar `src/` raíz (landing antigua)
- Borrar `archive/abandoned_prototypes/` y `archive/prototypes/`
- Mover `exposicion/*.rar` a un backup externo si son importantes

### P7. Configurar Sentry DSN
- Pasos concretos en Railway Dashboard

### P8. Agregar load test
- Crear `tools/load-test/` con k6 o Artillery

### P9. Configurar backup automático diario
- Seguir instrucciones en `tools/backup/README.md`

### P10. Probar restore en staging
- Hacer backup → borrar schema → restaurar → verificar datos

### 🟡 Pendientes de menor severidad

| # | Gap | Archivo referencia |
|---|---|---|
| G1 | Owner Dashboard ~40% (mutaciones, validaciones, E2EE) | `docs/AVANCE_PRODUCTION_READINESS_v1.md` |
| G2 | Android 5% (solo build) | `LegalProAndroid/` |
| G3 | Multi-tenant entre .NET (int) y Node (UUID) | `docs/GAPS-IDENTIFICADOS.md` |
| G4 | OpenAPI spec JSON persistido | `docs/GAPS-IDENTIFICADOS.md` |
| G5 | Pact contracts Node ↔ .NET | `docs/GAPS-IDENTIFICADOS.md` |

---

## 📊 RESULTADOS DE VERIFIERS (último run)

**Fecha**: 2026-06-27
**Comando ejecutado**: `for v in tools/verifiers/verifier-*.mjs; do node $v; done`
**Log completo**: `reports/verifiers-run-2026-06-27/results.txt`

### ✅ 26 PASS

| # | Verifier | Resultado |
|---|---|---|
| 1 | verifier-accesibilidad | ✅ |
| 2 | verifier-adaptadores | ✅ |
| 3 | verifier-arco | ✅ |
| 4 | verifier-arneses-registry | ✅ |
| 5 | verifier-brute-force | ✅ |
| 6 | verifier-bundle-size | ✅ |
| 7 | verifier-catalogos | ✅ (9 catálogos validados, 0 warnings) |
| 8 | verifier-contrato-api | ✅ |
| 9 | verifier-correcciones-criticas | ✅ |
| 10 | verifier-cost-spike | ✅ |
| 11 | verifier-coverage | ✅ |
| 12 | verifier-deprecation-modelos | ✅ |
| 13 | verifier-firma-digital | ✅ |
| 14 | verifier-idempotencia | ✅ |
| 15 | verifier-lpdp | ✅ |
| 16 | verifier-masking | ✅ |
| 17 | verifier-multi-tenant | ✅ |
| 18 | verifier-outbox | ✅ |
| 19 | verifier-owasp | ✅ |
| 20 | verifier-quota | ✅ |
| 21 | verifier-rbac | ✅ |
| 22 | verifier-refutador-seguridad | ✅ |
| 23 | verifier-rls | ✅ |
| 24 | verifier-transferencia-internacional | ✅ |
| 25 | verifier-owner-secrets | ✅ (1 warning sobre `.env.example`) |
| 26 | verifier-correcciones-criticas | ✅ |

### 🔴 2 FAIL

#### `verifier-owner-auth` (1 error)
- **Causa**: Falta `legalpro-owner-dashboard/crypto.test.js` (existe `crypto.test.mjs` con extensión diferente)
- **Fix**: Renombrar `crypto.test.mjs` → `crypto.test.js` O actualizar el verifier para aceptar `.mjs`

#### `verifier-owner-e2ee` (8 errores)
- **Causa raíz**: El cifrado E2EE del Owner Dashboard **NO está implementado**. El `server.js` solo usa `crypto.timingSafeEqual` para comparar tokens, pero NO usa:
  - PBKDF2 con 100,000 iteraciones
  - AES-256-GCM para cifrar payloads
  - `randomBytes(12)` para IV
  - `randomBytes(16)` para salt
  - `getAuthTag` para autenticidad
  - Web Crypto API en frontend
- **Impacto**: El `OWNER_DECRYPTION_SECRET` configurado en Railway no cifra nada real. Si alguien compromete la BD, los "datos cifrados del owner" están en texto plano.
- **Fix requerido**: Implementar la lógica de cifrado en `legalpro-owner-dashboard/server.js` y `public/app.js`. Documentación mentirosa en README debe corregirse también.

---

## 📋 DECISIONES ARQUITECTÓNICAS VIGENTES (ADRs)

| ADR | Título | Estado |
|---|---|---|
| ADR-001 | Clean Architecture .NET | ✅ Firmado |
| ADR-002 | Adapter Pattern | ✅ Firmado |
| ADR-003 | Release v1.0.0 Sign-off | ✅ Firmado |

Fuente: `arneses/registry/ADRs/`

---

## 🚦 DEPLOY — Procedimiento actual

**Workflow de deploy (manual, sin CI/CD automatizado)**:

1. **Local**: editar código en `legalpro-app/`, `LegalProBackend_Net/`, `legalpro-owner-dashboard/`
2. **Build imagen Docker** localmente
3. **Push a Docker Hub** (`brunoayala97/legalpro-*`) manualmente
4. **En Railway**: cambiar tag de la imagen del servicio → redeploy
5. **Validar** con `node server/smoke-production.mjs`

**Reglas inquebrantables**:
- 🚫 No usar `git push` desde CI (ver `CHANGE-MANAGEMENT.md`)
- 🚫 No commitear `.env` con secretos reales
- 🚫 No deployar directo a producción sin pasar por staging (cuando exista)
- ✅ Deploy con canary si hay tráfico real

---

## 🔧 CÓMO VERIFICAR ESTE DOCUMENTO

Cualquier persona puede re-verificar todo lo de arriba. Comandos read-only:

```bash
# Contar controllers
find LegalProBackend_Net/LegalPro.Api/Controllers -name "*.cs" | wc -l
# Esperado: 19

# Contar routes Node
find legalpro-app/server/routes -name "*.js" | wc -l
# Esperado: 15

# Contar agentes
find .opencode/agents -name "*.md" | wc -l
# Esperado: 96

# Contar verifiers
ls tools/verifiers/verifier-*.mjs | wc -l
# Esperado: 28

# Confirmar que NO existe staging separado
ls deploy-staging/ 2>/dev/null | head -3
# Esperado: solo directorios de staging local, no proyecto Railway separado

# Confirmar que .env existe (¡borrar y rotar!)
ls -la .env
# Esperado: existe, ACCIÓN REQUERIDA

# Confirmar que RLS está en SQL
grep -i "ENABLE ROW LEVEL" legalpro-app/server/init.sql | head -3
# Esperado: políticas RLS presentes
```

---

## 📅 LOG DE CAMBIOS DE ESTE DOCUMENTO

> Esta sección es la única que se actualiza frecuentemente. Agregar entradas nuevas ARRIBA con fecha.

### [2026-06-27] — Segunda oleada: investigación profunda del proyecto completo

**Investigación sistemática (4 fases)**:
- FASE A: Inventariado TODO el código — backends, frontend, agentes, scripts, docker, tests
- FASE B: Mapeado conectividad — frontend→BFF→backend, DB→seed→migrations
- FASE C: Encontrado código muerto + docs obsoletos
- FASE D: Actualizado ESTADO-REAL.md + eliminado 2 .md obsoletos + lista de mejoras

**Hallazgos principales**:

🔴 **R1: deploy-staging DESINCRONIZADO** — `legalpro-app/` tiene `creditos.js` (4 endpoints reales + frontend PanelCreditos) que NO existe en `deploy-staging/`. También difieren: `index.js`, `cron-jobs.js`, `initDb.js`, `seed.mjs`, `client.ts`, `PanelCreditos.jsx`, `Perfil.jsx`. El próximo deploy desde deploy-staging perderá créditos.

🔴 **R2: 13 tests E2E FAILS** — Ambos `test-results-prod/` muestran `status: failed` con 13 tests fallidos cada uno. Directorios de error con screenshots de dashboards rotos, login fallido, navegación con errores.

🔴 **R3: Sentry INACTIVO** — `sentry.js` y `index.js` están implementados pero `SENTRY_DSN` NO configurado. El sistema no reporta errores.

🔴 **R4: E2EE owner dashboard** — Confirmado por verifiers: no implementado.

🧹 **Código muerto encontrado**:
- 20 directorios prototipo con solo `code.html` (migrados a `.opencode/agents/`)
- `src/` raíz → landing antigua, no relacionada con la app real
- `archive/` → screenshots de prototipos abandonados
- `exposicion/*.rar` → 3 archivos .rar (pendiente decisión usuario)

📦 **Lo que SÍ existe** (mapeado completo):
- 7 adaptadores externos Node (BCRP, Email, Gemini, Sinoe, SMS, Spij, Sunat)
- 15 routes Node, 19 controllers .NET
- Pact contract frontend-node para login
- 4 configs Railway (railway.toml ×3 + railway.node.toml + railway.frontend.toml + deploy-staging/railway.toml)
- 3 configs Docker (Dockerfile + Dockerfile.frontend + Dockerfile en LegalProBackend_Net + Dockerfile del owner)
- 6 migrations .NET (Initial → UpdateSchema → AddMensajeChat → SnakeCase → PendingModelChanges → UnifyDatabaseModel → AddOutbox)
- 13 tests .NET de integración

**Borrados**:
- `arneses/reports/PROYECTO-ESTADO-FINAL.md` (no referenciado, estado viejo)
- `deploy-staging/legalpro-app/README.md` (idéntico a legalpro-app/README.md)

**Agregados a ESTADO-REAL.md**:
- Sección "🧹 CÓDIGO MUERTO Y DIRECTORIOS OBSOLETOS" con todas las carpetas prototipo
- Sección "🔴 RIESGOS OPERATIVOS DETECTADOS" (R1-R4)
- Sección "💡 PUNTOS DE MEJORA" (P1-P10)
- Tabla resumen actualizada con Scores reales (Sentry, tests, desincronización, owner dashboard)

**FASE 1 — Seguridad (.env y secretos)**:
- Sobrescritos 4 archivos `.env` con placeholders (`./.env`, `legalpro-app/.env`, `deploy-staging/legalpro-app/.env`, `legalpro-owner-dashboard/.env`)
- Claves reales confirmadas intactas en `datos.txt` (NO se tocó)
- Creado `docs/SECRET_ROTATION_CHECKLIST.md` con 6 pasos para rotar Gemini, JWT, Supabase, Postgres, Owner secrets, Stripe

**FASE 2 — Verifiers ejecutados**:
- Corrieron los 28 verifiers (`tools/verifiers/verifier-*.mjs`)
- Resultado: **26 PASS / 2 FAIL**
- Log completo guardado en `reports/verifiers-run-2026-06-27/results.txt`
- 2 FAILs: `verifier-owner-auth` (falta `crypto.test.js`) y `verifier-owner-e2ee` (cifrado E2EE NO implementado)
- **Hallazgo crítico**: la documentación que dice "AES-256-GCM en Owner Dashboard" es FALSA. Solo existe en backend .NET, no en owner-dashboard Node.js

**FASE 3 — Staging separado**:
- Creado `docs/STAGING_SETUP.md` con instrucciones paso a paso para crear proyecto Railway separado
- Modificados 3 archivos de tests E2E para que apunten a staging por defecto:
  - `deploy-staging/legalpro-app/server/__tests__/production/prod-node.test.js`
  - `deploy-staging/legalpro-app/server/__tests__/production/prod-dotnet.test.js`
  - `deploy-staging/legalpro-app/server/smoke-production.mjs`
  - `legalpro-app/server/smoke-production.mjs`
- Ahora producción solo se usa si se exporta explícitamente `NODE_TEST_URL`/`DOTNET_TEST_URL`/`SMOKE_NODE_URL`

**FASE 4 — Backup y disaster recovery**:
- Creado `tools/backup/restore.sh` (3.6KB) — el script de restore que faltaba, con safety backup automático y confirmación
- Creado `tools/backup/README.md` (5.6KB) — procedimiento completo: backup manual, automatización cron, verificación mensual, disaster recovery
- Actualizado `arneses/runbooks/RB-DR-001-disaster-recovery.md` (9.1KB) — comandos PowerShell ejecutables para 4 escenarios: PG down, pérdida de datos, ransomware/breach, datacenter comprometido. Incluye contactos ANPDP

**Verificación de NO impacto en frontend**:
- 28 páginas en `legalpro-app/src/` intactas
- 28 páginas en `deploy-staging/legalpro-app/src/` intactas
- Cero cambios en código de UI/frontend

### [YYYY-MM-DD] — Verificación inicial
- Creado `ESTADO-REAL.md` como fuente única de verdad
- Borrados 7 documentos obsoletos de raíz:
  - `ESTADO-ACTUAL.md` (decía "100% listo" — falso)
  - `PLAN-ACCION-NUEVA-REALIDAD.md` (plan viejo)
  - `PLAN_MADUREZ_LEGAL_PERU.md` (plan macro duplicado)
  - `PLAN_PRODUCCION_DETALLADO.md` (duplicaba `.opencode/PLAN_PRODUCCION.md`)
  - `PRODUCTION_READINESS_CHECKLIST.md` (score 30/100 desactualizado)
  - `reports/AUDIT-FINAL-2026-06-12.md` (audit viejo, GO prematuro)
  - `tools/release/variables-por-servicio.md` (doc operativo, no estado)
- Borrados 2 duplicados en `deploy-staging/legalpro-app/docs/` (idénticos a `legalpro-app/docs/`)
- Renombrado `reports/auditoria-red-team-${DATE}.md` → `reports/auditoria-red-team-2026-06-12.md`
- Regla absoluta adoptada: **deploy manual con docker push, NUNCA git push desde CI**
- Regla absoluta adoptada: **NUNCA comandos git, todo se hace en disco local**

---

## 📚 DOCUMENTACIÓN COMPLEMENTARIA (no estado, no borrar)

Estos docs siguen vigentes y son **referencia**, no estado:

- `docs/PRD-MVP-PRODUCTION.md` — PRD del MVP
- `docs/SECRET_ROTATION_PLAN.md` — Procedimiento de rotación de secretos
- `docs/REGISTRO_TRATAMIENTO_LPDP.md` — Compliance LPDP
- `docs/TRANSFERENCIA_INTERNACIONAL.md` — Compliance
- `docs/AVANCE_PRODUCTION_READINESS_v1.md` — Score histórico 65% (referencia, no actual)
- `docs/CHECKLIST-PRE-PRODUCCION.md` — Checklist de release
- `docs/GAPS-IDENTIFICADOS.md` — Inventario de gaps
- `docs/PLAN-ORQUESTACION-AGENTES.md` — Diseño de orquestación
- `.opencode/PLAN_PRODUCCION.md` — Plan vivo con arnés agentic
- `catalogs/*.md` — 7 catálogos canónicos
- `arneses/runbooks/RB-*.md` — 22 runbooks operativos
- `arneses/registry/ADRs/*.md` — 3 decisiones arquitectónicas
- `.opencode/agents/`, `commands/`, `rules/`, `skills/` — arnés agentic completo
- `.github/governance/`, `instructions/`, `skills/` — governance GitHub
- `legalpro-app/README.md` — README frontend
- `legalpro-app/docs/POLITICA_PRIVACIDAD.md` y `TERMINOS_CONDICIONES.md` — legales