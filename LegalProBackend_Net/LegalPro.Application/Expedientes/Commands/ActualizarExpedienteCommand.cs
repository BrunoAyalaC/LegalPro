using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Enums;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Application.Expedientes.Commands;

// ═══════════════════════════════════════════════════════
// COMMAND: Actualizar Expediente
// Soporta actualización parcial: titulo, estado, esUrgente.
// Solo el propietario/miembro del tenant puede actualizar.
// Tenant isolation: filtra por Id + OrganizationId (OWASP A01).
// ═══════════════════════════════════════════════════════

public class ActualizarExpedienteCommand : IRequest<ActualizarExpedienteResult>
{
    public int Id { get; set; }
    public string? Titulo { get; set; }
    public string? Estado { get; set; }
    public bool? EsUrgente { get; set; }
}

public record ActualizarExpedienteResult(
    int Id,
    string Numero,
    string Titulo,
    string Tipo,
    string Estado,
    bool EsUrgente,
    Guid OrganizationId,
    DateTime? UpdatedAt);

public class ActualizarExpedienteCommandValidator : AbstractValidator<ActualizarExpedienteCommand>
{
    public ActualizarExpedienteCommandValidator()
    {
        RuleFor(x => x.Id)
            .GreaterThan(0).WithMessage("El Id del expediente debe ser mayor a 0.");

        RuleFor(x => x.Titulo)
            .MaximumLength(500).WithMessage("El título no puede superar 500 caracteres.")
            .When(x => x.Titulo != null);

        RuleFor(x => x.Estado)
            .Must(e => Enum.TryParse<EstadoExpediente>(e, out _))
            .WithMessage("Estado inválido.")
            .When(x => x.Estado != null);

        // Al menos un campo modificable debe estar presente
        RuleFor(x => x)
            .Must(x => x.Titulo != null || x.Estado != null || x.EsUrgente.HasValue)
            .WithMessage("Debe especificar al menos un campo a actualizar (titulo, estado, esUrgente).");
    }
}

public class ActualizarExpedienteCommandHandler : IRequestHandler<ActualizarExpedienteCommand, ActualizarExpedienteResult>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public ActualizarExpedienteCommandHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<ActualizarExpedienteResult> Handle(ActualizarExpedienteCommand request, CancellationToken cancellationToken)
    {
        var orgId = _currentUser.OrganizationId
            ?? throw new ForbiddenAccessException("No pertenece a ninguna organización.");

        // Tenant isolation: filtra por Id Y OrganizationId simultáneamente (OWASP A01)
        var expediente = await _context.Expedientes
            .FirstOrDefaultAsync(e => e.Id == request.Id && e.OrganizationId == orgId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Entities.Expediente), request.Id);

        // Aplicar cambios mediante métodos de dominio (no setters directos)
        if (request.Titulo is not null)
            expediente.CambiarTitulo(request.Titulo);

        if (request.Estado is not null)
        {
            var nuevoEstado = Enum.Parse<EstadoExpediente>(request.Estado);
            expediente.CambiarEstado(nuevoEstado);
        }

        if (request.EsUrgente.HasValue)
        {
            if (request.EsUrgente.Value)
                expediente.MarcarUrgente();
            else
                expediente.QuitarUrgencia();
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new ActualizarExpedienteResult(
            expediente.Id,
            expediente.Numero,
            expediente.Titulo,
            expediente.Tipo.ToString(),
            expediente.Estado.ToString(),
            expediente.EsUrgente,
            expediente.OrganizationId,
            expediente.UpdatedAt);
    }
}
