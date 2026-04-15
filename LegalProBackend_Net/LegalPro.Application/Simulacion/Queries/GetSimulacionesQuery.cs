using FluentValidation;
using MediatR;
using LegalPro.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace LegalPro.Application.Simulacion.Queries;

// ═══════════════════════════════════════════════════════
// QUERY: Listar simulaciones del usuario autenticado.
// Tenant isolation: filtra por UsuarioId + OrganizationId.
// ═══════════════════════════════════════════════════════

public class GetSimulacionesQuery : IRequest<GetSimulacionesResult>
{
    public int Limit { get; set; } = 20;
}

public record SimulacionResumenDto(
    Guid Id,
    string RamaDerecho,
    string RolUsuario,
    string Dificultad,
    int PuntajeActual,
    bool EstaFinalizada,
    int TotalTurnos,
    DateTime CreadoEn);

public record GetSimulacionesResult(IReadOnlyList<SimulacionResumenDto> Simulaciones);

public class GetSimulacionesQueryValidator : AbstractValidator<GetSimulacionesQuery>
{
    public GetSimulacionesQueryValidator()
    {
        RuleFor(x => x.Limit)
            .InclusiveBetween(1, 100)
            .WithMessage("El límite debe estar entre 1 y 100.");
    }
}

public class GetSimulacionesQueryHandler : IRequestHandler<GetSimulacionesQuery, GetSimulacionesResult>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public GetSimulacionesQueryHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<GetSimulacionesResult> Handle(
        GetSimulacionesQuery request,
        CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId;
        var orgId = _currentUser.OrganizationId;

        var lista = await _context.Simulaciones
            .Where(s => s.UsuarioId == userId && s.OrganizationId == orgId)
            .OrderByDescending(s => s.CreatedAt)
            .Take(request.Limit)
            .Select(s => new SimulacionResumenDto(
                s.Id,
                s.RamaDerecho.ToString(),
                s.RolUsuario,
                s.DificultadModificador,
                s.PuntajeActual,
                s.EstaFinalizada,
                _context.EventosSimulacion.Count(e => e.SimulacionId == s.Id),
                s.CreatedAt))
            .ToListAsync(cancellationToken);

        return new GetSimulacionesResult(lista);
    }
}
