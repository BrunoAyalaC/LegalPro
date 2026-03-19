using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Entities;

namespace LegalPro.Infrastructure.Services;

public class JwtService : IJwtService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<JwtService> _logger;

    // Mínimo 32 caracteres para HS256 (256 bits)
    private const int MinSecretLength = 32;
    private const string ValidIssuer = "LegalProAPI";
    private const string ValidAudience = "LegalProClients";

    public JwtService(IConfiguration configuration, ILogger<JwtService> logger)
    {
        _configuration = configuration;
        _logger = logger;
        ValidateSecretOnStartup();
    }

    /// <summary>
    /// Valida en startup que el JWT_SECRET tenga longitud mínima segura.
    /// Falla rápido (fail-fast) antes de aceptar tráfico.
    /// </summary>
    private void ValidateSecretOnStartup()
    {
        var secret = _configuration["JWT_SECRET"] ?? _configuration["JwtSettings:Secret"];
        if (string.IsNullOrWhiteSpace(secret) || secret.Length < MinSecretLength)
        {
            throw new InvalidOperationException(
                $"JWT_SECRET inseguro: debe tener al menos {MinSecretLength} caracteres. " +
                "Genera uno con: openssl rand -hex 32");
        }
    }

    public string GenerateToken(Usuario usuario)
    {
        var secret = _configuration["JWT_SECRET"]
                     ?? _configuration["JwtSettings:Secret"]
                     ?? throw new InvalidOperationException("JWT_SECRET no está configurado.");

        // Expiry configurable, defecto 60 minutos (no días)
        var expiryMinutes = int.TryParse(_configuration["JWT_EXPIRY_MINUTES"], out var m) ? m : 60;

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var issuedAt = DateTime.UtcNow;
        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, usuario.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, usuario.Email),
            // iat (issued at): permite detectar tokens emitidos antes de un evento de seguridad
            new Claim(JwtRegisteredClaimNames.Iat,
                new DateTimeOffset(issuedAt).ToUnixTimeSeconds().ToString(),
                ClaimValueTypes.Integer64),
            new Claim(ClaimTypes.Role, usuario.Rol.ToString()),
            new Claim("especialidad", usuario.Especialidad.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        // organization_id es obligatorio para multi-tenancy — sin org el token no permite acceso a recursos
        if (usuario.OrganizationId.HasValue)
        {
            claims.Add(new Claim("organization_id", usuario.OrganizationId.Value.ToString()));
        }
        else
        {
            // Loguear advertencia: usuario sin organización puede acceder solo a endpoints públicos
            _logger.LogWarning(
                "JWT generado para usuario {UserId} sin organization_id asignado. " +
                "El acceso a recursos tenant-scoped será denegado.",
                usuario.Id);
        }

        var token = new JwtSecurityToken(
            issuer: ValidIssuer,
            audience: ValidAudience,
            claims: claims,
            notBefore: issuedAt,
            expires: issuedAt.AddMinutes(expiryMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        // 256 bits de aleatoriedad criptográfica (OWASP: token seguro)
        var bytes = System.Security.Cryptography.RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes);
    }

    /// <summary>
    /// Válida un AccessToken vencido y extrae el UserId del claim 'sub'.
    /// NO valida expiración ni firma para soportar el flujo de refresh.
    /// Retorna null si el token no es parseable o no tiene claim 'sub'.
    /// </summary>
    public int? GetUserIdFromExpiredToken(string token)
    {
        try
        {
            var secret = _configuration["JWT_SECRET"]
                         ?? _configuration["JwtSettings:Secret"]
                         ?? throw new InvalidOperationException("JWT_SECRET no configurado.");

            var tokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
                ValidateIssuer = true,
                ValidIssuer = ValidIssuer,
                ValidateAudience = true,
                ValidAudience = ValidAudience,
                // IMPORTANTE: no validar expiración para poder extraer claims de token vencido
                ValidateLifetime = false,
            };

            var principal = new JwtSecurityTokenHandler()
                .ValidateToken(token, tokenValidationParameters, out _);

            var sub = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                      ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            return int.TryParse(sub, out var id) ? id : null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo extraer UserId del token vencido.");
            return null;
        }
    }
}
