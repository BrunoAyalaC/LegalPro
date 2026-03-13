---
description: "Reglas para desarrollo .NET con Clean Architecture y CQRS en LegalPro. Backend desplegado en Railway con Supabase PostgreSQL."
applyTo: "LegalProBackend_Net/**/*.cs"
---

# .NET CQRS - Reglas

## Clean Architecture

```
Domain ← Application ← Infrastructure ← Api
```

- **Domain**: Entidades puras, sin dependencias
- **Application**: Handlers MediatR, Validators, DTOs
- **Infrastructure**: DbContext (Supabase PostgreSQL), Services
- **Api**: Controllers delgados, Middleware

## CQRS con MediatR

- **Commands** para escritura: `CreateXCommand : IRequest<Result>`
- **Queries** para lectura: `GetXQuery : IRequest<XDto>`
- **Handlers**: `IRequestHandler<T, R>` — toda la lógica aquí
- **Validators**: `AbstractValidator<T>` con FluentValidation

## Controllers

```csharp
[HttpPost]
public async Task<IActionResult> Create([FromBody] CreateXCommand command)
    => Ok(await Mediator.Send(command));
```

- SOLO `Mediator.Send()` y retornar
- NO lógica de negocio en controllers

## Base de datos

- **PostgreSQL en Supabase Cloud** (NO SQLite en producción)
- Connection string: `Host=db.xxx.supabase.co;Port=5432;...;SSL Mode=Require`
- Entity Framework Core con `UseNpgsql()`

## Deploy

- Railway con Dockerfile multi-stage
- Variables de entorno via Railway Dashboard
