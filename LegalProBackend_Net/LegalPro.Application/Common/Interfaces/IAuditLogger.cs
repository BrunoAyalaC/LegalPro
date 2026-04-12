namespace LegalPro.Application.Common.Interfaces;

/// <summary>
/// Contrato para el servicio de audit log de eventos de seguridad.
/// Registra acciones críticas para cumplimiento y forensics post-incident.
///
/// Eventos registrados:
///   - AUTH_LOGIN_SUCCESS / AUTH_LOGIN_FAILURE
///   - AUTH_REGISTER
///   - AUTH_TOKEN_REFRESH
///   - RESOURCE_ACCESS / RESOURCE_CREATE / RESOURCE_UPDATE / RESOURCE_DELETE
///   - TENANT_VIOLATION — intento de acceso cross-tenant (BOLA/IDOR)
///   - RATE_LIMIT_HIT
///   - PERMISSION_DENIED
///   - GEMINI_REQUEST — llamadas a IA con contexto censurado
/// </summary>
public interface IAuditLogger
{
    Task LogAsync(AuditEvent auditEvent);

    // Helpers de conveniencia para los eventos más comunes
    Task LogLoginSuccessAsync(Guid userId, string email, string ipAddress);
    Task LogLoginFailureAsync(string email, string ipAddress, string reason);
    Task LogResourceAccessAsync(Guid userId, Guid orgId, string resourceType, string resourceId, string action);
    Task LogTenantViolationAsync(Guid userId, Guid callerOrgId, string resourceType, string attemptedOrgId);
    Task LogGeminiRequestAsync(Guid userId, Guid orgId, string feature, int inputLength);
    Task LogPermissionDeniedAsync(Guid userId, string action, string resource);
}

/// <summary>
/// Evento de auditoría estándar para persistencia y análisis.
/// </summary>
public class AuditEvent
{
    public string EventType { get; init; } = string.Empty;
    public string Severity { get; init; } = "INFO";   // INFO | WARN | CRITICAL
    public DateTime Timestamp { get; init; } = DateTime.UtcNow;
    public Guid? UserId { get; init; }
    public Guid? OrganizationId { get; init; }
    public string? IpAddress { get; init; }
    public string? UserAgent { get; init; }
    public string? ResourceType { get; init; }
    public string? ResourceId { get; init; }
    public string? Action { get; init; }
    public string? Detail { get; init; }
    public string? RequestId { get; init; }

    // Datos adicionales estructurados (JSON serializable)
    public Dictionary<string, object?>? Metadata { get; init; }
}
