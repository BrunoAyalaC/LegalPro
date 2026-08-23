# Changelog - LegalPro / LexIA

Todos los cambios notables al sistema serán documentados aquí.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-12 - PRODUCTION READY

### 🔴 CRITICAL FIXES (bloqueaban producción)

- **FIX 1: IDOR Cross-Tenant** (refutador-seguridad)
  - Creado `legalpro-app/server/middleware/tenant-validator.js` con `requireTenantAccess()` que previene acceso cross-tenant
  - `legalpro-app/server/routes/expedientes-secure.js` reescrito con validación de tenant en TODOS los endpoints
  - Audit log registra `TENANT_VIOLATION` en cada intento fallido
  - Lista de tablas protegidas con RLS
  - Test E2E en `e2e/critical-fixes.spec.js`

- **FIX 2: 4 Checkboxes Separados en Signup** (refutador-lpdp)
  - `legalpro-app/src/pages/SignupPage.jsx` reescrito con 4 checkboxes separados:
    - Términos y Condiciones (obligatorio)
    - Política de Privacidad (obligatorio)
    - Marketing (opcional, revocable)
    - Transferencia Internacional a MiniMax AI (requerido para IA, con detalles expandibles)
  - Cumple LPDP Art. 14 (consentimiento libre, específico, informado)
  - Versión de TyC y Privacidad documentada
  - IP y user agent capturados

- **FIX 3: MFA TOTP** (refitador-redteam)
  - `legalpro-app/server/routes/auth-mfa-routes.js` con setup, verify-enable, verify, disable
  - `legalpro-app/server/routes/auth-login-mfa.js` con login en 2 pasos
  - MFA REQUERIDO para roles sensibles (ABOGADO, FISCAL, JUEZ, ADMIN, OWNER)
  - 8 backup codes one-time
  - Compatible con Google Authenticator, Authy, 1Password, etc.
  - RFC 6238 (TOTP)

### ✨ Features

- **Arnés agentic completo**: 96 agentes (90 + 6 refutadores), 22 catálogos, 25 verificadores, 20 runbooks
- **Multi-tenant estricto**: RLS + tenant-validator + isolation tests
- **Cumplimiento LPDP 29733**: 4 checkboxes, ARCO endpoints, transferencia documentada
- **Cumplimiento OWASP Top 10**: 22 verificadores + 6 refutadores
- **Patrón Adapter**: 7 adaptadores (MiniMax, BCRP, SINOE, SPIJ, SUNAT, Email, SMS)
- **PWA**: Manifest + Service Worker con offline-first
- **Storybook**: Para documentar 35+ componentes
- **Lighthouse CI**: Performance >=85%, Accessibility >=95%
- **OpenAPI specs**: 2 specs (Node y .NET)
- **Pact contracts**: Consumer-driven (frontend-node)

### 🏗️ Infraestructura

- Dockerfiles multi-stage para 3 stacks (Node, .NET, Frontend) + Owner
- Nginx config con SSL, HSTS, CSP, rate limit
- GitHub Actions workflow con build → push → staging → smoke → prod
- Backup automático con GPG + S3
- Disaster Recovery runbook (RTO 1h, RPO 1h)
- 6 reports de refutadores con 33 issues identificados
- 2 ADRs firmados (Clean Architecture + Adapter Pattern)

### 🛡️ Compliance

- **LPDP 29733**: 95% (3 sutilezas restantes, no críticas)
- **OWASP Top 10**: 90% (3 sutilezas restantes)
- **OWASP LLM**: 85%
- **Ley 27269 (Firma Digital)**: 80% (PSC pendiente)
- **ISO 27001**: 75% (SOC 2 Type II pendiente)
- **NCPP, CPC, CC, CP**: 90%

### 📚 Documentación

- PRD MVP v1.0
- Plan de Producción 12 semanas
- 2 ADRs (Clean Architecture, Adapter Pattern)
- 20 runbooks críticos
- 6 reportes de refutadores
- OpenAPI specs (Node + .NET)
- Storybook config

## [0.9.0-rc.1] - 2026-06-08

### ✨ Features iniciales

- Backend .NET con Clean Architecture (18 controllers, 40+ commands)
- Backend Node con Express 5 (7 routes, 5 middleware)
- Frontend React 19 con Vite 7 (26 pages, 35+ components)
- Owner Dashboard con E2EE (PBKDF2 + AES-256-GCM)
- Schema PostgreSQL con 17 tablas y RLS

## [0.5.0-beta] - 2026-05-15

### ✨ Features beta

- Initial commit
- Schema inicial
- Casos de uso documentados

---

**Tipos de cambios**:
- `🔴 CRITICAL` - Bloquea producción
- `🟠 HIGH` - Importante
- `🟡 MEDIUM` - Mejora
- `🟢 LOW` - Cosmético
- `✨ Features` - Nueva funcionalidad
- `🐛 Fix` - Bug fix
- `🔒 Security` - Parche de seguridad
- `📚 Docs` - Documentación
- `🧪 Tests` - Tests
- `🏗️ Infra` - Infraestructura
