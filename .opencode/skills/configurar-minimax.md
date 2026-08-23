---
name: configurar-minimax
description: Configura el cliente MiniMax M3 con Function Calling, system instruction, parametros de modelo, manejo de errores, sanitizacion PII, optimizacion RAG.
when-to-use: "Cuando se crea/modifica la integracion con MiniMax, o cuando se cambian prompts/agentes IA"
allowed-tools: Read, Write, Edit, Grep
updated: 2026-07-31
sdk-oficial: minimax-coding-plan/MiniMax-M3
sdk-npm-oficial: @minimax/sdk
modelos-disponibles: [MiniMax-M3, MiniMax-M2.5-highspeed, MiniMax-M3-large-context]
---

# configurar-minimax (v3.0 RAG-optimized)

Configura el cliente de IA **MiniMax M3** (de minimax-coding-plan) con Function Calling, manejo robusto de errores, sanitización PII obligatoria y optimizaciones para producción. **Alineado con la declaración conjunta de 61 autoridades sobre IA (23-feb-2026)**.

## ⚠️ SDK Correcto (CRÍTICO)

```javascript
// ✅ CORRECTO — Cliente oficial
import { MinimaxClient } from '@minimax/sdk';
// Modelos disponibles: MiniMax-M3 (default), MiniMax-M2.5-highspeed, MiniMax-M3-large-context
// NUNCA usar @google/genai ni @google-cloud/vertexai
```

## Inputs

```yaml
modelo: MiniMax-M3 | MiniMax-M2.5-highspeed | MiniMax-M3-large-context
temperatura: 0.0 - 1.0      # Recomendado: 0.0-0.3 para legal
max_tokens: int              # Default: 8192
function_calling_mode: AUTO | ANY | NONE
use_grounding: bool          # web_search (server tool de Minimax)
requiere_consentimiento_internacional: bool
multitenant: bool
```

## Output (cliente configurado)

- Cliente `MinimaxClient` configurado con `apiKey` desde env
- System instruction con base legal peruana + disclaimers
- Function declarations (de `catalogs/chat-intent-functions.json`)
- Manejo robusto de errores (429, 500, 504, 503)
- Audit log automático (`AI_REQUEST`)
- Sanitización PII pre-envío (LPDP art. 21)

## Pasos (protocolo RAG)

### Para Node (ESM)

```javascript
import { MinimaxClient } from '@minimax/sdk';
// El catálogo canónico de Function Declarations del router de intenciones:
import chatIntentFunctions from '../catalogs/chat-intent-functions.json' with { type: 'json' };
import { promptSanitizer } from '../middleware/promptSanitizer.js';
import { logger } from '../logger.js';

const ai = new MinimaxClient({
  apiKey: process.env.MINIMAX_API_KEY,
  baseURL: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.chat/v1',
  timeout: 30_000,
  retries: 3,
});

const SYSTEM_INSTRUCTION = `
Eres un asistente jurídico especializado en el ordenamiento peruano.
Bases legales: Constitución 1993, CC, CP, CPC, NCPP, LPCL, Ley 29733 LPDP, TUO IGV, TUO IR.
Idioma: es-PE.
Disclaimers OBLIGATORIOS en cada output (LOPJ art. 290, CPC art. 132, CP art. 12).
NUNCA sustituyas la asesoría de un abogado colegiado.
`;

const response = await ai.chat.completions.create({
  model: process.env.MINIMAX_MODEL_DEFAULT || 'MiniMax-M3',
  temperature: 0.2,
  max_tokens: 8192,
  messages: [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    { role: 'user', content: await promptSanitizer.envolverContenidoUsuario(userInput) },
  ],
  tools: [{
    type: 'function',
    // functionDeclarations canónicas desde catalogs/chat-intent-functions.json
    functionDeclarations: chatIntentFunctions.tools[0].functionDeclarations,
  }],
  tool_config: {
    function_calling_config: { mode: 'AUTO' },
  },
  // Grounding con búsqueda web cuando aplique (jurisprudencia, normas recientes)
  use_grounding: true,
});
```

### Para .NET 8/9

```csharp
using Minimax.SDK;

var client = new MinimaxClient(
    apiKey: Environment.GetEnvironmentVariable("MINIMAX_API_KEY"),
    baseUrl: Environment.GetEnvironmentVariable("MINIMAX_BASE_URL") ?? "https://api.minimaxi.chat/v1",
    timeout: TimeSpan.FromSeconds(30)
);

var request = new ChatRequest
{
    Model = "MiniMax-M3",
    Temperature = 0.2f,
    MaxOutputTokens = 8192,
    SystemInstruction = BuildSystemInstruction(),
    Tools = LoadFunctionDeclarations(),
    ToolConfig = new ToolConfig { FunctionCallingConfig = new() { Mode = "AUTO" } },
};

var response = await client.ChatAsync(request, userInputSanitized, ct);
```

## Optimización RAG 2026

1. **Compresión de contexto**: comprimir el prompt sin perder precisión (ahorro 20-40% tokens)
2. **Cache de respuestas**: Redis con TTL por tipo de análisis
3. **Function Calling forzado**: `mode: ANY` para tareas críticas (evita respuestas vagas)
4. **Calibración de temperatura**: 0.0 para determinismo legal, 0.3 para análisis exploratorio
5. **Few-shot examples**: 2-3 ejemplos concretos mejoran calidad 30%
6. **Grounding selectivo**: `use_grounding: true` SOLO cuando se necesita jurisprudencia reciente
7. **Streaming** para UX: en chat, usar SSE; en batch, usar full response

## Manejo robusto de errores

```javascript
import { withRetry, withCircuitBreaker } from '../core/decorators.js';

const safeChat = pipe(
  withLogging('minimax.chat'),
  withTiming('minimax.chat'),
  withRetry({
    retries: 3,
    delayMs: 1000,
    backoff: 2,
    shouldRetry: (e) => [429, 500, 502, 503, 504].includes(e.status),
  }),
  withCircuitBreaker({
    failureThreshold: 5,
    cooldownMs: 60_000,
    name: 'minimax',
  }),
)(rawChat);
```

## Quality gates

- [ ] SDK correcto: `MinimaxClient` (NUNCA `@google/genai`)
- [ ] System instruction con base legal peruana + 4+ disclaimers
- [ ] Function declarations de catálogo canónico
- [ ] Manejo de errores (429, 500, 502, 503, 504)
- [ ] Audit log `AI_REQUEST` emitido
- [ ] Validación PII antes de enviar (`promptSanitizer`)
- [ ] Validación de consentimiento de transferencia (LPDP art. 21)
- [ ] Circuit breaker configurado
- [ ] Fallback a respuesta cached si IA falla

## Audit log

Emitir `MINIMAX_CONFIGURED` con payload: `modelo, temperatura, function_count, prompt_sanitized, consent_internacional`.

## Referencias

- `catalogs/chat-intent-functions.json` (FC declaradas)
- `catalogs/disclaimers-ia.json` (4+ disclaimers obligatorios)
- `.opencode/rules/legal-prompts.md`
- `.opencode/rules/minimax-error-handling.md`
- MiniMax SDK docs: https://docs.minimaxi.chat/
- Declaración conjunta 61 autoridades sobre IA (23-feb-2026)
