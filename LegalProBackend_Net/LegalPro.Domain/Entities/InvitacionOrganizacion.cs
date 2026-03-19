using System.Security.Cryptography;
using LegalPro.Domain.Common;
using LegalPro.Domain.Enums;
using LegalPro.Domain.Events;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Domain.Entities;

/// <summary>
/// Entidad: Invitación para unirse a una Organización.
/// Contiene un token único que expira y solo puede aceptarse una vez.
/// </summary>
public class InvitacionOrganizacion : BaseGuidEntity
{
    public Guid OrganizacionId { get; private set; }
    public Organizacion? Organizacion { get; private set; }

    public string Email { get; private set; } = string.Empty;
    public string Token { get; private set; } = string.Empty;
    public RolUsuario Rol { get; private set; } = RolUsuario.Abogado;
    public DateTime FechaExpiracion { get; private set; }
    public bool EsAceptada { get; private set; } = false;

    private InvitacionOrganizacion() { }

    /// <summary>Factory: crea una invitación válida por 7 días.</summary>
    public static InvitacionOrganizacion Crear(Guid orgId, string email, RolUsuario rol)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new DomainException("El email del invitado es obligatorio.");

        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace("+", "-").Replace("/", "_").Replace("=", "");

        var invitacion = new InvitacionOrganizacion
        {
            Id = Guid.NewGuid(),
            OrganizacionId = orgId,
            Email = email.Trim().ToLowerInvariant(),
            Token = token,
            Rol = rol,
            FechaExpiracion = DateTime.UtcNow.AddDays(7),
            EsAceptada = false,
            CreatedAt = DateTime.UtcNow
        };

        invitacion.AddDomainEvent(new InvitacionEnviadaEvent(invitacion.Id, invitacion.Email, orgId));
        return invitacion;
    }

    /// <summary>Marca la invitación como aceptada.</summary>
    public void Aceptar()
    {
        if (EsAceptada)
            throw new DomainException("Esta invitación ya fue aceptada.");

        if (!EsValida())
            throw new DomainException("La invitación ha expirado o no es válida.");

        EsAceptada = true;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Verifica si la invitación puede aún ser aceptada.</summary>
    public bool EsValida() => !EsAceptada && DateTime.UtcNow <= FechaExpiracion;
}
