using MediatR;
using LegalPro.Application.Common.Behaviours;
using Microsoft.EntityFrameworkCore;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Enums;
using LegalPro.Domain.Exceptions;
using System;
using System.Collections.Generic;
using System.Linq;

namespace LegalPro.Application.Expedientes.Queries;

// ═══════════════════════════════════════════════════════
// QUERY: Estadísticas de expedientes del tenant.
// SRP: Solo lectura — sin side effects.
// Tenant isolation: filtra por OrganizationId del usuario autenticado.
// ═══════════════════════════════════════════════════════

public record MateriaDto(string Name, int Value, string Color);
public record ActivityDto(string Mes, int Nuevos, int Resueltos, int Proceso);

public record GetExpedientesStatsQuery : IRequest<ExpedientesStatsDto>, ITenantRequest
{
    public Guid OrganizationId => Guid.Empty;
}

public record ExpedientesStatsDto(
    int Total,
    int Activos,
    int EnTramite,
    int Archivados,
    int Urgentes,
    int Penales,
    int Civiles,
    int Laborales,
    int Constitucionales,
    int Familia,
    int ContenciosoAdministrativos,
    int EscritosMes,
    int TasaExito,
    List<MateriaDto> Materia,
    List<ActivityDto> Activity
);

public class GetExpedientesStatsQueryHandler : IRequestHandler<GetExpedientesStatsQuery, ExpedientesStatsDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public GetExpedientesStatsQueryHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<ExpedientesStatsDto> Handle(GetExpedientesStatsQuery request, CancellationToken cancellationToken)
    {
        var orgId = _currentUser.OrganizationId
            ?? throw new ForbiddenAccessException("No pertenece a ninguna organización.");

        // Una sola consulta al server: traemos solo las columnas necesarias para las estadísticas.
        var rows = await _context.Expedientes
            .Where(e => e.OrganizationId == orgId)
            .Select(e => new { e.Estado, e.Tipo, e.EsUrgente, e.CreatedAt })
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        // Obtener la cantidad de escritos de este mes
        var startOfMonth = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var escritosMes = await _context.Documentos
            .AsNoTracking()
            .Where(d => d.OrganizationId == orgId && d.Tipo == "escrito" && d.CreatedAt >= startOfMonth)
            .CountAsync(cancellationToken);

        // Obtener la tasa de éxito promedio estimada de la tabla predicciones_judiciales via EF LINQ
        int tasaExito = 0;
        try
        {
            var predicciones = await _context.PrediccionesJudiciales
                .AsNoTracking()
                .Where(p => p.OrganizationId == orgId)
                .Select(p => (double)p.ProbabilidadExito)
                .ToListAsync(cancellationToken);

            if (predicciones.Any())
            {
                tasaExito = (int)Math.Round(predicciones.Average());
            }
        }
        catch
        {
            // Fallback silencioso
            tasaExito = 0;
        }

        int penales = rows.Count(e => e.Tipo == TipoRamaProcesal.Penal);
        int civiles = rows.Count(e => e.Tipo == TipoRamaProcesal.Civil);
        int laborales = rows.Count(e => e.Tipo == TipoRamaProcesal.Laboral);
        int constitucionales = rows.Count(e => e.Tipo == TipoRamaProcesal.Constitucional);
        int familia = rows.Count(e => e.Tipo == TipoRamaProcesal.Familia);
        int contenciosoAdministrativos = rows.Count(e => e.Tipo == TipoRamaProcesal.ContenciosoAdministrativo);

        int totalConMateria = penales + civiles + laborales + constitucionales + familia + contenciosoAdministrativos;
        int GetPercent(int count) => totalConMateria > 0 ? (int)Math.Round((double)count / totalConMateria * 100) : 0;

        var materia = new List<MateriaDto>
        {
            new MateriaDto("Civil", GetPercent(civiles), "#3B82F6"),
            new MateriaDto("Penal", GetPercent(penales), "#EF4444"),
            new MateriaDto("Laboral", GetPercent(laborales), "#F59E0B"),
            new MateriaDto("Constitucional", GetPercent(constitucionales), "#8B5CF6"),
            new MateriaDto("Familia", GetPercent(familia), "#EC4899")
        }.Where(m => m.Value > 0).ToList();

        var mesesNombres = new[] { "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic" };
        var activity = new List<ActivityDto>();

        for (int i = 5; i >= 0; i--)
        {
            var d = DateTime.UtcNow.AddMonths(-i);
            var year = d.Year;
            var monthIdx = d.Month - 1;
            var label = mesesNombres[monthIdx];

            var creadosMes = rows.Where(e => e.CreatedAt.Year == year && e.CreatedAt.Month == (monthIdx + 1)).ToList();

            var nuevos = creadosMes.Count;
            var resueltos = creadosMes.Count(e => e.Estado == EstadoExpediente.Archivado || e.Estado == EstadoExpediente.Sentenciado);
            var proceso = creadosMes.Count(e => e.Estado == EstadoExpediente.Activo || e.Estado == EstadoExpediente.EnTramite);

            activity.Add(new ActivityDto(label, nuevos, resueltos, proceso));
        }

        return new ExpedientesStatsDto(
            Total: rows.Count,
            Activos: rows.Count(e => e.Estado == EstadoExpediente.Activo),
            EnTramite: rows.Count(e => e.Estado == EstadoExpediente.EnTramite),
            Archivados: rows.Count(e => e.Estado == EstadoExpediente.Archivado),
            Urgentes: rows.Count(e => e.EsUrgente),
            Penales: penales,
            Civiles: civiles,
            Laborales: laborales,
            Constitucionales: constitucionales,
            Familia: familia,
            ContenciosoAdministrativos: contenciosoAdministrativos,
            EscritosMes: escritosMes,
            TasaExito: tasaExito,
            Materia: materia,
            Activity: activity
        );
    }
}
