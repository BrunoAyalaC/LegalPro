using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LegalPro.Application.Common.Behaviours;

/// <summary>
/// Marker interface para commands que crean recursos limitados por plan.
/// Ej: CrearExpedienteCommand implementa IPlanLimitedRequest con RecursoTipo = "expediente".
/// </summary>
public interface IPlanLimitedRequest
{
    /// <summary>Tipo de recurso a verificar: "expediente", "usuario", etc.</summary>
    string RecursoTipo { get; }
}

/// <summary>
/// MediatR Pipeline Behaviour: verifica límites de plan ANTES de ejecutar el command.
/// Solo actúa sobre requests que implementen IPlanLimitedRequest.
/// </summary>
public class PlanLimitsBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly ICurrentUserService _currentUser;
    private readonly IOrganizacionRepository _orgRepo;
    private readonly IApplicationDbContext _context;

    public PlanLimitsBehavior(
        ICurrentUserService currentUser,
        IOrganizacionRepository orgRepo,
        IApplicationDbContext context)
    {
        _currentUser = currentUser;
        _orgRepo = orgRepo;
        _context = context;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        if (request is IPlanLimitedRequest planRequest)
        {
            // Si no tiene org, dejamos pasar (el TenantValidationBehavior se encarga si aplica)
            if (!_currentUser.OrganizationId.HasValue)
                return await next();

            var orgId = _currentUser.OrganizationId.Value;

            var org = await _orgRepo.GetByIdAsync(orgId, cancellationToken)
                ?? throw new NotFoundException(nameof(Domain.Entities.Organizacion), orgId);

            int countActual = planRequest.RecursoTipo.ToLowerInvariant() switch
            {
                "expediente" => await _context.Expedientes
                    .CountAsync(e => e.OrganizationId == orgId, cancellationToken),
                "usuario" => await _context.Usuarios
                    .CountAsync(u => u.OrganizationId == orgId && u.EstaActivo, cancellationToken),
                _ => 0
            };

            // Throws DomainException si se superó el límite
            org.VerificarLimites(planRequest.RecursoTipo, countActual);
        }

        return await next();
    }
}
