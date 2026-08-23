using LegalPro.Application.Common.Interfaces;
using Microsoft.AspNetCore.Http;
using System;

namespace LegalPro.Infrastructure.Services;

/// <summary>
/// Implementación de ITenantProvider con ciclo de vida Scoped.
/// Discierne dinámicamente si la consulta proviene de un request HTTP activo (aplicando aislamiento estricto)
/// o de un proceso de fondo/seeder de pruebas (permitiendo acceso sin filtros).
/// </summary>
public class TenantProvider : ITenantProvider
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private Guid? _tenantId;

    public TenantProvider(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid? TenantId
    {
        get
        {
            if (_tenantId.HasValue)
            {
                // Si es Guid.Empty explícito, tratarlo como null (deny-all, no bypass)
                if (_tenantId.Value == Guid.Empty) return null;
                return _tenantId.Value;
            }

            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext == null)
            {
                // Fuera de una petición HTTP (consola, worker de fondo o seeders de tests)
                // Retorna null — ApplicationDbContext decide bypass controlado (solo para migraciones/seeds)
                return null;
            }

            // Petición HTTP activa pero sin tenant establecido — retorna null (deny-all, no Guid.Empty)
            // P0 fix 2026-08-21: nunca retornar Guid.Empty para evitar match accidental con organization_id = '00000000-...'
            return null;
        }
        set
        {
            // Normalizar Guid.Empty a null
            _tenantId = value.HasValue && value.Value == Guid.Empty ? null : value;
        }
    }
}
