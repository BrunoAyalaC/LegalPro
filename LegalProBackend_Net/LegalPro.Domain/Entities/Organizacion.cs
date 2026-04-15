using LegalPro.Domain.Common;
using LegalPro.Domain.Enums;
using LegalPro.Domain.Events;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Domain.Entities;

/// <summary>
/// Aggregate Root: Organizacion (el Tenant principal del sistema multi-tenant).
/// Cada organización puede tener N usuarios y N expedientes según su plan.
/// </summary>
public class Organizacion : BaseGuidEntity
{
    public string Nombre { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;
    public PlanTipo Plan { get; private set; } = PlanTipo.Free;
    public int MaxUsuarios { get; private set; }
    public int MaxExpedientes { get; private set; }
    public decimal StorageGbLimit { get; private set; }
    public bool Activo { get; private set; } = true;
    /// <summary>JSON con configuración extendida del tenant (features flags, notificaciones, etc.).</summary>
    public string? Config { get; private set; }

    // Navigation
    public ICollection<Usuario> Miembros { get; private set; } = new List<Usuario>();
    public ICollection<MiembroOrganizacion> MembresiaDetallada { get; private set; } = new List<MiembroOrganizacion>();
    public ICollection<InvitacionOrganizacion> Invitaciones { get; private set; } = new List<InvitacionOrganizacion>();

    private Organizacion() { }

    /// <summary>Factory: única forma de crear una Organizacion.</summary>
    public static Organizacion Crear(string nombre, string slug, PlanTipo plan = PlanTipo.Free)
    {
        if (string.IsNullOrWhiteSpace(nombre))
            throw new DomainException("El nombre de la organización es obligatorio.");

        if (string.IsNullOrWhiteSpace(slug))
            throw new DomainException("El slug de la organización es obligatorio.");

        var (maxUsuarios, maxExpedientes, storageGb) = ObtenerLimitesDePlan(plan);

        var org = new Organizacion
        {
            Id = Guid.NewGuid(),
            Nombre = nombre.Trim(),
            Slug = slug.Trim().ToLowerInvariant(),
            Plan = plan,
            MaxUsuarios = maxUsuarios,
            MaxExpedientes = maxExpedientes,
            StorageGbLimit = storageGb,
            Activo = true,
            CreatedAt = DateTime.UtcNow
        };

        org.AddDomainEvent(new OrganizacionCreadaEvent(org.Id, org.Slug, org.Plan.ToString()));
        return org;
    }

    /// <summary>Cambia el plan y actualiza los límites correspondientes.</summary>
    public void CambiarPlan(PlanTipo nuevoPlan)
    {
        var planAnterior = Plan.ToString();
        Plan = nuevoPlan;
        (MaxUsuarios, MaxExpedientes, StorageGbLimit) = ObtenerLimitesDePlan(nuevoPlan);
        UpdatedAt = DateTime.UtcNow;
        AddDomainEvent(new PlanCambiadoEvent(Id, planAnterior, Plan.ToString()));
    }

    /// <summary>Agrega un miembro a la organización verificando el límite del plan.</summary>
    public MiembroOrganizacion AgregarMiembro(Guid usuarioId, RolMiembro rol, Guid? invitadoPorId = null)
    {
        if (!Activo)
            throw new DomainException("La organización está desactivada.");

        var countActual = MembresiaDetallada.Count(m => m.Activo);
        if (countActual >= MaxUsuarios)
        {
            AddDomainEvent(new LimiteTenantAlcanzadoEvent(Id, "usuario", MaxUsuarios));
            throw new DomainException(
                $"Ha alcanzado el límite de {MaxUsuarios} usuario(s) para el plan {Plan}. Actualice su plan.");
        }

        var miembro = MiembroOrganizacion.Crear(Id, usuarioId, rol, invitadoPorId);
        MembresiaDetallada.Add(miembro);
        return miembro;
    }

    /// <summary>Remueve un miembro de la organización. No permite remover al único Owner.</summary>
    public void RemoverMiembro(Guid usuarioId)
    {
        var miembro = MembresiaDetallada.FirstOrDefault(m => m.UsuarioId == usuarioId && m.Activo)
            ?? throw new DomainException("El usuario no es miembro activo de esta organización.");

        if (miembro.Rol == RolMiembro.Owner)
        {
            var owners = MembresiaDetallada.Count(m => m.Rol == RolMiembro.Owner && m.Activo);
            if (owners <= 1)
                throw new DomainException("No se puede remover al único Owner de la organización.");
        }

        miembro.Desactivar();
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Desactiva la organización. Los usuarios no podrán usarla.</summary>
    public void Desactivar()
    {
        if (!Activo)
            throw new DomainException("La organización ya está desactivada.");

        Activo = false;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Verifica si se ha alcanzado el límite del plan para el recurso indicado.
    /// Lanza DomainException si se superó y dispara LimiteTenantAlcanzadoEvent.
    /// </summary>
    public void VerificarLimites(string recursoTipo, int countActual)
    {
        if (!Activo)
            throw new DomainException("La organización está desactivada.");

        var limite = recursoTipo.ToLowerInvariant() switch
        {
            "expediente" => MaxExpedientes,
            "usuario" => MaxUsuarios,
            _ => int.MaxValue
        };

        if (countActual >= limite)
        {
            AddDomainEvent(new LimiteTenantAlcanzadoEvent(Id, recursoTipo, limite));
            throw new DomainException(
                $"Ha alcanzado el límite de {limite} {recursoTipo}(s) para el plan {Plan}. " +
                $"Actualice su plan para continuar.");
        }
    }

    private static (int maxUsuarios, int maxExpedientes, decimal storageGb) ObtenerLimitesDePlan(PlanTipo plan) =>
        plan switch
        {
            PlanTipo.Free => (3, 10, 1m),
            PlanTipo.Pro => (20, 200, 50m),
            PlanTipo.Enterprise => (int.MaxValue, int.MaxValue, 1000m),
            _ => (3, 10, 1m)
        };
}
