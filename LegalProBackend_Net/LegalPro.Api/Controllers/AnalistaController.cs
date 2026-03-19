using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using LegalPro.Application.Analisis.Commands;

namespace LegalPro.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("gemini")]
public class AnalistaController : ControllerBase
{
    private readonly IMediator _mediator;

    public AnalistaController(IMediator mediator) => _mediator = mediator;

    [HttpPost("analizar")]
    public async Task<IActionResult> Analizar([FromBody] AnalizarExpedienteCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }
}
