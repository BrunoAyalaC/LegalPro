using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LegalPro.Infrastructure.Persistence.Repositories;

/// <summary>
/// Implementación de IOrganizacionRepository usando ApplicationDbContext.
/// Aísla la lógica de acceso a datos del dominio y la capa Application.
/// No llama SaveChangesAsync — esa responsabilidad es del handler (Unit of Work).
/// </summary>
public class OrganizacionRepository : IOrganizacionRepository
{
    private readonly ApplicationDbContext _context;

    public OrganizacionRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <inheritdoc/>
    /// <remarks>
    /// Incluye MembresiaDetallada e Invitaciones para que los métodos de dominio
    /// como AgregarMiembro/RemoverMiembro puedan operar sobre las colecciones cargadas.
    /// </remarks>
    public async Task<Organizacion?> GetByIdAsync(Guid id, CancellationToken ct)
        => await _context.Organizaciones
            .Include(o => o.MembresiaDetallada)
            .Include(o => o.Invitaciones)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

    /// <inheritdoc/>
    public async Task<Organizacion?> GetBySlugAsync(string slug, CancellationToken ct)
        => await _context.Organizaciones
            .FirstOrDefaultAsync(o => o.Slug == slug.ToLowerInvariant(), ct);

    /// <inheritdoc/>
    public async Task<bool> SlugExistsAsync(string slug, CancellationToken ct)
        => await _context.Organizaciones
            .AnyAsync(o => o.Slug == slug.ToLowerInvariant(), ct);

    /// <inheritdoc/>
    /// <remarks>
    /// Solo hace Add al contexto EF. El handler es responsable de llamar SaveChangesAsync
    /// para mantener la transacción atómica con otros cambios del mismo request.
    /// </remarks>
    public async Task AddAsync(Organizacion org, CancellationToken ct)
        => await _context.Organizaciones.AddAsync(org, ct);
}
