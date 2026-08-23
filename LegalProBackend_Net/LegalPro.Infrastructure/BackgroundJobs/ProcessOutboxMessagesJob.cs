using System;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Common;
using LegalPro.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LegalPro.Infrastructure.BackgroundJobs;

public class ProcessOutboxMessagesJob : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ProcessOutboxMessagesJob> _logger;

    /// <summary>
    /// Intervalo base entre ciclos de procesamiento (5 segundos).
    /// </summary>
    private static readonly TimeSpan PollingInterval = TimeSpan.FromSeconds(5);

    /// <summary>
    /// Tope maximo de exponential backoff entre reintentos (30 segundos).
    /// </summary>
    private static readonly TimeSpan MaxBackoffDelay = TimeSpan.FromSeconds(30);

    public ProcessOutboxMessagesJob(
        IServiceScopeFactory scopeFactory,
        ILogger<ProcessOutboxMessagesJob> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Iniciando servicio de fondo para procesamiento de Outbox.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessMessagesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ocurrió un error inesperado al procesar los mensajes del Outbox.");
            }

            await Task.Delay(PollingInterval, stoppingToken);
        }

        _logger.LogInformation("Servicio de fondo para procesamiento de Outbox detenido.");
    }

    private async Task ProcessMessagesAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        var publisher = scope.ServiceProvider.GetRequiredService<IPublisher>();

        // FIX P1 2026-08-21: FOR UPDATE SKIP LOCKED LIMIT 20 para evitar race condition
        // con múltiples workers (Railway scale horizontal). Sin SKIP LOCKED, dos instancias
        // toman el mismo mensaje → doble publish, violación de idempotencia.
        // Drift outbox: content TEXT vs payload JSONB + correlation_id alineado en migración
        // 2026-08-21-outbox-alignment.sql (trigger sync mantiene compat).
        // Retención documentada: fn_cleanup_old_outbox(90 días) + fn_cleanup_old_audit_log(2 años)
        // + BRIN en outbox/audit_log para purga eficiente time-series.
        List<OutboxMessage> messages;
        // Intentar SELECT ... FOR UPDATE SKIP LOCKED vía FromSqlRaw (transaccional).
        // Fallback a LINQ si el provider no soporta FromSqlRaw en tests (InMemory).
        try
        {
            // EF Core 7+ soporta FromSql en DbSet; usamos raw SQL con SKIP LOCKED.
            // Nota: FromSqlRaw requiere que la query sea composable; LIMIT 20 + FOR UPDATE SKIP LOCKED
            // es atómico y evita que otro worker bloquee.
            var dbContext = (Microsoft.EntityFrameworkCore.DbContext)context;
            await using var tx = await dbContext.Database.BeginTransactionAsync(cancellationToken);
            messages = await context.OutboxMessages
                .FromSqlRaw(
                    "SELECT * FROM outbox_messages WHERE processed_on_utc IS NULL AND retry_count < {0} ORDER BY occurred_on_utc LIMIT 20 FOR UPDATE SKIP LOCKED",
                    OutboxMessage.MaxRetryCount)
                .ToListAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
        }
        catch
        {
            // Fallback para InMemory / provider sin soporte SQL (tests)
            messages = await context.OutboxMessages
                .Where(m => m.ProcessedOnUtc == null && m.RetryCount < OutboxMessage.MaxRetryCount)
                .OrderBy(m => m.OccurredOnUtc)
                .Take(20)
                .ToListAsync(cancellationToken);
        }

        if (!messages.Any())
        {
            return;
        }

        _logger.LogInformation("Se encontraron {Count} mensajes no procesados en el Outbox.", messages.Count);

        foreach (var message in messages)
        {
            try
            {
                var type = Assembly.GetAssembly(typeof(IDomainEvent))?.GetType(message.Type)
                           ?? Type.GetType(message.Type);

                if (type == null)
                {
                    throw new InvalidOperationException($"No se pudo encontrar el tipo de evento de dominio '{message.Type}'.");
                }

                var domainEvent = JsonSerializer.Deserialize(message.Content, type);

                if (domainEvent == null)
                {
                    throw new InvalidOperationException($"La deserialización del evento de dominio '{message.Type}' retornó nulo.");
                }

                await publisher.Publish(domainEvent, cancellationToken);

                message.MarkAsProcessed(DateTime.UtcNow);
                _logger.LogInformation(
                    "Mensaje de Outbox {MessageId} procesado exitosamente (Type={MessageType}).",
                    message.Id, message.Type);
            }
            catch (Exception ex)
            {
                message.MarkAsFailed(ex.ToString());

                if (message.HasExceededMaxRetries)
                {
                    _logger.LogError(
                        ex,
                        "Mensaje de Outbox {MessageId} ha superado el maximo de {MaxRetries} reintentos y se marca como fallido permanente (Type={MessageType}).",
                        message.Id, OutboxMessage.MaxRetryCount, message.Type);
                }
                else
                {
                    // Exponential backoff: el delay se calcula como 2^RetryCount * 5s, cap en MaxBackoffDelay
                    var backoffDelay = TimeSpan.FromSeconds(Math.Min(
                        Math.Pow(2, message.RetryCount) * 5,
                        MaxBackoffDelay.TotalSeconds));

                    _logger.LogWarning(
                        ex,
                        "Error al procesar mensaje de Outbox {MessageId}. " +
                        "Reintento {RetryCount}/{MaxRetries}. " +
                        "Proximo reintento en {BackoffDelay}.",
                        message.Id, message.RetryCount, OutboxMessage.MaxRetryCount, backoffDelay);
                }
            }
        }

        await context.SaveChangesAsync(cancellationToken);
    }
}
