using System.Collections.Concurrent;

namespace LegalPro.Api.Middleware;

/// <summary>
/// Protección contra ataques de fuerza bruta en endpoints de autenticación.
/// Implementa lockout progresivo: bloquea IP después de N intentos fallidos.
///
/// Mitiga OWASP A07:2021 — Identification and Authentication Failures.
///
/// Estrategia:
///   - Ventana deslizante de 15 minutos
///   - Bloqueo temporal después de 10 intentos fallidos en la ventana
///   - Lockout progresivo: 2min → 5min → 15min (cada bloqueo duplica el tiempo)
///   - Header Retry-After indica cuándo puede reintentar
///   - Limpieza automática de entradas antiguas cada 5 minutos
/// </summary>
public class BruteForceProtectionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<BruteForceProtectionMiddleware> _logger;

    // Almacén en memoria: en producción escalar con IDistributedCache (Redis)
    private static readonly ConcurrentDictionary<string, AttemptRecord> _attempts = new();

    // Rutas de autenticación a proteger
    private static readonly HashSet<string> _protectedPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/auth/login",
        "/api/auth/forgot-password",
        "/api/auth/reset-password",
    };

    private const int MaxAttempts = 10;
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan[] LockoutDurations =
    [
        TimeSpan.FromMinutes(2),
        TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(15),
        TimeSpan.FromHours(1),   // máximo tras 4+ bloqueos
    ];

    private static DateTime _lastCleanup = DateTime.UtcNow;

    public BruteForceProtectionMiddleware(RequestDelegate next, ILogger<BruteForceProtectionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? string.Empty;

        // Solo aplica en endpoints protegidos con método POST
        if (!context.Request.Method.Equals("POST", StringComparison.OrdinalIgnoreCase) ||
            !_protectedPaths.Contains(path))
        {
            await _next(context);
            return;
        }

        // Limpiar entradas expiradas periódicamente (sin lock costoso)
        CleanupIfNeeded();

        var ip = GetClientIp(context);
        var key = $"{ip}:{path}";

        // Verificar si la IP está bloqueada
        if (_attempts.TryGetValue(key, out var record) && record.IsLockedOut())
        {
            var retryAfter = (int)record.LockoutExpiry!.Value.Subtract(DateTime.UtcNow).TotalSeconds;

            _logger.LogWarning(
                "[SECURITY] Brute-force lockout activo. IP={IP} Ruta={Path} " +
                "Intentos={Count} RetryAfter={Retry}s",
                ip, path, record.FailedCount, retryAfter);

            context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            context.Response.Headers["Retry-After"] = retryAfter.ToString();
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(
                $"{{\"error\":\"Cuenta temporalmente bloqueada por intentos excesivos. " +
                $"Intente nuevamente en {retryAfter} segundos.\",\"retryAfter\":{retryAfter}}}");
            return;
        }

        // Interceptar la respuesta para detectar intentos fallidos
        var originalBody = context.Response.Body;
        await using var responseBody = new MemoryStream();
        context.Response.Body = responseBody;

        try
        {
            await _next(context);
        }
        finally
        {
            context.Response.Body = originalBody;
        }

        // 401 = credenciales inválidas → contabilizar intento fallido
        if (context.Response.StatusCode == StatusCodes.Status401Unauthorized)
        {
            RegisterFailedAttempt(key, ip, path);
        }
        else if (context.Response.StatusCode == StatusCodes.Status200OK ||
                 context.Response.StatusCode == StatusCodes.Status201Created)
        {
            // Login exitoso → resetear contador
            _attempts.TryRemove(key, out _);
        }

        // Copiar respuesta al stream original
        responseBody.Seek(0, SeekOrigin.Begin);
        await responseBody.CopyToAsync(originalBody);
    }

    private void RegisterFailedAttempt(string key, string ip, string path)
    {
        var record = _attempts.GetOrAdd(key, _ => new AttemptRecord());

        lock (record)
        {
            // Resetear ventana si ya pasó el tiempo
            if (DateTime.UtcNow - record.WindowStart > Window)
            {
                record.FailedCount = 0;
                record.WindowStart = DateTime.UtcNow;
            }

            record.FailedCount++;
            record.LastAttempt = DateTime.UtcNow;

            if (record.FailedCount >= MaxAttempts)
            {
                // Calcular duración de lockout progresivo
                var lockoutIndex = Math.Min(record.LockoutCount, LockoutDurations.Length - 1);
                record.LockoutExpiry = DateTime.UtcNow + LockoutDurations[lockoutIndex];
                record.LockoutCount++;

                _logger.LogWarning(
                    "[SECURITY] IP bloqueada por brute-force. IP={IP} Ruta={Path} " +
                    "Intentos={Count} LockoutExpiry={Expiry} LockoutNum={N}",
                    ip, path, record.FailedCount, record.LockoutExpiry, record.LockoutCount);
            }
            else
            {
                _logger.LogInformation(
                    "[SECURITY] Intento de login fallido. IP={IP} Ruta={Path} " +
                    "Intentos={Count}/{Max}",
                    ip, path, record.FailedCount, MaxAttempts);
            }
        }
    }

    private static string GetClientIp(HttpContext context)
    {
        // Soporta proxies y Railway load balancer
        var forwarded = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwarded))
        {
            // X-Forwarded-For puede tener múltiples IPs; la primera es el cliente real
            return forwarded.Split(',')[0].Trim();
        }
        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    private static void CleanupIfNeeded()
    {
        if (DateTime.UtcNow - _lastCleanup < TimeSpan.FromMinutes(5)) return;
        _lastCleanup = DateTime.UtcNow;

        var expiredKeys = _attempts
            .Where(kvp => !kvp.Value.IsLockedOut() &&
                          DateTime.UtcNow - kvp.Value.LastAttempt > Window)
            .Select(kvp => kvp.Key)
            .ToList();

        foreach (var key in expiredKeys)
            _attempts.TryRemove(key, out _);
    }

    private class AttemptRecord
    {
        public int FailedCount { get; set; }
        public int LockoutCount { get; set; }
        public DateTime WindowStart { get; set; } = DateTime.UtcNow;
        public DateTime LastAttempt { get; set; } = DateTime.UtcNow;
        public DateTime? LockoutExpiry { get; set; }

        public bool IsLockedOut() =>
            LockoutExpiry.HasValue && DateTime.UtcNow < LockoutExpiry.Value;
    }
}
