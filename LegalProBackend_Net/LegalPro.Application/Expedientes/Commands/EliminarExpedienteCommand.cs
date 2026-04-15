using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Enums;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Application.Expedientes.Commands;

// ═══════════════════════════════════════════════════════
// COMMAND: Eliminar Expediente (soft-delete)
// Archiva el expediente en lugar de eliminarlo físicamente.
// Preserva histórico forense → regla de negocio legal.
// Tenant isolation: filtra por Id + OrganizationId (OWASP A01).
// ═══════════════════════════════════════════════════════

public record EliminarExpedienteCommand(Guid Id) : IRequest;

public class EliminarExpedienteCommandValidator : AbstractValidator<EliminarExpedienteCommand>
{
    public EliminarExpedienteCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("El Id del expediente debe ser mayor a 0.");
    }
}

public class EliminarExpedienteCommandHandler : IRequestHandler<EliminarExpedienteCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public EliminarExpedienteCommandHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task Handle(EliminarExpedienteCommand request, CancellationToken cancellationToken)
    {
        var orgId = _currentUser.OrganizationId
            ?? throw new ForbiddenAccessException("No pertenece a ninguna organización.");

        // Tenant isolation: filtra por Id Y OrganizationId (OWASP A01)
        var expediente = await _context.Expedientes
            .FirstOrDefaultAsync(e => e.Id == request.Id && e.OrganizationId == orgId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Entities.Expediente), request.Id);

        // Soft-delete: archivar en lugar de eliminar físicamente.
        // Preserva el histórico forense requerido en procedimientos legales peruanos.
        expediente.CambiarEstado(EstadoExpediente.Archivado);

        await _context.SaveChangesAsync(cancellationToken);
    }
}

