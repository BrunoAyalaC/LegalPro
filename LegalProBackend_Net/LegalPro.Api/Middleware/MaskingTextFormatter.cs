using Serilog.Events;
using Serilog.Formatting;
using System;
using System.IO;
using System.Text.RegularExpressions;

namespace LegalPro.Api.Middleware;

/// <summary>
/// Formateador decorador de Serilog que filtra y enmascara de forma proactiva
/// datos personales y sensibles (DNI, contraseñas, emails, tokens JWT) antes de escribirlos.
/// Garantiza el cumplimiento de normativas de protección de datos (como la Ley N° 29733 en Perú).
/// </summary>
public class MaskingTextFormatter : ITextFormatter
{
    private readonly ITextFormatter _innerFormatter;

    // Expresiones regulares compiladas para detección eficiente:
    // 1. Valores asociados a contraseñas o hashes en JSON
    // 2. Valores asociados a tokens, JWTs o cabeceras de autorización en JSON
    // 3. Tokens JWT libres (cadenas que inician con eyJ o eyj y siguen formato Base64Url de JWT)
    // 4. DNI peruano (8 dígitos numéricos aislados)
    // 5. Direcciones de correo electrónico
    private static readonly Regex SensitiveDataRegex = new Regex(
        @"(?<=(?:""password""|""contraseña""|""contrasena""|""passwordHash""|""password_hash"")\s*:\s*"")[^""]+" +
        @"|(?=(?:""token""|""tokenAccess""|""accessToken""|""refreshToken""|""jwt""|""Authorization""))(?<=\s*:\s*"")[^""]+" +
        @"|\bey[Jj]hbGciOiJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*\b" +
        @"|\b\d{8}\b" +
        @"|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public MaskingTextFormatter(ITextFormatter innerFormatter)
    {
        _innerFormatter = innerFormatter ?? throw new ArgumentNullException(nameof(innerFormatter));
    }

    public void Format(LogEvent logEvent, TextWriter output)
    {
        using (var sw = new StringWriter())
        {
            _innerFormatter.Format(logEvent, sw);
            var logMessage = sw.ToString();

            // Reemplazo e inyección de máscara
            var maskedMessage = SensitiveDataRegex.Replace(logMessage, m =>
            {
                var val = m.Value;

                // 1. Detección de Email
                if (val.Contains("@"))
                {
                    var parts = val.Split('@');
                    if (parts[0].Length > 2)
                    {
                        return $"{parts[0][0]}***{parts[0][parts[0].Length - 1]}@{parts[1]}";
                    }
                    return $"***@{parts[1]}";
                }

                // 2. Detección de DNI (8 dígitos)
                if (val.Length == 8 && long.TryParse(val, out _))
                {
                    return "********";
                }

                // 3. Detección de JWT largo
                if (val.StartsWith("ey", StringComparison.OrdinalIgnoreCase))
                {
                    return "ey***[MASKED_JWT]***";
                }

                // 4. Contraseñas u otros tokens genéricos
                return "********";
            });

            output.Write(maskedMessage);
        }
    }
}
