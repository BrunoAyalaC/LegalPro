using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using LegalPro.Application.Common.Interfaces;

namespace LegalPro.Application.Chat.Queries;

/// <summary>
/// Obtiene el historial de mensajes de una sesión de chat específica.
/// Requiere autenticación — solo devuelve mensajes del usuario autenticado.
/// </summary>
public class GetHistorialChatQuery : IRequest<HistorialChatDto>
{
    public Guid SesionId { get; set; }
    public int? Limit { get; set; } = 50;
}

public record HistorialChatDto(
    IReadOnlyList<MensajeChatDto> Mensajes,
    Guid SesionId,
    int Total);

public record MensajeChatDto(
    string Rol,
    string Contenido,
    DateTime Timestamp);

public class GetHistorialChatQueryValidator : AbstractValidator<GetHistorialChatQuery>
{
    public GetHistorialChatQueryValidator()
    {
        RuleFor(x => x.SesionId).NotEmpty().WithMessage("SesionId requerido.");
        RuleFor(x => x.Limit)
            .InclusiveBetween(1, 200)
            .When(x => x.Limit.HasValue)
            .WithMessage("El límite debe estar entre 1 y 200.");
    }
}

public class GetHistorialChatHandler : IRequestHandler<GetHistorialChatQuery, HistorialChatDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public GetHistorialChatHandler(IApplicationDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<HistorialChatDto> Handle(GetHistorialChatQuery request, CancellationToken cancellationToken)
    {
        var limit = request.Limit ?? 50;
        var userId = _currentUser.UserId;
        var orgId = _currentUser.OrganizationId;

        var query = _db.MensajesChat
            .Where(m => m.SesionId == request.SesionId && m.UsuarioId == userId);

        // Aislamiento multi-tenant adicional por organización si aplica
        if (orgId.HasValue)
            query = query.Where(m => m.OrganizationId == orgId);

        var total = await query.CountAsync(cancellationToken);

        var mensajes = await query
            .OrderBy(m => m.CreatedAt)
            .TakeLast(limit)
            .Select(m => new MensajeChatDto(m.Rol, m.Contenido, m.CreatedAt))
            .ToListAsync(cancellationToken);

        return new HistorialChatDto(mensajes, request.SesionId, total);
    }
}
