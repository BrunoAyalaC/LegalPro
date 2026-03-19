using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using LegalPro.Application.Plazos.Queries;

namespace LegalPro.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class PlazosController : ControllerBase
{
    private readonly IMediator _mediator;

    public PlazosController(IMediator mediator) => _mediator = mediator;

    /// <summary>
    /// Calcula plazos procesales según CPC (art. 147, 360) y NCPP (art. 414).
    /// Lógica pura en memoria — sin llamada a Gemini, respuesta inmediata.
    /// </summary>
    [HttpPost("calcular")]
    public async Task<IActionResult> Calcular([FromBody] CalcularPlazosQuery query, CancellationToken ct)
    {
        var result = await _mediator.Send(query, ct);
        return Ok(result);
    }
}
