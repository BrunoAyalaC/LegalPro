using LegalPro.Application.Common.Interfaces;
using LegalPro.Infrastructure.Persistence;
using LegalPro.Infrastructure.Persistence.Repositories;
using LegalPro.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Polly;
using Polly.Retry;

namespace LegalPro.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
    {
        // DATABASE_URL (Railway) o ConnectionStrings:DefaultConnection (appsettings)
        var rawConnectionString = configuration["DATABASE_URL"]
                               ?? configuration.GetConnectionString("DefaultConnection")
                               ?? throw new InvalidOperationException("ConnectionString no configurada.");

        // Convertir postgresql:// URI a formato ADO.NET que Npgsql acepta
        var connectionString = ConvertPostgresUri(rawConnectionString);

        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseNpgsql(connectionString)
                   .UseSnakeCaseNamingConvention());

        services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<ApplicationDbContext>());

        // Multi-tenancy: IHttpContextAccessor (requerido por CurrentUserService)
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();

        // Repositorios
        services.AddScoped<IOrganizacionRepository, OrganizacionRepository>();

        services.AddScoped<IGeminiService, GeminiService>();

        // ISP — interfaces segregadas resuelven desde el singleton GeminiService
        services.AddScoped<ISimulationAI>(p => p.GetRequiredService<IGeminiService>());
        services.AddScoped<ILegalAnalyzer>(p => p.GetRequiredService<IGeminiService>());
        services.AddScoped<ILegalPredictor>(p => p.GetRequiredService<IGeminiService>());
        services.AddScoped<ILegalChat>(p => p.GetRequiredService<IGeminiService>());
        services.AddScoped<ILegalDrafter>(p => p.GetRequiredService<IGeminiService>());
        services.AddScoped<ILegalSimulacion>(p => p.GetRequiredService<IGeminiService>());
        services.AddScoped<ILegalJurisprudenciaSearch>(p => p.GetRequiredService<IGeminiService>());
        services.AddScoped<ILegalAlegato>(p => p.GetRequiredService<IGeminiService>());
        services.AddScoped<ILegalInterrogatorio>(p => p.GetRequiredService<IGeminiService>());
        services.AddScoped<ILegalObjeciones>(p => p.GetRequiredService<IGeminiService>());
        services.AddScoped<ILegalResumenCaso>(p => p.GetRequiredService<IGeminiService>());
        // Interfaces rol-específicas
        services.AddScoped<ILegalFiscal>(p => p.GetRequiredService<IGeminiService>());
        services.AddScoped<ILegalJuez>(p => p.GetRequiredService<IGeminiService>());
        services.AddScoped<ILegalContador>(p => p.GetRequiredService<IGeminiService>());

        services.AddScoped<ISimulationService, SimulationService>();
        services.AddScoped<IJwtService, JwtService>();

        // Audit log de seguridad — persistencia de eventos de autenticación y acceso
        services.AddScoped<IAuditLogger, AuditLoggerService>();

        // Resiliencia de IA: Polly v8 Pipeline para Gemini
        services.AddResiliencePipeline("gemini-pipeline", builder =>
        {
            builder.AddRetry(new RetryStrategyOptions
            {
                MaxRetryAttempts = 3,
                Delay = TimeSpan.FromSeconds(2),
                BackoffType = DelayBackoffType.Exponential,
                ShouldHandle = new PredicateBuilder().Handle<Exception>()
            })
            .AddTimeout(TimeSpan.FromSeconds(45));
        });

        return services;
    }

    /// <summary>
    /// Convierte una URI postgresql:// o postgres:// al formato ADO.NET que Npgsql acepta.
    /// Si ya es formato ADO.NET (Host=...) devuelve sin cambios.
    /// </summary>
    private static string ConvertPostgresUri(string uriOrConnStr)
    {
        if (string.IsNullOrWhiteSpace(uriOrConnStr))
            return uriOrConnStr;

        if (!uriOrConnStr.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase)
            && !uriOrConnStr.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase))
            return uriOrConnStr;

        var uri = new Uri(uriOrConnStr);
        var userInfo = uri.UserInfo.Split(':', 2);
        var user = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : string.Empty;
        var pass = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty;
        var db   = uri.AbsolutePath.TrimStart('/');
        var port = uri.Port > 0 ? uri.Port : 5432;

        return $"Host={uri.Host};Port={port};Database={db};Username={user};Password={pass};SSL Mode=Prefer;Trust Server Certificate=true";
    }
}
