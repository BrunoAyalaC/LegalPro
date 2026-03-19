using LegalPro.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Google.GenAI;
using Google.GenAI.Types;
using SchemaType = Google.GenAI.Types.Type;  // alias para evitar ambigüedad con System.Type
using Polly;
using Polly.Registry;
using System.Text.Json;

namespace LegalPro.Infrastructure.Services;

// ═══════════════════════════════════════════════════════
// GeminiService: Wrapper de bajo nivel para Google Gemini.
// SRP: SOLO envía prompts y retorna texto/JSON.
// OCP: nuevos prompts → nuevo Command Handler, NO modificar aquí.
// Resiliencia: Polly pipeline con retry exponencial (3 intentos).
// SDK oficial: Google.GenAI (mirrors @google/genai JS SDK).
// FC con parametersJsonSchema + Google Search grounding para deep search.
// ═══════════════════════════════════════════════════════

public class GeminiService : IGeminiService
{
    private readonly Client _client;
    private readonly ResiliencePipeline _pipeline;

    // System instruction base — contexto legal peruano compartida
    private const string BaseSystemInstruction =
        "Eres LexIA, asistente legal IA especializada en derecho peruano — plataforma LegalPro. " +
        "Marco legal: CPC, NCPP, Código Civil y Penal, legislación laboral y constitucional peruana. " +
        "Sistemas: SINOE, CEJ, INDECOPI, SUNARP. " +
        "Responde siempre en español profesional y preciso. " +
        "NUNCA inventes jurisprudencia — si no tienes certeza, indícalo claramente.";

    // ── Instrucción de sistema diferenciada por ROL ───────────────────────────
    // OCP: agregar un nuevo rol NO requiere modificar métodos FC existentes —
    //      solo extender este switch. El system prompt cambia la "identidad"
    //      de Gemini para sesgar correctamente hacia cada perspectiva procesal.
    //
    //  COMBINACIONES: cuando un FISCAL necesita perspectiva de JUEZ (ej: predecir
    //  sentencia) se pasa rol="FISCAL_JUEZ" y el sistema funde ambas instrucciones.
    private static string BuildRoleSystemInstruction(string rol) =>
        rol.ToUpperInvariant() switch
        {
            "FISCAL" =>
                BaseSystemInstruction + "\n\n" +
                "ROL ACTIVO — FISCAL DEL MINISTERIO PÚBLICO (PERÚ):\n" +
                "• Perspectiva acusatoria. Tu función es perseguir el delito en nombre del Estado.\n" +
                "• Aplica el NCPP con enfoque en la teoría del caso fiscal, estándar de prueba 'más allá de duda razonable'.\n" +
                "• Redactas requerimientos, acusaciones, sobreseimientos y apelaciones fiscales.\n" +
                "• Cita siempre el artículo de imputación (Código Penal) y el tipo de hecho punible.\n" +
                "• Usa fórmulas del Ministerio Público: 'El Ministerio Público REQUIERE...', 'SE IMPUTA...'.",

            "JUEZ" =>
                BaseSystemInstruction + "\n\n" +
                "ROL ACTIVO — JUEZ / MAGISTRADO DEL PODER JUDICIAL (PERÚ):\n" +
                "• Perspectiva IMPARCIAL y garantista. No tienes parte — aplicas la ley.\n" +
                "• Principios: legalidad, proporcionalidad, motivación de resoluciones (art. 139.5 Const.).\n" +
                "• Redactas autos, sentencias y resoluciones con los rubros: VISTOS, CONSIDERANDO, FALLO.\n" +
                "• Citas precedentes vinculantes del TC y Casaciones de la Corte Suprema.\n" +
                "• Fórmula: 'SE RESUELVE...', 'NOTIFÍQUESE y cúmplase.'",

            "CONTADOR" =>
                BaseSystemInstruction + "\n\n" +
                "ROL ACTIVO — PERITO CONTABLE JUDICIAL (PERÚ):\n" +
                "• Perspectiva técnica y objetiva. Tu opinión es de experto independiente.\n" +
                "• Aplica NIC, NIIF, Ley General de Sociedades y normativa laboral peruana (LPCL, TUO CTS).\n" +
                "• Calcula con precisión: liquidaciones laborales, beneficios sociales, intereses legales (BCRP).\n" +
                "• Estructura tus informes con: Objeto de la Pericia, Metodología, Hallazgos, Conclusiones, Observaciones.\n" +
                "• NUNCA asumas datos no proporcionados — señala los faltantes explícitamente.",

            "FISCAL_JUEZ" =>
                BaseSystemInstruction + "\n\n" +
                "ROL ACTIVO — ANÁLISIS COMBINADO FISCAL + PERSPECTIVA JUDICIAL:\n" +
                "• Analiza desde la óptica fiscal (acusatorio) Y desde la probable decisión del juez (imparcial).\n" +
                "• Útil para: predecir si la acusación prosperará, evaluar viabilidad del requerimiento.\n" +
                "• Primero argumenta como Fiscal, luego evalúa cómo respondería el Juez.",

            "ABOGADO_FISCAL" =>
                BaseSystemInstruction + "\n\n" +
                "ROL ACTIVO — ABOGADO DEFENSOR vs. PERSPECTIVA FISCAL:\n" +
                "• Analiza los hechos desde defensa Y anticipa los argumentos del Fiscal.\n" +
                "• Útil para: preparar contra-argumentos, anticipar requerimientos, estrategia defensiva.",

            _ => // ABOGADO (default)
                BaseSystemInstruction + "\n\n" +
                "ROL ACTIVO — ABOGADO LITIGANTE (DEFENSA / REPRESENTACIÓN):\n" +
                "• Perspectiva de defensa o representación del cliente. Tu deber es proteger sus intereses legales.\n" +
                "• Aplica estrategia jurídica: identifica debilidades de la contraparte, fortalece la teoría del caso.\n" +
                "• Usa el CPC, NCPP, normas laborales y constitucionales según la rama del caso.\n" +
                "• Redactas demandas, apelaciones, recursos de nulidad, escritos procesales."
        };

    // Helper: convierte string a Content para el SDK Google.GenAI
    private static Content ToContent(string text) =>
        new Content { Parts = new List<Part> { new Part { Text = text } } };

    public GeminiService(IConfiguration configuration, ResiliencePipelineProvider<string> pipelineProvider)
    {
        var apiKey = configuration["GEMINI_API_KEY"]
                     ?? configuration["Gemini:ApiKey"]
                     ?? throw new InvalidOperationException("GEMINI_API_KEY no está configurado.");

        _client = new Client(vertexAI: false, apiKey: apiKey);
        _pipeline = pipelineProvider.GetPipeline("gemini-pipeline");
    }

    // ── Core: genera texto libre ─────────────────────────────────────────────
    public async Task<string> GenerateAsync(string prompt, string model = "gemini-3-flash-preview")
    {
        return await _pipeline.ExecuteAsync(async ct =>
        {
            var config = new GenerateContentConfig
            {
                ResponseMimeType = "application/json",
                Temperature      = 0.4f,
                MaxOutputTokens  = 4096,
            };
            var response = await _client.Models.GenerateContentAsync(model, prompt, config);
            return response.Text ?? "{}";
        }, CancellationToken.None);
    }

    // ── Análisis de expediente ───────────────────────────────────────────────
    public async Task<string> AnalyzeLegalDocumentAsync(string documentText)
    {
        var prompt =
            $"{BaseSystemInstruction}\n\n" +
            "Eres un Analista Criminológico. Identifica contradicciones, folios erróneos y hechos incongruentes.\n" +
            "RESPONDE ÚNICAMENTE EN JSON CON ESTA ESTRUCTURA EXACTA:\n" +
            "{\"resumenGeneral\":\"string\",\"anotaciones\":[{\"gravedad\":\"Alta|Media|Baja\"," +
            "\"titulo\":\"string\",\"descripcion\":\"string\",\"folioReferencia\":\"string|null\"}]," +
            "\"isError\":false}\n\n" +
            $"EXPEDIENTE:\n{documentText}";

        return await _pipeline.ExecuteAsync(async ct =>
        {
            var config = new GenerateContentConfig
            {
                ResponseMimeType = "application/json",
                Temperature      = 0.3f,
                MaxOutputTokens  = 8192,
            };
            var r = await _client.Models.GenerateContentAsync("gemini-3-flash-preview", prompt, config);
            return r.Text ?? "{}";
        }, CancellationToken.None);
    }

    // ── Predictor judicial — FC forzado, diferenciado por rol ────────────────────
    // ABOGADO: ¿qué chance tengo de ganar?   FISCAL: ¿prosperá mi acusación?
    // Combinación FISCAL_JUEZ: evalúa desde ambas perspectivas simultáneamente.
    public async Task<string> PredictOutcomeAsync(string hechos, string materia, string juzgadoSala, string juez, string rol = "ABOGADO")
    {
        var perspectiva = rol.ToUpperInvariant() switch
        {
            "FISCAL"      => "Evalúa si esta acusación fiscal prosperará ante el juzgado indicado. Considera el estándar de prueba 'más allá de duda razonable'.",
            "FISCAL_JUEZ" => "Evalúa tanto la fortaleza de la acusación fiscal COMO la probable decisión del juez. Da dos perspectivas combinadas.",
            "JUEZ"        => "Evalúa cómo resolverías imparcialmente este caso dado los hechos y el juzgado. Cita precedentes vinculantes.",
            _             => "Evalúa la viabilidad de la defensa/demanda con datos estadísticos de jurisprudencia peruana.",
        };
        var systemPrompt =
            BuildRoleSystemInstruction(rol) + "\n\n" +
            $"{perspectiva} Llama a la función predict_outcome con el resultado.";

        var declaration = new FunctionDeclaration
        {
            Name        = "predict_outcome",
            Description = "Retorna la predicción judicial estructurada con probabilidad y factores, sesgada por rol del usuario.",
            Parameters  = new Schema
            {
                Type       = SchemaType.Object,
                Properties = new Dictionary<string, Schema>
                {
                    ["probabilidadExito"]  = new Schema { Type = SchemaType.Integer, Description = "0-100" },
                    ["veredictoGeneral"]   = new Schema { Type = SchemaType.String,  Description = "Resumen del pronóstico." },
                    ["nivel"]             = new Schema { Type = SchemaType.String,  Description = "Alto|Medio|Bajo" },
                    ["factores"]          = new Schema
                    {
                        Type  = SchemaType.Array,
                        Items = new Schema
                        {
                            Type       = SchemaType.Object,
                            Properties = new Dictionary<string, Schema>
                            {
                                ["tipo"]        = new Schema { Type = SchemaType.String, Description = "Favorable|Desfavorable" },
                                ["descripcion"] = new Schema { Type = SchemaType.String },
                            },
                            Required = new List<string> { "tipo", "descripcion" },
                        },
                    },
                    ["recomendacion"] = new Schema { Type = SchemaType.String, Description = "Consejo estratégico adaptado al rol del usuario (abogado, fiscal o juez)." },
                },
                Required = new List<string> { "probabilidadExito", "veredictoGeneral", "nivel", "factores", "recomendacion" },
            },
        };

        var contents = $"ROL: {rol}\nHECHOS: {hechos}\nMATERIA: {materia}\nJUZGADO/SALA: {juzgadoSala}\nJUEZ: {juez}";

        return await _pipeline.ExecuteAsync(async ct =>
        {
            var config = new GenerateContentConfig
            {
                SystemInstruction = ToContent(systemPrompt),
                Tools             = new List<Tool> { new Tool { FunctionDeclarations = new List<FunctionDeclaration> { declaration } } },
                ToolConfig        = new ToolConfig
                {
                    FunctionCallingConfig = new FunctionCallingConfig
                    {
                        Mode                 = FunctionCallingConfigMode.Any,
                        AllowedFunctionNames = new List<string> { "predict_outcome" },
                    },
                },
                Temperature     = 0.2f,
                MaxOutputTokens = 2048,
            };
            var r    = await _client.Models.GenerateContentAsync("gemini-3-flash-preview",
                ToContent(contents), config);
            var call = r.FunctionCalls?.FirstOrDefault();
            return call?.Args != null ? JsonSerializer.Serialize(call.Args) : "{}";
        }, CancellationToken.None);
    }

    // ── Chat legal multi-turn ────────────────────────────────────────────────
    public async Task<string> ChatLegalAsync(string history, string userInput)
    {
        var prompt =
            $"{BaseSystemInstruction}\n\n" +
            $"HISTORIAL PREVIO:\n{history}\n\n" +
            $"CONSULTA:\n{userInput}\n\n" +
            "RESPONDE EN JSON: {\"respuesta\":\"string markdown\",\"funcionesUsadas\":[\"string\"]}";

        return await _pipeline.ExecuteAsync(async ct =>
        {
            var config = new GenerateContentConfig
            {
                ResponseMimeType = "application/json",
                Temperature      = 0.4f,
                MaxOutputTokens  = 2048,
            };
            var r = await _client.Models.GenerateContentAsync("gemini-3-flash-preview", prompt, config);
            return r.Text ?? "{}";
        }, CancellationToken.None);
    }

    // ── Redactor de escritos — FC forzado garantiza JSON estructura ────────────
    public async Task<string> DraftDocumentAsync(string promptData)
    {
        var systemPrompt =
            $"{BaseSystemInstruction}\n\n" +
            "Eres el Redactor Legal de LegalPro. Redacta escritos procesales peruanos formales. " +
            "Usa el formato del CPC/NCPP, con sumilla, destinatario, fundamentos de hecho y derecho, y petitorio. " +
            "Debes llamar a la función draft_document con el resultado.";

        var declaration = new FunctionDeclaration
        {
            Name        = "draft_document",
            Description = "Retorna el escrito legal redactado con las leyes citadas.",
            Parameters  = new Schema
            {
                Type       = SchemaType.Object,
                Properties = new Dictionary<string, Schema>
                {
                    ["borrador"]    = new Schema { Type = SchemaType.String, Description = "Texto completo del escrito legal en formato Markdown." },
                    ["leyesCitadas"] = new Schema
                    {
                        Type  = SchemaType.Array,
                        Items = new Schema { Type = SchemaType.String, Description = "Ej: 'Art. 424 CPC'" },
                    },
                    ["tipoDocumento"] = new Schema { Type = SchemaType.String, Description = "Tipo de escrito (demanda, recurso, etc.)" },
                    ["observaciones"] = new Schema { Type = SchemaType.String, Description = "Advertencias o consideraciones adicionales para el abogado." },
                },
                Required = new List<string> { "borrador", "leyesCitadas", "tipoDocumento" },
            },
        };

        return await _pipeline.ExecuteAsync(async ct =>
        {
            var config = new GenerateContentConfig
            {
                SystemInstruction = ToContent(systemPrompt),
                Tools             = new List<Tool> { new Tool { FunctionDeclarations = new List<FunctionDeclaration> { declaration } } },
                ToolConfig        = new ToolConfig
                {
                    FunctionCallingConfig = new FunctionCallingConfig
                    {
                        Mode                 = FunctionCallingConfigMode.Any,
                        AllowedFunctionNames = new List<string> { "draft_document" },
                    },
                },
                Temperature     = 0.5f,
                MaxOutputTokens = 8192,
            };
            var r    = await _client.Models.GenerateContentAsync("gemini-3-flash-preview",
                ToContent(promptData), config);
            var call = r.FunctionCalls?.FirstOrDefault();
            return call?.Args != null ? JsonSerializer.Serialize(call.Args) : "{}";
        }, CancellationToken.None);
    }

    // ── Contexto genérico (legado — simulaciones antiguas) ───────────────────
    public async Task<string> GenerateSystemResponseAsync(string userPrompt, string context)
    {
        var prompt = $"{BaseSystemInstruction}\n\nCONTEXTO:\n{context}\n\nCONSULTA:\n{userPrompt}\n\nRESPONDE EN JSON.";
        return await GenerateAsync(prompt);
    }

    // ════════════════════════════════════════════════════════════════════════
    // NUEVAS HERRAMIENTAS DEL ABOGADO — FC forzado con FunctionCallingConfigMode.Any
    // ════════════════════════════════════════════════════════════════════════

    // ── Generador de alegatos de clausura — diferenciado por rol ───────────────────
    // ABOGADO: alegato de defensa.   FISCAL: alegato acusatorio (solicita pena).
    // Combinación: si rolUsuario contiene '_', Gemini ve ambas perspectivas.
    public async Task<string> GenerarAlegatoAsync(string tipoAlegato, string ramaDerecho, string hechos, string rolUsuario)
    {
        var systemPrompt =
            BuildRoleSystemInstruction(rolUsuario) + "\n\n" +
            "Eres experto en oratoria forense y alegatos de clausura peruanos. " +
            "Genera un alegato persuasivo, conciso y ajustado al NCPP/CPC. " +
            "Llama a la función generate_alegato con el resultado.";

        var declaration = new FunctionDeclaration
        {
            Name        = "generate_alegato",
            Description = "Alegato de clausura estructurado según el rol (defensa o acusación).",
            Parameters  = new Schema
            {
                Type       = SchemaType.Object,
                Properties = new Dictionary<string, Schema>
                {
                    ["apertura"]          = new Schema { Type = SchemaType.String, Description = "Frase inicial impactante." },
                    ["desarrolloHechos"]  = new Schema { Type = SchemaType.String, Description = "Narración de los hechos probados." },
                    ["argumentosJuridicos"] = new Schema { Type = SchemaType.String, Description = "Fundamentos de derecho." },
                    ["impugnaciones"]     = new Schema { Type = SchemaType.String, Description = "Debilitamiento de argumentos adversariales." },
                    ["cierre"]            = new Schema { Type = SchemaType.String, Description = "Solicitud final al jurado/juez." },
                    ["leyesCitadas"]      = new Schema
                    {
                        Type  = SchemaType.Array,
                        Items = new Schema { Type = SchemaType.String },
                    },
                    ["duracionEstimadaMinutos"] = new Schema { Type = SchemaType.Integer, Description = "Duración estimada en minutos." },
                },
                Required = new List<string> { "apertura", "desarrolloHechos", "argumentosJuridicos", "cierre", "leyesCitadas", "duracionEstimadaMinutos" },
            },
        };

        var contents = $"TIPO_ALEGATO: {tipoAlegato}\nRAMA_DERECHO: {ramaDerecho}\nROL: {rolUsuario}\nHECHOS:\n{hechos}";

        return await _pipeline.ExecuteAsync(async ct =>
        {
            var config = new GenerateContentConfig
            {
                SystemInstruction = ToContent(systemPrompt),
                Tools             = new List<Tool> { new Tool { FunctionDeclarations = new List<FunctionDeclaration> { declaration } } },
                ToolConfig        = new ToolConfig
                {
                    FunctionCallingConfig = new FunctionCallingConfig
                    {
                        Mode                 = FunctionCallingConfigMode.Any,
                        AllowedFunctionNames = new List<string> { "generate_alegato" },
                    },
                },
                Temperature     = 0.6f,
                MaxOutputTokens = 4096,
            };
            var r    = await _client.Models.GenerateContentAsync("gemini-3-flash-preview",
                ToContent(contents), config);
            var call = r.FunctionCalls?.FirstOrDefault();
            return call?.Args != null ? JsonSerializer.Serialize(call.Args) : "{}";
        }, CancellationToken.None);
    }

    // ── Estrategia de interrogatorio (NCPP art. 370-378) ─────────────────────
    // ABOGADO: puede ser directo (testigo propio) o contrainterrogatorio (testigo adversarial).
    // FISCAL:  siempre acusatorio — interroga testigos de cargo, contrainterroga testigos de descargo.
    // Combinación ABOGADO_FISCAL: anticipa las preguntas del fiscal sobre el mismo testigo.
    public async Task<string> GenerarEstrategiaInterrogatorioAsync(string nombreTestigo, string tipoTestigo, string hechosClave, string objetivo, string rol = "ABOGADO")
    {
        var perspectiva = rol.ToUpperInvariant() switch
        {
            "FISCAL"         => "Estrategia acusatoria según NCPP. Fortalece la teoría del caso fiscal.",
            "ABOGADO_FISCAL" => "Genera DOS bloques: (A) preguntas como abogado defensor Y (B) las preguntas que hará el fiscal sobre el mismo testigo.",
            _                => "Estrategia de defensa o representación según NCPP art. 370-378.",
        };
        var systemPrompt =
            BuildRoleSystemInstruction(rol) + "\n\n" +
            $"Eres estratega de litigación oral experto en NCPP. {perspectiva} " +
            "Llama a la función generate_interrogatorio con el resultado.";

        var declaration = new FunctionDeclaration
        {
            Name        = "generate_interrogatorio",
            Description = "Retorna la estrategia de interrogatorio adaptada al rol del usuario.",
            Parameters  = new Schema
            {
                Type       = SchemaType.Object,
                Properties = new Dictionary<string, Schema>
                {
                    ["objetivo"]          = new Schema { Type = SchemaType.String, Description = "Objetivo del interrogatorio." },
                    ["tipoInterrogatorio"] = new Schema { Type = SchemaType.String, Description = "Directo|Contrainterrogatorio|Redirecto" },
                    ["preguntas"]         = new Schema
                    {
                        Type  = SchemaType.Array,
                        Items = new Schema
                        {
                            Type       = SchemaType.Object,
                            Properties = new Dictionary<string, Schema>
                            {
                                ["numero"]    = new Schema { Type = SchemaType.Integer },
                                ["pregunta"]  = new Schema { Type = SchemaType.String },
                                ["proposito"] = new Schema { Type = SchemaType.String, Description = "Para qué sirve esta pregunta." },
                                ["riesgo"]    = new Schema { Type = SchemaType.String, Description = "Posible respuesta desfavorable y cómo manejarla." },
                            },
                            Required = new List<string> { "numero", "pregunta", "proposito" },
                        },
                    },
                    ["advertencias"] = new Schema { Type = SchemaType.String, Description = "Consideraciones procesales NCPP." },
                },
                Required = new List<string> { "objetivo", "tipoInterrogatorio", "preguntas", "advertencias" },
            },
        };

        var contents = $"ROL: {rol}\nTESTIGO: {nombreTestigo}\nTIPO_TESTIGO: {tipoTestigo}\nHECHOS_CLAVE:\n{hechosClave}\nOBJETIVO: {objetivo}";

        return await _pipeline.ExecuteAsync(async ct =>
        {
            var config = new GenerateContentConfig
            {
                SystemInstruction = ToContent(systemPrompt),
                Tools             = new List<Tool> { new Tool { FunctionDeclarations = new List<FunctionDeclaration> { declaration } } },
                ToolConfig        = new ToolConfig
                {
                    FunctionCallingConfig = new FunctionCallingConfig
                    {
                        Mode                 = FunctionCallingConfigMode.Any,
                        AllowedFunctionNames = new List<string> { "generate_interrogatorio" },
                    },
                },
                Temperature     = 0.4f,
                MaxOutputTokens = 4096,
            };
            var r    = await _client.Models.GenerateContentAsync("gemini-2.5-flash",
                ToContent(contents), config);
            var call = r.FunctionCalls?.FirstOrDefault();
            return call?.Args != null ? JsonSerializer.Serialize(call.Args) : "{}";
        }, CancellationToken.None);
    }

    // ── Asistente de objeciones en tiempo real ────────────────────────────────
    // ABOGADO: objeta al fiscal/contraparte.  FISCAL: objeta a la defensa.
    // El FC usa el mismo schema pero el system prompt cambia la perspectiva.
    public async Task<string> SugerirObjecionAsync(string fragmentoAdversarial, string ramaDerecho, string etapaJuicio, string rol = "ABOGADO")
    {
        var adversario = rol.ToUpperInvariant() == "FISCAL" ? "la defensa" : "el fiscal";
        var systemPrompt =
            BuildRoleSystemInstruction(rol) + "\n\n" +
            $"Eres el Asistente de Objeciones de LegalPro. Analiza el fragmento pronunciado por {adversario} en tiempo real. " +
            "Identifica si procede alguna objeción según el NCPP/CPC peruano. " +
            "Llama a la función suggest_objecion con el resultado.";

        var declaration = new FunctionDeclaration
        {
            Name        = "suggest_objecion",
            Description = "Sugiere si procede objeción adaptada al rol (abogado objeta al fiscal; fiscal objeta a defensa).",
            Parameters  = new Schema
            {
                Type       = SchemaType.Object,
                Properties = new Dictionary<string, Schema>
                {
                    ["procedeObjecion"]  = new Schema { Type = SchemaType.Boolean, Description = "True si procede objetar." },
                    ["tipoObjecion"]     = new Schema { Type = SchemaType.String,  Description = "Ej: Pregunta sugestiva, capciosa, impertinente, etc." },
                    ["fundamentoLegal"]  = new Schema { Type = SchemaType.String,  Description = "Artículo NCPP/CPC que la sustenta." },
                    ["formulacion"]      = new Schema { Type = SchemaType.String,  Description = "Texto exacto a pronunciar para objetar." },
                    ["probabilidadExito"] = new Schema { Type = SchemaType.Integer, Description = "0-100" },
                    ["alternativa"]      = new Schema { Type = SchemaType.String,  Description = "Qué hacer si el juez deniega la objeción." },
                },
                Required = new List<string> { "procedeObjecion", "tipoObjecion", "fundamentoLegal", "formulacion", "probabilidadExito" },
            },
        };

        var contents = $"ROL: {rol}\nFRAGMENTO_ADVERSARIAL: \"{fragmentoAdversarial}\"\nRAMA: {ramaDerecho}\nETAPA: {etapaJuicio}";

        return await _pipeline.ExecuteAsync(async ct =>
        {
            var config = new GenerateContentConfig
            {
                SystemInstruction = ToContent(systemPrompt),
                Tools             = new List<Tool> { new Tool { FunctionDeclarations = new List<FunctionDeclaration> { declaration } } },
                ToolConfig        = new ToolConfig
                {
                    FunctionCallingConfig = new FunctionCallingConfig
                    {
                        Mode                 = FunctionCallingConfigMode.Any,
                        AllowedFunctionNames = new List<string> { "suggest_objecion" },
                    },
                },
                Temperature     = 0.2f,  // Baja temperatura — respuesta precisa y rápida
                MaxOutputTokens = 1024,
            };
            var r    = await _client.Models.GenerateContentAsync("gemini-3-flash-preview",
                ToContent(contents), config);
            var call = r.FunctionCalls?.FirstOrDefault();
            return call?.Args != null ? JsonSerializer.Serialize(call.Args) : "{}";
        }, CancellationToken.None);
    }

    // ── Resumen ejecutivo del caso con IA ─────────────────────────────────────
    // ABOGADO: fortalezas/debilidades desde perspectiva de defensa.
    // FISCAL: viabilidad de la acusación y riesgo de absolución.
    // JUEZ: imparcialidad — qué puntos necesitan más prueba o motivación.
    public async Task<string> GenerarResumenCasoAsync(string expedienteJson, string documentosTexto, string rol = "ABOGADO")
    {
        var systemPrompt =
            BuildRoleSystemInstruction(rol) + "\n\n" +
            "Genera un resumen ejecutivo del caso para reunión de estrategia (máx 500 palabras, accionable). " +
            "Llama a la función generate_resumen_caso con el resultado.";

        var declaration = new FunctionDeclaration
        {
            Name        = "generate_resumen_caso",
            Description = "Retorna el resumen ejecutivo del caso.",
            Parameters  = new Schema
            {
                Type       = SchemaType.Object,
                Properties = new Dictionary<string, Schema>
                {
                    ["resumenEjecutivo"]  = new Schema { Type = SchemaType.String, Description = "Resumen del caso en 2-3 párrafos." },
                    ["puntosFortaleza"]  = new Schema
                    {
                        Type  = SchemaType.Array,
                        Items = new Schema { Type = SchemaType.String },
                    },
                    ["puntosDebilidad"]  = new Schema
                    {
                        Type  = SchemaType.Array,
                        Items = new Schema { Type = SchemaType.String },
                    },
                    ["accionesInmediatas"] = new Schema
                    {
                        Type  = SchemaType.Array,
                        Items = new Schema { Type = SchemaType.String, Description = "Acción concreta a tomar." },
                    },
                    ["riesgoGeneral"]     = new Schema { Type = SchemaType.String, Description = "Alto|Medio|Bajo" },
                    ["proximoPlazoSugerido"] = new Schema { Type = SchemaType.String, Description = "Próxima fecha límite procesal relevante." },
                },
                Required = new List<string> { "resumenEjecutivo", "puntosFortaleza", "puntosDebilidad", "accionesInmediatas", "riesgoGeneral" },
            },
        };

        var contents = $"ROL: {rol}\nEXPEDIENTE:\n{expedienteJson}\n\nDOCUMENTOS:\n{documentosTexto}";

        return await _pipeline.ExecuteAsync(async ct =>
        {
            var config = new GenerateContentConfig
            {
                SystemInstruction = ToContent(systemPrompt),
                Tools             = new List<Tool> { new Tool { FunctionDeclarations = new List<FunctionDeclaration> { declaration } } },
                ToolConfig        = new ToolConfig
                {
                    FunctionCallingConfig = new FunctionCallingConfig
                    {
                        Mode                 = FunctionCallingConfigMode.Any,
                        AllowedFunctionNames = new List<string> { "generate_resumen_caso" },
                    },
                },
                Temperature     = 0.3f,
                MaxOutputTokens = 4096,
            };
            var r    = await _client.Models.GenerateContentAsync("gemini-3-flash-preview",
                ToContent(contents), config);
            var call = r.FunctionCalls?.FirstOrDefault();
            return call?.Args != null ? JsonSerializer.Serialize(call.Args) : "{}";
        }, CancellationToken.None);
    }

    // ════════════════════════════════════════════════════════════════════════
    // HERRAMIENTAS EXCLUSIVAS POR ROL
    // ════════════════════════════════════════════════════════════════════════

    // ── FISCAL: Generador de Requerimientos Fiscales ──────────────────────────
    // Genera acusaciones, sobreseimientos, priorizaciones preventivas y otros
    // requerimientos del Ministerio Público según el NCPP.
    // FC forzado: garantiza estructura formal de requerimiento fiscal peruano.
    public async Task<string> GenerarRequerimientoFiscalAsync(
        string tipoRequerimiento,
        string hechos,
        string imputado,
        string delito,
        string ramaDerecho)
    {
        var systemPrompt =
            BuildRoleSystemInstruction("FISCAL") + "\n\n" +
            "Redactas requerimientos fiscales con precisión técnica. " +
            "Usa el formato NCPP: encabezado con MP y Distrito Fiscal, " +
            "Sumilla, Señor Juez, Hechos, Calificación Jurídica, Fundamentos, Petitorio. " +
            "Llama a la función generate_requerimiento con el resultado.";

        var declaration = new FunctionDeclaration
        {
            Name        = "generate_requerimiento",
            Description = "Retorna el requerimiento fiscal peruano estructurado según NCPP.",
            Parameters  = new Schema
            {
                Type       = SchemaType.Object,
                Properties = new Dictionary<string, Schema>
                {
                    ["sumilla"]              = new Schema { Type = SchemaType.String, Description = "Resumen de una línea (Ej: FORMALIZA INVESTIGACIÓN PREPARATORIA)." },
                    ["hechos"]               = new Schema { Type = SchemaType.String, Description = "Relato de hechos imputados (cronológico, concreto)." },
                    ["calificacionJuridica"] = new Schema { Type = SchemaType.String, Description = "Tipo penal imputado con artículo del Código Penal." },
                    ["fundamentosFacticos"]  = new Schema { Type = SchemaType.String, Description = "Sustento fáctico del requerimiento." },
                    ["fundamentosJuridicos"] = new Schema { Type = SchemaType.String, Description = "Artículos del NCPP y CP que sustentan el requerimiento." },
                    ["petitorio"]            = new Schema { Type = SchemaType.String, Description = "Solicitud concreta al Juez de Investigación Preparatoria." },
                    ["medidasSolicitadas"]   = new Schema
                    {
                        Type  = SchemaType.Array,
                        Items = new Schema { Type = SchemaType.String, Description = "Medida de coerción o limitativa solicitada." },
                    },
                    ["advertencias"]         = new Schema { Type = SchemaType.String, Description = "Plazos NCPP relevantes o consideraciones procesales." },
                },
                Required = new List<string> { "sumilla", "hechos", "calificacionJuridica", "fundamentosJuridicos", "petitorio" },
            },
        };

        var contents = $"TIPO_REQUERIMIENTO: {tipoRequerimiento}\nIMPUTADO: {imputado}\nDELITO_IMPUTADO: {delito}\nRAMA: {ramaDerecho}\nHECHOS:\n{hechos}";

        return await _pipeline.ExecuteAsync(async ct =>
        {
            var config = new GenerateContentConfig
            {
                SystemInstruction = ToContent(systemPrompt),
                Tools             = new List<Tool> { new Tool { FunctionDeclarations = new List<FunctionDeclaration> { declaration } } },
                ToolConfig        = new ToolConfig
                {
                    FunctionCallingConfig = new FunctionCallingConfig
                    {
                        Mode                 = FunctionCallingConfigMode.Any,
                        AllowedFunctionNames = new List<string> { "generate_requerimiento" },
                    },
                },
                Temperature     = 0.3f,
                MaxOutputTokens = 8192,
            };
            var r    = await _client.Models.GenerateContentAsync("gemini-3-flash-preview", ToContent(contents), config);
            var call = r.FunctionCalls?.FirstOrDefault();
            return call?.Args != null ? JsonSerializer.Serialize(call.Args) : "{}";
        }, CancellationToken.None);
    }

    // ── JUEZ: Generador de Resoluciones Judiciales ────────────────────────────
    // Genera sentencias, autos y resoluciones con los rubros formales del PJ peruano:
    // VISTOS, CONSIDERANDO (numerado), FALLO / SE RESUELVE.
    // FC forzado garantiza motivación estructurada (art. 139.5 Constitución).
    public async Task<string> GenerarResolucionJudicialAsync(
        string tipoResolucion,
        string hechos,
        string pretensiones,
        string mediosProbatorios,
        string ramaDerecho)
    {
        var systemPrompt =
            BuildRoleSystemInstruction("JUEZ") + "\n\n" +
            "Redactas resoluciones judiciales con motivación suficiente según art. 139.5 de la Constitución. " +
            "Estructura: EXPEDIENTE/SUMILLA → VISTOS → CONSIDERANDO (numerado) → FALLO/SE RESUELVE. " +
            "Cita precedentes vinculantes del TC y Casaciones de la Corte Suprema cuando corresponda. " +
            "Llama a la función generate_resolucion con el resultado.";

        var declaration = new FunctionDeclaration
        {
            Name        = "generate_resolucion",
            Description = "Retorna resolución judicial peruana con rubros formales del Poder Judicial.",
            Parameters  = new Schema
            {
                Type       = SchemaType.Object,
                Properties = new Dictionary<string, Schema>
                {
                    ["sumilla"]           = new Schema { Type = SchemaType.String, Description = "Materia de la resolución en una línea." },
                    ["vistos"]            = new Schema { Type = SchemaType.String, Description = "Relación de actuados y lo solicitado." },
                    ["considerandos"]     = new Schema
                    {
                        Type  = SchemaType.Array,
                        Items = new Schema
                        {
                            Type       = SchemaType.Object,
                            Properties = new Dictionary<string, Schema>
                            {
                                ["numero"]      = new Schema { Type = SchemaType.Integer, Description = "Número del considerando." },
                                ["contenido"]   = new Schema { Type = SchemaType.String,  Description = "Argumento jurídico o fáctico motivado." },
                                ["fundamentoLegal"] = new Schema { Type = SchemaType.String, Description = "Norma o precedente citado." },
                            },
                            Required = new List<string> { "numero", "contenido" },
                        },
                    },
                    ["fallo"]             = new Schema { Type = SchemaType.String, Description = "Dispositivo: FUNDADO/INFUNDADO, PROCEDENTE/IMPROCEDENTE, CONDENA, ABSUELVE, etc." },
                    ["precedentesCitados"] = new Schema
                    {
                        Type  = SchemaType.Array,
                        Items = new Schema { Type = SchemaType.String, Description = "Ej: STC 0050-2004-AI/TC, Casación 123-2022-Lima." },
                    },
                    ["costas"]            = new Schema { Type = SchemaType.String, Description = "Pronunciamiento sobre costas procesales." },
                    ["advertencias"]      = new Schema { Type = SchemaType.String, Description = "Plazos de impugnación y vías disponibles." },
                },
                Required = new List<string> { "sumilla", "vistos", "considerandos", "fallo" },
            },
        };

        var contents = $"TIPO_RESOLUCION: {tipoResolucion}\nRAMA: {ramaDerecho}\nHECHOS:\n{hechos}\nPRETENSIONES:\n{pretensiones}\nMEDIOS_PROBATORIOS:\n{mediosProbatorios}";

        return await _pipeline.ExecuteAsync(async ct =>
        {
            var config = new GenerateContentConfig
            {
                SystemInstruction = ToContent(systemPrompt),
                Tools             = new List<Tool> { new Tool { FunctionDeclarations = new List<FunctionDeclaration> { declaration } } },
                ToolConfig        = new ToolConfig
                {
                    FunctionCallingConfig = new FunctionCallingConfig
                    {
                        Mode                 = FunctionCallingConfigMode.Any,
                        AllowedFunctionNames = new List<string> { "generate_resolucion" },
                    },
                },
                Temperature     = 0.2f,  // Baja temperatura: resoluciones requieren precisión
                MaxOutputTokens = 8192,
            };
            var r    = await _client.Models.GenerateContentAsync("gemini-3-flash-preview", ToContent(contents), config);
            var call = r.FunctionCalls?.FirstOrDefault();
            return call?.Args != null ? JsonSerializer.Serialize(call.Args) : "{}";
        }, CancellationToken.None);
    }

    // ── JUEZ: Comparador de Precedentes Vinculantes ───────────────────────────
    // Busca y compara precedentes vinculantes del TC, Casaciones de la Corte Suprema
    // y Acuerdos Plenarios relevantes al caso actual.
    // Combinación: útil también para FISCAL y ABOGADO que quieran citar precedentes.
    public async Task<string> CompararPrecedentesAsync(
        string casoActual,
        string ramaDerecho,
        string tipoResolucionBuscada,
        string rol = "JUEZ")
    {
        var systemPrompt =
            BuildRoleSystemInstruction(rol) + "\n\n" +
            "Eres el Comparador de Precedentes de LegalPro. Identifica precedentes vinculantes peruanos aplicables. " +
            "Fuentes: STC del Tribunal Constitucional, Casaciones de la Corte Suprema, Acuerdos Plenarios (penal), " +
            "Plenos Casatorios (civil/laboral). Llama a la función compare_precedentes con el resultado.";

        var declaration = new FunctionDeclaration
        {
            Name        = "compare_precedentes",
            Description = "Retorna precedentes vinculantes peruanos relevantes con análisis de aplicabilidad.",
            Parameters  = new Schema
            {
                Type       = SchemaType.Object,
                Properties = new Dictionary<string, Schema>
                {
                    ["precedentes"] = new Schema
                    {
                        Type  = SchemaType.Array,
                        Items = new Schema
                        {
                            Type       = SchemaType.Object,
                            Properties = new Dictionary<string, Schema>
                            {
                                ["fuente"]           = new Schema { Type = SchemaType.String, Description = "TC|Corte Suprema|Acuerdo Plenario|Pleno Casatorio" },
                                ["identificacion"]   = new Schema { Type = SchemaType.String, Description = "Ej: STC 0050-2004-AI/TC, Cas. 123-2022-Lima" },
                                ["resumenDoctrina"]  = new Schema { Type = SchemaType.String, Description = "Doctrina jurisprudencial establecida." },
                                ["aplicabilidad"]    = new Schema { Type = SchemaType.String, Description = "Alta|Media|Baja — qué tan aplicable es al caso actual." },
                                ["puntoClave"]       = new Schema { Type = SchemaType.String, Description = "Argumento concreto que se puede extraer para este caso." },
                            },
                            Required = new List<string> { "fuente", "identificacion", "resumenDoctrina", "aplicabilidad", "puntoClave" },
                        },
                    },
                    ["recomendacionEstrategica"] = new Schema { Type = SchemaType.String, Description = "Cómo usar estos precedentes según el rol del usuario." },
                    ["advertencia"]              = new Schema { Type = SchemaType.String, Description = "Precedentes que podrían ser adversos y cómo distinguirlos." },
                },
                Required = new List<string> { "precedentes", "recomendacionEstrategica" },
            },
        };

        var contents = $"ROL: {rol}\nCASO_ACTUAL:\n{casoActual}\nRAMA: {ramaDerecho}\nTIPO_RESOLUCION_BUSCADA: {tipoResolucionBuscada}";

        return await _pipeline.ExecuteAsync(async ct =>
        {
            var config = new GenerateContentConfig
            {
                SystemInstruction = ToContent(systemPrompt),
                Tools             = new List<Tool> { new Tool { FunctionDeclarations = new List<FunctionDeclaration> { declaration } } },
                ToolConfig        = new ToolConfig
                {
                    FunctionCallingConfig = new FunctionCallingConfig
                    {
                        Mode                 = FunctionCallingConfigMode.Any,
                        AllowedFunctionNames = new List<string> { "compare_precedentes" },
                    },
                },
                Temperature     = 0.2f,
                MaxOutputTokens = 4096,
            };
            var r    = await _client.Models.GenerateContentAsync("gemini-3-flash-preview", ToContent(contents), config);
            var call = r.FunctionCalls?.FirstOrDefault();
            return call?.Args != null ? JsonSerializer.Serialize(call.Args) : "{}";
        }, CancellationToken.None);
    }

    // ── CONTADOR: Calculador de Liquidaciones Laborales ───────────────────────
    // Calcula con precisión: CTS, gratificaciones, vacaciones truncas,
    // indemnización por despido arbitrario e intereses legales (BCRP).
    // FC forzado: resultado numérico estructurado, auditable y exportable.
    public async Task<string> CalcularLiquidacionLaboralAsync(
        string datosEmpleadoJson,
        string motivoCese)
    {
        var systemPrompt =
            BuildRoleSystemInstruction("CONTADOR") + "\n\n" +
            "Eres el Calculador de Liquidaciones de LegalPro. Calcula con máxima precisión. " +
            "Aplica: Ley de Productividad y Competitividad Laboral (D.S. 003-97-TR), " +
            "TUO CTS (D.S. 001-97-TR), Ley de Gratificaciones 27735, intereses BCRP. " +
            "Llama a la función calculate_liquidacion con el resultado.";

        var declaration = new FunctionDeclaration
        {
            Name        = "calculate_liquidacion",
            Description = "Retorna liquidación laboral desglosada con cada concepto calculado.",
            Parameters  = new Schema
            {
                Type       = SchemaType.Object,
                Properties = new Dictionary<string, Schema>
                {
                    ["conceptos"] = new Schema
                    {
                        Type  = SchemaType.Array,
                        Items = new Schema
                        {
                            Type       = SchemaType.Object,
                            Properties = new Dictionary<string, Schema>
                            {
                                ["concepto"]            = new Schema { Type = SchemaType.String,  Description = "Nombre del beneficio (CTS, Vacaciones, Gratificación, etc.)" },
                                ["baseCalculo"]         = new Schema { Type = SchemaType.String,  Description = "Fórmula o base usada." },
                                ["montoSoles"]          = new Schema { Type = SchemaType.Number,  Description = "Monto en soles peruanos." },
                                ["periodoAplicable"]    = new Schema { Type = SchemaType.String,  Description = "Período computable (Ej: ene 2020 - dic 2023)." },
                                ["fundamentoLegal"]     = new Schema { Type = SchemaType.String,  Description = "Artículo legal que sustenta el concepto." },
                            },
                            Required = new List<string> { "concepto", "baseCalculo", "montoSoles", "fundamentoLegal" },
                        },
                    },
                    ["totalBrutoPagar"]        = new Schema { Type = SchemaType.Number, Description = "Suma total de todos los conceptos en soles." },
                    ["deduccionesAFP_ONP"]     = new Schema { Type = SchemaType.Number, Description = "Retenciones AFP u ONP si corresponden." },
                    ["totalNetoPagar"]         = new Schema { Type = SchemaType.Number, Description = "Monto neto a recibir el trabajador." },
                    ["interesesLegales"]       = new Schema { Type = SchemaType.Number, Description = "Intereses BCRP acumulados a la fecha." },
                    ["observacionesContables"] = new Schema { Type = SchemaType.String, Description = "Notas sobre datos faltantes o supuestos asumidos." },
                    ["motivoCese"]             = new Schema { Type = SchemaType.String, Description = "Cese confirmado con sus consecuencias jurídicas." },
                },
                Required = new List<string> { "conceptos", "totalBrutoPagar", "totalNetoPagar", "motivoCese" },
            },
        };

        var contents = $"MOTIVO_CESE: {motivoCese}\nDATOS_EMPLEADO:\n{datosEmpleadoJson}";

        return await _pipeline.ExecuteAsync(async ct =>
        {
            var config = new GenerateContentConfig
            {
                SystemInstruction = ToContent(systemPrompt),
                Tools             = new List<Tool> { new Tool { FunctionDeclarations = new List<FunctionDeclaration> { declaration } } },
                ToolConfig        = new ToolConfig
                {
                    FunctionCallingConfig = new FunctionCallingConfig
                    {
                        Mode                 = FunctionCallingConfigMode.Any,
                        AllowedFunctionNames = new List<string> { "calculate_liquidacion" },
                    },
                },
                Temperature     = 0.1f,  // Mínima temperatura: cálculos numéricos requieren precisión máxima
                MaxOutputTokens = 4096,
            };
            var r    = await _client.Models.GenerateContentAsync("gemini-3-flash-preview", ToContent(contents), config);
            var call = r.FunctionCalls?.FirstOrDefault();
            return call?.Args != null ? JsonSerializer.Serialize(call.Args) : "{}";
        }, CancellationToken.None);
    }

    // ── CONTADOR: Generador de Informes Periciales Contables ─────────────────
    // Genera el informe pericial con la estructura oficial del Poder Judicial peruano:
    // Cargo del Perito → Objeto → Metodología → Análisis → Conclusiones → Anexos.
    public async Task<string> GenerarInformePericialAsync(
        string tipoPericia,
        string hallazgosJson)
    {
        var systemPrompt =
            BuildRoleSystemInstruction("CONTADOR") + "\n\n" +
            "Eres el Generador de Informes Periciales de LegalPro. " +
            "Redacta el informe con la estructura oficial del PJ peruano para peritos contables: " +
            "1) Cargo/nombramiento, 2) Objeto de la pericia, 3) Metodología, " +
            "4) Análisis y hallazgos, 5) Conclusiones (numeradas), 6) Observaciones. " +
            "Llama a la función generate_informe_pericial con el resultado.";

        var declaration = new FunctionDeclaration
        {
            Name        = "generate_informe_pericial",
            Description = "Retorna informe pericial contable con la estructura oficial del Poder Judicial peruano.",
            Parameters  = new Schema
            {
                Type       = SchemaType.Object,
                Properties = new Dictionary<string, Schema>
                {
                    ["objetoPericia"]    = new Schema { Type = SchemaType.String, Description = "Qué se pericia y para qué expediente." },
                    ["metodologia"]      = new Schema { Type = SchemaType.String, Description = "Método contable/financiero aplicado (NIC, NIIF, etc.)." },
                    ["analisis"]         = new Schema { Type = SchemaType.String, Description = "Desarrollo técnico del análisis." },
                    ["conclusiones"]     = new Schema
                    {
                        Type  = SchemaType.Array,
                        Items = new Schema
                        {
                            Type       = SchemaType.Object,
                            Properties = new Dictionary<string, Schema>
                            {
                                ["numero"]     = new Schema { Type = SchemaType.Integer },
                                ["conclusion"] = new Schema { Type = SchemaType.String, Description = "Conclusión técnica numerada." },
                                ["sustento"]   = new Schema { Type = SchemaType.String, Description = "Base normativa o cálculo que la sustenta." },
                            },
                            Required = new List<string> { "numero", "conclusion", "sustento" },
                        },
                    },
                    ["montoTotal"]       = new Schema { Type = SchemaType.Number, Description = "Monto total determinado por la pericia (si aplica). 0 si no corresponde." },
                    ["observaciones"]    = new Schema { Type = SchemaType.String, Description = "Limitaciones del informe por falta de información." },
                    ["anexosSugeridos"]  = new Schema
                    {
                        Type  = SchemaType.Array,
                        Items = new Schema { Type = SchemaType.String, Description = "Documento de soporte sugerido para el informe." },
                    },
                },
                Required = new List<string> { "objetoPericia", "metodologia", "analisis", "conclusiones", "montoTotal" },
            },
        };

        var contents = $"TIPO_PERICIA: {tipoPericia}\nHALLAZGOS:\n{hallazgosJson}";

        return await _pipeline.ExecuteAsync(async ct =>
        {
            var config = new GenerateContentConfig
            {
                SystemInstruction = ToContent(systemPrompt),
                Tools             = new List<Tool> { new Tool { FunctionDeclarations = new List<FunctionDeclaration> { declaration } } },
                ToolConfig        = new ToolConfig
                {
                    FunctionCallingConfig = new FunctionCallingConfig
                    {
                        Mode                 = FunctionCallingConfigMode.Any,
                        AllowedFunctionNames = new List<string> { "generate_informe_pericial" },
                    },
                },
                Temperature     = 0.3f,
                MaxOutputTokens = 8192,
            };
            var r    = await _client.Models.GenerateContentAsync("gemini-3-flash-preview", ToContent(contents), config);
            var call = r.FunctionCalls?.FirstOrDefault();
            return call?.Args != null ? JsonSerializer.Serialize(call.Args) : "{}";
        }, CancellationToken.None);
    }

    // ════════════════════════════════════════════════════════════════════════
    // SIMULACIÓN DE JUICIO INTERACTIVA — ILegalSimulacion
    // SDK oficial: Function Calling con parametersJsonSchema (modern FC syntax).
    // Context7 (@google/genai): FunctionDeclaration + FunctionCallingConfigMode.Any
    // ════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Genera contexto inicial del juicio y el primer turno adversarial.
    /// FC forzado con FunctionCallingConfigMode.Any → JSON garantizado.
    /// </summary>
    public async Task<string> IniciarSimulacionAsync(
        string rama,
        string rolUsuario,
        string dificultad,
        string descripcionCaso)
    {
        var rolAdversarial = rolUsuario.ToUpperInvariant() switch
        {
            "ABOGADO" or "DEFENSA" => "Fiscal del Ministerio Público",
            "FISCAL"               => "Abogado Defensor",
            "JUEZ"                 => "Abogado Defensor y el Fiscal",
            _                      => "Parte contraria"
        };

        var sistemPrompt =
            $"{BaseSystemInstruction}\n\n" +
            $"Eres el Juez Moderador de una simulación de juzgamiento oral conforme al NCPP peruano.\n" +
            $"Rama del derecho: {rama}. Dificultad: {dificultad}.\n" +
            $"El usuario actúa como: {rolUsuario}. La parte adversarial es: {rolAdversarial}.\n" +
            "Genera: (1) contexto sintético del caso listo para el juicio, " +
            "(2) apertura del Juez declarando el inicio de la sesión, " +
            "(3) alegato inicial del rol adversarial.";

        // FC con parametersJsonSchema — garantiza estructura JSON (Context7 pattern)
        var iniciarDeclaration = new FunctionDeclaration
        {
            Name        = "iniciar_simulacion",
            Description = "Retorna el contexto del caso y los mensajes de apertura del juicio oral.",
            Parameters  = new Schema
            {
                Type       = SchemaType.Object,
                Properties = new Dictionary<string, Schema>
                {
                    ["contextoSintetico"]  = new Schema { Type = SchemaType.String, Description = "Resumen fáctico del caso para el juicio." },
                    ["mensajeJuez"]        = new Schema { Type = SchemaType.String, Description = "Apertura formal del Juez." },
                    ["mensajeAdversarial"] = new Schema { Type = SchemaType.String, Description = "Alegato inicial de la parte adversarial." },
                    ["rolAdversarial"]     = new Schema { Type = SchemaType.String, Description = "Nombre del rol adversarial (ej: Fiscal del MP)." },
                },
                Required = new List<string> { "contextoSintetico", "mensajeJuez", "mensajeAdversarial", "rolAdversarial" }
            }
        };

        return await _pipeline.ExecuteAsync(async ct =>
        {
            var config = new GenerateContentConfig
            {
                SystemInstruction = new Content { Parts = new List<Part> { new Part { Text = sistemPrompt } } },
                Temperature       = 0.7f,
                MaxOutputTokens   = 2048,
                Tools             = new List<Tool> { new Tool { FunctionDeclarations = new List<FunctionDeclaration> { iniciarDeclaration } } },
                ToolConfig        = new ToolConfig
                {
                    FunctionCallingConfig = new FunctionCallingConfig
                    {
                        Mode                 = FunctionCallingConfigMode.Any,
                        AllowedFunctionNames = new List<string> { "iniciar_simulacion" }
                    }
                }
            };

            var response = await _client.Models.GenerateContentAsync(
                "gemini-3-flash-preview",
                $"Caso: {descripcionCaso}",
                config);

            // Extraer args del function call → serializar como JSON
            var call = response.FunctionCalls?.FirstOrDefault();
            if (call?.Args is { } args)
                return JsonSerializer.Serialize(args);

            return response.Text ?? "{}";
        }, CancellationToken.None);
    }

    /// <summary>
    /// Procesa un turno de la simulación. Gemini responde como parte adversarial.
    /// FC forzado: garantiza puntajeDelta, leyesInvocadas y esFinSimulacion.
    /// </summary>
    public async Task<string> ProcesarTurnoSimulacionAsync(
        string historialTurnos,
        string intervencionUsuario,
        string rolAdversarial)
    {
        var sistemPrompt =
            $"{BaseSystemInstruction}\n\n" +
            $"Estás en una simulación de juicio oral peruano (NCPP). Actúas como: {rolAdversarial}.\n" +
            "Responde al argumento del usuario con: réplica legal, evalúa la calidad procesal " +
            "del argumento (+10 a -20 puntos), cita artículos del NCPP/CPC si aplica, " +
            "y determina si el juicio ha concluido (máx 10 turnos o si hay sentencia/acuerdo).";

        var turnoDeclaration = new FunctionDeclaration
        {
            Name        = "procesar_turno",
            Description = "Procesa un turno del juicio oral y emite la respuesta adversarial estructurada.",
            Parameters  = new Schema
            {
                Type       = SchemaType.Object,
                Properties = new Dictionary<string, Schema>
                {
                    ["mensajeRespuesta"]  = new Schema { Type = SchemaType.String, Description = "Réplica legal de la parte adversarial." },
                    ["puntajeDelta"]      = new Schema { Type = SchemaType.Integer, Description = "Cambio de puntaje del usuario (-20 a +10)." },
                    ["leyesInvocadas"]    = new Schema { Type = SchemaType.String, Description = "Artículos o normas citadas (nullable)." },
                    ["esFinSimulacion"]   = new Schema { Type = SchemaType.Boolean, Description = "True si el juicio ha concluido." },
                    ["evaluacionTurno"]   = new Schema { Type = SchemaType.String, Description = "Evaluación breve del argumento del usuario." },
                },
                Required = new List<string> { "mensajeRespuesta", "puntajeDelta", "esFinSimulacion" }
            }
        };

        return await _pipeline.ExecuteAsync(async ct =>
        {
            var config = new GenerateContentConfig
            {
                SystemInstruction = new Content { Parts = new List<Part> { new Part { Text = sistemPrompt } } },
                Temperature       = 0.6f,
                MaxOutputTokens   = 1024,
                Tools             = new List<Tool> { new Tool { FunctionDeclarations = new List<FunctionDeclaration> { turnoDeclaration } } },
                ToolConfig        = new ToolConfig
                {
                    FunctionCallingConfig = new FunctionCallingConfig
                    {
                        Mode                 = FunctionCallingConfigMode.Any,
                        AllowedFunctionNames = new List<string> { "procesar_turno" }
                    }
                }
            };

            var prompt = $"HISTORIAL:\n{historialTurnos}\n\nARGUMENTO DEL USUARIO:\n{intervencionUsuario}";
            var response = await _client.Models.GenerateContentAsync("gemini-3-flash-preview", prompt, config);

            var call = response.FunctionCalls?.FirstOrDefault();
            if (call?.Args is { } args)
                return JsonSerializer.Serialize(args);

            return response.Text ?? "{}";
        }, CancellationToken.None);
    }

    // ════════════════════════════════════════════════════════════════════════
    // BÚSQUEDA DE JURISPRUDENCIA — Google Search grounding (deep search)
    // Context7: tools: [{ googleSearch: {} }] para grounding en tiempo real.
    // ════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Busca jurisprudencia peruana con Google Search grounding (internet real-time).
    /// Usa Tool { GoogleSearch } para deep search + ResponseMimeType json para estructura.
    /// </summary>
    public async Task<string> BuscarJurisprudenciaAsync(string query, string rama, int limit = 5)
    {
        var sistemPrompt =
            $"{BaseSystemInstruction}\n\n" +
            "Eres investigador jurídico especializado en jurisprudencia peruana.\n" +
            "Usa tu acceso a fuentes legales para encontrar jurisprudencia REAL y verificable.\n" +
            "NO inventes expedientes — si no encuentras resultados reales, devuelve array vacío.\n" +
            "Fuentes confiables: TC, Corte Suprema (Casaciones), Corte Superior, INDECOPI, SBS.";

        var prompt =
            $"Busca exactamente {limit} fallos de jurisprudencia peruana sobre:\n" +
            $"TEMA: {query}\nRAMA DEL DERECHO: {rama}\n\n" +
            "RESPONDE ÚNICAMENTE EN JSON CON ESTA ESTRUCTURA:\n" +
            "{\"resultados\":[{\"tribunal\":\"string\",\"numero\":\"string\"," +
            "\"anio\":\"string\",\"resumen\":\"string\",\"relevancia\":\"Alta|Media|Baja\"," +
            "\"urlDocumento\":\"string|null\"}]}";

        return await _pipeline.ExecuteAsync(async ct =>
        {
            // Google Search grounding: deep search sobre fuentes legales reales
            // Context7 pattern: tools: [{ googleSearch: {} }]
            var config = new GenerateContentConfig
            {
                SystemInstruction = new Content { Parts = new List<Part> { new Part { Text = sistemPrompt } } },
                Temperature       = 0.1f,
                MaxOutputTokens   = 4096,
                ResponseMimeType  = "application/json",
                Tools             = new List<Tool> { new Tool { GoogleSearch = new GoogleSearch() } }
            };

            var response = await _client.Models.GenerateContentAsync("gemini-3-flash-preview", prompt, config);
            var raw = response.Text?.Trim() ?? "{}";

            // Sanitizar markdown fences si el modelo los incluyó
            if (raw.StartsWith("```"))
                raw = raw.Replace("```json", "").Replace("```", "").Trim();

            return raw;
        }, CancellationToken.None);
    }
}

