using FluentValidation;
using MediatR;
using System.Text.Json;
using LegalPro.Application.Common;
using LegalPro.Application.Common.Interfaces;

namespace LegalPro.Application.Objeciones.Commands;

/// <summary>
/// Asistente de objeciones en tiempo real.
/// Dado un fragmento de la contraparte, sugiere la objeción apropiada con fundamento legal.
/// Aplica NCPP art. 169-170 (objeciones en juicio oral), CPC art. 174 (debate probatorio).
/// </summary>
public record SugerirObjecionCommand(
    string FragmentoAdversarial,  // texto dicho por la contraparte o pregunta formulada
    string RamaDerecho,           // "penal" | "civil" | "laboral" | etc.
    string EtapaJuicio,           // "examen_testigo" | "alegato" | "interrogatorio" | "debate_prueba"
    string Rol = "ABOGADO"        // "ABOGADO" | "FISCAL" (cambia perspectiva de la objecion)
) : IRequest<ObjecionDto>;

public record ObjecionDto(
    string TipoObjecion,
    string FundamentoLegal,
    string FormulaVerbal,
    string ExplicacionJuez,
    IReadOnlyList<string> ArticulosAplicables,
    bool EsUrgente,           // true si debe hacerse en el momento exacto
    string AlternativaStrategica);

public class SugerirObjecionValidator : AbstractValidator<SugerirObjecionCommand>
{
    private static readonly string[] RamasValidas =
        { "penal", "civil", "laboral", "familia", "administrativo", "constitucional" };
    private static readonly string[] EtapasValidas =
        { "examen_testigo", "alegato", "interrogatorio", "debate_prueba", "lectura_cargos", "pericia" };

    public SugerirObjecionValidator()
    {
        RuleFor(x => x.FragmentoAdversarial)
            .NotEmpty()
            .MinimumLength(10)
            .MaximumLength(2000)
            .WithMessage("El fragmento adversarial debe tener entre 10 y 2000 caracteres.");

        RuleFor(x => x.RamaDerecho)
            .NotEmpty()
            .Must(v => RamasValidas.Contains(v.ToLower()))
            .WithMessage($"RamaDerecho debe ser: {string.Join(", ", RamasValidas)}");

        RuleFor(x => x.EtapaJuicio)
            .NotEmpty()
            .Must(v => EtapasValidas.Contains(v.ToLower()))
            .WithMessage($"EtapaJuicio debe ser: {string.Join(", ", EtapasValidas)}");
    }
}

public class SugerirObjecionHandler : IRequestHandler<SugerirObjecionCommand, ObjecionDto>
{
    private readonly ILegalObjeciones _gemini;

    public SugerirObjecionHandler(ILegalObjeciones gemini)
    {
        _gemini = gemini;
    }

    public async Task<ObjecionDto> Handle(
        SugerirObjecionCommand request,
        CancellationToken cancellationToken)
    {
        var json = await _gemini.SugerirObjecionAsync(
            request.FragmentoAdversarial,
            request.RamaDerecho,
            request.EtapaJuicio,
            request.Rol);

        using var doc = JsonDocument.Parse(json);
        var r = doc.RootElement;

        var articulos = r.TryGetProperty("articulosAplicables", out var aProp)
            ? aProp.EnumerateArray().Select(a => a.GetString() ?? "").ToList()
            : new List<string>();

        return new ObjecionDto(
            TipoObjecion: r.GetStringOrDefault("tipoObjecion", ""),
            FundamentoLegal: r.GetStringOrDefault("fundamentoLegal", ""),
            FormulaVerbal: r.GetStringOrDefault("formulaVerbal", ""),
            ExplicacionJuez: r.GetStringOrDefault("explicacionJuez", ""),
            ArticulosAplicables: articulos,
            EsUrgente: r.TryGetProperty("esUrgente", out var esProp) && esProp.GetBoolean(),
            AlternativaStrategica: r.GetStringOrDefault("alternativaEstrategica", ""));
    }
}
