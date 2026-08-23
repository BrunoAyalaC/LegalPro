using System;
using FluentAssertions;
using LegalPro.Domain.Entities;
using LegalPro.Domain.Exceptions;
using LegalPro.Domain.ValueObjects;
using Xunit;

namespace LegalPro.UnitTests;

public class DomainAndOutboxTests
{
    [Fact]
    public void MontoSoles_DeberiaCrearse_ConMontoValido()
    {
        var monto = MontoSoles.Create(150.50m);
        monto.Value.Should().Be(150.50m);
        monto.ToString().Should().Be("S/. 150.50");
    }

    [Fact]
    public void MontoSoles_DeberiaLanzarExcepcion_ConMontoNegativo()
    {
        Action act = () => MontoSoles.Create(-10m);
        act.Should().Throw<DomainException>()
            .WithMessage("El monto en soles no puede ser negativo.");
    }

    [Fact]
    public void PlazoProcesal_DeberiaCalcularFechaVencimiento_DiasHabiles()
    {
        // Un viernes
        var fechaInicio = new DateTime(2026, 5, 22); 
        var plazo = PlazoProcesal.Create(3, esDiasHabiles: true);

        var fechaVencimiento = plazo.CalcularFechaVencimiento(fechaInicio);

        // Debería sumar 3 días hábiles:
        // Lunes 25 (1), Martes 26 (2), Miércoles 27 (3)
        // Omitiendo Sábado 23 y Domingo 24
        fechaVencimiento.Should().Be(new DateTime(2026, 5, 27));
    }

    [Fact]
    public void PlazoProcesal_DeberiaCalcularFechaVencimiento_DiasCalendario()
    {
        // Un viernes
        var fechaInicio = new DateTime(2026, 5, 22); 
        var plazo = PlazoProcesal.Create(3, esDiasHabiles: false);

        var fechaVencimiento = plazo.CalcularFechaVencimiento(fechaInicio);

        // Suma 3 días calendario directamente:
        // Sábado 23 (1), Domingo 24 (2), Lunes 25 (3)
        fechaVencimiento.Should().Be(new DateTime(2026, 5, 25));
    }

    [Fact]
    public void PlazoProcesal_DeberiaLanzarExcepcion_ConDiasNegativos()
    {
        Action act = () => PlazoProcesal.Create(-1, esDiasHabiles: true);
        act.Should().Throw<DomainException>()
            .WithMessage("El plazo procesal no puede ser negativo.");
    }

    [Fact]
    public void OutboxMessage_DeberiaPoderCrearseYMarcarseComoProcesado()
    {
        var id = Guid.NewGuid();
        var message = new OutboxMessage(id, "SomeType", "{}", DateTime.UtcNow);

        message.Id.Should().Be(id);
        message.Type.Should().Be("SomeType");
        message.Content.Should().Be("{}");
        message.ProcessedOnUtc.Should().BeNull();
        message.Error.Should().BeNull();
        message.RetryCount.Should().Be(0);
        message.HasExceededMaxRetries.Should().BeFalse();

        var processedTime = DateTime.UtcNow;
        message.MarkAsProcessed(processedTime);

        message.ProcessedOnUtc.Should().Be(processedTime);
        message.Error.Should().BeNull();
        message.RetryCount.Should().Be(0); // No cambia al procesar exitosamente
    }

    [Fact]
    public void OutboxMessage_DeberiaMarcarseComoFallido()
    {
        var id = Guid.NewGuid();
        var message = new OutboxMessage(id, "SomeType", "{}", DateTime.UtcNow);

        message.MarkAsFailed("Connection timeout");

        message.ProcessedOnUtc.Should().BeNull();
        message.Error.Should().Be("Connection timeout");
        message.RetryCount.Should().Be(1);
        message.HasExceededMaxRetries.Should().BeFalse();
    }

    [Fact]
    public void OutboxMessage_DeberiaIncrementarRetryCount_HastaSuperarMaximo()
    {
        var message = new OutboxMessage(Guid.NewGuid(), "SomeType", "{}", DateTime.UtcNow);

        // Primer fallo
        message.MarkAsFailed("Error 1");
        message.RetryCount.Should().Be(1);
        message.HasExceededMaxRetries.Should().BeFalse();

        // Segundo fallo
        message.MarkAsFailed("Error 2");
        message.RetryCount.Should().Be(2);
        message.HasExceededMaxRetries.Should().BeFalse();

        // Tercer fallo - supera el maximo (MaxRetryCount = 3)
        message.MarkAsFailed("Error 3");
        message.RetryCount.Should().Be(3);
        message.HasExceededMaxRetries.Should().BeTrue();

        // Ya no deberia reintentarse
        message.HasExceededMaxRetries.Should().BeTrue();
    }

    [Fact]
    public void OutboxMessage_MaxRetryCount_DeberiaSerTres()
    {
        OutboxMessage.MaxRetryCount.Should().Be(3);
    }

    [Fact]
    public void Expediente_Eliminar_DeberiaEstablecerDeletedAt()
    {
        // Arrange
        var usuarioId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var expediente = Expediente.Crear("EXP-001", "Caso de Prueba", LegalPro.Domain.Enums.TipoRamaProcesal.Penal, usuarioId, orgId);

        // Act
        expediente.Eliminar();

        // Assert
        expediente.DeletedAt.Should().NotBeNull();
        expediente.DeletedAt.Value.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(2));
    }

    [Fact]
    public void Expediente_Eliminar_DeberiaLanzarExcepcion_SiYaFueEliminado()
    {
        // Arrange
        var usuarioId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var expediente = Expediente.Crear("EXP-001", "Caso de Prueba", LegalPro.Domain.Enums.TipoRamaProcesal.Penal, usuarioId, orgId);
        expediente.Eliminar();

        // Act
        Action act = () => expediente.Eliminar();

        // Assert
        act.Should().Throw<DomainException>()
            .WithMessage("El expediente ya ha sido eliminado.");
    }
}
