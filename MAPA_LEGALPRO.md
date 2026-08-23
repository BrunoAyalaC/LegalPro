# MAPA MAESTRO LEGALPRO / LexIA Perú
## Índice Completo del Sistema, Arquitectura, Servicios y Auditoría

> **Versión:** 1.0.0  
> **Fecha de consolidación:** 1 de agosto de 2026  
> **Propósito:** Mapa único, indexado y verificable de TODO el sistema LegalPro  
> **Origen:** Auditoría exhaustiva con subagentes especializados (arquitecto-chief, auditor-seguridad, auditor-lpdp, auditor-multi-tenant) + exploración directa del repositorio

---

## 📑 ÍNDICE RÁPIDO

| # | Sección | Contenido |
|---|---------|-----------|
| 1 | [Resumen Ejecutivo](#1-resumen-ejecutivo) | Visión general + scores |
| 2 | [Stack Tecnológico Completo](#2-stack-tecnológico-completo) | Lenguajes, frameworks, librerías, servicios |
| 3 | [Topología del Sistema](#3-topología-del-sistema) | Diagrama de despliegue |
| 4 | [Estructura del Repositorio](#4-estructura-del-repositorio) | Árbol de carpetas |
| 5 | [Backend Node.js (Express 5)](#5-backend-nodejs-express-5) | 50+ endpoints, servicios, middlewares |
| 6 | [Backend .NET 9 (Clean Architecture)](#6-backend-net-9-clean-architecture) | 48+ endpoints, capas, CQRS |
| 7 | [Frontend React 19 + Vite](#7-frontend-react-19--vite) | 35+ páginas, 40+ componentes |
| 8 | [Android (Kotlin + Compose)](#8-android-kotlin--compose) | Arquitectura, pantallas, herramientas IA |
| 9 | [Owner Dashboard](#9-owner-dashboard) | Servidor aislado con E2EE |
| 10 | [Base de Datos PostgreSQL/Supabase](#10-base-de-datos-postgresqlsupabase) | 16+ tablas, RLS, migraciones |
| 11 | [Servicios de Inteligencia Artificial](#11-servicios-de-inteligencia-artificial) | OpenCode Go / DeepSeek V4 Flash, MiMo V2.5, MiniMax M3, paneles |
| 12 | [Multi-Tenant y Aislamiento](#12-multi-tenant-y-aislamiento) | Estrategia y riesgos |
| 13 | [Seguridad Implementada](#13-seguridad-implementada) | OWASP, JWT, rate limit, MFA |
| 14 | [Cumplimiento LPDP (Ley 29733)](#14-cumplimiento-lpdp-ley-29733) | Compliance peruano |
| 15 | [Observabilidad y Auditoría](#15-observabilidad-y-auditoría) | Logs, Sentry, audit log |
| 16 | [Deploy y DevOps](#16-deploy-y-devops) | Railway, Docker, CRON |
| 17 | [Auditorías Realizadas (Consolidado)](#17-auditorías-realizadas-consolidado) | Hallazgos de los 4 subagentes |
| 18 | [Archivos Basura Identificados](#18-archivos-basura-identificados) | Para limpieza |
| 19 | [Recomendaciones Priorizadas](#19-recomendaciones-priorizadas) | P0/P1/P2 |
| 20 | [Métricas del Orquestador](#20-métricas-del-orquestador) | Costos, tokens, latencias |

---

## 1. RESUMEN EJECUTIVO

### 🎯 ¿Qué es LegalPro?

**LegalPro (LexIA Perú)** es una plataforma SaaS legal multi-tenant para el mercado peruano, diseñada para abogados, fiscales, jueces y contadores. Utiliza IA generativa (OpenCode Go / DeepSeek V4 Flash + MiniMax M3) para asistir en:

- **Análisis de expedientes** con extracción de hechos, pruebas y base legal
- **Redacción de escritos legales** (demandas, contestaciones, amparos, casaciones)
- **Búsqueda de jurisprudencia** en 5 fuentes oficiales (PJ, TC, INDECOPI, SUNARP, MINJUSDH)
- **Predicción de resultados judiciales** (con disclaimers explícitos)
- **Simulación de juicios** con IA como contraparte
- **Liquidaciones laborales** (CTS, gratificaciones, vacaciones)
- **Generación de alegatos, interrogatorios y objeciones**
- **Bóveda de evidencia digital** con SHA-256 y firma digital
- **Monitoreo del SINOE** (notificaciones electrónicas del Poder Judicial)
- **Panel de expertos legales** multi-agente (cascada de subagentes especializados)

### 📊 Scores de las Auditorías (31 julio 2026)

| Dimensión | Score | Veredicto |
|---|:-:|---|
| **Arquitectura** | 65/100 | DUAL BACKEND problemático sobre la misma BD |
| **Seguridad OWASP** | 78/100 | Aprobado staging, bloqueado producción LPDP |
| **LPDP (Ley 29733)** | 70/100 | Cumple formal, brechas sustantivas |
| **Multi-Tenant** | **58/100** | ⚠️ Riesgo ALTO — fail-open en EF Core |
| **Cobertura verificadores** | 56% OWASP Top 10 | 26/29 verificadores aplicables |

### 🚦 Estado de Go-Live

🟡 **APROBADO PARA STAGING**  
🔴 **BLOQUEADO PARA PRODUCCIÓN CON DATOS REALES LPDP** hasta resolver:
- 3 críticos (Owner Dashboard SSL, Stripe timing attack, secrets placeholder)
- 3 críticos multi-tenant (filtro EF Core fail-open, ITenantEntity incompleto, RLS no garantizado)
- 4 LPDP (DPO no designado, etiquetado IA inconsistente, revocación limitada, /api/legal/* sin guard)

**Tiempo estimado de remediación:** ~16 horas de desarrollo.

---

## 2. STACK TECNOLÓGICO COMPLETO

### 🖥️ Backend Node.js (`legalpro-app/server`)

| Componente | Tecnología | Versión |
|---|---|---|
| Runtime | Node.js | 20.x (ESM) |
| Framework | Express | 5.2.1 |
| Autenticación | JWT (`jsonwebtoken`) + Supabase Auth | 9.0.3 / 2.50.0 |
| Hashing | bcryptjs | 3.0.3 |
| Validación | Zod | 4.4.3 |
| Rate limiting | express-rate-limit | 8.3.1 |
| Seguridad HTTP | Helmet | 8.1.0 |
| CORS | cors | 2.8.6 |
| Compresión | compression | 1.8.1 |
| DB driver | pg (node-postgres) | 8.20.0 |
| Cache | ioredis | 5.10.1 |
| Upload | multer | 2.1.1 |
| OCR/HTML→PDF | puppeteer, html2pdf.js | 24.42 / 0.14 |
| Office | docx, xlsx | 9.6.1 / 0.18.5 |
| Sanitización HTML | dompurify | 3.3.3 |
| Observabilidad | @sentry/node, @sentry/profiling-node | 10.58.0 |
| Pagos | stripe (webhook handler) | - |
| CRON | node-cron | 3.0.3 |
| Cliente IA | minimax SDK (custom) | - |

### 🖥️ Backend .NET 9 (`LegalProBackend_Net`)

| Componente | Tecnología | Versión |
|---|---|---|
| Runtime | .NET | 9.0 |
| Framework Web | ASP.NET Core MVC | 9.0 |
| ORM | Entity Framework Core | 9.0 |
| CQRS | MediatR | (última) |
| Validación | FluentValidation | (última) |
| Logging | Serilog + custom masking formatter | - |
| Auth | JWT Bearer | - |
| Rate limiting | ASP.NET Rate Limiter (built-in) | .NET 7+ |
| Health Checks | AspNetCore.HealthChecks | built-in |
| Swagger | Swashbuckle | (última) |
| DB Provider | Npgsql | (última) |

**Capas (Clean Architecture + DDD):**
- `LegalPro.Api` → Controllers + Middlewares
- `LegalPro.Application` → Commands/Queries (CQRS) + Behaviors
- `LegalPro.Domain` → Entities + Value Objects + Events + Exceptions
- `LegalPro.Infrastructure` → EF Core + Servicios + Migraciones
- `LegalPro.UnitTests` + `LegalPro.IntegrationTests` → Tests

### 🎨 Frontend React (`legalpro-app/src`)

| Componente | Tecnología | Versión |
|---|---|---|
| Framework | React | 19.2.0 |
| Build | Vite | 7.3.1 |
| Routing | React Router DOM | 7.13.1 |
| Estilos | TailwindCSS 4 + PostCSS | 4.2.1 |
| Componentes UI | Custom (NO Material/Ant) | - |
| Animaciones | Framer Motion | 12.36.0 |
| Iconos | @heroicons/react, lucide-react, react-icons | varios |
| HTTP | axios | 1.7.0 |
| Gráficos | recharts, @tsparticles/react | 3.8 / 3.0 |
| Forms | (built-in React Hooks) | - |
| State global | Context (UIContext, TenantContext) | - |
| a11y | eslint-plugin-jsx-a11y | 6.10.0 |
| Testing | Vitest + @testing-library | 4.1.0 |
| E2E | Playwright + @axe-core/playwright | 1.58.2 / 4.10.0 |
| Documentación | Storybook | 8.4.0 |

### 📱 Android (`LegalProAndroid`)

| Componente | Tecnología | Versión |
|---|---|---|
| Lenguaje | Kotlin | 2.x |
| UI | Jetpack Compose + Material 3 | (última) |
| DI | Hilt | (última) |
| Async | Coroutines + Flow | (última) |
| Networking | Retrofit + OkHttp | (última) |
| Persistencia | Room + EncryptedSharedPreferences | (última) |
| Auth | Supabase Kotlin SDK + Cookie persistence | (última) |
| Build | Gradle KTS | (última) |

### 🗄️ Base de Datos

| Componente | Tecnología | Notas |
|---|---|---|
| DB principal | PostgreSQL 15+ (Supabase) | RLS habilitado |
| Auth | Supabase Auth | MFA TOTP RFC 6238 |
| Storage | Supabase Storage | Documentos + evidencia |
| Cache | Redis (opcional) | ioredis 5.10.1 |
| Pagos | Stripe | Webhooks |

### ☁️ Servicios Externos

| Servicio | Propósito | Compliance |
|---|---|---|
| **OpenCode Go (DeepSeek V4 Flash)** | IA principal OPENCODE-FIRST (generación, RAG, jurisprudencia, razonamiento) | Transferencia internacional (LPDP Art. 21) |
| **MiMo V2.5 (Xiaomi)** | Visión/OCR multimodal | Transferencia internacional (LPDP Art. 21) |
| **MiniMax M3** | IA secundaria (legacy + compatibilidad) | Transferencia internacional (LPDP Art. 21) |
| ~~Google Gemini~~ | ~~IA secundaria~~ — **ELIMINADO (2026-08-01)** | — |
| **Stripe** | Pagos recurrentes (planes PRO/ENTERPRISE) | PCI-DSS |
| **Culqi** | Pagos Perú (suscripciones locales) | PCI-DSS local |
| **Sentry** | APM + Error tracking | DPF firmado |
| **Railway** | Hosting multi-servicio | ISO 27001 |
| **Supabase** | BaaS (Auth, DB, Storage) | SOC 2 |

---

## 3. TOPOLOGÍA DEL SISTEMA

### 🌐 Diagrama de despliegue Railway

```
┌─────────────────────────────────────────────────────────────────────┐
│                        RAILWAY PLATFORM                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────┐    ┌──────────────────────────┐           │
│  │  Landing Page        │    │  Frontend Web (React 19) │           │
│  │  (lexia-landing)     │    │  legalpro-app            │           │
│  │  Puerto 5174         │    │  Puerto 5173             │           │
│  │  nginx + Vite SSR    │    │  nginx + Vite SSG        │           │
│  └──────────────────────┘    └──────────────────────────┘           │
│                                       │                              │
│                                       │ HTTPS                       │
│                                       ▼                              │
│  ┌──────────────────────┐    ┌──────────────────────────┐           │
│  │  Backend Node.js     │◄──►│  Backend .NET 9          │           │
│  │  legalpro-app/server │    │  LegalProBackend_Net     │           │
│  │  Puerto 3001         │    │  Puerto 5000             │           │
│  │  Express 5 + ESM     │    │  ASP.NET Core + EF Core  │           │
│  └──────────────────────┘    └──────────────────────────┘           │
│           │                              │                            │
│           │                              │                            │
│           ▼                              ▼                            │
│  ┌──────────────────────────────────────────────────┐                │
│  │       PostgreSQL 15 (Supabase compartido)        │                │
│  │       + Row Level Security (RLS) habilitado      │                │
│  │       + Migraciones: init.sql + EF Migrations    │                │
│  └──────────────────────────────────────────────────┘                │
│           │                                                           │
│           ▼                                                           │
│  ┌──────────────────────┐                                             │
│  │  Supabase Storage    │ (documentos, evidencia, firmas)            │
│  │  Supabase Auth       │ (MFA, OAuth, JWT)                          │
│  └──────────────────────┘                                             │
│                                                                      │
│  ┌──────────────────────┐    ┌──────────────────────────┐           │
│  │  Owner Dashboard     │    │  Android App              │           │
│  │  (Aislado, E2EE)     │    │  (Kotlin/Compose)         │           │
│  │  Puerto 3005         │    │  Multi-rol                │           │
│  │  E2EE AES-256-GCM    │    │  Supabase SDK + Retrofit  │           │
│  │  + PBKDF2(100k)      │    │  Room cache               │           │
│  └──────────────────────┘    └──────────────────────────┘           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
            │                                  │
            ▼                                  ▼
   ┌─────────────────────┐         ┌─────────────────────┐
   │  MiniMax M3 API     │         │  Google Gemini API  │
   │  (IA principal)     │         │  (IA secundaria)    │
   └─────────────────────┘         └─────────────────────┘
            │
            ▼
   ┌─────────────────────┐
   │  Stripe + Culqi     │
   │  (Pagos recurrentes)│
   └─────────────────────┘
```

### 🔐 Capas de seguridad (defense in depth)

```
┌─────────────────────────────────────────────────┐
│ Layer 1: Cloudflare/DNS                        │
│   └─ DDoS protection, WAF, TLS 1.3              │
├─────────────────────────────────────────────────┤
│ Layer 2: Railway Network                       │
│   └─ VPC, private networking, env vars          │
├─────────────────────────────────────────────────┤
│ Layer 3: Helmet + CORS + Rate Limiting          │
│   └─ Security headers, CORS policy, 429s        │
├─────────────────────────────────────────────────┤
│ Layer 4: Brute Force + Idempotency              │
│   └─ Login lockout, retry protection            │
├─────────────────────────────────────────────────┤
│ Layer 5: JWT + Tenant Middleware                │
│   └─ Auth + organization_id propagation         │
├─────────────────────────────────────────────────┤
│ Layer 6: Anti-IDOR Middleware                   │
│   └─ Validates :id belongs to organization      │
├─────────────────────────────────────────────────┤
│ Layer 7: Zod/FluentValidation                   │
│   └─ Input sanitization, schema validation      │
├─────────────────────────────────────────────────┤
│ Layer 8: Repository Pattern (Node)              │
│   └─ Manual WHERE organization_id = $tenant     │
├─────────────────────────────────────────────────┤
│ Layer 9: EF Core Global Query Filter (.NET)     │
│   └─ ⚠️ FAIL-OPEN cuando tenant es null         │
├─────────────────────────────────────────────────┤
│ Layer 10: PostgreSQL Row Level Security         │
│   └─ ⚠️ Requiere rol NOBYPASSRLS + FORCE RLS   │
└─────────────────────────────────────────────────┘
```

---

## 4. ESTRUCTURA DEL REPOSITORIO

```
C:\Users\Pc\Desktop\Abogacia\
│
├─── 📁 .github/                          # GitHub config + governance + skills
│    ├─── governance/                      # CHANGE-MANAGEMENT, CODE_OF_CONDUCT, COMPLIANCE-MAPPING
│    ├─── instructions/                    # android-compose, dotnet-cqrs, legal-prompts
│    ├─── skills/                          # 9 skills oficiales (analizar-expediente, configurar-gemini, etc.)
│    ├─── AGENTS_GUIDE.md
│    └─── copilot-instructions.md
│
├─── 📁 .opencode/                        # Orquestador de agentes IA (96 subagentes)
│    ├─── agents/                          # 96 archivos .md (1 orchestrator + 95 subagentes)
│    ├─── commands/                        # 14 slash commands
│    ├─── prompts/                         # 19 prompts especializados
│    ├─── rules/                           # 16 reglas de programación
│    ├─── skills/                          # 17 skills RAG-optimizadas
│    ├─── PLAN_PRODUCCION.md
│    └─── README.md
│
├─── 📁 arneses/                          # Sistema de arneses operacionales
│    ├─── fixtures/                        # Datos de prueba
│    ├─── hooks/                           # 9 git hooks (pre-commit, pre-push, commit-msg)
│    ├─── registry/                        # ADRs (3) + CHANGELOG + 6 reportes de refutadores
│    ├─── reports/                         # Reportes de refutadores (arquitectura, legal, lpdp, etc.)
│    ├─── runbooks/                        # 21 runbooks operacionales (RB-001 a RB-021)
│    ├─── templates/                       # 6 templates (ADR, AGENT, ISSUE, PR, PRD, RUNBOOK, SKILL)
│    └─── CHANGELOG.md
│
├─── 📁 catalogs/                         # Catálogos canónicos (single source of truth)
│    ├─── codigos-leyes.json               # 20 leyes peruanas
│    ├─── plazos-procesales.json           # 17 plazos procesales
│    ├─── tipos-penales-peru.json          # 25 tipos penales
│    ├─── delitos-economicos.json          # 16 delitos económicos
│    ├─── disclaimers-ia.json              # 13 disclaimers IA obligatorios
│    ├─── feriados-peru.json               # Feriados nacionales Perú
│    ├─── reguladores-peru.json            # 13 reguladores peruanos
│    ├─── minimax-functions.json           # Funciones MiniMax SDK
│    ├─── opencode-functions.json          # Funciones OpenCode Go / DeepSeek V4 Flash ⭐
│    ├─── gemini-functions.json            # Funciones Gemini SDK (⛔ Gemini ELIMINADO 2026-08)
│    ├─── audit-events.json                # Eventos auditables
│    ├─── adaptadores.json                 # Patrón Adapter (Hexagonal)
│    ├─── contratos.json                   # Contratos
│    ├─── jerarquia-especialistas.json     # Jerarquía abogados
│    ├─── owner-dashboard.json             # Métricas Owner
│    ├─── role-tools.json                  # Herramientas por rol
│    ├─── schemas/                         # JSON Schemas validación
│    ├─── CODEOWNERS
│    ├─── dependabot.yml
│    ├─── env-vars.md                      # Variables de entorno documentadas
│    ├─── glosario-juridico.md             # Glosario legal
│    ├─── owasp-mapping.md                 # Mapeo OWASP Top 10
│    ├─── release-policy.md                # Política de releases
│    ├─── security-policy.md               # Política de seguridad
│    ├─── sla-slo.md                       # SLOs/SLAs
│    └─── supabase-schema.md               # Schema DB canónico
│
├─── 📁 deploy-staging/                   # Snapshot staging (duplica legalpro-app)
│
├─── 📁 docs/                             # Documentación ejecutiva
│    ├─── AVANCE_PRODUCTION_READINESS_v1.md
│    ├─── CHECKLIST-PRE-PRODUCCION.md
│    ├─── GAPS-IDENTIFICADOS.md
│    ├─── PLAN-ACCION-INTEGRAL.md
│    ├─── PLAN-ORQUESTACION-AGENTES.md
│    ├─── PRD-MVP-PRODUCTION.md
│    ├─── REGISTRO_TRATAMIENTO_LPDP.md
│    ├─── SECRET_ROTATION_CHECKLIST.md
│    ├─── SECRET_ROTATION_PLAN.md
│    ├─── STAGING_SETUP.md
│    └─── TRANSFERENCIA_INTERNACIONAL.md
│
├─── 📁 exposicion/                       # Material de exposición (presentación)
│
├─── 📁 IconosLegalPro/                   # Assets de iconos
│
├─── 📁 landing_lexia/                    # Landing page adicional (lexia-landing)
│    ├─── package.json                    # React 18 + Vite 5 + Framer 11
│    └─── ... landing estática
│
├─── 📁 legalpro-app/                     # ═══ APP PRINCIPAL ═══
│    ├─── server/                         # Backend Node.js Express 5
│    │    ├─── adapters/                  # Patrón Adapter (Culqi)
│    │    ├─── core/                      # Container, EventBus, CqrsBus, Result, Logger, Decorators
│    │    ├─── middleware/                # 10 middlewares (auth, tenant, brute, idempotency, etc.)
│    │    ├─── repositories/              # 6 repositories (Base, Documento, Expediente, etc.)
│    │    ├─── routes/                    # 16 routers (auth, ai, clientes, etc.)
│    │    ├─── schemas/                   # 4 Zod schemas
│    │    ├─── services/                  # Servicios de aplicación
│    │    ├─── utils/                     # audit, jwt, minimaxClient, feriados, resilience
│    │    ├─── webhooks/                  # Stripe handler
│    │    ├─── __tests__/                 # 16 archivos de tests
│    │    ├─── auth-mfa.js                # MFA TOTP
│    │    ├─── cache.js + cache-redis.js  # Cache con fallback
│    │    ├─── cron-jobs.js               # node-cron
│    │    ├─── db.js                      # Pool + tenantQuery() con AsyncLocalStorage
│    │    ├─── index.js                   # ⭐ Entry point (482 líneas)
│    │    ├─── init.sql                   # Schema completo + RLS
│    │    ├─── initDb.js
│    │    ├─── legal-orchestrator.js      # Multi-agente legal
│    │    ├─── legal-router.js
│    │    ├─── logger.js + sentry.js
│    │    ├─── seed.mjs                   # Seed datos demo
│    │    ├─── smoke-production.mjs
│    │    └─── supabase.js
│    │
│    ├─── src/                            # Frontend React 19
│    │    ├─── api/                       # client.ts (axios + helpers)
│    │    ├─── assets/                    # icons/, backgrounds/, empty-states/, avatar/
│    │    ├─── components/                # 40+ componentes organizados
│    │    │    ├─── ui/                   # Button, Modal, Drawer, Toast, Switch, Tag, etc.
│    │    │    ├─── legal/                # ExpedienteCard, TimelineEvent, AIAssistantPanel
│    │    │    ├─── charts/               # ActivityAreaChart, MateriaPieChart
│    │    │    ├─── filters/              # FilterBar, FilterPanel, FilterChip, DateRangePicker
│    │    │    ├─── modals/               # ConfirmModal, Lightbox
│    │    │    ├─── search/               # SearchInput, SearchResults
│    │    │    ├─── onboarding/           # OnboardingTour
│    │    │    ├─── wizards/              # WizardShell
│    │    │    ├─── AppIcon, AuthGuard, BottomNav, CommandPalette, EmptyState,
│    │    │    │    ErrorBoundary, Header, IADisclaimerBanner, IADisclaimerModal,
│    │    │    │    Layout, Sidebar, TopBar
│    │    ├─── constants/
│    │    ├─── context/                   # TenantContext, UIContext
│    │    ├─── data/                      # sprite-icons
│    │    ├─── hooks/                     # useSeo, index
│    │    ├─── pages/                     # ⭐ 35+ páginas (rutas)
│    │    ├─── types/
│    │    ├─── utils/                     # documents, logger, utf8
│    │    ├─── App.jsx, main.jsx
│    │    └─── index.css, App.css
│    │
│    ├─── docs/                           # POLITICA_PRIVACIDAD.md, TERMINOS_CONDICIONES.md
│    ├─── e2e/                            # Playwright E2E
│    ├─── tests/                          # Tests unitarios
│    ├─── tools/                          # legal-catalog-updater, backup
│    ├─── public/                         # landing/, terminos.html, privacidad.html
│    ├─── nginx.conf, Dockerfile
│    ├─── package.json (v6.10.1)
│    └─── README.md
│
├─── 📁 legalpro-owner-dashboard/         # Dashboard Owner (aislado, E2EE)
│    ├─── server.js                       # ⭐ Express 4 con E2EE AES-256-GCM
│    ├─── migrations-v2.js
│    ├─── crypto.test.js + crypto.test.mjs
│    ├─── public/                         # UI estática (login + dashboard)
│    ├─── Dockerfile
│    └─── package.json (v6.9.2)
│
├─── 📁 LegalProAndroid/                  # Android Kotlin/Compose
│    ├─── app/src/main/java/com/legalpro/app/
│    │    ├─── core/session/              # SessionManager
│    │    ├─── data/
│    │    │    ├─── local/                # Room (AppDatabase, DAOs, Entities)
│    │    │    ├─── remote/               # Retrofit (LegalProApi, DTOs)
│    │    │    └─── repository/
│    │    ├─── di/                        # Hilt modules (DatabaseModule, NetworkModule, SupabaseModule)
│    │    ├─── domain/                    # Use cases
│    │    ├─── presentation/
│    │    │    ├─── auth/                 # LoginScreen + ViewModel
│    │    │    ├─── theme/                # ResponsiveValues
│    │    │    └─── tools/                # 7 pantallas IA (analyst, audiencia, panelexpertos, predictor, redactor, reports, simulator)
│    └─── build/, hs_err_pid55396.log ⚠️
│
├─── 📁 LegalProBackend_Net/              # Backend .NET 9
│    ├─── LegalPro.Api/                   # 17 Controllers + 6 Middlewares + Program.cs
│    ├─── LegalPro.Application/           # CQRS (Commands/Queries) + Behaviors + 13 Interfaces
│    ├─── LegalPro.Domain/                # 13 Entities + Value Objects + Events + Exceptions
│    ├─── LegalPro.Infrastructure/        # EF Core + Services + 8 Migraciones
│    ├─── LegalPro.UnitTests/             # Tests unitarios
│    ├─── LegalPro.IntegrationTests/      # Tests de integración
│    ├─── Dockerfile, railway.toml
│    └─── LegalPro.sln
│
├─── 📁 pacts/                            # Pact contract testing
│
├─── 📁 public/                           # Assets públicos raíz
│
├─── 📁 reports/                          # Reportes de auditoría ejecutados
│    ├─── auditoria-lpdp-2026-06-28.md
│    ├─── auditoria-multitenant-rls-2026-06-28.md
│    ├─── auditoria-red-team-2026-06-12.md
│    ├─── coverage-audit.md
│    ├─── OWASP-AUDIT-2026-06-28.md
│    └─── verifiers-run-2026-06-27/results.txt
│
├─── 📁 tools/                            # Herramientas operacionales
│    ├─── audit-ui-prod.mjs               # Auditorías UI en producción
│    ├─── check-bundle-api.mjs            # Verificación bundle
│    ├─── debug-*.mjs                     # Scripts de debug
│    ├─── legal-catalog-updater.mjs
│    ├─── run-opencode-harness.mjs
│    ├─── smoke-dotnet-prod.mjs
│    ├─── verify-lpdp-prod.mjs
│    ├─── backup/                         # backup.sh + restore.sh + README
│    ├─── railway/                        # legalpro-ops.ps1 + set-docker-image.mjs
│    ├─── release/                        # 8 scripts (build, deploy, sign, rotate)
│    ├─── seed/                           # 7 scripts (cleanup, inspect, patch, reset)
│    └─── verifiers/                      # 29 verificadores automáticos ⭐
│
├─── ARNÉS_AGENTIC_PLAN.md                # Plan maestro del arnés agentic
├─── build-and-tag.ps1
├─── docker-compose.yml
├─── Dockerfile.frontend
├─── nginx.conf + nginx.railway-frontend.conf
├─── opencode.json                        # Config del orquestador de agentes
├─── package.json (lexia-landing v1.0.0)
├─── smoke-production.mjs
├─── test-prod-debug.mjs
├─── vite.config.js + tailwind.config.js + postcss.config.js + tsconfig.json
├─── index.html
│
├─── ⚠️ ARCHIVOS BASURA IDENTIFICADOS (ver sección 18):
│    - datos.txt
│    - errorabogacia.txt
│    - ESTADO-REAL.md (legacy)
│    - MEGA_DOC.md (legacy)
│    - diagnose-login.mjs
│    - chat-page.png, login-page.png, frontend-root.png, landing-full.png (screenshots viejos)
│    - legalpro-app/_diag3.mjs
│    - legalpro-app/nginx.conf.bak.6.9.3
│    - hs_err_pid55396.log + replay_pid55396.log (crashes JVM viejos)
│    - report-results-old/
│
```

---

## 5. BACKEND NODE.JS (Express 5)

**Puerto:** 3001  
**Archivo entry:** `legalpro-app/server/index.js` (482 líneas)  
**Configuración de seguridad:** Helmet + CORS + 4 Rate Limiters + Brute Force + Idempotency + JWT + Tenant

### 📋 Endpoints completos del Backend Node.js

#### 🔐 Autenticación (`/api/auth/*`)

| Método | Ruta | Auth | Middlewares | Descripción |
|---|---|---|---|---|
| POST | `/api/auth/register` | ❌ | authLimiter + idempotency | Registro de usuario |
| POST | `/api/auth/login` | ❌ | authLimiter | Login tradicional |
| POST | `/api/auth/login` | ❌ | bruteForce | Login MFA |
| POST | `/api/auth/login/mfa` | ❌ | - | Verificar TOTP MFA |
| POST | `/api/auth/refresh` | ❌ | - | Refresh JWT |
| POST | `/api/auth/logout` | ❌ | - | Logout |
| GET | `/api/auth/me` | ✅ | authMiddleware | Usuario actual |
| POST | `/api/auth/change-password` | ✅ | authMiddleware | Cambio password |
| POST | `/api/auth/forgot-password` | ❌ | - | Recuperación password |
| DELETE | `/api/auth/cuenta` | ✅ | authMiddleware | Eliminar cuenta |
| POST | `/api/auth/mfa/setup` | ✅ | authMiddleware | Setup TOTP |
| POST | `/api/auth/mfa/verify-enable` | ✅ | authMiddleware | Activar MFA |
| POST | `/api/auth/mfa/verify` | ❌ | - | Verificar código |
| POST | `/api/auth/mfa/disable` | ✅ | authMiddleware | Desactivar MFA |

#### 🏢 Organizaciones (`/api/organizaciones/*`)

| Método | Ruta | Auth | Middlewares | Descripción |
|---|---|---|---|---|
| POST | `/api/organizaciones` | ✅ | authMiddleware + idempotency + validate | Crear organización |
| GET | `/api/organizaciones/me` | ✅ | authMiddleware + tenantMiddleware | Mi organización |
| GET | `/api/organizaciones/me/miembros` | ✅ | authMiddleware + tenantMiddleware | Listar miembros |
| POST | `/api/organizaciones/invitar` | ✅ | authMiddleware + tenantMiddleware + requireRole(['OWNER','ADMIN']) | Invitar miembro |
| POST | `/api/organizaciones/aceptar-invitacion` | ✅ | authMiddleware | Aceptar invitación |
| DELETE | `/api/organizaciones/me/miembros/:targetUserId` | ✅ | authMiddleware + tenantMiddleware + requireRole(['OWNER','ADMIN']) | Remover miembro |

#### 👥 Clientes (`/api/clientes/*`)

| Método | Ruta | Auth | Middlewares | Descripción |
|---|---|---|---|---|
| GET | `/api/clientes` | ✅ | requireTenantAccess('/api/clientes/:id') | Listar clientes |
| GET | `/api/clientes/:id` | ✅ | requireTenantAccess | Cliente por ID |
| POST | `/api/clientes` | ✅ | requireTenantAccess | Crear cliente |
| PUT | `/api/clientes/:id` | ✅ | requireTenantAccess | Actualizar cliente |
| DELETE | `/api/clientes/:id` | ✅ | requireTenantAccess | Eliminar cliente |

#### 📁 Expedientes (`/api/expedientes/*`)

| Método | Ruta | Auth | Middlewares | Descripción |
|---|---|---|---|---|
| GET | `/api/expedientes` | ✅ | requireTenantAccess('/api/expedientes/:id') | Listar |
| GET | `/api/expedientes/stats` | ✅ | - | Estadísticas |
| GET | `/api/expedientes/:id` | ✅ | requireTenantAccess | Por ID |
| POST | `/api/expedientes` | ✅ | requireTenantAccess + idempotency | Crear |
| PUT | `/api/expedientes/:id` | ✅ | requireTenantAccess | Actualizar completo |
| PATCH | `/api/expedientes/:id` | ✅ | requireTenantAccess | Actualizar parcial |
| DELETE | `/api/expedientes/:id` | ✅ | requireTenantAccess + requireRole(['OWNER','ADMIN','MEMBER']) | Soft-delete |
| GET | `/api/expedientes-secure` | ✅ | - | Versión segura |
| GET | `/api/expedientes-secure/:id` | ✅ | - | Por ID seguro |
| POST | `/api/expedientes-secure` | ✅ | - | Crear seguro |
| PUT | `/api/expedientes-secure/:id` | ✅ | - | Actualizar seguro |
| DELETE | `/api/expedientes-secure/:id` | ✅ | - | Eliminar seguro |

#### 📄 Documentos (`/api/documentos/*`)

| Método | Ruta | Auth | Middlewares | Descripción |
|---|---|---|---|---|
| POST | `/api/documentos/exportar-pdf` | ✅ | authMiddleware + tenantMiddleware | Exportar PDF |
| POST | `/api/documentos/upload` | ✅ | authMiddleware + tenantMiddleware + idempotency + multer | Subir archivo |
| POST | `/api/documentos/exportar` | ✅ | - | Exportar (escrito) |

#### 🤖 Inteligencia Artificial (`/api/ai/*` + `/api/legal/*` + `/api/gemini/*`)

| Método | Ruta | Auth | Middlewares | Descripción |
|---|---|---|---|---|
| POST | `/api/ai/chat` | ✅ | iaTransferenciaGuard + idempotency + quota + validate + validarDisclaimer | Chat IA |
| POST | `/api/ai/consulta` | ✅ | iaTransferenciaGuard + idempotency + quota + validate + validarDisclaimer | Consulta IA |
| POST | `/api/ai/consulta/stream` | ✅ | iaTransferenciaGuard + quota + validate + validarDisclaimer | Stream SSE |
| GET | `/api/ai/historial` | ✅ | - | Historial |
| DELETE | `/api/ai/historial` | ✅ | - | Borrar historial |
| GET | `/api/ai/notificaciones` | ✅ | - | Notificaciones IA |
| GET | `/api/ai/jurisprudencia` | ✅ | iaTransferenciaGuard + quota | Buscar jurisprudencia |
| POST | `/api/ai/panel-expertos` | ✅ | iaTransferenciaGuard + quota + validate + validarDisclaimer | Panel multi-agente |
| POST | `/api/ai/panel-expertos/stream` | ✅ | iaTransferenciaGuard + quota + validate + validarDisclaimer | Stream panel |
| POST | `/api/legal/query` | ✅ | minimaxLimiter | Query legal multi-agente |
| POST | `/api/legal/query/stream` | ✅ | minimaxLimiter | Stream query |
| GET | `/api/legal/health` | ✅ | - | Health check |
| GET | `/api/legal/interpret/health` | ✅ | - | Health interpret |
| GET | `/api/gemini/*` | ✅ | minimaxLimiter | ⚠️ Legacy compatibility |

#### 💰 Créditos (`/api/creditos/*`)

| Método | Ruta | Auth | Middlewares | Descripción |
|---|---|---|---|---|
| GET | `/api/creditos/planes` | ❌ | - | Listar planes |
| GET | `/api/creditos/saldo` | ✅ | authMiddleware + tenantMiddleware | Saldo tenant |
| GET | `/api/creditos/transacciones` | ✅ | authMiddleware + tenantMiddleware | Historial transacciones |
| GET | `/api/creditos/culqi-key` | ❌ | - | Public key Culqi |
| POST | `/api/creditos/comprar` | ✅ | authMiddleware + tenantMiddleware | Comprar créditos |
| GET | `/api/creditos/uso` | ✅ | - | Uso de créditos |

#### 🔔 Notificaciones (`/api/notificaciones/*`)

| Método | Ruta | Auth | Middlewares | Descripción |
|---|---|---|---|---|
| GET | `/api/notificaciones` | ✅ | - | Listar notificaciones |
| PATCH | `/api/notificaciones/:id/leida` | ✅ | - | Marcar como leída |

#### 📅 Plazos Procesales (`/api/plazos/*`)

| Método | Ruta | Auth | Middlewares | Descripción |
|---|---|---|---|---|
| POST | `/api/plazos/calcular` | ✅ | authMiddleware | Calcular plazo |
| GET | `/api/plazos/catalogo` | ❌ | - | Catálogo de plazos |

#### 🔐 Datos Personales ARCO (`/api/mis-datos/*`)

| Método | Ruta | Auth | Middlewares | Descripción |
|---|---|---|---|---|
| GET | `/api/mis-datos` | ✅ | authMiddleware | Ver mis datos |
| PUT | `/api/mis-datos` | ✅ | authMiddleware | Actualizar |
| POST | `/api/mis-datos/cancelar` | ✅ | authMiddleware | Cancelar cuenta |
| POST | `/api/mis-datos/oposicion` | ✅ | authMiddleware | Oposición tratamiento |
| GET | `/api/mis-datos/export` | ✅ | authMiddleware | Exportar mis datos |
| DELETE | `/api/mis-datos/consentimiento/:tipo` | ✅ | authMiddleware | Revocar consentimiento |

#### 👨‍💼 Admin (`/api/admin/*`)

| Método | Ruta | Auth | Middlewares | Descripción |
|---|---|---|---|---|
| POST | `/api/admin/update-catalogos` | ❌ | adminAuth (ADMIN_API_KEY) | Actualizar catálogos |
| GET | `/api/admin/catalogos/status` | ✅ | authMiddleware + requireRole(['OWNER','ADMIN']) | Estado catálogos |
| GET | `/api/admin/health` | ✅ | authMiddleware + requireRole(['OWNER','ADMIN']) | Health admin |

#### 🌐 Páginas legales públicas

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/terminos` | Términos y condiciones (Ley 29733) |
| GET | `/privacidad` | Política de privacidad (Ley 29733) |

#### 💚 Health Checks

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Liveness básico |
| GET | `/health/live` | Liveness K8s/Railway |
| GET | `/health/process` | Estado de memoria del proceso |
| GET | `/health/deep` | Estado de TODAS las dependencias (DB, MiniMax, Redis, Culqi) |
| GET | `/health/readiness` | Readiness K8s/Railway |

#### 💳 Webhooks

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/webhooks/stripe` | Stripe webhook (raw body, antes de express.json) |

### 🛠️ Servicios (`legalpro-app/server/`)

| Servicio | Responsabilidad |
|---|---|
| `auth-mfa.js` | MFA TOTP RFC 6238 con backup codes |
| `cache.js` + `cache-redis.js` | Cache con fallback a memoria si Redis no está |
| `cron-jobs.js` | Tareas programadas (node-cron): cleanup tokens, sync catálogos |
| `db.js` | Pool PostgreSQL + `tenantQuery()` con AsyncLocalStorage + RLS via `set_config()` |
| `initDb.js` | Inicialización de DB al arranque |
| `legal-orchestrator.js` + `legal-router.js` | Multi-agente legal (cascada de subagentes) |
| `logger.js` | Winston + masking PII |
| `sentry.js` | Sentry APM + profiling |
| `supabase.js` | Cliente Supabase (Auth + Storage) |
| `seed.mjs` | Seed de datos demo |
| `smoke-production.mjs` | Smoke test E2E producción |

### 🧩 Middlewares (`legalpro-app/server/middleware/`)

| Middleware | Propósito | Capa Seguridad |
|---|---|---|
| `authMiddleware.js` | Validar JWT + extraer user | OWASP A07 |
| `tenantMiddleware.js` | Extraer organization_id + AsyncLocalStorage | Multi-tenant |
| `tenant-validator.js` | requireTenantAccess + requireTenantInQuery | Anti-IDOR |
| `bruteForce.js` | Login lockout progresivo (5 intentos) | OWASP A07 |
| `idempotencyMiddleware.js` | Idempotency-Key para POSTs | OWASP API6 |
| `quotaMiddleware.js` | Límite créditos IA por plan | Business rule |
| `promptSanitizer.js` | Sanitizar prompts IA (16 patrones) | Prompt injection |
| `requireTransferenciaInternacional.js` | Validar consentimiento LPDP Art. 21 | LPDP |
| `validate.js` | Zod validator wrapper | Input validation |

### 🔌 Adaptadores (`legalpro-app/server/adapters/`)

- **`CulqiAdapter.js`** — Patrón Adapter para Culqi (pagos Perú), con circuit breaker

### 🎨 Core (`legalpro-app/server/core/`)

Patrones de diseño aplicados:
- **`Container.js`** — IoC Container (inyección de dependencias)
- **`EventBus.js`** — Observer pattern
- **`CqrsBus.js`** — CQRS bus (commands/queries)
- **`Result.js`** — Result pattern (en lugar de excepciones)
- **`Logger.js`** — Logger centralizado
- **`decorators.js`** — Decorator pattern (HOF)
- **`index.js`** — Export central

### 📚 Repositorios (`legalpro-app/server/repositories/`)

Patrón Repository con `tenantQuery()` para RLS automático:

| Repositorio | Tabla |
|---|---|
| `BaseRepository.js` | Base genérica |
| `DocumentoRepository.js` | documentos |
| `ExpedienteRepository.js` | expedientes |
| `MensajeRepository.js` | mensajes_chat |
| `OrganizacionRepository.js` | organizaciones |
| `TokenRepository.js` | refresh_tokens |

### 📐 Schemas Zod (`legalpro-app/server/schemas/`)

- `aiSchema.js` → Validación payloads IA
- `documentoExportarSchema.js` → Validación exportar PDF
- `interpretacionSchema.js` → Validación interpretación legal
- `organizacionSchema.js` → Validación crear org

---

## 6. BACKEND .NET 9 (Clean Architecture)

**Puerto:** 5000  
**Framework:** ASP.NET Core 9.0 + EF Core 9 + MediatR + FluentValidation  
**Entry:** `LegalPro.Api/Program.cs` (417 líneas)

### 🏛️ Capas de Clean Architecture

```
LegalPro.Api                → Capa de presentación (Controllers, Middlewares)
LegalPro.Application        → Capa de aplicación (CQRS, Behaviors, Interfaces)
LegalPro.Domain             → Capa de dominio (Entities, Value Objects, Events)
LegalPro.Infrastructure     → Capa de infraestructura (EF Core, Servicios externos)
```

### 📋 Controllers y Endpoints (.NET)

#### 🔐 AuthController

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register` | Registro |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh token |
| GET | `/api/auth/me` | Usuario actual |

#### 📁 ExpedientesController

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/expedientes/stats` | Estadísticas |
| GET | `/api/expedientes` | Listar |
| GET | `/api/expedientes/{id:guid}` | Por ID |
| POST | `/api/expedientes` | Crear |
| PUT | `/api/expedientes/{id:guid}` | Actualizar |
| DELETE | `/api/expedientes/{id:guid}` | Eliminar |
| GET | `/api/expedientes/{id:guid}/resumen-ia` | Resumen IA |

#### 🤖 AnalistaController

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/analista/analizar` | Análisis completo de expediente |

#### ✍️ RedactorController

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/redactor/generar` | Generar escrito legal (demanda, contestación, etc.) |

#### 📢 AlegatoController

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/alegato/generar` | Generar alegato de clausura |

#### ❓ InterrogatorioController

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/interrogatorio/generar` | Plan de interrogatorio |

#### ⚖️ JuezController

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/juez/resolucion` | Resolución judicial |
| POST | `/api/juez/precedentes/comparar` | Comparar precedentes |

#### 🏛️ FiscalController

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/fiscal/requerimiento` | Requerimiento fiscal |

#### 🔮 PredictorController

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/predictor/predecir` | Predicción resultado judicial |

#### 💬 ChatController

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/chat/enviar` | Enviar mensaje |
| GET | `/api/chat/historial` | Historial |
| GET | `/api/chat/sesiones` | Sesiones |

#### 📚 JurisprudenciaController

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/jurisprudencia/buscar` | Buscar (POST) |
| GET | `/api/jurisprudencia/buscar` | Buscar (GET) |

#### 🪄 GeminiController

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/gemini/chat` | Chat Gemini |
| GET | `/api/gemini/historial` | Historial |
| POST | `/api/gemini/consulta` | Consulta |
| GET | `/api/gemini/jurisprudencia` | Jurisprudencia |

#### 🏢 OrganizacionesController

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/organizaciones/me` | Mi organización |
| POST | `/api/organizaciones` | Crear |
| POST | `/api/organizaciones/invite` | Invitar |
| POST | `/api/organizaciones/accept-invite` | Aceptar invitación |
| GET | `/api/organizaciones/me/miembros` | Miembros |
| POST | `/api/organizaciones/invitar` | Invitar (alt) |
| POST | `/api/organizaciones/aceptar-invitacion` | Aceptar (alt) |
| DELETE | `/api/organizaciones/members/{usuarioId:guid}` | Eliminar miembro |

#### 📄 DocumentosController

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/documentos` | Listar |
| POST | `/api/documentos` | Crear |

#### 🔔 NotificacionesController

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/notificaciones` | Listar |

#### 🎮 SimulacionController

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/simulacion/iniciar` | Iniciar simulación |
| POST | `/api/simulacion/turno` | Procesar turno |
| POST | `/api/simulacion/{id:guid}/finalizar` | Finalizar |
| GET | `/api/simulacion/{id:guid}/board` | Estado |
| GET | `/api/simulacion` | Listar simulaciones |

#### 💰 ContadorController

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/contador/liquidacion-laboral` | Calcular CTS, gratificaciones |
| POST | `/api/contador/informe-pericial` | Informe pericial contable |

#### 📅 PlazosController

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/plazos/calcular` | Calcular plazo |

#### 🚫 ObjecionesController

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/objeciones/sugerir` | Sugerir objeción procesal |

### 🧱 Middlewares .NET

| Middleware | Propósito |
|---|---|
| `CorrelationIdMiddleware.cs` | Asigna X-Correlation-Id a cada request |
| `ExceptionHandlingMiddleware.cs` | Captura global de excepciones |
| `SecurityHeadersMiddleware.cs` | CSP, HSTS, X-Frame-Options (OWASP A05) |
| `BruteForceProtectionMiddleware.cs` | Anti-brute force login |
| `IdempotencyMiddleware.cs` | Idempotency-Key (OWASP API6) |
| `TenantMiddleware.cs` | Extrae organization_id del JWT ⚠️ fail-open |
| `MaskingTextFormatter.cs` | Masking PII en logs Serilog |

### 📦 Commands/Queries (CQRS)

**Patrón:** Commands (escritura) + Queries (lectura) + Pipeline Behaviors (cross-cutting)

**Behaviors:**
- `PipelineBehaviours.cs` — Logging, validation, performance
- `PlanLimitsBehavior.cs` — Valida límites del plan
- `TenantValidationBehavior.cs` — ⚠️ Ningún request implementa ITenantRequest efectivamente

**Commands principales:**
- Auth: Register, Login, RefreshToken
- Expedientes: Crear, Actualizar, Eliminar, GenerarResumen
- IA: AnalizarExpediente, GenerarBorrador, GenerarAlegato, GenerarInterrogatorio, GenerarResolucionJudicial, GenerarRequerimientoFiscal, SugerirObjecion, PredecirResultado, CompararPrecedentes, EnviarMensajeChat, GetHistorialChat, GetSesionesChat, BuscarJurisprudencia, CalcularLiquidacionLaboral, GenerarInformePericial, IniciarSimulacion, ProcesarTurno, FinalizarSimulacion
- Organizaciones: CrearOrganizacion, InvitarMiembro, AceptarInvitacion, RemoverMiembro

### 🗃️ Entities (Domain)

| Entity | Descripción | ITenantEntity |
|---|---|---|
| `Usuario.cs` | Usuario del sistema | ❌ ⚠️ |
| `Organizacion.cs` | Organización (tenant) | ❌ |
| `MiembroOrganizacion.cs` | Membresía usuario-org | ❌ ⚠️ |
| `InvitacionOrganizacion.cs` | Invitación pendiente | ❌ ⚠️ |
| `Expediente.cs` | Expediente legal | ✅ |
| `Documento.cs` | Documento del expediente | ✅ |
| `PrediccionJudicial.cs` | Predicción IA | ✅ |
| `Simulacion.cs` | Simulación de juicio | ❌ ⚠️ |
| `MensajeChat.cs` | Mensaje de chat IA | ❌ ⚠️ |
| `AuditLog.cs` | Log de auditoría | ❌ ⚠️ |
| `RefreshToken.cs` | Token de refresco | - |
| `OutboxMessage.cs` | Mensaje outbox pattern | - |
| `BaseLegalVectorial.cs` | Base vectorial legal | - |

**Common:**
- `BaseEntity.cs`, `BaseGuidEntity.cs`, `ITenantEntity.cs`, `ISoftDelete.cs`, `IDomainEvent.cs`, `ValueObject.cs`
- `DomainEnums.cs`, `Rol.cs`
- `DomainEvents.cs`, `DomainExceptions.cs`
- `ValueObjects/ValueObjects.cs`

### 🗄️ Migraciones EF Core

| Fecha | Migración | Descripción |
|---|---|---|
| 2026-03-05 | InitialCreate | Schema inicial |
| 2026-03-12 | UpdateSchema | Actualizaciones |
| 2026-03-16 | AddMensajeChatRef | Mensajes chat |
| 2026-03-19 | SnakeCaseColumns | snake_case |
| 2026-04-13 | PendingModelChanges | Fix pending |
| 2026-05-21 | UnifyDatabaseMode | Unificar con Node |
| 2026-05-22 | AddOutboxMessages | Outbox pattern |

---

## 7. FRONTEND REACT 19 + VITE

**Puerto:** 5173 (dev) / 443 (prod con nginx)  
**Entry:** `legalpro-app/src/main.jsx` + `App.jsx`  
**Versión:** v6.10.1

### 🗺️ Rutas (35+ páginas)

| Path | Página | Auth | Descripción |
|---|---|---|---|
| `/` | Landing | ❌ | Landing pública |
| `/login` | Login | ❌ | Login usuario |
| `/signup` | SignupPage | ❌ | Registro |
| `/setup-organizacion` | SetupOrganizacion | ❌ | Setup inicial tenant |
| `/dashboard` | Dashboard | ✅ | Panel principal con KPIs |
| `/expedientes` | Expedientes | ✅ | Lista de expedientes |
| `/expediente/:id` | AnalistaExpedientes | ✅ | Detalle + análisis IA |
| `/analista` | AnalistaExpedientes | ✅ | Análisis completo |
| `/herramientas` | Herramientas | ✅ | Catálogo herramientas IA |
| `/perfil` | Perfil | ✅ | Perfil usuario |
| `/buscador` | BuscadorJurisprudencia | ✅ | Buscar jurisprudencia |
| `/panel-expertos` | PanelExpertos | ✅ | Multi-agente IA |
| `/simulador` | SimuladorJuicios | ✅ | Simular juicio |
| `/redactor` | RedactorEscritos | ✅ | Redactar escritos |
| `/predictor` | PredictorJudicial | ✅ | Predecir resultado |
| `/alegatos` | GeneradorAlegatos | ✅ | Generar alegatos |
| `/interrogatorio` | EstrategiaInterrogatorio | ✅ | Plan interrogatorio |
| `/objeciones` | AsistenteObjeciones | ✅ | Sugerir objeciones |
| `/monitor-sinoe` | MonitorSinoe | ✅ | Monitoreo SINOE PJ |
| `/comparador` | ComparadorPrecedentes | ✅ | Comparar precedentes |
| `/boveda` | BovedaEvidencia | ✅ | Bóveda evidencia digital |
| `/multidoc` | GestionMultidoc | ✅ | Vista multi-documento |
| `/casos-criticos` | GeneradorCasosCriticos | ✅ | Identificar casos urgentes |
| `/resumen-ejecutivo` | ResumenEjecutivo | ✅ | Resumen ejecutivo |
| `/retroalimentacion` | ReporteRetroalimentacion | ✅ | Feedback post-audiencia |
| `/config-especialidad` | ConfigEspecialidad | ✅ | Config especialidad |
| `/creditos` | PanelCreditos | ✅ | Comprar créditos IA |
| `/calculadora-plazos` | CalculadoraPlazos | ✅ | Calcular plazos CPC 144 |
| `/calendario-vencimientos` | CalendarioVencimientos | ✅ | Vista calendario |
| `/calendario-plazos` | CalendarioPlazos | ✅ | Calendario alternativo |
| `/clientes` | Clientes | ✅ | Gestión clientes |
| `/contador` | Contador | ✅ | Herramientas contador |
| `/chat-ia` | ChatIA | ✅ | Chat IA principal |
| `/chat` | → ChatIA | ✅ | Redirect a /chat-ia |
| `/descargar` | Descargar | ❌ | Descarga app móvil |

### 🧩 Componentes (40+)

#### UI Base (`src/components/ui/`)
- `Avatar.jsx`, `Badge.jsx`, `Button.jsx`, `Checkbox.jsx`, `Divider.jsx`, `Drawer.jsx`, `Input.jsx`, `Modal.jsx`, `Spinner.jsx`, `SpriteIcon.jsx`, `Switch.jsx`, `Tag.jsx`, `Toast.jsx`, `Tooltip.jsx`

#### Layout
- `AppIcon.jsx`, `AuthGuard.jsx`, `BottomNav.jsx`, `CommandPalette.jsx`, `EmptyState.jsx`, `ErrorBoundary.jsx`, `Header.jsx`, `IADisclaimerBanner.jsx`, `IADisclaimerModal.jsx`, `Layout.jsx`, `Sidebar.jsx`, `TopBar.jsx`

#### Específicos
- `legal/` → `AIAssistantPanel.jsx`, `ExpedienteCard.jsx`, `TimelineEvent.jsx`
- `charts/` → `ActivityAreaChart.jsx`, `MateriaPieChart.jsx`
- `filters/` → `DateRangePicker.jsx`, `FilterBar.jsx`, `FilterChip.jsx`, `FilterPanel.jsx`
- `modals/` → `ConfirmModal.jsx`, `Lightbox.jsx`
- `search/` → `SearchInput.jsx`, `SearchResults.jsx`
- `onboarding/` → `OnboardingTour.jsx`
- `wizards/` → `WizardShell.jsx`

### 🎨 Stack visual

- **TailwindCSS 4** + **Framer Motion** (animaciones)
- **Lucide React** + **@heroicons/react** + **react-icons** (iconos)
- **Recharts** (gráficos)
- **@tsparticles/react** (partículas decorativas)
- **react-countup** (contadores animados)
- **swiper** (carrusel landing)
- **react-scroll** (smooth scroll)
- **lottie-react** (animaciones Lottie)
- **react-intersection-observer** (lazy animations)

### 🔌 API Client (`src/api/client.ts`)

Cliente axios con:
- Interceptors de auth (JWT + Cookie)
- Interceptors de tenant (X-Organization-Id opcional)
- Interceptors de error (redirección a login)
- Helpers de paginación
- Helpers de transformación

### 📐 Tipos TypeScript

- `src/types/index.ts` — Tipos compartidos

### 🪝 Hooks

- `useSeo.js` — SEO meta tags
- `index.js` — Hooks compartidos

### 🛣️ Routing y Context

- `BrowserRouter` (React Router DOM 7)
- `<UIProvider>` (UIContext) — Modales, drawers, toasts
- `<TenantProvider>` (TenantContext) — Multi-tenant state
- `<AuthGuard>` — Protección rutas autenticadas
- `<ErrorBoundary>` — Captura errores React

---

## 8. ANDROID (Kotlin + Compose)

**Package:** `com.legalpro.app`  
**UI:** Jetpack Compose + Material 3  
**Build:** Gradle KTS

### 📐 Arquitectura

```
com.legalpro.app/
├─── core/
│    └─── session/
│         └─── SessionManager.kt        # Gestión sesión persistente
│
├─── data/
│    ├─── local/
│    │    ├─── database/
│    │    │    └─── AppDatabase.kt      # Room DB
│    │    ├─── dao/
│    │    │    ├─── ExpedienteDao.kt
│    │    │    └─── EscritoDao.kt
│    │    ├─── entity/
│    │    │    ├─── ExpedienteEntity.kt
│    │    │    ├─── ExpedienteActuacionEntity.kt
│    │    │    └─── EscritoEntity.kt
│    │    └─── model/
│    │         └─── ExpedienteDetalle.kt
│    └─── remote/
│         ├─── LegalProApi.kt           # Retrofit interface
│         └─── dto/
│              ├─── PanelExpertosRequest.kt
│              └─── PanelExpertosResponse.kt
│
├─── di/
│    ├─── DatabaseModule.kt             # Hilt Room
│    ├─── NetworkModule.kt              # Hilt Retrofit/OkHttp
│    ├─── SupabaseModule.kt             # Hilt Supabase SDK
│    └─── PersistentCookieJar.kt        # Cookie persistence
│
├─── domain/
│    └─── (use cases)
│
└─── presentation/
     ├─── auth/
     │    ├─── LoginScreen.kt
     │    └─── LoginViewModel.kt
     ├─── theme/
     │    └─── ResponsiveValues.kt      # Responsive design system
     └─── tools/
          ├─── analyst/AnalistaExpedientesScreen.kt
          ├─── audiencia/AudienciaScreen.kt
          ├─── panelexpertos/
          │    ├─── PanelExpertosScreen.kt
          │    └─── PanelExpertosViewModel.kt
          ├─── predictor/PredictorScreen.kt
          ├─── redactor/RedactorScreen.kt
          ├─── reports/ReportScreen.kt
          └─── simulator/SimuladorScreen.kt
```

### 🎯 Pantallas Android

| Pantalla | Función |
|---|---|
| `LoginScreen` | Login con Supabase Auth |
| `AnalistaExpedientesScreen` | Análisis IA de expediente |
| `AudienciaScreen` | Gestión de audiencia |
| `PanelExpertosScreen` | Multi-agente cascada |
| `PredictorScreen` | Predicción resultado |
| `RedactorScreen` | Redactor de escritos |
| `ReportScreen` | Reportes |
| `SimuladorScreen` | Simulador de juicios |

### 🧪 Tests

- `CompleteJourneyIntegrationTest.kt` — Test integración completo
- `BuscadorJurisprudenciaViewModelTest.kt`
- `PredictorJudicialViewModelTest.kt`
- `SimuladorJuiciosViewModelTest.kt`

---

## 9. OWNER DASHBOARD

**Puerto:** 3005  
**Servidor:** `legalpro-owner-dashboard/server.js` (379 líneas)  
**Versión:** 6.9.2  
**Aislamiento:** Servidor separado con E2EE obligatorio

### 🔐 Seguridad

- **Autenticación E2EE** con `OWNER_SECRET_KEY` (timing-safe comparison)
- **Cifrado AES-256-GCM** con PBKDF2 (100k iteraciones)
- **Frase de descifrado** del cliente (no se transmite)
- **Rate limiting** (30 req/15min)
- **Helmet** con CSP estricta
- **Audit log** de TODA acción del Owner

### 📋 Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | ❌ | Health check |
| POST | `/api/owner/login` | ownerLimiter | Login con ownerKey + decryptPhrase |
| GET | `/api/owner/stats` | authenticateOwner + e2eeMiddleware | Stats agregados (cifrados) |
| GET | `/api/owner/tenants` | authenticateOwner + e2eeMiddleware | Lista tenants |
| GET | `/api/owner/audit` | authenticateOwner + e2eeMiddleware | Audit log |
| POST | `/api/owner/suspend-tenant` | authenticateOwner + e2eeMiddleware | Suspender tenant |
| POST | `/api/owner/reactivate-tenant` | authenticateOwner + e2eeMiddleware | Reactivar tenant |
| POST | `/api/owner/rotate-keys` | authenticateOwner + e2eeMiddleware | Rotar claves |

### 💾 Datos que gestiona

- `consumo_tokens_ia` (costos IA por tenant)
- `audit_log` (eventos globales)
- `tenants` (lista organizaciones)
- `billing` (planes + facturas)

---

## 10. BASE DE DATOS POSTGRESQL/SUPABASE

### 📊 Tablas (16+)

| Tabla | Multi-tenant | RLS | Soft-delete |
|---|---|---|---|
| `usuarios` | ✅ | ✅ | ✅ |
| `organizaciones` | (owner_id) | ✅ | ✅ |
| `miembros_organizacion` | ✅ | ✅ | ✅ |
| `expedientes` | ✅ | ✅ | ✅ |
| `documentos` | ✅ | ✅ | ✅ |
| `evidencia` (Bóveda) | ✅ | ✅ | ✅ + Trigger inmutabilidad |
| `clientes` | ✅ | ✅ | ✅ |
| `simulaciones` | ✅ | ✅ | ✅ |
| `eventos_simulacion` | ✅ | ✅ | ✅ |
| `mensajes_chat` | ✅ | ✅ | ✅ |
| `notificaciones_sinoe` | ✅ | ✅ | ✅ |
| `audit_log` | ✅ | ✅ | ❌ |
| `consumo_tokens_ia` | ✅ | ✅ | ❌ |
| `transacciones_creditos` | ✅ | ✅ | ✅ |
| `invitaciones_organizacion` | ✅ | ✅ | ✅ |
| `refresh_tokens` | (usuario_id) | ❌ | ❌ |
| `outbox_messages` | ❌ (sistema) | ❌ | ❌ |

### 🔐 Row Level Security (RLS)

Pattern canónico:
```sql
ALTER TABLE {tabla} ENABLE ROW LEVEL SECURITY;
CREATE POLICY {tabla}_isolation ON {tabla}
  USING (organization_id = current_setting('app.organization_id')::UUID);
```

**⚠️ HALLAZGO CRÍTICO MT-03:** RLS no garantizada en runtime porque:
- No se ha confirmado rol PostgreSQL `NOBYPASSRLS`
- No se aplica `FORCE ROW LEVEL SECURITY`
- Solo `tenantQuery()` de Node establece `set_config()`
- .NET no establece `app.current_org_id`

### 🗂️ Catálogo canónico

**Archivo:** `catalogs/supabase-schema.md` (459 líneas)  
**Fuente única de verdad** para migraciones (reemplaza 3 archivos duplicados)

---

## 11. SERVICIOS DE INTELIGENCIA ARTIFICIAL

### 🧠 OpenCode Go / DeepSeek V4 Flash (Principal — OPENCODE-FIRST)

**Cliente:** `legalpro-app/server/utils/opencodeClient.js` (SDK OpenAI-compatible)  
**Modelo:** `deepseek/deepseek-v4-flash-0731`  
**Plan:** OpenCode Go (bajo costo, modelos open) — API key en https://opencode.ai/auth

**Funciones usadas:**
- Generación de texto (razonamiento, investigación, redacción legal)
- Function calling
- Streaming (SSE)
- Embeddings (RAG)
- Contexto 1M tokens / output 384K tokens

**Variables:** `OPENCODE_API_KEY`, `OPENCODE_BASE_URL`, `OPENCODE_MODEL`, `OPENCODE_TEMPERATURE`, `OPENCODE_MAX_TOKENS`

### 👁️ MiMo V2.5 (Xiaomi) — Visión / OCR

**Modelo:** `xiaomi/mimo-v2.5`  
**Base URL:** `https://opencode.ai/api/v1`  
**Uso:** visión multimodal, OCR de documentos legales, análisis de imágenes de expedientes

**Variables:** `MIMO_VISION_API_KEY`, `MIMO_VISION_MODEL`, `MIMO_VISION_BASE_URL`

### 🧠 MiniMax M3 (Secundario / Legacy)

**Cliente:** `legalpro-app/server/utils/minimaxClient.js`  
**SDK:** `minimax-coding-plan/MiniMax-M3` (custom)

**Funciones usadas:**
- Generación de texto (modelos Pro/Flash/Lite)
- Function calling
- Streaming (SSE)
- Embeddings (RAG)
- Vision (multimodal)

**Rate limit:** 10 req/min/IP (caro en tokens)

### ⛔ Google Gemini (ELIMINADO)

> **Eliminado definitivamente el 2026-08-01.** No configurar ni usar `GEMINI_API_KEY`.
> Endpoints `/api/gemini/*` quedan como compatibilidad legacy únicamente (re-enrutados a OpenCode Go).

### 🤖 Panel de Expertos (Multi-agente)

`/api/ai/panel-expertos` ejecuta cascada de subagentes:
1. **ia-analista-expedientes** — Analizar hechos
2. **legal-penalista / civilista / laboralista / constitucionalista** — Especialistas
3. **ia-buscador-jurisprudencia** — Precedentes
4. **ia-redactor-escritos** — Borrador inicial
5. **legal-fiscalista** — Perspectiva fiscal
6. Síntesis final

### 🛡️ Defensa contra Prompt Injection

**Middleware:** `promptSanitizer.js` — 16 patrones detectados:
- Inyección directa
- Inyección indirecta (vía contexto/expediente)
- Role hijacking
- Jailbreak
- Token smuggling
- Encoding bypass

### 📊 Costos y Monitoreo

- **Tracking:** `consumo_tokens_ia` table
- **Cuota por plan:** FREE=50/mes, PRO=500/mes, ENTERPRISE=ilimitado
- **Costo USD:** Calculado por modelo y tokens
- **Métricas Owner:** `legalpro-owner-dashboard`

---

## 12. MULTI-TENANT Y AISLAMIENTO

### 🎯 Estrategia

**Shared schema, shared DB, isolated by `organization_id`**

```
JWT Claim: organization_id (UUID)
       ↓
AsyncLocalStorage (Node) / TenantProvider (.NET)
       ↓
tenantQuery() → set_config('app.current_org_id', ..., true)
       ↓
RLS PostgreSQL
       ↓
Filtro WHERE organization_id = $1 (defensa en profundidad)
```

### 🔒 Capas

1. **JWT** contiene `organization_id` validado
2. **tenantMiddleware** propaga el claim
3. **requireTenantAccess** (anti-IDOR) valida que `:id` pertenece al tenant
4. **tenantQuery()** establece contexto RLS por transacción
5. **Repositories** filtran manualmente `WHERE organization_id = $1`
6. **EF Core Query Filter** (con ⚠️ fail-open)
7. **RLS PostgreSQL** (con ⚠️ no garantizado)

### 🚨 Hallazgos críticos multi-tenant

| ID | Severidad | Hallazgo |
|---|---|---|
| **MT-01** | 🔴 CRÍTICO | Filtro EF Core fail-open cuando tenant es null |
| **MT-02** | 🔴 CRÍTICO | Solo 3/13 entidades .NET implementan ITenantEntity |
| **MT-03** | 🔴 CRÍTICO | RLS no garantizada (sin rol NOBYPASSRLS) |
| **MT-04** | 🟠 ALTO | `db.query()` evita contexto RLS en Node |
| **MT-05** | 🟠 ALTO | ITenantRequest nunca implementado realmente |
| **MT-06** | 🟠 ALTO | Middleware .NET no rechaza JWT sin organización |
| **MT-07** | 🟠 ALTO | Anti-IDOR cobertura parcial |
| **MT-08** | 🟠 ALTO | Exportación ARCO sin tenant explícito |
| **MT-09** | 🟠 ALTO | Caché IA sin tenant en clave |
| **MT-10** | 🟠 ALTO | Audit log .NET sin organization_id |
| **MT-11** | 🟠 ALTO | Audit log Node permite NULL |
| **MT-12-MT-18** | 🟡 MEDIO | Otros riesgos |

**Score: 58/100** ⚠️

---

## 13. SEGURIDAD IMPLEMENTADA

### 🛡️ OWASP Top 10 2025 — Cobertura 56%

| OWASP | Estado | Implementación |
|---|---|---|
| A01 Broken Access Control | 🟡 Parcial | Anti-IDOR existe pero cobertura limitada |
| A02 Cryptographic Failures | ✅ | bcrypt + JWT + E2EE + Helmet HSTS |
| A03 Injection | ✅ | Zod + parameterized queries + prompt sanitizer |
| A04 Insecure Design | 🟡 Parcial | Tenant fail-open en .NET |
| A05 Security Misconfiguration | ✅ | Helmet + CSP estricta + SecurityHeaders |
| A06 Vulnerable Components | 🟡 | Dependabot configurado pero sin ejecutar |
| A07 Auth Failures | ✅ | MFA + brute force + rate limit + JWT |
| A08 Data Integrity | ✅ | Idempotency + audit log |
| A09 Logging Failures | ✅ | Sentry + Winston + audit log + masking |
| A10 SSRF | ✅ | Sin endpoints proxy externos |

### 🔐 Controles específicos

**JWT:**
- Secret mínimo 32 chars (falla-fast en producción)
- Expiration: 15 min access, 7 días refresh
- Claims: `sub`, `organization_id`, `rol`, `session_version`
- Storage: Cookie `__Secure-Session` + Bearer

**Brute Force:**
- Login: 10 intentos / 15 min por IP
- Auth paths regex: `/api/auth/(login|register|forgot-password|reset-password|change-password|mfa)`
- Audit event: `BRUTE_FORCE_BLOCK`

**Rate Limiting:**
- Global: 600 req/min/IP (configurable)
- Auth: 10 req/15min/IP (skip successful)
- MiniMax: 10 req/min/IP (caro en tokens)
- General: 60 req/min/IP (.NET)
- Owner: 30 req/15min/IP

**Helmet:**
- CSP: `defaultSrc: 'none'`, `frameAncestors: 'none'`
- HSTS: 1 año + preload (prod)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin

**Sanitización:**
- DOMPurify en frontend
- Zod en backend Node
- FluentValidation en .NET
- Prompt sanitizer 16 patrones
- Multer file upload con whitelist MIME

---

## 14. CUMPLIMIENTO LPDP (Ley 29733)

### 📋 Marco regulatorio

- **Ley 29733** (2011) + **D.S. 016-2024-JUS** (modificatoria 2024)
- **R.D. N° 100-2025-JUS-DGTAIPD** (Directiva Oficial 2025)
- **Art. 21**: Transferencia internacional requiere consentimiento

### ✅ Implementado

| Requisito | Implementación |
|---|---|
| Consentimiento informado | `acepto_transferencia_internacional` en usuarios |
| Revocación | `DELETE /api/mis-datos/consentimiento/:tipo` |
| ARCO Acceso | `GET /api/mis-datos/export` |
| ARCO Rectificación | `PUT /api/mis-datos` |
| ARCO Cancelación | `POST /api/mis-datos/cancelar` |
| ARCO Oposición | `POST /api/mis-datos/oposicion` |
| Registro de tratamiento | `docs/REGISTRO_TRATAMIENTO_LPDP.md` |
| Política de privacidad | `legalpro-app/docs/POLITICA_PRIVACIDAD.md` |
| Términos y condiciones | `legalpro-app/docs/TERMINOS_CONDICIONES.md` |
| Transferencia internacional | `requireTransferenciaInternacional.js` middleware |
| Encriptación | bcrypt + JWT + AES-256-GCM (Owner) |
| Breach notification (72h) | `arneses/runbooks/RB-010-lpdp-breach.md` |
| Audit log | Tabla `audit_log` con masking PII |

### ⚠️ Brechas detectadas

1. **DPO no designado** (recomendable tener)
2. **Etiquetado inconsistente** de proveedor IA (MiniMax vs Gemini)
3. **Revocación de consentimientos limitada** (solo consentimiento específico, no todos)
4. **RLS no activado en runtime** (riesgo de cross-tenant)
5. **`/api/legal/*` sin guard de transferencia internacional** en algunas rutas
6. **Caché IA podría filtrar contexto entre tenants**
7. **Datos de menores no clasificados explícitamente**

**Multas estimadas:** S/ 515 000 (esperanza) — S/ 1 985 000 (peor caso)

---

## 15. OBSERVABILIDAD Y AUDITORÍA

### 📊 Logs

| Origen | Tecnología | Destino |
|---|---|---|
| Node.js | Winston + httpLogger | Console + Sentry |
| .NET | Serilog + MaskingTextFormatter | Console + File + Sentry |
| React | Sentry browser | Sentry |
| Android | Sentry Android | Sentry |

**Estructura:** JSON con `correlationId`, `userId`, `organizationId`, `requestId`

**Masking PII:**
- `MaskingTextFormatter` (.NET) — regex de DNI, emails, tarjetas
- `datosSensibles.js` (Node) — sanitización centralizada
- No se loguea: passwords, tokens, datos sensibles sin máscara

### 🔍 Audit Log

**Tabla:** `audit_log`  
**Eventos registrados:**
- Autenticación (login, logout, failures)
- Cambios en datos (CRUD en entidades tenant)
- Acciones administrativas (suspend, reactivate)
- Eventos de seguridad (brute force, IDOR attempts)
- Operaciones IA (consultas, generaciones)

**Campos:** `id`, `organization_id`, `user_id`, `event_name`, `severity`, `payload_masked`, `ip_address`, `user_agent`, `correlation_id`, `created_at`

### 📈 Métricas

- **Owner Dashboard:** costos IA, tokens, requests
- **Sentry:** APM, error tracking, performance
- **Railway:** CPU, RAM, network, deploys

---

## 16. DEPLOY Y DEVOPS

### 🚂 Railway

**Servicios desplegados:**
1. **lexia-landing** (5174) — Landing estática
2. **legalpro-app-frontend** (5173 → 443) — React + nginx
3. **legalpro-app-backend-node** (3001) — Node.js Express
4. **legalpro-backend-dotnet** (5000) — .NET 9 API
5. **legalpro-owner-dashboard** (3005) — Owner con E2EE

**Configuraciones:**
- `railway.toml` (Node)
- `railway.frontend.toml`
- `railway.node.toml`
- `LegalProBackend_Net/railway.toml`
- `legalpro-owner-dashboard/Dockerfile`

### 🐳 Docker

| Dockerfile | Stack |
|---|---|
| `Dockerfile` (legalpro-app) | Multi-stage: Node build + nginx serve |
| `Dockerfile.frontend` | Frontend específico |
| `LegalProBackend_Net/Dockerfile` | .NET 9 runtime |
| `legalpro-owner-dashboard/Dockerfile` | Node E2EE |

### 🤖 Proveedor IA (OPENCODE-FIRST)

- **Principal:** OpenCode Go — `deepseek/deepseek-v4-flash-0731` (API key en https://opencode.ai/auth)
- **Visión:** MiMo V2.5 (Xiaomi) — `xiaomi/mimo-v2.5`
- **Legacy:** MiniMax M3
- **Eliminado:** ⛔ Google Gemini (2026-08-01)
- Variables inyectadas en `node-api` vía `docker-compose.yml`: `OPENCODE_*` + `MIMO_VISION_*`
- Catálogo: `catalogs/opencode-functions.json`

### 🪝 Git Hooks (`arneses/hooks/`)

| Hook | Propósito |
|---|---|
| `commit-msg.conventional.sh` | Conventional commits |
| `post-merge.reindex.sh` | Reindex tras merge |
| `pre-commit.detect-secrets.sh` | Detectar secretos |
| `pre-commit.format-prettier.sh` | Formateo |
| `pre-commit.lint-dotnet.sh` | Lint .NET |
| `pre-commit.lint-eslint.sh` | Lint JS |
| `pre-commit.no-console-log.sh` | Bloquear console.log |
| `pre-commit.validate-catalogos.sh` | Validar catálogos JSON |
| `pre-push.smoke-build.sh` | Build smoke test |
| `pre-push.test-unit.sh` | Tests unitarios |

### ⏰ CRON Jobs

**Node:** `legalpro-app/server/cron-jobs.js` (node-cron)
- Limpieza de tokens expirados
- Sync de catálogos legales
- Backup de BD

**Railway CRON:** Configurable vía dashboard

### 🔧 Scripts operativos (`tools/`)

| Categoría | Scripts |
|---|---|
| **Backup** | backup.sh, restore.sh, backup.mjs |
| **Railway** | legalpro-ops.ps1, set-docker-image.mjs |
| **Release** | build-and-push-v1.0.4.ps1, build-and-push-v2.0.5.ps1, docker-build-push.sh, post-deploy-validation.sh, railway-deploy.sh, rotate-secrets.ps1, sign-release.sh, VARIABLES-1.0.4.sh |
| **Seed** | cleanup-e2e-expedientes.mjs, inspect-constraints-creditos.mjs, inspect-creditos-schema.mjs, patch-creditos-schema.mjs, patch-lpdp-prod.mjs, reset-production.mjs, seed-demo.mjs |
| **Verifiers (29)** | verifier-accesibilidad, verifier-adaptadores, verifier-arco, verifier-arneses-registry, verifier-brute-force, verifier-bundle-size, verifier-catalogos, verifier-contrato-api, verifier-correcciones-criticas, verifier-cost-spike, verifier-coverage, verifier-deprecation-modelos, verifier-firma-digital, verifier-idempotencia, verifier-lpdp, verifier-masking, verifier-multi-tenant, verifier-outbox, verifier-owasp, verifier-owner-auth, verifier-owner-e2ee, verifier-owner-secrets, verifier-quota, verifier-rbac, verifier-refutador-seguridad, verifier-rls, verifier-transferencia-internacional |
| **Auditoría UI** | audit-ui-prod-fast.mjs, audit-ui-prod.mjs, audit-ui-views.mjs |
| **Debug** | check-bundle-api.mjs, check-layout-prod.mjs, debug-expedientes-layout.mjs, debug-layout-now.mjs, debug-login-prod.mjs, fetch-prod-bundle.mjs, smoke-dotnet-prod.mjs, test-chat-ui.mjs, verify-lpdp-prod.mjs |

---

## 17. AUDITORÍAS REALIZADAS (CONSOLIDADO)

### 🏛️ Auditoría Arquitectónica (`@arquitecto-chief`)

**Hallazgos principales:**

1. **🔴 Dual backend sobre misma BD** — Mayor riesgo. Evidenciado por `NodeExpedienteMappings.cs` y workaround en `Program.cs`. Decisión: **consolidar en .NET o separar formalmente**.

2. **🔴 Lógica de negocio en rutas Node** — `auth.js` (619 líneas), `ai.js` (1000+ líneas). Debería estar en services/handlers.

3. **🟠 RLS no aplicado en producción** — Fail-open real.

4. **🟡 Patrón Repository sin Interface** en Node.

5. **✅ Backend .NET es el modelo a seguir** — Clean Architecture + CQRS.

**Recomendación:** Decisión estratégica antes de seguir escalando.

### 🔐 Auditoría de Seguridad (`@auditor-seguridad`)

**Score: 78/100**  
**25 hallazgos:** 3 críticos + 7 altos + 9 medios + 6 bajos

**Críticos:**
- **H-01**: Owner Dashboard SSL `rejectUnauthorized: false` (MITM sobre bearer tokens)
- **H-02**: Stripe webhook timing attack (`===` en lugar de `timingSafeEqual`)
- **H-03**: Secrets placeholder en `.env` (sin fail-fast al arranque)

**Quick wins (10 cambios, ~2h):** Llevan a 88/100

### 🏛️ Auditoría LPDP (`@auditor-lpdp`)

**5 puntos críticos:**
1. DPO no designado
2. Etiquetado IA inconsistente (MiniMax vs Gemini)
3. Revocación de consentimientos limitada
4. RLS no activado en runtime
5. `/api/legal/*` sin guard de transferencia

**Multas potenciales:** S/ 515k — S/ 1.985M

### 🔒 Auditoría Multi-Tenant (`@auditor-multi-tenant`)

**Score: 58/100** — **NO APROBADO**

**3 críticos:**
- **MT-01**: Filtro EF Core fail-open
- **MT-02**: Solo 3/13 entidades .NET implementan ITenantEntity
- **MT-03**: RLS no garantizada (sin NOBYPASSRLS)

**Veredicto:** Resolver P0 + tests cross-tenant reales antes de producción.

---

## 18. ARCHIVOS BASURA IDENTIFICADOS

### 🗑️ Raíz del proyecto

| Archivo | Tipo | Acción recomendada |
|---|---|---|
| `datos.txt` | TXT con datos personales RAW | 🔴 ELIMINAR (LPDP) |
| `errorabogacia.txt` | Log de errores | 🟡 ARCHIVAR en reports/ |
| `ESTADO-REAL.md` | Documento legacy (30376 bytes) | 🟠 MOVER a docs/archive/ |
| `MEGA_DOC.md` | Documento legacy (100835 bytes) | 🟠 MOVER a docs/archive/ |
| `diagnose-login.mjs` | Script debug one-shot | 🟡 MOVER a tools/debug/ |
| `test-prod-debug.mjs` | Script debug | 🟡 MOVER a tools/debug/ |
| `build-and-tag.ps1` | Duplicado de tools/release/build-and-push-*.ps1 | 🔴 ELIMINAR |
| `chat-page.png`, `chat-ia-page.png` | Screenshots viejos | 🔴 ELIMINAR |
| `frontend-root.png`, `landing-full.png`, `login-page.png` | Screenshots viejos | 🔴 ELIMINAR |

### 🗑️ `legalpro-app/`

| Archivo | Acción |
|---|---|
| `_diag3.mjs` | Script debug one-shot — 🔴 ELIMINAR |
| `nginx.conf.bak.6.9.3` | Backup de nginx — 🔴 ELIMINAR |
| `playwright.config.prod-exhaustive.mjs` | Duplicado de `deploy-staging/.../playwright.config.prod-exhaustive.mjs` |
| `playwright.config.prod.mjs` | Duplicado |
| `playwright-e2e-prod-final.txt`, `playwright-e2e-prod-result.txt` | Logs viejos — 🟡 MOVER a reports/ |
| `check-db-tables.mjs`, `apply-schema.mjs`, `test-same-db.mjs`, `seed-admin.mjs` | Duplicados de `tools/` — 🔴 ELIMINAR o consolidar |
| `playwright-report-*`, `test-results*`, `playwright-report-prod-exhaustive` | Reportes Playwright generados — 🔴 ELIMINAR (en .gitignore) |
| `lighthouse.json`, `lighthouserc.json` | Verificar uso |

### 🗑️ `LegalProAndroid/`

| Archivo | Acción |
|---|---|
| `hs_err_pid55396.log` | JVM crash log viejo — 🔴 ELIMINAR |
| `replay_pid55396.log` | JVM replay log — 🔴 ELIMINAR |

### 🗑️ `deploy-staging/`

Directorio completo es un snapshot de `legalpro-app/` — 🟠 **MOVER a `.gitignore`** o eliminar (duplica ~150MB).

### 🗑️ `legalpro-owner-dashboard/`

| Archivo | Acción |
|---|---|
| `crypto.test.js` | Duplicado de `crypto.test.mjs` — 🔴 ELIMINAR |
| `migrations-v2.js` | Verificar si está en uso — 🟡 MOVER a /migrations/ |

### 🗑️ Reportes obsoletos

| Archivo | Acción |
|---|---|
| `reports/verifiers-run-2026-06-27/results.txt` | 🟡 MOVER a reports/archive/2026-06/ |
| `legalpro-app/test-results-prod/*` | Generados por Playwright — 🔴 GITIGNORE |
| `deploy-staging/legalpro-app/test-results-prod/*` | Generados — 🔴 GITIGNORE |

### 🗑️ Raíz - logs y caches varios

- `legalpro-app/logs/` — logs de runtime
- `legalpro-app/dist/` — build output (debe estar en .gitignore)

### 📋 Resumen de limpieza

**Total estimado a eliminar:** ~80 archivos  
**Tamaño a recuperar:** ~150MB  
**Riesgo:** Bajo (todos son debug/backup/duplicados)

### ⚠️ ALERTA CRÍTICA LPDP

**`datos.txt`** en la raíz contiene datos personales RAW — **DEBE eliminarse inmediatamente** y verificar que no esté commiteado a git. Si está en el repo, debe:
1. Removerse del working tree
2. Aplicar `git filter-branch` o BFG Repo-Cleaner para limpiar historial
3. Rotar cualquier credencial que aparezca en él
4. Notificar a la ANPDP si aplica

---

## 19. RECOMENDACIONES PRIORIZADAS

### 🚨 P0 — Antes del siguiente deploy (CRÍTICO)

#### Seguridad
1. **Fix H-01**: Cambiar `rejectUnauthorized: false` en `legalpro-owner-dashboard/server.js` línea 35
2. **Fix H-02**: Usar `crypto.timingSafeEqual` en `legalpro-app/server/webhooks/stripe-handler.js`
3. **Fix H-03**: Fail-fast al arranque si secrets son placeholders

#### Multi-Tenant
4. **Fix MT-01**: Cambiar filtro EF Core a fail-closed en `ApplicationDbContext.cs:74-84`
5. **Fix MT-02**: Implementar ITenantEntity en TODAS las entidades con organization_id (10 entidades faltantes)
6. **Fix MT-03**: Crear roles `legalpro_node` y `legalpro_dotnet` con `NOBYPASSRLS` + `FORCE ROW LEVEL SECURITY`
7. **Fix MT-09**: Incluir `org:${req.organizationId}` en todas las claves de caché IA

#### LPDP
8. **Fix LPDP-1**: Designar DPO
9. **Fix LPDP-2**: Aplicar guard de transferencia internacional en `/api/legal/*`
10. **Fix LPDP-3**: Limpiar `datos.txt` y limpiar historial git

### 🟠 P1 — Próximo sprint (ALTO)

11. Implementar `ITenantRequest` en todos los commands/queries .NET
12. Migrar `db.query()` a `tenantQuery()` en operaciones tenant
13. Integrar `requireTenantAccess` DESPUÉS de autenticación
14. Tests cross-tenant reales (Node + .NET)
15. Validar RLS contra PostgreSQL real (no solo búsqueda textual)
16. Endurecer exportador ARCO con tenant explícito
17. Audit log .NET con `organization_id` obligatorio

### 🟡 P2 — Endurecimiento (MEDIO)

18. Normalizar convención de columnas: `organization_id` único
19. Soft-delete uniforme (`deleted_at`)
20. Patrón obligatorio para bulk operations
21. Documentar cambio de organización + revocación de tokens
22. Limpiar archivos basura identificados
23. Consolidar dual backend (decisión arquitectónica)

---

## 20. MÉTRICAS DEL ORQUESTADOR

### 📊 Sistema agentic

| Métrica | Valor |
|---|---|
| **Subagentes totales** | 96 |
| **Modo primary** | 1 (lexia-orchestrator) |
| **Modo subagent** | 95 |
| **Skills** | 17 |
| **Catálogos canónicos** | 25 |
| **Verificadores** | 28 |
| **Slash commands** | 14 |
| **Prompts especializados** | 19 |
| **Reglas de programación** | 16 |
| **ADRs registrados** | 3 (clean architecture, adapter pattern, release sign-off) |
| **Runbooks operacionales** | 21 (RB-001 a RB-021 + RB-DR-001) |
| **Templates** | 7 (ADR, AGENT, ISSUE, PR, PRD, RUNBOOK, SKILL) |

### 🎯 Roles cubiertos

- **Abogados:** 28 (5 seniors + 23 juniors + 1 chief)
- **Contadores:** 4 (1 chief + 3 specialists)
- **Ingeniería:** 13 (backend, frontend, mobile, DB, devops, etc.)
- **IA:** 16 (analista, redactor, buscador, predictor, simulador, etc.)
- **Auditoría:** 7 (seguridad, lpdp, multi-tenant, performance, etc.)
- **Gobernanza:** 6 (chief, planner, owner, product, release)
- **Operaciones:** 8 (soporte, marketing, UX, onboarding, etc.)
- **Mando:** 4 (arquitecto, gobernanza, planner, product-owner)
- **Refutadores (Red Team):** 6 (arquitectura, legal, lpdp, perf, security, red-team)

### 💰 Costos

| Proveedor IA | Costo estimado/mes (prod) |
|---|---|
| MiniMax M3 Pro | Variable según uso |
| MiniMax M3 Flash | Bajo |
| Google Gemini API | Variable |

Tracking en tabla `consumo_tokens_ia`.

---

## 📚 ANEXOS

### A. Glosario de rutas frontend

Ver sección 7.

### B. Documentación relacionada

- `README.md` raíz — Overview
- `ARNES_AGENTIC_PLAN.md` — Plan maestro agentic
- `legalpro-app/README.md` — Detalle del stack
- `docs/PLAN-ACCION-INTEGRAL.md` — Plan de acción
- `docs/CHECKLIST-PRE-PRODUCCION.md` — Pre-producción
- `reports/OWASP-AUDIT-2026-06-28.md` — Auditoría OWASP previa
- `reports/auditoria-multitenant-rls-2026-06-28.md` — Auditoría multi-tenant previa
- `reports/auditoria-lpdp-2026-06-28.md` — Auditoría LPDP previa

### C. Comandos útiles

```bash
# Auditoría completa
npm run verify:all

# Verificadores individuales
node tools/verifiers/verifier-owasp.mjs
node tools/verifiers/verifier-multi-tenant.mjs
node tools/verifiers/verifier-lpdp.mjs

# Build + test
npm run build
npm run test:server
npm run test:e2e

# Deploy
npm run railway:status
npm run railway:logs

# Seed
npm run seed:demo
npm run seed:prod
```

### D. Variables de entorno críticas

Ver `catalogs/env-vars.md` y `.env.example` de cada servicio.

---

## 🎯 CONCLUSIÓN

**LegalPro** es una plataforma SaaS legal multi-tenant sofisticada para el mercado peruano, con:
- ✅ Stack moderno y robusto (React 19, .NET 9, Node 20)
- ✅ IA integrada con MiniMax M3 + Gemini
- ✅ Cobertura LPDP del marco formal
- ✅ Sistema agentic de 96 subagentes especializados
- ✅ 29 verificadores automáticos

**Pero requiere remediación antes de producción:**
- 🔴 3 críticos de seguridad (H-01, H-02, H-03)
- 🔴 3 críticos multi-tenant (MT-01, MT-02, MT-03)
- 🔴 5 brechas LPDP críticas
- 🟠 ~10 hallazgos altos adicionales

**Tiempo estimado total:** ~16-20 horas de desarrollo + 8h de QA.

**Próximos pasos inmediatos:**
1. Aplicar los 10 fixes P0
2. Limpiar archivos basura (sección 18)
3. Re-ejecutar los 29 verificadores
4. Tests cross-tenant con PostgreSQL real
5. Documentar en MEGA_DOC.md nuevo (reemplazo)

---

**Generado por:** `lexia-orchestrator` + 4 subagentes especializados  
**Fecha:** 1 de agosto de 2026  
**Próxima revisión:** Post-remediación P0

> **Disclaimer IA:** Este documento fue generado con asistencia de IA. Las recomendaciones deben ser validadas por el equipo de seguridad y arquitectura antes de su implementación. Los hallazgos críticos requieren atención inmediata de profesionales certificados.