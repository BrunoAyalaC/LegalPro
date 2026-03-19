using FluentAssertions;
using FluentValidation;
using LegalPro.Application.Auth.Commands;
using LegalPro.Application.Auth.Queries;

namespace LegalPro.UnitTests.Controllers;

// ══════════════════════════════════════════════════════════════════════════════
// Tests de validación de comandos Auth — sin mocks, solo lógica pura.
// RegisterCommand no tiene AbstractValidator, LoginQuery tampoco.
// Testeamos las reglas de dominio que sí podemos verificar sin infraestructura.
// ══════════════════════════════════════════════════════════════════════════════

public class RegisterCommandTests
{
    [Fact]
    public void RegisterCommand_Default_Rol_Es_Abogado()
    {
        var command = new RegisterCommand();
        command.Rol.Should().Be("Abogado");
    }

    [Fact]
    public void RegisterCommand_Con_Todos_Los_Campos_Correctamente_Asignados()
    {
        var command = new RegisterCommand
        {
            NombreCompleto = "María García Torres",
            Email = "maria@estudio.pe",
            Password = "Segura123!",
            Rol = "Fiscal",
            Especialidad = "Penal"
        };

        command.NombreCompleto.Should().Be("María García Torres");
        command.Email.Should().Be("maria@estudio.pe");
        command.Rol.Should().Be("Fiscal");
        command.Especialidad.Should().Be("Penal");
    }

    [Theory]
    [InlineData("Abogado")]
    [InlineData("Juez")]
    [InlineData("Fiscal")]
    [InlineData("Contador")]
    public void RegisterCommand_Roles_Validos_Se_Asignan(string rol)
    {
        var command = new RegisterCommand { Rol = rol };
        command.Rol.Should().Be(rol);
    }
}

public class LoginQueryTests
{
    [Fact]
    public void LoginQuery_Inicializa_Con_Email_Y_Password_Vacios()
    {
        var query = new LoginQuery();
        query.Email.Should().BeEmpty();
        query.Password.Should().BeEmpty();
    }

    [Fact]
    public void LoginQuery_Asigna_Credenciales_Correctamente()
    {
        var query = new LoginQuery
        {
            Email = "juez@pj.gob.pe",
            Password = "Clave123!"
        };

        query.Email.Should().Be("juez@pj.gob.pe");
        query.Password.Should().Be("Clave123!");
    }
}
