using LegalPro.Domain.Enums;

namespace LegalPro.Infrastructure.Persistence.Conversions;

/// <summary>
/// Mapeo bidireccional entre valores TEXT del schema Node.js (Railway)
/// y enums del dominio .NET en la tabla expedientes.
/// </summary>
public static class NodeExpedienteMappings
{
    public static string TipoToDb(TipoRamaProcesal tipo) => tipo switch
    {
        TipoRamaProcesal.ContenciosoAdministrativo => "administrativo",
        _ => tipo.ToString().ToLowerInvariant(),
    };

    public static TipoRamaProcesal TipoFromDb(string value)
    {
        var key = (value ?? string.Empty).Trim().ToLowerInvariant();
        return key switch
        {
            "administrativo" or "contencioso_administrativo" or "contenciosoadministrativo"
                => TipoRamaProcesal.ContenciosoAdministrativo,
            _ => Enum.Parse<TipoRamaProcesal>(value, ignoreCase: true),
        };
    }

    public static string EstadoToDb(EstadoExpediente estado) => estado switch
    {
        EstadoExpediente.EnTramite => "en_tramite",
        _ => estado.ToString().ToLowerInvariant(),
    };

    public static EstadoExpediente EstadoFromDb(string value)
    {
        var key = (value ?? string.Empty).Trim().ToLowerInvariant();
        return key switch
        {
            "suspendido" => EstadoExpediente.Suspendido,
            "cerrado" => EstadoExpediente.Cerrado,
            "en_tramite" or "entramite" => EstadoExpediente.EnTramite,
            "resuelto" => EstadoExpediente.Sentenciado,
            _ => Enum.Parse<EstadoExpediente>(value, ignoreCase: true),
        };
    }
}
