using LegalPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LegalPro.Infrastructure.Persistence.Configurations;

public class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessage>
{
    public void Configure(EntityTypeBuilder<OutboxMessage> builder)
    {
        builder.ToTable("outbox_messages");

        builder.HasKey(o => o.Id);

        builder.Property(o => o.Type)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(o => o.Content)
            .IsRequired()
            .HasColumnType("text");

        builder.Property(o => o.OccurredOnUtc)
            .IsRequired();

        builder.Property(o => o.ProcessedOnUtc);

        builder.Property(o => o.Error)
            .HasColumnType("text");

        builder.Property(o => o.RetryCount)
            .IsRequired()
            .HasDefaultValue(0);

        builder.HasIndex(o => o.ProcessedOnUtc);

        builder.HasIndex(o => new { o.ProcessedOnUtc, o.RetryCount })
            .HasDatabaseName("ix_outbox_messages_pending")
            .HasFilter("\"processed_on_utc\" IS NULL AND \"retry_count\" < 3");
    }
}
