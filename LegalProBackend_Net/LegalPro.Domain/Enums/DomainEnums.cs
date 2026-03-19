namespace LegalPro.Domain.Enums;

public enum PlanTipo
{
    Free,
    Pro,
    Enterprise
}

public enum RolUsuario
{
    Abogado,
    Fiscal,
    Juez,
    Contador
}

public enum EspecialidadDerecho
{
    Penal,
    Civil,
    Laboral,
    Constitucional,
    Familia,
    Comercial,
    Tributario,
    Administrativo,
    Ambiental,
    General
}

public enum EstadoExpediente
{
    Activo,
    EnTramite,
    Apelacion,
    Casacion,
    Archivado,
    Ejecutoria,
    Sentenciado
}

public enum TipoRamaProcesal
{
    Penal,
    Civil,
    Laboral,
    Constitucional,
    ContenciosoAdministrativo,
    Familia
}

public enum GravedadAnotacion
{
    Alta,
    Media,
    Baja
}

public enum RolMiembro
{
    Owner,
    Admin,
    Member,
    Viewer
}
