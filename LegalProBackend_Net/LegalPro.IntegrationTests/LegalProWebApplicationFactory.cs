using LegalPro.Application.Common.Interfaces;
using LegalPro.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace LegalPro.IntegrationTests;

/// <summary>
/// Factory de integración con EF Core InMemory, auth fake y Gemini fake.
/// NO requiere PostgreSQL real ni API key de Gemini para correr.
/// </summary>
public class LegalProWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureAppConfiguration((ctx, config) =>
        {
            // Carga .env.test si existe (para desarrollo local sin exponer keys en CI)
            LoadDotEnvTest();

            // Las env vars del sistema siempre tienen prioridad
            config.AddEnvironmentVariables();

            // JWT_SECRET obligatorio para que la app no falle al arrancar.
            // En tests usamos un valor fijo de 32+ caracteres.
            var inMemory = new Dictionary<string, string?>
            {
                ["JWT_SECRET"] = "LegalPro2026_Test_Secret_Key_Must_Be_32_Chars!",
                ["ASPNETCORE_ENVIRONMENT"] = "Testing"
            };
            config.AddInMemoryCollection(inMemory);
        });

        builder.ConfigureServices(services =>
        {
            // ═══════════════════════════════════════════════════════════════════
            // 1. REEMPLAZAR ApplicationDbContext por EF Core InMemory
            //    Usamos registro manual para evitar que se acumulen providers
            //    (Npgsql + InMemory) provenientes de AddInfrastructureServices.
            // ═══════════════════════════════════════════════════════════════════
            services.RemoveAll<DbContextOptions<ApplicationDbContext>>();
            services.RemoveAll<ApplicationDbContext>();

            services.AddSingleton<DbContextOptions<ApplicationDbContext>>(_ =>
            {
                var builder = new DbContextOptionsBuilder<ApplicationDbContext>();
                builder.UseInMemoryDatabase("LegalProTestDb");
                return builder.Options;
            });

            services.AddScoped<ApplicationDbContext>(provider =>
                new ApplicationDbContext(
                    provider.GetRequiredService<DbContextOptions<ApplicationDbContext>>()));

            // Re-registrar IApplicationDbContext para que apunte al InMemory
            services.RemoveAll<IApplicationDbContext>();
            services.AddScoped<IApplicationDbContext>(provider =>
                provider.GetRequiredService<ApplicationDbContext>());

            // ═══════════════════════════════════════════════════════════════════
            // 2. REEMPLAZAR IGeminiService por FakeGeminiService
            // ═══════════════════════════════════════════════════════════════════
            var geminiDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(IGeminiService));
            if (geminiDescriptor != null)
                services.Remove(geminiDescriptor);

            services.AddScoped<IGeminiService, FakeGeminiService>();

            // ═══════════════════════════════════════════════════════════════════
            // 3. AUTENTICACIÓN FAKE para endpoints protegidos
            // ═══════════════════════════════════════════════════════════════════
            services.AddAuthentication(TestAuthHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                    TestAuthHandler.SchemeName, _ => { });

            services.PostConfigure<AuthenticationOptions>(options =>
            {
                options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
            });

            // ═══════════════════════════════════════════════════════════════════
            // 4. AJUSTAR HEALTH CHECKS
            //    Remover cualquier check que dependa de PostgreSQL (si existe)
            //    y asegurar que al menos haya un check que retorne Healthy.
            // ═══════════════════════════════════════════════════════════════════
            services.Configure<HealthCheckServiceOptions>(options =>
            {
                var toRemove = options.Registrations
                    .Where(r =>
                        r.Name.Contains("postgresql", StringComparison.OrdinalIgnoreCase) ||
                        r.Name.Contains("npgsql", StringComparison.OrdinalIgnoreCase))
                    .ToList();

                foreach (var registration in toRemove)
                    options.Registrations.Remove(registration);
            });

            services.AddHealthChecks()
                .AddCheck("integration-test", () => HealthCheckResult.Healthy("Test environment OK"));
        });
    }

    /// <summary>
    /// Crea un scope de servicios y seedea los datos mínimos de prueba en memoria.
    /// Llámalo desde el constructor de tus test classes o desde cada test.
    /// </summary>
    public async Task SeedTestDataAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await TestDataSeeder.SeedAsync(db);
    }

    /// <summary>Lee .env.test y setea las variables en Environment si aún no están seteadas.</summary>
    private static void LoadDotEnvTest()
    {
        var dir = AppContext.BaseDirectory;
        string? envFile = null;

        for (int i = 0; i < 5; i++)
        {
            var candidate = Path.Combine(dir, ".env.test");
            if (File.Exists(candidate))
            {
                envFile = candidate;
                break;
            }
            dir = Path.GetDirectoryName(dir) ?? dir;
        }

        if (envFile is null) return;

        foreach (var line in File.ReadAllLines(envFile))
        {
            if (string.IsNullOrWhiteSpace(line) || line.TrimStart().StartsWith('#')) continue;

            var eqIndex = line.IndexOf('=');
            if (eqIndex <= 0) continue;

            var key = line[..eqIndex].Trim();
            var value = line[(eqIndex + 1)..].Trim().Trim('"');

            if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
                Environment.SetEnvironmentVariable(key, value);
        }
    }
}
