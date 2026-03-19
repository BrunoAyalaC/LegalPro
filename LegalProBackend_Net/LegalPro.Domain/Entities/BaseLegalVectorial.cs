using LegalPro.Domain.Common;

namespace LegalPro.Domain.Entities;

/// <summary>
/// Entity for vectorized legal bases (for RAG/pgvector search).
/// </summary>
public class BaseLegalVectorial : BaseEntity
{
    public string CodigoNormativa { get; private set; } = string.Empty;
    public string Articulo { get; private set; } = string.Empty;
    public string TextoLiteral { get; private set; } = string.Empty;

    private BaseLegalVectorial() { }

    public static BaseLegalVectorial Crear(string codigoNormativa, string articulo, string textoLiteral)
    {
        return new BaseLegalVectorial
        {
            CodigoNormativa = codigoNormativa,
            Articulo = articulo,
            TextoLiteral = textoLiteral,
            CreatedAt = DateTime.UtcNow
        };
    }
}
