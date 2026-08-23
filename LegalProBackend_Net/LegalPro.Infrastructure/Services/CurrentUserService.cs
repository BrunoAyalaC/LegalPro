using System.Security.Claims;
using LegalPro.Application.Common.Interfaces;
using Microsoft.AspNetCore.Http;

namespace LegalPro.Infrastructure.Services;

/// <summary>
/// Implementación de ICurrentUserService usando IHttpContextAccessor.
/// Lee los claims del JWT ya validado por el middleware de autenticación.
/// No lanza excepciones — retorna null/false si el claim no existe,
/// dejando al handler el control de qué hacer cuando falta un claim.
/// </summary>
public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

    /// <inheritdoc/>
    /// <remarks>
    /// Busca primero el claim "sub" (JwtRegisteredClaimNames.Sub) y también
    /// ClaimTypes.NameIdentifier por compatibilidad con el mapper de ASP.NET Core.
    /// </remarks>
    public Guid? UserId
    {
        get
        {
            // "sub" puede quedar como "sub" (si MapInboundClaims=false)
            // o mapearse a NameIdentifier (si MapInboundClaims=true, default)
            var value = User?.FindFirstValue("sub")
                        ?? User?.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(value, out var id) ? id : null;
        }
    }

    /// <inheritdoc/>
    public Guid? OrganizationId
    {
        get
        {
            var value = User?.FindFirstValue("organization_id");
            return Guid.TryParse(value, out var id) ? id : null;
        }
    }

    /// <inheritdoc/>
    /// <remarks>
    /// JwtService emite con JwtRegisteredClaimNames.Email ("email").
    /// ASP.NET Core puede mapear "email" al URI largo de ClaimTypes.Email.
    /// Se busca ambas formas por seguridad.
    /// </remarks>
    public string? Email
        => User?.FindFirstValue("email")
           ?? User?.FindFirstValue(ClaimTypes.Email);

    /// <inheritdoc/>
    /// <remarks>
    /// Lectura multi-origen del claim de rol:
    ///   1. "rol" — claim emitido por el backend Node.js (legalpro-app/server/utils/jwt.js:52)
    ///      con el rol profesional (ABOGADO/FISCAL/JUEZ/CONTADOR). MapInboundClaims de ASP.NET
    ///      NO lo reescribe (solo mapea "role" → ClaimTypes.Role), así que llega intacto como "rol".
    ///   2. ClaimTypes.Role — claim emitido por JwtService (.NET) con el rol de membresía.
    ///   3. "role" — variante corta por compatibilidad con clientes que emiten "role".
    /// Nota: NO se unifican los modelos de rol (decisión de @abogado-chief/@arquitecto-chief);
    ///       esto solo hace que el claim "rol" sea legible vía ICurrentUserService.Role.
    /// </remarks>
    public string? Role
        => User?.FindFirstValue("rol")
           ?? User?.FindFirstValue(ClaimTypes.Role)
           ?? User?.FindFirstValue("role");

    /// <inheritdoc/>
    public string? OrgSlug => User?.FindFirstValue("org_slug");

    /// <inheritdoc/>
    public bool IsAuthenticated => User?.Identity?.IsAuthenticated ?? false;

    /// <inheritdoc/>
    /// <remarks>
    /// El claim "is_org_admin" es emitido como string "True"/"False".
    /// Si el claim no existe, retorna false por defecto (principio de mínimo privilegio).
    /// </remarks>
    public bool IsOrgAdmin
    {
        get
        {
            var value = User?.FindFirstValue("is_org_admin");
            return bool.TryParse(value, out var result) && result;
        }
    }
}
