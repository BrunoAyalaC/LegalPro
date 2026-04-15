using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using LegalPro.Application.Common.Behaviours;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Entities;
using LegalPro.Domain.Enums;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Application.Expedientes.Commands;

// ═══════════════════════════════════════════════════════
// COMMAND: Crear Expediente
// Implementa IPlanLimitedRequest → PlanLimitsBehavior verifica
// el cupo del plan ANTES de ejecutar el handler (OCP, SRP).
// ═══════════════════════════════════════════════════════

public class CrearExpedienteCommand : IRequest<CrearExpedienteResult>, IPlanLimitedRequest
{
    public string Numero { get; set; } = string.Empty;
    public string Titulo { get; set; } = string.Empty;
    public TipoRamaProcesal Tipo { get; set; }
    public bool EsUrgente { get; set; } = false;

    // IPlanLimitedRequest: activa PlanLimitsBehavior antes de ejecutar el handler
    public string RecursoTipo => "expediente";
}

public record CrearExpedienteResult(
    Guid Id,
    string Numero,
    string Titulo,
    string Tipo,
    string Estado,
    bool EsUrgente,
    Guid OrganizationId,
    DateTime CreatedAt);

public class CrearExpedienteCommandValidator : AbstractValidator<CrearExpedienteCommand>
{
    public CrearExpedienteCommandValidator()
    {
        RuleFor(x => x.Numero)
            .NotEmpty().WithMessage("El número de expediente es obligatorio.")
            .MaximumLength(20).WithMessage("El número no puede superar 20 caracteres.");

        RuleFor(x => x.Titulo)
            .NotEmpty().WithMessage("El título del expediente es obligatorio.")
            .MaximumLength(500).WithMessage("El título no puede superar 500 caracteres.");

        RuleFor(x => x.Tipo)
            .IsInEnum().WithMessage("El tipo de rama procesal es inválido.");
    }
}

public class CrearExpedienteCommandHandler : IRequestHandler<CrearExpedienteCommand, CrearExpedienteResult>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public CrearExpedienteCommandHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<CrearExpedienteResult> Handle(CrearExpedienteCommand request, CancellationToken cancellationToken)
    {
        var orgId = _currentUser.OrganizationId
            ?? throw new ForbiddenAccessException("No pertenece a ninguna organización.");

        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("Debe estar autenticado.");

        // Número único dentro del tenant
        var duplicado = await _context.Expedientes
            .AnyAsync(e => e.OrganizationId == orgId && e.Numero == request.Numero.Trim(), cancellationToken);

        if (duplicado)
            throw new DomainException($"Ya existe un expediente con el número '{request.Numero}' en su organización.");

        var expediente = Expediente.Crear(
            request.Numero,
            request.Titulo,
            request.Tipo,
            userId,
            orgId,
            request.EsUrgente);

        _context.Expedientes.Add(expediente);
        await _context.SaveChangesAsync(cancellationToken);

        return new CrearExpedienteResult(
            expediente.Id,
            expediente.Numero,
            expediente.Titulo,
            expediente.Tipo.ToString(),
            expediente.Estado.ToString(),
            expediente.EsUrgente,
            expediente.OrganizationId,
            expediente.CreatedAt);
    }
}
