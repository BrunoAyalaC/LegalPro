using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using LegalPro.Application.Objeciones.Commands;

namespace LegalPro.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("gemini")]
public class ObjecionesController : ControllerBase
{
    private readonly IMediator _mediator;

    public ObjecionesController(IMediator mediator) => _mediator = mediator;

    /// <summary>
    /// Asistente de objeciones en tiempo real.
    /// Analiza un fragmento adversarial y sugiere si procede objetar según NCPP/CPC peruano.
    /// Baja latencia: Temperature = 0.2, MaxOutputTokens = 1024.
    /// </summary>
    [HttpPost("sugerir")]
    public async Task<IActionResult> Sugerir([FromBody] SugerirObjecionCommand command, CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return Ok(result);
    }
}
