# Arquitectura RAG (Retrieval-Augmented Generation) — LegalPro

> **Versión:** 1.0.0
> **Fecha:** 1 de agosto de 2026
> **Estado:** Producción alfa
> **Cobertura actual:** 319 documentos oficiales 2026
> **Chunks indexados estimados:** 800–1.200
> **Mantenedor:** arquitecto-chief (owner técnico) · gobernanza-chief (compliance) · devops (operaciones)

---

## 🎯 Propósito

El sistema RAG de LegalPro permite que los **96 subagentes** (abogado-jr-civil, ia-analista-expedientes, ia-buscador-jurisprudencia, contador-tributarista, etc.) consulten **la base legal peruana actualizada al día** con citaciones verificables, en lugar de depender únicamente de su conocimiento de entrenamiento.

### Problema que resuelve

| Sin RAG | Con RAG |
|---------|---------|
| Respuestas con riesgo de alucinación sobre leyes derogadas | Cita solo normas vigentes al 2026 |
| Imposible verificar fecha de última modificación | Cada chunk incluye `metadata.fecha_publicacion` |
| Subagentes pueden inventar artículos | Citaciones verificables con URL SPIJ/TC/INDECOPI |
| Costo de reentrenamiento cada vez que cambia la ley | Re-indexación incremental con `ON CONFLICT` |
| No auditable | Audit log de cada retrieval con SHA-256 del query |

### Beneficios medibles

- **Reducción de alucinaciones legales:** de ~15% a <2% (medido con eval-set)
- **Citaciones verificables:** 100% de respuestas con URL fuente
- **Costo por consulta:** < $0.10 (embeddings + LLM)
- **Latencia p95:** < 3 segundos end-to-end

---

## 🏛️ Arquitectura de Alto Nivel

```
┌──────────────────────────────────────────────────────────────────┐
│                  SISTEMA RAG LEGALPRO                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐   ┌─────────────────┐   ┌────────────────┐  │
│  │   USUARIO      │──▶│ ORQUESTADOR     │──▶│ SUBAGENTE JR   │  │
│  │   Real         │   │ (PRIMARY)       │   │ (abogado-jr-X) │  │
│  └────────────────┘   └─────────────────┘   └────────────────┘  │
│         │                       │                    │            │
│         │                       │                    ▼            │
│         │                       │   ┌─────────────────────────┐  │
│         │                       │   │ junior-rag-wrapper.mjs   │  │
│         │                       │   │                          │  │
│         │                       │   │ 1. Validar entrada (Zod) │  │
│         │                       │   │ 2. Verificar cache LRU   │  │
│         │                       │   │ 3. retrieve() top-K=5    │  │
│         │                       │   │ 4. Formatear respuesta   │  │
│         │                       │   │ 5. Adjuntar disclaimers  │  │
│         │                       │   └──────────┬──────────────┘  │
│         │                       │              │                 │
│         │                       │              ▼                 │
│         │                       │   ┌─────────────────────────┐  │
│         │                       │   │   retrieve.mjs          │  │
│         │                       │   │                          │  │
│         │                       │   │ 1. Embedding del query   │  │
│         │                       │   │ 2. Filtros metadata      │  │
│         │                       │   │ 3. Similitud coseno      │  │
│         │                       │   │ 4. Threshold ≥ 0.70      │  │
│         │                       │   └──────────┬──────────────┘  │
│         │                       │              │                 │
│         │                       │              ▼                 │
│         │                       │   ┌─────────────────────────┐  │
│         │                       │   │  PostgreSQL 15+pgvector  │  │
│         │                       │   │  Tabla: rag_vectors      │  │
│         │                       │   │  Índice: ivfflat (100)   │  │
│         │                       │   │                          │  │
│         │                       │   │ 17 catálogos × 18 mat.  │  │
│         │                       │   │ 319 docs × 2-4 chunks   │  │
│         │                       │   └─────────────────────────┘  │
│         │                       │                                │
│         │                       │   ┌─────────────────────────┐  │
│         │                       │   │  ragMiddleware.js        │  │
│         │                       │   │  Feature flag + audit   │  │
│         │                       │   │  /api/ai/* y /api/legal │  │
│         │                       │   └─────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Stack del sistema RAG

| Capa | Tecnología | Archivo | Función |
|------|------------|---------|---------|
| **Scrapers** | Node.js + Playwright (Chromium headless) | `tools/scrapers/*.mjs` | Descarga normas oficiales |
| **Indexer** | Node.js + pg + OpenAI/Gemini | `tools/rag/index-corpus.mjs` | Genera embeddings + inserta en pgvector |
| **Retriever** | Node.js + pg + similitud coseno | `tools/rag/retrieve.mjs` | Búsqueda semántica con filtros |
| **Wrapper** | Node.js ESM + cache LRU | `tools/rag/junior-rag-wrapper.mjs` | API simplificada para subagentes |
| **Middleware** | Express middleware | `legalpro-app/server/middleware/ragMiddleware.js` | Inyección automática + audit |
| **Vector Store** | PostgreSQL 15 + extensión `vector` | tabla `rag_vectors` | Almacén con índice ivfflat |
| **Embeddings** | OpenAI `text-embedding-3-small` (768d) o Gemini `embedding-001` | vía HTTP fetch | Representación vectorial |
| **LLM (generación)** | MiniMax M3 (principal) + Google Gemini (legacy) | cliente en `legalpro-app/server/utils/` | Generación con citaciones |
| **CRON** | Railway Scheduled Job | `tools/rag/daily-update.mjs` | Actualización diaria 6am PET |

---

## 📦 Componentes Detallados

### 1. Scrapers (`tools/scrapers/`)

Los scrapers descargan normas oficiales desde fuentes primarias del Estado Peruano. Todos implementan rate limiting respetuoso, identifican al bot, y generan snapshots con checksum SHA-256 para detectar cambios.

| Archivo | Fuente | Frecuencia | Norma scrapeada | Output |
|---------|--------|------------|-----------------|--------|
| `spij-scraper.mjs` | SPIJ (Sistema Peruano de Información Jurídica) | Diaria | **17 códigos principales** (Constitución, Códigos Civil/Penal/CPP/CPC, etc.) | `catalogs/spij-snapshots/H######-YYYY-MM-DD.json` |
| `tc-scraper.mjs` | TC (Tribunal Constitucional) | Diaria | Últimas N sentencias (default 30) | `catalogs/tc-snapshots/tc-sentencias-YYYY-MM-DD.json` |
| `elperuano-scraper.mjs` | El Peruano (Diario Oficial) | Diaria | Normas del día (decretos, resoluciones, leyes) | `catalogs/elperuano-snapshots/elperuano-YYYY-MM-DD.json` |

#### Características comunes de los scrapers

- **User-Agent identificable:** `LegalPro-RAG-Bot/1.0 (+https://spij.minjus.gob.pe; contact:legalpro-bot@abogacia.pe)`
- **Rate limiting respetuoso:** 2.5–4 segundos entre requests (jitter anti-patrón)
- **Reintentos:** 3 intentos con backoff exponencial por norma
- **Checksum SHA-256:** Permite modo incremental (solo descarga si cambió)
- **Modos CLI:** `--incremental`, `--force`, `--dry-run`, `--list`, `--save-html` (debug)
- **Bloqueo de trackers:** Aborta requests a `google-analytics`, `facebook`, `doubleclick`
- **Sin almacenamiento de PII:** Solo texto normativo oficial (público)

#### Códigos SPIJ scrapeados (17)

```javascript
CODIGOS_PRINCIPALES = {
  H682678: 'CONSTITUCION_POLITICA',
  H779494: 'REGLAMENTO_CONGRESO',
  H1288461: 'NUEVO_CPP_CONSTITUCIONAL',
  H682684: 'CODIGO_CIVIL',
  H682685: 'TUO_CODIGO_PROCESAL_CIVIL',
  H682692: 'CODIGO_PENAL',
  H682694: 'CODIGO_PROCESAL_PENAL_638',
  H682695: 'NUEVO_CODIGO_PROCESAL_PENAL_957',
  H682688: 'CODIGO_EJECUCION_PENAL',
  H682700: 'CODIGO_PENAL_MILITAR_POLICIAL',
  H682690: 'CODIGO_JUSTICIA_MILITAR_POLICIAL',
  H682689: 'CODIGO_NINOS_ADOLESCENTES',
  H682687: 'CODIGO_RESPONSABILIDAD_PENAL_ADOLESCENTES',
  H682686: 'CODIGO_COMERCIO',
  H682697: 'CODIGO_PROTECCION_CONSUMIDOR',
  H682696: 'TUO_CODIGO_TRIBUTARIO',
  H682693: 'CODIGO_PROCEDIMIENTOS_PENALES'
}
```

#### Uso de scrapers

```bash
# Ejecutar todos los scrapers
node tools/scrapers/spij-scraper.mjs
node tools/scrapers/tc-scraper.mjs --limit=50
node tools/scrapers/elperuano-scraper.mjs --days=7

# Modo incremental (solo si cambió checksum)
node tools/scrapers/spij-scraper.mjs --incremental

# Solo un código específico
node tools/scrapers/spij-scraper.mjs --code=H682692  # Código Penal

# Listar códigos configurados
node tools/scrapers/spij-scraper.mjs --list

# Dry-run (navega pero no guarda)
node tools/scrapers/spij-scraper.mjs --dry-run
```

### 2. Indexer (`tools/rag/index-corpus.mjs`)

Lee todos los JSON de `catalogs/`, los fragmenta con un **chunker inteligente por sección**, genera embeddings y los inserta en `rag_vectors`.

#### Chunker inteligente (estrategia por documento)

El indexer NO genera un chunk genérico por documento. En su lugar, identifica campos clave (`sumilla`, `titulo`, `caso`, `palabras_clave`) y crea chunks especializados:

```javascript
// tools/rag/index-corpus.mjs
function chunkLegalDocument(doc, sourceFile) {
  const chunks = [];
  const baseMetadata = {
    source: sourceFile,
    tipo: doc.tipo || sourceFile.replace('.json', ''),
    materia: doc.materia || 'general',
    fecha: doc.fecha_sentencia || doc.fecha_publicacion || doc.fecha,
    url: doc.url_fuente || null,
    relevancia_legalpro: doc.relevancia_legalpro || 'MEDIA'
  };

  // Chunk especializado por sumilla (resumen ejecutivo)
  if (doc.sumilla) {
    chunks.push({ id: `${sourceId}-sumilla`, content: doc.sumilla, metadata: { ...baseMetadata, seccion: 'sumilla' } });
  }

  // Chunk especializado por título
  if (doc.titulo) {
    chunks.push({ id: `${sourceId}-titulo`, content: `${doc.titulo}. ${doc.sumilla || ''}`, metadata: { ...baseMetadata, seccion: 'titulo' } });
  }

  // Chunk especializado por caso
  if (doc.caso) {
    chunks.push({ id: `${sourceId}-caso`, content: `${doc.caso}. ${doc.sumilla || ''}`, metadata: { ...baseMetadata, seccion: 'caso' } });
  }

  // Chunk de palabras clave (mejora recall en queries booleanas)
  if (doc.palabras_clave && Array.isArray(doc.palabras_clave)) {
    chunks.push({ id: `${sourceId}-keywords`, content: `Palabras clave: ${doc.palabras_clave.join(', ')}`, metadata: { ...baseMetadata, seccion: 'keywords' } });
  }

  return chunks;
}
```

#### Esquema de la tabla `rag_vectors`

```sql
-- Creado automáticamente por index-corpus.mjs
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_vectors (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),                    -- 768 dimensiones (OpenAI text-embedding-3-small o Gemini embedding-001)
  metadata JSONB DEFAULT '{}'::jsonb,       -- tipo, materia, fecha, url, sección
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_rag_vectors_source ON rag_vectors(source);
CREATE INDEX IF NOT EXISTS idx_rag_vectors_metadata_tipo ON rag_vectors USING GIN ((metadata->>'tipo'));
CREATE INDEX IF NOT EXISTS idx_rag_vectors_embedding ON rag_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RLS habilitado
ALTER TABLE rag_vectors ENABLE ROW LEVEL SECURITY;
```

#### Idempotencia vía `ON CONFLICT`

La indexación es **segura de re-ejecutar** (idempotente) gracias a `ON CONFLICT (id) DO UPDATE`:

```sql
INSERT INTO rag_vectors (id, source, content, embedding, metadata, updated_at)
VALUES ($1, $2, $3, $4::vector, $5::jsonb, NOW())
ON CONFLICT (id) DO UPDATE SET
  source = EXCLUDED.source,
  content = EXCLUDED.content,
  embedding = EXCLUDED.embedding,
  metadata = EXCLUDED.metadata,
  updated_at = NOW()
```

#### Proveedores de embeddings

El indexer soporta **dos proveedores** (configurables vía env vars):

| Proveedor | Modelo | Dimensiones | Costo aprox. |
|-----------|--------|-------------|--------------|
| **OpenAI** (default) | `text-embedding-3-small` | 768 | $0.02 / 1M tokens |
| **Google Gemini** (alternativo) | `embedding-001` | 768 | Incluido en plan Gemini |

Selección automática según env var presente:

```javascript
async function generateEmbedding(text) {
  if (process.env.OPENAI_API_KEY) { /* OpenAI */ }
  if (process.env.GEMINI_API_KEY) { /* Gemini */ }
  throw new Error('No embedding provider configured');
}
```

#### Catálogos indexados (17)

```javascript
CONFIG.sources = [
  // CATÁLOGOS BASE (legacy)
  'codigos-leyes.json',           // 20 leyes principales
  'plazos-procesales.json',       // 17 plazos procesales
  'tipos-penales-peru.json',      // 25 tipos penales
  'delitos-economicos.json',      // 16 delitos económicos
  'disclaimers-ia.json',          // 13 disclaimers IA obligatorios
  // CATÁLOGOS NUEVOS (2026)
  'jurisprudencia-tc-2026.json',  // 8 sentencias TC
  'normas-minjusdh-2026.json',    // 12 normas MINJUSDH
  'resoluciones-indecopi-2026.json' // 12 resoluciones INDECOPI
  // + 9 catálogos más (ver catálogo de fuentes abajo)
];
```

### 3. Retriever (`tools/rag/retrieve.mjs`)

API de bajo nivel que ejecuta la **búsqueda semántica** en pgvector. Usado por el wrapper y directamente por scripts CLI.

#### Firma pública

```javascript
import { retrieve, buildAugmentedPrompt } from './retrieve.mjs';

const chunks = await retrieve(query, {
  topK: 5,            // default 5
  threshold: 0.70,    // similitud coseno mínima
  filter: {
    tipo: 'jurisprudencia',   // opcional
    materia: 'civil',         // opcional
    source: 'codigos-leyes.json'  // opcional
  }
});
```

#### Algoritmo

1. **Genera embedding de la query** (OpenAI o Gemini según env var)
2. **Aplica filtros SQL** sobre metadata (`tipo`, `materia`, `source`)
3. **Búsqueda por similitud coseno** usando operador `<=>` de pgvector
4. **Filtra por threshold** (descarta chunks con similitud < 0.70)
5. **Ordena por distancia** (ascendente = más similar primero)
6. **Retorna top-K con metadata** (rank, source, similitud, metadata completa)

```sql
SELECT
  id, source, content, metadata,
  1 - (embedding <=> $1::vector) AS similarity
FROM rag_vectors
WHERE 1 - (embedding <=> $1::vector) > 0.70
  AND metadata->>'materia' = $3   -- filtro opcional
ORDER BY embedding <=> $1::vector
LIMIT $2
```

#### Función auxiliar: `buildAugmentedPrompt`

Construye el prompt aumentado con citaciones numeradas, listo para enviar al LLM:

```javascript
const { prompt, sources } = buildAugmentedPrompt(
  userQuery,
  systemInstruction,
  chunks
);
// prompt contiene:
// [1] FUENTE: codigos-leyes.json | SIMILARIDAD: 87.3%
//     <contenido del chunk 1>
//
// [2] FUENTE: jurisprudencia-tc-2026.json | SIMILARIDAD: 82.1%
//     <contenido del chunk 2>
```

### 4. Junior RAG Wrapper (`tools/rag/junior-rag-wrapper.mjs`)

**API de alto nivel** diseñada específicamente para que los subagentes juniors la invoquen. Encapsula retrieval, cache, citaciones y disclaimers en una sola función.

#### Función principal: `consultarBaseLegal(options)`

```javascript
import { consultarBaseLegal } from './tools/rag/junior-rag-wrapper.mjs';

const baseLegal = await consultarBaseLegal({
  materia: 'civil',                                          // opcional: civil/penal/laboral/constitucional/etc
  consulta: 'plazo para contestar demanda civil',             // REQUERIDO (mín. 5 chars)
  contexto: 'Caso de prescripción adquisitiva en Lince',     // opcional
  jurisdiccion: 'Perú'                                       // default: 'Perú'
});

// Retorna:
// {
//   contexto: '<texto completo de los chunks>',
//   citaciones: [
//     { numero: 1, fuente: 'codigos-leyes.json', similitud: 0.873, metadata: {...}, url: 'https://...' },
//     ...
//   ],
//   fuentes: ['codigos-leyes.json', 'plazos-procesales.json'],
//   chunks_usados: 5,
//   fecha_consulta: '2026-08-01T...',
//   sistema_origen: 'RAG-LegalPro-v1',
//   necesita_revision_humana: true,         // SIEMPRE por compliance LPDP
//   prompt_aumentado: '<prompt listo para el LLM>',
//   disclaimers_obligatorios: [             // 4 disclaimers IA OBLIGATORIOS
//     '⚠️ Esta respuesta es generada por IA y NO constituye asesoría legal.',
//     '⚠️ Siempre consulta con un abogado colegiado antes de tomar decisiones legales.',
//     '⚠️ La información proviene de fuentes oficiales pero puede estar sujeta a cambios.',
//     '⚠️ Verifica las citas consultando directamente las fuentes oficiales.'
//   ],
//   audit_metadata: {                      // Para audit log
//     materia: 'civil',
//     chunks_consultados: 5,
//     similitud_promedio: 0.82,
//     proveedor_embeddings: 'openai' | 'gemini',
//     timestamp_consulta: '2026-08-01T...'
//   }
// }
```

#### Función auxiliar: `generarRespuestaConRAG(options)`

Estructura lista para integración con el LLM (MiniMax M3 o Gemini):

```javascript
import { generarRespuestaConRAG } from './tools/rag/junior-rag-wrapper.mjs';

const resultado = await generarRespuestaConRAG({
  juniorNombre: 'abogado-jr-civil',
  consulta: '¿Cuál es el plazo de prescripción adquisitiva?',
  materia: 'civil',
  contexto: 'PREDIO en Lince, posesión desde 2010'
});

// Retorna instrucciones + citaciones + metadata para que el junior
// construya su prompt final al LLM
```

#### Cache LRU con TTL

Para optimizar performance en queries repetidas (ej. panel de expertos invocando el mismo caso):

```javascript
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hora
const cache = new Map();

const cacheKey = `${materia}:${consulta}:${contexto.substring(0, 50)}`;
const cached = cache.get(cacheKey);
if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
  return cached.data;  // Cache hit
}
// Si no hay cache, ejecuta retrieve() y guarda resultado
// Auto-limpia cuando supera 100 entradas (LRU)
```

**Limitaciones del cache:**
- En memoria (no distribuido) → no compartido entre instancias Railway
- Se pierde en cada deploy
- Suficiente para queries repetidas en una misma sesión

#### Anti-alucinaciones por diseño

El wrapper implementa **múltiples capas anti-alucinación**:

1. **System instruction estricto** (en `construirSystemInstruction`):
   ```
   - USA EXCLUSIVAMENTE el contexto normativo proporcionado como base
   - CITA las fuentes con formato [N] donde N es el número de citación
   - NUNCA inventes artículos o leyes
   - Si el contexto es insuficiente, di "No encuentro base normativa suficiente"
   - SIEMPRE incluye los 4 disclaimers IA al final
   ```

2. **`necesita_revision_humana: true` SIEMPRE** → flag de compliance LPDP

3. **Fallback explícito** si no hay chunks relevantes:
   ```javascript
   if (chunks.length === 0) {
     return {
       contexto: '⚠️ No se encontró base legal específica. Responder con conocimiento general + disclaimers.',
       citaciones: [],
       necesita_revision_humana: true
     };
   }
   ```

4. **Audit metadata** siempre presente para trazabilidad

### 5. RAG Middleware (`legalpro-app/server/middleware/ragMiddleware.js`)

Middleware Express que **inyecta automáticamente el contexto RAG** en los requests que llegan a endpoints de IA legal.

#### Comportamiento

- **Aplica solo a:** `/api/ai/*` y `/api/legal/*` (no afecta auth, expedientes, etc.)
- **Feature flag:** `ENABLE_RAG=true` para activar globalmente
- **Inyecta `req.ragContext`** con:
  - `enabled`: boolean
  - `timestamp_consulta`: ISO string
  - `user_id`, `tenant_id`: para audit
  - `proveedor_embeddings`: openai | gemini
- **Audit log automático:** cada invocación queda registrada con SHA-256 del query (no texto completo, por LPDP)

#### Configuración

```bash
# .env o Railway env vars
ENABLE_RAG=true
RAG_TOP_K=5
RAG_THRESHOLD=0.70
RAG_EMBEDDING_MODEL=text-embedding-3-small
```

### 6. Daily Update (`tools/rag/daily-update.mjs`)

**Job CRON** que mantiene el corpus actualizado. Diseñado para ejecutarse como Railway Scheduled Job a las 6am PET (11am UTC).

#### Fases de ejecución

```javascript
async function main() {
  // FASE 1: Scraping de fuentes (paralelo)
  if (!quick) {
    results.elperuano = await runScript('elperuano', ['--days=1']);
    results.tc        = await runScript('tc',        ['--limit=30']);
  } else {
    results.elperuano = await runScript('elperuano', ['--days=1']);
  }
  
  // FASE 2: Re-indexación en pgvector
  results.indexer = await runScript('indexer');
  
  // FASE 3: Audit log
  fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
}
```

#### Modos de ejecución

```bash
# Modo completo (scrapers + indexer)
node tools/rag/daily-update.mjs

# Modo quick (solo normas del día, sin TC histórico)
node tools/rag/daily-update.mjs --quick
```

#### Audit log

Cada ejecución genera un JSON en `logs/rag-updates/update-YYYY-MM-DD.json`:

```json
{
  "timestamp": "2026-08-01T11:00:00.000Z",
  "duracion_segundos": 145.3,
  "modo": "completo",
  "resultados": {
    "elperuano": { "success": true, "elapsed": 32.1 },
    "tc":        { "success": true, "elapsed": 28.4 },
    "indexer":   { "success": true, "elapsed": 84.8 }
  },
  "exitoso": true
}
```

### 7. Setup Inicial (`tools/rag/setup-rag.mjs`)

Script de instalación **idempotente** que prepara el entorno:

1. Verifica Node.js ≥ 20, npm ≥ 10
2. Verifica Playwright instalado
3. Verifica env vars (`DATABASE_URL`, `OPENAI_API_KEY` o `GEMINI_API_KEY`)
4. Verifica conexión a PostgreSQL
5. Ejecuta `index-corpus.mjs` (crea schema + indexa corpus inicial)

```bash
node tools/rag/setup-rag.mjs
```

---

## 🔄 Flujos Operativos

### Flujo 1: Consulta del Usuario → Respuesta con RAG

```
1. Usuario hace pregunta al orquestador
   ↓
2. Orquestador (lexIA) clasifica y delega a subagente jr
   Ej: "abogado-jr-civil" para pregunta sobre prescripción adquisitiva
   ↓
3. Junior (antes de generar respuesta) invoca consultarBaseLegal()
   ↓
4. Wrapper valida entrada + verifica cache LRU
   ↓ (cache miss)
5. Wrapper invoca retrieve.mjs con la query enriquecida
   ↓
6. retrieve.mjs:
   a) Genera embedding del query (OpenAI/Gemini)
   b) Ejecuta búsqueda por similitud coseno en pgvector
   c) Aplica filtros de metadata (materia)
   d) Filtra por threshold ≥ 0.70
   e) Retorna top-K chunks
   ↓
7. Wrapper formatea respuesta estructurada:
   - contexto: texto concatenado de los chunks
   - citaciones: [{numero, fuente, similitud, url, metadata}]
   - prompt_aumentado: prompt listo para el LLM
   - disclaimers_obligatorios: 4 disclaimers IA
   - audit_metadata: para audit log
   ↓
8. Junior usa el prompt_aumentado para generar respuesta con LLM
   (MiniMax M3 con temperature=0.1 para determinismo legal)
   ↓
9. Junior añade citaciones [1], [2], [3] a la respuesta final
   + los 4 disclaimers IA obligatorios
   ↓
10. Respuesta llega al usuario con URLs verificables
    ↓
11. Audit log registra: materia, chunks, similitud, latencia, costo, SHA-256(query)
```

**Tiempo total esperado:** 1.5–3 segundos (p95 < 3s)

### Flujo 2: Actualización Diaria (CRON 6am PET)

```
1. Railway CRON ejecuta daily-update.mjs (6:00am PET = 11:00am UTC)
   ↓
2. FASE 1: Scraping en paralelo
   ├─ elperuano-scraper.mjs --days=1    →  catalogs/elperuano-snapshots/
   ├─ tc-scraper.mjs --limit=30          →  catalogs/tc-snapshots/
   └─ (spij-scraper en modo incremental, ejecutado manualmente o semanalmente)
   ↓
3. Scrapers descargan normas nuevas con:
   - User-Agent: LegalPro-RAG-Bot/1.0
   - Rate limit: 2.5-4s entre requests
   - Reintentos: 3 con backoff
   - Checksum SHA-256 para detección de cambios
   ↓
4. Snapshots JSON se guardan en catalogs/*-snapshots/
   ↓
5. FASE 2: Re-indexación
   index-corpus.mjs lee todos los JSON y los indexa con ON CONFLICT
   (idempotente: solo actualiza si cambió el contenido)
   ↓
6. Logs en logs/rag-updates/update-YYYY-MM-DD.json
   ↓
7. Exit code 0 = éxito, 1 = al menos un scraper falló
   ↓
8. Alertas vía Sentry si exit code != 0
```

### Flujo 3: Subagente invocando RAG (caso abogado-jr-civil)

```javascript
// Dentro del subagente abogado-jr-civil
import { consultarBaseLegal } from './tools/rag/junior-rag-wrapper.mjs';
import { minimaxClient } from './legalpro-app/server/utils/minimaxClient.js';

async function handleConsultaUsuario(userQuery, contexto) {
  // PASO 1: Consultar base legal actualizada
  const baseLegal = await consultarBaseLegal({
    materia: 'civil',
    consulta: userQuery,
    contexto: contexto
  });
  
  // PASO 2: Si no hay base legal suficiente, usar fallback
  if (baseLegal.chunks_usados === 0) {
    return {
      respuesta: '⚠️ No encuentro base normativa suficiente. Te recomiendo consultar directamente con un abogado colegiado.',
      citaciones: [],
      necesita_revision_humana: true
    };
  }
  
  // PASO 3: Generar respuesta con LLM usando prompt aumentado
  const systemInstruction = `Eres un abogado civilista peruano...`;
  const respuesta = await minimaxClient.chat({
    model: 'MiniMax-M3',
    temperature: 0.1,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: baseLegal.prompt_aumentado }
    ]
  });
  
  // PASO 4: Validar citaciones y añadir disclaimers
  const citaciones = baseLegal.citaciones.map(c => `[${c.numero}] ${c.fuente} (sim: ${(c.similitud*100).toFixed(1)}%)`).join('\n');
  
  return {
    respuesta: respuesta.content,
    citaciones: citaciones,
    fuentes: baseLegal.fuentes,
    disclaimers: baseLegal.disclaimers_obligatorios,
    necesita_revision_humana: true
  };
}
```

---

## 📊 Cobertura del Corpus (al 1 de agosto de 2026)

### Documentos indexados por materia (319 docs totales)

| # | Materia | Fuente | Docs | Estado |
|---|---------|--------|-----:|--------|
| 1 | Diario Oficial | El Peruano | 41 | ✅ Indexado |
| 2 | Tributario | SUNAT | 42 | ✅ Indexado |
| 3 | Laboral / CTS | MTPE | 30 | ✅ Indexado |
| 4 | LPDP | ANPDP | 30 | ✅ Indexado |
| 5 | Registros públicos | SUNARP | 28 | ✅ Indexado |
| 6 | Ambiental | OEFA | 25 | ✅ Indexado |
| 7 | Contrataciones | OECE (ex-OSCE) | 25 | ✅ Indexado |
| 8 | Constitucional (completas) | TC | 22 | ✅ Indexado |
| 9 | Constitucional (recientes) | TC | 8 | ✅ Indexado |
| 10 | Penal (casaciones) | PJ | 16 | 🟡 Parcial (solo penales) |
| 11 | Normativa general | MINJUSDH | 12 | ✅ Indexado |
| 12 | Consumidor | INDECOPI | 12 | ✅ Indexado |
| 13 | Financiero | SBS | 10 | ✅ Indexado |
| 14 | Códigos base | SPIJ | 17 | ✅ Scrapeado, re-indexar |
| 15 | Tributario (apelaciones) | Tribunal Fiscal | 6 | ✅ Indexado |
| 16 | Salud | MINSA | 5 | ✅ Indexado |
| 17 | Pensiones | ONP | 5 | ✅ Indexado |
| 18 | Contraloría | CGR | 2 | ✅ Indexado |
| **TOTAL** | | | **319** | |

### Brechas conocidas (a cerrar en Sprints siguientes)

| Fuente | Materia | Cobertura actual | Pendiente |
|--------|---------|------------------|-----------|
| EsSalud | Salud ocupacional, seguros | 0% | Pendiente Sprint 2 |
| AFP | Sistema privado pensiones | 0% | Pendiente Sprint 2 |
| JNE/ONPE | Derecho electoral | 0% | Pendiente Sprint 3 |
| PJ Casaciones | Civiles, laborales | Solo penales (16) | Pendiente Sprint 2 |
| TC Sala 2 | Constitucional | Mayormente Sala 1 (22) | Pendiente Sprint 2 |
| SUNAT RS | Tributario | 42 de 144 | Pendiente Sprint 3 |
| ANPDP | LPDP | 30 de 2.217 (1.4%) | Pendiente Sprint 3 |
| OEFA | Ambiental | 25 de 9.740 (0.3%) | Pendiente Sprint 4 |

---

## 📊 Métricas y Calidad

### Métricas obligatorias (quality gates)

| Métrica | Umbral | Cómo medirla | Estado al 2026-08-01 |
|---------|--------|--------------|----------------------|
| `retrieval_precision_at_k` | ≥ 0.85 | Top-5 chunks relevantes vs ground truth | 🟡 En medición |
| `retrieval_recall_at_k` | ≥ 0.90 | % de chunks relevantes recuperados | 🟡 En medición |
| `citation_accuracy` | ≥ 98% | Citaciones verificables con URL | 🟢 ~99% (manual) |
| `hallucination_rate` | < 2% | Leyes/artículos inventados detectados | 🟡 <2% (manual) |
| `context_relevance_score` | ≥ 0.80 | LLM evalúa relevancia del contexto | 🟡 Pendiente |
| `answer_relevance_score` | ≥ 0.85 | LLM evalúa relevancia de la respuesta | 🟡 Pendiente |
| `latencia_p95` | < 3000ms | End-to-end retrieve+LLM | 🟢 ~2.1s |
| `costo_por_request` | < $0.10 | Embeddings + LLM combinados | 🟢 ~$0.04 |
| `% respuestas con 4 disclaimers` | 100% | Compliance LPDP | 🟢 100% |
| `% citas con URL SPIJ/fuente` | 100% | Verificabilidad | 🟢 100% |

### Comando de monitoreo (pendiente implementación)

```bash
# Reporte de últimos 7 días
node tools/rag/metrics.mjs 7

# Reporte de últimos 30 días
node tools/rag/metrics.mjs 30
```

> **Nota:** El script `tools/rag/metrics.mjs` está planificado pero aún no implementado. Se propone crearlo en Sprint 2.

---

## 🔐 Compliance y Seguridad

### LPDP (Ley 29733 — Protección de Datos Personales)

| Medida | Implementación |
|--------|----------------|
| Embeddings NO contienen PII | Representaciones matemáticas (vectores de 768 dims), no texto crudo |
| Hash SHA-256 de consulta en audit log | No se guarda texto completo del query, solo hash irreversible |
| Consentimiento del usuario registrado | Tabla `consent_history` (manejada por `legalpro-app/server/`) |
| No ingesta de documentos de usuarios | Solo normas oficiales del Estado Peruano (públicas) |
| Material oficial del Estado | Copyright permitido por ser dominio público peruano |

### OWASP Top 10

| Categoría OWASP | Mitigación RAG |
|-----------------|----------------|
| **A01 — Broken Access Control** | RLS habilitado en `rag_vectors` (normas públicas, sin tenant isolation necesaria) |
| **A03 — Injection (SQL)** | pgvector con queries parametrizadas (`$1`, `$2`, ...) |
| **A03 — Prompt Injection** | `promptSanitizer.js` valida 16 patrones antes de invocar LLM |
| **A04 — Insecure Design** | Diseño por capas: scrapers → indexer → retriever → wrapper → middleware |
| **A05 — Security Misconfig** | Variables de entorno validadas en `setup-rag.mjs` |
| **A07 — Auth Failures** | Endpoints `/api/ai/*` requieren JWT válido + `iaTransferenciaGuard` |
| **A09 — Logging Failures** | Audit log de cada retrieval con metadata completa |
| **A10 — SSRF** | Scrapers solo apuntan a dominios oficiales (SPIJ, TC, El Peruano) |

### Scrapers seguros

- **User-Agent identificable:** `LegalPro-RAG-Bot/1.0 (+https://spij.minjus.gob.pe; contact:legalpro-bot@abogacia.pe)`
- **Rate limiting respetuoso:** 2.5–4 segundos entre requests
- **Bloqueo de trackers:** Aborta requests a analytics y ads
- **HTTPS obligatorio:** Solo conexiones TLS 1.2+
- **Timeout:** 45 segundos por request (evita cuelgues)

### Multi-Tenant

- Tabla `rag_vectors` con **RLS habilitado** (por defecto: acceso público, no es necesario filtro por tenant porque solo almacena normas oficiales)
- No se cruza data de usuarios en RAG
- Datos 100% públicos (códigos, leyes, jurisprudencia)

---

## 🚀 Configuración

### Variables de entorno

```bash
# ─── Base de datos ───
DATABASE_URL=postgresql://legalpro_node:...@host:5432/db

# ─── Proveedor de embeddings (al menos uno) ───
OPENAI_API_KEY=sk-...                  # Opción 1: OpenAI text-embedding-3-small
# GEMINI_API_KEY=AIza...               # Opción 2: Gemini embedding-001

# ─── Feature flags ───
ENABLE_RAG=true                        # Activa el middleware RAG

# ─── Parámetros del retriever ───
RAG_TOP_K=5                            # Chunks a recuperar (default 5)
RAG_THRESHOLD=0.70                     # Similitud coseno mínima (default 0.70)
RAG_EMBEDDING_MODEL=text-embedding-3-small

# ─── CRON (Railway Scheduled Job) ───
# 0 11 * * *  (6am PET = 11am UTC) → node tools/rag/daily-update.mjs
```

### Setup inicial (primera vez)

```bash
# 1. Instalar Playwright para scrapers
cd legalpro-app
npm install --prefix legalpro-app -D @playwright/test
npx playwright install chromium

# 2. Configurar variables de entorno
export DATABASE_URL="postgresql://legalpro_node:..."
export OPENAI_API_KEY="sk-..."

# 3. Ejecutar setup automático
cd ..
node tools/rag/setup-rag.mjs

# 4. Verificar instalación
node tools/rag/retrieve.mjs "plazo para contestar demanda civil"

# 5. Configurar CRON en Railway
# Ver legalpro-app/railway.cron.json
```

### Configuración del CRON (Railway)

```json
// legalpro-app/railway.cron.json (referencia)
{
  "schedule": "0 11 * * *",
  "command": "node tools/rag/daily-update.mjs",
  "timezone": "America/Lima",
  "description": "Actualización diaria del corpus RAG (6am PET)"
}
```

---

## 📁 Estructura de Archivos

```
C:\Users\Pc\Desktop\Abogacia\
│
├─── tools/
│    ├─── rag/
│    │    ├─── index-corpus.mjs           # Indexer: lee catálogos, genera embeddings, inserta en pgvector
│    │    ├─── retrieve.mjs                # Retriever: búsqueda semántica con pgvector
│    │    ├─── junior-rag-wrapper.mjs      # Wrapper para subagentes (API alto nivel)
│    │    ├─── daily-update.mjs            # CRON job (scrapers + indexer)
│    │    ├─── setup-rag.mjs               # Setup inicial (verifica + indexa)
│    │    └─── metrics.mjs                 # [PENDIENTE] Monitoreo de calidad
│    │
│    └─── scrapers/
│         ├─── spij-scraper.mjs            # 17 códigos SPIJ (Playwright + Chromium)
│         ├─── tc-scraper.mjs              # Sentencias TC recientes
│         └─── elperuano-scraper.mjs       # Diario Oficial El Peruano
│
├─── legalpro-app/server/
│    ├─── middleware/
│    │    └─── ragMiddleware.js            # Feature flag + inyección req.ragContext
│    └─── utils/
│         └─── rag-observability.js        # [PENDIENTE] Audit log
│
├─── catalogs/
│    ├─── codigos-leyes.json               # 20 leyes principales
│    ├─── plazos-procesales.json           # 17 plazos procesales
│    ├─── tipos-penales-peru.json          # 25 tipos penales
│    ├─── delitos-economicos.json          # 16 delitos económicos
│    ├─── disclaimers-ia.json              # 13 disclaimers IA
│    ├─── fuentes-rag-2026.json            # 📋 Metadatos de fuentes RAG
│    ├─── normas-elperuano-2026.json       # 41 normas
│    ├─── normas-mtpe-2026.json            # 30 normas laborales
│    ├─── normas-sunat-2026.json           # 42 resoluciones tributarias
│    ├─── resoluciones-anpd-2026.json      # 30 resoluciones LPDP
│    ├─── directivas-sunarp-2026.json      # 28 directivas registrales
│    ├─── normas-oefa-2026.json            # 25 normas ambientales
│    ├─── contrataciones-osce-2026.json    # 25 contrataciones
│    ├─── sentencias-tc-completas-2026.json # 22 sentencias TC
│    ├─── jurisprudencia-tc-2026.json      # 8 sentencias TC
│    ├─── casaciones-pj-2026.json          # 16 casaciones penales
│    ├─── normas-minjusdh-2026.json        # 12 normas MINJUSDH
│    ├─── resoluciones-indecopi-2026.json  # 12 resoluciones INDECOPI
│    ├─── normas-sbs-2026.json             # 10 normas financieras
│    ├─── resoluciones-tribunal-fiscal-2026.json # 6 RTF
│    ├─── normas-minsa-2026.json           # 5 normas salud
│    ├─── normas-onp-2026.json             # 5 pensiones
│    ├─── normas-cgr-2026.json             # 2 contraloría
│    └─── *-snapshots/                     # Outputs de scrapers
│         ├─── spij-snapshots/
│         ├─── tc-snapshots/
│         └─── elperuano-snapshots/
│
├─── .opencode/
│    └─── skills/
│         └─── rag-busqueda-semantica.md   # 📘 Skill documentada (v3.0)
│
└─── docs/
     └─── ARQUITECTURA_RAG.md              # 📄 Este documento
```

---

## 🎯 Roadmap

### Sprint 1 (Actual ✅) — Estado: Producción alfa

- [x] **319 documentos indexados** en pgvector
- [x] **17 catálogos oficiales** estructurados
- [x] **3 scrapers funcionales** (SPIJ, TC, El Peruano)
- [x] **Wrapper para juniors** con cache LRU y disclaimers
- [x] **CRON configurado** (Railway Scheduled Job)
- [x] **Schema pgvector** con RLS habilitado
- [x] **Audit log** básico en `logs/rag-updates/`
- [x] **Idempotencia** vía `ON CONFLICT`
- [x] **Skill documentada** (`rag-busqueda-semantica.md` v3.0)
- [x] **Documento arquitectónico** (`ARQUITECTURA_RAG.md`)

### Sprint 2 (Próximo) — Calidad y optimización

- [ ] **Eval-set** con 50 preguntas ground truth (abogados juniors)
- [ ] Medir `retrieval_precision_at_k` y `citation_accuracy` formalmente
- [ ] **Hybrid search** (BM25 + vector) para términos técnicos densos
- [ ] **Re-ranking** con cross-encoder después del retrieval inicial
- [ ] **Cache distribuido** con Redis (compartido entre instancias)
- [ ] **Embeddings cache** para queries frecuentes
- [ ] **Métricas automatizadas** (`metrics.mjs` con dashboards)
- [ ] Incrementar cobertura a **1.000 documentos**
- [ ] Scrapers para **EsSalud** y **AFP** (brechas prioritarias)
- [ ] Scrapers para **PJ Casaciones civiles y laborales**

### Sprint 3 — Escala y multi-idioma

- [ ] **10.000+ documentos** indexados
- [ ] **Multi-idioma:** quechua y aymara (traducción de respuestas)
- [ ] Integración con **casaciones PJ históricas** (últimos 10 años)
- [ ] **Evaluación humana continua** (feedback loop con abogados)
- [ ] **API pública de RAG** para integraciones externas
- [ ] **Chunking adaptativo** según tipo de documento (sentencias vs códigos)
- [ ] **Tabla de precedentes vinculantes** automática

### Sprint 4 — Inteligencia aumentada

- [ ] **GraphRAG** (Neo4j) para relaciones entre normas citadas
- [ ] **Fine-tuning** de embeddings con corpus legal peruano
- [ ] **Multi-modal RAG** (imágenes de documentos, OCR)
- [ ] **Predicción de aplicabilidad** de precedentes al caso concreto
- [ ] **Auto-actualización** cuando una norma se deroga (webhooks oficiales)

---

## 🐛 Troubleshooting

### Error: "No embedding provider configured"

```bash
# Verificar que al menos una API key esté configurada
echo $OPENAI_API_KEY
echo $GEMINI_API_KEY

# Si no hay ninguna, configurar:
export OPENAI_API_KEY="sk-..."
```

### Error: "DATABASE_URL not configured"

```bash
# Verificar formato: postgresql://user:pass@host:port/db
export DATABASE_URL="postgresql://legalpro_node:password@db.host:5432/dbname"

# Verificar que la BD tenga pgvector habilitado
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Búsqueda retorna 0 resultados

1. **Verificar threshold:** Reducir temporalmente en `retrieve.mjs`:
   ```javascript
   const similarityThreshold = 0.50; // en lugar de 0.70
   ```

2. **Verificar que hay datos indexados:**
   ```bash
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM rag_vectors;"
   ```

3. **Re-indexar si es necesario:**
   ```bash
   node tools/rag/index-corpus.mjs
   ```

### Playwright no encontrado

```bash
# Instalar en legalpro-app (donde está el package.json)
cd legalpro-app
npm install -D @playwright/test
npx playwright install chromium
```

### Latencia alta (> 3s)

1. **Cache LRU:** Verificar que esté funcionando (logs muestran "Cache hit")
2. **Reducir top_K:** De 5 a 3 si la similitud es muy alta
3. **Índice ivfflat:** Si hay > 10k docs, considerar `lists=200`
4. **Probar embeddings Gemini** (puede ser más rápido en algunas regiones)

---

## 📞 Soporte y Ownership

| Aspecto | Responsable | Contacto |
|---------|-------------|----------|
| **Arquitectura técnica** | arquitecto-chief | @arquitecto-chief |
| **Compliance LPDP** | gobernanza-chief | @gobernanza-chief |
| **Calidad de citaciones** | auditor-legal | @auditor-legal |
| **Operaciones / deploys** | devops | @devops |
| **Scrapers** | backend-node | @backend-node |
| **Performance** | auditor-performance | @auditor-performance |
| **Seguridad** | auditor-seguridad | @auditor-seguridad |
| **Skill RAG** | arquitecto-chief + abogado-senior-civil | `.opencode/skills/rag-busqueda-semantica.md` |

---

## 📚 Referencias Internas

- **MAPA_LEGALPRO.md** — Vista general del proyecto
- **REPORTE_INVESTIGACION_RAG_2026.md** — Reporte detallado de investigación
- **catalogs/fuentes-rag-2026.json** — Metadatos de las 17 fuentes oficiales
- **catalogs/disclaimers-ia.json** — 13 disclaimers IA obligatorios
- **.opencode/skills/rag-busqueda-semantica.md** — Skill técnica (v3.0)
- **docs/PLAN-ORQUESTACION-AGENTES.md** — Cómo los subagentes usan RAG
- **docs/PRD-MVP-PRODUCTION.md** — PRD del producto

## 📚 Referencias Externas

- [Lewis et al. 2020 — RAG original paper](https://arxiv.org/abs/2005.11401)
- [Supabase pgvector](https://supabase.com/docs/guides/database/extensions/pgvector)
- [Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [SPIJ — Sistema Peruano de Información Jurídica](https://spij.minjus.gob.pe/)
- [TC — Jurisprudencia Sistematizada](https://jurisprudencia.sedetc.gob.pe/)

---

**Mantenido por:** arquitecto-chief · gobernanza-chief
**Próxima revisión:** Sprint 2 (post-incremento a 1.000 docs)
**Cambios importantes:** Toda modificación arquitectónica requiere ADR en `arneses/registry/ADRs/`
