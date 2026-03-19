using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using LegalPro.Application.Jurisprudencia.Queries;

namespace LegalPro.Api.Controllers;

// ═══════════════════════════════════════════════════════
// Búsqueda de jurisprudencia peruana con Gemini + Google Search grounding.
// SRP: Controller solo delega a MediatR.
// ILegalJurisprudenciaSearch → BuscarJurisprudenciaQueryHandler.
// ═══════════════════════════════════════════════════════
[Authorize]
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("gemini")]
public class JurisprudenciaController : ControllerBase
{
    private readonly IMediator _mediator;

    public JurisprudenciaController(IMediator mediator) => _mediator = mediator;

    // ── POST /api/jurisprudencia/buscar ─────────────────────────────────
    // Gemini con Google Search grounding busca jurisprudencia real.
    // Filtros opcionales: sala, materia, fechaDesde, fechaHasta.
    // IncluirVinculantes=true añade precedentes vinculantes Corte Suprema.
    // ─────────────────────────────────────────────────────────────
    [HttpPost("buscar")]
    public async Task<IActionResult> Buscar(
        [FromBody] BuscarJurisprudenciaQuery query,
        CancellationToken ct)
    {
        var result = await _mediator.Send(query, ct);
        return Ok(result);
    }

    // ── GET /api/jurisprudencia/buscar ─────────────────────────────────
    // Alternativa GET con query string para búsquedas rápidas.
    // ─────────────────────────────────────────────────────────────
    [HttpGet("buscar")]
    public async Task<IActionResult> BuscarGet(
        [FromQuery] string q,
        [FromQuery] string? sala,
        [FromQuery] string? materia,
        [FromQuery] bool vinculantes = true,
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(new BuscarJurisprudenciaQuery
        {
            TerminoBusqueda    = q,
            Sala               = sala,
            Materia            = materia,
            IncluirVinculantes = vinculantes,
        }, ct);
        return Ok(result);
    }
}
