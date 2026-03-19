using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using LegalPro.Application.OrganizacionesModule.Commands;
using LegalPro.Application.OrganizacionesModule.Queries;

namespace LegalPro.Api.Controllers;

// ═══════════════════════════════════════════════════════
// Multi-tenant gateway: todos los endpoints requieren JWT.
// SRP: Controller solo delega a MediatR.
// ExceptionHandlingMiddleware captura todos los errores.
// ═══════════════════════════════════════════════════════
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrganizacionesController : ControllerBase
{
    private readonly IMediator _mediator;

    public OrganizacionesController(IMediator mediator) => _mediator = mediator;

    // ── GET /api/organizaciones/me ────────────────────────────────────────
    // Retorna la organización del usuario autenticado.
    // ─────────────────────────────────────────────────────────────────────
    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentOrganizacion(CancellationToken ct)
    {
        var dto = await _mediator.Send(new GetCurrentOrganizacionQuery(), ct);
        return Ok(dto);
    }

    // ── POST /api/organizaciones ──────────────────────────────────────────
    // Crea una nueva organización y asigna al usuario como Owner.
    // Si el usuario ya tiene organización, retorna 400.
    // ─────────────────────────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearOrganizacionCommand command, CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return CreatedAtAction(
            nameof(GetCurrentOrganizacion),
            new { },
            new
            {
                organizacionId = result.OrganizacionId,
                nombre = result.Nombre,
                slug = result.Slug,
                plan = result.Plan.ToString(),
                token = result.NuevoToken
            });
    }

    // ── POST /api/organizaciones/invite ───────────────────────────────────
    // Owner/Admin invita a un usuario por email.
    // ─────────────────────────────────────────────────────────────────────
    [HttpPost("invite")]
    public async Task<IActionResult> InvitarMiembro([FromBody] InvitarMiembroCommand command, CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return Ok(new
        {
            invitacionId = result.InvitacionId,
            email = result.Email,
            token = result.Token,
            expiresAt = result.ExpiresAt
        });
    }

    // ── POST /api/organizaciones/accept-invite ────────────────────────────
    // Usuario acepta la invitación con el token recibido por email.
    // ─────────────────────────────────────────────────────────────────────
    [HttpPost("accept-invite")]
    public async Task<IActionResult> AceptarInvitacion([FromBody] AceptarInvitacionCommand command, CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return Ok(new
        {
            mensaje = "Invitación aceptada. Bienvenido a la organización.",
            token = result.NuevoToken,
            organizacionId = result.OrganizacionId,
            organizacionNombre = result.OrgNombre,
            organizacionSlug = result.OrgSlug
        });
    }

    // ── DELETE /api/organizaciones/members/{usuarioId} ───────────────────
    // Owner/Admin remueve un miembro de la organización.
    // ─────────────────────────────────────────────────────────────────────
    [HttpDelete("members/{usuarioId:int}")]
    public async Task<IActionResult> RemoverMiembro(int usuarioId, CancellationToken ct)
    {
        await _mediator.Send(new RemoverMiembroCommand { UsuarioId = usuarioId }, ct);
        return NoContent();
    }
}
