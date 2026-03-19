namespace LegalPro.Application.Common.Interfaces;

/// <summary>
/// Expone el contexto del usuario autenticado actualmente.
/// Implementado en Infrastructure con IHttpContextAccessor.
/// Los handlers CQRS usan esta interfaz para obtener UserId y OrganizationId
/// sin recibirlos desde el request body (evita spoofing).
/// </summary>
public interface ICurrentUserService
{
    /// <summary>ID del usuario autenticado (claim "sub").</summary>
    int? UserId { get; }

    /// <summary>ID de la organización (claim "organization_id").</summary>
    Guid? OrganizationId { get; }

    /// <summary>Email del usuario autenticado (claim "email").</summary>
    string? Email { get; }

    /// <summary>Rol legal del usuario (claim "role").</summary>
    string? Role { get; }

    /// <summary>Slug de la organización (claim "org_slug").</summary>
    string? OrgSlug { get; }

    /// <summary>True si el usuario tiene JWT válido.</summary>
    bool IsAuthenticated { get; }

    /// <summary>True si el usuario es administrador de su organización (claim "is_org_admin").</summary>
    bool IsOrgAdmin { get; }
}
