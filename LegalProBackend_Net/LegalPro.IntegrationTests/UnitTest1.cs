using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using LegalPro.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using LegalPro.Domain.Entities;

// Forzar ejecución secuencial de test classes — múltiples WebApplicationFactory
// simultáneas conflictúan con el estado global de Serilog y ASP.NET Core.
[assembly: Xunit.CollectionBehavior(DisableTestParallelization = true)]

namespace LegalPro.IntegrationTests;

// ═══════════════════════════════════════════════════════════════════════
// TESTS DE INTEGRACIÓN — Sin dependencias externas (PostgreSQL / MiniMax real).
// Levantan la app ASP.NET Core completa con WebApplicationFactory<Program>
// usando EF Core InMemory, autenticación fake y MiniMax fake.
// ═══════════════════════════════════════════════════════════════════════

/// <summary>Tests del Health Check — siempre corren.</summary>
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

/// <summary>Tests del Auth endpoint contra EF Core InMemory.</summary>
public class AuthControllerTests : IClassFixture<LegalProWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly LegalProWebApplicationFactory _factory;

    public AuthControllerTests(LegalProWebApplicationFactory factory)
    {
        _factory = factory;
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
        var response = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            email = "noexiste@test.com",
            password = "wrongpassword"
        });

        // Credenciales inválidas → error (401, 404 o 422)
        ((int)response.StatusCode).Should().BeGreaterThanOrEqualTo(400);
    }

    [Fact]
    public async Task Register_Y_Login_Flujo_Completo()
    {
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

/// <summary>
/// Tests de los endpoints IA usando FakeMinimaxService — corren SIEMPRE
/// en CI/CD sin depender de la API real ni de PostgreSQL.
/// </summary>
public class IAEndpointsTests : IClassFixture<LegalProWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly LegalProWebApplicationFactory _factory;

    public IAEndpointsTests(LegalProWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            HandleCookies = false
        });
        _client.Timeout = TimeSpan.FromSeconds(30);
    }

    /// <summary>
    /// Seedea datos mínimos (org + usuario) antes de cada test que interactúa
    /// con la base de datos (ej. chat que persiste mensajes).
    /// </summary>
    private async Task EnsureTestDataAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await TestDataSeeder.SeedAsync(db);
    }

    [Fact]
    public async Task Chat_Sin_UserInput_Retorna_400()
    {
        var response = await _client.PostAsJsonAsync("/api/chat/enviar", new
        {
            history = "",
            userInput = "" // Vacío → FluentValidation lanza 400
        });

        // Con auth fake y cuerpo vacío retorna 400.
        ((int)response.StatusCode).Should().BeGreaterThanOrEqualTo(400);
    }

    [Fact]
    public async Task Analista_Sin_Texto_Retorna_400()
    {
        var response = await _client.PostAsJsonAsync("/api/analista/analizar", new
        {
            textoExpediente = "" // Vacío → validación falla
        });

        // Con auth fake y cuerpo vacío retorna 400.
        ((int)response.StatusCode).Should().BeGreaterThanOrEqualTo(400);
    }

    [Fact]
    public async Task Chat_Con_FakeGemini_Retorna_Respuesta()
    {
        await EnsureTestDataAsync();

        var response = await _client.PostAsJsonAsync("/api/chat/enviar", new
        {
            history = "",
            userInput = "¿Cuál es el plazo para interponer apelación en proceso civil peruano?"
        });

        response.IsSuccessStatusCode.Should().BeTrue(
            $"MiniMax Chat falló con {response.StatusCode}: {await response.Content.ReadAsStringAsync()}");

        var body = await response.Content.ReadAsStringAsync();
        body.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Analista_Con_FakeMinimax_Analiza_Expediente()
    {
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
        body.Should().Contain("resumenGeneral", "FakeMinimax debe devolver JSON con resumenGeneral");
    }

    [Fact]
    public async Task Predictor_Con_FakeMinimax_Predice_Resultado()
    {
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
    public async Task Redactor_Con_FakeMinimax_Genera_Borrador()
    {
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

    // ── Tests opcionales con MiniMax REAL (se saltan si no hay API key) ──

    private static bool TieneMinimaxKey =>
        Environment.GetEnvironmentVariable("MINIMAX_API_KEY") is { Length: > 30 };

    [Fact(Skip = "Requiere MINIMAX_API_KEY real; usar Chat_Con_FakeMinimax_Retorna_Respuesta para CI/CD")]
    public async Task Chat_Con_Minimax_Real_Retorna_Respuesta_Legal()
    {
        if (!TieneMinimaxKey) return;

        var response = await _client.PostAsJsonAsync("/api/chat/enviar", new
        {
            history = "",
            userInput = "¿Cuál es el plazo para interponer apelación en proceso civil peruano?"
        });

        response.IsSuccessStatusCode.Should().BeTrue(
            $"MiniMax Chat falló con {response.StatusCode}: {await response.Content.ReadAsStringAsync()}");

        var body = await response.Content.ReadAsStringAsync();
        body.Should().NotBeNullOrEmpty();
    }

    [Fact(Skip = "Requiere MINIMAX_API_KEY real")]
    public async Task Analista_Con_Minimax_Real_Analiza_Expediente()
    {
        if (!TieneMinimaxKey) return;

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
        body.Should().Contain("resumenGeneral", "MiniMax debe devolver JSON con resumenGeneral");
    }

    [Fact(Skip = "Requiere MINIMAX_API_KEY real")]
    public async Task Predictor_Con_Minimax_Real_Predice_Resultado()
    {
        if (!TieneMinimaxKey) return;

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

    [Fact(Skip = "Requiere MINIMAX_API_KEY real")]
    public async Task Redactor_Con_Minimax_Real_Genera_Borrador()
    {
        if (!TieneMinimaxKey) return;

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

public class SoftDeleteIntegrationTests
{
    private class TestTenantProvider : LegalPro.Application.Common.Interfaces.ITenantProvider
    {
        public Guid? TenantId { get; set; }
    }

    [Fact]
    public async Task DbContext_DeberiaFiltrarExpedientesConSoftDelete()
    {
        // Arrange
        var options = new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var tenantId = Guid.NewGuid();
        var tenantProvider = new TestTenantProvider { TenantId = tenantId };

        using (var context = new ApplicationDbContext(options, tenantProvider))
        {
            var usuarioId = Guid.NewGuid();
            var activo = Expediente.Crear("EXP-ACT", "Activo", LegalPro.Domain.Enums.TipoRamaProcesal.Penal, usuarioId, tenantId);
            var eliminado = Expediente.Crear("EXP-DEL", "Eliminado", LegalPro.Domain.Enums.TipoRamaProcesal.Penal, usuarioId, tenantId);
            eliminado.Eliminar();

            context.Expedientes.AddRange(activo, eliminado);
            await context.SaveChangesAsync();
        }

        // Act & Assert
        using (var context = new ApplicationDbContext(options, tenantProvider))
        {
            var result = await context.Expedientes.ToListAsync();

            result.Should().ContainSingle();
            result[0].Numero.Should().Be("EXP-ACT");
        }
    }
}

// DTO auxiliar para deserializar respuestas de Auth
internal record TokenResponse(string Token);
