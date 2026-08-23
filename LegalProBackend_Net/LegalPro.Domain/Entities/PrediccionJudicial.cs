using System;
using System.ComponentModel.DataAnnotations.Schema;
using LegalPro.Domain.Common;

namespace LegalPro.Domain.Entities;

[Table("predicciones_judiciales")]
public class PrediccionJudicial : ITenantEntity
{
    [Column("id")]
    public Guid Id { get; set; }

    [Column("organization_id")]
    public Guid? OrganizationId { get; set; }

    [Column("probabilidad_exito")]
    public decimal ProbabilidadExito { get; set; }
}
