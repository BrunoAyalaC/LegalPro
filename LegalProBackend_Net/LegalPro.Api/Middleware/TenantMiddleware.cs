using LegalPro.Application.Common.Interfaces;

namespace LegalPro.Api.Middleware;

/// <summary>
/// Middleware de Multi-Tenancy.
/// Extrae el OrganizationId (TenantId) del contexto del usuario autenticado actual
/// y lo registra en el ITenantProvider de ciclo de vida Scoped para la solicitud.
/// </summary>
public class TenantMiddleware
{
    private readonly RequestDelegate _next;

    public TenantMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ITenantProvider tenantProvider, ICurrentUserService currentUserService)
    {
        if (currentUserService.IsAuthenticated && currentUserService.OrganizationId.HasValue)
        {
            tenantProvider.TenantId = currentUserService.OrganizationId.Value;
        }

        await _next(context);
    }
}
