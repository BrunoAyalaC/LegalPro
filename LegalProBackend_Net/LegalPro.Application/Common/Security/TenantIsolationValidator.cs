using Microsoft.Extensions.Logging;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Application.Common.Security;

/// <summary>
/// Validates that a resource belongs to the caller's organization.
/// A01 - Broken Access Control: prevents cross-tenant data access.
/// Inject via DI in any Command/Query Handler that accesses tenant-scoped resources.
/// </summary>
public class TenantIsolationValidator
{
    private readonly ILogger<TenantIsolationValidator> _logger;

    public TenantIsolationValidator(ILogger<TenantIsolationValidator> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Validates that the resource's organization matches the caller's organization.
    /// Throws <see cref="TenantAccessViolationException"/> and logs a SECURITY_WARNING if not.
    /// </summary>
    /// <param name="resourceOrgId">Organization ID of the resource being accessed.</param>
    /// <param name="callerOrgId">Organization ID extracted from the caller's JWT.</param>
    /// <param name="callerUserId">User ID for audit log context.</param>
    /// <param name="resourceType">Resource type name for log context (e.g. "Expediente").</param>
    public void ValidateResourceBelongsToTenant(
        Guid? resourceOrgId,
        Guid? callerOrgId,
        Guid callerUserId,
        string resourceType = "Recurso")
    {
        if (callerOrgId == null)
        {
            _logger.LogWarning(
                "[SECURITY_WARNING] Usuario {UserId} sin organization_id intentó acceder a {ResourceType}. " +
                "Timestamp: {Timestamp} UTC",
                callerUserId, resourceType, DateTime.UtcNow);
            throw new TenantAccessViolationException();
        }

        if (resourceOrgId == null || resourceOrgId != callerOrgId)
        {
            _logger.LogWarning(
                "[SECURITY_WARNING] Cross-tenant access attempt. " +
                "Caller: UserId={UserId} OrgId={CallerOrgId} | " +
                "Resource: Type={ResourceType} OrgId={ResourceOrgId} | " +
                "Timestamp: {Timestamp} UTC",
                callerUserId, callerOrgId, resourceType, resourceOrgId, DateTime.UtcNow);

            throw new TenantAccessViolationException(
                requestedOrgId: resourceOrgId ?? Guid.Empty,
                callerOrgId: callerOrgId.Value);
        }
    }

    /// <summary>
    /// Returns true if the resource belongs to the tenant, false otherwise (sin throw).
    /// Use when you need conditional logic instead of fail-fast.
    /// IMPORTANT: still logs the warning on mismatch.
    /// </summary>
    public bool ResourceBelongsToTenant(
        Guid? resourceOrgId,
        Guid? callerOrgId,
        Guid callerUserId,
        string resourceType = "Recurso")
    {
        if (callerOrgId == null || resourceOrgId == null || resourceOrgId != callerOrgId)
        {
            _logger.LogWarning(
                "[SECURITY_WARNING] Cross-tenant check failed (soft). " +
                "Caller: UserId={UserId} OrgId={CallerOrgId} | " +
                "Resource: Type={ResourceType} OrgId={ResourceOrgId} | " +
                "Timestamp: {Timestamp} UTC",
                callerUserId, callerOrgId, resourceType, resourceOrgId, DateTime.UtcNow);
            return false;
        }

        return true;
    }
}
