using FluentValidation;
using MediatR;
using LegalPro.Application.Common.Behaviours;
using Microsoft.EntityFrameworkCore;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Entities;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Application.Documentos.Queries;

// ═══════════════════════════════════════════════════════
// QUERY: Lista documentos de un expediente filtrados
// por organización del usuario autenticado.
// ═══════════════════════════════════════════════════════

public class GetDocumentosByExpedienteQuery : IRequest<IReadOnlyList<DocumentoDto>>, ITenantRequest
{
    public Guid ExpedienteId { get; set; }
    public Guid OrganizationId { get; set; }
}

public record DocumentoDto(
    Guid Id,
    string Titulo,
    string? Contenido,
    string? Url,
    string Tipo,
    Guid ExpedienteId,
    Guid OrganizationId,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public class GetDocumentosByExpedienteValidator : AbstractValidator<GetDocumentosByExpedienteQuery>
{
    public GetDocumentosByExpedienteValidator()
    {
        RuleFor(x => x.ExpedienteId).NotEmpty().WithMessage("El expediente es obligatorio.");
    }
}

public class GetDocumentosByExpedienteHandler : IRequestHandler<GetDocumentosByExpedienteQuery, IReadOnlyList<DocumentoDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public GetDocumentosByExpedienteHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<DocumentoDto>> Handle(GetDocumentosByExpedienteQuery request, CancellationToken cancellationToken)
    {
        var orgId = _currentUser.OrganizationId
            ?? throw new ForbiddenAccessException("No pertenece a ninguna organización.");

        // Verificar que el expediente pertenece a la organización
        var expedienteExiste = await _context.Expedientes
            .AsNoTracking()
            .AnyAsync(e => e.Id == request.ExpedienteId && e.OrganizationId == orgId, cancellationToken);

        if (!expedienteExiste)
            throw new NotFoundException("Expediente", request.ExpedienteId);

        var documentos = await _context.Documentos
            .AsNoTracking()
            .Where(d => d.ExpedienteId == request.ExpedienteId && d.OrganizationId == orgId)
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => new DocumentoDto(
                d.Id,
                d.Titulo,
                d.Contenido,
                d.Url,
                d.Tipo,
                d.ExpedienteId,
                // OrganizationId es Guid? en la entidad; el DTO expone Guid (no-null).
                // El filtro en Where garantiza no-null en la fila retornada.
                d.OrganizationId!.Value,
                d.CreatedAt,
                d.UpdatedAt))
            .ToListAsync(cancellationToken);

        return documentos;
    }
}
