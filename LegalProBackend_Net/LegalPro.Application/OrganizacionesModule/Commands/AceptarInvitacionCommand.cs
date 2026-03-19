using FluentValidation;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Entities;
using LegalPro.Domain.Enums;
using LegalPro.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LegalPro.Application.OrganizacionesModule.Commands;

public class AceptarInvitacionCommand : IRequest<AceptarInvitacionResult>
{
    public string Token { get; set; } = string.Empty;
}

public record AceptarInvitacionResult(
    Guid OrganizacionId,
    string OrgNombre,
    string OrgSlug,
    string NuevoToken);

public class AceptarInvitacionValidator : AbstractValidator<AceptarInvitacionCommand>
{
    public AceptarInvitacionValidator()
    {
        RuleFor(x => x.Token)
            .NotEmpty().WithMessage("El token de invitación es obligatorio.")
            .MaximumLength(200).WithMessage("Token inválido.");
    }
}

public class AceptarInvitacionCommandHandler : IRequestHandler<AceptarInvitacionCommand, AceptarInvitacionResult>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;
    private readonly IJwtService _jwtService;

    public AceptarInvitacionCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUser,
        IJwtService jwtService)
    {
        _context = context;
        _currentUser = currentUser;
        _jwtService = jwtService;
    }

    public async Task<AceptarInvitacionResult> Handle(AceptarInvitacionCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("Debe estar autenticado para aceptar una invitación.");

        var usuario = await _context.Usuarios
            .Include(u => u.Organizacion)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken)
            ?? throw new NotFoundException(nameof(Usuario), userId);

        // Buscar invitación por token incluyendo la organización
        var invitacion = await _context.InvitacionesOrganizacion
            .Include(i => i.Organizacion)
            .FirstOrDefaultAsync(i => i.Token == request.Token, cancellationToken)
            ?? throw new NotFoundException("Invitación", request.Token);

        // Verificar que la invitación sea para el email del usuario actual
        if (!string.Equals(invitacion.Email, usuario.Email, StringComparison.OrdinalIgnoreCase))
            throw new ForbiddenAccessException("Esta invitación no está dirigida a su cuenta.");

        if (!invitacion.EsValida())
            throw new DomainException(
                invitacion.EsAceptada
                    ? "Esta invitación ya fue utilizada anteriormente."
                    : "La invitación ha expirado. Solicite una nueva invitación.");

        var org = invitacion.Organizacion
            ?? throw new NotFoundException(nameof(Organizacion), invitacion.OrganizacionId);

        // Aceptar la invitación (dispara InvitacionAceptadaEvent en la entidad pero primero en Aceptar())
        invitacion.Aceptar();

        // Asignar la organización al usuario si no tiene una
        if (!usuario.OrganizationId.HasValue)
        {
            usuario.AsignarOrganizacion(org.Id, esAdmin: invitacion.Rol == RolUsuario.Abogado ? false : false);
        }

        // Crear membresía detallada
        var rolMiembro = invitacion.Rol switch
        {
            _ => RolMiembro.Member
        };

        var miembroExistente = await _context.MiembrosOrganizacion
            .FirstOrDefaultAsync(m => m.OrganizacionId == org.Id && m.UsuarioId == userId, cancellationToken);

        if (miembroExistente == null)
        {
            var nuevoMiembro = MiembroOrganizacion.Crear(org.Id, userId, rolMiembro);
            await _context.MiembrosOrganizacion.AddAsync(nuevoMiembro, cancellationToken);
        }

        await _context.SaveChangesAsync(cancellationToken);

        // Emitir evento de invitación aceptada (dominio)
        invitacion.AddDomainEvent(new Domain.Events.InvitacionAceptadaEvent(invitacion.Id, org.Id, invitacion.Email));

        // Regenerar token con org_id actualizado
        var usuarioActualizado = await _context.Usuarios
            .Include(u => u.Organizacion)
            .FirstAsync(u => u.Id == userId, cancellationToken);

        var nuevoToken = _jwtService.GenerateToken(usuarioActualizado);

        return new AceptarInvitacionResult(org.Id, org.Nombre, org.Slug, nuevoToken);
    }
}
