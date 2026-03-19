using LegalPro.Domain.Common;
using LegalPro.Domain.Enums;
using LegalPro.Domain.Events;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Domain.Entities;

/// <summary>
/// Entidad de membresía: representa la pertenencia de un Usuario a una Organizacion
/// con un rol específico (Owner, Admin, Member, Viewer).
/// Es el join entity del aggregate multi-tenant.
/// </summary>
public class MiembroOrganizacion : BaseGuidEntity
{
    public Guid OrganizacionId { get; private set; }
    public Organizacion? Organizacion { get; private set; }

    public int UsuarioId { get; private set; }
    public Usuario? Usuario { get; private set; }

    public RolMiembro Rol { get; private set; } = RolMiembro.Member;

    public int? InvitadoPorId { get; private set; }
    public DateTime? InvitadoEn { get; private set; }
    public DateTime UnidoEn { get; private set; } = DateTime.UtcNow;
    public bool Activo { get; private set; } = true;

    private MiembroOrganizacion() { }

    /// <summary>Factory: única forma de crear una membresía.</summary>
    public static MiembroOrganizacion Crear(Guid orgId, int usuarioId, RolMiembro rol, int? invitadoPorId = null)
    {
        if (orgId == Guid.Empty)
            throw new DomainException("El ID de la organización es obligatorio.");

        if (usuarioId <= 0)
            throw new DomainException("El ID del usuario es obligatorio.");

        var miembro = new MiembroOrganizacion
        {
            Id = Guid.NewGuid(),
            OrganizacionId = orgId,
            UsuarioId = usuarioId,
            Rol = rol,
            InvitadoPorId = invitadoPorId,
            InvitadoEn = invitadoPorId.HasValue ? DateTime.UtcNow : null,
            UnidoEn = DateTime.UtcNow,
            Activo = true,
            CreatedAt = DateTime.UtcNow
        };

        miembro.AddDomainEvent(new MiembroAgregadoEvent(miembro.Id, orgId, usuarioId, rol.ToString()));
        return miembro;
    }

    /// <summary>Actualiza el rol del miembro dentro de la organización.</summary>
    public void CambiarRol(RolMiembro nuevoRol)
    {
        if (!Activo)
            throw new DomainException("No se puede cambiar el rol de un miembro inactivo.");

        Rol = nuevoRol;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Desactiva la membresía (soft delete).</summary>
    public void Desactivar()
    {
        if (!Activo)
            throw new DomainException("La membresía ya está inactiva.");

        Activo = false;
        UpdatedAt = DateTime.UtcNow;

        AddDomainEvent(new MiembroRemovidoEvent(OrganizacionId, UsuarioId));
    }
}
