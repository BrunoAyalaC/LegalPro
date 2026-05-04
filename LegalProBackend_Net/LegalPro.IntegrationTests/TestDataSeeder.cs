using LegalPro.Domain.Entities;
using LegalPro.Domain.Enums;
using LegalPro.Infrastructure.Persistence;

namespace LegalPro.IntegrationTests;

/// <summary>
/// Helper para sembrar datos de prueba en la base de datos en memoria.
/// Los IDs coinciden con los claims emitidos por <see cref="TestAuthHandler"/>.
/// </summary>
public static class TestDataSeeder
{
    public static readonly Guid TestOrgId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static readonly Guid TestUserId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    public static async Task SeedAsync(ApplicationDbContext context)
    {
        if (context.Organizaciones.Any() || context.Usuarios.Any())
            return; // Ya hay datos sembrados

        var organizacion = Organizacion.Crear("Test Organization", "test-org", PlanTipo.Free);
        // Forzar el ID para que coincida con TestAuthHandler
        organizacion.GetType().GetProperty("Id")!.SetValue(organizacion, TestOrgId);

        var usuario = Usuario.Crear(
            "Test User",
            "test@legalpro.test",
            "fake-hash-for-testing",
            RolUsuario.Abogado,
            EspecialidadDerecho.Penal);
        // Forzar el ID para que coincida con TestAuthHandler
        usuario.GetType().GetProperty("Id")!.SetValue(usuario, TestUserId);
        usuario.AsignarOrganizacion(TestOrgId, esAdmin: true);

        // La membresía se crea automáticamente al agregar el usuario a la org
        // pero en este caso solo necesitamos que existan las entidades base.

        context.Organizaciones.Add(organizacion);
        context.Usuarios.Add(usuario);

        await context.SaveChangesAsync();
    }
}
