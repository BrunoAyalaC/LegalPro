using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace LegalPro.IntegrationTests;

/// <summary>
/// Factory real de integración. Levanta la app completa (sin mocks).
/// Lee credenciales de variables de entorno del sistema o de un archivo .env.test local.
///
/// Para correr los tests localmente, configura las variables antes de ejecutar:
///   $env:GEMINI_API_KEY    = "AIza..."
///   $env:DATABASE_URL      = "postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres?sslmode=require"
///   $env:JWT_SECRET        = "tu-secreto-jwt-de-64-bytes"
///   $env:SUPABASE_URL      = "https://xxx.supabase.co"
///   $env:SUPABASE_SERVICE_KEY = "eyJ..."
///
/// O crea el archivo LegalPro.IntegrationTests/.env.test con las mismas variables.
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
        });
    }

    /// <summary>Lee .env.test y setea las variables en Environment si aún no están seteadas.</summary>
    private static void LoadDotEnvTest()
    {
        // Busca el .env.test desde el directorio del proyecto de tests
        var dir = AppContext.BaseDirectory;
        string? envFile = null;

        // Sube hasta 5 niveles buscando el archivo
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

            // Solo setea si no está ya en el entorno (env var del sistema tiene prioridad)
            if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
                Environment.SetEnvironmentVariable(key, value);
        }
    }
}
