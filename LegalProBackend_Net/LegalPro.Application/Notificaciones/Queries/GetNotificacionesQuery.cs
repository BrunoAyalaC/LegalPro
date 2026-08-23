using MediatR;
using LegalPro.Application.Common.Behaviours;
using Microsoft.EntityFrameworkCore;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Application.Notificaciones.Queries;

// ═══════════════════════════════════════════════════════
// QUERY: Retorna notificaciones calculadas a partir de
// los expedientes del usuario autenticado.
// 
// Notas:
//   - Urgentes: expedientes marcados como EsUrgente.
//   - Plazos próximos: NO se retornan porque el modelo
//     Expediente no tiene fecha de vencimiento. Se respeta
//     la regla "no inventar datos" → array vacío para esa
//     categoría.
// ═══════════════════════════════════════════════════════

public class GetNotificacionesQuery : IRequest<NotificacionesResult>, ITenantRequest
{
    public Guid OrganizationId => Guid.Empty;
}

public record NotificacionDto(
    Guid Id,
    string Tipo,        // "urgente" | "plazo_proximo"
    string Titulo,
    string Mensaje,
    Guid? ExpedienteId,
    DateTime Fecha,
    bool Leida);

public record NotificacionesResult(
    IReadOnlyList<NotificacionDto> Notificaciones);

public class GetNotificacionesQueryHandler : IRequestHandler<GetNotificacionesQuery, NotificacionesResult>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public GetNotificacionesQueryHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<NotificacionesResult> Handle(GetNotificacionesQuery request, CancellationToken cancellationToken)
    {
        var orgId = _currentUser.OrganizationId
            ?? throw new ForbiddenAccessException("No pertenece a ninguna organización.");

        var notificaciones = new List<NotificacionDto>();

        // 1. Expedientes urgentes
        var urgentes = await _context.Expedientes
            .AsNoTracking()
            .Where(e => e.OrganizationId == orgId && e.EsUrgente && e.Estado != Domain.Enums.EstadoExpediente.Archivado)
            .OrderByDescending(e => e.UpdatedAt)
            .Select(e => new NotificacionDto(
                Guid.NewGuid(),
                "urgente",
                $"Expediente urgente: {e.Titulo}",
                $"El expediente {e.Numero} está marcado como urgente.",
                e.Id,
                e.UpdatedAt ?? e.CreatedAt,
                false))
            .ToListAsync(cancellationToken);

        notificaciones.AddRange(urgentes);

        // 2. Plazos próximos (próximos 7 días)
        // Como el modelo Expediente NO tiene fecha de vencimiento, no se generan
        // notificaciones de plazo. Se retorna array vacío para esa categoría.
        // Si en el futuro se agrega un campo FechaVencimiento o una entidad Plazo,
        // aquí se debe consultar esa fuente de verdad.

        return new NotificacionesResult(notificaciones);
    }
}
