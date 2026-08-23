---
description: Reglas para código .NET 8 con CQRS
globs:
  - "LegalProBackend_Net/**/*.cs"
  - "LegalProBackend_Net/**/*.csproj"
---

# Reglas Backend .NET 8 (Clean Architecture + CQRS)

Aplicar estas reglas al editar archivos C# en `LegalProBackend_Net/`.

## Arquitectura (Clean)

- **Domain** ← **Application** ← **Infrastructure** ← **Api**
- Domain: entidades, ValueObjects, DomainEvents, excepciones
- Application: Commands/Queries, Behaviours, Validators, DTOs
- Infrastructure: DbContext, Services externos, Repos, BackgroundJobs
- Api: Controllers delgados, Middleware

## CQRS con MediatR

- Commands (escritura) y Queries (lectura) separados
- Controllers: `await _mediator.Send(new XxxCommand())`
- Pipeline Behaviours: ValidationBehaviour, LoggingBehaviour, TenantValidationBehavior, PlanLimitsBehavior

## Multi-tenant

- NUNCA `IgnoreQueryFilters()` en producción
- SIEMPRE `ITenantRequest` en commands/queries con datos por organización
- SIEMPRE `HasQueryFilter` con `OrganizationId`
- SIEMPRE `TenantValidationBehavior` en pipeline

## Seguridad

- `[Authorize]` + validar claims
- `ITenantProvider` extrae `OrganizationId` de JWT
- Masking PII en logs (MaskingTextFormatter)
- BCrypt para passwords
- JWT HS256 con secret >= 32 chars

## Performance

- Latencia p95 < 500ms (no IA), < 3s (IA)
- Coverlet >= 80% coverage
- xUnit + Moq para tests
- OpenTelemetry para tracing
