using FluentValidation;
using MediatR;
using LegalPro.Application.Common.Interfaces;
using System.Text.Json;

namespace LegalPro.Application.Jurisprudencia.Queries;

// ═══════════════════════════════════════════════════════
// QUERY: Buscar jurisprudencia peruana con Google Search grounding.
// Gemini actúa como buscador legal (ILegalJurisprudenciaSearch).
// Retorna resultados rankeados con contexto generado por IA.
// ═══════════════════════════════════════════════════════

public class BuscarJurisprudenciaQuery : IRequest<BuscarJurisprudenciaResult>
{
    public string TerminoBusqueda { get; set; } = string.Empty;
    public string? Sala          { get; set; }
    public string? FechaDesde    { get; set; }
    public string? FechaHasta    { get; set; }
    public string? Materia       { get; set; }
    public bool    IncluirVinculantes { get; set; } = true;
}

public record ResultadoJurisprudenciaDto(
    string Id,
    string Titulo,
    string Resumen,
    string Sala,
    string FechaResolucion,
    string NivelRelevancia,
    string? UrlDocumento,
    string? Doctrina);

public record BuscarJurisprudenciaResult(
    string QueryOriginal,
    IReadOnlyList<ResultadoJurisprudenciaDto> Resultados,
    string ContextoGenerado,
    int TotalResultados);

public class BuscarJurisprudenciaQueryValidator : AbstractValidator<BuscarJurisprudenciaQuery>
{
    public BuscarJurisprudenciaQueryValidator()
    {
        RuleFor(x => x.TerminoBusqueda)
            .NotEmpty().WithMessage("El término de búsqueda es obligatorio.")
            .MinimumLength(3).WithMessage("El término debe tener al menos 3 caracteres.")
            .MaximumLength(500).WithMessage("El término no puede superar los 500 caracteres.");

        RuleFor(x => x.Sala)
            .MaximumLength(150).When(x => x.Sala != null);

        RuleFor(x => x.Materia)
            .MaximumLength(100).When(x => x.Materia != null);
    }
}

public class BuscarJurisprudenciaQueryHandler : IRequestHandler<BuscarJurisprudenciaQuery, BuscarJurisprudenciaResult>
{
    private readonly ILegalJurisprudenciaSearch _jurisprudenciaAI;

    public BuscarJurisprudenciaQueryHandler(ILegalJurisprudenciaSearch jurisprudenciaAI)
    {
        _jurisprudenciaAI = jurisprudenciaAI;
    }

    public async Task<BuscarJurisprudenciaResult> Handle(
        BuscarJurisprudenciaQuery request,
        CancellationToken cancellationToken)
    {
        // Construir query enriquecida con filtros opcionales
        var queryEnriquecida = BuildQuery(request);

        // Gemini llama a Google Search (deep search grounding)
        var jsonRaw = await _jurisprudenciaAI.BuscarJurisprudenciaAsync(queryEnriquecida);

        var resultados = ParseResultados(jsonRaw, request.TerminoBusqueda);
        return resultados;
    }

    // ── helpers ────────────────────────────────────────

    private static string BuildQuery(BuscarJurisprudenciaQuery r)
    {
        var parts = new List<string> { r.TerminoBusqueda };

        if (!string.IsNullOrWhiteSpace(r.Sala))
            parts.Add($"sala:{r.Sala}");
        if (!string.IsNullOrWhiteSpace(r.Materia))
            parts.Add($"materia:{r.Materia}");
        if (!string.IsNullOrWhiteSpace(r.FechaDesde))
            parts.Add($"desde:{r.FechaDesde}");
        if (!string.IsNullOrWhiteSpace(r.FechaHasta))
            parts.Add($"hasta:{r.FechaHasta}");
        if (r.IncluirVinculantes)
            parts.Add("precedente vinculante Corte Suprema Perú");

        return string.Join(" ", parts);
    }

    private static BuscarJurisprudenciaResult ParseResultados(string jsonRaw, string queryOriginal)
    {
        try
        {
            using var doc = JsonDocument.Parse(jsonRaw);
            var root = doc.RootElement;

            var contexto    = root.TryGetProperty("contextoGenerado", out var ctx)
                              ? ctx.GetString() ?? string.Empty
                              : jsonRaw;

            var listaRaw    = root.TryGetProperty("resultados", out var res) && res.ValueKind == JsonValueKind.Array
                              ? res
                              : (JsonElement?)null;

            var resultados  = new List<ResultadoJurisprudenciaDto>();

            if (listaRaw.HasValue)
            {
                foreach (var item in listaRaw.Value.EnumerateArray())
                {
                    resultados.Add(new ResultadoJurisprudenciaDto(
                        Id:               item.TryGetString("id", "SIN-ID"),
                        Titulo:           item.TryGetString("titulo", "Sin título"),
                        Resumen:          item.TryGetString("resumen", string.Empty),
                        Sala:             item.TryGetString("sala", "Corte Suprema"),
                        FechaResolucion:  item.TryGetString("fechaResolucion", string.Empty),
                        NivelRelevancia:  item.TryGetString("nivelRelevancia", "Media"),
                        UrlDocumento:     item.TryGetString("urlDocumento", null),
                        Doctrina:         item.TryGetString("doctrina", null)));
                }
            }

            return new BuscarJurisprudenciaResult(
                QueryOriginal:    queryOriginal,
                Resultados:       resultados,
                ContextoGenerado: contexto,
                TotalResultados:  resultados.Count);
        }
        catch
        {
            // Si Gemini devuelve texto plano (no JSON), lo envolvemos como contexto
            return new BuscarJurisprudenciaResult(
                QueryOriginal:    queryOriginal,
                Resultados:       [],
                ContextoGenerado: jsonRaw,
                TotalResultados:  0);
        }
    }
}

// ── Extension helpers para JsonElement (evita repetición) ──

internal static class JsonElementExtensions
{
    internal static string TryGetString(this JsonElement el, string prop, string? fallback)
    {
        if (el.TryGetProperty(prop, out var val) && val.ValueKind == JsonValueKind.String)
            return val.GetString() ?? fallback ?? string.Empty;
        return fallback ?? string.Empty;
    }
}
