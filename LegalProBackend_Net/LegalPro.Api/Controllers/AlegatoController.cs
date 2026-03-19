using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using LegalPro.Application.Alegato.Commands;

namespace LegalPro.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("gemini")]
public class AlegatoController : ControllerBase
{
    private readonly IMediator _mediator;

    public AlegatoController(IMediator mediator) => _mediator = mediator;

    /// <summary>
    /// Genera un alegato de clausura con IA basado en los hechos del caso.
    /// FC forzado: garantiza respuesta estructurada con apertura, desarrollo, cierre y leyes citadas.
    /// </summary>
    [HttpPost("generar")]
    public async Task<IActionResult> Generar([FromBody] GenerarAlegatoCommand command, CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return Ok(result);
    }
}
