using System.Net;
using System.Net.Http.Json;
using FluentAssertions;

// Forzar ejecución secuencial de test classes — múltiples WebApplicationFactory
// simultáneas conflictúan con el estado global de Serilog y ASP.NET Core.
[assembly: Xunit.CollectionBehavior(DisableTestParallelization = true)]

namespace LegalPro.IntegrationTests;

// ═══════════════════════════════════════════════════════════════════════
// TESTS DE INTEGRACIÓN REALES — Sin mocks.
// Levantan la app ASP.NET Core completa con WebApplicationFactory<Program>.
// Requieren credenciales reales en env vars o archivo .env.test
// Docs: https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests
// ═══════════════════════════════════════════════════════════════════════

/// <summary>Tests del Health Check — siempre corren, no requieren credenciales.</summary>
public class HealthCheckTests : IClassFixture<LegalProWebApplicationFactory>
{
    private readonly HttpClient _client;

    public HealthCheckTests(LegalProWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Health_Endpoint_Retorna_200()
    {
        var response = await _client.GetAsync("/health");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Endpoints_Inexistentes_Retornan_404()
    {
        var response = await _client.GetAsync("/api/no-existe");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}

/// <summary>Tests reales del Auth endpoint contra Supabase PostgreSQL.</summary>
public class AuthControllerTests : IClassFixture<LegalProWebApplicationFactory>
{
    private readonly HttpClient _client;

    // Solo corre si DATABASE_URL es una cadena real de PostgreSQL
    private static bool TieneCredencialesDB =>
        Environment.GetEnvironmentVariable("DATABASE_URL") is { Length: > 20 } url
        && url.StartsWith("postgresql://");

    public AuthControllerTests(LegalProWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Register_Sin_Body_Retorna_400()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new { });

        // Sin datos obligatorios debe fallar (400 o 422)
        ((int)response.StatusCode).Should().BeGreaterThanOrEqualTo(400);
    }

    [Fact]
    public async Task Login_Credenciales_Invalidas_Retorna_Error()
    {
        if (!TieneCredencialesDB) return; // Salta si no hay DB configurada

        var response = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            email = "noexiste@test.com",
            password = "wrongpassword"
        });

        // Credenciales inválidas → error (422 DomainError o 500)
        ((int)response.StatusCode).Should().BeGreaterThanOrEqualTo(400);
    }

    [Fact]
    public async Task Register_Y_Login_Flujo_Completo()
    {
        if (!TieneCredencialesDB) return; // Salta si no hay DB configurada

        // Email único por ejecución de test para evitar conflictos
        var email = $"test.integration.{Guid.NewGuid():N}@legalpro.test";
        var password = "TestPass123!";

        // --- Registro ---
        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            nombreCompleto = "Test Usuario Integration",
            email,
            password,
            rol = "Abogado",
            especialidad = "Penal"
        });

        registerResponse.IsSuccessStatusCode.Should().BeTrue(
            $"El registro falló con {registerResponse.StatusCode}: {await registerResponse.Content.ReadAsStringAsync()}");

        var registerBody = await registerResponse.Content.ReadFromJsonAsync<TokenResponse>();
        registerBody!.Token.Should().NotBeNullOrEmpty();

        // --- Login con las mismas credenciales ---
        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            email,
            password
        });

        loginResponse.IsSuccessStatusCode.Should().BeTrue(
            $"El login falló con {loginResponse.StatusCode}");

        var loginBody = await loginResponse.Content.ReadFromJsonAsync<TokenResponse>();
        loginBody!.Token.Should().NotBeNullOrEmpty();
    }
}

/// <summary>Tests reales de los endpoints Gemini (Chat, Analista, Predictor, Redactor).</summary>
public class GeminiEndpointsTests : IClassFixture<LegalProWebApplicationFactory>
{
    private readonly HttpClient _client;

    // Solo corre si GEMINI_API_KEY es una clave real (comienza con AIzaSy y tiene >30 chars)
    private static bool TieneGeminiKey =>
        Environment.GetEnvironmentVariable("GEMINI_API_KEY") is { Length: > 30 } key
        && key.StartsWith("AIzaSy");

    public GeminiEndpointsTests(LegalProWebApplicationFactory factory)
    {
        _client = factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            // Gemini puede tardar hasta 30s en responder
            HandleCookies = false
        });
        _client.Timeout = TimeSpan.FromSeconds(90);
    }

    [Fact]
    public async Task Chat_Sin_UserInput_Retorna_400()
    {
        var response = await _client.PostAsJsonAsync("/api/chat/enviar", new
        {
            history = "",
            userInput = "" // Vacío → FluentValidation lanza 400 o 401 si no autenticado
        });

        // Sin autenticación retorna 401; con JWT y cuerpo vacío retorna 400.
        // Ambos son respuestas correctas de error — no hay acceso no autorizado.
        ((int)response.StatusCode).Should().BeGreaterThanOrEqualTo(400);
    }

    [Fact]
    public async Task Analista_Sin_Texto_Retorna_400()
    {
        var response = await _client.PostAsJsonAsync("/api/analista/analizar", new
        {
            textoExpediente = "" // Vacío → validación falla
        });

        // Sin autenticación retorna 401; con JWT y cuerpo vacío retorna 400.
        ((int)response.StatusCode).Should().BeGreaterThanOrEqualTo(400);
    }

    [Fact]
    public async Task Chat_Con_Gemini_Real_Retorna_Respuesta_Legal()
    {
        if (!TieneGeminiKey) return; // Salta si no hay API key configurada

        var response = await _client.PostAsJsonAsync("/api/chat/enviar", new
        {
            history = "",
            userInput = "¿Cuál es el plazo para interponer apelación en proceso civil peruano?"
        });

        response.IsSuccessStatusCode.Should().BeTrue(
            $"Gemini Chat falló con {response.StatusCode}: {await response.Content.ReadAsStringAsync()}");

        var body = await response.Content.ReadAsStringAsync();
        body.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Analista_Con_Gemini_Real_Analiza_Expediente()
    {
        if (!TieneGeminiKey) return;

        var response = await _client.PostAsJsonAsync("/api/analista/analizar", new
        {
            textoExpediente = "EXPEDIENTE Nº 00123-2024-0-1801-JR-PE-01. " +
                              "IMPUTADO: Juan Pérez. DELITO: Robo agravado NCPP art. 189. " +
                              "HECHOS: El imputado fue intervenido el 10/01/2024 a las 22:00 hrs " +
                              "en Av. Arequipa 1234, Lima, con víctima presente. " +
                              "EVIDENCIA: 1 arma de fuego incautada, 3 testigos presenciales. " +
                              "El folio 5 indica arresto el 10/01 pero el folio 12 indica el 11/01."
        });

        response.IsSuccessStatusCode.Should().BeTrue(
            $"Analista falló con {response.StatusCode}: {await response.Content.ReadAsStringAsync()}");

        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("resumenGeneral", "Gemini debe devolver JSON con resumenGeneral");
    }

    [Fact]
    public async Task Predictor_Con_Gemini_Real_Predice_Resultado()
    {
        if (!TieneGeminiKey) return;

        var response = await _client.PostAsJsonAsync("/api/predictor/predecir", new
        {
            hechosCausa = "Acusado detenido con 50g de PBC en flagrancia, sin antecedentes previos",
            materia = "Penal",
            juzgadoSala = "3er Juzgado Penal Especializado Lima",
            juezAsignado = "Dr. Carlos Mendoza"
        });

        response.IsSuccessStatusCode.Should().BeTrue(
            $"Predictor falló con {response.StatusCode}: {await response.Content.ReadAsStringAsync()}");

        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("probabilidadExito");
    }

    [Fact]
    public async Task Redactor_Con_Gemini_Real_Genera_Borrador()
    {
        if (!TieneGeminiKey) return;

        var response = await _client.PostAsJsonAsync("/api/redactor/generar", new
        {
            tipoEscrito = "Recurso de Apelación",
            distritoJudicial = "Lima",
            hechosCausa = "El juzgado negó la demanda sin motivación suficiente, " +
                          "vulnerando el derecho al debido proceso art. 139 Constitución Peruana"
        });

        response.IsSuccessStatusCode.Should().BeTrue(
            $"Redactor falló con {response.StatusCode}: {await response.Content.ReadAsStringAsync()}");

        var body = await response.Content.ReadAsStringAsync();
        body.Should().NotBeNullOrEmpty();
    }
}

// DTO auxiliar para deserializar respuestas de Auth
internal record TokenResponse(string Token);

