namespace LegalPro.Application.Common.Interfaces;

// ═══════════════════════════════════════════════════════
// ISP: Interface Segregation Principle
// C/u interfaz cubre UNA responsabilidad. Los handlers
// consumen solo la interfaz que necesitan.
// ═══════════════════════════════════════════════════════

/// <summary>Core: cualquier prompt libre a Gemini.</summary>
public interface IGeminiClient
{
    Task<string> GenerateAsync(string prompt, string model = "gemini-2.5-flash");
}

/// <summary>ISP: análisis de documentos legales.</summary>
public interface ILegalAnalyzer
{
    Task<string> AnalyzeLegalDocumentAsync(string documentText);
}

/// <summary>ISP: predicción de resultados judiciales (diferenciada por rol).</summary>
public interface ILegalPredictor
{
    Task<string> PredictOutcomeAsync(string hechos, string materia, string juzgadoSala, string juez, string rol = "ABOGADO");
}

/// <summary>ISP: generador de alegatos de clausura (defensa o acusación).</summary>
public interface ILegalAlegato
{
    Task<string> GenerarAlegatoAsync(string tipoAlegato, string ramaDerecho, string hechos, string rolUsuario);
}

/// <summary>ISP: estrategia de interrogatorio diferenciada por rol (NCPP art. 370-378).</summary>
public interface ILegalInterrogatorio
{
    Task<string> GenerarEstrategiaInterrogatorioAsync(string nombreTestigo, string tipoTestigo, string hechosClave, string objetivo, string rol = "ABOGADO");
}

/// <summary>ISP: asistente de objeciones en tiempo real (abogado objeta al fiscal; fiscal objeta a defensa).</summary>
public interface ILegalObjeciones
{
    Task<string> SugerirObjecionAsync(string fragmentoAdversarial, string ramaDerecho, string etapaJuicio, string rol = "ABOGADO");
}

/// <summary>ISP: resumen ejecutivo de caso adaptado al rol (defensa/acusación/judicial).</summary>
public interface ILegalResumenCaso
{
    Task<string> GenerarResumenCasoAsync(string expedienteJson, string documentosTexto, string rol = "ABOGADO");
}

// ── Interfaces específicas por rol ─────────────────────────────────────────

/// <summary>ISP: herramientas exclusivas del Fiscal del Ministerio Público.</summary>
public interface ILegalFiscal
{
    /// <summary>Genera requerimientos fiscales: acusación, sobreseimiento, formalización, prisión preventiva.</summary>
    Task<string> GenerarRequerimientoFiscalAsync(string tipoRequerimiento, string hechos, string imputado, string delito, string ramaDerecho);
}

/// <summary>ISP: herramientas exclusivas del Juez / Magistrado.</summary>
public interface ILegalJuez
{
    /// <summary>Genera resoluciones judiciales con rubros formales: VISTOS, CONSIDERANDO, FALLO.</summary>
    Task<string> GenerarResolucionJudicialAsync(string tipoResolucion, string hechos, string pretensiones, string mediosProbatorios, string ramaDerecho);

    /// <summary>Compara el caso con precedentes vinculantes del TC, Casaciones y Acuerdos Plenarios.</summary>
    Task<string> CompararPrecedentesAsync(string casoActual, string ramaDerecho, string tipoResolucionBuscada, string rol = "JUEZ");
}

/// <summary>ISP: herramientas exclusivas del Perito Contador Judicial.</summary>
public interface ILegalContador
{
    /// <summary>Calcula liquidaciones laborales: CTS, vacaciones, gratificaciones, indemnización, intereses BCRP.</summary>
    Task<string> CalcularLiquidacionLaboralAsync(string datosEmpleadoJson, string motivoCese);

    /// <summary>Genera informes periciales contables con estructura oficial del PJ peruano.</summary>
    Task<string> GenerarInformePericialAsync(string tipoPericia, string hallazgosJson);
}

/// <summary>ISP: chat conversacional multi-turn.</summary>
public interface ILegalChat
{
    Task<string> ChatLegalAsync(string history, string userInput);
}

/// <summary>ISP: redacción de escritos legales.</summary>
public interface ILegalDrafter
{
    Task<string> DraftDocumentAsync(string promptData);
}

/// <summary>ISP: contexto genérico para simulaciones (legado).</summary>
public interface ISimulationAI
{
    Task<string> GenerateSystemResponseAsync(string userPrompt, string context);
}

/// <summary>
/// ISP: Simulación de juicio interactiva multi-turn.
/// Gemini actúa como la parte adversarial (Juez, Fiscal o Defensa).
/// IniciarSimulacion devuelve JSON: { contextoSintetico, mensajeJuez, mensajeAdversarial }.
/// ProcesarTurno devuelve JSON: { mensajeRespuesta, puntajeDelta, leyesInvocadas, esFinSimulacion }.
/// </summary>
public interface ILegalSimulacion
{
    Task<string> IniciarSimulacionAsync(
        string rama,
        string rolUsuario,
        string dificultad,
        string descripcionCaso);

    Task<string> ProcesarTurnoSimulacionAsync(
        string historialTurnos,
        string intervencionUsuario,
        string rolAdversarial);
}

/// <summary>
/// ISP: Búsqueda de jurisprudencia con Google Search grounding (deep search).
/// Retorna JSON: { resultados: [{ tribunal, numero, anio, resumen, relevancia }] }.
/// </summary>
public interface ILegalJurisprudenciaSearch
{
    Task<string> BuscarJurisprudenciaAsync(string query, string rama = "", int limit = 5);
}

/// <summary>
/// Aggregate: único punto de inyección para backward compatibility.
/// Nuevo código debe inyectar la interfaz segregada específica (ISP).
/// Roles: ILegalFiscal | ILegalJuez | ILegalContador para herramientas rol-específicas.
/// </summary>
public interface IGeminiService
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
