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
        var connectionString = configuration["DATABASE_URL"]
                               ?? configuration.GetConnectionString("DefaultConnection")
                               ?? throw new InvalidOperationException("ConnectionString no configurada.");

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
}
