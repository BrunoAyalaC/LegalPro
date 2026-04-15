using LegalPro.Domain.Common;

namespace LegalPro.Domain.Entities;

public class RefreshToken : BaseGuidEntity
{
    public Guid UsuarioId { get; private set; }
    public string Token { get; private set; } = string.Empty;
    public DateTime ExpiresAt { get; private set; }
    public bool IsRevoked { get; private set; }
    public DateTime? RevokedAt { get; private set; }
    public string? ReplacedByToken { get; private set; }

    // Nav
    public Usuario? Usuario { get; private set; }

    private RefreshToken() { }

    public static RefreshToken Crear(Guid usuarioId, string token, DateTime expiresAt)
    {
        if (string.IsNullOrWhiteSpace(token)) throw new ArgumentException("Token requerido.", nameof(token));
        if (expiresAt <= DateTime.UtcNow) throw new ArgumentException("Expiry debe ser futura.", nameof(expiresAt));

        return new RefreshToken
        {
            Id = Guid.NewGuid(),
            UsuarioId = usuarioId,
            Token = token,
            ExpiresAt = expiresAt,
            IsRevoked = false
        };
    }

    public void Revocar(string? replacedByToken = null)
    {
        IsRevoked = true;
        RevokedAt = DateTime.UtcNow;
        ReplacedByToken = replacedByToken;
    }

    public bool IsActive => !IsRevoked && ExpiresAt > DateTime.UtcNow;
}
