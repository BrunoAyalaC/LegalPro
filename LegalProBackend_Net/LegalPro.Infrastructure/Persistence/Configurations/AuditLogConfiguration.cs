using LegalPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LegalPro.Infrastructure.Persistence.Configurations;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("audit_logs");

        // BIGSERIAL para alto volumen de eventos de seguridad
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).UseIdentityColumn();

        builder.Property(a => a.EventType)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(a => a.Severity)
            .IsRequired()
            .HasMaxLength(10);

        builder.Property(a => a.Timestamp)
            .IsRequired();

        builder.Property(a => a.IpAddress)
            .HasMaxLength(45); // Soporta IPv6

        builder.Property(a => a.UserAgent)
            .HasMaxLength(512);

        builder.Property(a => a.ResourceType)
            .HasMaxLength(50);

        builder.Property(a => a.ResourceId)
            .HasMaxLength(100);

        builder.Property(a => a.Action)
            .HasMaxLength(100);

        builder.Property(a => a.Detail)
            .HasMaxLength(1000);

        builder.Property(a => a.RequestId)
            .HasMaxLength(36);

        // Metadata se guarda como JSON string
        builder.Property(a => a.Metadata)
            .HasColumnType("text");

        // Índices para consultas de auditoría eficientes
        builder.HasIndex(a => a.Timestamp);
        builder.HasIndex(a => a.UserId);
        builder.HasIndex(a => a.EventType);
        builder.HasIndex(a => a.Severity)
            .HasFilter("\"severity\" IN ('WARN', 'CRITICAL')");
    }
}
