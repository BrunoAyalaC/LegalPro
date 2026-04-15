using LegalPro.Domain.Common;

namespace LegalPro.Domain.Events;

/// <summary>Raised when a new user is registered.</summary>
public class UsuarioRegistradoEvent : DomainEvent
{
    public Guid UsuarioId { get; }
    public string Email { get; }
    public string Rol { get; }

    public UsuarioRegistradoEvent(Guid usuarioId, string email, string rol)
    {
        UsuarioId = usuarioId;
        Email = email;
        Rol = rol;
    }
}

/// <summary>Raised when a new expediente is created.</summary>
public class ExpedienteCreadoEvent : DomainEvent
{
    public int ExpedienteId { get; }
    public string Numero { get; }
    public Guid UsuarioId { get; }

    public ExpedienteCreadoEvent(int expedienteId, string numero, Guid usuarioId)
    {
        ExpedienteId = expedienteId;
        Numero = numero;
        UsuarioId = usuarioId;
    }
}

/// <summary>Raised when a simulation finishes.</summary>
public class SimulacionFinalizadaEvent : DomainEvent
{
    public int SimulacionId { get; }
    public int PuntajeFinal { get; }
    public Guid UsuarioId { get; }

    public SimulacionFinalizadaEvent(int simulacionId, int puntajeFinal, Guid usuarioId)
    {
        SimulacionId = simulacionId;
        PuntajeFinal = puntajeFinal;
        UsuarioId = usuarioId;
    }
}

/// <summary>Raised when an expediente changes state.</summary>
public class ExpedienteEstadoCambiadoEvent : DomainEvent
{
    public int ExpedienteId { get; }
    public string EstadoAnterior { get; }
    public string EstadoNuevo { get; }

    public ExpedienteEstadoCambiadoEvent(int expedienteId, string estadoAnterior, string estadoNuevo)
    {
        ExpedienteId = expedienteId;
        EstadoAnterior = estadoAnterior;
        EstadoNuevo = estadoNuevo;
    }
}

/// <summary>Raised when a new organization is created.</summary>
public class OrganizacionCreadaEvent : DomainEvent
{
    public Guid OrgId { get; }
    public string Slug { get; }
    public string Plan { get; }

    public OrganizacionCreadaEvent(Guid orgId, string slug, string plan)
    {
        OrgId = orgId;
        Slug = slug;
        Plan = plan;
    }
}

/// <summary>Raised when an invitation is sent to join an organization.</summary>
public class InvitacionEnviadaEvent : DomainEvent
{
    public Guid InvitacionId { get; }
    public string Email { get; }
    public Guid OrgId { get; }

    public InvitacionEnviadaEvent(Guid invitacionId, string email, Guid orgId)
    {
        InvitacionId = invitacionId;
        Email = email;
        OrgId = orgId;
    }
}

/// <summary>Raised when a user joins an organization.</summary>
public class UsuarioUnidoAOrganizacionEvent : DomainEvent
{
    public Guid UsuarioId { get; }
    public Guid OrgId { get; }

    public UsuarioUnidoAOrganizacionEvent(Guid usuarioId, Guid orgId)
    {
        UsuarioId = usuarioId;
        OrgId = orgId;
    }
}

/// <summary>Raised when a member is added to an organization via the membership table.</summary>
public class MiembroAgregadoEvent : DomainEvent
{
    public Guid MiembroId { get; }
    public Guid OrgId { get; }
    public Guid UsuarioId { get; }
    public string Rol { get; }

    public MiembroAgregadoEvent(Guid miembroId, Guid orgId, Guid usuarioId, string rol)
    {
        MiembroId = miembroId;
        OrgId = orgId;
        UsuarioId = usuarioId;
        Rol = rol;
    }
}

/// <summary>Raised when a member is removed from an organization.</summary>
public class MiembroRemovidoEvent : DomainEvent
{
    public Guid OrgId { get; }
    public Guid UsuarioId { get; }

    public MiembroRemovidoEvent(Guid orgId, Guid usuarioId)
    {
        OrgId = orgId;
        UsuarioId = usuarioId;
    }
}

/// <summary>Raised when an invitation is accepted.</summary>
public class InvitacionAceptadaEvent : DomainEvent
{
    public Guid InvitacionId { get; }
    public Guid OrgId { get; }
    public string Email { get; }

    public InvitacionAceptadaEvent(Guid invitacionId, Guid orgId, string email)
    {
        InvitacionId = invitacionId;
        OrgId = orgId;
        Email = email;
    }
}

/// <summary>Raised when an organization changes its subscription plan.</summary>
public class PlanCambiadoEvent : DomainEvent
{
    public Guid OrgId { get; }
    public string PlanAnterior { get; }
    public string PlanNuevo { get; }

    public PlanCambiadoEvent(Guid orgId, string planAnterior, string planNuevo)
    {
        OrgId = orgId;
        PlanAnterior = planAnterior;
        PlanNuevo = planNuevo;
    }
}

/// <summary>Raised when a tenant reaches a plan resource limit.</summary>
public class LimiteTenantAlcanzadoEvent : DomainEvent
{
    public Guid OrgId { get; }
    public string RecursoTipo { get; }
    public int LimiteActual { get; }

    public LimiteTenantAlcanzadoEvent(Guid orgId, string recursoTipo, int limiteActual)
    {
        OrgId = orgId;
        RecursoTipo = recursoTipo;
        LimiteActual = limiteActual;
    }
}
