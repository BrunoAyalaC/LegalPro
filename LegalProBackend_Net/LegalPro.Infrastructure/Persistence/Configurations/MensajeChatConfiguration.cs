using LegalPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LegalPro.Infrastructure.Persistence.Configurations;

public class MensajeChatConfiguration : IEntityTypeConfiguration<MensajeChat>
{
    public void Configure(EntityTypeBuilder<MensajeChat> builder)
    {
        builder.ToTable("mensajes_chat");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.UsuarioId)
            .IsRequired();

        builder.Property(m => m.Rol)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(m => m.Contenido)
            .IsRequired()
            .HasColumnType("text");

        builder.Property(m => m.SesionId)
            .IsRequired();

        builder.Property(m => m.CreatedAt)
            .IsRequired()
            .HasDefaultValueSql("now()");

        builder.HasIndex(m => new { m.UsuarioId, m.SesionId })
            .HasDatabaseName("ix_mensajes_chat_usuario_sesion");

        builder.HasIndex(m => new { m.OrganizationId, m.SesionId })
            .HasDatabaseName("ix_mensajes_chat_org_sesion");
    }
}
