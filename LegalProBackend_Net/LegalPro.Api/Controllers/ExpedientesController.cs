using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using LegalPro.Application.Expedientes.Commands;
using LegalPro.Application.Expedientes.Queries;
using LegalPro.Domain.Enums;
using Microsoft.AspNetCore.RateLimiting;
namespace LegalPro.Api.Controllers;

// ═══════════════════════════════════════════════════════
// CRUD completo de Expedientes.
// Todos los endpoints requieren JWT (tenant aislado).
// SRP: Controller solo delega a MediatR — sin lógica de negocio.
// ExceptionHandlingMiddleware captura NotFoundException/DomainException.
// ═══════════════════════════════════════════════════════
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ExpedientesController : ControllerBase
{
    private readonly IMediator _mediator;

    public ExpedientesController(IMediator mediator) => _mediator = mediator;
    // ── GET /api/expedientes/stats ─────────────────────────────────────────────
    // Devuelve conteos por estado, tipo y urgencia para el dashboard.
    // Tenant isolated: filtra automáticamente por OrganizationId del JWT.
    // ──────────────────────────────────────────────────────
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats(CancellationToken ct)
    {
        var stats = await _mediator.Send(new GetExpedientesStatsQuery(), ct);
        return Ok(stats);
    }
    // ── GET /api/expedientes ──────────────────────────────────────────────
    // Lista expedientes del tenant con filtros opcionales y paginación.
    // Query params: estado, tipo, esUrgente, search, page, limit
    // ─────────────────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetExpedientes(
        [FromQuery] string? estado,
        [FromQuery] string? tipo,
        [FromQuery] bool? esUrgente,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(new GetExpedientesQuery
        {
            Estado = estado,
            Tipo = tipo,
            EsUrgente = esUrgente,
            Search = search,
            Page = page,
            Limit = limit
        }, ct);

        return Ok(result);
    }

    // ── GET /api/expedientes/{id} ─────────────────────────────────────────
    // Obtiene un expediente por Id. Devuelve 404 si no existe o si es de
    // otro tenant (evita information disclosure cross-tenant — OWASP A01).
    // ─────────────────────────────────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetExpedienteById(Guid id, CancellationToken ct)
    {
        var dto = await _mediator.Send(new GetExpedienteByIdQuery(id), ct);
        return Ok(dto);
    }

    // ── POST /api/expedientes ─────────────────────────────────────────────
    // Crea un nuevo expediente en el tenant del usuario autenticado.
    // PlanLimitsBehavior verifica cupo antes de ejecutar el handler.
    // ─────────────────────────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> CrearExpediente(
        [FromBody] CrearExpedienteCommand command,
        CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return CreatedAtAction(
            nameof(GetExpedienteById),
            new { id = result.Id },
            new
            {
                id = result.Id,
                numero = result.Numero,
                titulo = result.Titulo,
                tipo = result.Tipo,
                estado = result.Estado,
                esUrgente = result.EsUrgente,
                organizationId = result.OrganizationId,
                createdAt = result.CreatedAt
            });
    }

    // ── PUT /api/expedientes/{id} ─────────────────────────────────────────
    // Actualización parcial: titulo, estado y/o esUrgente.
    // Al menos un campo debe estar presente (validado en FluentValidation).
    // ─────────────────────────────────────────────────────────────────────
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> ActualizarExpediente(
        Guid id,
        [FromBody] ActualizarExpedienteCommand command,
        CancellationToken ct)
    {
        command.Id = id;
        var result = await _mediator.Send(command, ct);
        return Ok(new
        {
            id = result.Id,
            numero = result.Numero,
            titulo = result.Titulo,
            tipo = result.Tipo,
            estado = result.Estado,
            esUrgente = result.EsUrgente,
            organizationId = result.OrganizationId,
            updatedAt = result.UpdatedAt
        });
    }

    // ── DELETE /api/expedientes/{id} ──────────────────────────────────────
    // Soft-delete: archiva el expediente (EstadoExpediente.Archivado).
    // Preserva histórico forense requerido en procedimientos legales peruanos.
    // ─────────────────────────────────────────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> EliminarExpediente(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new EliminarExpedienteCommand(id), ct);
        return NoContent();
    }

    // ── GET /api/expedientes/{id}/resumen-ia ─────────────────────────────
    // Genera resumen ejecutivo del caso con Gemini (FC forzado).
    // Incluye fortalezas, debilidades, acciones inmediatas y riesgo general.
    // ────────────────────────────────────────────────────────────────
    [HttpGet("{id:guid}/resumen-ia")]
    [EnableRateLimiting("gemini")]
    public async Task<IActionResult> ResumenIa(Guid id, CancellationToken ct)
    {
        var result = await _mediator.Send(new GenerarResumenCasoQuery(id), ct);
        return Ok(result);
    }
}


