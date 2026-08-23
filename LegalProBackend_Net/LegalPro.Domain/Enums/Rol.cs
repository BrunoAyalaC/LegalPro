namespace LegalPro.Domain.Enums;

/// <summary>
/// Roles de membresía dentro de una organización (tenant).
/// Utilizados para RBAC a nivel de organización.
/// 
/// Jerarquía de permisos:
///   OWNER  → Control total, puede gestionar facturación y eliminar la org
///   ADMIN  → Gestión de miembros, configuración de la org
///   MEMBER → Acceso a funcionalidades según su plan
///   VIEWER → Solo lectura de recursos compartidos
/// </summary>
public enum Rol
{
    /// <summary>Propietario de la organización — control total.</summary>
    OWNER = 0,

    /// <summary>Administrador — gestiona miembros y configuración.</summary>
    ADMIN = 1,

    /// <summary>Miembro — acceso a funcionalidades del plan.</summary>
    MEMBER = 2,

    /// <summary>Invitado/viewer — solo lectura.</summary>
    VIEWER = 3
}
