---
name: observadores-eventos
description: Patron Observer + Event Bus desacoplado con outbox opcional, prioridad, wildcard, isolation de errores. Base de CQRS, auditoria, notificaciones, idempotencia eventual.
when-to-use: "Cuando se necesite desacoplar logica de negocio de side effects (audit, email, notifications, recalcs)"
allowed-tools: Read, Write, Edit, Grep, Glob
updated: 2026-07-31
patron: Observer (GOF) + Event Bus + Transactional Outbox
implementacion: legalpro-app/server/core/EventBus.js
---

# observadores-eventos (v3.0 RAG-optimized)

Documenta el patrón **Observer** implementado como **EventBus** desacoplado. Permite que un handler de comando publique eventos y múltiples suscriptores reaccionen **sin que el comando los conozca**. Base de **CQRS, auditoría, notificaciones, recalcs**. **Transactional Outbox opcional** garantiza entrega fiable.

## Inputs

```yaml
tipo_evento: string  # ej: 'expediente.creado', 'pago.procesado'
payload: object       # datos del evento (no sensibles)
meta:                 # metadatos de contexto
  orgId: uuid
  userId: uuid
  correlationId: uuid
suscriptores: [array de funciones]
prioridad: int        # default 100, menor = antes
wildcard: bool        # escuchar TODOS los eventos
```

## Output schema (evento)

```json
{
  "eventId": "uuid",
  "type": "string",
  "payload": "object",
  "meta": {
    "orgId": "uuid",
    "userId": "uuid",
    "correlationId": "uuid"
  },
  "occurredAt": "iso8601"
}
```

## API del EventBus

### `on(type, fn, {priority, once})` — Suscribir handler

```javascript
import { domainEvents } from '../core/EventBus.js';

domainEvents.on('expediente.creado', async (evt) => {
  await notificarAbogado(evt.payload);
}, { priority: 100 });

domainEvents.on('*', async (evt) => {
  await auditLog.append({ type: evt.type, payload: evt.payload, meta: evt.meta });
}, { priority: 999 });  // Auditoría global al final
```

### `once(type, fn)` — Suscripción de un solo uso

```javascript
domainEvents.once('usuario.primer.login', async (evt) => {
  await enviarBienvenida(evt.payload);
});
```

### `off(type, fn)` — Desuscribir

```javascript
const unsubscribe = domainEvents.on('expediente.creado', handler);
// ...
unsubscribe();  // desuscribe
```

### `emit(type, payload, meta)` — Publicar evento

```javascript
await domainEvents.emit('expediente.creado', { id, numero }, {
  orgId: req.tenantId,
  userId: req.user.id,
  correlationId: req.correlationId,
});
// → { delivered: 5, failed: 0 }
```

## Características clave

1. **Handlers sync y async** — soportados transparentemente.
2. **Prioridad** — orden estable ascendente (menor = primero).
3. **Wildcard `*`** — escucha global (útil para auditoría).
4. **Aislamiento de errores** — un suscriptor que lanza NO rompe a los demás.
5. **Outbox opcional** — si se inyecta `outbox.append(event)`, cada evento se persiste ANTES de despachar (transactional outbox).
6. **`once`** — suscripciones de un solo uso.

## Patrón CQRS + EventBus

```javascript
// Command Handler (escritura)
const crearExpedienteHandler = async (input, ctx) => {
  // 1. Validar
  // 2. Persistir
  const expediente = await expedienteRepo.create(input, ctx.tenantId);

  // 3. Emitir evento de dominio (desacoplado)
  await domainEvents.emit('expediente.creado', expediente, { orgId: ctx.tenantId });

  return Result.Ok(expediente);
};

// Query Handler (lectura) — separado
const listarExpedientesHandler = async (filter, ctx) => {
  return await expedienteRepo.find(filter, ctx.tenantId);
};
```

## Patrón Transactional Outbox

Para **entrega garantizada** (ej. no perder emails de bienvenida):

```javascript
// 1. Persistir outbox en la misma transacción que el cambio de estado
await db.tx(async (trx) => {
  await expedienteRepo.create(expediente, trx);
  await outbox.append({ type: 'expediente.creado', payload: expediente }, trx);
});

// 2. Despachar outbox a EventBus (proceso separado, retry, dedupe)
const eventBus = new EventBus({ outbox });
await eventBus.emit(outboxEvent.type, outboxEvent.payload, outboxEvent.meta);
```

## Casos de uso

| Evento | Suscriptores típicos |
|---|---|
| `expediente.creado` | notificar abogado, audit, indexar búsqueda, recalcular stats |
| `pago.procesado` | email confirmación, descuento créditos, audit |
| `documento.firmado` | hash verificación, audit, notificar contraparte |
| `usuario.primer.login` | email bienvenida, tutorial, audit |
| `*` | audit global, métricas Prometheus, log estructurado |

## Quality gates

- [ ] Nombres de eventos en `snake_case` o `dot.case` (consistente)
- [ ] Handlers async con manejo de errores explícito
- [ ] `priority` asignada coherentemente
- [ ] Outbox configurado si el evento es crítico
- [ ] Tests de aislamiento de errores
- [ ] Tests de dedupe (con `outbox`)
- [ ] Métricas: `eventbus.{type}.{delivered,failed}`

## Audit log

Cada `emit` exitoso puede emitir un evento `EVENT_PUBLISHED` con: `eventId, type, delivered, failed`.

## Referencias

- `legalpro-app/server/core/EventBus.js` (implementación canónica)
- `legalpro-app/server/core/CqrsBus.js` (CQRS bus)
- `legalpro-app/server/utils/audit.js` (audit log)
- Martin Fowler — Event Sourcing
- Microsoft — Transactional Outbox Pattern
- Apache Kafka — Event-driven architecture
