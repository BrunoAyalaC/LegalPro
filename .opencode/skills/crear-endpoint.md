---
name: crear-endpoint
description: Crea endpoint REST backend (Node 20 Express 5 ESM o .NET 8 ASP.NET Core CQRS) con auth, RBAC, multi-tenant, validacion, audit log, tests, OpenAPI.
when-to-use: "Cuando se pida crear/modificar un endpoint REST nuevo, o refactorizar uno existente"
allowed-tools: Read, Write, Edit, Grep, Glob
updated: 2026-07-31
stacks: [node-express-5-esm, dotnet-8-cqrs]
patrones: [Repository, Adapter, Decorator, Observer/EventBus, Result, CQRS]
---

# crear-endpoint (v3.0 RAG-optimized)

Crea endpoints REST con arquitectura hexagonal: **Repository + Adapter + Decorator + Observer/EventBus + Result + CQRS**. Alineado con Clean Architecture y patrones SOLID. **A julio 2026**.

## Inputs

```yaml
stack: node-express-5-esm | dotnet-8-cqrs
metodo: GET | POST | PUT | DELETE | PATCH
ruta: string  # ej: /api/expedientes
requiere_auth: bool
roles_permitidos: [OWNER | ADMIN | MEMBER | VIEWER]
schema_entrada: JSONSchema | ZodSchema | FluentValidation
schema_salida: JSONSchema | ZodSchema
afecta_multitenant: bool
requiere_idempotencia: bool       # POST mutables
requiere_auditoria: bool
requiere_quota_ia: bool            # si llama a MiniMax
adapter_externo: [BCRP, SUNAT, SPIJ, SINOE, SMS, EMAIL, CULQI]
```

## Output (producción-ready)

- Ruta (Node) o Controller + Command/Query (dotnet)
- Validator (Zod/FluentValidation)
- Repository (PG + Supabase)
- Tests unit + integration (Vitest/xUnit)
- Audit event automático
- Documentación OpenAPI 3.1
- Decoradores (logging, retry, circuit breaker, idempotencia)

## Pasos (protocolo RAG)

### Para Node (Express 5 ESM)

1. **Crear archivo** en `legalpro-app/server/routes/<ruta>.js`
2. **Implementar handler con pipeline de middlewares**:
   ```javascript
   import { Router } from 'express';
   import { authMiddleware } from '../middleware/authMiddleware.js';
   import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
   import { requireRole } from '../middleware/requireRole.js';
   import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware.js';
   import { quotaMiddleware } from '../middleware/quotaMiddleware.js';
   import { validate } from '../middleware/validate.js';
   import { z } from 'zod';
   import { logger } from '../logger.js';
   import { Result, Ok, Err } from '../core/Result.js';
   import { domainEvents } from '../core/EventBus.js';
   import { withLogging, withValidation, withIdempotency } from '../core/decorators.js';

   const router = Router();

   const crearExpedienteSchema = z.object({
     numero: z.string().min(1),
     materia: z.enum(['penal', 'civil', 'laboral', 'familia']),
     partes: z.array(z.object({ rol: z.string(), nombre: z.string() })),
   });

   const handler = pipe(
     withLogging('expediente.crear'),
     withValidation(crearExpedienteSchema),
     withIdempotency({ keyFn: (input) => `exp:${input.numero}` }),
   )(async (input, ctx) => {
     // Lógica de dominio
     const result = await expedienteRepo.create(input, ctx.tenantId);
     await domainEvents.emit('expediente.creado', result, { orgId: ctx.tenantId });
     return Result.Ok(result);
   });

   router.post('/',
     authMiddleware,
     tenantMiddleware,
     requireRole(['OWNER', 'ADMIN', 'MEMBER']),
     idempotencyMiddleware,
     validate(crearExpedienteSchema),
     async (req, res, next) => {
       try {
         const result = await handler(req.body, { tenantId: req.tenantId, userId: req.user.id });
         if (result.isErr) return res.status(result.status).json({ success: false, error: result, correlationId: req.correlationId });
         res.status(201).json({ success: true, data: result.value, correlationId: req.correlationId });
       } catch (e) { next(e); }
     }
   );

   export default router;
   ```
3. **Agregar test** en `legalpro-app/server/__tests__/<ruta>.test.js` (Vitest + Supertest)
4. **Documentar** en OpenAPI 3.1 (futuro) + README

### Para .NET 8 (ASP.NET Core + CQRS)

1. **Crear Controller delgado** en `LegalPro.Api/Controllers/`
2. **Crear Command/Query + Handler + Validator + Pipeline Behaviors**
3. **Pipeline Behaviors** (orden):
   - `LoggingBehaviour`
   - `ValidationBehaviour` (FluentValidation)
   - `TenantValidationBehavior` (filtra por `organization_id`)
   - `PlanLimitsBehavior` (si tiene límite)
   - `IdempotencyBehavior` (POST mutables)
   - `AuditBehavior` (escribe en `audit_log`)
4. **Tests**:
   - Unit: `LegalPro.UnitTests/` (xUnit + Moq + FluentAssertions)
   - Integration: `LegalPro.IntegrationTests/`

## Pipeline Behaviors (.NET 8)

```csharp
// Pipeline behavior example (TenantValidationBehavior)
public class TenantValidationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : ITenantRequest
{
    private readonly ITenantProvider _tenant;
    public TenantValidationBehavior(ITenantProvider tenant) => _tenant = tenant;

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        if (request.OrganizationId != _tenant.OrganizationId)
            throw new UnauthorizedAccessException("Cross-tenant access blocked");
        return await next();
    }
}
```

## Decoradores transversales (reutilizables)

- `withLogging(opName)` — log entrada/salida con duración
- `withTiming(opName)` — adjunta `ms` al log
- `withRetry({retries, delayMs, backoff, shouldRetry})` — reintentos selectivos
- `withValidation(schema)` — validación Zod/FluentValidation pre-ejecución
- `withCircuitBreaker({failureThreshold, cooldownMs})` — protección de deps externas
- `withIdempotency({keyFn, windowMs})` — dedupe por clave
- `memoize({ttlMs, keyFn})` — caché en memoria

Ver `legalpro-app/server/core/decorators.js` para implementación.

## Observabilidad (EventBus)

```javascript
// Al crear expediente, emitir evento
await domainEvents.emit('expediente.creado', { id, numero }, { orgId, userId, correlationId });

// Suscriptor: notificar abogado
domainEvents.on('expediente.creado', async (evt) => {
  await notificarAbogado(evt.payload);
}, { priority: 100 });

// Auditoría global
domainEvents.on('*', async (evt) => {
  await auditLog.append({ type: evt.type, payload: evt.payload, meta: evt.meta });
});
```

## Quality gates

- [ ] Auth + RBAC correctos
- [ ] Multi-tenant: `ITenantRequest` + filtro `organization_id`
- [ ] Validación Zod/FluentValidation
- [ ] Audit log emitido
- [ ] Idempotencia en POST mutables
- [ ] Rate limit si toca IA
- [ ] Tests unit + integration pasan
- [ ] Cobertura ≥ 80%
- [ ] Documentación OpenAPI 3.1 actualizada
- [ ] Sin N+1 queries
- [ ] Latencia p95 < SLO

## Audit log

Emitir `ENDPOINT_CREATED` con payload: `stack, metodo, ruta, autor, fecha, roles_permitidos`.

## Referencias

- `.opencode/agents/backend-node.md`
- `.opencode/agents/backend-dotnet.md`
- `.opencode/rules/node-express.md`
- `.opencode/rules/dotnet-cqrs.md`
- `legalpro-app/server/core/decorators.js`
- `legalpro-app/server/core/EventBus.js`
- `legalpro-app/server/core/Container.js`
- `legalpro-app/server/core/Result.js`
- `tools/verifiers/verifier-owasp.mjs`
- `tools/verifiers/verifier-multi-tenant.mjs`
- `tools/verifiers/verifier-rbac.mjs`
- `tools/verifiers/verifier-idempotencia.mjs`
