using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using LegalPro.Application.Simulacion.Commands;
using LegalPro.Application.Simulacion.Queries;

namespace LegalPro.Api.Controllers;

// ═══════════════════════════════════════════════════════
// Simulación de juicio oral interactiva multi-turn con Gemini.
// SRP: Controller solo delega a MediatR.
// Tenant isolation + OWASP A01: verificado en cada handler.
// ═══════════════════════════════════════════════════════
[Authorize]
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("gemini")]
public class SimulacionController : ControllerBase
{
    private readonly IMediator _mediator;

    public SimulacionController(IMediator mediator) => _mediator = mediator;

    // ── POST /api/simulacion/iniciar ────────────────────────────────────────
    // Crea la simulación, persiste en BD e invoca Gemini (FC) para
    // generar el contexto del caso + apertura del juicio oral.
    // ─────────────────────────────────────────────────────────────
    [HttpPost("iniciar")]
    public async Task<IActionResult> IniciarSimulacion(
        [FromBody] IniciarSimulacionCommand command,
        CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return CreatedAtAction(
            nameof(GetBoard),
            new { id = result.SimulacionId },
            result);
    }

    // ── POST /api/simulacion/turno ──────────────────────────────────────────
    // Envía el argumento del usuario. Gemini evalúa + responde
    // como la parte adversarial. Retorna puntajeDelta + leyesInvocadas.
    // ─────────────────────────────────────────────────────────────
    [HttpPost("turno")]
    public async Task<IActionResult> ProcesarTurno(
        [FromBody] ProcesarTurnoCommand command,
        CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return Ok(result);
    }

    // ── POST /api/simulacion/{id}/finalizar ───────────────────────────────
    // Cierra la sesión. Persiste puntaje final y total de turnos.
    // ─────────────────────────────────────────────────────────────
    [HttpPost("{id:int}/finalizar")]
    public async Task<IActionResult> Finalizar(int id, CancellationToken ct)
    {
        var result = await _mediator.Send(new FinalizarSimulacionCommand { SimulacionId = id }, ct);
        return Ok(result);
    }

    // ── GET /api/simulacion/{id}/board ────────────────────────────────────
    // Estado completo: contexto + eventos ordenados por turno.
    // ─────────────────────────────────────────────────────────────
    [HttpGet("{id:int}/board")]
    public async Task<IActionResult> GetBoard(int id, CancellationToken ct)
    {
        var result = await _mediator.Send(new GetSimulacionBoardQuery { SimulacionId = id }, ct);
        return Ok(result);
    }

    // ── GET /api/simulacion ──────────────────────────────────────────────────
    // Lista las simulaciones del usuario autenticado (paginado).
    // ─────────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetSimulaciones(
        [FromQuery] int limit = 20,
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(new GetSimulacionesQuery { Limit = limit }, ct);
        return Ok(result);
    }
}
