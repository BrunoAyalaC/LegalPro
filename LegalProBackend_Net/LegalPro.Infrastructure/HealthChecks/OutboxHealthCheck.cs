using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace LegalPro.Infrastructure.HealthChecks;

/// <summary>
/// R-01 Outbox health check.
/// - Verifica conectividad PG con SELECT 1.
/// - Cuenta mensajes dead-letter: processed_on_utc IS NULL AND retry_count >= 3.
///   → Unhealthy si &gt; 10, Degraded si &gt; 0, Healthy si 0.
/// </summary>
public class OutboxHealthCheck : IHealthCheck
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<OutboxHealthCheck> _logger;

    public OutboxHealthCheck(IConfiguration configuration, ILogger<OutboxHealthCheck> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var raw = _configuration["DATABASE_URL"]
               ?? _configuration["DATABASE_PUBLIC_URL"]
               ?? _configuration.GetConnectionString("DefaultConnection");

        if (string.IsNullOrWhiteSpace(raw))
        {
            return HealthCheckResult.Unhealthy("ConnectionString no configurada para OutboxHealthCheck.");
        }

        var connectionString = ConvertPostgresUri(raw);

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(cancellationToken);

            // 1) pg connectivity OK — SELECT 1 implicit via OpenAsync

            // 2) dead-letter count
            await using var cmd = new NpgsqlCommand(
                "SELECT COUNT(*) FROM outbox_messages WHERE processed_on_utc IS NULL AND retry_count >= 3;",
                conn);
            // Timeout 5s para no bloquear readiness
            cmd.CommandTimeout = 5;

            var scalar = await cmd.ExecuteScalarAsync(cancellationToken);
            var count = scalar is long l ? l : Convert.ToInt64(scalar ?? 0);

            var data = new Dictionary<string, object>
            {
                ["deadLetterCount"] = count,
                ["threshold"] = 10
            };

            if (count > 10)
            {
                _logger.LogWarning("Outbox dead-letter backlog {Count} > 10 — Unhealthy", count);
                return HealthCheckResult.Unhealthy(
                    $"Outbox dead-letter backlog: {count} (>10)", data: data);
            }

            if (count > 0)
            {
                return HealthCheckResult.Degraded(
                    $"Outbox dead-letter: {count} mensajes con retry_count>=3", data: data);
            }

            return HealthCheckResult.Healthy("Outbox healthy — sin dead-letters.", data);
        }
        catch (NpgsqlException ex)
        {
            _logger.LogError(ex, "OutboxHealthCheck: fallo de conexión PG");
            return HealthCheckResult.Unhealthy("Postgres no alcanzable desde OutboxHealthCheck.", ex);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OutboxHealthCheck: error inesperado");
            return HealthCheckResult.Unhealthy("Error en OutboxHealthCheck.", ex);
        }
    }

    private static string ConvertPostgresUri(string uriOrConnStr)
    {
        if (string.IsNullOrWhiteSpace(uriOrConnStr))
            return uriOrConnStr;

        if (!uriOrConnStr.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase)
            && !uriOrConnStr.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase))
            return uriOrConnStr;

        try
        {
            var uri = new Uri(uriOrConnStr);
            var userInfo = uri.UserInfo.Split(':', 2);
            var user = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : string.Empty;
            var pass = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty;
            var db = uri.AbsolutePath.TrimStart('/');
            if (string.IsNullOrEmpty(db)) db = "railway";
            var port = uri.Port > 0 ? uri.Port : 5432;
            return $"Host={uri.Host};Port={port};Database={db};Username={user};Password={pass};SSL Mode=Prefer;Trust Server Certificate=true;";
        }
        catch
        {
            return uriOrConnStr;
        }
    }
}
