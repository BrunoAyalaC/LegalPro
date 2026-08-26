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
using OpenTelemetry.Trace;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;

var builder = WebApplication.CreateBuilder(args);

// Add support for Railway environment variables
builder.Configuration.AddEnvironmentVariables();

// ── Serilog full configuration ────────────────────────────────────────────
builder.Host.UseSerilog((ctx, cfg) =>
{
    var consoleFormatter = new MaskingTextFormatter(new Serilog.Formatting.Display.MessageTemplateTextFormatter(
        "[{Timestamp:HH:mm:ss} {Level:u3}] {SourceContext}: {Message:lj}{NewLine}{Exception}", null));

    var fileFormatter = new MaskingTextFormatter(new Serilog.Formatting.Display.MessageTemplateTextFormatter(
        "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {SourceContext}: {Message:lj}{NewLine}{Exception}", null));

    cfg.ReadFrom.Configuration(ctx.Configuration)
       .Enrich.FromLogContext()
       .Enrich.WithProperty("Application", "LegalPro.Api")
       .Enrich.WithProperty("Environment", ctx.HostingEnvironment.EnvironmentName)
       // FIX P2 LPDP 2026-08-21: Serilog DestructuringPolicy global para PII (Password/Email/DNI + [NotLogged])
       // Complementa PiiMaskingHelper.Mask() en LoggingBehaviour (defensa en profundidad) y MaskingTextFormatter (fallback texto)
       .Destructure.With<LegalPro.Application.Common.Behaviours.PiiMaskingDestructuringPolicy>()
       .WriteTo.Console(consoleFormatter)
       .WriteTo.File(
           formatter: fileFormatter,
           path: "logs/legalpro-.log",
           rollingInterval: RollingInterval.Day,
           retainedFileCountLimit: 7);
});


// ── Rate Limiting particionado por tenant (OWASP API4 / CWE-770 — R-02 Fix 2026-08-21) ───────
// PartitionedRateLimiter: cada tenant (organization_id) tiene su propio bucket 60/min y minimax 10/min.
// Fallback a RemoteIpAddress si no hay JWT (anon) para evitar bloqueo global cross-tenant.
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.OnRejected = async (ctx, ct) =>
    {
        ctx.HttpContext.Response.Headers["Retry-After"] = "60";
        await ctx.HttpContext.Response.WriteAsync(
            "{\"error\":\"Demasiadas solicitudes. Intente nuevamente en 60 segundos.\"}", ct);
    };

    // Regla general particionada: 60 req/min por tenant (organization_id) o IP anon
    o.AddPolicy("per_tenant", context => RateLimitPartition.GetSlidingWindowLimiter(
        partitionKey: context.User.FindFirst("organization_id")?.Value ?? context.Connection.RemoteIpAddress?.ToString() ?? "anon",
        factory: _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = 60,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            SegmentsPerWindow = 4
        }));

    // Regla MiniMax estricta particionada: 10 req/min por tenant (costoso en tokens)
    o.AddPolicy("minimax", context => RateLimitPartition.GetSlidingWindowLimiter(
        partitionKey: context.User.FindFirst("organization_id")?.Value ?? context.Connection.RemoteIpAddress?.ToString() ?? "anon",
        factory: _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            SegmentsPerWindow = 4
        }));
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

// IMemoryCache: requerido por IdempotencyMiddleware y BruteForceProtectionMiddleware
builder.Services.AddMemoryCache();

// Clean Architecture Layers (DDD + CQRS + FluentValidation + Pipeline Behaviours)
builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);

// ── OpenTelemetry Tracing & Metrics (OTel) — R-01 Fix 2026-08-21 ────────────────
// FIX DEPLOY (2026-08-26): la observabilidad NO tumba producción. Si falta
// OTEL_EXPORTER_OTLP_ENDPOINT en Production → log warning y continúa sin OTel
// (fail-open para telemetría; fail-closed se reserva para seguridad/LPDP).
// Desarrollo: ConsoleExporter para debug local.
if (builder.Environment.IsProduction())
{
    var otlpEndpoint = builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"];
    if (string.IsNullOrWhiteSpace(otlpEndpoint))
    {
        Console.WriteLine("[otel] WARNING: OTEL_EXPORTER_OTLP_ENDPOINT no configurado — tracing/metrics DESACTIVADOS (el servicio continúa).");
    }
    else
    {
        builder.Services.AddOpenTelemetry()
        .WithTracing(tracing =>
        {
            tracing
                .AddAspNetCoreInstrumentation(opts => { opts.RecordException = true; })
                .AddHttpClientInstrumentation()
                .AddEntityFrameworkCoreInstrumentation(opts => { opts.SetDbStatementForText = true; })
                .AddSource("LegalPro.Api")
                .AddOtlpExporter(o => { o.Endpoint = new Uri(otlpEndpoint); });
        })
        .WithMetrics(metrics =>
        {
            metrics
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddRuntimeInstrumentation()
                .AddMeter("LegalPro.Api")
                .AddOtlpExporter(o => { o.Endpoint = new Uri(otlpEndpoint); });
        });
    }
}
else // Development / Testing / Staging — ConsoleExporter (sin OTLP)
{
    builder.Services.AddOpenTelemetry()
        .WithTracing(tracing =>
        {
            tracing
                .AddAspNetCoreInstrumentation(opts => { opts.RecordException = true; })
                .AddHttpClientInstrumentation()
                .AddEntityFrameworkCoreInstrumentation(opts => { opts.SetDbStatementForText = true; })
                .AddSource("LegalPro.Api")
                .AddConsoleExporter();
        })
        .WithMetrics(metrics =>
        {
            metrics
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddRuntimeInstrumentation()
                .AddMeter("LegalPro.Api")
                .AddConsoleExporter();
        });
}

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

// ── Cadena de conexión: DATABASE_URL (Railway) tiene prioridad ──────────
// Railway inyecta DATABASE_URL en formato URI (postgresql://user:pass@host:5432/db).
// Npgsql requiere formato key-value — se convierte explícitamente para evitar errores
// de "initialization string". Fallback: ConnectionStrings:DefaultConnection.
// NOTA: el DbContext real se registra en AddInfrastructureServices (ya prioriza
// DATABASE_URL); este bloque evita que el arranque falle cuando solo existe DATABASE_URL.
var rawDbUrl = builder.Configuration["DATABASE_URL"] ?? builder.Configuration["DATABASE_PUBLIC_URL"];
var connectionString = string.IsNullOrEmpty(rawDbUrl)
    ? builder.Configuration.GetConnectionString("DefaultConnection")
    : rawDbUrl;

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

// Solo lanzar si no hay NINGUNA cadena de conexión configurada
if (string.IsNullOrEmpty(connectionString))
    throw new InvalidOperationException("Cadena de conexión no configurada: define DATABASE_URL o ConnectionStrings:DefaultConnection.");

// ── Health Checks — R-01: separación liveness vs readiness ──────────────────
// - postgres + outbox => tag "ready" (depende de BD)
// - self => tag "live" (siempre Healthy, sin dependencias)
builder.Services.AddHealthChecks()
    .AddNpgSql(connectionString, name: "postgres", tags: new[] { "ready" })
    .AddCheck<LegalPro.Infrastructure.HealthChecks.OutboxHealthCheck>("outbox", tags: new[] { "ready" })
    .AddCheck("self", () => Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy(), tags: new[] { "live" });

// JWT_SECRET NUNCA debe tener fallback con valor fijo — si falta la variable, falla al arrancar
var jwtSecret = builder.Configuration["JWT_SECRET"]
    ?? builder.Configuration["JwtSettings:Secret"]
    ?? throw new InvalidOperationException("JWT_SECRET no está configurado. Configura la variable de entorno en Railway.");

var minimaxKey = builder.Configuration["MINIMAX_API_KEY"] ?? builder.Configuration["Minimax:ApiKey"];
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
            RequireExpirationTime = true,
            RequireSignedTokens = true,
            ClockSkew = TimeSpan.Zero,
            ValidIssuer = "LegalProAPI",
            ValidAudience = "LegalProClients",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var authorization = context.Request.Headers.Authorization.ToString();
                if (string.IsNullOrEmpty(authorization))
                {
                    if (context.Request.Cookies.TryGetValue("__Secure-Session", out var cookieToken))
                    {
                        context.Token = cookieToken;
                    }
                }
                return Task.CompletedTask;
            }
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

app.UseMiddleware<CorrelationIdMiddleware>();

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

// Idempotencia — garantiza que peticiones POST con X-Idempotency-Key
// se procesen exactamente una vez (OWASP API6, LPDP Art. 7)
app.UseMiddleware<IdempotencyMiddleware>();

app.UseMiddleware<TenantMiddleware>();
app.UseAuthorization();

// Serilog request logging — registra cada HTTP request con duración y status
app.UseSerilogRequestLogging(opts =>
{
    opts.MessageTemplate = "HTTP {RequestMethod} {RequestPath} → {StatusCode} en {Elapsed:0.0}ms";
});

app.MapControllers().RequireRateLimiting("per_tenant");

// ── Health Checks — R-01: liveness vs readiness (OWASP + K8s) ───────────────
// /health/live  → tag "live"  (no toca DB, siempre Healthy si proceso vivo)
// /health/ready → tag "ready" (postgres + outbox → requiere BD)
// /health       → legacy → también readiness (compatibilidad Dockerfile/legacy probes)
app.MapHealthChecks("/health/live", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = r => r.Tags.Contains("live")
});
app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = r => r.Tags.Contains("ready")
});
app.MapHealthChecks("/health", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = r => r.Tags.Contains("ready")
});

// ── EF Core Migrations en startup ──────────────────────────────────────────
// Solo en Production para evitar fallo en Development/Testing sin DB real.
if (app.Environment.IsProduction())
{
    try
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Workaround: BD compartida Node.js + EF Core (Railway PostgreSQL).
        // __ef_migrations_history puede estar vacío aunque las tablas existan.
        const string historyTable = "__ef_migrations_history";

        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
            await conn.OpenAsync();

        await using var checkCmd = conn.CreateCommand();
        checkCmd.CommandText = $@"
            SELECT
                EXISTS(SELECT 1 FROM information_schema.tables
                       WHERE table_schema='public' AND table_name='usuarios')
                AND EXISTS(SELECT 1 FROM information_schema.columns
                       WHERE table_schema='public' AND table_name='expedientes'
                         AND column_name='organization_id')
                AND (
                    NOT EXISTS(SELECT 1 FROM information_schema.tables
                               WHERE table_schema='public' AND table_name='{historyTable}')
                    OR (SELECT COUNT(*) FROM {historyTable}) = 0
                )";
        var needsSeed = (bool)(await checkCmd.ExecuteScalarAsync() ?? false);

        if (needsSeed)
        {
            Log.Information("Schema Node/Railway detectado. Sembrando historial EF Core (sin migraciones destructivas)...");
            await using var seedCmd = conn.CreateCommand();
            seedCmd.CommandText = $@"
                CREATE TABLE IF NOT EXISTS {historyTable} (
                    migration_id character varying(150) NOT NULL PRIMARY KEY,
                    product_version character varying(32) NOT NULL
                );
                INSERT INTO {historyTable} (migration_id, product_version) VALUES
                    ('20260305222244_InitialCreate',              '9.0.1'),
                    ('20260312184741_UpdateSchema',               '9.0.1'),
                    ('20260316191058_AddMensajeChatRefreshToken', '9.0.1'),
                    ('20260319011004_SnakeCaseColumns',           '9.0.1'),
                    ('20260413033854_PendingModelChanges',        '9.0.1'),
                    ('20260521213343_UnifyDatabaseModel',         '9.0.1'),
                    ('20260522004427_AddOutboxMessagesTable',      '9.0.1')
                ON CONFLICT (migration_id) DO NOTHING";
            await seedCmd.ExecuteNonQueryAsync();

            await using var outboxCmd = conn.CreateCommand();
            outboxCmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS outbox_messages (
                    id uuid PRIMARY KEY,
                    type varchar(255) NOT NULL,
                    content text NOT NULL,
                    occurred_on_utc timestamptz NOT NULL,
                    processed_on_utc timestamptz,
                    error text,
                    retry_count integer NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS ix_outbox_messages_processed_on_utc ON outbox_messages (processed_on_utc);";
            await outboxCmd.ExecuteNonQueryAsync();
            Log.Information("Historial EF sembrado; UnifyDatabaseModel marcada como aplicada (schema Node preservado).");
        }

        // Si el schema es el de Node (organization_id en expedientes), marcar migraciones
        // destructivas como aplicadas para que EF no las ejecute sobre la BD compartida.
        await using var nodeSchemaCmd = conn.CreateCommand();
        nodeSchemaCmd.CommandText = @"
            SELECT EXISTS(
              SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='expedientes' AND column_name='organization_id'
            )";
        var isNodeSchema = (bool)(await nodeSchemaCmd.ExecuteScalarAsync() ?? false);

        if (isNodeSchema)
        {
            await using var markCmd = conn.CreateCommand();
            markCmd.CommandText = $@"
                CREATE TABLE IF NOT EXISTS {historyTable} (
                    migration_id character varying(150) NOT NULL PRIMARY KEY,
                    product_version character varying(32) NOT NULL
                );
                INSERT INTO {historyTable} (migration_id, product_version) VALUES
                    ('20260413033854_PendingModelChanges',   '9.0.1'),
                    ('20260521213343_UnifyDatabaseModel',    '9.0.1'),
                    ('20260522004427_AddOutboxMessagesTable', '9.0.1')
                ON CONFLICT (migration_id) DO NOTHING";
            await markCmd.ExecuteNonQueryAsync();

            await using var outboxEnsureCmd = conn.CreateCommand();
            outboxEnsureCmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS outbox_messages (
                    id uuid PRIMARY KEY,
                    type varchar(255) NOT NULL,
                    content text NOT NULL,
                    occurred_on_utc timestamptz NOT NULL,
                    processed_on_utc timestamptz,
                    error text,
                    retry_count integer NOT NULL DEFAULT 0
                )";
            await outboxEnsureCmd.ExecuteNonQueryAsync();
        }

        // Patch incondicional: columnas que EF espera en schema Node
        await using var alwaysPatchCmd = conn.CreateCommand();
        alwaysPatchCmd.CommandText = @"
            ALTER TABLE IF EXISTS usuarios
                ADD COLUMN IF NOT EXISTS es_admin_organizacion BOOLEAN NOT NULL DEFAULT FALSE;";
        await alwaysPatchCmd.ExecuteNonQueryAsync();

        await db.Database.MigrateAsync();
        Log.Information("EF Core migrations aplicadas correctamente.");
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Error aplicando EF Core migrations al iniciar. El servicio continúa.");
        Log.Warning("Si las migraciones no están aplicadas, ejecuta: dotnet ef database update");
        Log.Warning("Para DDL en Railway PostgreSQL usa MIGRATION_DB_URL si aplica.");
    }
}

app.Run();

// Requerido para WebApplicationFactory en integration tests (.NET 9)
public partial class Program { }
