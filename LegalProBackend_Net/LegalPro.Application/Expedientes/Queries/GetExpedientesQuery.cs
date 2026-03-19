using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Enums;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Application.Expedientes.Queries;

// ═══════════════════════════════════════════════════════
// QUERY: Listar expedientes del tenant con filtros y paginación.
// SRP: Solo lectura. Tenant isolation vía ICurrentUserService.
// ═══════════════════════════════════════════════════════

public class GetExpedientesQuery : IRequest<GetExpedientesResult>
{
    public string? Estado { get; set; }
    public string? Tipo { get; set; }
    public bool? EsUrgente { get; set; }
    public string? Search { get; set; }
    public int Page { get; set; } = 1;
    public int Limit { get; set; } = 20;
}

public record ExpedienteDto(
    int Id,
    string Numero,
    string Titulo,
    string Tipo,
    string Estado,
    bool EsUrgente,
    int UsuarioId,
    Guid OrganizationId,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record GetExpedientesResult(
    IReadOnlyList<ExpedienteDto> Expedientes,
    int Total,
    int Page,
    int TotalPages
);

public class GetExpedientesQueryValidator : AbstractValidator<GetExpedientesQuery>
{
    public GetExpedientesQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1).WithMessage("La página debe ser mayor o igual a 1.");
        RuleFor(x => x.Limit).InclusiveBetween(1, 100).WithMessage("El límite debe estar entre 1 y 100.");
        RuleFor(x => x.Estado)
            .Must(e => e == null || Enum.IsDefined(typeof(EstadoExpediente), e))
            .WithMessage("Estado inválido.")
            .When(x => x.Estado != null);
        RuleFor(x => x.Tipo)
            .Must(t => t == null || Enum.IsDefined(typeof(TipoRamaProcesal), t))
            .WithMessage("Tipo de rama procesal inválido.")
            .When(x => x.Tipo != null);
    }
}

public class GetExpedientesQueryHandler : IRequestHandler<GetExpedientesQuery, GetExpedientesResult>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public GetExpedientesQueryHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<GetExpedientesResult> Handle(GetExpedientesQuery request, CancellationToken cancellationToken)
    {
        var orgId = _currentUser.OrganizationId
            ?? throw new ForbiddenAccessException("No perteneces a ninguna organización. Crea o únete a una organización primero.");

        var query = _context.Expedientes
            .Where(e => e.OrganizationId == orgId)
            .AsNoTracking();

        // Filtros opcionales
        if (!string.IsNullOrWhiteSpace(request.Estado) &&
            Enum.TryParse<EstadoExpediente>(request.Estado, true, out var estado))
            query = query.Where(e => e.Estado == estado);

        if (!string.IsNullOrWhiteSpace(request.Tipo) &&
            Enum.TryParse<TipoRamaProcesal>(request.Tipo, true, out var tipo))
            query = query.Where(e => e.Tipo == tipo);

        if (request.EsUrgente.HasValue)
            query = query.Where(e => e.EsUrgente == request.EsUrgente.Value);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.ToLower().Trim();
            query = query.Where(e =>
                e.Titulo.ToLower().Contains(term) ||
                e.Numero.ToLower().Contains(term));
        }

        var total = await query.CountAsync(cancellationToken);
        var offset = (request.Page - 1) * request.Limit;

        var items = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip(offset)
            .Take(request.Limit)
            .Select(e => new ExpedienteDto(
                e.Id,
                e.Numero,
                e.Titulo,
                e.Tipo.ToString(),
                e.Estado.ToString(),
                e.EsUrgente,
                e.UsuarioId,
                e.OrganizationId,
                e.CreatedAt,
                e.UpdatedAt))
            .ToListAsync(cancellationToken);

        return new GetExpedientesResult(
            items,
            total,
            request.Page,
            (int)Math.Ceiling((double)total / request.Limit));
    }
}
