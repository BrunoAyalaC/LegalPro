namespace LegalPro.Api.Middleware;

/// <summary>
/// Agrega security headers a todas las respuestas HTTP.
/// Mitiga OWASP A05 (Security Misconfiguration) y A03 (Injection/XSS).
///
/// Headers aplicados:
///   - Content-Security-Policy: bloquea recursos de orígenes no autorizados
///   - Strict-Transport-Security: fuerza HTTPS por 1 año con includeSubDomains
///   - X-Content-Type-Options: previene MIME sniffing
///   - X-Frame-Options: bloquea clickjacking
///   - Referrer-Policy: no expone URL al hacer requests externos
///   - Permissions-Policy: deshabilita APIs browser no necesarias
///   - X-Request-ID: correlación de solicitudes para audit logs
/// </summary>
public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Inyectar Request-ID de correlación antes de procesar
        var requestId = context.TraceIdentifier;
        context.Request.Headers.TryAdd("X-Request-ID", requestId);

        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;

            // HSTS: fuerza HTTPS por 1 año. 31536000 = 365 días.
            // preload habilita inclusión en navegadores (OWASP A05).
            headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";

            // CSP estricta para API REST (sin assets frontend).
            // default-src 'none': bloquea todo excepto lo explicitamente permitido.
            headers["Content-Security-Policy"] =
                "default-src 'none'; " +
                "frame-ancestors 'none'; " +
                "base-uri 'none'; " +
                "form-action 'none'";

            // Previene ataques MIME-type sniffing (OWASP A05).
            headers["X-Content-Type-Options"] = "nosniff";

            // Bloquea embedding en iframe (clickjacking) — OWASP A05.
            headers["X-Frame-Options"] = "DENY";

            // No exponer URL completa en Referer header hacia terceros.
            headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

            // Deshabilitar APIs sensibles del navegador no usadas por la API.
            headers["Permissions-Policy"] =
                "camera=(), microphone=(), geolocation=(), " +
                "payment=(), usb=(), magnetometer=(), gyroscope=()";

            // Correlación de requests para distributed tracing y audit.
            headers["X-Request-ID"] = requestId;

            // Ocultar información del servidor (information disclosure — OWASP A05).
            headers.Remove("Server");
            headers.Remove("X-Powered-By");
            headers.Remove("X-AspNet-Version");
            headers.Remove("X-AspNetMvc-Version");

            return Task.CompletedTask;
        });

        await _next(context);
    }
}
