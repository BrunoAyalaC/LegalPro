using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using LegalPro.Application.Redactor.Commands;

namespace LegalPro.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("gemini")]
public class RedactorController : ControllerBase
{
    private readonly IMediator _mediator;

    public RedactorController(IMediator mediator) => _mediator = mediator;

    [HttpPost("generar")]
    public async Task<IActionResult> Generar([FromBody] GenerarBorradorCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }
}
