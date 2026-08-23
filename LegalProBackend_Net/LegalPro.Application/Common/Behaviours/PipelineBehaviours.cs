using System.Reflection;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using Serilog.Core;
using Serilog.Events;

namespace LegalPro.Application.Common.Behaviours;

/// <summary>
/// MediatR Pipeline Behaviour: runs all FluentValidation validators
/// BEFORE the handler executes. If any fail, throws ValidationException.
/// </summary>
public class ValidationBehaviour<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly IEnumerable<IValidator<TRequest>> _validators;

    public ValidationBehaviour(IEnumerable<IValidator<TRequest>> validators)
    {
        _validators = validators;
    }

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        if (_validators.Any())
        {
            var context = new ValidationContext<TRequest>(request);
            var validationResults = await Task.WhenAll(
                _validators.Select(v => v.ValidateAsync(context, cancellationToken)));

            var failures = validationResults
                .SelectMany(r => r.Errors)
                .Where(f => f != null)
                .ToList();

            if (failures.Count != 0)
                throw new ValidationException(failures);
        }

        return await next();
    }
}

// ═══════════════════════════════════════════════════════════
// PII MASKING — FIX P2 perf+seguridad 2026-08-21
// Evita que Serilog / Microsoft.Extensions.Logging filtre PII (LPDP Ley 29733)
// - [NotLogged] attribute: marcar propiedades sensibles en Commands/Queries/DTOs
// - PiiMaskingDestructuringPolicy : IDestructuringPolicy (Serilog) → oculta Password/Email/DNI antes de enriquecer
// - PiiMaskingHelper.Mask(): filtra antes de ILogger.LogInformation (defensa en profundidad)
// Uso en Program.cs: .Destructure.With<PiiMaskingDestructuringPolicy>()
// ═══════════════════════════════════════════════════════════

/// <summary>
/// Marca una propiedad para que NUNCA se loggee (PII / secreto).
/// Uso: public string Password { get; set; }  →  [NotLogged] public string Password { get; set; }
/// </summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field)]
public sealed class NotLoggedAttribute : Attribute { }

/// <summary>
/// Serilog IDestructuringPolicy que enmascara PII durante la destructuración {@Request}.
/// - Oculta propiedades marcadas con [NotLogged]
/// - Oculta por convención nombres sensibles: Password, PasswordHash, Email, DNI, Token, Jwt, Secret, Authorization, etc.
/// - Email se ofusca parcialmente (a***@dominio), el resto → "***MASKED***"
/// Debe registrarse en Serilog: LoggerConfiguration().Destructure.With&lt;PiiMaskingDestructuringPolicy&gt;()
/// </summary>
public sealed class PiiMaskingDestructuringPolicy : IDestructuringPolicy
{
    private static readonly HashSet<string> SensitiveNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "password", "passwordhash", "contrasena", "contraseña", "clave",
        "email", "correo", "dni", "token", "refreshtoken", "accesstoken",
        "jwt", "authorization", "secret", "secreto", "bearer",
        "currentpassword", "newpassword", "confirmPassword"
    };

    public bool TryDestructure(object value, ILogEventPropertyValueFactory propertyFactory, out LogEventPropertyValue? result)
    {
        var type = value.GetType();

        // Solo aplica a objetos complejos (no primitivos / string / Guid / DateTime / Enum)
        if (type.IsPrimitive || value is string || value is Guid || value is DateTime || value is DateTimeOffset || type.IsEnum)
        {
            result = null;
            return false;
        }

        // Evita recursión infinita en colecciones primitivas: deja que Serilog las maneje por defecto si no tienen props relevantes
        var props = type.GetProperties(BindingFlags.Public | BindingFlags.Instance);
        if (props.Length == 0)
        {
            result = null;
            return false;
        }

        // Solo intercepta tipos que tengan al menos una prop sensible o marcada [NotLogged] para no interferir con todo el grafo
        bool hasSensitive = props.Any(p =>
            p.GetCustomAttribute<NotLoggedAttribute>() != null ||
            SensitiveNames.Contains(p.Name) ||
            SensitiveNames.Any(s => p.Name.Contains(s, StringComparison.OrdinalIgnoreCase)));

        if (!hasSensitive)
        {
            result = null;
            return false; // deja que Serilog use su destructuring default
        }

        var structureProps = new List<LogEventProperty>(props.Length);
        foreach (var prop in props)
        {
            bool isSensitive = prop.GetCustomAttribute<NotLoggedAttribute>() != null
                || SensitiveNames.Contains(prop.Name)
                || SensitiveNames.Any(s => prop.Name.Contains(s, StringComparison.OrdinalIgnoreCase));

            object? rawValue;
            try { rawValue = prop.GetValue(value); }
            catch { rawValue = null; }

            LogEventPropertyValue propValue;
            if (isSensitive && rawValue != null)
            {
                var masked = MaskValue(prop.Name, rawValue);
                propValue = new ScalarValue(masked);
            }
            else
            {
                // Usa factory para respetar destructuring recursivo + límite de profundidad
                propValue = propertyFactory.CreatePropertyValue(rawValue, true);
            }

            structureProps.Add(new LogEventProperty(prop.Name, propValue));
        }

        result = new StructureValue(structureProps, type.Name);
        return true;
    }

    private static string MaskValue(string propName, object raw)
    {
        var s = raw.ToString() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(s)) return "***MASKED***";

        // Email: ofuscación parcial a***b@dominio (LPDP — conserva dominio para correlación)
        if (propName.Equals("Email", StringComparison.OrdinalIgnoreCase) ||
            propName.Contains("email", StringComparison.OrdinalIgnoreCase) ||
            propName.Contains("correo", StringComparison.OrdinalIgnoreCase))
        {
            if (s.Contains('@'))
            {
                var parts = s.Split('@', 2);
                var local = parts[0];
                var domain = parts[1];
                if (local.Length <= 2) return $"***@{domain}";
                return $"{local[0]}***{local[^1]}@{domain}";
            }
            return "***MASKED***";
        }

        // DNI: 8 dígitos → ********
        if (propName.Contains("dni", StringComparison.OrdinalIgnoreCase) && s.Length == 8 && long.TryParse(s, out _))
            return "********";

        // JWT / Token largo
        if (s.StartsWith("ey", StringComparison.OrdinalIgnoreCase) && s.Length > 20)
            return "ey***[MASKED_JWT]***";

        return "***MASKED***";
    }
}

/// <summary>
/// Helper síncrono para filtrar PII ANTES de pasar a ILogger (defensa en profundidad).
/// LoggingBehaviour lo usa para no depender exclusivamente de Serilog DestructuringPolicy.
/// </summary>
public static class PiiMaskingHelper
{
    private static readonly HashSet<string> SensitiveNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "password", "passwordhash", "contrasena", "contraseña", "clave",
        "email", "correo", "dni", "token", "refreshtoken", "accesstoken",
        "jwt", "authorization", "secret", "secreto", "bearer"
    };

    public static object? Mask(object? obj)
    {
        if (obj == null) return null;
        var type = obj.GetType();

        // Primitivos / string / Guid / DateTime → devolver tal cual (no son contenedores PII por sí mismos)
        if (type.IsPrimitive || obj is string || obj is Guid || obj is DateTime || obj is DateTimeOffset || type.IsEnum)
            return obj;

        // Colecciones: mapear cada elemento
        if (obj is System.Collections.IEnumerable enumerable && type != typeof(string))
        {
            // Evita expandir strings; para listas de DTOs, devolver lista masked
            if (type.IsArray || (type.IsGenericType && typeof(System.Collections.IEnumerable).IsAssignableFrom(type)))
            {
                var list = new List<object?>();
                foreach (var item in enumerable)
                    list.Add(Mask(item));
                return list;
            }
        }

        var props = type.GetProperties(BindingFlags.Public | BindingFlags.Instance);
        if (props.Length == 0) return obj;

        var dict = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var prop in props)
        {
            object? raw;
            try { raw = prop.GetValue(obj); } catch { raw = null; }

            bool isSensitive = prop.GetCustomAttribute<NotLoggedAttribute>() != null
                || SensitiveNames.Contains(prop.Name)
                || SensitiveNames.Any(s => prop.Name.Contains(s, StringComparison.OrdinalIgnoreCase));

            if (isSensitive && raw != null)
            {
                dict[prop.Name] = MaskScalar(prop.Name, raw);
            }
            else if (raw != null && !raw.GetType().IsPrimitive && raw is not string && raw is not Guid && raw is not DateTime && raw is not DateTimeOffset && !raw.GetType().IsEnum)
            {
                // Objeto anidado: recursivo shallow (1 nivel) para no explotar grafo
                // Solo recursar si el tipo anidado tiene props sensibles, si no dejar raw para que logger lo serialice
                var nestedProps = raw.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance);
                bool nestedHasSensitive = nestedProps.Any(p =>
                    p.GetCustomAttribute<NotLoggedAttribute>() != null ||
                    SensitiveNames.Contains(p.Name) ||
                    SensitiveNames.Any(s => p.Name.Contains(s, StringComparison.OrdinalIgnoreCase)));
                dict[prop.Name] = nestedHasSensitive ? Mask(raw) : raw;
            }
            else
            {
                dict[prop.Name] = raw;
            }
        }
        return dict;
    }

    private static string MaskScalar(string propName, object raw)
    {
        var s = raw.ToString() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(s)) return "***MASKED***";
        if ((propName.Equals("Email", StringComparison.OrdinalIgnoreCase) || propName.Contains("email", StringComparison.OrdinalIgnoreCase)) && s.Contains('@'))
        {
            var parts = s.Split('@', 2);
            var local = parts[0];
            if (local.Length <= 2) return $"***@{parts[1]}";
            return $"{local[0]}***{local[^1]}@{parts[1]}";
        }
        if (propName.Contains("dni", StringComparison.OrdinalIgnoreCase) && s.Length == 8 && long.TryParse(s, out _))
            return "********";
        if (s.StartsWith("ey", StringComparison.OrdinalIgnoreCase) && s.Length > 20)
            return "ey***[MASKED_JWT]***";
        return "***MASKED***";
    }
}

/// <summary>
/// MediatR Pipeline Behaviour: logs every request/response for observability.
/// FIX P2: filtra PII antes de loggear (NotLogged + PiiMaskingHelper) y se apoya en PiiMaskingDestructuringPolicy para Serilog.
/// </summary>
public class LoggingBehaviour<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly ILogger<LoggingBehaviour<TRequest, TResponse>> _logger;

    public LoggingBehaviour(ILogger<LoggingBehaviour<TRequest, TResponse>> logger)
    {
        _logger = logger;
    }

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        var requestName = typeof(TRequest).Name;
        // FIX P2 LPDP: nunca loggear PII sin masking — filtrar ANTES de Serilog
        var maskedRequest = PiiMaskingHelper.Mask(request);
        _logger.LogInformation("[CQRS] Handling {RequestName} {@Request}", requestName, maskedRequest);

        var response = await next();

        var maskedResponse = PiiMaskingHelper.Mask(response);
        _logger.LogInformation("[CQRS] Handled {RequestName} -> {@Response}", requestName, maskedResponse);

        return response;
    }
}

/// <summary>
/// MediatR Pipeline Behaviour: catches unhandled exceptions and logs them.
/// FIX P2: también enmascara PII en el log de excepción.
/// </summary>
public class UnhandledExceptionBehaviour<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly ILogger<UnhandledExceptionBehaviour<TRequest, TResponse>> _logger;

    public UnhandledExceptionBehaviour(ILogger<UnhandledExceptionBehaviour<TRequest, TResponse>> logger)
    {
        _logger = logger;
    }

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        try
        {
            return await next();
        }
        catch (Exception ex)
        {
            var requestName = typeof(TRequest).Name;
            var maskedRequest = PiiMaskingHelper.Mask(request);
            _logger.LogError(ex, "[CQRS] Unhandled Exception for Request {RequestName} {@Request}", requestName, maskedRequest);
            throw;
        }
    }
}
