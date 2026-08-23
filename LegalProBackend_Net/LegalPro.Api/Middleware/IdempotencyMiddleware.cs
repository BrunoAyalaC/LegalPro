using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace LegalPro.Api.Middleware;

/// <summary>
/// Middleware de idempotencia para peticiones POST.
/// 
/// Permite al cliente enviar un header X-Idempotency-Key para garantizar que
/// una petición se procese exactamente una vez. Si el servidor ya procesó esa
/// clave, devuelve la respuesta almacenada en caché sin ejecutar la lógica nuevamente.
///
/// Headers:
///   X-Idempotency-Key : string (UUID v4 recomendado)
///   X-Cache-Idempotent: "HIT" si la respuesta vino de caché
///
/// Compliance:
///   - OWASP API6:2023 — Unrestricted Consumption (evita duplicados de pago/registro)
///   - LPDP Art. 7 — Consentimiento (evita doble procesamiento de datos personales)
///   - Multi-tenant seguro: la clave incluye el tenant implícitamente porque
///     este middleware corre después de autenticación y el cacheo por key única
///     evita cross-tenant leak (cada request lleva su propia key).
/// </summary>
public class IdempotencyMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IMemoryCache _cache;
    private readonly TimeSpan _cacheDuration = TimeSpan.FromHours(1);
    private readonly TimeSpan _lockDuration = TimeSpan.FromSeconds(60);

    public IdempotencyMiddleware(RequestDelegate next, IMemoryCache cache)
    {
        _next = next;
        _cache = cache;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Solo aplica a POST (mutaciones). GET, PUT, DELETE, etc. pasan sin cambios.
        if (!HttpMethods.IsPost(context.Request.Method))
        {
            await _next(context);
            return;
        }

        var idempotencyKey = context.Request.Headers["X-Idempotency-Key"].FirstOrDefault();
        if (string.IsNullOrEmpty(idempotencyKey))
        {
            // Sin key de idempotencia → pasa normal (compatibilidad hacia atrás)
            await _next(context);
            return;
        }

        // P0 Fix 2026-08-21: cache leak tenant — idempotency key debe incluir tenantId
        // Usa RequestServices para resolver ICurrentUserService/ITenantProvider sin inyección directa (middleware singleton)
        var tenantId = "no-tenant";
        try
        {
            var currentUser = context.RequestServices.GetService(typeof(LegalPro.Application.Common.Interfaces.ICurrentUserService)) as LegalPro.Application.Common.Interfaces.ICurrentUserService;
            var tenantProvider = context.RequestServices.GetService(typeof(LegalPro.Application.Common.Interfaces.ITenantProvider)) as LegalPro.Application.Common.Interfaces.ITenantProvider;
            tenantId = currentUser?.OrganizationId?.ToString() ?? tenantProvider?.TenantId?.ToString() ?? context.User?.FindFirst("organization_id")?.Value ?? "no-tenant";
            if (string.IsNullOrWhiteSpace(tenantId) || tenantId == Guid.Empty.ToString()) tenantId = "no-tenant";
        }
        catch { /* fallback a no-tenant si no hay servicio */ }
        var cacheKey = $"idempotency:{tenantId}:{idempotencyKey}";

        // ── HIT: Respuesta ya existe en caché ──────────────────────────────
        if (_cache.TryGetValue(cacheKey, out CachedResponse? cached) && cached is not null)
        {
            context.Response.StatusCode = cached.StatusCode;
            context.Response.Headers["X-Cache-Idempotent"] = "HIT";
            context.Response.ContentType = "application/json; charset=utf-8";
            await context.Response.WriteAsync(cached.Body, Encoding.UTF8);
            return;
        }

        // ── LOCK: Petición en progreso (otro thread/proceso concurrente) ────
        if (_cache.TryGetValue($"{cacheKey}:lock", out _))
        {
            context.Response.StatusCode = StatusCodes.Status409Conflict;
            context.Response.ContentType = "application/json; charset=utf-8";
            var conflictResponse = JsonSerializer.Serialize(new
            {
                error = "Esta petición ya está siendo procesada",
                code = "REQUEST_IN_PROGRESS",
                idempotencyKey
            });
            await context.Response.WriteAsync(conflictResponse, Encoding.UTF8);
            return;
        }

        // ── Adquirir lock ──────────────────────────────────────────────────
        _cache.Set($"{cacheKey}:lock", true, _lockDuration);

        // Buffer para capturar la respuesta del pipeline
        var originalBody = context.Response.Body;
        using var bufferStream = new MemoryStream();
        context.Response.Body = bufferStream;

        try
        {
            await _next(context);

            // Solo cachear respuestas exitosas (2xx)
            if (context.Response.StatusCode >= 200 && context.Response.StatusCode < 300)
            {
                bufferStream.Seek(0, SeekOrigin.Begin);
                var body = await new StreamReader(bufferStream, Encoding.UTF8).ReadToEndAsync();

                _cache.Set(cacheKey, new CachedResponse
                {
                    StatusCode = context.Response.StatusCode,
                    Body = body,
                    ContentType = context.Response.ContentType ?? "application/json; charset=utf-8"
                }, _cacheDuration);
            }

            // Copiar el buffer al flujo original
            bufferStream.Seek(0, SeekOrigin.Begin);
            await bufferStream.CopyToAsync(originalBody);
        }
        finally
        {
            // Liberar el lock siempre (incluso si hay excepción)
            context.Response.Body = originalBody;
            _cache.Remove($"{cacheKey}:lock");
        }
    }
}

/// <summary>
/// Representa una respuesta HTTP cacheada para propósitos de idempotencia.
/// </summary>
public class CachedResponse
{
    public int StatusCode { get; set; }
    public string Body { get; set; } = string.Empty;
    public string ContentType { get; set; } = "application/json; charset=utf-8";
}
