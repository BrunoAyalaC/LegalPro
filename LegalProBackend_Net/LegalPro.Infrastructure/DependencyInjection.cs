using LegalPro.Application.Common.Interfaces;
using LegalPro.Infrastructure.BackgroundJobs;
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
            options.UseNpgsql(connectionString, o => o.MigrationsHistoryTable("__ef_migrations_history"))
                   .UseSnakeCaseNamingConvention());

        services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<ApplicationDbContext>());

        // Multi-tenancy: IHttpContextAccessor (requerido por CurrentUserService)
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<ITenantProvider, TenantProvider>();

        // Repositorios
        services.AddScoped<IOrganizacionRepository, OrganizacionRepository>();

        // Memoria Cache para respuestas de MiniMax/IA
        services.AddMemoryCache();

        // FIX P2 perf 2026-08-21: IHttpClientFactory + Polly retry para MiniMax.
        // - Antes: static HttpClient en ModelsClient → socket exhaustion, DNS staleness, sin retry HTTP.
        // - Ahora: AddHttpClient("minimax", client => BaseAddress = MINIMAX_BASE_URL) + AddPolicyHandler (Polly retry exponencial 3 intentos).
        //   La factory gestiona pool + lifetime + DNS, y Polly retry HTTP complementa ResiliencePipeline "minimax-pipeline".
        var minimaxBaseUrl = configuration["MINIMAX_BASE_URL"]
                             ?? configuration["Minimax:BaseUrl"]
                             ?? Environment.GetEnvironmentVariable("MINIMAX_BASE_URL")
                             ?? "https://api.minimax.io/v1";
        services.AddHttpClient("minimax", client =>
        {
            client.BaseAddress = new Uri(minimaxBaseUrl.TrimEnd('/') + "/");
            client.Timeout = TimeSpan.FromSeconds(45);
            client.DefaultRequestHeaders.Add("Accept", "application/json");
        })
        // Polly retry HTTP (transient errors 5xx + network failures): 3 intentos backoff 2^retry
        // AddPolicyHandler es la API clásica (Microsoft.Extensions.Http.Polly) requerida por la tarea P2.
        .AddPolicyHandler(Polly.Policy<HttpResponseMessage>
            .Handle<HttpRequestException>()
            .OrResult(r => (int)r.StatusCode >= 500)
            .WaitAndRetryAsync(3, retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)),
                onRetry: (outcome, timespan, retryCount, context) =>
                {
                    // Log silenciado aquí; Serilog + OTel capturan el retry vía event
                    System.Diagnostics.Trace.WriteLine($"[Minimax HttpRetry] Intento {retryCount} tras {timespan.TotalSeconds}s - {outcome.Result?.StatusCode} {outcome.Exception?.Message}");
                }));

        services.AddScoped<IMinimaxService, MinimaxService>();

        // NOTA (2026-08-07 @auditor-performance): el vertical RAG .NET
        // (AiController /api/ai/rag/* + IRagService/RagService) fue ELIMINADO.
        // Escribía en la tabla rag_vectors (v1) que ya no existe en producción y
        // no tenía consumidores (el RAG real vive en Node: tools/rag + ragMiddleware).
        // El registro de IRagService y los HttpClients "OpenAI"/"RagCitationValidator"
        // quedaron sin uso y se removieron junto con el vertical.

        // ISP — interfaces segregadas resuelven desde el singleton MinimaxService
        services.AddScoped<ISimulationAI>(p => p.GetRequiredService<IMinimaxService>());
        services.AddScoped<ILegalAnalyzer>(p => p.GetRequiredService<IMinimaxService>());
        services.AddScoped<ILegalPredictor>(p => p.GetRequiredService<IMinimaxService>());
        services.AddScoped<ILegalChat>(p => p.GetRequiredService<IMinimaxService>());
        services.AddScoped<ILegalDrafter>(p => p.GetRequiredService<IMinimaxService>());
        services.AddScoped<ILegalSimulacion>(p => p.GetRequiredService<IMinimaxService>());
        services.AddScoped<ILegalJurisprudenciaSearch>(p => p.GetRequiredService<IMinimaxService>());
        services.AddScoped<ILegalAlegato>(p => p.GetRequiredService<IMinimaxService>());
        services.AddScoped<ILegalInterrogatorio>(p => p.GetRequiredService<IMinimaxService>());
        services.AddScoped<ILegalObjeciones>(p => p.GetRequiredService<IMinimaxService>());
        services.AddScoped<ILegalResumenCaso>(p => p.GetRequiredService<IMinimaxService>());
        // Interfaces rol-específicas
        services.AddScoped<ILegalFiscal>(p => p.GetRequiredService<IMinimaxService>());
        services.AddScoped<ILegalJuez>(p => p.GetRequiredService<IMinimaxService>());
        services.AddScoped<ILegalContador>(p => p.GetRequiredService<IMinimaxService>());

        services.AddScoped<ISimulationService, SimulationService>();
        services.AddScoped<IJwtService, JwtService>();
        services.AddScoped<IStorageService, LocalStorageService>();

        // E2EE: Cifrado AES-256-GCM para Owner Dashboard
        services.AddScoped<IEncryptionService, EncryptionService>();

        // Audit log de seguridad — persistencia de eventos de autenticación y acceso
        services.AddScoped<IAuditLogger, AuditLoggerService>();

        // Resiliencia de IA: Polly v8 Pipeline para MiniMax
        services.AddResiliencePipeline("minimax-pipeline", builder =>
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

        services.AddHostedService<ProcessOutboxMessagesJob>();

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
