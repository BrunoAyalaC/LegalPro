---
name: adaptadores-externos
description: Adapter Pattern para servicios externos (BCRP, SUNAT, SPIJ, SINOE, SMS, EMAIL, CULQI, INDECOPI). Contrato canonico, fallback graceful, circuit breaker, cache.
when-to-use: "Cuando se necesite integrar con un servicio externo nuevo o refactorizar uno existente"
allowed-tools: Read, Write, Edit, Grep, Glob
updated: 2026-07-31
patron: Adapter (GOF) + Port & Adapter (Hexagonal)
adapters-existentes: [BCRP, EMAIL, MINIMAX, SINOE, SMS, SPIJ, SUNAT, CULQI]
---

# adaptadores-externos (v3.0 RAG-optimized)

Documenta el patrón **Adapter (GOF)** + **Port & Adapter (Hexagonal)** para integración con servicios externos. Garantiza contrato canónico, fallback graceful, circuit breaker, cache y observabilidad.

## Inputs

```yaml
servicio_externo: BCRP | SUNAT | SPIJ | SINOE | SMS | EMAIL | CULQI | MINIMAX | INDECOPI | NUEVO
operacion: string  # ej: 'getTipoCambio', 'consultarRuc', 'buscarJurisprudencia'
parametros: object
requiere_cache: bool       # default true para consultas
requiere_circuit_breaker: bool  # default true
requiere_fallback: bool    # respuesta default si falla
```

## Contrato canónico de Adapter

Todo adapter debe implementar:

```typescript
interface Adapter<TInput, TOutput> {
  readonly name: string;                          // ej: 'BCRP'
  readonly version: string;                       // ej: '1.0.0'
  readonly baseURL: string;
  readonly timeoutMs: number;                     // default 5000
  readonly cacheTTL?: number;                     // en ms, default 60000

  execute(operation: string, input: TInput): Promise<AdapterResult<TOutput>>;
  healthCheck(): Promise<boolean>;
}

type AdapterResult<T> =
  | { ok: true; data: T; cached?: boolean; latencyMs: number; source: string }
  | { ok: false; error: AdapterError; retryable: boolean };
```

## Adaptadores existentes (julio 2026)

### 1. BCRPAdapter — Tipo de cambio

```javascript
import { BCRPAdapter } from './adapters/BCRPAdapter.js';

const adapter = new BCRPAdapter({ baseURL: process.env.BCRP_URL });
const result = await adapter.execute('getTipoCambio', { fecha: '2026-07-31' });
// { ok: true, data: { compra: 3.75, venta: 3.78 }, cached: false, latencyMs: 145 }
```

- **Operaciones**: `getTipoCambio`, `getTasaInteres`
- **Cache TTL**: 6 horas (3600000 ms)
- **Fallback**: último valor conocido en cache
- **URL**: https://www.bcrp.gob.pe/

### 2. SUNATAdapter — RUC, tributos

- **Operaciones**: `consultarRuc(ruc)`, `consultarTributos(dni/ruc)`, `consultarComprobante(serie, numero)`
- **Cache TTL**: 24 horas para RUC, 1 hora para tributos
- **Fallback**: marcar como `pending_verification`
- **Mock-first**: ver `tools/seed/sunat-mock.json`

### 3. SPIJAdapter — Jurisprudencia peruana

- **Operaciones**: `buscarNorma(query)`, `getArticulo(codigo, articulo)`, `listarModificaciones(codigo)`
- **Cache TTL**: 7 días para normas, 1 día para modificaciones
- **URL**: https://spij.minjus.gob.pe/
- **Nota**: cuando no hay API pública, usar scraping con rate limit estricto

### 4. SINOEAdapter — Notificaciones judiciales electrónicas

- **Operaciones**: `getNotificaciones(usuarioId)`, `marcarLeida(notifId)`
- **Cache TTL**: 5 minutos
- **Mock-first**: cuando no hay credenciales reales
- **Runbook**: `RB-006-pg-down.md`

### 5. SMSAdapter — Twilio / mock local

- **Operaciones**: `enviarSMS(telefono, mensaje)`
- **Rate limit**: 1 SMS/seg por número, 100/hora por org
- **Fallback**: cola de reintentos

### 6. EmailAdapter — SendGrid / SMTP / mock

- **Operaciones**: `enviarEmail(to, subject, html)`, `enviarTemplate(templateId, vars)`
- **Templates canónicos**: bienvenida, recuperación, alerta, notificación
- **Retry**: 3 intentos con backoff

### 7. MinimaxAdapter — IA generativa

Ver skill dedicada: `configurar-minimax`.

### 8. CULQIAdapter — Pagos con tarjeta

- **Operaciones**: `createCharge(token, monto, metadata)`, `refund(chargeId)`
- **Idempotencia obligatoria** (clave en metadata)
- **Webhook**: `webhooks/stripe-handler.js` (similar pattern)

## Estructura de un Adapter

```
legalpro-app/server/adapters/
├── BCRPAdapter.js
├── SUNATAdapter.js
├── SPIJAdapter.js
├── SINOEAdapter.js
├── SMSAdapter.js
├── EmailAdapter.js
├── CULQIAdapter.js
└── base/
    ├── BaseAdapter.js    # Implementación común
    ├── AdapterError.js   # Clase de error tipada
    └── cache.js          # Helper de cache
```

## Ejemplo completo (BCRP)

```javascript
import { BaseAdapter } from './base/BaseAdapter.js';
import { withCircuitBreaker, memoize, withRetry } from '../core/decorators.js';
import { logger } from '../logger.js';

export class BCRPAdapter extends BaseAdapter {
  constructor({ baseURL, apiKey }) {
    super({
      name: 'BCRP',
      version: '1.0.0',
      baseURL,
      timeoutMs: 5000,
      cacheTTL: 6 * 60 * 60 * 1000, // 6h
    });
    this.apiKey = apiKey;

    // Composición de decoradores
    this.fetchTipoCambio = pipe(
      withCircuitBreaker({ failureThreshold: 5, cooldownMs: 60_000, name: 'bcrp' }),
      withRetry({ retries: 2, shouldRetry: (e) => e.code === 'ETIMEDOUT' }),
      memoize({ ttlMs: this.cacheTTL }),
    )(this._fetchTipoCambio.bind(this));
  }

  async execute(operation, input) {
    if (operation === 'getTipoCambio') {
      const result = await this.fetchTipoCambio(input);
      return { ok: true, data: result, latencyMs: 0, source: 'BCRP' };
    }
    return { ok: false, error: new Error(`Unknown op: ${operation}`), retryable: false };
  }

  async _fetchTipoCambio({ fecha }) {
    const url = `${this.baseURL}/tipo-cambio/${fecha}`;
    const response = await fetch(url, {
      headers: { 'X-API-Key': this.apiKey },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw Object.assign(new Error(`BCRP ${response.status}`), { code: response.status });
    return await response.json();
  }

  async healthCheck() {
    try {
      await this._fetchTipoCambio({ fecha: new Date().toISOString().slice(0, 10) });
      return true;
    } catch {
      return false;
    }
  }
}
```

## Uso desde un servicio de dominio

```javascript
import { BCRPAdapter } from '../adapters/BCRPAdapter.js';

const bcrp = new BCRPAdapter({ baseURL: process.env.BCRP_URL, apiKey: process.env.BCRP_KEY });

export const liquidarMonedaService = async (monto, moneda, fecha) => {
  if (moneda === 'PEN') return monto;

  const tc = await bcrp.execute('getTipoCambio', { fecha });
  if (!tc.ok) {
    logger.warn('liquidacion.tc_fallback', { error: tc.error });
    return monto; // fallback: asimilar a PEN
  }

  return monto * tc.data.venta;
};
```

## Quality gates

- [ ] Implementa contrato `Adapter<TInput, TOutput>`
- [ ] `healthCheck()` funcional
- [ ] Circuit breaker configurado
- [ ] Cache TTL calibrado
- [ ] Fallback explícito si `requiere_fallback: true`
- [ ] Logs estructurados con `name` + `operation` + `latencyMs`
- [ ] Tests con mock (no llama al servicio real en CI)
- [ ] Documentación en JSDoc

## Audit log

Emitir `ADAPTER_CALLED` con payload: `name, version, operation, latencyMs, ok, retryable`.

## Referencias

- `legalpro-app/server/adapters/` (8 adapters actuales)
- `legalpro-app/server/adapters/CulqiAdapter.js` (ejemplo de implementación)
- `legalpro-app/server/core/decorators.js` (con Circuit Breaker, Retry, Memoize)
- `legalpro-app/server/core/Container.js` (DI de adapters)
- ADR-002: Adapter Pattern (firmado)
- `catalogs/adaptadores.json` (catálogo de adapters)
- `arneses/runbooks/RB-005-gemini-deprecation.md`
