using LegalPro.Domain.Entities;

namespace LegalPro.Application.Common.Interfaces;

/// <summary>
/// Repositorio dedicado para Organizacion.
/// Separado de IApplicationDbContext para cumplir ISP y facilitar mocking.
/// </summary>
public interface IOrganizacionRepository
{
    Task<Organizacion?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<Organizacion?> GetBySlugAsync(string slug, CancellationToken ct);
    Task<bool> SlugExistsAsync(string slug, CancellationToken ct);
    Task AddAsync(Organizacion org, CancellationToken ct);
}
