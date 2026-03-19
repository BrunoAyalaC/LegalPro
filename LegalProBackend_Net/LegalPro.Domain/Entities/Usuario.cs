using LegalPro.Domain.Common;
using LegalPro.Domain.Enums;
using LegalPro.Domain.Events;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Domain.Entities;

/// <summary>
/// Aggregate Root: Usuario
/// Contains business logic for user registration, role validation, and password management.
/// </summary>
public class Usuario : BaseEntity
{
    public string NombreCompleto { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public RolUsuario Rol { get; private set; } = RolUsuario.Abogado;
    public EspecialidadDerecho Especialidad { get; private set; } = EspecialidadDerecho.General;
    public bool EstaActivo { get; private set; } = true;

    // Multi-tenancy
    public Guid? OrganizationId { get; private set; }
    public bool EsAdminOrganizacion { get; private set; } = false;
    public Organizacion? Organizacion { get; private set; }

    // Navigation
    public ICollection<Expediente> Expedientes { get; private set; } = new List<Expediente>();
    public ICollection<Simulacion> Simulaciones { get; private set; } = new List<Simulacion>();

    // EF Core requires parameterless constructor
    private Usuario() { }

    /// <summary>Factory method: the ONLY way to create a Usuario.</summary>
    public static Usuario Crear(string nombreCompleto, string email, string passwordHash, RolUsuario rol, EspecialidadDerecho especialidad)
    {
        if (string.IsNullOrWhiteSpace(nombreCompleto))
            throw new DomainException("El nombre completo es obligatorio.");

        if (string.IsNullOrWhiteSpace(email))
            throw new DomainException("El email es obligatorio.");

        if (string.IsNullOrWhiteSpace(passwordHash))
            throw new DomainException("El password hash es obligatorio.");

        var usuario = new Usuario
        {
            NombreCompleto = nombreCompleto.Trim(),
            Email = email.Trim().ToLowerInvariant(),
            PasswordHash = passwordHash,
            Rol = rol,
            Especialidad = especialidad,
            EstaActivo = true,
            CreatedAt = DateTime.UtcNow
        };

        usuario.AddDomainEvent(new UsuarioRegistradoEvent(usuario.Id, usuario.Email, rol.ToString()));

        return usuario;
    }

    /// <summary>Asigna al usuario a una organización. Opcionalmente lo marca como administrador.</summary>
    public void AsignarOrganizacion(Guid orgId, bool esAdmin = false)
    {
        OrganizationId = orgId;
        EsAdminOrganizacion = esAdmin;
        UpdatedAt = DateTime.UtcNow;
        AddDomainEvent(new UsuarioUnidoAOrganizacionEvent(Id, orgId));
    }

    public void CambiarEspecialidad(EspecialidadDerecho nuevaEspecialidad)
    {
        Especialidad = nuevaEspecialidad;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Desactivar()
    {
        EstaActivo = false;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ActualizarPassword(string nuevoHash)
    {
        if (string.IsNullOrWhiteSpace(nuevoHash))
            throw new DomainException("El hash de la contraseña no puede estar vacío.");

        PasswordHash = nuevoHash;
        UpdatedAt = DateTime.UtcNow;
    }
}
