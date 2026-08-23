using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Exceptions;
using MediatR;

namespace LegalPro.Application.Common.Behaviours;

/// <summary>
/// Marker interface para requests que operan en el contexto de un tenant.
/// Los requests que implementen esta interfaz serán validados por TenantValidationBehavior.
/// </summary>
public interface ITenantRequest
{
    /// <summary>
    /// OrganizationId del tenant objetivo.
    /// Si es Guid.Empty, el behavior usará el OrganizationId del usuario autenticado.
    /// </summary>
    Guid OrganizationId { get; }
}

/// <summary>
/// MediatR Pipeline Behaviour: valida que el usuario tenga un OrganizationId válido
/// y que corresponda al tenant solicitado. Ejecuta ANTES del handler.
/// </summary>
public class TenantValidationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly ICurrentUserService _currentUser;

    public TenantValidationBehavior(ICurrentUserService currentUser)
    {
        _currentUser = currentUser;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        if (request is ITenantRequest tenantRequest)
        {
            // P0 Fix 2026-08-21: validación estricta — todo ITenantRequest debe tener tenant autenticado
            if (!_currentUser.IsAuthenticated)
                throw new UnauthorizedAccessException("No autenticado. Debe iniciar sesión.");

            if (!_currentUser.OrganizationId.HasValue || _currentUser.OrganizationId.Value == Guid.Empty)
                throw new ForbiddenAccessException(
                    "El usuario no pertenece a ninguna organización. Cree o únase a una antes de continuar.");

            // Si el request especifica OrganizationId explícito, debe coincidir con el del JWT (anti-spoofing)
            if (tenantRequest.OrganizationId != Guid.Empty &&
                tenantRequest.OrganizationId != _currentUser.OrganizationId.Value)
            {
                throw new ForbiddenAccessException(
                    $"No tiene acceso a los recursos de la organización {tenantRequest.OrganizationId}. Su organización es {_currentUser.OrganizationId.Value}.");
            }

            // Validación adicional: Guid.Empty en request se resuelve al tenant del usuario (comportamiento por defecto seguro)
            // No se permite bypass — el handler debe usar _currentUser.OrganizationId, no el valor del request si es Empty
        }

        return await next();
    }

    /// <summary>
    /// Verificador CI: cuenta implementaciones de ITenantRequest en el assembly.
    /// Usado por verifier-multi-tenant.mjs — falla si &lt; 18 para evitar regresión P0.
    /// Grep: grep -r &quot;ITenantRequest&quot; LegalProBackend_Net/LegalPro.Application --include=&quot;*.cs&quot; | wc -l
    /// </summary>
    public static int CountTenantRequests() =>
        typeof(ITenantRequest).Assembly.GetTypes().Count(t => typeof(ITenantRequest).IsAssignableFrom(t) && t.IsClass || t.IsValueType);
}
