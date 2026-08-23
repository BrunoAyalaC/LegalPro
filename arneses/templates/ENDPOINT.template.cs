// Plantilla Controller .NET delgado
// Ruta: LegalPro.Api/Controllers/XxxController.cs

using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace LegalPro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("standard")]
public class XxxController : ControllerBase
{
    private readonly IMediator _mediator;

    public XxxController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    [ProducesResponseType(typeof(List<XxxDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<XxxDto>>> GetAll(
        [FromQuery] string? filtro = null,
        CancellationToken ct = default)
    {
        var query = new GetXxxsQuery { Filtro = filtro };
        var result = await _mediator.Send(query, ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(XxxDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<XxxDto>> GetById(
        Guid id,
        CancellationToken ct = default)
    {
        var query = new GetXxxByIdQuery { Id = id };
        var result = await _mediator.Send(query, ct);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpPost]
    [Authorize(Roles = "ABOGADO,FISCAL")]
    [EnableRateLimiting("gemini")]
    [ProducesResponseType(typeof(XxxDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<XxxDto>> Create(
        [FromBody] CreateXxxCommand command,
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(command, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }
}

// Command
public record CreateXxxCommand : IRequest<XxxDto>, ITenantRequest
{
    public string Nombre { get; init; }
    public string Descripcion { get; init; }
}

// Validator
public class CreateXxxCommandValidator : AbstractValidator<CreateXxxCommand>
{
    public CreateXxxCommandValidator()
    {
        RuleFor(x => x.Nombre).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Descripcion).MaximumLength(2000);
    }
}

// Handler
public class CreateXxxCommandHandler : IRequestHandler<CreateXxxCommand, XxxDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _user;
    private readonly IAuditLogger _audit;

    public async Task<XxxDto> Handle(CreateXxxCommand request, CancellationToken ct)
    {
        // Business logic
        var entity = new Xxx {
            Id = Guid.NewGuid(),
            OrganizationId = _user.OrganizationId,
            Nombre = request.Nombre,
            Descripcion = request.Descripcion,
            CreatedAt = DateTime.UtcNow
        };
        _db.Xxxs.Add(entity);
        await _db.SaveChangesAsync(ct);

        // Audit
        await _audit.LogAsync(new AuditEvent {
            EventName = "RESOURCE_CREATE",
            Severity = "INFO",
            TableName = "xxx",
            RecordKey = entity.Id.ToString()
        }, ct);

        return entity.ToDto();
    }
}
