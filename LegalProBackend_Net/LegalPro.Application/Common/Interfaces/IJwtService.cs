using LegalPro.Domain.Entities;

namespace LegalPro.Application.Common.Interfaces;

public interface IJwtService
{
    string GenerateToken(Usuario usuario);
    string GenerateRefreshToken();
    /// <summary>Valida el AccessToken vencido y devuelve el UserId del claim 'sub'. Retorna null si el token es inválido.</summary>
    int? GetUserIdFromExpiredToken(string token);
}
