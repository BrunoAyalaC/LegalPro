using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using LegalPro.Application.Chat.Commands;
using LegalPro.Application.Chat.Queries;

namespace LegalPro.Api.Controllers;

// ═══════════════════════════════════════════════════════
// Chat legal multi-turn con Gemini.
// POST /enviar  → envía historial + mensaje, retorna respuesta IA + SesionId.
// GET  /historial?sesionId=X → recupera mensajes guardados de una sesión.
// GET  /sesiones → lista las sesiones del usuario (para reanudar chats).
// ═══════════════════════════════════════════════════════
[Authorize]
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("gemini")]
public class ChatController : ControllerBase
{
    private readonly IMediator _mediator;

    public ChatController(IMediator mediator) => _mediator = mediator;

    // ── POST /api/chat/enviar ───────────────────────────────────────────────
    // Envía historial acumulado + nuevo mensaje al chat legal IA.
    // Responde: { respuesta, sesionId } — el cliente debe guardar sesionId
    // para poder reanudar la conversación vía GET /historial.
    [HttpPost("enviar")]
    public async Task<IActionResult> Enviar(
        [FromBody] EnviarMensajeChatCommand command,
        CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return Ok(result);
    }

    // ── GET /api/chat/historial?sesionId={guid}&limit=50 ────────────────────
    // Recupera los mensajes persistidos de una sesión específica.
    // El SesionId se obtiene de la respuesta del primer POST /enviar.
    [HttpGet("historial")]
    public async Task<IActionResult> GetHistorial(
        [FromQuery] Guid sesionId,
        [FromQuery] int limit = 50,
        CancellationToken ct = default)
    {
        if (sesionId == Guid.Empty)
            return BadRequest(new { error = "sesionId es requerido y no puede ser vacío." });

        var result = await _mediator.Send(
            new GetHistorialChatQuery { SesionId = sesionId, Limit = limit }, ct);
        return Ok(result);
    }

    // ── GET /api/chat/sesiones?limit=10 ──────────────────────────────────────
    // Lista las sesiones de chat del usuario autenticado (para reanudar).
    [HttpGet("sesiones")]
    public async Task<IActionResult> GetSesiones(
        [FromQuery] int limit = 10,
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(new GetSesionesChatQuery { Limit = limit }, ct);
        return Ok(result);
    }
}
