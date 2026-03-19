using FluentValidation;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Entities;
using LegalPro.Domain.Enums;
using LegalPro.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace LegalPro.Application.OrganizacionesModule.Commands;

public class CrearOrganizacionCommand : IRequest<CrearOrganizacionResult>
{
    public string Nombre { get; set; } = string.Empty;
    public string? Slug { get; set; }
    public PlanTipo Plan { get; set; } = PlanTipo.Free;
}

public record CrearOrganizacionResult(
    Guid OrganizacionId,
    string Nombre,
    string Slug,
    PlanTipo Plan,
    string NuevoToken);

public class CrearOrganizacionValidator : AbstractValidator<CrearOrganizacionCommand>
{
    public CrearOrganizacionValidator()
    {
        RuleFor(x => x.Nombre)
            .NotEmpty().WithMessage("El nombre de la organización es obligatorio.")
            .MaximumLength(200).WithMessage("El nombre no puede superar 200 caracteres.");

        RuleFor(x => x.Slug)
            .MaximumLength(100).WithMessage("El slug no puede superar 100 caracteres.")
            .Matches(@"^[a-z0-9-]*$").WithMessage("El slug solo puede contener letras minúsculas, números y guiones.")
            .When(x => x.Slug != null);
    }
}

public class CrearOrganizacionCommandHandler : IRequestHandler<CrearOrganizacionCommand, CrearOrganizacionResult>
{
    private readonly IApplicationDbContext _context;
    private readonly IOrganizacionRepository _orgRepo;
    private readonly ICurrentUserService _currentUser;
    private readonly IJwtService _jwtService;

    public CrearOrganizacionCommandHandler(
        IApplicationDbContext context,
        IOrganizacionRepository orgRepo,
        ICurrentUserService currentUser,
        IJwtService jwtService)
    {
        _context = context;
        _orgRepo = orgRepo;
        _currentUser = currentUser;
        _jwtService = jwtService;
    }

    public async Task<CrearOrganizacionResult> Handle(CrearOrganizacionCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("Debe estar autenticado para crear una organización.");

        var usuario = await _context.Usuarios
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken)
            ?? throw new NotFoundException(nameof(Usuario), userId);

        if (usuario.OrganizationId.HasValue)
            throw new DomainException("Ya pertenece a una organización. Salga primero para crear una nueva.");

        var slug = !string.IsNullOrWhiteSpace(request.Slug)
            ? request.Slug.Trim().ToLowerInvariant()
            : GenerarSlug(request.Nombre);

        if (await _orgRepo.SlugExistsAsync(slug, cancellationToken))
            throw new DomainException($"El slug '{slug}' ya está en uso. Elija otro.");

        var org = Organizacion.Crear(request.Nombre, slug, request.Plan);
        await _orgRepo.AddAsync(org, cancellationToken);

        usuario.AsignarOrganizacion(org.Id, esAdmin: true);
        await _context.SaveChangesAsync(cancellationToken);

        // Recargar con navegación para que el JWT incluya org y plan
        var usuarioConOrg = await _context.Usuarios
            .Include(u => u.Organizacion)
            .FirstAsync(u => u.Id == userId, cancellationToken);

        var nuevoToken = _jwtService.GenerateToken(usuarioConOrg);
        return new CrearOrganizacionResult(org.Id, org.Nombre, org.Slug, org.Plan, nuevoToken);
    }

    private static string GenerarSlug(string nombre)
    {
        var slug = nombre.ToLowerInvariant()
            .Replace(" ", "-")
            .Replace("á", "a").Replace("é", "e").Replace("í", "i")
            .Replace("ó", "o").Replace("ú", "u").Replace("ñ", "n");

        slug = Regex.Replace(slug, @"[^a-z0-9-]", "");
        slug = Regex.Replace(slug, @"-+", "-").Trim('-');
        return $"{slug}-{Guid.NewGuid().ToString("N")[..6]}";
    }
}
