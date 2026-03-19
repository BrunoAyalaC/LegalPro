using System.Text.Json;

namespace LegalPro.Application.Common.Extensions;

/// <summary>
/// Extensiones de JsonElement compartidas entre todos los handlers CQRS.
/// Evita duplicar el mismo helper en cada archivo de handler.
/// </summary>
public static class JsonElementExtensions
{
    /// <summary>Lee una propiedad string de un JsonElement, con fallback seguro.</summary>
    public static string GetStringOrDefault(this JsonElement el, string prop, string @default = "")
        => el.TryGetProperty(prop, out var v) ? v.GetString() ?? @default : @default;

    /// <summary>Lee una propiedad string de un JsonElement raíz, con fallback seguro.</summary>
    public static string GetPropertyOrDefault(this JsonElement el, string prop, string @default = "")
        => el.TryGetProperty(prop, out var v) ? v.GetString() ?? @default : @default;

    /// <summary>Lee un array de strings de un JsonElement, con fallback a lista vacía.</summary>
    public static IReadOnlyList<string> GetStringArrayOrDefault(this JsonElement el, string prop)
    {
        if (!el.TryGetProperty(prop, out var arr) || arr.ValueKind != JsonValueKind.Array)
            return Array.Empty<string>();
        return arr.EnumerateArray().Select(e => e.GetString() ?? "").Where(s => s.Length > 0).ToList();
    }

    /// <summary>Lee una propiedad int de un JsonElement, con fallback seguro.</summary>
    public static int GetIntOrDefault(this JsonElement el, string prop, int @default = 0)
    {
        if (!el.TryGetProperty(prop, out var v)) return @default;
        return v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) ? i : @default;
    }

    /// <summary>Lee una propiedad bool de un JsonElement, con fallback seguro.</summary>
    public static bool GetBoolOrDefault(this JsonElement el, string prop, bool @default = false)
    {
        if (!el.TryGetProperty(prop, out var v)) return @default;
        return v.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => @default
        };
    }
}
