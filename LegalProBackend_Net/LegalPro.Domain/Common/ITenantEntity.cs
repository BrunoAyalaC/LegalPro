namespace LegalPro.Domain.Common;

/// <summary>
/// Interfaz para marcar entidades que pertenecen a un tenant específico (Organización).
/// Permite aplicar filtros globales de consulta en el DbContext de forma transparente.
///
/// IMPORTANTE: OrganizationId es <see cref="Guid?"/> porque en multi-tenancy realista
/// algunas entidades permiten sesiones/registros sin organización asignada aún
/// (ej. Usuario registrado sin invitación, Simulación previa, MensajeChat bootstrap).
/// El filtro global de DbContext ya maneja correctamente el caso null:
///   - OrganizationId == null + TenantId presente  -> NO retorna la fila
///   - OrganizationId == null + TenantId null      -> NO retorna la fila (no hay tenant)
///   - OrganizationId == X     + TenantId == X     -> retorna la fila
/// </summary>
public interface ITenantEntity
{
    Guid? OrganizationId { get; }
}
