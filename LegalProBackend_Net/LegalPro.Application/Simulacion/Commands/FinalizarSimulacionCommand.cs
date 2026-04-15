using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Application.Simulacion.Commands;

// ═══════════════════════════════════════════════════════
// COMMAND: Finalizar Simulación de Juicio
// Dispara Simulacion.Finalizar() → emite SimulacionFinalizadaEvent.
// OWASP A01: solo el propietario puede finalizar.
// ═══════════════════════════════════════════════════════

public class FinalizarSimulacionCommand : IRequest<FinalizarSimulacionResult>
{
    public Guid SimulacionId { get; set; }
}

public record FinalizarSimulacionResult(
    Guid SimulacionId,
    int PuntajeFinal,
    int TotalTurnos,
    bool Finalizada);

public class FinalizarSimulacionCommandValidator : AbstractValidator<FinalizarSimulacionCommand>
{
    public FinalizarSimulacionCommandValidator()
    {
        RuleFor(x => x.SimulacionId).NotEmpty();
    }
}

public class FinalizarSimulacionCommandHandler : IRequestHandler<FinalizarSimulacionCommand, FinalizarSimulacionResult>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public FinalizarSimulacionCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<FinalizarSimulacionResult> Handle(
        FinalizarSimulacionCommand request,
        CancellationToken cancellationToken)
    {
        // OWASP A01: verifica propietario + organización
        var simulacion = await _context.Simulaciones
            .Include(s => s.Eventos)
            .Where(s => s.Id == request.SimulacionId
                        && s.UsuarioId == _currentUser.UserId
                        && s.OrganizationId == _currentUser.OrganizationId)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Simulacion", request.SimulacionId);

        simulacion.Finalizar(); // Emite SimulacionFinalizadaEvent

        await _context.SaveChangesAsync(cancellationToken);

        return new FinalizarSimulacionResult(
            SimulacionId: simulacion.Id,
            PuntajeFinal: simulacion.PuntajeActual,
            TotalTurnos: simulacion.Eventos.Count,
            Finalizada: simulacion.EstaFinalizada);
    }
}

