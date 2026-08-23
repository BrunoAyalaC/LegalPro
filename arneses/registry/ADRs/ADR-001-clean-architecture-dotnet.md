# ADR-001: Clean Architecture en Backend .NET

> **Status**: Accepted
> **Date**: 2026-06-12
> **Deciders**: @arquitecto-chief, @backend-dotnet, @abogado-chief

## Context

El backend .NET de LegalPro necesita mantener un código de calidad durante 10+ años, con múltiples equipos contribuyendo. Necesitamos una arquitectura que:

- Aísle la lógica de negocio de frameworks
- Sea testeable sin dependencias externas
- Soporte multi-tenant
- Cumpla con LPDP 29733 y OWASP
- Permita cambiar de .NET a otro framework en el futuro (vendor lock-in)

## Decision Drivers

- Mantenibilidad a 10+ años
- Test coverage >= 80%
- Multi-tenant estricto con RLS
- Inyección de dependencias
- CQRS con MediatR
- Pipelines de behaviors
- Cumplimiento LPDP

## Considered Options

### Option 1: Clean Architecture (4 layers)

**Pros**:
- Separación clara de responsabilidades
- Domain sin dependencias
- Testeable sin DB
- Inversion of dependencies
- Patrón probado en la industria

**Cons**:
- Más boilerplate
- Más archivos
- Curva de aprendizaje

### Option 2: 3-layer traditional (UI/BLL/DAL)

**Pros**: Simple
**Cons**: Acoplamiento, difícil de testear, no es vendor-neutral

### Option 3: Vertical Slices

**Pros**: Menos cross-cutting
**Cons**: Más difícil de mantener consistency cross-feature

## Decision Outcome

**Chosen option**: "Option 1: Clean Architecture"

**Justificación**: El proyecto tiene 40+ commands/queries, 11 entidades, multi-tenant, y regulaciones complejas. La separación en 4 capas (Domain, Application, Infrastructure, Api) es la mejor inversión a largo plazo.

### Structure

```
LegalProBackend_Net/
├── LegalPro.Domain/          # Entities, ValueObjects, Events, Exceptions
│   ├── Common/               # BaseEntity, ISoftDelete, ITenantEntity
│   ├── Entities/             # Usuario, Expediente, Documento, etc.
│   ├── Enums/
│   ├── Events/
│   ├── Exceptions/
│   └── ValueObjects/
├── LegalPro.Application/     # Use cases (CQRS)
│   ├── Common/
│   │   ├── Behaviours/       # Pipeline behaviours
│   │   ├── Interfaces/       # IApplicationDbContext, IAuthService, etc.
│   │   └── Security/         # TenantIsolationValidator
│   ├── Auth/Commands/        # LoginQuery, RegisterCommand
│   ├── Expedientes/Commands/ # CrearExpedienteCommand
│   └── ...
├── LegalPro.Infrastructure/  # External concerns
│   ├── Persistence/          # EF Core, Repositories
│   ├── Services/             # Gemini, JWT, Storage
│   ├── Migrations/           # EF Core migrations
│   └── BackgroundJobs/       # Outbox processor
└── LegalPro.Api/             # Controllers, Middleware
    ├── Controllers/
    ├── Middleware/            # 6 middlewares
    └── Program.cs
```

### Consequences

**Positivas**:
- Domain completamente testeable sin DB
- Cambio de framework no afecta lógica
- Cumple con SOLID
- Inversion of dependencies

**Negativas**:
- Más boilerplate (aceptado por beneficios a largo plazo)
- Requiere disciplina del equipo

### Compliance

- **LPDP**: Tenant entity interface + Behaviour en pipeline
- **OWASP A01**: Cross-cutting en Middleware
- **OWASP A07**: Auth service en Application layer

## Implementation Notes

### Multi-tenant con ITenantRequest

```csharp
public interface ITenantRequest { }

public class CrearExpedienteCommand : IRequest<ExpedienteDto>, ITenantRequest
{
  // ...
}

// Behaviour automático valida tenant
public class TenantValidationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
{
  public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
  {
    if (request is ITenantRequest)
    {
      // Validar que el usuario tiene acceso al tenant del JWT
    }
    return await next();
  }
}
```

### Pipelines

1. LoggingBehavior (logging automático)
2. ValidationBehavior (FluentValidation)
3. TenantValidationBehavior (multi-tenant)
4. PlanLimitsBehavior (cuotas del plan)

## References

- [Clean Architecture - Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Microsoft .NET Architecture Guides](https://learn.microsoft.com/en-us/dotnet/architecture/)
- `catalogs/supabase-schema.md` (multi-tenant)
- `catalogs/owasp-mapping.md` (seguridad)
