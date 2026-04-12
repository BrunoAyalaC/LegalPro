using LegalPro.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace LegalPro.Infrastructure.Services;

/// <summary>
/// Implementación del Audit Logger. Escribe en:
///   1. Serilog estructurado (log files rotativos en Railway)
///   2. Supabase tabla 'audit_logs' para consultas forenses
///
/// En caso de error al persistir en BD, el log en Serilog garantiza
/// que el evento NO se pierde (defense in depth).
/// </summary>
public class AuditLoggerService : IAuditLogger
{
    private readonly ILogger<AuditLoggerService> _logger;
    private readonly IApplicationDbContext _context;

    public AuditLoggerService(
        ILogger<AuditLoggerService> logger,
        IApplicationDbContext context)
    {
        _logger = logger;
        _context = context;
    }

    public async Task LogAsync(AuditEvent evt)
    {
        // 1. Siempre loguear con Serilog (inmutable, no falla)
        WriteStructuredLog(evt);

        // 2. Persistir en BD (best-effort — no propagamos excepción al request)
        try
        {
            await PersistToDatabaseAsync(evt);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "[AUDIT] Error persisting audit event {EventType} to database. " +
                "Event was logged to Serilog. UserId={UserId}",
                evt.EventType, evt.UserId);
        }
    }

    private void WriteStructuredLog(AuditEvent evt)
    {
        using var scope = _logger.BeginScope(new Dictionary<string, object?>
        {
            ["AuditEventType"] = evt.EventType,
            ["AuditUserId"] = evt.UserId,
            ["AuditOrgId"] = evt.OrganizationId,
            ["AuditIp"] = evt.IpAddress,
            ["AuditResource"] = evt.ResourceType,
            ["AuditResourceId"] = evt.ResourceId,
            ["AuditRequestId"] = evt.RequestId,
        });

        var level = evt.Severity switch
        {
            "CRITICAL" => LogLevel.Critical,
            "WARN" => LogLevel.Warning,
            _ => LogLevel.Information,
        };

        _logger.Log(level,
            "[AUDIT:{EventType}] User={UserId} Org={OrgId} IP={IP} " +
            "Resource={ResourceType}/{ResourceId} Action={Action} Detail={Detail}",
            evt.EventType, evt.UserId, evt.OrganizationId, evt.IpAddress,
            evt.ResourceType, evt.ResourceId, evt.Action, evt.Detail);
    }

    private async Task PersistToDatabaseAsync(AuditEvent evt)
    {
        var entry = new Domain.Entities.AuditLog
        {
            EventType = evt.EventType,
            Severity = evt.Severity,
            Timestamp = evt.Timestamp,
            UserId = evt.UserId,
            OrganizationId = evt.OrganizationId,
            IpAddress = evt.IpAddress,
            UserAgent = evt.UserAgent,
            ResourceType = evt.ResourceType,
            ResourceId = evt.ResourceId,
            Action = evt.Action,
            Detail = evt.Detail,
            RequestId = evt.RequestId,
            Metadata = evt.Metadata != null
                ? JsonSerializer.Serialize(evt.Metadata)
                : null,
        };

        await _context.AuditLogs.AddAsync(entry);
        await _context.SaveChangesAsync(CancellationToken.None);
    }

    // ── Helpers de conveniencia ────────────────────────────────────────────

    public Task LogLoginSuccessAsync(Guid userId, string email, string ipAddress) =>
        LogAsync(new AuditEvent
        {
            EventType = "AUTH_LOGIN_SUCCESS",
            Severity = "INFO",
            UserId = userId,
            IpAddress = ipAddress,
            Action = "LOGIN",
            Detail = $"Login exitoso para {MaskEmail(email)}",
        });

    public Task LogLoginFailureAsync(string email, string ipAddress, string reason) =>
        LogAsync(new AuditEvent
        {
            EventType = "AUTH_LOGIN_FAILURE",
            Severity = "WARN",
            IpAddress = ipAddress,
            Action = "LOGIN_FAILURE",
            Detail = reason,
            Metadata = new Dictionary<string, object?> { ["email_masked"] = MaskEmail(email) },
        });

    public Task LogResourceAccessAsync(Guid userId, Guid orgId, string resourceType,
        string resourceId, string action) =>
        LogAsync(new AuditEvent
        {
            EventType = $"RESOURCE_{action.ToUpper()}",
            Severity = "INFO",
            UserId = userId,
            OrganizationId = orgId,
            ResourceType = resourceType,
            ResourceId = resourceId,
            Action = action,
        });

    public Task LogTenantViolationAsync(Guid userId, Guid callerOrgId,
        string resourceType, string attemptedOrgId) =>
        LogAsync(new AuditEvent
        {
            EventType = "TENANT_VIOLATION",
            Severity = "CRITICAL",
            UserId = userId,
            OrganizationId = callerOrgId,
            ResourceType = resourceType,
            Action = "CROSS_TENANT_ACCESS_ATTEMPT",
            Detail = $"Intento de acceso a recurso de org {attemptedOrgId}",
            Metadata = new Dictionary<string, object?>
            {
                ["attempted_org_id"] = attemptedOrgId,
                ["caller_org_id"] = callerOrgId,
            },
        });

    public Task LogGeminiRequestAsync(Guid userId, Guid orgId, string feature, int inputLength) =>
        LogAsync(new AuditEvent
        {
            EventType = "GEMINI_REQUEST",
            Severity = "INFO",
            UserId = userId,
            OrganizationId = orgId,
            Action = feature,
            Detail = $"Solicitud IA: {feature}",
            Metadata = new Dictionary<string, object?> { ["input_length"] = inputLength },
        });

    public Task LogPermissionDeniedAsync(Guid userId, string action, string resource) =>
        LogAsync(new AuditEvent
        {
            EventType = "PERMISSION_DENIED",
            Severity = "WARN",
            UserId = userId,
            Action = action,
            ResourceType = resource,
            Detail = $"Acceso denegado a {resource} — acción: {action}",
        });

    /// <summary>
    /// Enmascara email para logs: usuario@dominio.com → u****o@dominio.com
    /// Protege privacidad sin perder trazabilidad.
    /// </summary>
    private static string MaskEmail(string email)
    {
        if (string.IsNullOrEmpty(email)) return "***";
        var at = email.IndexOf('@');
        if (at <= 1) return "***@***";
        var local = email[..at];
        var domain = email[at..];
        return $"{local[0]}{"*".PadRight(Math.Min(local.Length - 1, 4), '*')}{local[^1]}{domain}";
    }
}
