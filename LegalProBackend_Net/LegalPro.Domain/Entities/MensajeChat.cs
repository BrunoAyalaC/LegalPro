using LegalPro.Domain.Common;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Domain.Entities;

/// <summary>
/// Entidad de dominio: MensajeChat
/// Persiste el historial de conversaciones legales por usuario y organización.
/// Permite retomar conversaciones entre sesiones (multi-turn persistido).
/// </summary>
public class MensajeChat : BaseEntity
{
    public int UsuarioId { get; private set; }
    public Guid? OrganizationId { get; private set; }

    /// <summary>"user" o "assistant"</summary>
    public string Rol { get; private set; } = string.Empty;
    public string Contenido { get; private set; } = string.Empty;

    /// <summary>Permite agrupar mensajes de una misma conversación.</summary>
    public Guid SesionId { get; private set; }

    // Navigation
    public Usuario? Usuario { get; private set; }

    private MensajeChat() { }

    public static MensajeChat Crear(int usuarioId, Guid? organizationId, string rol, string contenido, Guid sesionId)
    {
        if (string.IsNullOrWhiteSpace(contenido))
            throw new DomainException("El contenido del mensaje no puede estar vacío.");

        if (rol != "user" && rol != "assistant")
            throw new DomainException("El rol del mensaje debe ser 'user' o 'assistant'.");

        return new MensajeChat
        {
            UsuarioId = usuarioId,
            OrganizationId = organizationId,
            Rol = rol,
            Contenido = contenido,
            SesionId = sesionId,
            CreatedAt = DateTime.UtcNow,
        };
    }
}
