using FluentValidation;
using MediatR;
using System.Text.Json;
using LegalPro.Application.Common;
using LegalPro.Application.Common.Interfaces;

namespace LegalPro.Application.Juez.Queries;

/// <summary>
/// Compara el caso actual con precedentes vinculantes del TC, Casaciones de la Corte Suprema
/// y Acuerdos Plenarios relevantes — esencial para motivación judicial (art. 139.5 Const.).
/// FC forzado: Gemini actúa como estudioso del derecho, no como parte.
/// </summary>
public class CompararPrecedentesQuery : IRequest<PrecedentesDto>
{
    public string CasoActual              { get; set; } = string.Empty;
    public string RamaDerecho             { get; set; } = "civil";
    public string TipoResolucionBuscada   { get; set; } = "sentencia";
    public string Rol                     { get; set; } = "JUEZ";
}

public record PrecedenteDto(
    string Referencia,        // "Cas. 1234-2023-Lima", "Exp. 00012-2019-TC"
    string Resumen,
    string AplicabilidadAlCaso,
    string Vinculatoriedad,   // "vinculante" | "orientador" | "referencial"
    string Fuente);           // "TC" | "Corte Suprema" | "Pleno Casatorio" | "Acuerdo Plenario"

public record PrecedentesDto(
    string CasoActual,
    string RamaDerecho,
    IReadOnlyList<PrecedenteDto> PrecedentesAplicables,
    IReadOnlyList<PrecedenteDto> PrecedentesContrarios,
    string SintesisComparativa,
    string RecomendacionMotivacion,
    string Advertencias,
    DateTime GeneradoEn);

public class CompararPrecedentesQueryValidator : AbstractValidator<CompararPrecedentesQuery>
{
    private static readonly string[] RamasValidas =
        { "penal", "civil", "laboral", "familia", "constitucional", "administrativo" };
    private static readonly string[] TiposValidos =
        { "sentencia", "auto_cautelar", "sentencia_absolutoria", "sentencia_condenatoria", "auto_de_vista", "resolucion_casacion" };

    public CompararPrecedentesQueryValidator()
    {
        RuleFor(x => x.CasoActual)
            .NotEmpty()
            .MinimumLength(50)
            .MaximumLength(10000)
            .WithMessage("Describe el caso con al menos 50 caracteres para una comparación útil.");

        RuleFor(x => x.RamaDerecho)
            .NotEmpty()
            .Must(v => RamasValidas.Contains(v.ToLower()))
            .WithMessage($"RamaDerecho debe ser: {string.Join(", ", RamasValidas)}");

        RuleFor(x => x.TipoResolucionBuscada)
            .NotEmpty()
            .Must(v => TiposValidos.Contains(v.ToLower()))
            .WithMessage($"TipoResolucionBuscada debe ser: {string.Join(", ", TiposValidos)}");
    }
}

public class CompararPrecedentesQueryHandler : IRequestHandler<CompararPrecedentesQuery, PrecedentesDto>
{
    private readonly ILegalJuez _gemini;

    public CompararPrecedentesQueryHandler(ILegalJuez gemini) => _gemini = gemini;

    public async Task<PrecedentesDto> Handle(CompararPrecedentesQuery request, CancellationToken cancellationToken)
    {
        var json = await _gemini.CompararPrecedentesAsync(
            request.CasoActual,
            request.RamaDerecho,
            request.TipoResolucionBuscada,
            request.Rol);

        using var doc = JsonDocument.Parse(json);
        var r = doc.RootElement;

        static PrecedenteDto ParsePrecedente(JsonElement el) => new(
            Referencia:           el.GetStringOrDefault("referencia"),
            Resumen:              el.GetStringOrDefault("resumen"),
            AplicabilidadAlCaso:  el.GetStringOrDefault("aplicabilidadAlCaso"),
            Vinculatoriedad:      el.GetStringOrDefault("vinculatoriedad", "referencial"),
            Fuente:               el.GetStringOrDefault("fuente"));

        var aplicables = new List<PrecedenteDto>();
        if (r.TryGetProperty("precedentesAplicables", out var arrA) && arrA.ValueKind == JsonValueKind.Array)
            foreach (var el in arrA.EnumerateArray())
                aplicables.Add(ParsePrecedente(el));

        var contrarios = new List<PrecedenteDto>();
        if (r.TryGetProperty("precedentesContrarios", out var arrC) && arrC.ValueKind == JsonValueKind.Array)
            foreach (var el in arrC.EnumerateArray())
                contrarios.Add(ParsePrecedente(el));

        return new PrecedentesDto(
            CasoActual:              request.CasoActual,
            RamaDerecho:             request.RamaDerecho,
            PrecedentesAplicables:   aplicables,
            PrecedentesContrarios:   contrarios,
            SintesisComparativa:     r.GetStringOrDefault("sintesisComparativa"),
            RecomendacionMotivacion: r.GetStringOrDefault("recomendacionMotivacion"),
            Advertencias:            r.GetStringOrDefault("advertencias"),
            GeneradoEn:              DateTime.UtcNow);
    }
}
