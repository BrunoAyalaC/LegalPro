using System;

namespace LegalPro.Domain.Entities;

/// <summary>
/// Representa un mensaje en la bandeja de salida (Outbox) para garantizar la consistencia eventual.
/// Almacena eventos de dominio serializados para ser procesados de fondo de forma asíncrona y confiable.
/// Implementa retry con exponential backoff.
/// </summary>
public class OutboxMessage
{
    /// <summary>
    /// Numero maximo de reintentos antes de marcar el mensaje como fallido permanente.
    /// </summary>
    public const int MaxRetryCount = 3;

    public Guid Id { get; private set; }
    public string Type { get; private set; } = string.Empty;
    public string Content { get; private set; } = string.Empty;
    public DateTime OccurredOnUtc { get; private set; }
    public DateTime? ProcessedOnUtc { get; private set; }
    public string? Error { get; private set; }

    /// <summary>
    /// Contador de reintentos. Se incrementa en cada fallo.
    /// Cuando supera <see cref="MaxRetryCount"/>, el mensaje se marca como fallido permanente.
    /// </summary>
    public int RetryCount { get; private set; }

    // Constructor para EF Core
    private OutboxMessage() { }

    public OutboxMessage(Guid id, string type, string content, DateTime occurredOnUtc)
    {
        Id = id;
        Type = type;
        Content = content;
        OccurredOnUtc = occurredOnUtc;
        RetryCount = 0;
    }

    public void MarkAsProcessed(DateTime processedOnUtc)
    {
        ProcessedOnUtc = processedOnUtc;
        Error = null;
    }

    public void MarkAsFailed(string error)
    {
        RetryCount++;
        Error = error;
    }

    /// <summary>
    /// Indica si el mensaje ha superado el numero maximo de reintentos.
    /// </summary>
    public bool HasExceededMaxRetries => RetryCount >= MaxRetryCount;
}
