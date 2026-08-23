using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Common;
using LegalPro.Domain.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;

namespace LegalPro.Infrastructure.Persistence;

/// <summary>
/// DbContext with domain event dispatching, auto-audit timestamps, and AuditLog interceptor.
/// </summary>
public class ApplicationDbContext : DbContext, IApplicationDbContext
{
    private readonly ITenantProvider _tenantProvider;
    private readonly ILogger<ApplicationDbContext>? _logger;
    private readonly IHttpContextAccessor? _httpContextAccessor;

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        ITenantProvider? tenantProvider = null,
        ILogger<ApplicationDbContext>? logger = null,
        IHttpContextAccessor? httpContextAccessor = null)
        : base(options)
    {
        _tenantProvider = tenantProvider ?? new DummyTenantProvider();
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
    }

    private class DummyTenantProvider : ITenantProvider
    {
        public Guid? TenantId { get; set; }
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
    // Documentos de expedientes
    public DbSet<Documento> Documentos => Set<Documento>();
    // Predicciones judiciales
    public DbSet<PrediccionJudicial> PrediccionesJudiciales => Set<PrediccionJudicial>();
    // Outbox messages
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

        // Configurar filtros globales de consulta unificados (Multi-Tenancy y Soft Delete)
        foreach (var entityType in builder.Model.GetEntityTypes())
        {
            var isTenant = typeof(ITenantEntity).IsAssignableFrom(entityType.ClrType);
            var isSoftDelete = typeof(ISoftDelete).IsAssignableFrom(entityType.ClrType);

            if (isTenant || isSoftDelete)
            {
                var method = typeof(ApplicationDbContext)
                    .GetMethod(nameof(ConfigureGlobalFilters), System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)
                    ?.MakeGenericMethod(entityType.ClrType);
                method?.Invoke(this, new object[] { builder, isTenant, isSoftDelete });
            }
        }
    }

    private void ConfigureGlobalFilters<TEntity>(ModelBuilder builder, bool isTenant, bool isSoftDelete) where TEntity : class
    {
        // P0 Fix 2026-08-21: HasQueryFilter defectuoso — antes era `HasValue && OrgId==Value` fail-open silencioso
        // Ahora: null = deny-all (sin bypass implícito), Guid.Empty nunca ocurre (TenantProvider normaliza a null)
        // Para procesos de fondo/migraciones sin HttpContext, se permite bypass controlado vía ITenantProvider == null
        // pero solo si no hay HttpContext (ver TenantProvider). En request HTTP sin tenant, deny-all (0 filas).
        if (isTenant && isSoftDelete)
        {
            builder.Entity<TEntity>().HasQueryFilter(e =>
                ((ISoftDelete)e).DeletedAt == null &&
                (_tenantProvider.TenantId.HasValue
                    ? ((ITenantEntity)e).OrganizationId == _tenantProvider.TenantId.Value && _tenantProvider.TenantId.Value != Guid.Empty
                    : false));
        }
        else if (isTenant)
        {
            builder.Entity<TEntity>().HasQueryFilter(e =>
                _tenantProvider.TenantId.HasValue
                    ? ((ITenantEntity)e).OrganizationId == _tenantProvider.TenantId.Value && _tenantProvider.TenantId.Value != Guid.Empty
                    : false);
        }
        else if (isSoftDelete)
        {
            builder.Entity<TEntity>().HasQueryFilter(e =>
                ((ISoftDelete)e).DeletedAt == null);
        }
    }

    /// <summary>
    /// AuditLog automático: se graba en tabla audit_log quién cambió qué entidad.
    /// Solo registra entidades que heredan de BaseEntity o BaseGuidEntity.
    /// </summary>
    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // 1. Obtener eventos de dominio de las entidades ANTES de guardar
        var domainEvents = ChangeTracker.Entries()
            .Select(e => e.Entity)
            .Select(entity =>
            {
                if (entity is BaseEntity baseEntity)
                {
                    var events = baseEntity.DomainEvents.ToList();
                    baseEntity.ClearDomainEvents();
                    return events;
                }
                if (entity is BaseGuidEntity baseGuidEntity)
                {
                    var events = baseGuidEntity.DomainEvents.ToList();
                    baseGuidEntity.ClearDomainEvents();
                    return events;
                }
                return new List<IDomainEvent>();
            })
            .SelectMany(x => x)
            .ToList();

        // 2. Convertir a OutboxMessages e insertarlos
        if (domainEvents.Any())
        {
            var outboxMessages = domainEvents.Select(domainEvent => new OutboxMessage(
                Guid.NewGuid(),
                domainEvent.GetType().FullName ?? domainEvent.GetType().Name,
                System.Text.Json.JsonSerializer.Serialize(domainEvent, domainEvent.GetType()),
                DateTime.UtcNow
            )).ToList();

            await OutboxMessages.AddRangeAsync(outboxMessages, cancellationToken);
        }

        // Capturar entradas modificadas ANTES de guardar
        var auditEntries = ChangeTracker.Entries()
            .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted
                        && (e.Entity is BaseEntity or BaseGuidEntity))
            .Select(e => new
            {
                TableName = e.Metadata.GetTableName() ?? e.Entity.GetType().Name,
                Action = MapStateToOperacion(e.State),
                Keys = string.Join(',', e.Properties
                    .Where(p => p.Metadata.IsPrimaryKey())
                    .Select(p => p.CurrentValue?.ToString() ?? "")),
            })
            .ToList();

        var result = await base.SaveChangesAsync(cancellationToken);

        // Persistir audit records — FIX P0 2026-08-21: unifica drift audit_log
        // init.sql:503-515 exige organization_id NOT NULL + columnas tabla/operacion/registro_id
        // + payload JSONB + correlation_id. Antes insertaba table_name/action/record_key
        // que NO existen en init.sql y omitía organization_id → INSERT fallaba y el
        // catch{} vacío lo tragaba silenciosamente (audit trail roto).
        //
        // HOTFIX P0-B 2026-08-21:
        //   1. operacion mapeada a 'INSERT'/'UPDATE'/'DELETE' (CHECK constraint en
        //      multitenancy_setup.sql:156 rechazaba 'Added'/'Modified'/'Deleted').
        //   2. INSERT best-effort con LogError (patrón AuditLoggerService.LogAsync) —
        //      un fallo de audit NUNCA debe tumbar el request de negocio.
        //   3. correlation_id toma X-Correlation-ID del HttpContext si existe.
        if (auditEntries.Count > 0)
        {
            var tenantId = _tenantProvider.TenantId;
            // Si no hay tenant activo (seed, test, migración), no se audita — pero no se traga error silencioso
            if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
            {
                // No hay contexto multi-tenant: omitir audit con aviso en logs (no catch vacío)
                System.Diagnostics.Trace.WriteLine($"[AuditLog] TenantId no disponible — se omite audit para {auditEntries.Count} entradas (tablas: {string.Join(',', auditEntries.Select(a => a.TableName))})");
            }
            else
            {
                var correlationId = ResolveCorrelationId();

                foreach (var entry in auditEntries)
                {
                    // Columnas alineadas con init.sql + supabase-schema + unified migration:
                    // organization_id, tabla, operacion, registro_id, payload (JSONB), correlation_id, created_at
                    // El trigger fn_audit_log_sync_aliases sincroniza aliases (table_name, record_key, etc.)
                    var payloadJson = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        table = entry.TableName,
                        action = entry.Action,
                        keys = entry.Keys,
                        tenant = tenantId.Value
                    });
                    try
                    {
                        await Database.ExecuteSqlRawAsync(
                            "INSERT INTO audit_log (organization_id, tabla, operacion, registro_id, payload, correlation_id, created_at) " +
                            "VALUES ({0}, {1}, {2}, {3}, {4}::jsonb, {5}::uuid, {6})",
                            tenantId.Value, entry.TableName, entry.Action, entry.Keys, payloadJson, correlationId, DateTime.UtcNow,
                            cancellationToken);
                    }
                    catch (Exception ex)
                    {
                        // Best-effort (patrón AuditLoggerService.cs:34-44): el fallo de auditoría
                        // se registra pero NO propaga — la mutación de negocio ya persistió.
                        _logger?.LogError(ex,
                            "[AUDIT] Error persisting audit row to database. " +
                            "Table={Table} Operation={Operation} Tenant={TenantId}. " +
                            "Business change was already committed.",
                            entry.TableName, entry.Action, tenantId.Value);
                    }
                }
            }
        }

        return result;
    }

    /// <summary>
    /// HOTFIX P0-B: el CHECK constraint de audit_log.operacion solo acepta
    /// 'INSERT' | 'UPDATE' | 'DELETE' (multitenancy_setup.sql:156). Los nombres
    /// internos de EF ('Added'/'Modified'/'Deleted') violaban la constraint.
    /// </summary>
    private static string MapStateToOperacion(EntityState state) => state switch
    {
        EntityState.Added => "INSERT",
        EntityState.Modified => "UPDATE",
        EntityState.Deleted => "DELETE",
        _ => state.ToString(),
    };

    /// <summary>
    /// HOTFIX P0-B (bonus): reutiliza X-Correlation-ID del request HTTP para trazabilidad
    /// end-to-end (log ↔ audit_log). Fallback a Guid nuevo si el header ausente/no-Guid
    /// (la columna es uuid → un valor arbitrario rompería el INSERT).
    /// </summary>
    private Guid ResolveCorrelationId()
    {
        var header = _httpContextAccessor?.HttpContext?
            .Request.Headers["X-Correlation-ID"].FirstOrDefault();

        return Guid.TryParse(header, out var parsed) ? parsed : Guid.NewGuid();
    }
}
