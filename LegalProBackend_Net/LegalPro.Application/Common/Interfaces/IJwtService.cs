using LegalPro.Domain.Entities;

namespace LegalPro.Application.Common.Interfaces;

public interface IJwtService
{
    string GenerateToken(Usuario usuario);
    string GenerateRefreshToken();
}