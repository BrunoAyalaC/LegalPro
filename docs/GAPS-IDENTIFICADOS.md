# Gaps Identificados — Estado Real vs Producción

> **Audit generado por**: @auditor-seguridad + @refutador-seguridad + @planner-chief
> **Fecha**: 2026-06-12
> **Contexto**: Para llegar a MVP Production-Ready v1.0

## 📊 Estado Real por Stack

### Backend .NET (90% implementado)

**Implementado**:
- ✅ Clean Architecture (Domain, Application, Infrastructure, Api)
- ✅ 18 controllers
- ✅ 40+ Commands/Queries (CQRS con MediatR)
- ✅ 6 Middleware (BruteForce, CorrelationId, ExceptionHandling, Masking, Security, Tenant)
- ✅ 6 Migrations (EF Core)
- ✅ 6 Tests (Unit + Integration)
- ✅ Pipeline Behaviors (Validation, Logging, Tenant, PlanLimits)
- ✅ JWT Auth + Claims-based RBAC
- ✅ Rate Limiting (sliding window)
- ✅ Serilog con masking de PII

**Gaps**:
- ⚠️ `ProcessOutboxMessagesJob` (BackgroundService) existe pero hay que validar que se ejecuta
- ⚠️ Tests de integración con TestAuthHandler (existe pero mejorar coverage)
- ⚠️ OpenAPI spec documentado (en Program.cs con Swagger) pero falta JSON spec persistido
- ⚠️ Pact contracts con Node no implementados

### Backend Node (80% implementado)

**Implementado**:
- ✅ Express 5 ESM con Helmet, CORS, Rate Limit
- ✅ 7 Routes (auth, organizaciones, datos-personales, ai, documentos, expedientes) — ruta `minimax` disponible
- ✅ 5 Middleware (auth, idempotency, promptSanitizer, quota, validate)
- ✅ 4 Repositories (Base, Mensaje, Organizacion, Token)
- ✅ 12 Tests (auth, documentos, evidencia, etc.)
- ✅ JWT con rotación de refresh
- ✅ Supabase SDK integration
- ✅ MiniMax integration con `minimaxClient.js`

**Gaps**:
- ⚠️ Repositorio de Documentos no existe (necesario)
- ⚠️ Repositorio de Expedientes no existe
- ✅ MiniMax adapter implementado
- ⚠️ Falta BCRP adapter (tasa legal)
- ⚠️ Falta SINOE adapter (mock-first)
- ⚠️ .env.example incompleto

### Frontend React (75% implementado)

**Implementado**:
- ✅ 26 Pages
- ✅ 35+ Components (UI, filters, modals, search, wizards)
- ✅ 10 Hooks
- ✅ 2 Contexts (Tenant, UI)
- ✅ IADisclaimerBanner y IADisclaimerModal
- ✅ AuthGuard con RBAC
- ✅ Lazy loading + Suspense
- ✅ TailwindCSS 4

**Gaps**:
- ⚠️ Integración real con backend (parcial)
- ⚠️ Tests E2E (existen 18 specs pero sin validar 100% verde)
- ⚠️ axe-core WCAG audit completo
- ⚠️ Bundle size optimization
- ⚠️ OpenAPI client generation

### Owner Dashboard (30% implementado)

**Implementado**:
- ✅ server.js con Bearer token
- ✅ E2EE (PBKDF2 100k + AES-256-GCM)
- ✅ Frontend con Web Crypto API
- ✅ Crypto test
- ✅ 5 KPIs básicos

**Gaps Críticos**:
- ❌ Sin mutaciones (solo lectura)
- ❌ Sin endpoints POST/PUT/DELETE
- ❌ Sin MFA
- ❌ Sin audit log estructurado
- ❌ Sin RBAC granular
- ❌ Sin paginación en lista de tenants
- ❌ Sin gráficos (Recharts instalado pero no usado)
- ❌ .env con secret por defecto (cambiar)

### Android (5% implementado)

**Implementado**:
- ✅ Estructura de Gradle
- ✅ Build outputs (APK debug)

**Gaps CRÍTICOS**:
- ❌ Sin código Kotlin/Compose
- ❌ Sin Hilt setup
- ❌ Sin Retrofit
- ❌ Sin Supabase SDK
- ❌ Sin EncryptedSharedPreferences
- ❌ Sin Room
- ❌ Sin Navigation Compose
- ❌ Sin screens
- ❌ Sin ViewModels
- ❌ Sin tests Compose UI

**Estimación**: 4 semanas para llegar al 100% con 5+ pantallas.

## 🛡️ Compliance Gaps

### LPDP
- ✅ Tabla `consentimientos` existe
- ✅ Columna `acepta_transferencia_internacional` existe
- ✅ Endpoints ARCO existen en `datos-personales.js`
- ⚠️ Falta validar que ARCO_RESPONSE cumple plazo de 8 días
- ⚠️ Falta validar breach notification en <= 5 días hábiles

### Firma Digital (Ley 27269)
- ✅ Hash SHA-256 documentado
- ⚠️ Implementación de PKCS#7 no existe
- ⚠️ TSA (timestamp authority) no integrada
- ⚠️ PSC (prestador de servicios de certificación) no seleccionado

### OWASP
- ✅ Helmet con CSP estricta
- ✅ Brute force protection
- ✅ RLS (a través de organization_id)
- ⚠️ Auditoría de Type Juggling pendiente
- ⚠️ Auditoría de Mass Assignment pendiente

## 🔧 Gaps de Infraestructura

- ⚠️ CI ejecuta algunos tests pero no todos los 25 verificadores
- ⚠️ Falta Pact broker
- ⚠️ Falta OpenAPI specs persistidos (solo Swagger UI)
- ⚠️ Falta Datadog/Sentry (logging local)
- ⚠️ DNS/SSL no configurado
- ⚠️ Backup strategy no implementada

## 📋 Gaps de Documentación

- ⚠️ PRD MVP (este documento)
- ⚠️ API docs OpenAPI persistido
- ⚠️ Runbooks (20 documentos, faltan 14)
- ⚠️ Architecture diagrams (ADRs)
- ⚠️ Onboarding para nuevos devs
- ⚠️ Tutoriales en video

## 🎯 Top 10 Prioridades para Sprint 1

| # | Gap | Severidad | Esfuerzo | Owner |
|---|---|---|---|---|
| 1 | Crear PRD MVP | Alta | Bajo | @product-owner |
| 2 | Validar init.sql completo | Alta | Bajo | @database |
| 3 | Crear seed data | Alta | Bajo | @database |
| 4 | Repos Node faltantes | Media | Medio | @backend-node |
| 5 | .env.example completo | Alta | Bajo | @devops |
| 6 | CI con 25 verificadores | Alta | Medio | @devops |
| 7 | Owner Dashboard mutaciones | Alta | Alto | @owner-admin |
| 8 | MFA owner | Alta | Medio | @owner-admin |
| 9 | Tests Android | Crítica | Alto | @android |
| 10 | Smoke test baseline | Alta | Medio | @smoke-tester |

## 🔍 Análisis de los Refutadores

### @refutador-seguridad
**Riesgos identificados**:
- Posible mass assignment en controllers .NET
- Race conditions en transacciones Node
- Type juggling en JSON parsing
- IDOR enumeration sin tenant validation explícita
- Timing attack en token comparison

### @refutador-arquitectura
**Anti-patrones identificados**:
- God class en algunos services
- Acoplamiento fuerte a Supabase (necesita adapters)
- Falta Circuit Breaker
- Falta Bulkhead pattern
- Falta Rate Limiting por usuario (no solo IP)

### @refutador-performance
**Riesgos identificados**:
- Sin índices en algunas queries
- N+1 en listados de expedientes
- Bundle size no auditado
- Sin lazy loading explícito
- Sin connection pooling optimizado

## ✅ Plan de Acción Sprint 1

### Semana 1
1. ✅ PRD MVP v1.0 (este documento)
2. ⏳ Audit completo con 25 verificadores
3. ⏳ Documentar gaps restantes
4. ⏳ Crear .env.example completo
5. ⏳ Seed data para 3 organizaciones demo

### Semana 2
1. ⏳ Implementar Repos Node faltantes
2. ⏳ Crear CI con 25 verificadores
3. ⏳ Smoke test baseline
4. ✅ Adapters MiniMax/BCRP/SINOE
5. ⏳ Revisar remediation de refutadores

## 🎯 Criterio de "Listo para Sprint 2"

- [ ] Los 25 verificadores ejecutan (algunos pueden fallar, pero ejecutan)
- [ ] Smoke test pasa en staging
- [ ] .env.example completo
- [ ] Seed data funcional
- [ ] ADRs firmados para decisiones arquitectónicas pendientes
