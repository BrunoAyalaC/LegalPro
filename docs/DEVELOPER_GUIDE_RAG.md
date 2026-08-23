# Guía de Desarrollador — Sistema RAG de LegalPro

> **Audiencia:** Ingenieros y SRE que mantienen o extienden el sistema RAG de LegalPro.
> **Stack:** Node.js 20 (ESM), PostgreSQL 15 + `pgvector`, OpenAI / Google Gemini APIs, React 19.
> **Fecha de la guía:** 1 de agosto de 2026.
> **Documentos relacionados:** `docs/ARQUITECTURA_RAG.md`, `docs/MONITORING_RAG.md`, `docs/RAG_TROUBLESHOOTING.md`, `docs/USER_GUIDE_RAG.md`, `.opencode/skills/rag-busqueda-semantica.md`.

---

## 1. Arquitectura en 30 segundos

```mermaid
flowchart LR
  subgraph Cliente
    UI[React 19<br/>/analista · /buscador · /redactor · /predictor · /chat-ia]
  end

  subgraph Backend_Node["Node 20 (legalpro-app/server)"]
    MW["ragMiddleware.js<br/>ENABLE_RAG flag<br/>/api/ai/* · /api/legal/*"]
    WRAP["junior-rag-wrapper.mjs<br/>consultarBaseLegal()<br/>4 disclaimers IA"]
    CHK["junior-rag-wrapper.mjs<br/>hybridScore() 70/30"]
    CACHE["redis-cache.mjs<br/>+ Map memoria fallback"]
    OBS["rag-observability.js<br/>hashConsulta() SHA-256"]
  end

  subgraph Backend_Net["Backend .NET 8"]
    ROUTES["routes/ai.js<br/>withRagContext()<br/>POST /api/ai/consulta"]
    JURIS["/api/jurisprudencia/buscar<br/>/api/redactor/generar<br/>/api/predictor/predecir"]
  end

  subgraph RAG_Core["tools/rag/* (Node ESM)"]
    RETRIEVE["retrieve.mjs<br/>embedding + similitud coseno"]
    INDEX["index-corpus.mjs<br/>chunker inteligente"]
    CRON["daily-update.mjs<br/>06:00 PET (Railway)"]
  end

  subgraph Datos
    PG[("PostgreSQL 15 + pgvector<br/>rag_vectors (RLS ON)<br/>rag_audit_log")]
    REDIS[("Redis opcional<br/>rag:cache:&lt;hash&gt;<br/>TTL 3600s")]
    OPENAI[("OpenAI text-embedding-3-small<br/>o Gemini embedding-001")]
  end

  UI -- HTTPS --> ROUTES
  UI -- HTTPS --> JURIS
  ROUTES -- populate req.ragContext --> MW
  MW --> WRAP
  WRAP --> CHK
  WRAP --> CACHE
  WRAP --> RETRIEVE
  WRAP --> OBS
  RETRIEVE --> PG
  RETRIEVE --> OPENAI
  CACHE --> REDIS
  INDEX --> PG
  INDEX --> OPENAI
  CRON --> INDEX
```

**Reglas duras del flujo:**

- El middleware es **fail-open**: si RAG falla, `req.ragContext = null` y la respuesta IA se entrega sin citaciones (ver `legalpro-app/server/middleware/ragMiddleware.js:101`).
- El wrapper **siempre** retorna `necesita_revision_humana: true` por compliance LPDP.
- El wrapper **siempre** adjunta los 4 `DISCLAIMERS_OBLIGATORIOS` a la respuesta estructurada.

---

## 2. Mapa de archivos

```text
C:\Users\Pc\Desktop\Abogacia\
├── legalpro-app/
│   ├── .env.example                                 # ENABLE_RAG, RAG_TOP_K, RAG_THRESHOLD
│   ├── server/
│   │   ├── index.js                                 # registra ragMiddleware global
│   │   ├── middleware/
│   │   │   ├── ragMiddleware.js                     # feature flag + inyección
│   │   │   ├── promptSanitizer.js                   # valida 16 patrones anti-injection
│   │   │   └── iaTransferenciaGuard.js              # LPDP Art. 21
│   │   ├── routes/
│   │   │   ├── ai.js                                # POST /api/ai/consulta, withRagContext()
│   │   │   └── legal-multigent-routes.js            # /api/legal/query
│   │   ├── utils/
│   │   │   ├── rag-observability.js                 # logRAGQuery(), hashConsulta()
│   │   │   └── audit.js                             # logAudit() → INSERT audit_log
│   │   └── __tests__/
│   │       ├── rag-flow.test.js                     # Journey 1+2 (consultarBaseLegal)
│   │       └── rag-routes.test.js                   # Journey 3 (HTTP + RAG)
│   └── railway.cron.json                            # rag-daily-update 06:00 PET
├── tools/
│   ├── rag/
│   │   ├── setup-rag.mjs                            # Setup inicial (verifica prereqs + indexa)
│   │   ├── index-corpus.mjs                         # Indexer (chunker + embeddings + ON CONFLICT)
│   │   ├── retrieve.mjs                             # Retriever pgvector
│   │   ├── junior-rag-wrapper.mjs                   # Wrapper de alto nivel para subagentes
│   │   ├── redis-cache.mjs                          # Cache distribuido (fail-open)
│   │   ├── daily-update.mjs                         # CRON 06:00 PET
│   │   ├── metrics.mjs                              # Reporte SLO + alertas
│   │   ├── stress-test.mjs                          # Load test concurrente
│   │   ├── cost-analysis.mjs                        # Cálculo de costos
│   │   └── chunker-advanced.mjs                     # Chunking legal-aware (por artículo/sección)
│   └── scrapers/
│       ├── spij-scraper.mjs                         # 17 códigos SPIJ (Playwright)
│       ├── tc-scraper.mjs                           # Sentencias TC
│       └── elperuano-scraper.mjs                    # Diario Oficial
├── catalogs/                                        # Corpus oficial (JSON, versionado)
│   ├── codigos-leyes.json                           # 19 leyes
│   ├── plazos-procesales.json                       # 17 plazos
│   ├── tipos-penales-peru.json                      # 25 tipos
│   ├── delitos-economicos.json                      # 16 delitos
│   ├── disclaimers-ia.json                          # 14 disclaimers
│   ├── jurisprudencia-tc-2026.json                  # 8 sentencias TC
│   ├── normas-minjusdh-2026.json                    # 12 normas
│   ├── resoluciones-indecopi-2026.json              # 12 resoluciones
│   ├── fuentes-rag-2026.json                        # Metadatos de corpus
│   ├── casaciones-pj-2026.json                      # Pendiente de indexar
│   ├── sentencias-tc-completas-2026.json            # Pendiente de indexar
│   ├── directivas-sunarp-2026.json                  # Pendiente de indexar
│   └── ...                                          # 12 catálogos adicionales
└── docs/
    ├── ARQUITECTURA_RAG.md
    ├── MONITORING_RAG.md
    ├── USER_GUIDE_RAG.md
    ├── DEVELOPER_GUIDE_RAG.md   ← este archivo
    └── RAG_TROUBLESHOOTING.md
```

---

## 3. Variables de entorno (verificadas en `legalpro-app/.env.example`)

| Variable | Default | Efecto |
|---|---|---|
| `DATABASE_URL` | — (obligatorio) | Conexión a Postgres con extensión `vector`. Usado por `retrieve.mjs`, `index-corpus.mjs`, `metrics.mjs`. |
| `OPENAI_API_KEY` | — (opcional A) | Habilita `text-embedding-3-small` (768 d, $0.02/1M tokens). |
| `GEMINI_API_KEY` | — (opcional B) | Habilita `embedding-001` (768 d, free tier). Se elige automáticamente si no hay `OPENAI_API_KEY`. |
| `RAG_EMBEDDING_MODEL` | `text-embedding-3-small` | Modelo de embedding (forwarded al proveedor). |
| `ENABLE_RAG` | `false` | Feature flag del middleware. Default OFF; cambia en Railway para activar globalmente. |
| `RAG_TOP_K` | `5` | Chunks máximos por consulta. Reduce para latencia, sube para recall. |
| `RAG_THRESHOLD` | `0.70` | Similitud coseno mínima. Sube para más estricto. |
| `REDIS_URL` | `redis://localhost:6379` | Conexión al cache distribuido (opcional). |
| `RAG_CACHE_TTL` | `3600` (1 h) | TTL en segundos. |
| `RAG_CACHE_PREFIX` | `rag:cache:` | Prefijo de keys en Redis. |
| `RAG_CACHE_DISABLE` | `0` | Si es `"1"`, fuerza modo memoria (omite Redis). |
| `STRESS_MIN_SUCCESS_RATE` | `95.0` | Umbral del stress test. |
| `STRESS_MAX_P95_MS` | `3000` | p95 máximo permitido en stress test. |
| `STRESS_MAX_P99_MS` | `6000` | p99 máximo permitido en stress test. |

> `legalpro-app/.env.example` solo documenta `ENABLE_RAG`, `RAG_TOP_K` y `RAG_THRESHOLD`. El resto se documenta en `tools/rag/redis-cache.mjs`, `tools/rag/stress-test.mjs` y `docs/ARQUITECTURA_RAG.md`.

---

## 4. Setup local (primera vez)

```powershell
# 0. Requisitos
#    - Node.js >= 20.x  (legalpro-app/package.json usa ESM "type": "module")
#    - PostgreSQL 15 con la extensión `vector` (pgvector >= 0.5)
#    - Playwright Chromium para los scrapers

# 1. Instalar dependencias del workspace
cd C:\Users\Pc\Desktop\Abogacia
npm install --prefix legalpro-app

# 2. Configurar variables (ejemplo mínimo)
$env:ENABLE_RAG = "true"
$env:DATABASE_URL = "postgresql://legalpro_node:********@host:5432/legalpro"
$env:OPENAI_API_KEY = "sk-..."

# 3. Setup automatizado (verifica Node, pg, .env y crea el schema)
node tools/rag/setup-rag.mjs

# 4. Smoke test: retrieval directo
node tools/rag/retrieve.mjs "plazo para contestar demanda civil"
#    Salida esperada: lista de chunks con similitud >= 0.75

# 5. Smoke test: wrapper con cache
node tools/rag/junior-rag-wrapper.mjs "plazo prescripción civil" civil
#    Salida: Chunks usados · Fuentes · Citaciones · Disclaimers

# 6. (Opcional) Iniciar el backend para verificar el middleware
cd legalpro-app
npm run server
```

> **No instales los scripts RAG en `legalpro-app`**: viven en la raíz del monorepo (`tools/rag/`) y se ejecutan con `node` desde esa raíz. Los scrapers (`tools/scrapers/*.mjs`) requieren Playwright Chromium: `npx playwright install chromium`.

---

## 5. Cómo agregar un nuevo corpus

### 5.1 Crear/actualizar el JSON

El indexer (`tools/rag/index-corpus.mjs`) detecta automáticamente el array raíz del catálogo. Claves soportadas (en orden de prioridad):

```text
jurisprudencia · normas · resoluciones · plazos · normas_array · tipos · delitos · disclaimers
```

Si tu JSON no encaja, exporta el array como una de esas claves o envuélvelo en una de ellas. Ejemplo mínimo (`catalogs/codigos-provinciales-2026.json`):

```json
{
  "metadata": {
    "fuente": "https://www.gob.pe/minjus",
    "fecha_consulta": "2026-08-01",
    "responsable": "Equipo LegalPro"
  },
  "normas": [
    {
      "id": "PROV-2026-001",
      "titulo": "Ley Provincial 3041",
      "sumilla": "Regula el procedimiento administrativo provincial.",
      "materia": "administrativo",
      "fecha_publicacion": "2026-07-12",
      "url_fuente": "https://spij.minjus.gob.pe/...",
      "palabras_clave": ["provincial", "administrativo", "procedimiento"]
    }
  ]
}
```

### 5.2 Registrar el catálogo en el indexer

Edita `tools/rag/index-corpus.mjs` y agrega el archivo al array `CONFIG.sources` (línea ~40):

```js
const CONFIG = {
  // ...
  sources: [
    // CATÁLOGOS BASE
    'codigos-leyes.json',
    'plazos-procesales.json',
    'tipos-penales-peru.json',
    'delitos-economicos.json',
    'disclaimers-ia.json',
    // CATÁLOGOS NUEVOS
    'jurisprudencia-tc-2026.json',
    'normas-minjusdh-2026.json',
    'resoluciones-indecopi-2026.json',
    'codigos-provinciales-2026.json'   // ← nuevo
  ]
};
```

### 5.3 Re-indexar (idempotente)

```powershell
node tools/rag/index-corpus.mjs
```

El indexer usa `ON CONFLICT (id) DO UPDATE`, así que re-ejecuciones son seguras. La salida muestra:

```text
🚀 RAG Corpus Indexer - LegalPro
📂 Procesando: codigos-provinciales-2026.json
   Documentos: 1
   ✅ N chunks indexados de codigos-provinciales-2026.json
✅ INDEXACIÓN COMPLETADA EXITOSAMENTE
```

> Para catálogos grandes (>10 MB o >1 000 docs) usa `tools/rag/chunker-advanced.mjs` (`chunkPorArticulo()` para códigos, `chunkPorSeccion()` para jurisprudencia, `chunkHibrido()` como router automático). El indexer actual usa un chunker ligero en línea.

### 5.4 Programar la actualización automática

`legalpro-app/railway.cron.json` ya define dos jobs:

| Job | Cron | Comando |
|---|---|---|
| `rag-daily-update` | `0 6 * * *` (06:00 PET) | `node tools/rag/daily-update.mjs` |
| `rag-weekly-full-update` | `0 2 * * 0` (domingos 02:00) | `node tools/rag/daily-update.mjs --full` |

`daily-update.mjs` ejecuta scrapers (El Peruano, TC, SPIJ) y re-indexa. Para añadir un scraper nuevo, edita el objeto `SCRIPTS` en `tools/rag/daily-update.mjs` y agrégalo a la fase 1.

---

## 6. Cómo extender un subagente con RAG

Todos los agentes juniors en `.opencode/agents/abogado-jr-*.md` siguen el mismo patrón. Ejemplo real (`abogado-jr-civil.md`):

```js
import { consultarBaseLegal } from '../../tools/rag/junior-rag-wrapper.mjs';

const baseLegal = await consultarBaseLegal({
  materia: 'civil',
  consulta: 'plazo para contestar demanda civil',
  contexto: 'Caso de prescripción adquisitiva en Lince'
});

// baseLegal contiene:
//   contexto, citaciones, fuentes, chunks_usados,
//   prompt_aumentado, disclaimers_obligatorios (4), audit_metadata
```

**Reglas de uso (alineadas con `tools/rag/junior-rag-wrapper.mjs`):**

1. La consulta debe tener **mínimo 5 caracteres**; el wrapper lanza `Error('consulta debe tener al menos 5 caracteres')` si no.
2. `materia` válida: `civil`, `penal`, `laboral`, `tributario`, `constitucional`, `familia`, `comercial`, `ambiental`, `administrativo`, `arbitraje`, `consumidor`, `penal_economico`, `procesal_penal`, `concursal`, `propiedad_intelectual`, `compliance`, `migratorio`, `mineria`, `sanitario`, `seguridad_social`, `notarial`, `educativo` (ver `MATERIAS_VALIDAS` en `ragMiddleware.js:33`).
3. `baseLegal.necesita_revision_humana === true` SIEMPRE. Márcalo en la respuesta al usuario.
4. **Incluye los 4 disclaimers IA** (puedes usar `formatCitaciones()` y `inyectarDisclaimers()` del middleware).
5. `audit_metadata.similitud_promedio` permite decidir si la respuesta es utilizable o si conviene una respuesta con conocimiento general.

Para un subagente nuevo (`.opencode/agents/abogado-jr-xyz.md`), sigue la plantilla:

```md
## Consulta RAG obligatoria

**ANTES de responder:**

\`\`\`javascript
import { consultarBaseLegal } from '../../tools/rag/junior-rag-wrapper.mjs';
const baseLegal = await consultarBaseLegal({
  materia: 'xyz',
  consulta: '<CONSULTA>',
  contexto: '<CASO>'
});
\`\`\`

**Tu respuesta DEBE incluir citaciones [N] y los 4 disclaimers IA** definidos en
`DISCLAIMERS_OBLIGATORIOS` (junior-rag-wrapper.mjs).
```

---

## 7. Esquema SQL `rag_vectors` y `rag_audit_log`

`tools/rag/index-corpus.mjs` ejecuta `ensureSchema()` al arrancar. El bloque se materializa como:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_vectors (
  id        TEXT PRIMARY KEY,
  source    TEXT NOT NULL,
  content   TEXT NOT NULL,
  embedding vector(768),            -- 768 dimensiones (OpenAI/Gemini)
  metadata  JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_vectors_source
  ON rag_vectors(source);

CREATE INDEX IF NOT EXISTS idx_rag_vectors_metadata_tipo
  ON rag_vectors USING GIN ((metadata->>'tipo'));

CREATE INDEX IF NOT EXISTS idx_rag_vectors_embedding
  ON rag_vectors USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE rag_vectors ENABLE ROW LEVEL SECURITY;
```

`rag_audit_log` (consultada por `tools/rag/metrics.mjs`) requiere una migración dedicada. Columnas mínimas:

```sql
CREATE TABLE IF NOT EXISTS rag_audit_log (
  id                          BIGSERIAL PRIMARY KEY,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id                     TEXT,
  organization_id             TEXT,
  correlation_id              TEXT,
  materia                     TEXT,
  consulta_hash               TEXT NOT NULL,        -- SHA-256 truncado (16 hex)
  chunks_usados               INTEGER,
  similitud_promedio          NUMERIC(5,4),
  citaciones_usadas           INTEGER,
  citaciones_verificadas     BOOLEAN,
  alucinaciones_detectadas    INTEGER DEFAULT 0,
  retrieval_precision_at_k    NUMERIC(5,4),
  retrieval_recall_at_k       NUMERIC(5,4),
  context_relevance_score     NUMERIC(5,4),
  answer_relevance_score      NUMERIC(5,4),
  latency_ms                  INTEGER,
  costo_usd                   NUMERIC(10,6),
  proveedor_embeddings        TEXT
);

CREATE INDEX IF NOT EXISTS idx_rag_audit_log_created_at
  ON rag_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_audit_log_organization
  ON rag_audit_log(organization_id);
```

> Esta tabla no se crea automáticamente. `metrics.mjs` solo la lee; si no existe, devuelve métricas `null` y los SLOs no se pueden evaluar.

---

## 8. Operaciones, métricas y stress test

### 8.1 Reporte de métricas

```powershell
node tools/rag/metrics.mjs 7
```

Salida (formato JSON). Evalúa SLOs declarados en `THRESHOLDS` (`metrics.mjs:14`):

| Métrica | Operador | Umbral |
|---|---|---|
| `retrieval_precision_at_k` | `min` | `>= 0.85` |
| `retrieval_recall_at_k` | `min` | `>= 0.90` |
| `citation_accuracy` | `min` | `>= 0.98` |
| `hallucination_rate` | `maxExclusive` | `< 0.02` |
| `context_relevance_score` | `min` | `>= 0.80` |
| `answer_relevance_score` | `min` | `>= 0.85` |
| `latency_p95_ms` | `maxExclusive` | `< 3000` |
| `average_cost_usd` | `maxExclusive` | `< 0.10` |

Exit code `1` cuando un umbral incumple. Integra con CI / Alertmanager.

### 8.2 Stress test

```powershell
node tools/rag/stress-test.mjs --users=50 --reqs=500 --duration=120 --warmup=20
```

Flags soportados: `--users`, `--reqs`, `--duration`, `--warmup`, `--help`.
Variables opcionales: `STRESS_MIN_SUCCESS_RATE` (default 95), `STRESS_MAX_P95_MS` (3000), `STRESS_MAX_P99_MS` (6000).

El script agrega un sufijo único por iteración para no hitear el cache en memoria.

### 8.3 Costos

```powershell
node tools/rag/cost-analysis.mjs
```

Calcula escenarios por plan (`FREE`, `PRO`, `ENTERPRISE`), MRR proyectado y optimizaciones (Redis cache, hybrid scoring, embeddings económicos, etc.).

### 8.4 Cache distribuido (Redis)

```powershell
# Si tienes ioredis-cli:
redis-cli -u $REDIS_URL KEYS "rag:cache:*" | head
redis-cli -u $REDIS_URL INFO memory | grep used_memory_human
```

API expuesta por `tools/rag/redis-cache.mjs`:

- `getCachedResult(materia, consulta, contexto)` — devuelve objeto con `_cache_layer`, `_cached_at` o `null`.
- `setCachedResult(materia, consulta, contexto, resultado)` — TTL = `RAG_CACHE_TTL`.
- `invalidateCache(pattern = '*')` — usa `SCAN` (no `KEYS`).
- `getCacheStats()` — modo, prefix, ttl, conexión, `used_memory_human`.

Si Redis está caído, el wrapper cae automáticamente al **Map en memoria** (max 100 entradas, LRU-light) y loguea `[redis-cache] ioredis no disponible, fallback a memoria`.

---

## 9. Observabilidad y audit log

| Componente | Emite | Payload clave | Destino |
|---|---|---|---|
| `ragMiddleware.js` | `RAG_CONTEXT_INJECTED` | `path`, `materia`, `chunks_usados`, `similitud_promedio`, `usuario_id`, `organizacion_id`, `ip`, `rag_top_k`, `rag_threshold` | `audit_log` (vía `logAudit()`) |
| `rag-observability.js` | `RAG_QUERY` (helper) | `consultaHash` (SHA-256 16 chars), métricas de calidad, `latencyMs`, `costoUsd` | `audit_log` (helper listo, requiere cableado en rutas) |
| `audit.js` | `logAudit()` | `evento`, `severidad`, `usuario_id`, `organization_id`, `ip`, `payload` | `audit_log` + log estructurado |

> **Gap conocido:** `logRAGQuery()` está exportado pero todavía no se invoca desde `ragMiddleware.js`. Para activarlo, importa `logRAGQuery` y llámalo tras `consultarBaseLegal()` con la latencia medida.

### 9.1 Trazabilidad distribuida

Todas las requests IA deben propagar `X-Correlation-ID`. El middleware lo lee y lo enriquece en el evento de auditoría. Configura tu proveedor de OTel / Sentry con la transacción `rag.query` y los spans `rag.embedding`, `rag.vector_search`, `rag.rerank`, `rag.generation`, `rag.citation_validation` (ver `docs/MONITORING_RAG.md` § Dashboard sugerido).

---

## 10. Seguridad y cumplimiento (resumen)

- **LPDP (Ley 29733):** `consultaHash` (no texto en claro), banner ámbar obligatorio en cada respuesta IA, `consentimientoLPDP` antes de invocar `/api/ai/*` y `/api/legal/*` (vía `iaTransferenciaGuard`).
- **Multi-tenant:** `rag_vectors` con RLS ON; la tabla almacena normas públicas por lo que la política por defecto es de lectura libre. El audit log usa `organizationId` para correlación.
- **Prompt injection:** `legalpro-app/server/middleware/promptSanitizer.js` valida 16 patrones antes de invocar el LLM.
- **XSS en citaciones:** `CitacionesPanel.jsx` solo renderiza URLs `http(s)://` (`sanitizarUrl()`).
- **OWASP A01 (BAC):** RLS en `rag_vectors`.
- **OWASP A03 (Injection):** pgvector con queries parametrizadas + `promptSanitizer.js`.

Detalle completo en `docs/ARQUITECTURA_RAG.md` § 9 (Seguridad).

---

## 11. Convenciones para PRs

- **Skill obligatoria:** `rag-busqueda-semantica` (v3.0 en `.opencode/skills/`).
- **Tag en el commit:** `SKILL: rag-busqueda-semantica` (alineado con la regla global de AGENTS.md).
- **Tests:** añade casos a `legalpro-app/server/__tests__/rag-flow.test.js` o `rag-routes.test.js`. Mantén mocks de `retrieve.mjs` y `minimaxClient.js` para que no requieran conexión real a pg ni al proveedor IA.
- **Coverage mínima:** 80 % en código nuevo del flujo RAG.
- **Sin secretos en código:** claves en `.env` o variables de Railway, nunca en JSON.
- **Sin `git clean -fd`, `git push --force`, `git reset --hard`** (ver AGENTS.md § Git Workflow Estricto).

---

## 12. Próximos pasos

1. **Activar RAG en staging:** `ENABLE_RAG=true` en `.env` de `legalpro-app` y correr `node tools/rag/retrieve.mjs "plazo prescripción civil"`.
2. **Migrar `rag_audit_log`:** aplicar la SQL de § 7 y cablear `logRAGQuery()` en `ragMiddleware.js` con `latencyMs` (medir antes/después de `consultarBaseLegal`).
3. **Habilitar Redis en producción** (`REDIS_URL` apuntando a instancia administrada).
4. **Eval-set formal:** 50 preguntas ground truth, calcular `retrieval_precision_at_k` y `citation_accuracy` con `tools/rag/metrics.mjs`.
5. **Escalar a 1 000+ documentos:** añadir los catálogos pendientes (`casaciones-pj-2026.json`, `sentencias-tc-completas-2026.json`, `directivas-sunarp-2026.json`, etc.) a `CONFIG.sources`.
6. **GraphRAG y chunking adaptativo** (ver `docs/ARQUITECTURA_RAG.md` § Roadmap Sprints 3-4).
