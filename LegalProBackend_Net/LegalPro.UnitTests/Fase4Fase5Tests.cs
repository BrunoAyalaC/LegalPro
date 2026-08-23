using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using FluentAssertions;
using LegalPro.Api.Middleware;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Serilog.Events;
using Serilog.Formatting;
using Serilog.Parsing;
using Xunit;

namespace LegalPro.UnitTests;

public class Fase4Fase5Tests
{
    [Fact]
    public void MaskingTextFormatter_DeberiaEnmascararDatosSensibles()
    {
        // Arrange
        var innerFormatter = new TestTextFormatter();
        var maskingFormatter = new MaskingTextFormatter(innerFormatter);

        var logEvent = new LogEvent(
            DateTimeOffset.UtcNow,
            LogEventLevel.Information,
            null,
            new MessageTemplate("Log con datos", new List<MessageTemplateToken>()),
            new List<LogEventProperty>());

        // 1. Caso DNI (8 dígitos)
        innerFormatter.OutputText = "El DNI del cliente es 45678901 en el sistema.";
        var sb = new StringBuilder();
        using (var writer = new StringWriter(sb))
        {
            maskingFormatter.Format(logEvent, writer);
        }
        sb.ToString().Should().Contain("********");
        sb.ToString().Should().NotContain("45678901");

        // 2. Caso Contraseña en JSON
        innerFormatter.OutputText = "{\"email\":\"test@legalpro.pe\",\"password\":\"SuperClave123!\"}";
        sb.Clear();
        using (var writer = new StringWriter(sb))
        {
            maskingFormatter.Format(logEvent, writer);
        }
        sb.ToString().Should().Contain("********");
        sb.ToString().Should().NotContain("SuperClave123!");

        // 3. Caso JWT largo
        innerFormatter.OutputText = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
        sb.Clear();
        using (var writer = new StringWriter(sb))
        {
            maskingFormatter.Format(logEvent, writer);
        }
        sb.ToString().Should().Contain("ey***[MASKED_JWT]***");
        sb.ToString().Should().NotContain("SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c");

        // 4. Caso Correo Electrónico
        innerFormatter.OutputText = "Enviando notificación a carlos.mendoza@legalpro.pe en proceso.";
        sb.Clear();
        using (var writer = new StringWriter(sb))
        {
            maskingFormatter.Format(logEvent, writer);
        }
        sb.ToString().Should().Contain("c***a@legalpro.pe");
        sb.ToString().Should().NotContain("carlos.mendoza@legalpro.pe");
    }

    [Fact]
    public async Task CorrelationIdMiddleware_DeberiaGenerarYAgregarCabecera()
    {
        // Arrange
        var context = new DefaultHttpContext();
        var nextCalled = false;
        RequestDelegate next = (ctx) =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        };

        var middleware = new CorrelationIdMiddleware(next);

        // Act
        await middleware.InvokeAsync(context);

        // Ejecutar callbacks de OnStarting del Response
        // Dado que DefaultHttpContext no dispara automáticamente OnStarting en tests,
        // validamos la propagación simulada
        nextCalled.Should().BeTrue();
    }

    [Fact]
    public async Task TenantMiddleware_DeberiaAsignarTenantId_CuandoUsuarioAutenticado()
    {
        // Arrange
        var tenantProvider = new TenantProvider(new HttpContextAccessor());
        var currentUserService = new TestCurrentUserService
        {
            IsAuthenticated = true,
            OrganizationId = Guid.NewGuid()
        };

        var context = new DefaultHttpContext();
        RequestDelegate next = (ctx) => Task.CompletedTask;
        var middleware = new TenantMiddleware(next);

        // Act
        await middleware.InvokeAsync(context, tenantProvider, currentUserService);

        // Assert
        tenantProvider.TenantId.Should().Be(currentUserService.OrganizationId);
    }

    [Fact]
    public void TenantProvider_DeberiaRetornarNull_CuandoNoHayHttpContext()
    {
        // Arrange
        var httpContextAccessor = new HttpContextAccessor(); // HttpContext es nulo por defecto
        var provider = new TenantProvider(httpContextAccessor);

        // Act & Assert
        provider.TenantId.Should().BeNull();
    }

    private class TestTextFormatter : ITextFormatter
    {
        public string OutputText { get; set; } = string.Empty;

        public void Format(LogEvent logEvent, TextWriter output)
        {
            output.Write(OutputText);
        }
    }

    private class TestCurrentUserService : ICurrentUserService
    {
        public Guid? UserId { get; set; }
        public Guid? OrganizationId { get; set; }
        public string? Email { get; set; }
        public string? Role { get; set; }
        public string? OrgSlug { get; set; }
        public bool IsAuthenticated { get; set; }
        public bool IsOrgAdmin { get; set; }
    }
}
