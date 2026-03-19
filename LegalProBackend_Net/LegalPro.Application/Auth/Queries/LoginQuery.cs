using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using BCrypt.Net;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Entities;
using LegalPro.Domain.Enums;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Application.Auth.Queries;

public class LoginQuery : IRequest<string>
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginQueryValidator : AbstractValidator<LoginQuery>
{
    public LoginQueryValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("El correo electrónico es obligatorio.")
            .EmailAddress().WithMessage("El correo electrónico no tiene formato válido.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("La contraseña es obligatoria.")
            .MinimumLength(6).WithMessage("La contraseña debe tener al menos 6 caracteres.");
    }
}

public class LoginQueryHandler : IRequestHandler<LoginQuery, string>
{
    private readonly IApplicationDbContext _context;
    private readonly IJwtService _jwtService;
    private readonly IOrganizacionRepository _orgRepo;

    public LoginQueryHandler(
        IApplicationDbContext context,
        IJwtService jwtService,
        IOrganizacionRepository orgRepo)
    {
        _context = context;
        _jwtService = jwtService;
        _orgRepo = orgRepo;
    }

    public async Task<string> Handle(LoginQuery request, CancellationToken cancellationToken)
    {
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(
            u => u.Email == request.Email.Trim().ToLowerInvariant(), cancellationToken);

        if (usuario == null)
            throw new AuthenticationFailedException();

        if (!BCrypt.Net.BCrypt.Verify(request.Password, usuario.PasswordHash))
            throw new AuthenticationFailedException();

        // Auto-crear organización personal si el usuario no tiene una.
        // Garantiza que el JWT siempre incluya organization_id para acceso a recursos.
        // Aplica a usuarios existentes en producción que aún no tienen organización.
        if (!usuario.OrganizationId.HasValue)
        {
            var slug = GenerarSlugPersonal(usuario.Email);
            while (await _orgRepo.SlugExistsAsync(slug, cancellationToken))
                slug = $"{slug}-{Guid.NewGuid().ToString("N")[..6]}";

            var org = Organizacion.Crear(
                $"Org. de {usuario.NombreCompleto}",
                slug,
                PlanTipo.Free);

            await _orgRepo.AddAsync(org, cancellationToken);

            usuario.AsignarOrganizacion(org.Id, esAdmin: true);

            var miembro = MiembroOrganizacion.Crear(org.Id, usuario.Id, RolMiembro.Owner);
            await _context.MiembrosOrganizacion.AddAsync(miembro, cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);
        }

        return _jwtService.GenerateToken(usuario);
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
