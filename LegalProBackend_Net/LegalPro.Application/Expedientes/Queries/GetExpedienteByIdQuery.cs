using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Application.Expedientes.Queries;

// ═══════════════════════════════════════════════════════
// QUERY: Obtener expediente por Id con aislamiento de tenant.
// A01 Protection: filtra simultáneamente por Id y OrganizationId —
// evita leakage de información cross-tenant.
// ═══════════════════════════════════════════════════════

public record GetExpedienteByIdQuery(Guid Id) : IRequest<ExpedienteDto>;

public class GetExpedienteByIdQueryValidator : AbstractValidator<GetExpedienteByIdQuery>
{
    public GetExpedienteByIdQueryValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("El Id del expediente debe ser mayor a 0.");
    }
}

public class GetExpedienteByIdQueryHandler : IRequestHandler<GetExpedienteByIdQuery, ExpedienteDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public GetExpedienteByIdQueryHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<ExpedienteDto> Handle(GetExpedienteByIdQuery request, CancellationToken cancellationToken)
    {
        var orgId = _currentUser.OrganizationId
            ?? throw new ForbiddenAccessException("No perteneces a ninguna organización. Crea o únete a una organización primero.");

        // Filtra por Id Y OrganizationId en una sola consulta:
        // — si el recurso existe pero es de otro tenant, devuelve NotFoundException (no 403)
        //   para evitar revelar la existencia del recurso (OWASP A01).
        var expediente = await _context.Expedientes
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == request.Id && e.OrganizationId == orgId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Entities.Expediente), request.Id);

        return new ExpedienteDto(
            expediente.Id,
            expediente.Numero,
            expediente.Titulo,
            expediente.Tipo.ToString(),
            expediente.Estado.ToString(),
            expediente.EsUrgente,
            expediente.UsuarioId,
            expediente.OrganizationId,
            expediente.CreatedAt,
            expediente.UpdatedAt);
    }
}

