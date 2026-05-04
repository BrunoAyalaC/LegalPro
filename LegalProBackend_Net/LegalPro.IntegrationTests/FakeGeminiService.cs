using LegalPro.Application.Common.Interfaces;

namespace LegalPro.IntegrationTests;

/// <summary>
/// Implementación fake de IGeminiService para integration tests.
/// Retorna respuestas fijas deterministas para que los tests de Gemini
/// corran SIEMPRE en CI/CD sin depender de la API real.
/// </summary>
public class FakeGeminiService : IGeminiService
{
    public Task<string> GenerateAsync(string prompt, string model = "gemini-3.1-flash-lite-preview")
        => Task.FromResult($"{{ \"respuesta\": \"Fake respuesta para: {prompt[..Math.Min(prompt.Length, 50)]}...\" }}");

    public Task<string> AnalyzeLegalDocumentAsync(string documentText)
        => Task.FromResult("{ \"resumenGeneral\": \"Fake resumen del documento legal\", \"puntosClave\": [], \"riesgos\": [] }");

    public Task<string> PredictOutcomeAsync(string hechos, string materia, string juzgadoSala, string juez, string rol = "ABOGADO")
        => Task.FromResult("{ \"probabilidadExito\": 75, \"escenarioOptimista\": \"Fake\", \"escenarioPesimista\": \"Fake\" }");

    public Task<string> GenerarAlegatoAsync(string tipoAlegato, string ramaDerecho, string hechos, string rolUsuario)
        => Task.FromResult("{ \"alegato\": \"Fake alegato generado\" }");

    public Task<string> GenerarEstrategiaInterrogatorioAsync(string nombreTestigo, string tipoTestigo, string hechosClave, string objetivo, string rol = "ABOGADO")
        => Task.FromResult("{ \"estrategia\": \"Fake estrategia de interrogatorio\" }");

    public Task<string> SugerirObjecionAsync(string fragmentoAdversarial, string ramaDerecho, string etapaJuicio, string rol = "ABOGADO")
        => Task.FromResult("{ \"objecion\": \"Fake objecion sugerida\" }");

    public Task<string> GenerarResumenCasoAsync(string expedienteJson, string documentosTexto, string rol = "ABOGADO")
        => Task.FromResult("{ \"resumen\": \"Fake resumen de caso\" }");

    public Task<string> GenerarRequerimientoFiscalAsync(string tipoRequerimiento, string hechos, string imputado, string delito, string ramaDerecho)
        => Task.FromResult("{ \"requerimiento\": \"Fake requerimiento fiscal\" }");

    public Task<string> GenerarResolucionJudicialAsync(string tipoResolucion, string hechos, string pretensiones, string mediosProbatorios, string ramaDerecho)
        => Task.FromResult("{ \"resolucion\": \"Fake resolucion judicial\" }");

    public Task<string> CompararPrecedentesAsync(string casoActual, string ramaDerecho, string tipoResolucionBuscada, string rol = "JUEZ")
        => Task.FromResult("{ \"precedentes\": [] }");

    public Task<string> CalcularLiquidacionLaboralAsync(string datosEmpleadoJson, string motivoCese)
        => Task.FromResult("{ \"liquidacion\": \"Fake liquidacion\" }");

    public Task<string> GenerarInformePericialAsync(string tipoPericia, string hallazgosJson)
        => Task.FromResult("{ \"informe\": \"Fake informe pericial\" }");

    public Task<string> ChatLegalAsync(string history, string userInput)
        => Task.FromResult($"{{ \"respuesta\": \"Fake respuesta legal para: {userInput}\" }}");

    public Task<string> DraftDocumentAsync(string promptData)
        => Task.FromResult("{ \"documento\": \"Fake documento draft\" }");

    public Task<string> GenerateSystemResponseAsync(string userPrompt, string context)
        => Task.FromResult("{ \"respuestaSistema\": \"Fake system response\" }");

    public Task<string> IniciarSimulacionAsync(string rama, string rolUsuario, string dificultad, string descripcionCaso)
        => Task.FromResult("{ \"contextoSintetico\": \"Fake\", \"mensajeJuez\": \"Fake\", \"mensajeAdversarial\": \"Fake\" }");

    public Task<string> ProcesarTurnoSimulacionAsync(string historialTurnos, string intervencionUsuario, string rolAdversarial)
        => Task.FromResult("{ \"mensajeRespuesta\": \"Fake\", \"puntajeDelta\": 0, \"leyesInvocadas\": [], \"esFinSimulacion\": false }");

    public Task<string> BuscarJurisprudenciaAsync(string query, string rama = "", int limit = 5)
        => Task.FromResult("{ \"resultados\": [] }");
}
