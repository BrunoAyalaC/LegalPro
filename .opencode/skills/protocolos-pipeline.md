---
name: protocolos-pipeline
description: Pipeline de comportamientos transversales (Behaviors en .NET, Middlewares en Node, Decorators). Auth, tenant, RBAC, validacion, logging, audit, idempotencia, plan-limits.
when-to-use: "Cuando se necesite agregar/quitar una preocupación transversal a todo el sistema"
allowed-tools: Read, Write, Edit, Grep, Glob
updated: 2026-07-31
implementaciones:
  node: legalpro-app/server/middleware/ + core/decorators.js
  dotnet: LegalPro.Application/Behaviors/ (MediatR Pipeline)
---

# protocolos-pipeline (v3.0 RAG-optimized)

Documenta los **protocolos transversales** (cross-cutting concerns) que se aplican sistemáticamente a TODA operación: autenticación, multi-tenancy, RBAC, validación, logging, auditoría, idempotencia, plan-limits, sanitización IA. **A julio 2026**.

## Inputs

```yaml
tipo_request: HTTP_request | Command | Query | Domain_Event
requiere_auth: bool
requiere_multitenant: bool
requiere_rbac: bool
requiere_validacion: bool
requiere_idempotencia: bool
requiere_audit: bool
requiere_quota_ia: bool
```

## Pipeline Node (Express 5 + Middlewares + Decorators)

### Orden de aplicación (INMUTABLE)

```
1. CorrelationId           → genera X-Correlation-ID
2. RequestLogging          → log estructurado
3. SecurityHeaders         → Helmet + CSP
4. Compression             → gzip
5. AuthMiddleware          → verifica JWT
6. TenantMiddleware        → extrae organization_id del JWT
7. RequireRole             → valida RBAC
8. IdempotencyMiddleware   → dedupe POST mutables
9. QuotaMiddleware         → descuenta créditos IA
10. Validate (Zod)         → validación de input
11. RateLimit              → límite por usuario/org
12. HANDLER                → lógica de negocio
13. ResponseLogger         → log de salida
14. ExceptionHandler       → captura errores
```

### Implementación típica

```javascript
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
import { requireRole } from '../middleware/requireRole.js';
import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware.js';
import { quotaMiddleware } from '../middleware/quotaMiddleware.js';
import { validate } from '../middleware/validate.js';
import { withLogging, withValidation, withIdempotency } from '../core/decorators.js';

const router = Router();

router.post('/expedientes',
  authMiddleware,                       // 1. Auth
  tenantMiddleware,                     // 2. Multi-tenant
  requireRole(['OWNER', 'ADMIN', 'MEMBER']), // 3. RBAC
  idempotencyMiddleware,                // 4. Idempotencia
  quotaMiddleware,                      // 5. Cuota IA (si aplica)
  validate(crearExpedienteSchema),      // 6. Validación Zod
  async (req, res, next) => {
    // Handler con decoradores
    const handler = pipe(
      withLogging('expediente.crear'),
      withValidation(crearExpedienteSchema),
      withIdempotency({ keyFn: (input) => `exp:${input.numero}` }),
    )(crearExpedienteHandler);

    const result = await handler(req.body, { tenantId: req.tenantId, userId: req.user.id });
    res.json({ success: true, data: result.value });
  }
);

export default router;
```

## Pipeline .NET 8 (MediatR + Behaviors)

### Orden de Behaviors (INMUTABLE)

```
1. LoggingBehaviour        → log entrada/salida con duración
2. ValidationBehaviour     → FluentValidation
3. TenantValidationBehavior→ filtra por organization_id
4. PlanLimitsBehavior      → valida límites del plan (Free/Pro/Enterprise)
5. IdempotencyBehaviour    → dedupe por clave
6. AuditBehaviour          → escribe en audit_log
7. AuthorizationBehaviour  → verifica [Authorize] attributes
8. HANDLER                 → lógica de negocio
```

### Implementación típica

```csharp
// Program.cs — registro de pipeline
builder.Services.AddMediatR(cfg => {
    cfg.RegisterServicesFromAssembly(typeof(Program).Assembly);
    cfg.AddOpenBehavior(typeof(LoggingBehaviour<,>));
    cfg.AddOpenBehavior(typeof(ValidationBehaviour<,>));
    cfg.AddOpenBehavior(typeof(TenantValidationBehavior<,>));
    cfg.AddOpenBehavior(typeof(PlanLimitsBehavior<,>));
    cfg.AddOpenBehavior(typeof(IdempotencyBehaviour<,>));
    cfg.AddOpenBehavior(typeof(AuditBehaviour<,>));
});

// Command
public class CrearExpedienteCommand : IRequest<Result<Guid>>, ITenantRequest
{
    public Guid OrganizationId { get; set; }
    public string Numero { get; set; }
    public string Materia { get; set; }
    // ...
}

// Handler
public class CrearExpedienteHandler : IRequestHandler<CrearExpedienteCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CrearExpedienteCommand request, CancellationToken ct)
    {
        var id = Guid.NewGuid();
        await _repo.CreateAsync(new Expediente { Id = id, ... }, ct);
        await _events.EmitAsync("expediente.creado", new { id }, ct);
        return Result.Ok(id);
    }
}
```

### Behavior personalizado (ejemplo: TenantValidationBehavior)

```csharp
public class TenantValidationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : ITenantRequest
{
    private readonly ITenantProvider _tenant;
    private readonly ILogger<TenantValidationBehavior<TRequest, TResponse>> _logger;

    public TenantValidationBehavior(ITenantProvider tenant, ILogger<...> logger)
    {
        _tenant = tenant;
        _logger = logger;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken ct)
    {
        // 1. Verificar OrganizationId del request == OrganizationId del usuario
        if (request.OrganizationId != _tenant.OrganizationId)
        {
            _logger.LogWarning("multi-tenant.violation", new {
                requestOrg = request.OrganizationId,
                userOrg = _tenant.OrganizationId,
            });
            throw new UnauthorizedAccessException("Cross-tenant access blocked");
        }

        // 2. Continuar pipeline
        return await next();
    }
}
```

## Decoradores transversales (composición funcional)

Ver skill dedicada: `decoradores-patterns.md`. Resumen:

- `withLogging(opName)` — log entrada/salida con duración
- `withTiming(opName)` — métricas
- `withRetry({retries, backoff, shouldRetry})` — reintentos
- `withValidation(schema)` — validación Zod/Fluent
- `withCircuitBreaker({failureThreshold, cooldownMs})` — protección de deps externas
- `withIdempotency({keyFn, windowMs})` — dedupe
- `memoize({ttlMs, keyFn})` — cache en memoria

## Audit log

Cada protocolo emite un evento específico:

| Protocolo | Evento | Payload |
|---|---|---|
| Auth | `AUTH_SUCCESS` / `AUTH_FAILURE` | userId, ip, userAgent |
| Tenant | `TENANT_VALIDATED` | orgId, userId |
| RBAC | `RBAC_DENIED` | userId, required, actual |
| Idempotency | `IDEMPOTENT_REPLAY` | key, originalTimestamp |
| Quota | `QUOTA_CONSUMED` | userId, tokens, cost |
| Audit | `AUDIT_WRITTEN` | entity, action, orgId |

## Quality gates

- [ ] Pipeline completo respetado (orden INMUTABLE)
- [ ] Ningún endpoint sin `authMiddleware` + `tenantMiddleware`
- [ ] Todo POST mutable con `idempotencyMiddleware`
- [ ] Todo endpoint IA con `quotaMiddleware`
- [ ] Todo command/query con `ITenantRequest` si toca datos por org
- [ ] Logs estructurados con `correlationId`
- [ ] Métricas Prometheus: `pipeline.{protocol}.{duration_ms,count}`

## Referencias

- `legalpro-app/server/middleware/` (10 middlewares actuales)
- `legalpro-app/server/core/decorators.js` (8 decoradores)
- `legalpro-app/server/core/EventBus.js` (Observer pattern)
- `LegalPro.Application/Behaviors/` (.NET)
- ADR-001: Clean Architecture
- ADR-002: Adapter Pattern
- MediatR: https://github.com/jbogard/MediatR/wiki
- Express middleware: https://expressjs.com/en/guide/using-middleware.html
- Cross-cutting concerns (AOSD): https://en.wikipedia.org/wiki/Cross-cutting_concern
