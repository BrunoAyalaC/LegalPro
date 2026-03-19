using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using LegalPro.Application.Common.Interfaces;

namespace LegalPro.Application.Chat.Queries;

/// <summary>
/// Obtiene la lista de sesiones de chat del usuario autenticado.
/// Cada sesión agrupa varios mensajes bajo un mismo SesionId.
/// Permite al cliente mostrar el historial de conversaciones para reanudarlas.
/// </summary>
public class GetSesionesChatQuery : IRequest<SesionesChatDto>
{
    public int Limit { get; set; } = 10;
}

public record SesionesChatDto(IReadOnlyList<SesionResumenDto> Sesiones);

public record SesionResumenDto(
    Guid SesionId,
    string PrimerMensaje,
    string UltimaMensaje,
    DateTime FechaInicio,
    DateTime FechaUltima,
    int TotalMensajes);

public class GetSesionesChatQueryValidator : AbstractValidator<GetSesionesChatQuery>
{
    public GetSesionesChatQueryValidator()
    {
        RuleFor(x => x.Limit)
            .InclusiveBetween(1, 50)
            .WithMessage("El límite debe estar entre 1 y 50.");
    }
}

public class GetSesionesChatHandler : IRequestHandler<GetSesionesChatQuery, SesionesChatDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public GetSesionesChatHandler(IApplicationDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<SesionesChatDto> Handle(GetSesionesChatQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId;
        var orgId = _currentUser.OrganizationId;

        var query = _db.MensajesChat
            .Where(m => m.UsuarioId == userId);

        if (orgId.HasValue)
            query = query.Where(m => m.OrganizationId == orgId);

        // Query 1: metadatos agregados puros — solo funciones traducibles por EF Core 9 (Min, Max, Count).
        var agrupadas = await query
            .GroupBy(m => m.SesionId)
            .Select(g => new
            {
                SesionId = g.Key,
                FechaInicio = g.Min(m => m.CreatedAt),
                FechaUltima = g.Max(m => m.CreatedAt),
                TotalMensajes = g.Count(),
            })
            .OrderByDescending(s => s.FechaUltima)
            .Take(request.Limit)
            .ToListAsync(cancellationToken);

        if (agrupadas.Count == 0)
            return new SesionesChatDto([]);

        var sesionIds = agrupadas.Select(s => s.SesionId).ToList();

        // Query 2: primer mensaje de cada sesión — sin OrderBy dentro de GroupBy.
        var primerosPorSesion = await query
            .Where(m => sesionIds.Contains(m.SesionId))
            .OrderBy(m => m.CreatedAt)
            .Select(m => new { m.SesionId, m.Contenido })
            .ToListAsync(cancellationToken);

        var primerMensajePorSesion = primerosPorSesion
            .GroupBy(m => m.SesionId)
            .ToDictionary(g => g.Key, g => g.First().Contenido);

        // Query 3: último mensaje de cada sesión.
        var ultimosPorSesion = await query
            .Where(m => sesionIds.Contains(m.SesionId))
            .OrderByDescending(m => m.CreatedAt)
            .Select(m => new { m.SesionId, m.Contenido })
            .ToListAsync(cancellationToken);

        var ultimoMensajePorSesion = ultimosPorSesion
            .GroupBy(m => m.SesionId)
            .ToDictionary(g => g.Key, g => g.First().Contenido);

        var result = agrupadas.Select(s =>
        {
            var primero = primerMensajePorSesion.GetValueOrDefault(s.SesionId, "");
            var ultimo = ultimoMensajePorSesion.GetValueOrDefault(s.SesionId, "");
            return new SesionResumenDto(
                s.SesionId,
                primero.Length > 80 ? primero[..80] + "…" : primero,
                ultimo.Length > 80 ? ultimo[..80] + "…" : ultimo,
                s.FechaInicio,
                s.FechaUltima,
                s.TotalMensajes
            );
        }).ToList();

        return new SesionesChatDto(result);
    }
}
