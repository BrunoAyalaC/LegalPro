using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using LegalPro.Application.Juez.Commands;
using LegalPro.Application.Juez.Queries;

namespace LegalPro.Api.Controllers;

/// <summary>
/// Herramientas exclusivas para el Juez / Magistrado.
/// FC diferenciado: prompts en estilo resolutivo judicial, lenguaje formal del Poder Judicial.
/// Contexto: CPC, NCPP, Código Civil, precedentes vinculantes TC y Corte Suprema.
/// </summary>
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class JuezController : ControllerBase
{
    private readonly IMediator _mediator;

    public JuezController(IMediator mediator) => _mediator = mediator;

    /// <summary>
    /// Asistente para redacción de resoluciones judiciales.
    /// FC forzado: genera considerandos, fallo y parte decisoria con numeración formal.
    /// Estructura: vistos, considerandos (fundamentos de hecho y derecho), fallo, notifíquese.
    /// </summary>
    [HttpPost("resolucion")]
    [EnableRateLimiting("gemini")]
    public async Task<IActionResult> GenerarResolucion(
        [FromBody] GenerarResolucionJudicialCommand command,
        CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return Ok(result);
    }

    /// <summary>
    /// Compara precedentes vinculantes del TC y Casaciones de la Corte Suprema.
    /// FC forzado: tabula diferencias, identifica ratio decidendi y obiter dicta.
    /// Útil para resolver conflictos de criterios jurisprudenciales.
    /// </summary>
    [HttpPost("precedentes/comparar")]
    [EnableRateLimiting("gemini")]
    public async Task<IActionResult> CompararPrecedentes(
        [FromBody] CompararPrecedentesQuery query,
        CancellationToken ct)
    {
        var result = await _mediator.Send(query, ct);
        return Ok(result);
    }
}
