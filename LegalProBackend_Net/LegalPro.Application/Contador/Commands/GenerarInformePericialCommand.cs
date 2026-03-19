using FluentValidation;
using MediatR;
using System.Text.Json;
using LegalPro.Application.Common.Interfaces;

namespace LegalPro.Application.Contador.Commands;

/// <summary>
/// Genera un informe pericial contable con la estructura oficial del Poder Judicial peruano:
/// Cargo/nombramiento → Objeto → Metodología → Análisis → Conclusiones (numeradas) → Observaciones.
/// Conforme al Reglamento de Peritos Judiciales del PJ y NIC/NIIF vigentes.
/// FC forzado: respuesta siempre estructurada como JSON con conclusiones numeradas.
/// </summary>
public class GenerarInformePericialCommand : IRequest<InformePericialDto>
{
    public string TipoPericia    { get; set; } = string.Empty;
    // "laboral" | "societario" | "tributario" | "bancario" | "patrimonial" | "danos_perjuicios"
    public string HallazgosJson  { get; set; } = string.Empty;
    // JSON con los datos contables/financieros encontrados para analizar
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

public record ConclusionPericialDto(
    int    Numero,
    string Conclusion,
    string Sustento);  // Base normativa o cálculo que la sustenta

public record InformePericialDto(
    string   ObjetoPericia,
    string   Metodologia,
    string   Analisis,
    IReadOnlyList<ConclusionPericialDto> Conclusiones,
    decimal  MontoTotal,          // 0 si no aplica monto
    string   Observaciones,
    IReadOnlyList<string> AnexosSugeridos,
    DateTime GeneradoEn);

// ── Validator ────────────────────────────────────────────────────────────────

public class GenerarInformePericialValidator : AbstractValidator<GenerarInformePericialCommand>
{
    private static readonly string[] TiposPericia =
        { "laboral", "societario", "tributario", "bancario", "patrimonial", "danos_perjuicios" };

    public GenerarInformePericialValidator()
    {
        RuleFor(x => x.TipoPericia)
            .NotEmpty()
            .Must(v => TiposPericia.Contains(v.ToLower()))
            .WithMessage($"TipoPericia debe ser: {string.Join(", ", TiposPericia)}");

        RuleFor(x => x.HallazgosJson)
            .NotEmpty()
            .MinimumLength(10)
            .MaximumLength(8000)
            .WithMessage("HallazgosJson debe contener los hallazgos contables/financieros a analizar.");
    }
}

// ── Handler ──────────────────────────────────────────────────────────────────

public class GenerarInformePericialHandler
    : IRequestHandler<GenerarInformePericialCommand, InformePericialDto>
{
    private readonly ILegalContador _gemini;

    public GenerarInformePericialHandler(ILegalContador gemini) => _gemini = gemini;

    public async Task<InformePericialDto> Handle(
        GenerarInformePericialCommand request,
        CancellationToken cancellationToken)
    {
        var json = await _gemini.GenerarInformePericialAsync(
            request.TipoPericia,
            request.HallazgosJson);

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        var conclusiones = root.TryGetProperty("conclusiones", out var concArray)
            ? concArray.EnumerateArray()
                       .Select(c => new ConclusionPericialDto(
                           c.GetProperty("numero").GetInt32(),
                           c.GetProperty("conclusion").GetString() ?? string.Empty,
                           c.GetProperty("sustento").GetString()   ?? string.Empty))
                       .ToList()
            : new List<ConclusionPericialDto>();

        var anexos = root.TryGetProperty("anexosSugeridos", out var anexArray)
            ? anexArray.EnumerateArray()
                       .Select(a => a.GetString() ?? string.Empty)
                       .ToList()
            : new List<string>();

        return new InformePericialDto(
            ObjetoPericia  : root.TryGetProperty("objetoPericia", out var op)  ? op.GetString()  ?? string.Empty : string.Empty,
            Metodologia    : root.TryGetProperty("metodologia",   out var mt)  ? mt.GetString()  ?? string.Empty : string.Empty,
            Analisis       : root.TryGetProperty("analisis",      out var an)  ? an.GetString()  ?? string.Empty : string.Empty,
            Conclusiones   : conclusiones,
            MontoTotal     : root.TryGetProperty("montoTotal",    out var mo)  ? (decimal)mo.GetDouble() : 0m,
            Observaciones  : root.TryGetProperty("observaciones", out var obs) ? obs.GetString() ?? string.Empty : string.Empty,
            AnexosSugeridos: anexos,
            GeneradoEn     : DateTime.UtcNow);
    }
}
