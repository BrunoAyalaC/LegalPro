using MediatR;
using Microsoft.EntityFrameworkCore;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Enums;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Application.Expedientes.Queries;

// ═══════════════════════════════════════════════════════
// QUERY: Estadísticas de expedientes del tenant.
// SRP: Solo lectura — sin side effects.
// Tenant isolation: filtra por OrganizationId del usuario autenticado.
// ═══════════════════════════════════════════════════════

public record GetExpedientesStatsQuery : IRequest<ExpedientesStatsDto>;

public record ExpedientesStatsDto(
    int Total,
    int Activos,
    int EnTramite,
    int Archivados,
    int Urgentes,
    int Penales,
    int Civiles,
    int Laborales,
    int Constitucionales,
    int Familia,
    int ContenciosoAdministrativos
);

public class GetExpedientesStatsQueryHandler : IRequestHandler<GetExpedientesStatsQuery, ExpedientesStatsDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public GetExpedientesStatsQueryHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<ExpedientesStatsDto> Handle(GetExpedientesStatsQuery request, CancellationToken cancellationToken)
    {
        var orgId = _currentUser.OrganizationId
            ?? throw new ForbiddenAccessException("No pertenece a ninguna organización.");

        // Una sola consulta al server: traemos solo las columnas necesarias para las estadísticas.
        var rows = await _context.Expedientes
            .Where(e => e.OrganizationId == orgId)
            .Select(e => new { e.Estado, e.Tipo, e.EsUrgente })
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return new ExpedientesStatsDto(
            Total: rows.Count,
            Activos: rows.Count(e => e.Estado == EstadoExpediente.Activo),
            EnTramite: rows.Count(e => e.Estado == EstadoExpediente.EnTramite),
            Archivados: rows.Count(e => e.Estado == EstadoExpediente.Archivado),
            Urgentes: rows.Count(e => e.EsUrgente),
            Penales: rows.Count(e => e.Tipo == TipoRamaProcesal.Penal),
            Civiles: rows.Count(e => e.Tipo == TipoRamaProcesal.Civil),
            Laborales: rows.Count(e => e.Tipo == TipoRamaProcesal.Laboral),
            Constitucionales: rows.Count(e => e.Tipo == TipoRamaProcesal.Constitucional),
            Familia: rows.Count(e => e.Tipo == TipoRamaProcesal.Familia),
            ContenciosoAdministrativos: rows.Count(e => e.Tipo == TipoRamaProcesal.ContenciosoAdministrativo)
        );
    }
}
