using LegalPro.Domain.Entities;
using LegalPro.Domain.Enums;
using LegalPro.Infrastructure.Persistence.Conversions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LegalPro.Infrastructure.Persistence.Configurations;

/// <summary>
/// Fluent API configuration for Usuario entity.
/// Separates DB schema concerns from the domain entity.
/// </summary>
public class UsuarioConfiguration : IEntityTypeConfiguration<Usuario>
{
    public void Configure(EntityTypeBuilder<Usuario> builder)
    {
        builder.ToTable("usuarios");

        builder.HasKey(u => u.Id);
        builder.HasIndex(u => u.Email).IsUnique();
        // FIX P2 perf 2026-08-21: índice para HasQueryFilter por OrganizationId (tenant isolation → evita Seq Scan)
        builder.HasIndex(u => u.OrganizationId).HasDatabaseName("ix_usuarios_organization_id");

        builder.Property(u => u.NombreCompleto)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(u => u.Email)
            .HasMaxLength(256)
            .IsRequired();

        builder.Property(u => u.PasswordHash)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(u => u.Rol)
            .HasConversion(
                v => v.ToString().ToUpperInvariant(),
                v => Enum.Parse<RolUsuario>(v, true))
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(u => u.Especialidad)
            .HasConversion(
                v => v.ToString().ToUpperInvariant(),
                v => Enum.Parse<EspecialidadDerecho>(v, true))
            .HasMaxLength(50);

        builder.Property(u => u.EstaActivo)
            .HasDefaultValue(true);

        // FIX 2026-08-21 deleted_at drift: .NET query filter usa ISoftDelete.DeletedAt
        // pero DB tenía eliminado_en. Shadow property mapea a deleted_at para soft-delete.
        // Incluso si Usuario no implementa ISoftDelete, este mapping permite que el
        // filtro global de ApplicationDbContext ((ISoftDelete)e).DeletedAt funcione si se agrega la interfaz en el futuro.
        builder.Property<DateTime?>("DeletedAt")
            .HasColumnName("deleted_at");

        // Ignore domain events from being persisted
        builder.Ignore(u => u.DomainEvents);

        builder.HasOne(u => u.Organizacion)
            .WithMany(o => o.Miembros)
            .HasForeignKey(u => u.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ExpedienteConfiguration : IEntityTypeConfiguration<Expediente>
{
    public void Configure(EntityTypeBuilder<Expediente> builder)
    {
        builder.ToTable("expedientes");

        builder.HasKey(e => e.Id);
        builder.HasIndex(e => e.Numero).IsUnique();
        // FIX P2 perf 2026-08-21: índice para HasQueryFilter OrganizationId (evita Seq Scan en cada query tenant).
        // El composite ILIKE(titulo, numero) usa índices GIN trigram separados creados por migración pg_trgm (no se declaran aquí vía Fluent API para evitar operador gin_trgm_ops en snapshot).
        builder.HasIndex(e => e.OrganizationId).HasDatabaseName("ix_expedientes_organization_id");
        builder.HasIndex(e => e.UsuarioId).HasDatabaseName("ix_expedientes_usuario_id");

        builder.Property(e => e.Numero)
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(e => e.Titulo)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(e => e.Tipo)
            .HasConversion(
                v => NodeExpedienteMappings.TipoToDb(v),
                v => NodeExpedienteMappings.TipoFromDb(v))
            .HasMaxLength(50);

        builder.Property(e => e.Estado)
            .HasConversion(
                v => NodeExpedienteMappings.EstadoToDb(v),
                v => NodeExpedienteMappings.EstadoFromDb(v))
            .HasMaxLength(50);

        builder.HasOne(e => e.Usuario)
            .WithMany(u => u.Expedientes)
            .HasForeignKey(e => e.UsuarioId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.Organizacion)
            .WithMany()
            .HasForeignKey(e => e.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        // FIX 2026-08-21 deleted_at drift: Expediente implementa ISoftDelete
        builder.Property(e => e.DeletedAt)
            .HasColumnName("deleted_at");

        builder.Ignore(e => e.DomainEvents);
    }
}

public class SimulacionConfiguration : IEntityTypeConfiguration<Simulacion>
{
    public void Configure(EntityTypeBuilder<Simulacion> builder)
    {
        builder.ToTable("simulaciones");

        builder.HasKey(s => s.Id);

        // FIX P2 perf 2026-08-21: índice para HasQueryFilter OrganizationId (tenant isolation)
        builder.HasIndex(s => s.OrganizationId).HasDatabaseName("ix_simulaciones_organization_id");

        builder.Property(s => s.RamaDerecho)
            .HasConversion(
                v => v.ToString().ToUpperInvariant(),
                v => Enum.Parse<TipoRamaProcesal>(v, true))
            .HasMaxLength(50);

        builder.Property(s => s.RolUsuario)
            .HasMaxLength(50);

        builder.Property(s => s.DificultadModificador)
            .HasMaxLength(100);

        builder.Property(s => s.ContextoSintetico)
            .HasColumnType("text");

        builder.HasOne(s => s.Usuario)
            .WithMany(u => u.Simulaciones)
            .HasForeignKey(s => s.UsuarioId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(s => s.Eventos)
            .WithOne(e => e.Simulacion)
            .HasForeignKey(e => e.SimulacionId);

        builder.Ignore(s => s.DomainEvents);
    }
}

public class EventoSimulacionConfiguration : IEntityTypeConfiguration<EventoSimulacion>
{
    public void Configure(EntityTypeBuilder<EventoSimulacion> builder)
    {
        builder.ToTable("eventos_simulacion");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Emisor).HasMaxLength(50);
        builder.Property(e => e.Mensaje).HasColumnType("text");
        builder.Property(e => e.LeyesInvocadas).HasColumnType("text");

        builder.Ignore(e => e.DomainEvents);
    }
}

public class BaseLegalVectorialConfiguration : IEntityTypeConfiguration<BaseLegalVectorial>
{
    public void Configure(EntityTypeBuilder<BaseLegalVectorial> builder)
    {
        builder.ToTable("base_legal_vectorial");

        builder.HasKey(b => b.Id);

        builder.Property(b => b.CodigoNormativa).HasMaxLength(100);
        builder.Property(b => b.Articulo).HasMaxLength(50);
        builder.Property(b => b.TextoLiteral).HasColumnType("text");

        builder.Ignore(b => b.DomainEvents);
    }
}

// ─── MULTI-TENANT CONFIGURATIONS ─────────────────────────────────────────────

public class OrganizacionConfiguration : IEntityTypeConfiguration<Organizacion>
{
    public void Configure(EntityTypeBuilder<Organizacion> builder)
    {
        builder.ToTable("organizaciones");

        builder.HasKey(o => o.Id);
        builder.HasIndex(o => o.Slug).IsUnique();

        builder.Property(o => o.Nombre).HasMaxLength(200).IsRequired();
        builder.Property(o => o.Slug).HasMaxLength(100).IsRequired();

        builder.Property(o => o.Plan)
            .HasConversion(
                v => v.ToString().ToLowerInvariant(),
                v => Enum.Parse<PlanTipo>(v, true))
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(o => o.StorageGbLimit)
            .HasColumnType("numeric(10,2)");

        builder.Property(o => o.Config)
            .HasColumnType("jsonb");

        builder.Property(o => o.Activo).HasDefaultValue(true);

        // FIX 2026-08-21 deleted_at drift: organizaciones ahora tiene deleted_at (Owner soft-delete)
        builder.Property<DateTime?>("DeletedAt")
            .HasColumnName("deleted_at");

        // Las relaciones HasMany().WithOne() con MiembroOrganizacion e InvitacionOrganizacion
        // están definidas en las configuraciones de esas entidades (lado que posee la FK),
        // para mantener una única fuente de verdad y evitar warnings de EF Core por
        // relación duplicada (esta convención se sigue también en OrganizacionConfiguration).

        builder.Ignore(o => o.Miembros);
        builder.Ignore(o => o.DomainEvents);
    }
}

public class MiembroOrganizacionConfiguration : IEntityTypeConfiguration<MiembroOrganizacion>
{
    public void Configure(EntityTypeBuilder<MiembroOrganizacion> builder)
    {
        builder.ToTable("miembros_organizacion");

        builder.HasKey(m => m.Id);

        // Un usuario solo puede pertenecer una vez (activo) a una organización
        builder.HasIndex(m => new { m.OrganizacionId, m.UsuarioId }).IsUnique();

        builder.Property(m => m.Rol)
            .HasConversion(
                v => v.ToString().ToUpperInvariant(),
                v => Enum.Parse<RolMiembro>(v, true))
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(m => m.Activo).HasDefaultValue(true);

        // P0 Fix 2026-08-21: remover shadow property duplicada "OrganizationId" -> "organizacion_id"
        // Antes duplicaba la columna con la FK OrganizacionId (ambas a organizacion_id).
        // Ahora se mapea directamente la propiedad real OrganizacionId a la columna, sin shadow.
        builder.Property(m => m.OrganizacionId)
            .HasColumnName("organizacion_id")
            .IsRequired();

        builder.HasOne(m => m.Organizacion)
            .WithMany(o => o.MembresiaDetallada)
            .HasForeignKey(m => m.OrganizacionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(m => m.Usuario)
            .WithMany()
            .HasForeignKey(m => m.UsuarioId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Ignore(m => m.DomainEvents);
    }
}

public class PrediccionJudicialConfiguration : IEntityTypeConfiguration<PrediccionJudicial>
{
    public void Configure(EntityTypeBuilder<PrediccionJudicial> builder)
    {
        builder.ToTable("predicciones_judiciales");
        builder.HasKey(p => p.Id);
        // FIX P2 perf 2026-08-21: índice para HasQueryFilter OrganizationId (tenant isolation)
        builder.HasIndex(p => p.OrganizationId).HasDatabaseName("ix_predicciones_organization_id");
        builder.Property(p => p.ProbabilidadExito).HasColumnName("probabilidad_exito");
    }
}

public class InvitacionOrganizacionConfiguration : IEntityTypeConfiguration<InvitacionOrganizacion>
{
    public void Configure(EntityTypeBuilder<InvitacionOrganizacion> builder)
    {
        builder.ToTable("invitaciones_organizacion");

        builder.HasKey(i => i.Id);
        // FIX P2 perf: OrganizationId ya tiene índice via HasIndex OrganizacionId en FK (OrganisationId -> OrganizacionId), explícito para HasQueryFilter
        builder.HasIndex(i => i.OrganizacionId).HasDatabaseName("ix_invitaciones_organizacion_org_id");
        builder.HasIndex(i => i.Token).IsUnique();

        builder.Property(i => i.Email).HasMaxLength(256).IsRequired();
        builder.Property(i => i.Token).HasMaxLength(256).IsRequired();

        builder.Property(i => i.Rol)
            .HasConversion(
                v => v.ToString().ToUpperInvariant(),
                v => Enum.Parse<RolUsuario>(v, true))
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(i => i.EsAceptada).HasDefaultValue(false);

        // P0 Fix 2026-08-21: remover shadow property duplicada — usar columna directa
        builder.Property(i => i.OrganizacionId)
            .HasColumnName("organizacion_id")
            .IsRequired();

        builder.HasOne(i => i.Organizacion)
            .WithMany(o => o.Invitaciones)
            .HasForeignKey(i => i.OrganizacionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Ignore(i => i.DomainEvents);
    }
}
