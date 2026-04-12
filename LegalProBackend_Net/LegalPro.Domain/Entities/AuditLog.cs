namespace LegalPro.Domain.Entities;

/// <summary>
/// Registro inmutable de eventos de seguridad y acceso.
/// Propósito: compliance, forensics post-incident y detección de anomalías.
///
/// Diseño:
///   - Nunca se actualiza ni elimina (append-only) — integridad del trail
///   - Todos los campos sensibles (email, texto libre) son enmascarados
///     antes de llegar aquí (responsabilidad del AuditLoggerService)
///   - Indexed por Timestamp, UserId y EventType para queries eficientes
/// </summary>
public class AuditLog
{
    public long Id { get; init; }           // BIGSERIAL — eficiente para volumen alto
    public string EventType { get; init; } = string.Empty;
    public string Severity { get; init; } = "INFO";   // INFO | WARN | CRITICAL
    public DateTime Timestamp { get; init; } = DateTime.UtcNow;

    // Contexto del actor
    public Guid? UserId { get; init; }
    public Guid? OrganizationId { get; init; }
    public string? IpAddress { get; init; }
    public string? UserAgent { get; init; }

    // Contexto del recurso afectado
    public string? ResourceType { get; init; }
    public string? ResourceId { get; init; }
    public string? Action { get; init; }
    public string? Detail { get; init; }

    // Correlación distribuida
    public string? RequestId { get; init; }

    // Datos adicionales serializados como JSON
    public string? Metadata { get; init; }
}
