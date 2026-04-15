using LegalPro.Domain.Common;
using LegalPro.Domain.Enums;
using LegalPro.Domain.Events;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Domain.Entities;

/// <summary>
/// Aggregate Root: Expediente (Case File)
/// Contains business rules for state transitions and urgency management.
/// </summary>
public class Expediente : BaseEntity
{
    public string Numero { get; private set; } = string.Empty;
    public string Titulo { get; private set; } = string.Empty;
    public TipoRamaProcesal Tipo { get; private set; }
    public EstadoExpediente Estado { get; private set; } = EstadoExpediente.Activo;
    public bool EsUrgente { get; private set; }

    public Guid UsuarioId { get; private set; }
    public Usuario? Usuario { get; private set; }

    public Guid OrganizationId { get; private set; }
    public Organizacion? Organizacion { get; private set; }

    private Expediente() { }

    public static Expediente Crear(string numero, string titulo, TipoRamaProcesal tipo, Guid usuarioId, Guid organizationId, bool esUrgente = false)
    {
        if (string.IsNullOrWhiteSpace(numero))
            throw new DomainException("El número de expediente es obligatorio.");

        if (string.IsNullOrWhiteSpace(titulo))
            throw new DomainException("El título del expediente es obligatorio.");

        var expediente = new Expediente
        {
            Numero = numero.Trim(),
            Titulo = titulo.Trim(),
            Tipo = tipo,
            UsuarioId = usuarioId,
            OrganizationId = organizationId,
            EsUrgente = esUrgente,
            Estado = EstadoExpediente.Activo,
            CreatedAt = DateTime.UtcNow
        };

        expediente.AddDomainEvent(new ExpedienteCreadoEvent(expediente.Id, expediente.Numero, usuarioId));

        return expediente;
    }

    /// <summary>
    /// Transition the case to a new state. Validates allowed transitions.
    /// </summary>
    public void CambiarEstado(EstadoExpediente nuevoEstado)
    {
        var estadoAnterior = Estado;

        // Validate transitions
        if (Estado == EstadoExpediente.Archivado)
            throw new DomainException("No se puede cambiar el estado de un expediente archivado.");

        if (Estado == nuevoEstado)
            throw new DomainException($"El expediente ya se encuentra en estado {nuevoEstado}.");

        Estado = nuevoEstado;
        UpdatedAt = DateTime.UtcNow;

        AddDomainEvent(new ExpedienteEstadoCambiadoEvent(Id, estadoAnterior.ToString(), nuevoEstado.ToString()));
    }

    public void MarcarUrgente()
    {
        EsUrgente = true;
        UpdatedAt = DateTime.UtcNow;
    }

    public void QuitarUrgencia()
    {
        EsUrgente = false;
        UpdatedAt = DateTime.UtcNow;
    }

    public void CambiarTitulo(string nuevoTitulo)
    {
        if (string.IsNullOrWhiteSpace(nuevoTitulo))
            throw new DomainException("El nuevo título no puede estar vacío.");

        Titulo = nuevoTitulo.Trim();
        UpdatedAt = DateTime.UtcNow;
    }
}
