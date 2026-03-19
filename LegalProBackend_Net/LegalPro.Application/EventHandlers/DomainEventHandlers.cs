using LegalPro.Domain.Events;
using MediatR;
using Microsoft.Extensions.Logging;

namespace LegalPro.Application.EventHandlers;

/// <summary>
/// Observer: Handles the UsuarioRegistradoEvent.
/// Could send welcome email, log analytics, or initialize user profile.
/// </summary>
public class UsuarioRegistradoEventHandler : INotificationHandler<UsuarioRegistradoEvent>
{
    private readonly ILogger<UsuarioRegistradoEventHandler> _logger;

    public UsuarioRegistradoEventHandler(ILogger<UsuarioRegistradoEventHandler> logger)
    {
        _logger = logger;
    }

    public Task Handle(UsuarioRegistradoEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "[OBSERVER] Nuevo usuario registrado: {Email} como {Rol} a las {Time}",
            notification.Email, notification.Rol, notification.OccurredOn);

        // TODO: Send welcome email, create default preferences, etc.
        return Task.CompletedTask;
    }
}

/// <summary>
/// Observer: Handles the ExpedienteCreadoEvent.
/// Could trigger notifications, auto-classification, or audit logging.
/// </summary>
public class ExpedienteCreadoEventHandler : INotificationHandler<ExpedienteCreadoEvent>
{
    private readonly ILogger<ExpedienteCreadoEventHandler> _logger;

    public ExpedienteCreadoEventHandler(ILogger<ExpedienteCreadoEventHandler> logger)
    {
        _logger = logger;
    }

    public Task Handle(ExpedienteCreadoEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "[OBSERVER] Expediente creado: {Numero} por Usuario {UsuarioId} a las {Time}",
            notification.Numero, notification.UsuarioId, notification.OccurredOn);

        // TODO: Auto-classify case type, notify assigned team, etc.
        return Task.CompletedTask;
    }
}

/// <summary>
/// Observer: Handles the SimulacionFinalizadaEvent.
/// Could save analytics, update user statistics, generate report.
/// </summary>
public class SimulacionFinalizadaEventHandler : INotificationHandler<SimulacionFinalizadaEvent>
{
    private readonly ILogger<SimulacionFinalizadaEventHandler> _logger;

    public SimulacionFinalizadaEventHandler(ILogger<SimulacionFinalizadaEventHandler> logger)
    {
        _logger = logger;
    }

    public Task Handle(SimulacionFinalizadaEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "[OBSERVER] Simulación {Id} finalizada. Puntaje: {Puntaje}/100 para Usuario {UsuarioId}",
            notification.SimulacionId, notification.PuntajeFinal, notification.UsuarioId);

        // TODO: Update user stats, generate performance report, etc.
        return Task.CompletedTask;
    }
}

/// <summary>
/// Observer: Handles the ExpedienteEstadoCambiadoEvent.
/// Could trigger deadline alerts, notifications, or audit trail entries.
/// </summary>
public class ExpedienteEstadoCambiadoEventHandler : INotificationHandler<ExpedienteEstadoCambiadoEvent>
{
    private readonly ILogger<ExpedienteEstadoCambiadoEventHandler> _logger;

    public ExpedienteEstadoCambiadoEventHandler(ILogger<ExpedienteEstadoCambiadoEventHandler> logger)
    {
        _logger = logger;
    }

    public Task Handle(ExpedienteEstadoCambiadoEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "[OBSERVER] Expediente {Id}: {EstadoAnterior} → {EstadoNuevo}",
            notification.ExpedienteId, notification.EstadoAnterior, notification.EstadoNuevo);

        // TODO: Trigger deadline recalculation, notify stakeholders, etc.
        return Task.CompletedTask;
    }
}
