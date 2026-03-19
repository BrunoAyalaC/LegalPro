using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Exceptions;
using System.Text.Json;

namespace LegalPro.Application.Simulacion.Commands;

// ═══════════════════════════════════════════════════════
// COMMAND: Procesar Turno de Simulación
// Gemini (FC) actúa como parte adversarial y evalúa la
// calidad del argumento del usuario (+/-puntaje).
// Seguridad OWASP A01: verifica OrganizationId en el load.
// ═══════════════════════════════════════════════════════

public class ProcesarTurnoCommand : IRequest<ProcesarTurnoResult>
{
    public int SimulacionId { get; set; }
    public string MensajeUsuario { get; set; } = string.Empty;
}

public record ProcesarTurnoResult(
    int SimulacionId,
    string MensajeRespuesta,
    int PuntajeDelta,
    int PuntajeActual,
    string? LeyesInvocadas,
    string? EvaluacionTurno,
    bool EsFinSimulacion,
    int TurnoActual);

public class ProcesarTurnoCommandValidator : AbstractValidator<ProcesarTurnoCommand>
{
    public ProcesarTurnoCommandValidator()
    {
        RuleFor(x => x.SimulacionId).GreaterThan(0);
        RuleFor(x => x.MensajeUsuario)
            .NotEmpty().WithMessage("El argumento del usuario no puede estar vacío.")
            .MaximumLength(2000);
    }
}

public class ProcesarTurnoCommandHandler : IRequestHandler<ProcesarTurnoCommand, ProcesarTurnoResult>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;
    private readonly ILegalSimulacion _simulacionAI;

    public ProcesarTurnoCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUser,
        ILegalSimulacion simulacionAI)
    {
        _context = context;
        _currentUser = currentUser;
        _simulacionAI = simulacionAI;
    }

    public async Task<ProcesarTurnoResult> Handle(
        ProcesarTurnoCommand request,
        CancellationToken cancellationToken)
    {
        // OWASP A01: aísla por usuario Y organización
        var simulacion = await _context.Simulaciones
            .Include(s => s.Eventos)
            .Where(s => s.Id == request.SimulacionId
                        && s.UsuarioId == _currentUser.UserId
                        && s.OrganizationId == _currentUser.OrganizationId)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Simulacion", request.SimulacionId);

        if (simulacion.EstaFinalizada)
            throw new DomainException("Esta simulación ya ha finalizado.");

        // Construir historial textual para contexto de Gemini
        var historial = string.Join("\n",
            simulacion.Eventos
                      .OrderBy(e => e.Turno)
                      .Select(e => $"[{e.Emisor}]: {e.Mensaje}"));

        // Determinar rol adversarial para este turno
        var rolAdversarial = simulacion.RolUsuario.ToUpperInvariant() switch
        {
            "ABOGADO" or "DEFENSA" => "Fiscal del Ministerio Público",
            "FISCAL" => "Abogado Defensor",
            "JUEZ" => "Defensor y Fiscal",
            _ => "Parte contraria"
        };

        // Gemini procesa el turno — Function Call garantiza estructura
        var jsonRaw = await _simulacionAI.ProcesarTurnoSimulacionAsync(
            historialTurnos: historial,
            intervencionUsuario: request.MensajeUsuario,
            rolAdversarial: rolAdversarial);

        string mensajeRespuesta = string.Empty;
        int puntajeDelta = 0;
        string? leyesInvocadas = null;
        string? evaluacion = null;
        bool esFinSimulacion = false;

        try
        {
            using var doc = JsonDocument.Parse(jsonRaw);
            var root = doc.RootElement;
            mensajeRespuesta = root.GetPropertyOrDefault("mensajeRespuesta", "Sin respuesta.");
            leyesInvocadas = root.TryGetProperty("leyesInvocadas", out var le) ? le.GetString() : null;
            evaluacion = root.TryGetProperty("evaluacionTurno", out var ev) ? ev.GetString() : null;

            if (root.TryGetProperty("puntajeDelta", out var pd))
                puntajeDelta = pd.ValueKind == JsonValueKind.Number ? pd.GetInt32() : 0;

            if (root.TryGetProperty("esFinSimulacion", out var fin))
                esFinSimulacion = fin.ValueKind == JsonValueKind.True;
        }
        catch
        {
            mensajeRespuesta = jsonRaw;
        }

        // Persistir mensaje del usuario
        var eventoUsuario = simulacion.AgregarEvento(simulacion.RolUsuario, request.MensajeUsuario);
        _context.EventosSimulacion.Add(eventoUsuario);

        // Persistir respuesta de la IA
        var eventoIA = simulacion.AgregarEvento(rolAdversarial, mensajeRespuesta, leyesInvocadas);
        _context.EventosSimulacion.Add(eventoIA);

        // Ajustar puntaje según evaluación de Gemini
        simulacion.AjustarPuntaje(puntajeDelta);

        // Finalizar automáticamente si Gemini indica fin
        if (esFinSimulacion)
            simulacion.Finalizar();

        await _context.SaveChangesAsync(cancellationToken);

        var turnoActual = simulacion.Eventos.Max(e => e.Turno);

        return new ProcesarTurnoResult(
            SimulacionId: simulacion.Id,
            MensajeRespuesta: mensajeRespuesta,
            PuntajeDelta: puntajeDelta,
            PuntajeActual: simulacion.PuntajeActual,
            LeyesInvocadas: leyesInvocadas,
            EvaluacionTurno: evaluacion,
            EsFinSimulacion: esFinSimulacion,
            TurnoActual: turnoActual);
    }
}
