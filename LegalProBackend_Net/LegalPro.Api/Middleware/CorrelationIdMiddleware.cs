using Microsoft.AspNetCore.Http;
using Serilog.Context;
using System;
using System.Threading.Tasks;

namespace LegalPro.Api.Middleware;

/// <summary>
/// Middleware de Correlation ID (OWASP A09 - Seguridad en Logs y Monitoreo).
/// Genera un identificador único por solicitud si no se provee en las cabeceras HTTP,
/// lo añade a los encabezados de la respuesta para el cliente y lo inyecta en el contexto de Serilog.
/// </summary>
public class CorrelationIdMiddleware
{
    private const string CorrelationIdHeaderKey = "X-Correlation-ID";
    private readonly RequestDelegate _next;

    public CorrelationIdMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Headers.TryGetValue(CorrelationIdHeaderKey, out var correlationId))
        {
            correlationId = Guid.NewGuid().ToString();
        }

        // Agregar Correlation ID a la respuesta para trazabilidad del cliente
        context.Response.OnStarting(() =>
        {
            if (!context.Response.Headers.ContainsKey(CorrelationIdHeaderKey))
            {
                context.Response.Headers.Append(CorrelationIdHeaderKey, correlationId);
            }
            return Task.CompletedTask;
        });

        // Inyectar en el contexto de logs de Serilog para que aparezca en todos los logs del request
        using (LogContext.PushProperty("CorrelationId", correlationId.ToString()))
        {
            await _next(context);
        }
    }
}
