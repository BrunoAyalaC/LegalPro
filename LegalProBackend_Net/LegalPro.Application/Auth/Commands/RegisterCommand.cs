using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using BCrypt.Net;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Entities;
using LegalPro.Domain.Enums;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Application.Auth.Commands;

public class RegisterCommand : IRequest<string>
{
    public string NombreCompleto { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Rol { get; set; } = "Abogado";
    public string Especialidad { get; set; } = string.Empty;
}

public class RegisterCommandValidator : AbstractValidator<RegisterCommand>
{
    public RegisterCommandValidator()
    {
        RuleFor(x => x.NombreCompleto)
            .NotEmpty().WithMessage("El nombre completo es obligatorio.")
            .MinimumLength(5).WithMessage("El nombre debe tener al menos 5 caracteres.");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("El correo electrónico es obligatorio.")
            .EmailAddress().WithMessage("El correo electrónico no tiene formato válido.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("La contraseña es obligatoria.")
            .MinimumLength(8).WithMessage("La contraseña debe tener al menos 8 caracteres.")
            .Matches(@"[A-Z]").WithMessage("La contraseña debe contener al menos una mayúscula.")
            .Matches(@"[0-9]").WithMessage("La contraseña debe contener al menos un número.");

        RuleFor(x => x.Rol)
            .NotEmpty().WithMessage("El rol es obligatorio.")
            .Must(r => new[] { "Abogado", "Juez", "Fiscal", "Contador" }
                .Any(v => string.Equals(v, r, StringComparison.OrdinalIgnoreCase)))
            .WithMessage("Rol inválido. Valores permitidos: Abogado, Juez, Fiscal, Contador.");
    }
}

public class RegisterCommandHandler : IRequestHandler<RegisterCommand, string>
{
    private readonly IApplicationDbContext _context;
    private readonly IJwtService _jwtService;

    public RegisterCommandHandler(IApplicationDbContext context, IJwtService jwtService)
    {
        _context = context;
        _jwtService = jwtService;
    }

    public async Task<string> Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        if (await _context.Usuarios.AnyAsync(
            u => u.Email == request.Email.Trim().ToLowerInvariant(), cancellationToken))
        {
            throw new ConflictException("El email ya está registrado.");
        }

        if (!Enum.TryParse<RolUsuario>(request.Rol, true, out var rol))
            rol = RolUsuario.Abogado;

        if (!Enum.TryParse<EspecialidadDerecho>(request.Especialidad, true, out var especialidad))
            especialidad = EspecialidadDerecho.General;

        var usuario = Usuario.Crear(
            request.NombreCompleto,
            request.Email,
            BCrypt.Net.BCrypt.HashPassword(request.Password),
            rol,
            especialidad
        );

        _context.Usuarios.Add(usuario);
        await _context.SaveChangesAsync(cancellationToken);

        // Crear organización personal automáticamente al registrarse.
        // Garantiza que el JWT incluya organization_id desde el primer acceso.
        var slug = GenerarSlugPersonal(request.Email);
        while (await _context.Organizaciones.AnyAsync(o => o.Slug == slug, cancellationToken))
        {
            var suffix = Guid.NewGuid().ToString("N")[..6];
            slug = $"{slug[..Math.Min(slug.Length, 30)]}-{suffix}";
        }

        var org = Organizacion.Crear(
            $"Org. de {request.NombreCompleto}",
            slug,
            PlanTipo.Free);

        _context.Organizaciones.Add(org);
        usuario.AsignarOrganizacion(org.Id, esAdmin: true);

        var miembro = MiembroOrganizacion.Crear(org.Id, usuario.Id, RolMiembro.Owner);
        _context.MiembrosOrganizacion.Add(miembro);

        await _context.SaveChangesAsync(cancellationToken);

        // Recargar para que GenerateToken incluya la org y emita organization_id en JWT
        var usuarioConOrg = await _context.Usuarios
            .FirstAsync(u => u.Id == usuario.Id, cancellationToken);

        return _jwtService.GenerateToken(usuarioConOrg);
    }

    private static string GenerarSlugPersonal(string email)
    {
        var prefix = email.Split('@')[0]
            .ToLowerInvariant()
            .Replace(".", "-")
            .Replace("_", "-");
        if (prefix.Length > 30) prefix = prefix[..30];
        return $"{prefix}-{Guid.NewGuid().ToString("N")[..8]}";
    }
}
