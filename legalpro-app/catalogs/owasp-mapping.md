# OWASP Top 10 — Mapeo de Controles

> Mapeo entre OWASP Top 10 (2021) y los controles concretos en código del proyecto.

## A01:2021 — Broken Access Control

### Controles implementados

| Control | Dónde | Verificador |
|---|---|---|
| Multi-tenant via `organization_id` en JWT | `.NET` `TenantValidationBehavior` + `TenantMiddleware` | `verifier-multi-tenant.mjs` |
| RBAC con `requireRole(allowedRoles)` | `Node` `authMiddleware.js` | `verifier-rbac.mjs` |
| RLS en Supabase | `catalogs/supabase-schema.md` | `verifier-rls.mjs` |
| Audit log en mutaciones | `IAuditLogger` + interceptor SaveChanges | `verifier-owasp.mjs` |
| Static analysis: detectar `IgnoreQueryFilters()` | grep | `verifier-multi-tenant.mjs` |
| Tests cross-tenant (org A intenta leer org B) | integration tests | `@JourneyTester` |

## A02:2021 — Cryptographic Failures

| Control | Dónde | Verificador |
|---|---|---|
| HTTPS forzado | Railway config | `verifier-secretos.mjs` |
| JWT HS256 con `JWT_SECRET >= 32 chars` | `JwtService.cs` + `authMiddleware.js` | `verifier-secretos.mjs` |
| bcrypt para passwords | `bcrypt` Node, .NET Identity | `verifier-secretos.mjs` |
| pgcrypto para PII en reposo | `usuarios.dni` (opcional) | `verifier-lpdp.mjs` |
| HTTPS-only cookies + SameSite | `COOKIE_OPTIONS` en `routes/auth.js` | `verifier-owasp.mjs` |
| Cifrado de evidencia | `E2EE AES-256-GCM` (opcional) | `verifier-firma-digital.mjs` |
| Tokens en cookies httpOnly, no localStorage | Frontend + Node | manual |

## A03:2021 — Injection (SQL, NoSQL, Command)

| Control | Dónde | Verificador |
|---|---|---|
| EF Core con queries parametrizadas (NUNCA raw SQL) | `LegalPro.Infrastructure` | `verifier-owasp.mjs` |
| Validación con Zod/Joi | `Node` `middleware/validate.js` | `verifier-owasp.mjs` |
| FluentValidation | `LegalPro.Application` | `verifier-owasp.mjs` |
| Prompt sanitization | `Node` `promptSanitizer.js` | `verifier-owasp.mjs` |
| Helmet CSP estricta | `Node` `index.js` | `verifier-owasp.mjs` |
| DOMPurify en respuestas IA renderizadas | `Frontend` | `verifier-owasp.mjs` |
| Snippets de busqueda: `pg` con `$1, $2` | `Node` | manual |

## A04:2021 — Insecure Design

| Control | Dónde | Verificador |
|---|---|---|
| Plan limits (FREE/PRO/ENTERPRISE) | `.NET` `PlanLimitsBehavior` + `Node` `quotaMiddleware.js` | `verifier-quota.mjs` |
| Idempotency-Key en POST mutables | `Node` `idempotencyMiddleware.js` | `verifier-idempotencia.mjs` |
| Threat model documentado | `.github/governance/THREAT-MODEL.md` | `@AuditorSeguridad` |
| ADRs firmados | `arneses/registry/ADRs/` | `@ArquitectoChief` |
| DoD verificado en cada PR | `.opencode/agents/reviser.md` | `@Reviser` |

## A05:2021 — Security Misconfiguration

| Control | Dónde | Verificador |
|---|---|---|
| Security headers (HSTS, X-Frame, CSP, X-Content-Type) | `SecurityHeadersMiddleware.cs` + nginx.conf | `verifier-owasp.mjs` |
| CORS restrictivo desde `ALLOWED_ORIGINS` | `Node` `index.js` | `verifier-owasp.mjs` |
| Sin defaults inseguros | Environment validation | `verifier-env.mjs` |
| DEBUG=false en prod | config | `verifier-env.mjs` |
| Sin info disclosure en stack traces | `ExceptionHandlingMiddleware.cs` | `verifier-owasp.mjs` |
| Versionado y actualización de deps | Dependabot | `verifier-deps.mjs` |

## A06:2021 — Vulnerable and Outdated Components

| Control | Dónde | Verificador |
|---|---|---|
| Gitleaks (secrets) | `.github/workflows/security.yml` | `verifier-secretos.mjs` |
| Trivy (vuln de imágenes Docker) | `.github/workflows/security.yml` | `@AuditorSeguridad` |
| CodeQL csharp | `.github/workflows/security.yml` | `@AuditorSeguridad` |
| npm audit --audit-level=high | `.github/workflows/security.yml` | `@AuditorSeguridad` |
| dotnet list package --vulnerable | `.github/workflows/security.yml` | `@AuditorSeguridad` |
| Dependabot semanal | `dependabot.yml` | `@DevOps` |

## A07:2021 — Identification and Authentication Failures

| Control | Dónde | Verificador |
|---|---|---|
| JWT con iss/aud/exp/iat/nbf | `JwtService.cs` + `authMiddleware.js` | `verifier-owasp.mjs` |
| Refresh tokens con rotación | `RefreshToken` entity | `verifier-owasp.mjs` |
| Brute force protection (5 intentos / 15 min) | `BruteForceProtectionMiddleware.cs` | `verifier-brute-force.mjs` |
| MFA (futuro, recomendado LPDP Art. 17) | roadmap | `@GobernanzaChief` |
| Sin passwords en URLs | código | `verifier-owasp.mjs` |

## A08:2021 — Software and Data Integrity Failures

| Control | Dónde | Verificador |
|---|---|---|
| Verificación de firma en CI artifacts | `.github/workflows/docker-publish.yml` | `@DevOps` |
| Dependabot con revisión obligatoria | `dependabot.yml` | `@DevOps` |
| Audit log inmutable (no UPDATE/DELETE) | `audit_log` triggers | `verifier-audit.mjs` |
| Outbox pattern (garantiza al menos una entrega) | `outbox_messages` | `verifier-outbox.mjs` |
| Code review obligatorio | CODEOWNERS | `@Reviser` |

## A09:2021 — Security Logging and Monitoring Failures

| Control | Dónde | Verificador |
|---|---|---|
| Audit log completo | `IAuditLogger` | `verifier-audit.mjs` |
| Serilog con masking | `MaskingTextFormatter.cs` | `verifier-masking.mjs` |
| Pino/Winston con masking | `legalpro-app/server/logger.js` | `verifier-masking.mjs` |
| Alertas Slack/Email en eventos CRITICAL | `catalogs/audit-events.json` | `@SRE` |
| Sentry/Datadog (futuro) | roadmap | `@SRE` |
| Uptime monitoring | `uptime-synthetics.yml` | `@SRE` |

## A10:2021 — Server-Side Request Forgery (SSRF)

| Control | Dónde | Verificador |
|---|---|---|
| Whitelist de URLs externas permitidas | `IntegracionesPeru` | `@IntegracionesPeru` |
| Sin fetch a URLs用户提供 | código | `verifier-owasp.mjs` |
| Sanitización de redirects | código | `verifier-owasp.mjs` |

## LPDP Específico (Ley 29733 — Perú)

| Control LPDP | Dónde | Verificador |
|---|---|---|
| Consentimiento por finalidad | `consentimientos` table | `verifier-lpdp.mjs` |
| Derecho ARCO (Acceso, Rectificación, Cancelación, Oposición) | `/api/mis-datos` (Node) | `verifier-arco.mjs` |
| Transferencia internacional con consentimiento | `acepto_transferencia_internacional` column | `verifier-transferencia-internacional.mjs` |
| Firma digital (Ley 27269) | `Documento.firma_digital_id` | `verifier-firma-digital.mjs` |
| Breach notification en <=5 días hábiles | `LPDP_BREACH_SUSPECTED` alert | `@AuditorLPDP` |
| Plazo de retención documentado | columna `retention_dias` en audit events | `verifier-retention.mjs` |
| Registro de tratamiento | `docs/REGISTRO_TRATAMIENTO_LPDP.md` | `@GobernanzaChief` |

## Auditoría

- Ejecutar `tools/verifiers/verifier-owasp.mjs` en cada PR
- Revisar este mapeo trimestralmente (responsable: @AuditorSeguridad)
- Actualizar cuando se agregue un nuevo control
