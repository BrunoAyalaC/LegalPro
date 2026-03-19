using LegalPro.Domain.Entities;
using LegalPro.Domain.Enums;
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
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(u => u.Especialidad)
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(u => u.EstaActivo)
            .HasDefaultValue(true);

        // Ignore domain events from being persisted
        builder.Ignore(u => u.DomainEvents);
    }
}

public class ExpedienteConfiguration : IEntityTypeConfiguration<Expediente>
{
    public void Configure(EntityTypeBuilder<Expediente> builder)
    {
        builder.ToTable("expedientes");

        builder.HasKey(e => e.Id);
        builder.HasIndex(e => e.Numero).IsUnique();

        builder.Property(e => e.Numero)
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(e => e.Titulo)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(e => e.Tipo)
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(e => e.Estado)
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.HasOne(e => e.Usuario)
            .WithMany(u => u.Expedientes)
            .HasForeignKey(e => e.UsuarioId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Ignore(e => e.DomainEvents);
    }
}

public class SimulacionConfiguration : IEntityTypeConfiguration<Simulacion>
{
    public void Configure(EntityTypeBuilder<Simulacion> builder)
    {
        builder.ToTable("simulaciones");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.RamaDerecho)
            .HasConversion<string>()
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
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(o => o.StorageGbLimit)
            .HasColumnType("numeric(10,2)");

        builder.Property(o => o.Config)
            .HasColumnType("jsonb");

        builder.Property(o => o.Activo).HasDefaultValue(true);

        builder.HasMany(o => o.MembresiaDetallada)
            .WithOne(m => m.Organizacion)
            .HasForeignKey(m => m.OrganizacionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(o => o.Invitaciones)
            .WithOne(i => i.Organizacion)
            .HasForeignKey(i => i.OrganizacionId)
            .OnDelete(DeleteBehavior.Cascade);

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
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(m => m.Activo).HasDefaultValue(true);

        builder.HasOne(m => m.Usuario)
            .WithMany()
            .HasForeignKey(m => m.UsuarioId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Ignore(m => m.DomainEvents);
    }
}

public class InvitacionOrganizacionConfiguration : IEntityTypeConfiguration<InvitacionOrganizacion>
{
    public void Configure(EntityTypeBuilder<InvitacionOrganizacion> builder)
    {
        builder.ToTable("invitaciones_organizacion");

        builder.HasKey(i => i.Id);
        builder.HasIndex(i => i.Token).IsUnique();

        builder.Property(i => i.Email).HasMaxLength(256).IsRequired();
        builder.Property(i => i.Token).HasMaxLength(256).IsRequired();

        builder.Property(i => i.Rol)
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(i => i.EsAceptada).HasDefaultValue(false);

        builder.Ignore(i => i.DomainEvents);
    }
}
