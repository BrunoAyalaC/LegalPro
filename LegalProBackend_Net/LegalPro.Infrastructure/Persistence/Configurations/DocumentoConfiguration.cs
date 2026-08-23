using LegalPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LegalPro.Infrastructure.Persistence.Configurations;

public class DocumentoConfiguration : IEntityTypeConfiguration<Documento>
{
    public void Configure(EntityTypeBuilder<Documento> builder)
    {
        builder.ToTable("documentos");

        builder.HasKey(d => d.Id);

        builder.Property(d => d.Titulo)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(d => d.Contenido)
            .HasColumnType("text");

        builder.Property(d => d.Url)
            .HasMaxLength(2000);

        builder.Property(d => d.Tipo)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(d => d.ExpedienteId)
            .IsRequired();

        builder.Property(d => d.OrganizationId)
            .IsRequired();

        builder.Property(d => d.CreatedAt)
            .IsRequired()
            .HasDefaultValueSql("now()");

        builder.HasIndex(d => new { d.ExpedienteId, d.OrganizationId })
            .HasDatabaseName("ix_documentos_expediente_org");

        builder.HasIndex(d => d.OrganizationId)
            .HasDatabaseName("ix_documentos_org");

        builder.HasOne(d => d.Organizacion)
            .WithMany()
            .HasForeignKey(d => d.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
