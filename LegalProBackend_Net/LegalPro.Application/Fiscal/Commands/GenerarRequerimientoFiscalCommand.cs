using FluentValidation;
using MediatR;
using System.Text.Json;
using LegalPro.Application.Common;
using LegalPro.Application.Common.Interfaces;

namespace LegalPro.Application.Fiscal.Commands;

/// <summary>
/// Genera requerimientos fiscales peruanos con FC forzado.
/// Tipos: acusacion | sobreseimiento | formalizacion | prision_preventiva | incautacion.
/// Estructura NCPP: Sumilla → Señor Juez → Hechos → Calificación Jurídica → Petitorio.
/// </summary>
public class GenerarRequerimientoFiscalCommand : IRequest<RequerimientoFiscalDto>
{
    public string TipoRequerimiento { get; set; } = string.Empty;
    public string Hechos            { get; set; } = string.Empty;
    public string Imputado          { get; set; } = string.Empty;
    public string Delito            { get; set; } = string.Empty;
    public string RamaDerecho       { get; set; } = "penal";
}

public record RequerimientoFiscalDto(
    string Sumilla,
    string Hechos,
    string CalificacionJuridica,
    string FundamentosFacticos,
    string FundamentosJuridicos,
    string Petitorio,
    IReadOnlyList<string> MedidasSolicitadas,
    string Advertencias,
    DateTime GeneradoEn);

public class GenerarRequerimientoFiscalValidator : AbstractValidator<GenerarRequerimientoFiscalCommand>
{
    private static readonly string[] TiposValidos =
        { "acusacion", "sobreseimiento", "formalizacion", "prision_preventiva", "incautacion", "apelacion_fiscal" };

    public GenerarRequerimientoFiscalValidator()
    {
        RuleFor(x => x.TipoRequerimiento)
            .NotEmpty()
            .Must(v => TiposValidos.Contains(v.ToLower()))
            .WithMessage($"TipoRequerimiento debe ser: {string.Join(", ", TiposValidos)}");

        RuleFor(x => x.Hechos)
            .NotEmpty()
            .MinimumLength(50)
            .MaximumLength(10000);

        RuleFor(x => x.Imputado)
            .NotEmpty()
            .MaximumLength(500);

        RuleFor(x => x.Delito)
            .NotEmpty()
            .MaximumLength(500)
            .WithMessage("Indica el tipo penal imputado (ej: 'Robo agravado - Art. 189 CP').");
    }
}

public class GenerarRequerimientoFiscalHandler : IRequestHandler<GenerarRequerimientoFiscalCommand, RequerimientoFiscalDto>
{
    private readonly ILegalFiscal _gemini;

    public GenerarRequerimientoFiscalHandler(ILegalFiscal gemini) => _gemini = gemini;

    public async Task<RequerimientoFiscalDto> Handle(
        GenerarRequerimientoFiscalCommand request,
        CancellationToken cancellationToken)
    {
        var json = await _gemini.GenerarRequerimientoFiscalAsync(
            request.TipoRequerimiento,
            request.Hechos,
            request.Imputado,
            request.Delito,
            request.RamaDerecho);

        using var doc = JsonDocument.Parse(json);
        var r = doc.RootElement;

        var medidas = r.GetStringArrayOrDefault("medidasSolicitadas");

        return new RequerimientoFiscalDto(
            Sumilla:              r.GetStringOrDefault("sumilla"),
            Hechos:               r.GetStringOrDefault("hechos"),
            CalificacionJuridica: r.GetStringOrDefault("calificacionJuridica"),
            FundamentosFacticos:  r.GetStringOrDefault("fundamentosFacticos"),
            FundamentosJuridicos: r.GetStringOrDefault("fundamentosJuridicos"),
            Petitorio:            r.GetStringOrDefault("petitorio"),
            MedidasSolicitadas:   medidas,
            Advertencias:         r.GetStringOrDefault("advertencias"),
            GeneradoEn:           DateTime.UtcNow);
    }
}
