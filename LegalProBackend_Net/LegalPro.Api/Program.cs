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
// Railway injects DATABASE_URL in URI format (postgresql://user:pass@host:5432/db)
// Npgsql requires key-value format — convert explicitly to avoid "initialization string" errors
var rawDbUrl = builder.Configuration["DATABASE_URL"] ?? builder.Configuration["DATABASE_PUBLIC_URL"];
if (!string.IsNullOrEmpty(rawDbUrl))
{
    if (rawDbUrl.StartsWith("postgresql://") || rawDbUrl.StartsWith("postgres://"))
    {
        try
        {
            var uri = new Uri(rawDbUrl);
            var userParts = uri.UserInfo.Split(':', 2);
            var dbName = uri.AbsolutePath.TrimStart('/');
            if (string.IsNullOrEmpty(dbName)) dbName = "railway";
            connectionString = $"Host={uri.Host};Port={uri.Port};Database={dbName};" +
                               $"Username={userParts[0]};Password={Uri.UnescapeDataString(userParts.Length > 1 ? userParts[1] : string.Empty)};" +
                               "SSL Mode=Prefer;Trust Server Certificate=true;";
        }
        catch
        {
            // Si el parse falla, usar la URL directamente (Npgsql 6+ la acepta en algunos contextos)
            connectionString = rawDbUrl;
        }
    }
    else
    {
        connectionString = rawDbUrl;
    }
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

// ── EF Core Migrations en startup ──────────────────────────────────────────
// Solo en Production para evitar fallo en Development/Testing sin DB real.
if (app.Environment.IsProduction())
{
    try
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Workaround: Si la DB fue creada fuera de EF (por Node.js initDb.js),
        // __EFMigrationsHistory puede estar vacío/ausente aunque las tablas existan.
        // Sembramos el historial para que MigrateAsync solo aplique migraciones nuevas.
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
            await conn.OpenAsync();

        await using var checkCmd = conn.CreateCommand();
        checkCmd.CommandText = @"
            SELECT
                EXISTS(SELECT 1 FROM information_schema.tables
                       WHERE table_schema='public' AND table_name='usuarios')
                AND (
                    NOT EXISTS(SELECT 1 FROM information_schema.tables
                               WHERE table_schema='public' AND table_name='__EFMigrationsHistory')
                    OR (SELECT COUNT(*) FROM ""__EFMigrationsHistory"") = 0
                )";
        var needsSeed = (bool)(await checkCmd.ExecuteScalarAsync() ?? false);

        if (needsSeed)
        {
            Log.Information("Schema legacy detectado. Sembrando historial de migraciones EF Core...");
            await using var seedCmd = conn.CreateCommand();
            seedCmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS ""__EFMigrationsHistory"" (
                    migration_id character varying(150) NOT NULL,
                    product_version character varying(32) NOT NULL,
                    CONSTRAINT pk___ef_migrations_history PRIMARY KEY (migration_id)
                );
                INSERT INTO ""__EFMigrationsHistory"" (migration_id, product_version) VALUES
                    ('20260305222244_InitialCreate',             '9.0.1'),
                    ('20260312184741_UpdateSchema',              '9.0.1'),
                    ('20260316191058_AddMensajeChatRefreshToken','9.0.1'),
                    ('20260319011004_SnakeCaseColumns',          '9.0.1')
                ON CONFLICT (migration_id) DO NOTHING";
            await seedCmd.ExecuteNonQueryAsync();
            Log.Information("Historial de migraciones sembrado para schema existente.");

            // Agregar columnas que EF Core espera pero que el schema legacy de Node.js no tiene
            await using var patchCmd = conn.CreateCommand();
            patchCmd.CommandText = @"
                ALTER TABLE usuarios
                    ADD COLUMN IF NOT EXISTS es_admin_organizacion BOOLEAN NOT NULL DEFAULT FALSE";
            await patchCmd.ExecuteNonQueryAsync();
            Log.Information("Schema legacy parchado: columna es_admin_organizacion agregada (IF NOT EXISTS).");
        }

        // Patch incondicional: columnas que deben existir siempre (idempotente con IF NOT EXISTS)
        // Cubre el caso donde el deploy anterior ya sembró el historial pero no ejecutó el patch.
        await using var alwaysPatchCmd = conn.CreateCommand();
        alwaysPatchCmd.CommandText = @"
            ALTER TABLE IF EXISTS usuarios
                ADD COLUMN IF NOT EXISTS es_admin_organizacion BOOLEAN NOT NULL DEFAULT FALSE;";
        await alwaysPatchCmd.ExecuteNonQueryAsync();
        Log.Information("Patch incondicional aplicado (es_admin_organizacion).");

        await db.Database.MigrateAsync();
        Log.Information("EF Core migrations aplicadas correctamente.");
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Error aplicando EF Core migrations al iniciar. El servicio continúa.");
        Log.Warning("Si las migraciones no están aplicadas, ejecuta: dotnet ef database update");
        Log.Warning("Para DDL en Supabase usa conexión directa (puerto 5432) en MIGRATION_DB_URL");
    }
}

app.Run();

// Requerido para WebApplicationFactory en integration tests (.NET 9)
public partial class Program { }
