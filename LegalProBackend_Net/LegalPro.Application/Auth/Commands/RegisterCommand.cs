using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using BCrypt.Net;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Entities;
using LegalPro.Domain.Enums;

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
            .Must(r => new[] { "Abogado", "Juez", "Fiscal", "Contador" }.Contains(r))
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
        if (await _context.Usuarios.AnyAsync(u => u.Email == request.Email, cancellationToken))
        {
            throw new Exception("El email ya está registrado.");
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

        return _jwtService.GenerateToken(usuario);
    }
}
