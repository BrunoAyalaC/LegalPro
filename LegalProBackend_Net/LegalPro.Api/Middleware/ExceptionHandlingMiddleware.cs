using System.Net;
using System.Text.Json;
using FluentValidation;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Api.Middleware;

/// <summary>
/// Global exception handling middleware.
/// Catches domain exceptions, validation errors, and unhandled exceptions,
/// converting them to consistent API error responses.
/// </summary>
public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var (statusCode, response) = exception switch
        {
            ValidationException validationEx => (
                HttpStatusCode.BadRequest,
                new ErrorResponse
                {
                    Type = "ValidationError",
                    Title = "Error de Validación",
                    Status = (int)HttpStatusCode.BadRequest,
                    Errors = validationEx.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray())
                }
            ),
            DomainException domainEx => (
                HttpStatusCode.UnprocessableEntity,
                new ErrorResponse
                {
                    Type = "DomainError",
                    Title = "Error de Dominio",
                    Status = (int)HttpStatusCode.UnprocessableEntity,
                    Detail = domainEx.Message
                }
            ),
            NotFoundException notFoundEx => (
                HttpStatusCode.NotFound,
                new ErrorResponse
                {
                    Type = "NotFound",
                    Title = "Recurso No Encontrado",
                    Status = (int)HttpStatusCode.NotFound,
                    Detail = notFoundEx.Message
                }
            ),
            ForbiddenAccessException => (
                HttpStatusCode.Forbidden,
                new ErrorResponse
                {
                    Type = "Forbidden",
                    Title = "Acceso Denegado",
                    Status = (int)HttpStatusCode.Forbidden,
                    Detail = "No tiene permisos para esta acción."
                }
            ),
            _ => (
                HttpStatusCode.InternalServerError,
                new ErrorResponse
                {
                    Type = "InternalError",
                    Title = "Error Interno del Servidor",
                    Status = (int)HttpStatusCode.InternalServerError,
                    Detail = "Ha ocurrido un error inesperado."
                }
            )
        };

        if (statusCode == HttpStatusCode.InternalServerError)
        {
            _logger.LogError(exception, "Unhandled exception: {Message}", exception.Message);
        }
        else
        {
            _logger.LogWarning("Handled exception [{Type}]: {Message}", exception.GetType().Name, exception.Message);
        }

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)statusCode;

        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        await context.Response.WriteAsync(json);
    }
}

public class ErrorResponse
{
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public int Status { get; set; }
    public string? Detail { get; set; }
    public Dictionary<string, string[]>? Errors { get; set; }
}
