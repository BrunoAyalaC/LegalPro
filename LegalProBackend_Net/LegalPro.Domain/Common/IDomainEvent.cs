using MediatR;

namespace LegalPro.Domain.Common;

/// <summary>
/// Marker interface for domain events.
/// All domain events implement this so MediatR can dispatch them.
/// </summary>
public interface IDomainEvent : INotification
{
    DateTime OccurredOn { get; }
}

/// <summary>
/// Base class for domain events with auto-timestamp.
/// </summary>
public abstract class DomainEvent : IDomainEvent
{
    public DateTime OccurredOn { get; } = DateTime.UtcNow;
}
