using FluentValidation;
using MediatR;
using LegalPro.Application.Common.Behaviours;
using LegalPro.Application.Common.Interfaces;

namespace LegalPro.Application.Analisis.Commands;

// ═══════════════════════════════════════════════════════
// COMMAND: Analizar Expediente
// ═══════════════════════════════════════════════════════
public record AnalizarExpedienteCommand(string TextoExpediente) : IRequest<AnalizarExpedienteResult>, ITenantRequest
{
    public Guid OrganizationId => Guid.Empty;
}

public record AnalizarExpedienteResult(string ResumenGeneral, List<AnotacionResult> Anotaciones);
public record AnotacionResult(string Titulo, string Descripcion, string Gravedad, string? FolioReferencia);

public class AnalizarExpedienteValidator : AbstractValidator<AnalizarExpedienteCommand>
{
    public AnalizarExpedienteValidator()
    {
        RuleFor(x => x.TextoExpediente)
            .NotEmpty().WithMessage("El texto del expediente es requerido.")
            .MinimumLength(20).WithMessage("El texto del expediente debe tener al menos 20 caracteres.");
    }
}

public class AnalizarExpedienteHandler : IRequestHandler<AnalizarExpedienteCommand, AnalizarExpedienteResult>
{
    private readonly IMinimaxService _minimaxService;

    public AnalizarExpedienteHandler(IMinimaxService minimaxService)
    {
        _minimaxService = minimaxService;
    }

    public async Task<AnalizarExpedienteResult> Handle(AnalizarExpedienteCommand request, CancellationToken cancellationToken)
    {
        var resultJson = await _minimaxService.AnalyzeLegalDocumentAsync(request.TextoExpediente);
        // Parse JSON response from MiniMax into typed result
        var doc = System.Text.Json.JsonDocument.Parse(resultJson);
        var root = doc.RootElement;

        var resumen = root.TryGetProperty("resumenGeneral", out var r) ? r.GetString() ?? "" : "";
        var anotaciones = new List<AnotacionResult>();

        if (root.TryGetProperty("anotaciones", out var anots) && anots.ValueKind == System.Text.Json.JsonValueKind.Array)
        {
            foreach (var a in anots.EnumerateArray())
            {
                anotaciones.Add(new AnotacionResult(
                    a.TryGetProperty("titulo", out var t) ? t.GetString() ?? "" : "",
                    a.TryGetProperty("descripcion", out var d) ? d.GetString() ?? "" : "",
                    a.TryGetProperty("gravedad", out var g) ? g.GetString() ?? "Baja" : "Baja",
                    a.TryGetProperty("folioReferencia", out var f) ? f.GetString() : null
                ));
            }
        }

        return new AnalizarExpedienteResult(resumen, anotaciones);
    }
}
