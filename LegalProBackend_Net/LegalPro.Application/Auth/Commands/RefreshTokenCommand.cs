using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Entities;

namespace LegalPro.Application.Auth.Commands;

// ═══════════════════════════════════════════════════════════════
// Flujo de Refresh Token — rotación segura (RFC 6819 §5.2.2.3).
// Patrón: token anterior → revocado, nuevo token emitido.
// No requiere JWT expirado: solo valida el refresh token en BD.
// ═══════════════════════════════════════════════════════════════

public class RefreshTokenCommand : IRequest<RefreshTokenResult>
{
    public string RefreshToken { get; set; } = string.Empty;
}

public record RefreshTokenResult(string AccessToken, string NewRefreshToken, DateTime ExpiresAt);

public class RefreshTokenCommandValidator : AbstractValidator<RefreshTokenCommand>
{
    public RefreshTokenCommandValidator()
    {
        RuleFor(x => x.RefreshToken)
            .NotEmpty().WithMessage("El refresh token es obligatorio.")
            .MinimumLength(16).WithMessage("Formato de refresh token inválido.");
    }
}

public class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, RefreshTokenResult>
{
    private readonly IApplicationDbContext _db;
    private readonly IJwtService _jwt;

    public RefreshTokenCommandHandler(IApplicationDbContext db, IJwtService jwt)
    {
        _db = db;
        _jwt = jwt;
    }

    public async Task<RefreshTokenResult> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        var stored = await _db.RefreshTokens
            .Include(rt => rt.Usuario)
            .FirstOrDefaultAsync(rt => rt.Token == request.RefreshToken, cancellationToken);

        if (stored == null || !stored.IsActive)
            throw new UnauthorizedAccessException("Refresh token inválido o expirado.");

        // Rotación: revocar token anterior
        var newRawToken = _jwt.GenerateRefreshToken();
        stored.Revocar(replacedByToken: newRawToken);

        // Emitir nuevo refresh token (30 días)
        var newRefreshToken = RefreshToken.Crear(
            usuarioId: stored.UsuarioId,
            token: newRawToken,
            expiresAt: DateTime.UtcNow.AddDays(30));

        _db.RefreshTokens.Add(newRefreshToken);
        await _db.SaveChangesAsync(cancellationToken);

        var accessToken = _jwt.GenerateToken(stored.Usuario!);

        return new RefreshTokenResult(
            AccessToken: accessToken,
            NewRefreshToken: newRawToken,
            ExpiresAt: newRefreshToken.ExpiresAt);
    }
}
