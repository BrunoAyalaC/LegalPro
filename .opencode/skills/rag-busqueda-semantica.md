---
name: rag-busqueda-semantica
description: Guia de RAG optimizado para el proyecto. Indexacion de catalogos legales, busqueda semantica, embeddings, prompt augmentation, anti-alucinaciones, citaciones verificables.
when-to-use: "Cuando se necesite configurar RAG, mejorar la precision de busqueda, o agregar nuevos catalogos"
allowed-tools: Read, Write, Edit, Grep, Glob
updated: 2026-07-31
componentes: [embeddings, vector-store, chunking, prompt-augmentation, citaciones]
---

# rag-busqueda-semantica (v3.0 RAG-optimized)

Guía de **Retrieval-Augmented Generation (RAG)** optimizado para LegalPro. Cubre indexación de catálogos legales, búsqueda semántica, embeddings, prompt augmentation y anti-alucinaciones. **A julio 2026**.

## Arquitectura RAG

```
┌────────────────────────────────────────────────────────────────┐
│                   PIPELINE RAG LEGALPRO                         │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐       │
│  │  CATALOGOS   │ → │   CHUNKING   │ → │  EMBEDDINGS  │       │
│  │  (corpus)    │   │   (split)    │   │  (vectors)   │       │
│  └──────────────┘   └──────────────┘   └──────────────┘       │
│                                                     ↓          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐       │
│  │   PROMPT     │ ← │  RETRIEVAL   │ ← │ VECTOR STORE │       │
│  │  AUGMENTED   │   │   (top-K)    │   │  (Supabase)  │       │
│  └──────────────┘   └──────────────┘   └──────────────┘       │
│         ↓                                                      │
│  ┌──────────────┐   ┌──────────────┐                          │
│  │  MINIMAX M3  │ → │  CITAS       │                          │
│  │  (LLM)       │   │  VERIFICADAS │                          │
│  └──────────────┘   └──────────────┘                          │
└────────────────────────────────────────────────────────────────┘
```

## Inputs (configuración)

```yaml
corpus_paths:
  - catalogs/codigos-leyes.json
  - catalogs/plazos-procesales.json
  - catalogs/tipos-penales-peru.json
  - catalogs/delitos-economicos.json
  - catalogs/disclaimers-ia.json
  - catalogs/glosario-juridico.md
  - docs/PRD-MVP-PRODUCTION.md
  - docs/PLAN-ORQUESTACION-AGENTES.md
  - arneses/runbooks/
  - arneses/registry/ADRs/

embedding_model: text-embedding-3-small (OpenAI) | text-embedding-004 (Gemini)
vector_store: pgvector (Supabase) | Pinecone | Weaviate
chunk_size: 512 tokens
chunk_overlap: 64 tokens
top_k: 5
similarity_threshold: 0.75
temperature: 0.1
```

## 1. Indexación de corpus

### Chunker inteligente (por secciones)

```javascript
// legalpro-app/server/utils/rag-chunker.js
export function chunkLegalCatalog(catalog) {
  const chunks = [];

  for (const item of catalog.normas || catalog.plazos || catalog.tipos) {
    chunks.push({
      id: item.id,
      source: catalog.path,
      content: JSON.stringify(item),
      metadata: {
        tipo: catalog.type,
        codigo: item.id,
        articulos: item.articulos_mas_citados,
        fecha_ultima_modificacion: item.fecha_ultima_modificacion,
      },
    });
  }

  return chunks;
}
```

### Embeddings + Storage

```javascript
// legalpro-app/server/utils/rag-indexer.js
import { MinimaxClient } from '@minimax/sdk';
import { chunkLegalCatalog } from './rag-chunker.js';

export async function indexCatalog(catalog) {
  const chunks = chunkLegalCatalog(catalog);
  const client = new MinimaxClient({ apiKey: process.env.MINIMAX_API_KEY });

  for (const chunk of chunks) {
    const embedding = await client.embeddings.create({
      model: 'text-embedding-004',
      content: chunk.content,
    });

    await db.query(`
      INSERT INTO rag_vectors (id, source, content, embedding, metadata)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET embedding = $4
    `, [chunk.id, chunk.source, chunk.content, embedding.vector, chunk.metadata]);
  }
}
```

## 2. Retrieval (Búsqueda semántica)

```javascript
// legalpro-app/server/utils/rag-retriever.js
export async function retrieveRelevantChunks(query, topK = 5) {
  const client = new MinimaxClient({ apiKey: process.env.MINIMAX_API_KEY });
  const queryEmbedding = await client.embeddings.create({
    model: 'text-embedding-004',
    content: query,
  });

  const { rows } = await db.query(`
    SELECT id, source, content, metadata,
           embedding <=> $1 AS distance
    FROM rag_vectors
    WHERE metadata->>'tipo' = 'codigo_legal'
    ORDER BY distance ASC
    LIMIT $2
  `, [JSON.stringify(queryEmbedding.vector), topK]);

  return rows.filter(r => r.distance < 0.25); // threshold 0.75 similitud
}
```

## 3. Prompt Augmentation

```javascript
// legalpro-app/server/utils/rag-prompter.js
import { retrieveRelevantChunks } from './rag-retriever.js';

export async function buildAugmentedPrompt(userQuery, systemInstruction) {
  const relevantChunks = await retrieveRelevantChunks(userQuery, 5);

  const context = relevantChunks.map((chunk, i) =>
    `[${i + 1}] FUENTE: ${chunk.source}\n${chunk.content}\n`
  ).join('\n');

  const prompt = `
${systemInstruction}

CONTEXTO NORMATIVO VERIFICADO:
${context}

PREGUNTA DEL USUARIO:
${userQuery}

INSTRUCCIONES:
- Basa tu respuesta EXCLUSIVAMENTE en el contexto normativo proporcionado.
- Cita las fuentes con el formato [N] donde N es el número de fuente.
- NUNCA inventes artículos o leyes.
- Si no encuentras la respuesta en el contexto, di "No encuentro base normativa suficiente".
- Incluye los 4 disclaimers IA obligatorios.
- Idioma: es-PE.
`.trim();

  return {
    prompt,
    sources: relevantChunks.map(c => ({ id: c.id, source: c.source, distancia: c.distance })),
  };
}
```

## 4. Generación con citaciones verificables

```javascript
// legalpro-app/server/utils/rag-generator.js
export async function generateWithCitations(userQuery, systemInstruction) {
  const { prompt, sources } = await buildAugmentedPrompt(userQuery, systemInstruction);

  const client = new MinimaxClient({ apiKey: process.env.MINIMAX_API_KEY });
  const response = await client.chat.completions.create({
    model: 'MiniMax-M3',
    temperature: 0.1,
    max_tokens: 8192,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt },
    ],
  });

  // 5. Post-procesamiento: validar citaciones
  const verifiedCitations = validateCitations(response.content, sources);

  // 6. Insertar disclaimers
  const finalContent = insertDisclaimers(verifiedCitations);

  return {
    content: finalContent,
    sources,
    citations_verified: true,
    hallucinations_removed: detectHallucinations(response.content),
  };
}
```

## 5. Validación de citaciones (anti-alucinación)

```javascript
// legalpro-app/server/utils/rag-validator.js
export function validateCitations(text, sources) {
  const citationPattern = /\[(\d+)\]/g;
  const matches = [...text.matchAll(citationPattern)];

  return matches.every(m => {
    const idx = parseInt(m[1]) - 1;
    return idx >= 0 && idx < sources.length;
  });
}

export function detectHallucinations(text) {
  // Patrones comunes de alucinaciones legales
  const hallucinationPatterns = [
    /artículo\s+\d+\s+del\s+Código\s+\w+\s+[A-Z]+/,  // "Artículo X del Código Z YYY"
    /Ley\s+\d+\/\d+-JZ/,  // Leyes inventadas
    /D\.S\.\s+\d{3}-\d{4}-JUS-INVALID/,  // DS mal formados
  ];

  const hallucinated = [];
  for (const pattern of hallucinationPatterns) {
    const match = text.match(pattern);
    if (match) hallucinated.push(match[0]);
  }
  return hallucinated;
}
```

## 6. Pipeline completo RAG

```javascript
// Caso de uso: analizar expediente
async function analizarExpedienteConRAG(expediente, pregunta) {
  // 1. Retrieval
  const userQuery = `${expediente.hechos_relevantes.join(' ')}\n\n${pregunta}`;
  const chunks = await retrieveRelevantChunks(userQuery, 5);

  // 2. Prompt augmentation con contexto del expediente
  const { prompt, sources } = await buildAugmentedPrompt(userQuery, SYSTEM_INSTRUCTION_LEGAL);

  // 3. Generación con MiniMax M3
  const response = await minmax.chat.completions.create({
    model: 'MiniMax-M3',
    temperature: 0.1,  // determinismo legal
    messages: [{ role: 'user', content: prompt }],
  });

  // 4. Validación de citaciones
  const citationsValid = validateCitations(response.content, sources);
  if (!citationsValid) {
    logger.warn('rag.citations_invalid', { expediente_id: expediente.id });
  }

  // 5. Detección de alucinaciones
  const hallucinations = detectHallucinations(response.content);

  // 6. Inserción de disclaimers
  const finalContent = insertDisclaimers(response.content);

  return {
    content: finalContent,
    sources,
    citations_valid: citationsValid,
    hallucinations_detected: hallucinations,
    cost_usd: calculateCost(response.usage),
  };
}
```

## 7. Métricas RAG

```yaml
metricas_obligatorias:
  - retrieval_precision_at_k: >= 0.85  # % de chunks relevantes en top-K
  - retrieval_recall_at_k: >= 0.90     # % de chunks relevantes recuperados
  - citation_accuracy: >= 0.98          # % de citas verificables
  - hallucination_rate: < 0.02          # % de alucinaciones detectadas
  - context_relevance_score: >= 0.80    # LLM evalúa relevancia del contexto
  - answer_relevance_score: >= 0.85     # LLM evalúa relevancia de la respuesta
```

## 8. Optimizaciones específicas para LegalPro

1. **Hybrid search** (BM25 + vector): para términos técnicos legales que son densos
2. **Re-ranking con cross-encoder**: mejora top-K después del retrieval inicial
3. **Metadata filtering**: filtrar por `materia` (penal/civil/laboral) ANTES del retrieval
4. **Caching de embeddings**: cachear embeddings de queries frecuentes
5. **Chunk overlap 64**: suficiente para contexto legal sin duplicar info
6. **Citation chunks**: cada chunk debe ser autocontenido y verificable
7. **Citation strip**: cada cita debe incluir URL SPIJ para verificación humana

## 9. Implementación de referencia en .NET 9 (julio 2026)

> Stack: `net9.0`, `Npgsql 9.0.x`, `Microsoft.Extensions.Http 9.0.x`, Nativo (sin librería `Pgvector`).

### 9.1 Servicio `IRagService` + `RagService`

```csharp
// Application/Common/Interfaces/IRagService.cs
public interface IRagService
{
    Task<RagResult> ConsultarBaseLegalAsync(RagQuery query, CancellationToken ct = default);
    Task IndexarDocumentoAsync(RagDocument documento, CancellationToken ct = default);
    Task<RagCitacionValidada> ValidarCitacionAsync(string url, CancellationToken ct = default);
    bool IsEnabled { get; }   // lee ENABLE_RAG=true
}
```

**Inyección de dependencias (en `DependencyInjection.cs`):**

```csharp
services.AddScoped<IRagService, RagService>();
services.AddHttpClient("OpenAI", c => c.Timeout = TimeSpan.FromSeconds(30));
services.AddHttpClient("RagCitationValidator", c => c.Timeout = TimeSpan.FromSeconds(15));
```

### 9.2 Búsqueda semántica nativa Npgsql + pgvector (sin librería `Pgvector`)

```csharp
// Búsqueda: cosine similarity = 1 - (embedding <=> @vec::vector)
const string sql = @"
    SELECT id, source, content, metadata,
           1 - (embedding <=> @embedding::vector) AS similarity
    FROM rag_vectors
    WHERE 1 - (embedding <=> @embedding::vector) > @threshold
      AND (@materia = '' OR metadata->>'materia' = @materia)
    ORDER BY embedding <=> @embedding::vector
    LIMIT @topk";

// Helper: serializa float[] a texto con cultura invariante (evita '0,1' por es-PE)
private static string BuildVectorString(float[] embedding) {
    var sb = new StringBuilder(embedding.Length * 12);
    sb.Append('[');
    for (int i = 0; i < embedding.Length; i++) {
        if (i > 0) sb.Append(',');
        sb.Append(embedding[i].ToString(CultureInfo.InvariantCulture));
    }
    sb.Append(']');
    return sb.ToString();
}
```

**Importante:**
- `CultureInfo.InvariantCulture` es OBLIGATORIO: en entorno `es-PE` el
  separador decimal es la coma, lo que rompe el cast `::vector` de Postgres.
- El cast `@embedding::vector` se aplica en el servidor: el driver Npgsql
  envía el string como texto y Postgres lo convierte al tipo `vector`.

### 9.3 Dimensiones del modelo de embeddings

`text-embedding-3-small` por defecto devuelve **1536** dimensiones, pero acepta el
parámetro `dimensions` para reducir (768 en el corpus actual de LegalPro).
El modelo configurado en `RAG:EmbeddingModel` DEBE coincidir con `vector(N)`
de la tabla `rag_vectors` (ver §7 del skill).

```json
// Llamada OpenAI con dimensión reducida
{
  "model": "text-embedding-3-small",
  "input": "...",
  "dimensions": 768
}
```

### 9.4 Hardening obligatorio

- **NO loggear la consulta** del usuario (puede contener PII del cliente).
- **NO loggear URL completa** de citación (puede contener tokens en query string).
- **Validar esquema** de URL: solo `http`/`https` (rechazar `file://`, `javascript:`).
- **HEAD con fallback a GET** para validación de citaciones (algunos CDN no soportan HEAD).
- **Feature flag** `ENABLE_RAG=true` requerido; sin él el servicio retorna
  `RagResult` vacío (no rompe consumidores existentes).

### 9.5 Tests con xUnit + Moq (pitfall conocido)

```csharp
// ❌ NO funciona: Moq no soporta mockear extension methods
var cfg = new Mock<IConfiguration>();
cfg.Setup(c => c.GetConnectionString("DefaultConnection")).Returns(...);  // FALLA

// ✅ Correcto: usar ConfigurationBuilder + AddInMemoryCollection
var cfg = new ConfigurationBuilder()
    .AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["ConnectionStrings:DefaultConnection"] = "Host=...;",
        ["OPENAI_API_KEY"] = "sk-test"
    })
    .Build();
```

`GetConnectionString()` es extension method de `ConfigurationExtensions`;
Moq no puede interceptarlo. Usa siempre `ConfigurationBuilder` real en tests.

### 9.6 Endpoints REST (regla #9 BackendDotNet)

| Verbo | Ruta | Rate Limit | Roles |
|---|---|---|---|
| `GET` | `/api/ai/rag/status` | general | autenticado |
| `POST` | `/api/ai/rag/consultar` | `minimax` | autenticado |
| `POST` | `/api/ai/rag/indexar` | general | `OWNER, ADMIN` |
| `POST` | `/api/ai/rag/validar-citacion` | general | autenticado |

Respuesta JSON consistente: `{ success, data, error, correlationId }` (ver regla #9).

## Quality gates

- [ ] Retrieval precision ≥ 0.85
- [ ] Citation accuracy ≥ 0.98
- [ ] Hallucination rate < 2%
- [ ] Context relevance ≥ 0.80
- [ ] Latencia p95 con RAG < 3s
- [ ] Costo/req < $0.10
- [ ] 100% de respuestas con 4 disclaimers IA
- [ ] 100% de citas con URL SPIJ

## Audit log

Emitir `RAG_RETRIEVAL`, `RAG_GENERATION`, `RAG_CITATION_VALIDATED`, `RAG_HALLUCINATION_DETECTED`.

## Referencias

- `catalogs/codigos-leyes.json`
- `catalogs/plazos-procesales.json`
- `legalpro-app/server/utils/rag-chunker.js` (crear)
- `legalpro-app/server/utils/rag-retriever.js` (crear)
- `legalpro-app/server/utils/rag-prompter.js` (crear)
- `legalpro-app/server/utils/rag-validator.js` (crear)
- Supabase pgvector: https://supabase.com/docs/guides/database/extensions/pgvector
- Lewis et al. 2020 — RAG original paper: https://arxiv.org/abs/2005.11401
- Anthropic — Prompt caching: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- LangChain RAG: https://python.langchain.com/docs/use_cases/question_answering/
- SPIJ: https://spij.minjus.gob.pe/
- TC Jurisprudencia Sistematizada: https://jurisprudencia.sedetc.gob.pe/
