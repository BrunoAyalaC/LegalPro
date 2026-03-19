using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using BCrypt.Net;
using LegalPro.Application.Common.Interfaces;

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

    public LoginQueryHandler(IApplicationDbContext context, IJwtService jwtService)
    {
        _context = context;
        _jwtService = jwtService;
    }

    public async Task<string> Handle(LoginQuery request, CancellationToken cancellationToken)
    {
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Email == request.Email, cancellationToken);

        if (usuario == null)
        {
            throw new Exception("Credenciales incorrectas.");
        }

        if (!BCrypt.Net.BCrypt.Verify(request.Password, usuario.PasswordHash))
        {
            throw new Exception("Credenciales incorrectas.");
        }

        return _jwtService.GenerateToken(usuario);
    }
}
