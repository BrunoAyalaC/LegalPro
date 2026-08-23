---
description: Reglas de manejo de errores de MiniMax M3
globs:
  - "**/services/minimax*.{js,ts,cs}"
  - "**/MiniMaxService.cs"
---

# Reglas de Manejo de Errores de MiniMax M3

Aplicar estas reglas al manejar errores de MiniMax M3 API.

## Errores comunes

| Código | Significado | Acción |
|---|---|---|
| 400 | Bad Request | Validar schema del request |
| 401 | Unauthorized | Verificar API key |
| 403 | Permission Denied | Verificar scope de API key |
| 429 | Quota Exceeded | Esperar + retry con backoff |
| 500 | Internal Error | Retry con backoff exponencial |
| 503 | Service Unavailable | Circuit breaker abierto |
| 504 | Timeout | Aumentar timeout o retry |

## Patrón de retry

```javascript
async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (e.status === 429 && i < maxRetries - 1) {
        await sleep(Math.pow(2, i) * 1000);
        continue;
      }
      if (e.status >= 500 && i < maxRetries - 1) {
        await sleep(Math.pow(2, i) * 1000);
        continue;
      }
      throw e;
    }
  }
}
```

## Circuit Breaker

- Si 5+ errores consecutivos → abrir circuit
- Después de 60s → half-open (probar 1 request)
- Si OK → cerrar circuit
- Si falla → abrir de nuevo

## Fallback

- Si MiniMax falla → respuesta cached (si existe)
- Si no hay cache → respuesta default con disclaimer
- SIEMPRE loggear al Sentry/Datadog
- SIEMPRE notificar a `@SRE` en P1

## Monitoreo

- Alertar si error rate > 1%
- Alertar si latencia p95 > 5s
- Alertar si quota usage > 90%
