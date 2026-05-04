using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using LegalPro.Application.Chat.Commands;
using LegalPro.Application.Chat.Queries;
using LegalPro.Application.Redactor.Commands;
using LegalPro.Application.Jurisprudencia.Queries;

namespace LegalPro.Api.Controllers;

// ═══════════════════════════════════════════════════════
// Endpoints de compatibilidad para el frontend.
// Mapea rutas /api/gemini/* a los handlers CQRS existentes.
// ═══════════════════════════════════════════════════════
[ApiController]
[Route("api/gemini")]
[Authorize]
[EnableRateLimiting("gemini")]
public class GeminiController : ControllerBase
{
    private readonly IMediator _mediator;

    public GeminiController(IMediator mediator) => _mediator = mediator;

    // ── POST /api/gemini/chat ─────────────────────────────────────────────
    // Recibe formato del frontend y delega al handler existente.
    // Frontend: { mensaje, historial, expediente_id, disclaimerAceptado }
    // ─────────────────────────────────────────────────────────────────────
    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] GeminiChatRequest request, CancellationToken ct)
    {
        var command = new EnviarMensajeChatCommand(
            History: request.Historial ?? string.Empty,
            UserInput: request.Mensaje ?? string.Empty,
            SesionId: null);

        var result = await _mediator.Send(command, ct);
        return Ok(new { respuesta = result.Respuesta, sesionId = result.SesionId });
    }

    // ── GET /api/gemini/historial?sesionId={guid}&limit=50 ───────────────
    // Alias de GET /api/chat/historial.
    // ─────────────────────────────────────────────────────────────────────
    [HttpGet("historial")]
    public async Task<IActionResult> Historial(
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

    // ── POST /api/gemini/consulta ─────────────────────────────────────────
    // Si tipo === 'redaccion' o el prompt contiene tipo de escrito,
    // llama al RedactorHandler. Sino, fallback a ChatHandler.
    // Frontend: { prompt, tipo, disclaimerAceptado }
    // ─────────────────────────────────────────────────────────────────────
    [HttpPost("consulta")]
    public async Task<IActionResult> Consulta([FromBody] GeminiConsultaRequest request, CancellationToken ct)
    {
        var esRedaccion =
            string.Equals(request.Tipo, "redaccion", StringComparison.OrdinalIgnoreCase) ||
            EsPromptDeRedaccion(request.Prompt ?? string.Empty);

        if (esRedaccion)
        {
            var tipoEscrito = request.Tipo ?? DetectarTipoEscrito(request.Prompt ?? string.Empty);
            var command = new GenerarBorradorCommand(
                TipoEscrito: tipoEscrito,
                DistritoJudicial: string.Empty,
                HechosCausa: request.Prompt ?? string.Empty);

            var result = await _mediator.Send(command, ct);
            return Ok(new
            {
                tipo = "redaccion",
                borrador = result.BorradorGenerado,
                leyesCitadas = result.LeyesCitadas
            });
        }

        // Fallback a chat general
        var chatCommand = new EnviarMensajeChatCommand(
            History: string.Empty,
            UserInput: request.Prompt ?? string.Empty,
            SesionId: null);

        var chatResult = await _mediator.Send(chatCommand, ct);
        return Ok(new
        {
            tipo = "chat",
            respuesta = chatResult.Respuesta,
            sesionId = chatResult.SesionId
        });
    }

    // ── GET /api/gemini/jurisprudencia?q=... ──────────────────────────────
    // Alias de GET /api/jurisprudencia/buscar.
    // ─────────────────────────────────────────────────────────────────────
    [HttpGet("jurisprudencia")]
    public async Task<IActionResult> Jurisprudencia(
        [FromQuery] string q,
        [FromQuery] string? sala,
        [FromQuery] string? materia,
        [FromQuery] bool vinculantes = true,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(q))
            return BadRequest(new { error = "El parámetro 'q' es requerido." });

        var result = await _mediator.Send(new BuscarJurisprudenciaQuery
        {
            TerminoBusqueda = q,
            Sala = sala,
            Materia = materia,
            IncluirVinculantes = vinculantes
        }, ct);

        return Ok(result);
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    private static bool EsPromptDeRedaccion(string prompt)
    {
        if (string.IsNullOrWhiteSpace(prompt)) return false;
        var palabrasClave = new[]
        {
            "demanda", "escrito", "recurso", "alegato", "resolucion",
            "resolución", "solicitud", "querella", "denuncia", "contrato",
            "escrito de", "borrador de", "redactar", "redacta", "redaccion",
            "redacción", "modelo de", "formato de"
        };
        var lower = prompt.ToLowerInvariant();
        return palabrasClave.Any(k => lower.Contains(k));
    }

    private static string DetectarTipoEscrito(string prompt)
    {
        var lower = prompt.ToLowerInvariant();
        if (lower.Contains("demanda")) return "Demanda";
        if (lower.Contains("recurso")) return "Recurso";
        if (lower.Contains("alegato")) return "Alegato";
        if (lower.Contains("solicitud")) return "Solicitud";
        if (lower.Contains("contrato")) return "Contrato";
        if (lower.Contains("denuncia")) return "Denuncia";
        if (lower.Contains("querella")) return "Querella";
        return "Escrito";
    }
}

// DTOs internos para deserialización del frontend
public record GeminiChatRequest(
    string? Mensaje,
    string? Historial,
    string? ExpedienteId,
    bool? DisclaimerAceptado);

public record GeminiConsultaRequest(
    string? Prompt,
    string? Tipo,
    bool? DisclaimerAceptado);
