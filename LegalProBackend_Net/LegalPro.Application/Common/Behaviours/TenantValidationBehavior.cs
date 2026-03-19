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
            if (!_currentUser.OrganizationId.HasValue)
                throw new ForbiddenAccessException(
                    "El usuario no pertenece a ninguna organización. Cree o únase a una antes de continuar.");

            // Si el request especifica un OrganizationId no vacío, verificar que coincida
            if (tenantRequest.OrganizationId != Guid.Empty &&
                tenantRequest.OrganizationId != _currentUser.OrganizationId.Value)
            {
                throw new ForbiddenAccessException(
                    "No tiene acceso a los recursos de esta organización.");
            }
        }

        return await next();
    }
}
