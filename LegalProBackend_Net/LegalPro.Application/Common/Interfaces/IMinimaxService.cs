using LegalPro.Application.Common.Interfaces;

namespace LegalPro.Application.Common.Interfaces;

// FIX MERGE (2026-08-23): este archivo duplicaba las interfaces segregadas
// (IGeminiClient, ILegalAnalyzer, ...) que ya viven en IGeminiService.cs
// → CS0101 duplicate definition. Ahora contiene SOLO el aggregate.
// Las interfaces segregadas: ver IGeminiService.cs.

/// <summary>
/// Aggregate: único punto de inyección para backward compatibility.
/// Nuevo código debe inyectar la interfaz segregada específica (ISP).
/// Roles: ILegalFiscal | ILegalJuez | ILegalContador para herramientas rol-específicas.
/// </summary>
public interface IMinimaxService
    : IGeminiClient,
      ILegalAnalyzer,
      ILegalPredictor,
      ILegalChat,
      ILegalDrafter,
      ISimulationAI,
      ILegalSimulacion,
      ILegalJurisprudenciaSearch,
      ILegalAlegato,
      ILegalInterrogatorio,
      ILegalObjeciones,
      ILegalResumenCaso,
      ILegalFiscal,
      ILegalJuez,
      ILegalContador
{
}
