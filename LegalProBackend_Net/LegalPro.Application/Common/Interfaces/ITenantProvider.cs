namespace LegalPro.Application.Common.Interfaces;

/// <summary>
/// Proveedor con ámbito de solicitud (scoped) para almacenar y recuperar el ID del tenant actual (OrganizationId).
/// Permite que el DbContext aplique filtros de forma dinámica y desacoplada del HttpContext.
/// </summary>
public interface ITenantProvider
{
    Guid? TenantId { get; set; }
}
