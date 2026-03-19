using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Entities;
using LegalPro.Domain.Enums;
using LegalPro.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LegalPro.Application.OrganizacionesModule.Queries;

public class GetCurrentOrganizacionQuery : IRequest<OrganizacionDetailDto>
{
}

public record OrganizacionDetailDto(
    Guid Id,
    string Nombre,
    string Slug,
    string Plan,
    int MaxUsuarios,
    int MaxExpedientes,
    decimal StorageGbLimit,
    bool Activo,
    int MiembrosActivos,
    DateTime CreadoEn);

public class GetCurrentOrganizacionQueryHandler : IRequestHandler<GetCurrentOrganizacionQuery, OrganizacionDetailDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public GetCurrentOrganizacionQueryHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<OrganizacionDetailDto> Handle(GetCurrentOrganizacionQuery request, CancellationToken cancellationToken)
    {
        var orgId = _currentUser.OrganizationId
            ?? throw new ForbiddenAccessException("No pertenece a ninguna organización.");

        var org = await _context.Organizaciones
            .Include(o => o.MembresiaDetallada)
            .FirstOrDefaultAsync(o => o.Id == orgId, cancellationToken)
            ?? throw new NotFoundException(nameof(Organizacion), orgId);

        var miembrosActivos = org.MembresiaDetallada.Count(m => m.Activo);

        return new OrganizacionDetailDto(
            org.Id,
            org.Nombre,
            org.Slug,
            org.Plan.ToString(),
            org.MaxUsuarios,
            org.MaxExpedientes,
            org.StorageGbLimit,
            org.Activo,
            miembrosActivos,
            org.CreatedAt);
    }
}
