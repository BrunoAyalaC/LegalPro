using LegalPro.Domain.Common;

namespace LegalPro.Domain.Entities;

/// <summary>
/// Representa un documento o escrito asociado a un expediente.
/// Por ahora almacena metadatos y contenido textual/URL (no archivos binarios).
/// </summary>
public class Documento : BaseGuidEntity
{
    public string Titulo { get; private set; } = string.Empty;
    public string? Contenido { get; private set; }
    public string? Url { get; private set; }
    public string Tipo { get; private set; } = "escrito"; // escrito, anexo, nota, etc.

    public Guid ExpedienteId { get; private set; }
    public Expediente? Expediente { get; private set; }

    public Guid OrganizationId { get; private set; }
    public Organizacion? Organizacion { get; private set; }

    private Documento() { }

    public static Documento Crear(string titulo, string? contenido, string? url, string tipo, Guid expedienteId, Guid organizationId)
    {
        if (string.IsNullOrWhiteSpace(titulo))
            throw new Exceptions.DomainException("El título del documento es obligatorio.");

        if (expedienteId == Guid.Empty)
            throw new Exceptions.DomainException("El expediente es obligatorio.");

        if (organizationId == Guid.Empty)
            throw new Exceptions.DomainException("La organización es obligatoria.");

        return new Documento
        {
            Id = Guid.NewGuid(),
            Titulo = titulo.Trim(),
            Contenido = contenido,
            Url = url,
            Tipo = string.IsNullOrWhiteSpace(tipo) ? "escrito" : tipo.Trim().ToLowerInvariant(),
            ExpedienteId = expedienteId,
            OrganizationId = organizationId,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void Actualizar(string titulo, string? contenido, string? url, string tipo)
    {
        if (!string.IsNullOrWhiteSpace(titulo))
            Titulo = titulo.Trim();

        Contenido = contenido;
        Url = url;

        if (!string.IsNullOrWhiteSpace(tipo))
            Tipo = tipo.Trim().ToLowerInvariant();

        UpdatedAt = DateTime.UtcNow;
    }
}
