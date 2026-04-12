using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using LegalPro.Application;
using LegalPro.Infrastructure;
using LegalPro.Api.Middleware;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Serilog;
using LegalPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add support for Railway environment variables
builder.Configuration.AddEnvironmentVariables();

// ── Serilog full configuration ────────────────────────────────────────────
builder.Host.UseSerilog((ctx, cfg) =>
{
    cfg.ReadFrom.Configuration(ctx.Configuration)
       .Enrich.FromLogContext()
   .Enrich.WithProperty("Application", "LegalPro.Api")
   .Enrich.WithProperty("Environment", ctx.HostingEnvironment.EnvironmentName)
   .WriteTo.Console(outputTemplate:
       "[{Timestamp:HH:mm:ss} {Level:u3}] {SourceContext}: {Message:lj}{NewLine}{Exception}")
   .WriteTo.File(
       path: "logs/legalpro-.log",
       rollingInterval: RollingInterval.Day,
       retainedFileCountLimit: 7,
       outputTemplate:
           "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {SourceContext}: {Message:lj}{NewLine}{Exception}");
});


// ── Rate Limiting (OWASP API4 — evita abuso de Gemini y flooding) ───────────────
builder.Services.AddRateLimiter(o =>
{
    // Regla general: 60 req/min por IP (ventana deslizante)
    o.AddSlidingWindowLimiter("general", opts =>
    {
        opts.PermitLimit = 60;
        opts.Window = TimeSpan.FromMinutes(1);
        opts.SegmentsPerWindow = 6;  // ventanas de 10s
        opts.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opts.QueueLimit = 0;
    });

    // Regla Gemini estricta: 10 req/min por IP (costoso en tokens)
    o.AddSlidingWindowLimiter("gemini", opts =>
    {
        opts.PermitLimit = 10;
        opts.Window = TimeSpan.FromMinutes(1);
        opts.SegmentsPerWindow = 6;
        opts.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opts.QueueLimit = 0;
    });

    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.OnRejected = async (ctx, ct) =>
    {
        ctx.HttpContext.Response.Headers["Retry-After"] = "60";
        await ctx.HttpContext.Response.WriteAsync(
            "{\"error\":\"Demasiadas solicitudes. Intente nuevamente en 60 segundos.\"}", ct);
    };
});


// Add services to the container.
// CamelCase JSON policy: Token→token, Respuesta→respuesta, etc.
// Esto garantiza compatibilidad con todos los clientes (Android, web).
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy =
            System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition =
            System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
        // Permite deserializar enums por nombre ("Civil") además de valor (1)
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter(
                System.Text.Json.JsonNamingPolicy.CamelCase));
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "LegalPro API",
        Version = "v1",
        Description = "API backend de LegalPro — plataforma legal IA para abogados, fiscales y jueces peruanos."
    });

    // Configuración de seguridad JWT Bearer para Swagger UI
    var jwtScheme = new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Ingresa el token JWT. Ejemplo: eyJhbGci..."
    };
    c.AddSecurityDefinition("Bearer", jwtScheme);
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Id   = "Bearer",
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme
                }
            },
            Array.Empty<string>()
        }
    });
});

// IHttpContextAccessor: requerido por CurrentUserService para leer JWT claims
builder.Services.AddHttpContextAccessor();

// Clean Architecture Layers (DDD + CQRS + FluentValidation + Pipeline Behaviours)
builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);

// Health Checks for Docker/Kubernetes readiness
builder.Services.AddHealthChecks();

// CORS: orígenes permitidos configurables desde variable de entorno ALLOWED_ORIGINS
// En Railway: ALLOWED_ORIGINS=https://mi-frontend.railway.app,https://legalpro.app
// NOTA: también acepta sin protocolo (ej. "mi-frontend.railway.app") → se normaliza a https://
builder.Services.AddCors(options =>
{
    var allowedOrigins = (builder.Configuration["ALLOWED_ORIGINS"] ?? "")
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Select(o => o.StartsWith("http", StringComparison.OrdinalIgnoreCase) ? o : $"https://{o}")
        .ToArray();

    options.AddPolicy("DefaultCors", policy =>
    {
        if (builder.Environment.IsDevelopment() || allowedOrigins.Length == 0)
        {
            // Solo en desarrollo sin configuración se permite cualquier origen
            policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
        }
        else
        {
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials();
        }
    });
});

// Railway environment variables with fallback to appsettings
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

// Override connection string if DATABASE_URL is provided by Railway
if (!string.IsNullOrEmpty(builder.Configuration["DATABASE_URL"]))
{
    connectionString = builder.Configuration["DATABASE_URL"];
}

// Configuration values with Railway environment variable priority
var supabaseUrl = builder.Configuration["SUPABASE_URL"] ?? builder.Configuration["Supabase:Url"];
var supabaseKey = builder.Configuration["SUPABASE_SERVICE_KEY"] ?? builder.Configuration["Supabase:ServiceKey"];

// JWT_SECRET NUNCA debe tener fallback con valor fijo — si falta la variable, falla al arrancar
var jwtSecret = builder.Configuration["JWT_SECRET"]
    ?? builder.Configuration["JwtSettings:Secret"]
    ?? throw new InvalidOperationException("JWT_SECRET no está configurado. Configura la variable de entorno en Railway.");

var geminiKey = builder.Configuration["GEMINI_API_KEY"] ?? builder.Configuration["Gemini:ApiKey"];
// Railway usa PORT. En desarrollo local usamos 5000 para no conflictar con altri servicios
var port = builder.Configuration["PORT"] ?? "5000";

// Configure Kestrel to use Railway's assigned port
builder.WebHost.UseUrls($"http://*:{port}");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = "LegalProAPI",
            ValidAudience = "LegalProClients",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };
    });

builder.Services.AddAuthorizationBuilder();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Global Exception Handling (replaces try/catch in every controller)
app.UseMiddleware<ExceptionHandlingMiddleware>();

// Security Headers — CSP, HSTS, X-Frame-Options, etc. (OWASP A05)
app.UseMiddleware<SecurityHeadersMiddleware>();

// Brute Force Protection — login lockout progresivo (OWASP A07)
app.UseMiddleware<BruteForceProtectionMiddleware>();

// Rate limiting (antes de routing para cortar temprano)
app.UseRateLimiter();

app.UseCors("DefaultCors");

app.UseAuthentication();
app.UseAuthorization();

// Serilog request logging — registra cada HTTP request con duración y status
app.UseSerilogRequestLogging(opts =>
{
    opts.MessageTemplate = "HTTP {RequestMethod} {RequestPath} → {StatusCode} en {Elapsed:0.0}ms";
});

app.MapControllers();

// Health Check endpoint for Docker/Kubernetes
app.MapHealthChecks("/health");

// ── EF Core Migrations en startup (Railway + Supabase) ──────────────────────────
// Solo en Production — evita fallo en Development y Testing (sin DB real).
// Usamos conexión directa (migrationConnectionString, puerto 5432) para DDL,
// porque Supabase PgBouncer en transaction mode (6543) bloquea CREATE TABLE.
if (app.Environment.IsProduction())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

    // Convertir postgresql:// URI a formato ADO.NET que NpgsqlConnectionStringBuilder acepta.
    // Railway provee DATABASE_URL como URI, pero Npgsql SetConnectionString requiere key=value.
    static string ConvertPostgresUri(string uriOrConnStr)
    {
        if (string.IsNullOrEmpty(uriOrConnStr)) return uriOrConnStr;
        if (!uriOrConnStr.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            && !uriOrConnStr.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
            return uriOrConnStr.Replace(":6543/", ":5432/");

        var uri = new Uri(uriOrConnStr);
        var userInfo = uri.UserInfo.Split(':', 2);
        var user = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : "";
        var pass = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
        var db2 = uri.AbsolutePath.TrimStart('/');
        return $"Host={uri.Host};Port={uri.Port};Database={db2};Username={user};Password={pass};SSL Mode=Prefer;Trust Server Certificate=true";
    }

    var rawConn = app.Configuration["MIGRATION_DB_URL"]
        ?? db.Database.GetConnectionString()!;
    var migrationConn = ConvertPostgresUri(rawConn);
    db.Database.SetConnectionString(migrationConn);

    try
    {
        await db.Database.MigrateAsync();
        Log.Information("EF Core migrations aplicadas correctamente.");
    }
    catch (Exception ex)
    {
        // No hacer crash-loop: si la BD ya está migrada, el servicio puede arrancar.
        // Supabase PgBouncer puede rechazar DDL; las migraciones manuales siguen válidas.
        Log.Error(ex, "Error aplicando EF Core migrations al iniciar. El servicio continúa.");
        Log.Warning("Si las migraciones no están aplicadas, ejecuta: dotnet ef database update");
        Log.Warning("Para DDL en Supabase usa conexión directa (puerto 5432) en MIGRATION_DB_URL");
    }
}

app.Run();

// Requerido para WebApplicationFactory en integration tests (.NET 9)
public partial class Program { }
