using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Entities;
using LegalPro.Domain.Enums;
using LegalPro.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LegalPro.Application.OrganizacionesModule.Commands;

public class RemoverMiembroCommand : IRequest<Unit>
{
    public int UsuarioId { get; set; }
}

public class RemoverMiembroCommandHandler : IRequestHandler<RemoverMiembroCommand, Unit>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public RemoverMiembroCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<Unit> Handle(RemoverMiembroCommand request, CancellationToken cancellationToken)
    {
        var callerUserId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("Debe estar autenticado.");

        var orgId = _currentUser.OrganizationId
            ?? throw new ForbiddenAccessException("No pertenece a ninguna organización.");

        // Solo Owner o Admin puede remover miembros
        var caller = await _context.MiembrosOrganizacion
            .FirstOrDefaultAsync(m => m.OrganizacionId == orgId && m.UsuarioId == callerUserId && m.Activo, cancellationToken)
            ?? throw new ForbiddenAccessException("No es miembro activo de esta organización.");

        if (caller.Rol != RolMiembro.Owner && caller.Rol != RolMiembro.Admin)
            throw new ForbiddenAccessException("Solo los Owners y Admins pueden remover miembros.");

        // No puede removerse a sí mismo por esta ruta
        if (request.UsuarioId == callerUserId)
            throw new DomainException("Use el endpoint de salir de organización para abandonarla usted mismo.");

        var org = await _context.Organizaciones
            .Include(o => o.MembresiaDetallada)
            .FirstOrDefaultAsync(o => o.Id == orgId, cancellationToken)
            ?? throw new NotFoundException(nameof(Organizacion), orgId);

        // Usa el método de dominio que verifica la regla del único Owner
        org.RemoverMiembro(request.UsuarioId);

        // Desasignar organización del usuario si era esta su org principal
        var usuario = await _context.Usuarios
            .FirstOrDefaultAsync(u => u.Id == request.UsuarioId && u.OrganizationId == orgId, cancellationToken);

        usuario?.AsignarOrganizacion(orgId, false);  // Esto solo actualiza — opcionalmente limpiar el FK

        await _context.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }
}
