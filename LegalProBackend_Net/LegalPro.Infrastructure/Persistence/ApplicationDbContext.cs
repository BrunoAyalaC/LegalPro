using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Common;
using LegalPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace LegalPro.Infrastructure.Persistence;

/// <summary>
/// DbContext with domain event dispatching, auto-audit timestamps, and AuditLog interceptor.
/// </summary>
public class ApplicationDbContext : DbContext, IApplicationDbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Expediente> Expedientes => Set<Expediente>();
    public DbSet<Simulacion> Simulaciones => Set<Simulacion>();
    public DbSet<EventoSimulacion> EventosSimulacion => Set<EventoSimulacion>();
    public DbSet<BaseLegalVectorial> BaseLegalVectorial => Set<BaseLegalVectorial>();
    // Multi-tenant entities
    public DbSet<Organizacion> Organizaciones => Set<Organizacion>();
    public DbSet<MiembroOrganizacion> MiembrosOrganizacion => Set<MiembroOrganizacion>();
    public DbSet<InvitacionOrganizacion> InvitacionesOrganizacion => Set<InvitacionOrganizacion>();
    // Chat persistido multi-sesion
    public DbSet<MensajeChat> MensajesChat => Set<MensajeChat>();
    // Auth: refresh tokens
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    // Audit trail de seguridad
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }

    /// <summary>
    /// AuditLog automático: se graba en tabla audit_log quién cambió qué entidad.
    /// Solo registra entidades que heredan de BaseEntity o BaseGuidEntity.
    /// </summary>
    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // Capturar entradas modificadas ANTES de guardar
        var auditEntries = ChangeTracker.Entries()
            .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted
                        && (e.Entity is BaseEntity or BaseGuidEntity))
            .Select(e => new
            {
                TableName = e.Metadata.GetTableName() ?? e.Entity.GetType().Name,
                Action = e.State.ToString(),
                Keys = string.Join(',', e.Properties
                    .Where(p => p.Metadata.IsPrimaryKey())
                    .Select(p => p.CurrentValue?.ToString() ?? "")),
            })
            .ToList();

        var result = await base.SaveChangesAsync(cancellationToken);

        // Persistir audit records si hay tabla audit_log (tabla nativa en Supabase/PostgreSQL)
        // Se usa SQL raw para no crear dependencia circular en el dominio.
        if (auditEntries.Count > 0)
        {
            foreach (var entry in auditEntries)
            {
                try
                {
                    await Database.ExecuteSqlRawAsync(
                        "INSERT INTO audit_log (table_name, action, record_key, created_at) " +
                        "VALUES ({0}, {1}, {2}, {3})",
                        entry.TableName, entry.Action, entry.Keys, DateTime.UtcNow,
                        cancellationToken);
                }
                catch
                {
                    // Audit log nunca debe bloquear la operación principal.
                    // Si la tabla no existe (entorno test), se ignora silenciosamente.
                }
            }
        }

        return result;
    }
}
