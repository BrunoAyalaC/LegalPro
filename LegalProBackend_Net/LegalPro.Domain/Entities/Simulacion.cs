using LegalPro.Domain.Common;
using LegalPro.Domain.Enums;
using LegalPro.Domain.Events;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Domain.Entities;

/// <summary>
/// Aggregate Root: Simulación de Juicio
/// Manages the lifecycle of a trial simulation session.
/// </summary>
public class Simulacion : BaseEntity
{
    public Guid UsuarioId { get; private set; }
    public Usuario? Usuario { get; private set; }

    public Guid? OrganizationId { get; private set; }

    public TipoRamaProcesal RamaDerecho { get; private set; }
    public string RolUsuario { get; private set; } = string.Empty;
    public string DificultadModificador { get; private set; } = string.Empty;

    public string ContextoSintetico { get; private set; } = string.Empty;
    public int PuntajeActual { get; private set; } = 100;
    public bool EstaFinalizada { get; private set; } = false;

    private readonly List<EventoSimulacion> _eventos = new();
    public IReadOnlyCollection<EventoSimulacion> Eventos => _eventos.AsReadOnly();

    private Simulacion() { }

    public static Simulacion Crear(Guid usuarioId, TipoRamaProcesal rama, string rolUsuario, string dificultad, string contextoIA)
    {
        if (string.IsNullOrWhiteSpace(rolUsuario))
            throw new DomainException("El rol del usuario en la simulación es obligatorio.");

        return new Simulacion
        {
            UsuarioId = usuarioId,
            RamaDerecho = rama,
            RolUsuario = rolUsuario,
            DificultadModificador = dificultad,
            ContextoSintetico = contextoIA,
            PuntajeActual = 100,
            EstaFinalizada = false,
            CreatedAt = DateTime.UtcNow
        };
    }

    public EventoSimulacion AgregarEvento(string emisor, string mensaje, string? leyesInvocadas = null)
    {
        if (EstaFinalizada)
            throw new DomainException("No se pueden agregar eventos a una simulación finalizada.");

        var turno = _eventos.Count > 0 ? _eventos.Max(e => e.Turno) + 1 : 0;

        var evento = EventoSimulacion.Crear(Id, turno, emisor, mensaje, leyesInvocadas);
        _eventos.Add(evento);

        return evento;
    }

    public void AjustarPuntaje(int delta)
    {
        PuntajeActual = Math.Max(0, PuntajeActual + delta);
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetOrganizationId(Guid? organizationId)
    {
        OrganizationId = organizationId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Finalizar()
    {
        if (EstaFinalizada)
            throw new DomainException("La simulación ya está finalizada.");

        EstaFinalizada = true;
        UpdatedAt = DateTime.UtcNow;

        AddDomainEvent(new SimulacionFinalizadaEvent(Id, PuntajeActual, UsuarioId));
    }
}

/// <summary>
/// Child entity within the Simulacion aggregate.
/// </summary>
public class EventoSimulacion : BaseEntity
{
    public int SimulacionId { get; private set; }
    public Simulacion? Simulacion { get; private set; }

    public int Turno { get; private set; }
    public string Emisor { get; private set; } = string.Empty;
    public string Mensaje { get; private set; } = string.Empty;
    public string? LeyesInvocadas { get; private set; }

    private EventoSimulacion() { }

    public static EventoSimulacion Crear(int simulacionId, int turno, string emisor, string mensaje, string? leyesInvocadas = null)
    {
        return new EventoSimulacion
        {
            SimulacionId = simulacionId,
            Turno = turno,
            Emisor = emisor,
            Mensaje = mensaje,
            LeyesInvocadas = leyesInvocadas,
            CreatedAt = DateTime.UtcNow
        };
    }
}
