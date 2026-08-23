using System;

namespace LegalPro.Domain.Common;

/// <summary>
/// Interfaz para marcar entidades que soportan borrado lógico (Soft Delete).
/// Permite aplicar filtros globales en el DbContext de forma automática.
/// </summary>
public interface ISoftDelete
{
    DateTime? DeletedAt { get; }
}
