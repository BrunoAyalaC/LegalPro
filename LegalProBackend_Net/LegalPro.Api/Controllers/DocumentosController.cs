using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using LegalPro.Application.Documentos.Queries;
using LegalPro.Application.Documentos.Commands;

namespace LegalPro.Api.Controllers;

// ═══════════════════════════════════════════════════════
// CRUD de Documentos asociados a Expedientes.
// Solo metadata JSON por ahora (sin upload binario).
// ═══════════════════════════════════════════════════════
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DocumentosController : ControllerBase
{
    private readonly IMediator _mediator;

    public DocumentosController(IMediator mediator) => _mediator = mediator;

    // ── GET /api/documentos?expedienteId={id} ─────────────────────────────
    // Lista documentos de un expediente filtrados por organización.
    // ─────────────────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetDocumentos(
        [FromQuery] Guid expedienteId,
        CancellationToken ct)
    {
        if (expedienteId == Guid.Empty)
            return BadRequest(new { error = "expedienteId es requerido." });

        var result = await _mediator.Send(new GetDocumentosByExpedienteQuery { ExpedienteId = expedienteId }, ct);
        return Ok(result);
    }

    // ── POST /api/documentos ──────────────────────────────────────────────
    // Crea un documento (metadata) asociado a un expediente.
    // ─────────────────────────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> CrearDocumento(
        [FromBody] CrearDocumentoCommand command,
        CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return CreatedAtAction(
            nameof(GetDocumentos),
            new { expedienteId = result.ExpedienteId },
            result);
    }
}
