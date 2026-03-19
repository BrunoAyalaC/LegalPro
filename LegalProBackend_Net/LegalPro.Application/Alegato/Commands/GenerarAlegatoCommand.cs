using FluentValidation;
using MediatR;
using System.Text.Json;
using LegalPro.Application.Common;
using LegalPro.Application.Common.Interfaces;

namespace LegalPro.Application.Alegato.Commands;

/// <summary>
/// Genera un alegato de clausura (apertura o cierre) potenciado por IA Gemini.
/// Aplica NCPP art. 386-390 (alegatos orales), CPC art. 212 (alegatos escritos).
/// </summary>
public record GenerarAlegatoCommand(
    string TipoAlegato,      // "apertura" | "clausura"
    string RamaDerecho,      // "penal" | "civil" | "laboral" | "familia" | "administrativo"
    string Hechos,           // resumen de hechos del caso
    string RolUsuario        // "defensa" | "fiscalia" | "demandante" | "demandado"
) : IRequest<AlegatoDto>;

public record AlegatoDto(
    string Apertura,
    string DesarrolloHechos,
    string ArgumentosJuridicos,
    string Impugnaciones,
    string Cierre,
    IReadOnlyList<string> LeyesCitadas,
    int DuracionEstimadaMinutos);

public class GenerarAlegatoValidator : AbstractValidator<GenerarAlegatoCommand>
{
    private static readonly string[] TiposValidos = { "apertura", "clausura" };
    private static readonly string[] RamasValidas = { "penal", "civil", "laboral", "familia", "administrativo", "constitucional" };
    private static readonly string[] RolesValidos = { "defensa", "fiscalia", "demandante", "demandado", "acusado", "victima" };

    public GenerarAlegatoValidator()
    {
        RuleFor(x => x.TipoAlegato)
            .NotEmpty()
            .Must(v => TiposValidos.Contains(v.ToLower()))
            .WithMessage("TipoAlegato debe ser: apertura o clausura.");

        RuleFor(x => x.RamaDerecho)
            .NotEmpty()
            .Must(v => RamasValidas.Contains(v.ToLower()))
            .WithMessage("RamaDerecho inválida.");

        RuleFor(x => x.Hechos)
            .NotEmpty()
            .MinimumLength(20)
            .MaximumLength(5000)
            .WithMessage("Hechos deben tener entre 20 y 5000 caracteres.");

        RuleFor(x => x.RolUsuario)
            .NotEmpty()
            .Must(v => RolesValidos.Contains(v.ToLower()))
            .WithMessage("RolUsuario inválido.");
    }
}

public class GenerarAlegatoHandler : IRequestHandler<GenerarAlegatoCommand, AlegatoDto>
{
    private readonly ILegalAlegato _geminiAlegato;

    public GenerarAlegatoHandler(ILegalAlegato geminiAlegato)
    {
        _geminiAlegato = geminiAlegato;
    }

    public async Task<AlegatoDto> Handle(GenerarAlegatoCommand request, CancellationToken cancellationToken)
    {
        var json = await _geminiAlegato.GenerarAlegatoAsync(
            request.TipoAlegato, request.RamaDerecho, request.Hechos, request.RolUsuario);

        var doc = JsonDocument.Parse(json);
        var r = doc.RootElement;

        return new AlegatoDto(
            Apertura: r.GetStringOrDefault("apertura", ""),
            DesarrolloHechos: r.GetStringOrDefault("desarrolloHechos", ""),
            ArgumentosJuridicos: r.GetStringOrDefault("argumentosJuridicos", ""),
            Impugnaciones: r.GetStringOrDefault("impugnaciones", ""),
            Cierre: r.GetStringOrDefault("cierre", ""),
            LeyesCitadas: r.GetStringArrayOrDefault("leyesCitadas"),
            DuracionEstimadaMinutos: r.TryGetProperty("duracionEstimadaMinutos", out var d) && d.TryGetInt32(out var mins) ? mins : 10
        );
    }
}


