using MediatR;
using Microsoft.EntityFrameworkCore;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Application.Auth.Queries;

// ═══════════════════════════════════════════════════════
// QUERY: Retorna los datos del usuario autenticado.
// ═══════════════════════════════════════════════════════

public class GetCurrentUserQuery : IRequest<UsuarioMeDto>;

public record UsuarioMeDto(
    Guid Id,
    string NombreCompleto,
    string Email,
    string Rol,
    string Especialidad,
    Guid? OrganizationId,
    bool EsAdminOrganizacion,
    bool EstaActivo);

public class GetCurrentUserQueryHandler : IRequestHandler<GetCurrentUserQuery, UsuarioMeDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public GetCurrentUserQueryHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<UsuarioMeDto> Handle(GetCurrentUserQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("Usuario no autenticado.");

        var usuario = await _context.Usuarios
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken)
            ?? throw new NotFoundException("Usuario", userId);

        return new UsuarioMeDto(
            usuario.Id,
            usuario.NombreCompleto,
            usuario.Email,
            usuario.Rol.ToString(),
            usuario.Especialidad.ToString(),
            usuario.OrganizationId,
            usuario.EsAdminOrganizacion,
            usuario.EstaActivo);
    }
}
