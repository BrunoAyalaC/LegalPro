using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using LegalPro.Application.Fiscal.Commands;

namespace LegalPro.Api.Controllers;

/// <summary>
/// Herramientas exclusivas para el Fiscal del Ministerio Público.
/// FC diferenciado: prompts y function schemas adaptados al rol FISCAL.
/// Contexto: NCPP, Código Penal, Ministerio Público, requerimientos de acusación.
/// </summary>
[Authorize]
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("gemini")]
public class FiscalController : ControllerBase
{
    private readonly IMediator _mediator;

    public FiscalController(IMediator mediator) => _mediator = mediator;

    /// <summary>
    /// Genera requerimiento fiscal formal (acusatorio, sobreseimiento, archivo).
    /// FC forzado: estructura procesalmente válida según NCPP arts. 344-349.
    /// Incluye: hechos imputados, calificación jurídica, medios de prueba, solicitud de pena.
    /// </summary>
    [HttpPost("requerimiento")]
    public async Task<IActionResult> GenerarRequerimiento(
        [FromBody] GenerarRequerimientoFiscalCommand command,
        CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return Ok(result);
    }
}
