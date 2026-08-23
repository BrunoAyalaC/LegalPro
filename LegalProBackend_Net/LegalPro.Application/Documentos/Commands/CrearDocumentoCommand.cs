using FluentValidation;
using MediatR;
using LegalPro.Application.Common.Behaviours;
using Microsoft.EntityFrameworkCore;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Entities;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Application.Documentos.Commands;

// ═══════════════════════════════════════════════════════
// COMMAND: Crea un documento (metadata) asociado a un
// expediente validando multi-tenancy.
// ═══════════════════════════════════════════════════════

public class CrearDocumentoCommand : IRequest<DocumentoCreadoDto>, ITenantRequest
{
    public string Titulo { get; set; } = string.Empty;
    public string? Contenido { get; set; }
    public string? Url { get; set; }
    public string Tipo { get; set; } = "escrito";
    public Guid ExpedienteId { get; set; }
    public Guid OrganizationId { get; set; }
}

public record DocumentoCreadoDto(
    Guid Id,
    string Titulo,
    string? Contenido,
    string? Url,
    string Tipo,
    Guid ExpedienteId,
    Guid OrganizationId,
    DateTime CreatedAt);

public class CrearDocumentoValidator : AbstractValidator<CrearDocumentoCommand>
{
    public CrearDocumentoValidator()
    {
        RuleFor(x => x.Titulo)
            .NotEmpty().WithMessage("El título es obligatorio.")
            .MaximumLength(500);

        RuleFor(x => x.ExpedienteId)
            .NotEmpty().WithMessage("El expediente es obligatorio.");
    }
}

public class CrearDocumentoHandler : IRequestHandler<CrearDocumentoCommand, DocumentoCreadoDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public CrearDocumentoHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<DocumentoCreadoDto> Handle(CrearDocumentoCommand request, CancellationToken cancellationToken)
    {
        var orgId = _currentUser.OrganizationId
            ?? throw new ForbiddenAccessException("No pertenece a ninguna organización.");

        // Verificar que el expediente pertenece a la organización
        var expediente = await _context.Expedientes
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == request.ExpedienteId && e.OrganizationId == orgId, cancellationToken)
            ?? throw new NotFoundException("Expediente", request.ExpedienteId);

        var documento = Documento.Crear(
            request.Titulo,
            request.Contenido,
            request.Url,
            request.Tipo,
            request.ExpedienteId,
            orgId);

        _context.Documentos.Add(documento);
        await _context.SaveChangesAsync(cancellationToken);

        return new DocumentoCreadoDto(
            documento.Id,
            documento.Titulo,
            documento.Contenido,
            documento.Url,
            documento.Tipo,
            documento.ExpedienteId,
            // OrganizationId es Guid? en la entidad; el DTO expone Guid (no-null).
            // El factory Crear exige organizationId != Guid.Empty, así que .Value es seguro.
            documento.OrganizationId!.Value,
            documento.CreatedAt);
    }
}
