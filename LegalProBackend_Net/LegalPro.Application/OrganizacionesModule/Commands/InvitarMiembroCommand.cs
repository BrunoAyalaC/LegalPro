using FluentValidation;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Entities;
using LegalPro.Domain.Enums;
using LegalPro.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LegalPro.Application.OrganizacionesModule.Commands;

public class InvitarMiembroCommand : IRequest<InvitarMiembroResult>
{
    public string Email { get; set; } = string.Empty;
    public RolUsuario Rol { get; set; } = RolUsuario.Abogado;
}

public record InvitarMiembroResult(
    Guid InvitacionId,
    string Email,
    string Token,
    DateTime ExpiresAt);

public class InvitarMiembroValidator : AbstractValidator<InvitarMiembroCommand>
{
    public InvitarMiembroValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("El email del invitado es obligatorio.")
            .EmailAddress().WithMessage("El email no tiene un formato válido.")
            .MaximumLength(256).WithMessage("El email no puede superar 256 caracteres.");
    }
}

public class InvitarMiembroCommandHandler : IRequestHandler<InvitarMiembroCommand, InvitarMiembroResult>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public InvitarMiembroCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<InvitarMiembroResult> Handle(InvitarMiembroCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("Debe estar autenticado para invitar miembros.");

        var orgId = _currentUser.OrganizationId
            ?? throw new ForbiddenAccessException("No pertenece a ninguna organización.");

        // Verificar que el invitante es Owner o Admin mediante la membresía
        var miembroInvitante = await _context.MiembrosOrganizacion
            .FirstOrDefaultAsync(m => m.OrganizacionId == orgId && m.UsuarioId == userId && m.Activo, cancellationToken)
            ?? throw new ForbiddenAccessException("No es miembro activo de esta organización.");

        if (miembroInvitante.Rol != RolMiembro.Owner && miembroInvitante.Rol != RolMiembro.Admin)
            throw new ForbiddenAccessException("Solo los Owners y Admins pueden invitar nuevos miembros.");

        var emailNormalizado = request.Email.Trim().ToLowerInvariant();

        // Verificar que no existe una invitación pendiente activa para este email en esta org
        var invitacionExistente = await _context.InvitacionesOrganizacion
            .FirstOrDefaultAsync(i =>
                i.OrganizacionId == orgId &&
                i.Email == emailNormalizado &&
                !i.EsAceptada &&
                i.FechaExpiracion > DateTime.UtcNow,
                cancellationToken);

        if (invitacionExistente != null)
            throw new DomainException($"Ya existe una invitación pendiente para {request.Email}.");

        // Verificar que el usuario no es ya miembro activo
        var usuarioExistente = await _context.Usuarios
            .FirstOrDefaultAsync(u => u.Email == emailNormalizado, cancellationToken);

        if (usuarioExistente?.OrganizationId == orgId)
            throw new DomainException($"El usuario con email {request.Email} ya es miembro de esta organización.");

        var invitacion = InvitacionOrganizacion.Crear(orgId, emailNormalizado, request.Rol);
        await _context.InvitacionesOrganizacion.AddAsync(invitacion, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        return new InvitarMiembroResult(
            invitacion.Id,
            invitacion.Email,
            invitacion.Token,
            invitacion.FechaExpiracion);
    }
}
