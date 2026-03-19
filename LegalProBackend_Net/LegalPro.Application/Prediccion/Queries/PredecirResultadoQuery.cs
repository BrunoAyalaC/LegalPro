using FluentValidation;
using MediatR;
using LegalPro.Application.Common.Interfaces;

namespace LegalPro.Application.Prediccion.Queries;

public record PredecirResultadoQuery(
    string HechosCausa,
    string Materia,
    string JuzgadoSala,
    string JuezAsignado
) : IRequest<PrediccionResult>;

public record PrediccionResult(
    int ProbabilidadExito,
    string VeredictoGeneral,
    List<FactorResult> Factores
);

public record FactorResult(string Descripcion, string Tipo);

public class PredecirResultadoValidator : AbstractValidator<PredecirResultadoQuery>
{
    public PredecirResultadoValidator()
    {
        RuleFor(x => x.HechosCausa).NotEmpty().WithMessage("Los hechos del caso son requeridos.");
        RuleFor(x => x.Materia).NotEmpty().WithMessage("La materia del caso es requerida.");
    }
}

public class PredecirResultadoHandler : IRequestHandler<PredecirResultadoQuery, PrediccionResult>
{
    private readonly IGeminiService _geminiService;

    public PredecirResultadoHandler(IGeminiService geminiService)
    {
        _geminiService = geminiService;
    }

    public async Task<PrediccionResult> Handle(PredecirResultadoQuery request, CancellationToken cancellationToken)
    {
        var resultJson = await _geminiService.PredictOutcomeAsync(
            request.HechosCausa, request.Materia, request.JuzgadoSala, request.JuezAsignado);

        var doc = System.Text.Json.JsonDocument.Parse(resultJson);
        var root = doc.RootElement;

        var prob = root.TryGetProperty("probabilidadExito", out var p) ? p.GetInt32() : 50;
        var veredicto = root.TryGetProperty("veredictoGeneral", out var v) ? v.GetString() ?? "" : "";
        var factores = new List<FactorResult>();

        if (root.TryGetProperty("factores", out var fs) && fs.ValueKind == System.Text.Json.JsonValueKind.Array)
        {
            foreach (var f in fs.EnumerateArray())
            {
                factores.Add(new FactorResult(
                    f.TryGetProperty("descripcion", out var d) ? d.GetString() ?? "" : "",
                    f.TryGetProperty("tipo", out var t) ? t.GetString() ?? "Neutro" : "Neutro"
                ));
            }
        }

        return new PrediccionResult(prob, veredicto, factores);
    }
}
