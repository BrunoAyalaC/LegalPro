using FluentValidation;
using MediatR;
using System.Text.Json;
using LegalPro.Application.Common;
using LegalPro.Application.Common.Interfaces;

namespace LegalPro.Application.Contador.Commands;

/// <summary>
/// Calcula liquidación laboral peruana: CTS, vacaciones truncas, gratificaciones
/// truncas, indemnización por despido arbitrario e intereses BCRP (Tasa Legal).
/// Lógica IA + reglas de Ley de Productividad y Competitividad Laboral (LPCL).
/// No requiere valores exactos al inicio — Gemini infiere rangos si faltan datos.
/// </summary>
public class CalcularLiquidacionLaboralCommand : IRequest<LiquidacionLaboralDto>
{
    public string DatosEmpleadoJson { get; set; } = string.Empty;
    // JSON con: fechaIngreso, fechaCese, sueldoBase, horasExtra, bonos, motivoCese
    public string MotivoCese        { get; set; } = string.Empty;
    // "despido_arbitrario" | "renuncia" | "mutuo_acuerdo" | "no_renovacion" | "despido_nulo"
}

public record ConceptoLiquidacionDto(
    string Concepto,          // "CTS", "Vacaciones truncas", etc.
    decimal MontoCalculado,
    string BaseCalculo,       // Fórmula aplicada
    string FundamentoLegal);  // "Art. 6 D.Leg. 650 - CTS"

public record LiquidacionLaboralDto(
    string Empleado,
    string MotivoCese,
    DateTime FechaIngreso,
    DateTime FechaCese,
    int AñosServicio,
    int MesesServicio,
    decimal SueldoBase,
    IReadOnlyList<ConceptoLiquidacionDto> Conceptos,
    decimal TotalBruto,
    decimal DescuentoAfp,
    decimal DescuentoONP,
    decimal TotalNeto,
    string AdvertenciasLegales,
    string RecomendacionPeritoContable,
    DateTime CalculadoEn);

public class CalcularLiquidacionLaboralValidator : AbstractValidator<CalcularLiquidacionLaboralCommand>
{
    private static readonly string[] MotivosCese =
        { "despido_arbitrario", "renuncia", "mutuo_acuerdo", "no_renovacion", "despido_nulo", "jubilacion" };

    public CalcularLiquidacionLaboralValidator()
    {
        RuleFor(x => x.DatosEmpleadoJson)
            .NotEmpty()
            .MinimumLength(10)
            .MaximumLength(5000)
            .WithMessage("DatosEmpleadoJson debe incluir al menos fechaIngreso, fechaCese y sueldoBase.");

        RuleFor(x => x.MotivoCese)
            .NotEmpty()
            .Must(v => MotivosCese.Contains(v.ToLower()))
            .WithMessage($"MotivoCese debe ser: {string.Join(", ", MotivosCese)}");
    }
}

public class CalcularLiquidacionLaboralHandler
    : IRequestHandler<CalcularLiquidacionLaboralCommand, LiquidacionLaboralDto>
{
    private readonly ILegalContador _gemini;

    public CalcularLiquidacionLaboralHandler(ILegalContador gemini) => _gemini = gemini;

    public async Task<LiquidacionLaboralDto> Handle(
        CalcularLiquidacionLaboralCommand request,
        CancellationToken cancellationToken)
    {
        var json = await _gemini.CalcularLiquidacionLaboralAsync(
            request.DatosEmpleadoJson,
            request.MotivoCese);

        using var doc = JsonDocument.Parse(json);
        var r = doc.RootElement;

        var conceptos = r.TryGetProperty("conceptos", out var arr)
            ? arr.EnumerateArray().Select(c => new ConceptoLiquidacionDto(
                Concepto:        c.GetStringOrDefault("concepto"),
                MontoCalculado:  c.TryGetProperty("monto", out var m) ? m.GetDecimal() : 0m,
                BaseCalculo:     c.GetStringOrDefault("baseCalculo"),
                FundamentoLegal: c.GetStringOrDefault("fundamentoLegal")))
              .ToList()
            : new List<ConceptoLiquidacionDto>();

        static DateTime ParseDate(JsonElement el, string prop) =>
            el.TryGetProperty(prop, out var v) && DateTime.TryParse(v.GetString(), out var d) ? d : DateTime.MinValue;

        static decimal GetDecimalProp(JsonElement el, string prop) =>
            el.TryGetProperty(prop, out var v) ? v.GetDecimal() : 0m;

        return new LiquidacionLaboralDto(
            Empleado:                    r.GetStringOrDefault("empleado", "No especificado"),
            MotivoCese:                  request.MotivoCese,
            FechaIngreso:                ParseDate(r, "fechaIngreso"),
            FechaCese:                   ParseDate(r, "fechaCese"),
            AñosServicio:                r.GetIntOrDefault("aniosServicio"),
            MesesServicio:               r.GetIntOrDefault("mesesServicio"),
            SueldoBase:                  GetDecimalProp(r, "sueldoBase"),
            Conceptos:                   conceptos,
            TotalBruto:                  GetDecimalProp(r, "totalBruto"),
            DescuentoAfp:                GetDecimalProp(r, "descuentoAfp"),
            DescuentoONP:                GetDecimalProp(r, "descuentoOnp"),
            TotalNeto:                   GetDecimalProp(r, "totalNeto"),
            AdvertenciasLegales:         r.GetStringOrDefault("advertenciasLegales"),
            RecomendacionPeritoContable: r.GetStringOrDefault("recomendacionPeritoContable"),
            CalculadoEn:                 DateTime.UtcNow);
    }
}
