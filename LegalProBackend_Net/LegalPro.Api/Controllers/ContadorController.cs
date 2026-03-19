using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using LegalPro.Application.Contador.Commands;

namespace LegalPro.Api.Controllers;

/// <summary>
/// Herramientas para el Contador / Perito Contable como auxiliar del proceso judicial.
/// FC diferenciado: terminología contable-legal peruana, referencias a NIIF, PCGE, SUNAT.
/// Contexto: legislación laboral (CTS, gratificaciones, vacaciones), intereses legales BCRP.
/// </summary>
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ContadorController : ControllerBase
{
    private readonly IMediator _mediator;

    public ContadorController(IMediator mediator) => _mediator = mediator;

    /// <summary>
    /// Calcula liquidación laboral completa: CTS, gratificaciones, vacaciones truncas,
    /// indemnización por despido arbitrario, intereses legales (tasa BCRP).
    /// FC forzado: cada concepto con monto, base legal y método de cálculo.
    /// </summary>
    [HttpPost("liquidacion-laboral")]
    [EnableRateLimiting("gemini")]
    public async Task<IActionResult> CalcularLiquidacion(
        [FromBody] CalcularLiquidacionLaboralCommand command,
        CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return Ok(result);
    }

    /// <summary>
    /// Genera informe pericial contable con estructura oficial del Poder Judicial peruano:
    /// Cargo/nombramiento → Objeto → Metodología → Análisis → Conclusiones numeradas → Observaciones.
    /// FC forzado: respuesta siempre en JSON con conclusiones, sustento normativo y monto total.
    /// TipoPericia: laboral | societario | tributario | bancario | patrimonial | danos_perjuicios
    /// </summary>
    [HttpPost("informe-pericial")]
    [EnableRateLimiting("gemini")]
    public async Task<IActionResult> GenerarInformePericial(
        [FromBody] GenerarInformePericialCommand command,
        CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return Ok(result);
    }
}
