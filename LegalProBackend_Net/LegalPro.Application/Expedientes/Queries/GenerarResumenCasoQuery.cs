using FluentValidation;
using MediatR;
using System.Text.Json;
using LegalPro.Application.Common;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace LegalPro.Application.Expedientes.Queries;

/// <summary>
/// Genera un resumen ejecutivo del caso con IA usando todos los datos del expediente.
/// El abogado obtiene en segundos: hechos clave, fortalezas, debilidades, próximos pasos.
/// Tenant-isolated: solo accede a expedientes de la organización del usuario autenticado.
/// </summary>
public record GenerarResumenCasoQuery(int ExpedienteId) : IRequest<ResumenCasoDto>;

public record ResumenCasoDto(
    int ExpedienteId,
    string Numero,
    string Titulo,
    string ResumenEjecutivo,
    string FortalezasJuridicas,
    string DebilidadesRiesgos,
    string ProximosPasos,
    IReadOnlyList<string> LeyesRelevantes,
    string ProbabilidadExito,       // "alta" | "media" | "baja"
    string RecomendasionEstrategica,
    DateTime GeneradoEn);

public class GenerarResumenCasoQueryValidator : AbstractValidator<GenerarResumenCasoQuery>
{
    public GenerarResumenCasoQueryValidator()
    {
        RuleFor(x => x.ExpedienteId).GreaterThan(0);
    }
}

public class GenerarResumenCasoQueryHandler : IRequestHandler<GenerarResumenCasoQuery, ResumenCasoDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;
    private readonly ILegalResumenCaso _gemini;

    public GenerarResumenCasoQueryHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUser,
        ILegalResumenCaso gemini)
    {
        _context = context;
        _currentUser = currentUser;
        _gemini = gemini;
    }

    public async Task<ResumenCasoDto> Handle(
        GenerarResumenCasoQuery request,
        CancellationToken cancellationToken)
    {
        var orgId = _currentUser.OrganizationId
            ?? throw new ForbiddenAccessException("No pertenece a ninguna organización.");

        // Tenant isolation: solo expedientes de la organización del usuario (OWASP A01)
        var expediente = await _context.Expedientes
            .AsNoTracking()
            .FirstOrDefaultAsync(
                e => e.Id == request.ExpedienteId && e.OrganizationId == orgId,
                cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Entities.Expediente), request.ExpedienteId);

        // Serializar expediente para contexto de Gemini (sin datos sensibles extra)
        var expedienteJson = System.Text.Json.JsonSerializer.Serialize(new
        {
            numero     = expediente.Numero,
            titulo     = expediente.Titulo,
            tipo       = expediente.Tipo.ToString(),
            estado     = expediente.Estado.ToString(),
            esUrgente  = expediente.EsUrgente,
            createdAt  = expediente.CreatedAt
        });

        var json = await _gemini.GenerarResumenCasoAsync(expedienteJson, documentosTexto: "");

        using var doc = JsonDocument.Parse(json);
        var r = doc.RootElement;

        var leyes = r.TryGetProperty("leyesRelevantes", out var lProp)
            ? lProp.EnumerateArray().Select(l => l.GetString() ?? "").ToList()
            : new List<string>();

        return new ResumenCasoDto(
            ExpedienteId: request.ExpedienteId,
            Numero:       expediente.Numero,
            Titulo:       expediente.Titulo,
            ResumenEjecutivo:          r.GetStringOrDefault("resumenEjecutivo", ""),
            FortalezasJuridicas:       r.GetStringOrDefault("fortalezasJuridicas", ""),
            DebilidadesRiesgos:        r.GetStringOrDefault("debilidadesRiesgos", ""),
            ProximosPasos:             r.GetStringOrDefault("proximosPasos", ""),
            LeyesRelevantes:           leyes,
            ProbabilidadExito:         r.GetStringOrDefault("probabilidadExito", "media"),
            RecomendasionEstrategica:  r.GetStringOrDefault("recomendacionEstrategica", ""),
            GeneradoEn:                DateTime.UtcNow);
    }
}
