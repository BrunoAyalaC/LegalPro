---
description: Reglas para código C# asíncrono
globs:
  - "LegalProBackend_Net/**/*.cs"
---

# Reglas de C# Async/Await

Aplicar estas reglas al escribir código asíncrono en C#.

## Convenciones

- SIEMPRE usar `Async` como sufijo en métodos
- SIEMPRE `Task<T>` o `ValueTask<T>` como retorno
- SIEMPRE `CancellationToken` en métodos que esperan
- SIEMPRE `ConfigureAwait(false)` en bibliotecas (no en ASP.NET Core)

## Cancellation

```csharp
public async Task<Expediente> GetByIdAsync(
  Guid id, CancellationToken ct = default)
{
  return await _db.Expedientes
    .FirstOrDefaultAsync(e => e.Id == id, ct);
}
```

## Evitar

- `async void` (solo para event handlers)
- `.Wait()` o `.Result` (deadlock)
- `ConfigureAwait(true)` implícito sin necesidad
- `Task.Run` para código CPU-bound pesado

## Parallel

- `Task.WhenAll` para paralelizar I/O
- `Parallel.ForEachAsync` solo para casos extremos
- `Channel<T>` para producer/consumer

## Performance

- `ValueTask<T>` cuando se evita alocación en hot path
- `IAsyncEnumerable<T>` para streams
- `ConfigureAwait(false)` en librerías
