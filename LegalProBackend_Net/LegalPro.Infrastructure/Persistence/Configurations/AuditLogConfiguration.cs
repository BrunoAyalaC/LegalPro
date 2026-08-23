using LegalPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LegalPro.Infrastructure.Persistence.Configurations;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("audit_log");

        // BIGSERIAL para alto volumen de eventos de seguridad
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).UseIdentityColumn();

        // P0 Fix 2026-08-21: alineación audit_log drift — init.sql:503-515 exige
        // organization_id NOT NULL + tabla/operacion/registro_id + payload JSONB + correlation_id + created_at
        // Antes EF mapeaba columnas genéricas (EventType, ResourceType, etc.) sin organization_id,
        // causando INSERT fallido tragado por catch vacío. Ahora se mapean aliases compatibles:
        builder.Property(a => a.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired(false); // nullable para compatibilidad con triggers fn_audit_log_sync_aliases

        builder.Property(a => a.EventType)
            .HasColumnName("event_type")
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(a => a.Severity)
            .IsRequired()
            .HasMaxLength(10);

        builder.Property(a => a.Timestamp)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(a => a.IpAddress)
            .HasColumnName("ip_address")
            .HasMaxLength(45); // Soporta IPv6

        builder.Property(a => a.UserAgent)
            .HasColumnName("user_agent")
            .HasMaxLength(512);

        builder.Property(a => a.ResourceType)
            .HasColumnName("tabla")
            .HasMaxLength(50);

        builder.Property(a => a.ResourceId)
            .HasColumnName("registro_id")
            .HasMaxLength(100);

        builder.Property(a => a.Action)
            .HasColumnName("operacion")
            .HasMaxLength(100);

        builder.Property(a => a.Detail)
            .HasMaxLength(1000);

        builder.Property(a => a.RequestId)
            .HasColumnName("correlation_id")
            .HasMaxLength(36);

        // Metadata se guarda como JSON string -> columna payload JSONB
        builder.Property(a => a.Metadata)
            .HasColumnName("payload")
            .HasColumnType("jsonb");

        // Índices para consultas de auditoría eficientes
        builder.HasIndex(a => a.Timestamp);
        builder.HasIndex(a => a.UserId);
        builder.HasIndex(a => a.EventType);
        builder.HasIndex(a => a.OrganizationId)
            .HasDatabaseName("ix_audit_log_organization_id");
        builder.HasIndex(a => a.Severity)
            .HasFilter("\"severity\" IN ('WARN', 'CRITICAL')");
    }
}
