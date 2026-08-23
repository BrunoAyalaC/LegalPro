# 🚀 PLAN DE EJECUCIÓN: Llevar LegalPro a Producción usando el Arnés Agentic

> **Plan v1.0** — Para abrir con OpenCode y ejecutar con los 90 agentes del arnés.

## 🎯 Objetivo

Llevar el proyecto LegalPro a **producción en 8-12 semanas**, completando los gaps identificados, usando los 90 agentes del arnés agentic.

## 📊 Estado Actual (Audit Inicial)

| Stack | Estado | % Implementado | Gap |
|---|---|---|---|
| **Backend .NET 8** (LegalProBackend_Net/) | Maduro | **~90%** | Tests, ajustes de producción |
| **Backend Node 20** (legalpro-app/server/) | Maduro | **~80%** | Repositorios faltantes, integración |
| **Frontend React 19** (legalpro-app/src/) | Funcional | **~75%** | Integración con backend, accessibility audit |
| **Owner Dashboard** (legalpro-owner-dashboard/) | Inicial | **~30%** | Mutaciones, validaciones, multi-tenant |
| **Android Kotlin/Compose** (LegalProAndroid/) | Esqueleto | **~5%** | TODO - solo build inicial |

### Catálogos / Arnés (100% completos)

- ✅ 20 catálogos canónicos
- ✅ 22 verificadores funcionales
- ✅ 20 runbooks
- ✅ 15 reglas
- ✅ 90 agentes
- ✅ 20 plantillas
- ✅ 11 hooks
- ✅ 4 workflows CI/CD

## 🗓️ Roadmap de 12 Semanas (3 Sprints de 4 semanas)

### 🟢 SPRINT 1: Validación y Cimientos (Semanas 1-2)

**Objetivo**: Validar que el 80% existente funciona, identificar gaps reales, y crear la base de testing E2E.

#### Semana 1: Audit y Configuración

**Tarea 1.1: Audit del estado actual** (USAR AGENTES)

```bash
# Paso 1: Abrir OpenCode
opencode

# Paso 2: Ejecutar audit
@product-owner genera un PRD para "MVP Production-Ready v1.0" basado en estado actual
```

**Agente invocado**: `@product-owner`
- Lee `legalpro-app/src/pages/`, `legalpro-app/server/routes/`, `LegalProBackend_Net/LegalPro.Api/Controllers/`
- Genera PRD en `docs/PRD-MVP-PRODUCTION.md`
- Lista gaps por stack
- Define criterios de aceptación

**Tarea 1.2: Validar que lo que existe funciona**

```bash
@auditor-seguridad audita el estado actual
```

**Agente invocado**: `@auditor-seguridad`
- Ejecuta los 22 verificadores
- Genera reporte de cumplimiento OWASP
- Identifica issues críticos

**Tarea 1.3: Configurar entorno de desarrollo**

```bash
@devops configura entorno dev local
```

**Agente invocado**: `@devops`
- Crea `.env.example` completo (referencia `catalogs/env-vars.md`)
- Documenta setup local en `docs/SETUP-LOCAL.md`
- Configura Docker Compose para dev (Postgres + Redis)
- Crea scripts de bootstrap

**Tarea 1.4: Setup de base de datos**

```bash
@database configura schema y seed
```

**Agente invocado**: `@database`
- Valida `legalpro-app/server/init.sql`
- Ejecuta migraciones
- Crea seed data (usuario admin, 3 organizaciones demo, 3 roles)
- Verifica RLS con tests cross-tenant

#### Semana 2: Tests E2E y CI/CD

**Tarea 2.1: Ejecutar suite de tests existente**

```bash
@journey-tester corre la suite de journeys
```

**Agente invocado**: `@journey-tester`
- Ejecuta los 18 tests E2E en `legalpro-app/e2e/`
- Ejecuta los 12 tests Node en `legalpro-app/server/__tests__/`
- Ejecuta los 5 tests .NET en `LegalPro.UnitTests/` y `LegalPro.IntegrationTests/`
- Genera reporte de coverage

**Tarea 2.2: Configurar CI para ejecutar todo**

```bash
@devops configura CI completo
```

**Agente invocado**: `@devops`
- Actualiza `.github/workflows/ci.yml` para ejecutar 22 verificadores
- Agrega jobs paralelos por stack
- Configura artifacts (coverage, build, docker)
- Configura notificaciones Slack

**Tarea 2.3: Smoke test pre-producción**

```bash
@smoke-tester ejecuta smoke en staging
```

**Agente invocado**: `@smoke-tester`
- Crea `smoke-production.mjs` con 5 roles demo
- Valida health checks, latencia, SLOs
- Genera baseline de performance

**Salida Sprint 1**:
- ✅ PRD MVP v1.0 firmado
- ✅ Reporte de audit completo
- ✅ Entorno dev funcional
- ✅ DB con seed data
- ✅ CI ejecutando 22 verificadores
- ✅ Tests E2E pasando
- ✅ Baseline de performance

### 🟡 SPRINT 2: Completar Backend + Owner Dashboard (Semanas 3-6)

**Objetivo**: Terminar backend Node + .NET, completar owner dashboard.

#### Semana 3-4: Backend .NET refinements

**Tarea 3.1: Completar controllers faltantes**

```bash
@backend-dotnet completa controllers y agrega Outbox processor
```

**Agente invocado**: `@backend-dotnet`
- Revisa los 18 controllers existentes
- Implementa `ProcessOutboxMessagesJob` (BackgroundService)
- Valida `PlanLimitsBehavior` y `TenantValidationBehavior`
- Agrega idempotency en POST mutables
- Implementa rate limiting por usuario

**Tarea 3.2: Completar tests unitarios**

```bash
@reviser audita calidad de tests
```

**Agente invocado**: `@reviser` + `@backend-dotnet`
- Coverage >= 80% (Fase4Fase5Tests ya existe)
- Tests de comportamiento (validation, tenant, plan limits)
- Tests de integración con TestAuthHandler

**Tarea 3.3: Validar cumplimiento LPDP en .NET**

```bash
@auditor-lpdp audita el backend .NET
```

**Agente invocado**: `@auditor-lpdp`
- Verifica `IAuditLogger` emite eventos correctos
- Verifica `MaskingTextFormatter` en Serilog
- Verifica `SecurityHeadersMiddleware`
- Valida endpoints ARCO

#### Semana 5-6: Owner Dashboard completo

**Tarea 5.1: Implementar mutaciones del owner**

```bash
@owner-admin implementa acciones del owner
```

**Agente invocado**: `@owner-admin` + `@backend-node`
- POST `/api/owner/tenants/:id/suspend` con `RB-020`
- POST `/api/owner/tenants/:id/reactivate`
- PUT `/api/owner/tenants/:id/plan`
- POST `/api/owner/refund`
- POST `/api/owner/tenants/:id/view-pii` (con aprobación)
- Todos con `OWNER_ACTION_*` audit events

**Tarea 5.2: Mejorar owner dashboard UI**

```bash
@ux-ui mejora el owner dashboard
```

**Agente invocado**: `@ux-ui`
- Tabla de tenants con filtros
- Drill-down por tenant
- Gráficos de consumo (Recharts o similar)
- Sistema de alertas visuales
- WCAG 2.1 AA

**Tarea 5.3: Implementar autenticación robusta**

```bash
@owner-admin migra owner auth a JWT con MFA
```

**Agente invocado**: `@owner-admin` + `@auditor-seguridad`
- Reemplaza Bearer token simple por JWT
- Implementa TOTP MFA
- Rate limit por IP
- Audit log con IP geográfica

**Salida Sprint 2**:
- ✅ Backend .NET 100% con tests
- ✅ Backend Node con repos restantes
- ✅ Owner Dashboard con mutaciones
- ✅ UI del owner mejorada
- ✅ MFA + JWT robusto
- ✅ LPDP compliance verificado

### 🟠 SPRINT 3: Android + Frontend Polish (Semanas 7-10)

**Objetivo**: Construir Android desde cero, pulir frontend React.

#### Semana 7-9: Android desde cero

**Tarea 7.1: Configurar proyecto Android**

```bash
@android configura el proyecto Android
```

**Agente invocado**: `@android`
- Configura `build.gradle.kts` con Compose 2.x, Hilt, Coroutines
- Configura Supabase SDK + Retrofit
- Configura EncryptedSharedPreferences
- Configura Room
- Setup R8 + ProGuard
- MultiDex habilitado

**Tarea 7.2: Implementar autenticación y navegación**

```bash
@android implementa login y navegación
```

**Agente invocado**: `@android`
- Pantalla de Login (Compose)
- Pantalla de Registro
- AuthGuard con JWT en EncryptedSharedPreferences
- Navegación con `androidx.navigation.compose`
- Interceptor OkHttp con `X-Correlation-ID`

**Tarea 7.3: Implementar dashboard principal (rol ABOGADO)**

```bash
@android implementa dashboard del abogado
```

**Agente invocado**: `@android` + `@frontend`
- Dashboard con 13 herramientas
- Bottom navigation
- Top bar con usuario/org
- IADisclaimerBanner

**Tarea 7.4: Implementar 5 herramientas críticas**

```bash
@android implementa herramientas IA
```

**Agente invocado**: `@android` + `@ia-legal`
- AnalistaExpedientesScreen
- RedactorEscritosScreen
- ChatIAScreen
- BuscadorJurisprudenciaScreen
- PredictorJudicialScreen
- Composables con WCAG (TalkBack, contraste)
- ViewModels con Hilt

**Tarea 7.5: Tests Compose UI**

```bash
@android crea tests UI
```

**Agente invocado**: `@android`
- Compose UI tests por screen
- ViewModel tests
- Integration tests
- Coverage >= 70%

#### Semana 10: Frontend polish

**Tarea 10.1: Audit de accesibilidad frontend**

```bash
@auditor-accesibilidad audita el frontend
```

**Agente invocado**: `@auditor-accesibilidad`
- Ejecuta axe-core en las 26 páginas
- Identifica issues WCAG 2.1 AA
- Genera reporte

**Tarea 10.2: Performance optimization**

```bash
@auditor-performance optimiza performance
```

**Agente invocado**: `@auditor-performance`
- Ejecuta Lighthouse en páginas clave
- Identifica cuellos de botella
- Optimiza bundle size
- Implementa lazy loading

**Tarea 10.3: Integración con backend**

```bash
@frontend integra con backend real
```

**Agente invocado**: `@frontend`
- Conecta `api/client.ts` con `legalpro-dotnet`
- Conecta `api/supabase.js` con `legalpro-node`
- Implementa retry logic
- Implementa error handling
- Implementa optimistic updates

**Salida Sprint 3**:
- ✅ Android con 5+ pantallas
- ✅ Android tests
- ✅ Frontend WCAG AA
- ✅ Frontend performance optimizado
- ✅ Integración backend completa

### 🔵 SPRINT 4: Producción (Semanas 11-12)

**Objetivo**: Deploy a producción y monitoreo.

#### Semana 11: Deploy a producción

**Tarea 11.1: Configurar producción**

```bash
@devops prepara producción
```

**Agente invocado**: `@devops`
- Configurar Railway services
- Configurar DNS
- Configurar SSL
- Configurar backups
- Configurar rotación de secrets

**Tarea 11.2: Ejecutar verificadores pre-release**

```bash
@release-manager ejecuta pre-release checks
```

**Agente invocado**: `@release-manager` + 3 auditores
- Ejecuta los 22 verificadores
- Auditoría legal
- Auditoría LPDP
- Auditoría de seguridad

**Tarea 11.3: Deploy gradual**

```bash
@release-manager deploy v1.0
```

**Agente invocado**: `@release-manager` + `@SRE`
- Canary deploy (10% → 50% → 100%)
- Smoke test en cada paso
- Monitoreo de SLOs
- Rollback plan activo

**Tarea 11.4: Post-mortem y ajustes**

```bash
@SRE activa monitoreo
```

**Agente invocado**: `@SRE`
- Configurar dashboards
- Configurar alertas
- Configurar on-call
- Documentar runbooks activos

#### Semana 12: Cierre y estabilización

**Tarea 12.1: Smoke test en producción**

```bash
@smoke-tester ejecuta smoke prod
```

**Agente invocado**: `@smoke-tester`
- Valida 5 roles demo
- Valida 16 herramientas IA
- Valida flujos críticos
- Reporta baseline

**Tarea 12.2: Journey test en producción**

```bash
@journey-tester ejecuta journeys prod
```

**Agente invocado**: `@journey-tester`
- Ejecuta los 18 E2E en producción
- Genera reporte

**Tarea 12.3: Capacitación a usuarios**

```bash
@product-owner prepara capacitación
```

**Agente invocado**: `@product-owner` + `@SoporteCliente`
- Crea tutoriales
- Crea videos
- Crea KB
- Prepara equipo de soporte

**Salida Sprint 4**:
- ✅ v1.0 en producción
- ✅ SLOs cumplidos
- ✅ 5 roles demo funcionales
- ✅ Soporte listo
- ✅ Runbooks activos

## 📋 Comandos OpenCode para Iniciar HOY

### Paso 1: Abrir el proyecto con OpenCode

```bash
cd c:\Users\Pc\Desktop\Abogacia
opencode
```

### Paso 2: Iniciar audit del estado actual

```
@product-owner genera un PRD para MVP v1.0 production-ready del proyecto LegalPro
```

### Paso 3: Revisar plan y priorizar

```
@arquitecto-chief revisa el PRD y prioriza el roadmap de 12 semanas
```

### Paso 4: Empezar Sprint 1

```
@devops inicia Sprint 1 configurando el entorno dev
```

## 🎯 Tareas Concretas para HOY (Día 1)

### 1. Audit del backend Node (1-2 horas)

```bash
@backend-node audita el estado actual de legalpro-app/server/
```

**Entregable**: Lista de gaps + plan de remediación.

### 2. Audit del backend .NET (1-2 horas)

```bash
@backend-dotnet audita el estado actual de LegalProBackend_Net/
```

**Entregable**: Lista de gaps + plan.

### 3. Audit del frontend (1-2 horas)

```bash
@frontend audita el estado actual de legalpro-app/src/
```

**Entregable**: Lista de gaps + plan.

### 4. Verificadores iniciales (30 min)

```bash
@auditor-seguridad ejecuta los 22 verificadores
```

**Entregable**: Reporte de compliance inicial.

### 5. Definir Sprint 1 (1 hora)

```bash
@planner-chief crea el plan detallado de Sprint 1
```

**Entregable**: Plan con tareas S/M/L/XL.

## 📁 Estructura de Archivos Clave a Modificar

| Archivo | Acción | Agente |
|---|---|---|
| `legalpro-app/server/init.sql` | Validar schema | @database |
| `legalpro-app/server/index.js` | Completar security | @backend-node |
| `legalpro-app/server/__tests__/` | Añadir tests | @backend-node |
| `LegalProBackend_Net/LegalPro.Api/Program.cs` | Producción config | @backend-dotnet |
| `LegalProBackend_Net/LegalPro.Infrastructure/BackgroundJobs/ProcessOutboxMessagesJob.cs` | Implementar | @backend-dotnet |
| `legalpro-app/src/App.jsx` | Integrar con backend | @frontend |
| `legalpro-owner-dashboard/server.js` | Mutaciones | @owner-admin |
| `LegalProAndroid/app/build.gradle.kts` | Configurar | @android |
| `.github/workflows/ci.yml` | Ejecutar 22 verificadores | @devops |

## ✅ Quality Gates por Sprint

### Sprint 1 (Validación)
- [ ] PRD firmado por @ProductOwner
- [ ] Reporte de audit completo
- [ ] DB con seed data funcional
- [ ] CI ejecutando 22 verificadores
- [ ] Smoke test básico OK

### Sprint 2 (Backend)
- [ ] Coverage .NET >= 80%
- [ ] Coverage Node >= 80%
- [ ] LPDP compliance 4/4
- [ ] Owner dashboard con mutaciones

### Sprint 3 (Mobile + Frontend)
- [ ] Android 5+ pantallas funcionales
- [ ] Android tests >= 70%
- [ ] Frontend WCAG 2.1 AA 100%
- [ ] Performance < SLOs

### Sprint 4 (Producción)
- [ ] 22 verificadores en verde
- [ ] Smoke prod OK
- [ ] 5 roles demo funcionales
- [ ] SLOs cumplidos
- [ ] On-call rotation lista

## 🎁 Comandos Útiles del Arnés

```bash
# Auditorías
/auditar-seguridad
/auditar-lpdp
/auditar-owasp
/review-pr

# Análisis legal
/analizar-expediente
/buscar-jurisprudencia
/calcular-plazos
/redactar-demanda
/simular-juicio
/predecir-resultado

# Liquidaciones
/liquidar-cts
/liquidar-tributario

# Operaciones
/crear-endpoint
/smoke-test
/monitor-sinoe
```

## 📞 Contactos y Responsables

| Rol | Agente | Responsable Humano |
|---|---|---|
| Veto final | `@abogado-chief` | @arquitecto-chief |
| Compliance LPDP | `@auditor-lpdp` | @gobernanza-chief |
| Security | `@auditor-seguridad` | @auditor-seguridad |
| Release | `@release-manager` | @release-manager |
| DevOps | `@devops` | @devops |
| SRE | `@SRE` | @SRE |

## 🚨 Riesgos y Mitigaciones

| Riesgo | Mitigación |
|---|---|
| MiniMax deprecation | `verifier-deprecation-modelos.mjs` |
| Tenant leak | `verifier-multi-tenant.mjs` + tests cross-tenant |
| LPDP breach | RB-010 + notificación ANPDP en <=5d |
| Spike de costo IA | `verifier-cost-spike.mjs` + alertas |
| Failure de MiniMax | Retry exponencial + circuit breaker |
| PostgreSQL down | RB-006 |

---

## 🎊 Conclusión

El proyecto está **sorprendentemente maduro**: ~80% de los stacks principales (Node, .NET, Frontend) están implementados. La brecha principal es **Android** (5%) y el **Owner Dashboard** (30%).

El arnés agentic con 90 agentes está **100% listo** para asistir en el desarrollo.

**Para empezar HOY**:

1. Abre el proyecto con OpenCode
2. Ejecuta `@product-owner genera PRD para MVP v1.0`
3. Sigue el plan de 12 semanas
4. Usa los 22 verificadores en cada PR
5. Celebra cuando llegues a producción

**¡Éxito en el camino a producción!** 🚀🇵🇪
