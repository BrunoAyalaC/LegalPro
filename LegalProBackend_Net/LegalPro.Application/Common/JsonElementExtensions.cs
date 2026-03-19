using System.Text.Json;

namespace LegalPro.Application.Common;

/// <summary>
/// Helpers de extensión para JsonElement.
/// Usados por los handlers CQRS que parsean respuestas de Function Calling de Gemini.
/// </summary>
public static class JsonElementExtensions
{
    /// <summary>Obtiene la propiedad como string, o devuelve @default si no existe.</summary>
    public static string GetStringOrDefault(this JsonElement el, string prop, string @default = "")
        => el.TryGetProperty(prop, out var v) ? v.GetString() ?? @default : @default;

    /// <summary>Obtiene la propiedad como lista de strings, o vacía si no existe.</summary>
    public static IReadOnlyList<string> GetStringArrayOrDefault(this JsonElement el, string prop)
    {
        if (!el.TryGetProperty(prop, out var arr) || arr.ValueKind != JsonValueKind.Array)
            return Array.Empty<string>();
        return arr.EnumerateArray().Select(e => e.GetString() ?? "").Where(s => s.Length > 0).ToList();
    }

    /// <summary>Obtiene la propiedad como int, o @default si no existe o no es número.</summary>
    public static int GetIntOrDefault(this JsonElement el, string prop, int @default = 0)
    {
        if (!el.TryGetProperty(prop, out var v)) return @default;
        return v.ValueKind == JsonValueKind.Number ? v.GetInt32() : @default;
    }

    /// <summary>Obtiene la propiedad como bool, o @default si no existe.</summary>
    public static bool GetBoolOrDefault(this JsonElement el, string prop, bool @default = false)
    {
        if (!el.TryGetProperty(prop, out var v)) return @default;
        return v.ValueKind == JsonValueKind.True || (v.ValueKind == JsonValueKind.False ? false : @default);
    }
}
