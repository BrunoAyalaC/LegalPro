# ADR-002: Patrón Adapter para Proveedores Externos

> **Status**: Accepted
> **Date**: 2026-06-12
> **Deciders**: @arquitecto-chief, @backend-node, @integraciones-peru, @abogado-chief

## Context

LegalPro se integra con múltiples proveedores externos:
- **Google Gemini** (IA)
- **Supabase** (Postgres + Auth + Storage)
- **Railway** (Hosting)
- **BCRP** (Tasa de interés)
- **SUNAT** (futuro)
- **Stripe/Culqi** (Pagos)
- **Email** (Resend/SendGrid)
- **SMS** (Twilio)
- **PJ/SINOE/SPIJ** (Poder Judicial)

Cada proveedor tiene su propia API, SDK, errores, y peculiaridades. Si el código de negocio está acoplado a cada uno:
- Cambiar de proveedor = reescribir todo
- Testear = mocks complicados
- Caída de un proveedor = caída total

## Decision Drivers

- **Mantenibilidad**: Cambiar de proveedor sin reescribir
- **Testabilidad**: Mockear fácilmente
- **Resiliencia**: Circuit breaker + fallback
- **Vendor lock-in**: Evitar dependencia excesiva

## Considered Options

### Option 1: Integración directa (status quo)

**Pros**: Simple al inicio
**Cons**: Acoplamiento, vendor lock-in, difícil de testear

### Option 2: Patrón Adapter + Interfaces (ELEGIDA)

**Pros**: 
- Cambiar de proveedor sin tocar negocio
- Mockear para tests
- Circuit breaker
- Versionado de contratos

**Cons**: Más boilerplate, más archivos

### Option 3: Service Mesh (Istio, Linkerd)

**Pros**: Resilience automática
**Cons**: Complejidad operacional, no resuelve contratos

## Decision Outcome

**Chosen option**: "Option 2: Patrón Adapter"

Implementaremos adaptadores con **contratos internos** (interfaces) que aíslan al sistema de los detalles de cada proveedor.

### Estructura

```
legalpro-app/server/adapters/
├── GeminiAdapter.js       # IGeminiService
├── BcrpAdapter.js         # IBcrpProvider
├── SinoeAdapter.js        # ISinoeProvider
├── SpijAdapter.js         # ISpijProvider
├── SunatAdapter.js        # ISunatProvider
├── EmailAdapter.js        # IEmailProvider
├── SmsAdapter.js          # ISmsProvider
└── (futuro: PaymentAdapter)
```

### Contrato (interface) ejemplo

```typescript
interface IGeminiService {
  generateContent(prompt: string, opts: GeminiOpts): Promise<GeminiResponse>;
  functionCall(tools: ToolDecl[], messages: Message[]): Promise<FunctionCallResponse>;
}
```

### Adapter ejemplo

```javascript
class GeminiAdapter {
  async generateContent(prompt, opts) {
    // 1. Pre-flight: validar consentimiento LPDP
    // 2. Circuit breaker: si está abierto, fallback
    // 3. Cache: si ya tenemos respuesta, devolver
    // 4. Llamada real al SDK
    // 5. Post-process: validar citas, sanitizar
    // 6. Audit log
    // 7. Retornar respuesta estructurada
  }
}
```

### Dependency Injection

```javascript
// En server/index.js
const geminiAdapter = new GeminiAdapter(process.env.GEMINI_API_KEY);
const bcrpAdapter = new BcrpAdapter({ mode: 'mock' });

// Pasar a las rutas
app.use('/api/analista', (req, res, next) => {
  req.gemini = geminiAdapter;
  next();
}, analistaRoutes);
```

### Consequences

**Positivas**:
- Test con mock = trivial
- Cambiar de Gemini a Claude = cambiar 1 archivo
- Circuit breaker automático
- Audit log centralizado

**Negativas**:
- 1 archivo extra por proveedor
- Más boilerplate (aceptado por resiliencia)

## Implementation Notes

### Catálogo de Adaptadores

Ver `catalogs/adaptadores.json` con los 10 adaptadores actuales y planeados.

### Test con Mocks

```javascript
// tests
import { GeminiAdapter } from '../adapters/GeminiAdapter.js';
const mockAdapter = { generateContent: () => ({ text: 'mock' }) };
```

### Circuit Breaker

```javascript
if (consecutiveErrors >= 5) {
  circuitOpen = true;
  // 60s sin intentar
  return fallback;
}
```

## References

- `catalogs/adaptadores.json`
- `catalogs/contratos.json`
- ADR-001 (Clean Architecture)
- `tools/verifiers/verifier-adaptadores.mjs`
