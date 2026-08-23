---
name: decoradores-patterns
description: Guia completa del patron Decorator implementado como Higher-Order Functions (HOF) en ESM. Logging, retry, validation, timing, circuit breaker, idempotencia, memoizacion. Pipe composition.
when-to-use: "Cuando se necesite composicion de cross-cutting concerns, o wrapping de funciones con logica transversal"
allowed-tools: Read, Write, Edit, Grep, Glob
updated: 2026-07-31
patron: Decorator (Gang of Four) + HOF
implementacion: legalpro-app/server/core/decorators.js
---

# decoradores-patterns (v3.0 RAG-optimized)

Documenta el patrón **Decorator** implementado como **Higher-Order Functions (HOF)** en JavaScript ESM (sin transpiler de decorators TC39). Es el sistema de **composición de cross-cutting concerns** del backend Node.

## Inputs

```yaml
funcion_objetivo: function
decoradores_disponibles: [withLogging, withTiming, withRetry, withValidation, withCircuitBreaker, withIdempotency, memoize]
orden_exterior_a_interior: [log, timing, retry, validation, idempotency, fn]
```

## Decoradores disponibles (8)

### 1. `pipe(...decorators)(fn)`

Compone decoradores de izquierda a derecha. El primer decorador es el más externo.

```javascript
import { pipe, withLogging, withRetry, withValidation } from '../core/decorators.js';

const safeCrearExpediente = pipe(
  withLogging('crearExpediente'),
  withValidation(crearExpedienteSchema),
  withRetry({ retries: 2, shouldRetry: (e) => e.code === 'ETIMEDOUT' }),
)(crearExpedienteHandler);
```

### 2. `withLogging(name)` — Log estructurado

Registra `op.start`, `op.success`, `op.business_error`, `op.exception` con duración.

```javascript
const logged = withLogging('user.create')(createUser);
// Output: { op: 'user.create', duration: 145ms }
```

### 3. `withTiming(name)` — Métricas de duración

Adjunta duración `ms` al log de debug.

### 4. `withRetry({retries, delayMs, backoff, shouldRetry})` — Reintentos con backoff exponencial

```javascript
const retried = withRetry({
  retries: 3,
  delayMs: 1000,
  backoff: 2,
  shouldRetry: (e) => ['ETIMEDOUT', 'ECONNRESET', 429, 503].includes(e.code || e.status),
})(fetchData);
```

### 5. `withValidation(schema)` — Validación pre-ejecución

Soporta Zod-like (`safeParse`) o función `(input) => { ok, error }`. Falla con `Err('VALIDATION_ERROR', 422)`.

```javascript
const validated = withValidation(z.object({ nombre: z.string(), edad: z.number().min(0) }))(createUser);
```

### 6. `withCircuitBreaker({failureThreshold, cooldownMs, name})` — Protección de dependencias externas

Estados: `CLOSED → OPEN → HALF_OPEN → CLOSED`. Tras N fallos consecutivos abre el circuito; tras cooldown prueba 1 request.

```javascript
const safeChat = withCircuitBreaker({
  failureThreshold: 5,
  cooldownMs: 60_000,
  name: 'minimax',
})(rawChat);
```

### 7. `memoize({ttlMs, keyFn})` — Caché con TTL

Cachea resultados por clave. TTL configurable. Evita crecimiento ilimitado (max 1000 entries).

```javascript
const cachedCatalog = memoize({ ttlMs: 60_000, keyFn: (cat) => cat })(loadCatalog);
```

### 8. `withIdempotency({keyFn, windowMs})` — Deduplicación por clave

Previene doble procesamiento (pagos, creación de expedientes). Complementa `idempotencyMiddleware` HTTP.

```javascript
const dedup = withIdempotency({
  keyFn: (input) => `pago:${input.userId}:${input.amount}`,
  windowMs: 600_000,  // 10 min
})(procesarPago);
```

## Patrón de uso: composición completa

```javascript
import {
  pipe, withLogging, withTiming, withRetry, withValidation,
  withCircuitBreaker, withIdempotency, memoize
} from '../core/decorators.js';

export const safeCrearExpediente = pipe(
  withLogging('expediente.crear'),        // 1. Log entrada/salida
  withTiming('expediente.crear'),         // 2. Métricas de duración
  withRetry({                             // 3. Reintentos para errores transitorios
    retries: 2,
    shouldRetry: (e) => e.code === 'ETIMEDOUT',
  }),
  withValidation(expedienteSchema),       // 4. Validación pre-ejecución
  withIdempotency({                       // 5. Deduplicación
    keyFn: (input) => `exp:${input.numero}`,
    windowMs: 600_000,
  }),
)(crearExpedienteHandler);
```

## Quality gates

- [ ] Decoradores compuestos vía `pipe()`
- [ ] Orden lógico: log → timing → retry → validation → idempotency → fn
- [ ] `shouldRetry` explícito (no reintentar errores 4xx)
- [ ] `keyFn` determinístico en `withIdempotency`
- [ ] `failureThreshold` y `cooldownMs` calibrados
- [ ] Tests de cada decorador aislado

## Audit log

No emite eventos directamente; cada decorador emite su log estructurado. Los eventos de auditoría se emiten desde el `domainEvents`.

## Referencias

- `legalpro-app/server/core/decorators.js` (implementación canónica)
- `legalpro-app/server/core/Result.js` (Ok/Err pattern)
- `legalpro-app/server/core/EventBus.js` (Observer pattern)
- `legalpro-app/server/core/Container.js` (DI)
- Gang of Four — Decorator Pattern
- Functional programming: HOF, composition, monads
