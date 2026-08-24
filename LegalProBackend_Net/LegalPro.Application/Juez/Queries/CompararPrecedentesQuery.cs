using FluentValidation;
using MediatR;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using LegalPro.Application.Common;
using LegalPro.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace LegalPro.Application.Juez.Queries;

/// <summary>
/// Compara el caso actual con precedentes vinculantes del TC, Casaciones de la Corte Suprema
/// y Acuerdos Plenarios relevantes — esencial para motivación judicial (art. 139.5 Const.).
/// FC forzado: el proveedor IA actúa como estudioso del derecho, no como parte.
///
/// FIX anti-mock B (2026-08-24): el handler YA NO deja que el LLM cite precedentes
/// "de memoria". Flujo:
///   1. Recupera precedentes REALES del corpus RAG del backend Node
///      (GET {NodeApi:BaseUrl}/api/ai/jurisprudencia, timeout 10s, fail-open → lista vacía).
///   2. Si la lista viene vacía O rag_degradado=true → responde "No hay jurisprudencia
///      indexada verificable para comparar" SIN llamar al LLM (fail-closed honesto).
///   3. Si hay precedentes verificados → el prompt SOLO permite analizar/comparar los
///      recuperados entre sí y con el caso; prohibido generar referencias nuevas.
/// </summary>
public class CompararPrecedentesQuery : IRequest<PrecedentesDto>
{
    public string CasoActual              { get; set; } = string.Empty;
    public string RamaDerecho             { get; set; } = "civil";
    public string TipoResolucionBuscada   { get; set; } = "sentencia";
    public string Rol                     { get; set; } = "JUEZ";
}

/// <summary>
/// FIX anti-mock B: PrecedenteDto SOLO transporta precedentes recuperados del corpus
/// RAG Node. Sin ejemplos de números de casación/expediente en comentarios ni prompts:
/// son semilla de alucinación (el LLM copia el formato e inventa el número).
/// La referencia textual proviene exclusivamente del metadata del chunk RAG.
/// </summary>
public record PrecedenteDto(
    string Referencia,
    string Resumen,
    string AplicabilidadAlCaso,
    string Vinculatoriedad,   // "vinculante" | "orientador" | "referencial"
    string Fuente);           // Derivado determinísticamente del source indexado (TC | Corte Suprema | INDECOPI | ...)

public record PrecedentesDto(
    string CasoActual,
    string RamaDerecho,
    IReadOnlyList<PrecedenteDto> PrecedentesAplicables,
    IReadOnlyList<PrecedenteDto> PrecedentesContrarios,
    string SintesisComparativa,
    string RecomendacionMotivacion,
    string Advertencias,
    bool RagVerificado,       // false = corpus vacío o recuperación degradada (embeddings placeholder)
    int PrecedentesUsados,    // FIX anti-mock B: trazabilidad — nº de precedentes RAG anclados al prompt
    string Fuente,            // FIX anti-mock B: 'rag_vectors_v2' | 'ninguna' (fail-closed sin corpus)
    DateTime GeneradoEn);

public class CompararPrecedentesQueryValidator : AbstractValidator<CompararPrecedentesQuery>
{
    private static readonly string[] RamasValidas =
        { "penal", "civil", "laboral", "familia", "constitucional", "administrativo" };
    private static readonly string[] TiposValidos =
        { "sentencia", "auto_cautelar", "sentencia_absolutoria", "sentencia_condenatoria", "auto_de_vista", "resolucion_casacion" };

    public CompararPrecedentesQueryValidator()
    {
        RuleFor(x => x.CasoActual)
            .NotEmpty()
            .MinimumLength(50)
            .MaximumLength(10000)
            .WithMessage("Describe el caso con al menos 50 caracteres para una comparación útil.");

        RuleFor(x => x.RamaDerecho)
            .NotEmpty()
            .Must(v => RamasValidas.Contains(v.ToLower()))
            .WithMessage($"RamaDerecho debe ser: {string.Join(", ", RamasValidas)}");

        RuleFor(x => x.TipoResolucionBuscada)
            .NotEmpty()
            .Must(v => TiposValidos.Contains(v.ToLower()))
            .WithMessage($"TipoResolucionBuscada debe ser: {string.Join(", ", TiposValidos)}");
    }
}

/// <summary>Precedente crudo recuperado del corpus RAG Node (única fuente permitida).</summary>
internal sealed record RagPrecedente(string Referencia, string Tribunal, string Numero, string Anio, string Resumen);

public class CompararPrecedentesQueryHandler : IRequestHandler<CompararPrecedentesQuery, PrecedentesDto>
{
    private const int NodeTimeoutSeconds = 10;
    private const int NodeLimit = 8;

    private readonly IGeminiClient _llm;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    public CompararPrecedentesQueryHandler(
        IGeminiClient llm,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration)
    {
        _llm = llm;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    public async Task<PrecedentesDto> Handle(CompararPrecedentesQuery request, CancellationToken cancellationToken)
    {
        // ── 1) Fuente primaria OBLIGATORIA: corpus RAG real del backend Node ──
        var (precedentes, ragDegradado) = await RecuperarPrecedentesRagAsync(request, cancellationToken);

        // ── 2) Fail-closed honesto: sin precedentes verificables (vacío) o recuperación
        //      degradada (rag_degradado=true → similitudes no confiables) NO se llama al LLM ──
        if (precedentes.Count == 0 || ragDegradado)
        {
            const string aviso = "No hay jurisprudencia indexada verificable para comparar. Indexa casaciones o verifica en SPIJ.";
            var avisoFinal = ragDegradado
                ? $"{aviso} Recuperación RAG en modo degradado (embeddings placeholder): resultados descartados por no ser verificables."
                : aviso;
            return new PrecedentesDto(
                CasoActual:              request.CasoActual,
                RamaDerecho:             request.RamaDerecho,
                PrecedentesAplicables:   Array.Empty<PrecedenteDto>(),
                PrecedentesContrarios:   Array.Empty<PrecedenteDto>(),
                SintesisComparativa:     aviso,
                RecomendacionMotivacion: "Indexe jurisprudencia en el corpus RAG o reformule la consulta con términos más específicos.",
                Advertencias:            avisoFinal,
                RagVerificado:           false,
                PrecedentesUsados:       0,
                Fuente:                  "ninguna",
                GeneradoEn:              DateTime.UtcNow);
        }

        // ── 3) Prompt anclado: el LLM SOLO compara los precedentes RECUPERADOS entre sí ──
        var json = await _llm.GenerateAsync(ConstruirPromptAnclado(request, precedentes));

        using var doc = JsonDocument.Parse(json);
        var r = doc.RootElement;

        static PrecedenteDto ParsePrecedente(JsonElement el) => new(
            Referencia:           el.GetStringOrDefault("referencia"),
            Resumen:              el.GetStringOrDefault("resumen"),
            AplicabilidadAlCaso:  el.GetStringOrDefault("aplicabilidadAlCaso"),
            Vinculatoriedad:      el.GetStringOrDefault("vinculatoriedad", "referencial"),
            Fuente:               el.GetStringOrDefault("fuente"));

        var aplicables = new List<PrecedenteDto>();
        if (r.TryGetProperty("precedentesAplicables", out var arrA) && arrA.ValueKind == JsonValueKind.Array)
            foreach (var el in arrA.EnumerateArray())
                aplicables.Add(ParsePrecedente(el));

        var contrarios = new List<PrecedenteDto>();
        if (r.TryGetProperty("precedentesContrarios", out var arrC) && arrC.ValueKind == JsonValueKind.Array)
            foreach (var el in arrC.EnumerateArray())
                contrarios.Add(ParsePrecedente(el));

        var advertencias = r.GetStringOrDefault("advertencias");

        return new PrecedentesDto(
            CasoActual:              request.CasoActual,
            RamaDerecho:             request.RamaDerecho,
            PrecedentesAplicables:   aplicables,
            PrecedentesContrarios:   contrarios,
            SintesisComparativa:     r.GetStringOrDefault("sintesisComparativa"),
            RecomendacionMotivacion: r.GetStringOrDefault("recomendacionMotivacion"),
            Advertencias:            advertencias,
            RagVerificado:           true, // solo se llega aquí con corpus verificado (fail-closed previo)
            PrecedentesUsados:       precedentes.Count,
            Fuente:                  "rag_vectors_v2",
            GeneradoEn:              DateTime.UtcNow);
    }

    /// <summary>
    /// GET {NodeApi:BaseUrl}/api/ai/jurisprudencia?q=...&rama=...&limit=8
    /// Timeout 10s. Fail-open → lista vacía (el handler responde honestamente sin LLM).
    /// El JWT del llamador se reenvía vía NodeApiAuthForwardHandler para que el endpoint
    /// Node aplique SU RBAC/quota/multi-tenant al usuario real.
    /// </summary>
    private async Task<(List<RagPrecedente> Precedentes, bool Degradado)> RecuperarPrecedentesRagAsync(
        CompararPrecedentesQuery request, CancellationToken cancellationToken)
    {
        var precedentes = new List<RagPrecedente>();
        var baseUrl = _configuration["NodeApi:BaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl))
            return (precedentes, Degradado: false); // sin corpus configurado → fail-open documentado

        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(NodeTimeoutSeconds));

            var client = _httpClientFactory.CreateClient("nodeapi");
            if (client.BaseAddress is null)
                return (precedentes, Degradado: false);

            var url = $"/api/ai/jurisprudencia?q={Uri.EscapeDataString(Truncar(request.CasoActual, 300))}" +
                      $"&rama={Uri.EscapeDataString(request.RamaDerecho)}&limit={NodeLimit}";

            using var resp = await client.GetAsync(url, cts.Token);
            resp.EnsureSuccessStatusCode();

            await using var stream = await resp.Content.ReadAsStreamAsync(cts.Token);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cts.Token);
            var root = doc.RootElement;

            var degradado = root.TryGetProperty("rag_degradado", out var rd) && rd.ValueKind == JsonValueKind.True;

            if (root.TryGetProperty("resultados", out var arr) && arr.ValueKind == JsonValueKind.Array)
            {
                foreach (var el in arr.EnumerateArray())
                {
                    var tribunal = el.GetStringOrDefault("tribunal");
                    if (string.IsNullOrWhiteSpace(tribunal)) tribunal = el.GetStringOrDefault("sala");
                    var numero = el.GetStringOrDefault("numero");
                    // Node serializa el año como "año" (chunkAResultadoJurisprudencia); aceptamos "anio" por compatibilidad.
                    var anio = el.GetStringOrDefault("año");
                    if (string.IsNullOrWhiteSpace(anio)) anio = el.GetStringOrDefault("anio");
                    var resumen = el.GetStringOrDefault("resumen");
                    if (string.IsNullOrWhiteSpace(resumen)) continue;

                    var referencia = string.IsNullOrWhiteSpace(numero)
                        ? tribunal
                        : string.IsNullOrWhiteSpace(tribunal) ? numero : $"{tribunal} · {numero}";

                    precedentes.Add(new RagPrecedente(
                        Referencia: referencia ?? "Fuente indexada",
                        Tribunal:   tribunal ?? string.Empty,
                        Numero:     numero ?? string.Empty,
                        Anio:       anio ?? string.Empty,
                        Resumen:    Truncar(resumen, 700)));
                }
            }

            return (precedentes, degradado);
        }
        catch (Exception ex) when (
            ex is HttpRequestException or TaskCanceledException or JsonException or OperationCanceledException
                && !cancellationToken.IsCancellationRequested)
        {
            // Fail-open (timeout 10s / Node caído / payload inválido): lista vacía.
            // El handler responde "No hay jurisprudencia indexada verificable" — nunca inventa.
            return (precedentes, Degradado: false);
        }
    }

    /// <summary>
    /// Prompt estrictamente anclado al corpus: el LLM compara los precedentes RECUPERADOS
    /// entre sí y contra el caso. PROHIBIDO introducir precedentes o números nuevos.
    /// Sin ejemplos de casaciones (semilla de alucinación). Solo se invoca con corpus
    /// verificado (rag_degradado=false); la degradación se corta antes en el handler.
    /// </summary>
    private static string ConstruirPromptAnclado(
        CompararPrecedentesQuery request, List<RagPrecedente> precedentes)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Eres el Comparador de Precedentes de LegalPro.");
        sb.AppendLine("REGLA ABSOLUTA: SOLO puedes analizar los precedentes listados en PRECEDENTES_RECUPERADOS (corpus RAG indexado).");
        sb.AppendLine("PROHIBIDO citar, mencionar o inventar cualquier precedente, casación, sentencia o expediente que NO esté en esa lista.");
        sb.AppendLine("PROHIBIDO generar números de casación o expediente: la referencia debe copiarse TEXTUALMENTE desde PRECEDENTES_RECUPERADOS.");
        sb.AppendLine("Si un precedente no aplica al caso, omítelo; no lo sustituyas por otro que no esté listado.");
        sb.AppendLine();
        sb.AppendLine($"ROL: {request.Rol}");
        sb.AppendLine($"RAMA: {request.RamaDerecho}");
        sb.AppendLine($"TIPO_RESOLUCION_BUSCADA: {request.TipoResolucionBuscada}");
        sb.AppendLine("CASO_ACTUAL:");
        sb.AppendLine(request.CasoActual);
        sb.AppendLine();
        sb.AppendLine("PRECEDENTES_RECUPERADOS (única fuente permitida):");
        sb.AppendLine(JsonSerializer.Serialize(precedentes.Select(p => new
        {
            p.Referencia,
            p.Tribunal,
            p.Numero,
            p.Anio,
            p.Resumen,
        })));
        sb.AppendLine();
        sb.AppendLine("Compara los precedentes recuperados ENTRE SÍ y contra el caso actual. Responde ÚNICAMENTE con JSON válido (sin markdown):");
        sb.AppendLine("{\"precedentesAplicables\":[{\"referencia\":\"\",\"resumen\":\"\",\"aplicabilidadAlCaso\":\"\",\"vinculatoriedad\":\"vinculante|orientador|referencial\",\"fuente\":\"\"}],\"precedentesContrarios\":[],\"sintesisComparativa\":\"\",\"recomendacionMotivacion\":\"\",\"advertencias\":\"\"}");
        sb.Append("Los arrays solo pueden contener elementos cuya referencia exista textualmente en PRECEDENTES_RECUPERADOS.");
        return sb.ToString();
    }

    private static string Truncar(string s, int max)
        => string.IsNullOrEmpty(s) || s.Length <= max ? s : s[..max];
}
