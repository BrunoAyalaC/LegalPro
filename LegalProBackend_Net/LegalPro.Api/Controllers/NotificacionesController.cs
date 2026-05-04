using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using LegalPro.Application.Notificaciones.Queries;

namespace LegalPro.Api.Controllers;

// ═══════════════════════════════════════════════════════
// Notificaciones calculadas a partir de expedientes.
// No persiste notificaciones: son calculadas en tiempo real.
// ═══════════════════════════════════════════════════════
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificacionesController : ControllerBase
{
    private readonly IMediator _mediator;

    public NotificacionesController(IMediator mediator) => _mediator = mediator;

    // ── GET /api/notificaciones ───────────────────────────────────────────
    // Retorna notificaciones basadas en expedientes del tenant:
    //   - Urgentes: expedientes marcados como EsUrgente.
    //   - Plazos próximos: vacío porque el modelo no tiene fecha de vencimiento.
    // ─────────────────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetNotificaciones(CancellationToken ct)
    {
        var result = await _mediator.Send(new GetNotificacionesQuery(), ct);
        return Ok(result);
    }
}
