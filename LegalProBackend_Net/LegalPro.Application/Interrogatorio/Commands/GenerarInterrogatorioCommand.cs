using FluentValidation;
using MediatR;
using System.Text.Json;
using LegalPro.Application.Common;
using LegalPro.Application.Common.Interfaces;

namespace LegalPro.Application.Interrogatorio.Commands;

/// <summary>
/// Genera estrategia de interrogatorio/contrainterrogatorio basada en NCPP art. 370-378
/// y en los hechos clave del caso.
/// </summary>
public record GenerarInterrogatorioCommand(
    string NombreTestigo,    // nombre del testigo (puede ser anónimo: "Testigo X")
    string TipoTestigo,      // "directo" | "experto" | "caracter" | "adversarial"
    string HechosClave,      // hechos clave del caso relacionados con el testigo
    string Objetivo,         // "acreditar_hechos" | "impugnar_credibilidad" | "corroborar_alibi"
    string Rol = "ABOGADO"   // "ABOGADO" | "FISCAL" | "ABOGADO_FISCAL" (combinacion)
) : IRequest<InterrogatorioDto>;

public record InterrogatorioDto(
    string Introduccion,
    IReadOnlyList<PreguntaInterrogatorio> PreguntasPrincipales,
    IReadOnlyList<PreguntaInterrogatorio> ContrapreguntasSugeridas,
    string EstrategiaCierre,
    IReadOnlyList<string> ArticulosNCPP,
    string NivelDificultad);

public record PreguntaInterrogatorio(
    string Pregunta,
    string PropositoTactico,
    string RespuestaEsperada);

public class GenerarInterrogatorioValidator : AbstractValidator<GenerarInterrogatorioCommand>
{
    private static readonly string[] TiposValidos = { "directo", "experto", "caracter", "adversarial" };
    private static readonly string[] ObjetivosValidos =
    {
        "acreditar_hechos", "impugnar_credibilidad", "corroborar_alibi",
        "establecer_contexto", "demostrar_contradiccion"
    };

    public GenerarInterrogatorioValidator()
    {
        RuleFor(x => x.NombreTestigo)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.TipoTestigo)
            .NotEmpty()
            .Must(v => TiposValidos.Contains(v.ToLower()))
            .WithMessage($"TipoTestigo debe ser: {string.Join(", ", TiposValidos)}");

        RuleFor(x => x.HechosClave)
            .NotEmpty()
            .MinimumLength(20)
            .MaximumLength(5000);

        RuleFor(x => x.Objetivo)
            .NotEmpty()
            .Must(v => ObjetivosValidos.Contains(v.ToLower()))
            .WithMessage($"Objetivo debe ser: {string.Join(", ", ObjetivosValidos)}");
    }
}

public class GenerarInterrogatorioHandler : IRequestHandler<GenerarInterrogatorioCommand, InterrogatorioDto>
{
    private readonly ILegalInterrogatorio _gemini;

    public GenerarInterrogatorioHandler(ILegalInterrogatorio gemini)
    {
        _gemini = gemini;
    }

    public async Task<InterrogatorioDto> Handle(
        GenerarInterrogatorioCommand request,
        CancellationToken cancellationToken)
    {
        var json = await _gemini.GenerarEstrategiaInterrogatorioAsync(
            request.NombreTestigo,
            request.TipoTestigo,
            request.HechosClave,
            request.Objetivo,
            request.Rol);

        using var doc = JsonDocument.Parse(json);
        var r = doc.RootElement;

        var preguntas = r.TryGetProperty("preguntasPrincipales", out var pProp)
            ? pProp.EnumerateArray()
                .Select(p => new PreguntaInterrogatorio(
                    p.GetStringOrDefault("pregunta", ""),
                    p.GetStringOrDefault("propositoTactico", ""),
                    p.GetStringOrDefault("respuestaEsperada", "")))
                .ToList()
            : new List<PreguntaInterrogatorio>();

        var contraPreguntas = r.TryGetProperty("contrapreguntasSugeridas", out var cProp)
            ? cProp.EnumerateArray()
                .Select(p => new PreguntaInterrogatorio(
                    p.GetStringOrDefault("pregunta", ""),
                    p.GetStringOrDefault("propositoTactico", ""),
                    p.GetStringOrDefault("respuestaEsperada", "")))
                .ToList()
            : new List<PreguntaInterrogatorio>();

        var articulos = r.TryGetProperty("articulosNCPP", out var aProp)
            ? aProp.EnumerateArray().Select(a => a.GetString() ?? "").ToList()
            : new List<string>();

        return new InterrogatorioDto(
            Introduccion: r.GetStringOrDefault("introduccion", ""),
            PreguntasPrincipales: preguntas,
            ContrapreguntasSugeridas: contraPreguntas,
            EstrategiaCierre: r.GetStringOrDefault("estrategiaCierre", ""),
            ArticulosNCPP: articulos,
            NivelDificultad: r.GetStringOrDefault("nivelDificultad", "intermedio"));
    }
}
