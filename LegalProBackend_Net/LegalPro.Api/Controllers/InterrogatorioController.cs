using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using LegalPro.Application.Interrogatorio.Commands;

namespace LegalPro.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("gemini")]
public class InterrogatorioController : ControllerBase
{
    private readonly IMediator _mediator;

    public InterrogatorioController(IMediator mediator) => _mediator = mediator;

    /// <summary>
    /// Genera estrategia de interrogatorio/contrainterrogatorio según NCPP arts. 370-378.
    /// FC forzado: retorna preguntas ordenadas con propósito por cada una.
    /// </summary>
    [HttpPost("generar")]
    public async Task<IActionResult> Generar([FromBody] GenerarInterrogatorioCommand command, CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return Ok(result);
    }
}
