using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Application.Simulacion.Queries;

// ═══════════════════════════════════════════════════════
// QUERY: Obtener estado del tablero de simulación
// Retorna la simulación con todos sus eventos ordenados por turno.
// OWASP A01: verifica UsuarioId + OrganizationId antes de retornar.
// ═══════════════════════════════════════════════════════

public class GetSimulacionBoardQuery : IRequest<SimulacionBoardDto>
{
    public int SimulacionId { get; set; }
}

public record EventoDto(
    int Turno,
    string Emisor,
    string Mensaje,
    string? LeyesInvocadas,
    DateTime CreadoEn);

public record SimulacionBoardDto(
    int Id,
    string Rama,
    string RolUsuario,
    string DificultadModificador,
    string ContextoSintetico,
    int PuntajeActual,
    bool EstaFinalizada,
    IReadOnlyList<EventoDto> Eventos,
    DateTime CreadoEn);

public class GetSimulacionBoardValidator : AbstractValidator<GetSimulacionBoardQuery>
{
    public GetSimulacionBoardValidator()
    {
        RuleFor(x => x.SimulacionId).GreaterThan(0).WithMessage("SimulacionId debe ser mayor que 0.");
    }
}

public class GetSimulacionBoardHandler : IRequestHandler<GetSimulacionBoardQuery, SimulacionBoardDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public GetSimulacionBoardHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<SimulacionBoardDto> Handle(GetSimulacionBoardQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new UnauthorizedAccessException("Usuario no autenticado.");
        var organizationId = _currentUser.OrganizationId;

        // OWASP A01: tenant isolation - solo el propietario puede ver la simulación
        var sim = await _context.Simulaciones
            .Include(s => s.Eventos)
            .Where(s => s.Id == request.SimulacionId
                     && s.UsuarioId == userId
                     && s.OrganizationId == organizationId)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new DomainException($"Simulación {request.SimulacionId} no encontrada o acceso denegado.");

        var eventos = sim.Eventos
            .OrderBy(e => e.Turno)
            .Select(e => new EventoDto(e.Turno, e.Emisor, e.Mensaje, e.LeyesInvocadas, e.CreatedAt))
            .ToList();

        return new SimulacionBoardDto(
            sim.Id,
            sim.RamaDerecho.ToString(),
            sim.RolUsuario,
            sim.DificultadModificador,
            sim.ContextoSintetico,
            sim.PuntajeActual,
            sim.EstaFinalizada,
            eventos,
            sim.CreatedAt);
    }
}
