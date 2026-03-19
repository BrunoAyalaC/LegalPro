using LegalPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LegalPro.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Usuario> Usuarios { get; }
    DbSet<Expediente> Expedientes { get; }
    DbSet<LegalPro.Domain.Entities.Simulacion> Simulaciones { get; }
    DbSet<EventoSimulacion> EventosSimulacion { get; }
    DbSet<BaseLegalVectorial> BaseLegalVectorial { get; }
    DbSet<Organizacion> Organizaciones { get; }
    DbSet<MiembroOrganizacion> MiembrosOrganizacion { get; }
    DbSet<InvitacionOrganizacion> InvitacionesOrganizacion { get; }
    DbSet<MensajeChat> MensajesChat { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
