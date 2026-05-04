using MediatR;
using Microsoft.EntityFrameworkCore;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Application.OrganizacionesModule.Queries;

// ═══════════════════════════════════════════════════════
// QUERY: Lista los miembros activos de la organización
// del usuario autenticado.
// ═══════════════════════════════════════════════════════

public class GetMiembrosOrganizacionQuery : IRequest<IReadOnlyList<MiembroDto>>;

public record MiembroDto(
    Guid Id,
    string NombreCompleto,
    string Email,
    string Rol,
    string Especialidad,
    bool Activo,
    DateTime UnidoEn);

public class GetMiembrosOrganizacionQueryHandler : IRequestHandler<GetMiembrosOrganizacionQuery, IReadOnlyList<MiembroDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public GetMiembrosOrganizacionQueryHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<MiembroDto>> Handle(GetMiembrosOrganizacionQuery request, CancellationToken cancellationToken)
    {
        var orgId = _currentUser.OrganizationId
            ?? throw new ForbiddenAccessException("No pertenece a ninguna organización.");

        var miembros = await _context.MiembrosOrganizacion
            .AsNoTracking()
            .Include(m => m.Usuario)
            .Where(m => m.OrganizacionId == orgId && m.Activo)
            .OrderBy(m => m.UnidoEn)
            .Select(m => new MiembroDto(
                m.UsuarioId,
                m.Usuario != null ? m.Usuario.NombreCompleto : "",
                m.Usuario != null ? m.Usuario.Email : "",
                m.Rol.ToString(),
                m.Usuario != null ? m.Usuario.Especialidad.ToString() : "General",
                m.Activo,
                m.UnidoEn))
            .ToListAsync(cancellationToken);

        return miembros;
    }
}
