using FluentValidation;
using MediatR;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Entities;
using LegalPro.Domain.Enums;
using System.Text.Json;

namespace LegalPro.Application.Simulacion.Commands;

// ═══════════════════════════════════════════════════════
// COMMAND: Iniciar Simulación de Juicio
// Crea la entidad Simulacion, invoca Gemini (FC) para
// generar el contexto sintético del caso + apertura judicial.
// Tenant isolation: OrganizationId obligatorio.
// ═══════════════════════════════════════════════════════

public class IniciarSimulacionCommand : IRequest<IniciarSimulacionResult>
{
    public TipoRamaProcesal Rama { get; set; }
    public string RolUsuario { get; set; } = string.Empty;
    public string Dificultad { get; set; } = "Media";
    public string DescripcionCaso { get; set; } = string.Empty;
}

public record IniciarSimulacionResult(
    Guid SimulacionId,
    string ContextoSintetico,
    string MensajeJuez,
    string MensajeAdversarial,
    string RolAdversarial,
    int PuntajeInicial,
    DateTime CreadoEn);

public class IniciarSimulacionCommandValidator : AbstractValidator<IniciarSimulacionCommand>
{
    public IniciarSimulacionCommandValidator()
    {
        RuleFor(x => x.Rama)
            .IsInEnum().WithMessage("La rama procesal es inválida.");

        RuleFor(x => x.RolUsuario)
            .NotEmpty().WithMessage("El rol del usuario es obligatorio.")
            .MaximumLength(50);

        RuleFor(x => x.DescripcionCaso)
            .NotEmpty().WithMessage("La descripción del caso es obligatoria.")
            .MaximumLength(2000);

        RuleFor(x => x.Dificultad)
            .Must(d => d is "Baja" or "Media" or "Alta" or "Extrema")
            .WithMessage("Dificultad debe ser: Baja, Media, Alta o Extrema.");
    }
}

public class IniciarSimulacionCommandHandler : IRequestHandler<IniciarSimulacionCommand, IniciarSimulacionResult>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;
    private readonly ILegalSimulacion _simulacionAI;

    public IniciarSimulacionCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUser,
        ILegalSimulacion simulacionAI)
    {
        _context    = context;
        _currentUser = currentUser;
        _simulacionAI = simulacionAI;
    }

    public async Task<IniciarSimulacionResult> Handle(
        IniciarSimulacionCommand request,
        CancellationToken cancellationToken)
    {
        // Llamar a Gemini FC: genera contexto + apertura judicial
        var jsonRaw = await _simulacionAI.IniciarSimulacionAsync(
            rama:            request.Rama.ToString(),
            rolUsuario:      request.RolUsuario,
            dificultad:      request.Dificultad,
            descripcionCaso: request.DescripcionCaso);

        string contexto          = string.Empty;
        string mensajeJuez       = string.Empty;
        string mensajeAdversarial = string.Empty;
        string rolAdversarial    = string.Empty;

        try
        {
            using var doc = JsonDocument.Parse(jsonRaw);
            var root = doc.RootElement;
            contexto           = root.GetPropertyOrDefault("contextoSintetico", "Caso generado por IA.");
            mensajeJuez        = root.GetPropertyOrDefault("mensajeJuez", "Se declara iniciada la audiencia.");
            mensajeAdversarial = root.GetPropertyOrDefault("mensajeAdversarial", "Listo para comenzar.");
            rolAdversarial     = root.GetPropertyOrDefault("rolAdversarial", "Parte contraria");
        }
        catch
        {
            contexto           = jsonRaw;
            mensajeJuez        = "Audiencia iniciada.";
            mensajeAdversarial = string.Empty;
            rolAdversarial     = "Parte contraria";
        }

        // Crear entidad Simulacion (DDD Aggregate)
        var simulacion = Domain.Entities.Simulacion.Crear(
            usuarioId:  _currentUser.UserId!.Value,
            rama:       request.Rama,
            rolUsuario: request.RolUsuario,
            dificultad: request.Dificultad,
            contextoIA: contexto);

        simulacion.SetOrganizationId(_currentUser.OrganizationId);

        // Persistir el primer evento — mensaje del Juez
        _context.Simulaciones.Add(simulacion);
        await _context.SaveChangesAsync(cancellationToken);

        // Agregar evento inicial del Juez
        var eventoJuez = simulacion.AgregarEvento("JUEZ", mensajeJuez);
        _context.EventosSimulacion.Add(eventoJuez);

        if (!string.IsNullOrWhiteSpace(mensajeAdversarial))
        {
            var eventoAdversarial = simulacion.AgregarEvento(rolAdversarial, mensajeAdversarial);
            _context.EventosSimulacion.Add(eventoAdversarial);
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new IniciarSimulacionResult(
            SimulacionId:       simulacion.Id,
            ContextoSintetico:  contexto,
            MensajeJuez:        mensajeJuez,
            MensajeAdversarial: mensajeAdversarial,
            RolAdversarial:     rolAdversarial,
            PuntajeInicial:     simulacion.PuntajeActual,
            CreadoEn:           simulacion.CreatedAt);
    }
}

// Extensión de utilidad para JSON seguro
internal static class JsonElementExtensions
{
    internal static string GetPropertyOrDefault(this JsonElement element, string name, string fallback)
    {
        if (element.TryGetProperty(name, out var prop) && prop.ValueKind == JsonValueKind.String)
            return prop.GetString() ?? fallback;
        return fallback;
    }
}
