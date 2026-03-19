using FluentValidation;
using MediatR;
using LegalPro.Application.Common.Interfaces;

namespace LegalPro.Application.Redactor.Commands;

public record GenerarBorradorCommand(
    string TipoEscrito,
    string DistritoJudicial,
    string HechosCausa
) : IRequest<BorradorResult>;

public record BorradorResult(string BorradorGenerado, List<string> LeyesCitadas);

public class GenerarBorradorValidator : AbstractValidator<GenerarBorradorCommand>
{
    public GenerarBorradorValidator()
    {
        RuleFor(x => x.TipoEscrito).NotEmpty().WithMessage("El tipo de escrito es requerido.");
        RuleFor(x => x.HechosCausa).NotEmpty().WithMessage("Los hechos son requeridos.");
    }
}

public class GenerarBorradorHandler : IRequestHandler<GenerarBorradorCommand, BorradorResult>
{
    private readonly IGeminiService _geminiService;

    public GenerarBorradorHandler(IGeminiService geminiService)
    {
        _geminiService = geminiService;
    }

    public async Task<BorradorResult> Handle(GenerarBorradorCommand request, CancellationToken cancellationToken)
    {
        var promptData = System.Text.Json.JsonSerializer.Serialize(new
        {
            tipoEscrito = request.TipoEscrito,
            distritoJudicial = request.DistritoJudicial,
            hechosCausa = request.HechosCausa
        });

        var resultJson = await _geminiService.DraftDocumentAsync(promptData);
        var doc = System.Text.Json.JsonDocument.Parse(resultJson);
        var root = doc.RootElement;

        var borrador = root.TryGetProperty("borrador", out var b) ? b.GetString() ?? "" : resultJson;
        var leyes = new List<string>();

        if (root.TryGetProperty("leyesCitadas", out var ls) && ls.ValueKind == System.Text.Json.JsonValueKind.Array)
        {
            foreach (var l in ls.EnumerateArray())
                leyes.Add(l.GetString() ?? "");
        }

        return new BorradorResult(borrador, leyes);
    }
}
