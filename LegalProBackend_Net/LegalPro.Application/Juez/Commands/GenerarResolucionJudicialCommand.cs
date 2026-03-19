using FluentValidation;
using MediatR;
using System.Text.Json;
using LegalPro.Application.Common;
using LegalPro.Application.Common.Interfaces;

namespace LegalPro.Application.Juez.Commands;

/// <summary>
/// Genera resoluciones judiciales con motivación formal según art. 139.5 Constitución.
/// Tipos: auto_admisorio | sentencia | auto_cautelar | resolucion_incidente | sentencia_absolutoria | sentencia_condenatoria.
/// Estructura: SUMILLA → VISTOS → CONSIDERANDO (numerado) → FALLO / SE RESUELVE.
/// FC garantizado: Gemini actúa como magistrado, no como abogado.
/// </summary>
public class GenerarResolucionJudicialCommand : IRequest<ResolucionJudicialDto>
{
    public string TipoResolucion      { get; set; } = string.Empty;
    public string Hechos              { get; set; } = string.Empty;
    public string Pretensiones        { get; set; } = string.Empty;
    public string MediosProbatorios   { get; set; } = string.Empty;
    public string RamaDerecho         { get; set; } = "civil";
}

public record ConsiderandoDto(int Numero, string Contenido, string FundamentoLegal);

public record ResolucionJudicialDto(
    string Sumilla,
    string Vistos,
    IReadOnlyList<ConsiderandoDto> Considerandos,
    string Fallo,
    IReadOnlyList<string> PrecedentesCitados,
    string Costas,
    string Advertencias,
    DateTime GeneradoEn);

public class GenerarResolucionJudicialValidator : AbstractValidator<GenerarResolucionJudicialCommand>
{
    private static readonly string[] TiposValidos =
    {
        "auto_admisorio", "sentencia", "auto_cautelar", "resolucion_incidente",
        "sentencia_absolutoria", "sentencia_condenatoria", "auto_de_vista", "resolucion_casacion"
    };
    private static readonly string[] RamasValidas =
        { "penal", "civil", "laboral", "familia", "constitucional", "administrativo" };

    public GenerarResolucionJudicialValidator()
    {
        RuleFor(x => x.TipoResolucion)
            .NotEmpty()
            .Must(v => TiposValidos.Contains(v.ToLower()))
            .WithMessage($"TipoResolucion debe ser: {string.Join(", ", TiposValidos)}");

        RuleFor(x => x.Hechos)
            .NotEmpty()
            .MinimumLength(50)
            .MaximumLength(15000);

        RuleFor(x => x.Pretensiones)
            .NotEmpty()
            .MaximumLength(5000);

        RuleFor(x => x.RamaDerecho)
            .NotEmpty()
            .Must(v => RamasValidas.Contains(v.ToLower()))
            .WithMessage($"RamaDerecho debe ser: {string.Join(", ", RamasValidas)}");
    }
}

public class GenerarResolucionJudicialHandler : IRequestHandler<GenerarResolucionJudicialCommand, ResolucionJudicialDto>
{
    private readonly ILegalJuez _gemini;

    public GenerarResolucionJudicialHandler(ILegalJuez gemini) => _gemini = gemini;

    public async Task<ResolucionJudicialDto> Handle(
        GenerarResolucionJudicialCommand request,
        CancellationToken cancellationToken)
    {
        var json = await _gemini.GenerarResolucionJudicialAsync(
            request.TipoResolucion,
            request.Hechos,
            request.Pretensiones,
            request.MediosProbatorios,
            request.RamaDerecho);

        using var doc = JsonDocument.Parse(json);
        var r = doc.RootElement;

        // Parsear array de considerandos
        var considerandos = new List<ConsiderandoDto>();
        if (r.TryGetProperty("considerandos", out var arr) && arr.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in arr.EnumerateArray())
            {
                considerandos.Add(new ConsiderandoDto(
                    Numero:         item.GetIntOrDefault("numero"),
                    Contenido:      item.GetStringOrDefault("contenido"),
                    FundamentoLegal: item.GetStringOrDefault("fundamentoLegal")));
            }
        }

        return new ResolucionJudicialDto(
            Sumilla:           r.GetStringOrDefault("sumilla"),
            Vistos:            r.GetStringOrDefault("vistos"),
            Considerandos:     considerandos,
            Fallo:             r.GetStringOrDefault("fallo"),
            PrecedentesCitados: r.GetStringArrayOrDefault("precedentesCitados"),
            Costas:            r.GetStringOrDefault("costas"),
            Advertencias:      r.GetStringOrDefault("advertencias"),
            GeneradoEn:        DateTime.UtcNow);
    }
}
