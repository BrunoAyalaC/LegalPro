---
name: optimizadores-rendimiento
description: Optimización de performance para Node 20, .NET 8, React 19, PostgreSQL/Supabase. Bundle size, latencia p95, queries N+1, cache, Core Web Vitals, cost IA.
when-to-use: "Cuando haya problemas de performance, o antes de release a producción"
allowed-tools: Read, Bash, Grep, Glob
updated: 2026-07-31
benchmarks-objetivo:
  api_p95: 500ms
  api_ia_p95: 3000ms
  web_lcp: 2.5s
  web_fid: 100ms
  web_cls: 0.1
  bundle_main: 300kb_gz
  db_connection_pool: 80pct
---

# optimizadores-rendimiento (v3.0 RAG-optimized)

Documenta el **arsenal completo de optimizaciones** para LegalPro: Node 20, .NET 8, React 19, PostgreSQL/Supabase, MiniMax. Benchmarks objetivo claros y verificables. **A julio 2026**.

## Inputs

```yaml
stack_afectado: node | dotnet | react | postgres | minimax | mobile
metrica_objetivo: api_latency | bundle_size | db_query_time | web_vitals | cost_ia
scope: archivo | modulo | sistema
prioridad: CRITICAL | HIGH | MEDIUM | LOW
```

## Output schema

```json
{
  "version": "3.0",
  "stack": "string",
  "metrica": "string",
  "estado_actual": { "valor": "X", "unidad": "ms|kb|s" },
  "objetivo": { "valor": "X", "unidad": "ms|kb|s" },
  "optimizaciones_aplicables": [
    { "id": "OPT-NN", "tipo": "code | infra | cache | query", "impacto": "ALTO | MEDIO | BAJO", "esfuerzo": "S | M | L | XL" }
  ],
  "plan": ["..."],
  "riesgos": ["..."]
}
```

## 1. Optimizaciones Backend Node 20 + Express 5

### 1.1 N+1 Queries → Eager Loading

```javascript
// ❌ MAL (N+1)
const expedientes = await db.query('SELECT * FROM expedientes WHERE org_id = $1', [orgId]);
for (const exp of expedientes.rows) {
  exp.partes = await db.query('SELECT * FROM partes WHERE expediente_id = $1', [exp.id]);
}

// ✅ BIEN (eager loading con JOIN)
const expedientes = await db.query(`
  SELECT e.*, json_agg(p.*) as partes
  FROM expedientes e
  LEFT JOIN partes p ON p.expediente_id = e.id
  WHERE e.organization_id = $1
  GROUP BY e.id
`, [orgId]);
```

### 1.2 Cache con Redis

```javascript
import { cache } from '../utils/cache-redis.js';

const getCatalog = async () => {
  return await cache.getOrSet('catalog:tipos-penales', async () => {
    return await db.query('SELECT * FROM tipos_penales');
  }, { ttl: 3600 }); // 1h
};
```

### 1.3 Connection Pool Sizing

```javascript
// legalpro-app/server/db.js
import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                      // ajustar a CPU cores * 2-4
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  query_timeout: 10000,
});
```

### 1.4 Compresión HTTP

```javascript
import compression from 'compression';
app.use(compression({ level: 6, threshold: 1024 }));
```

### 1.5 Streaming de respuestas grandes

```javascript
app.get('/api/expedientes/export', async (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Transfer-Encoding', 'chunked');

  const stream = db.query(new pg.QueryStream(`
    SELECT * FROM expedientes WHERE org_id = $1
  `, [req.tenantId]));

  stream.pipe(res);
});
```

### 1.6 Response Cache (ETag + 304)

```javascript
import etag from 'etag';

app.get('/api/catalog/:id', async (req, res) => {
  const data = await getCatalog(req.params.id);
  const tag = etag(JSON.stringify(data));

  if (req.headers['if-none-match'] === tag) {
    return res.status(304).end();
  }

  res.setHeader('ETag', tag);
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({ success: true, data });
});
```

## 2. Optimizaciones Backend .NET 8

### 2.1 Async All the Way

```csharp
public async Task<Expediente> GetByIdAsync(Guid id, CancellationToken ct)
{
    return await _db.Expedientes
        .AsNoTracking()           // Read-only queries
        .FirstOrDefaultAsync(e => e.Id == id, ct);
}
```

### 2.2 Compiled Queries (EF Core)

```csharp
private static readonly Func<LegalProDbContext, Guid, CancellationToken, Task<Expediente>>
    _getByIdCompiled = EF.CompileAsyncQuery((LegalProDbContext db, Guid id, CancellationToken ct) =>
        db.Expedientes.FirstOrDefaultAsync(e => e.Id == id, ct));

public Task<Expediente> GetByIdAsync(Guid id, CancellationToken ct)
    => _getByIdCompiled(_db, id, ct);
```

### 2.3 Response Caching

```csharp
[ResponseCache(Duration = 300, VaryByQueryKeys = new[] { "orgId" })]
public async Task<IActionResult> GetCatalog(string orgId) { ... }
```

### 2.4 OpenTelemetry Tracing

```csharp
builder.Services.AddOpenTelemetry()
    .WithTracing(t => t
        .AddAspNetCoreInstrumentation()
        .AddEntityFrameworkCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddOtlpExporter());
```

## 3. Optimizaciones Frontend React 19 + Vite 7

### 3.1 Code Splitting por Ruta

```jsx
// App.jsx
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Expedientes = lazy(() => import('./pages/Expedientes'));

<Route path="/dashboard" element={<Suspense fallback={<Skeleton />}><Dashboard /></Suspense>} />
```

### 3.2 React 19 Compiler (auto-memoization)

```jsx
// React 19 compila automáticamente — sin useMemo manual en muchos casos
export default function ExpedienteList({ items }) {
  return items.map(item => <Item key={item.id} {...item} />);
}
```

### 3.3 Virtualización de listas largas

```jsx
import { useVirtualizer } from '@tanstack/react-virtual';

function LargeList({ items }) {
  const parentRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  });
  // ...
}
```

### 3.4 Image Optimization

```jsx
<img
  src="/hero.avif"
  srcSet="/hero-400.avif 400w, /hero-800.avif 800w"
  sizes="(max-width: 600px) 400px, 800px"
  loading="lazy"
  decoding="async"
  alt="Hero"
/>
```

### 3.5 TailwindCSS 4 — Bundle más pequeño

```css
/* index.css — solo lo necesario */
@import "tailwindcss/utilities";
@layer components {
  .btn-primary { @apply bg-blue-600 text-white px-4 py-2 rounded; }
}
```

## 4. Optimizaciones PostgreSQL/Supabase

### 4.1 Índices Específicos

```sql
-- Índice compuesto multi-tenant
CREATE INDEX idx_expedientes_org_estado
  ON expedientes(organization_id, estado)
  WHERE deleted_at IS NULL;

-- Índice GIN para búsqueda full-text
CREATE INDEX idx_expedientes_search
  ON expedientes USING GIN (to_tsvector('spanish', numero || ' ' || materia));

-- Índice BRIN para auditoría append-only
CREATE INDEX idx_audit_log_brin
  ON audit_log USING BRIN (created_at);
```

### 4.2 EXPLAIN ANALYZE obligatorio

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM expedientes
WHERE organization_id = 'abc' AND estado = 'activo';
-- Buscar Seq Scan → agregar índice
```

### 4.3 VACUUM ANALYZE periódico

```sql
VACUUM (ANALYZE, VERBOSE) expedientes;
```

### 4.4 Materialized Views para reportes

```sql
CREATE MATERIALIZED VIEW mv_expedientes_stats AS
SELECT organization_id,
       COUNT(*) FILTER (WHERE estado = 'activo') as activos,
       COUNT(*) FILTER (WHERE estado = 'cerrado') as cerrados,
       AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_lifetime_sec
FROM expedientes
GROUP BY organization_id;

CREATE UNIQUE INDEX ON mv_expedientes_stats(organization_id);

-- Refresh concurrente
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_expedientes_stats;
```

## 5. Optimización Cost IA (MiniMax)

### 5.1 Selección de modelo por tarea

| Tarea | Modelo | Temperatura | Costo estimado |
|---|---|---|---|
| Análisis jurídico complejo | `MiniMax-M3` | 0.1 | ~$0.03/req |
| Resumen ejecutivo | `MiniMax-M3` | 0.3 | ~$0.015/req |
| Chat rápido | `MiniMax-M2.5-highspeed` | 0.5 | ~$0.005/req |
| Contexto >32K tokens | `MiniMax-M3-large-context` | 0.2 | ~$0.08/req |

### 5.2 Prompt Compression

```javascript
import { compressPrompt } from '../utils/prompt-compressor.js';

const userInput = await compressPrompt(rawInput, { maxTokens: 4000 });
// Reduce tokens 30-50% sin perder semántica
```

### 5.3 Cache de respuestas

```javascript
import { createHash } from 'crypto';

const cacheKey = createHash('sha256').update(prompt + model + temp).digest('hex');
const cached = await redis.get(`ai:cache:${cacheKey}`);
if (cached) return JSON.parse(cached);

const result = await ai.chat(prompt);
await redis.setex(`ai:cache:${cacheKey}`, 3600, JSON.stringify(result));
```

## Quality gates

- [ ] API p95 < 500ms (no-IA), < 3s (IA)
- [ ] Bundle main < 300kb gz
- [ ] LCP < 2.5s, FID < 100ms, CLS < 0.1
- [ ] DB pool < 80% utilización
- [ ] Cost IA < $0.10/request promedio
- [ ] 0 N+1 queries en code review
- [ ] 0 console.log en producción
- [ ] Compression HTTP habilitado

## Audit log

Emitir `PERFORMANCE_OPTIMIZED` con payload: `stack, optimizaciones_aplicadas, mejora_p95_pct`.

## Referencias

- `tools/verifiers/verifier-bundle-size.mjs`
- `tools/verifiers/verifier-performance.mjs` (no existe — crear)
- `tools/verifiers/verifier-cost-spike.mjs`
- `catalogs/sla-slo.md`
- `docs/CHECKLIST-PRE-PRODUCCION.md`
- React 19 docs: https://react.dev/reference/react/compiler
- Vite 7 perf: https://vite.dev/guide/performance.html
- PostgreSQL perf: https://www.postgresql.org/docs/current/performance-tips.html
- .NET 8 perf: https://learn.microsoft.com/en-us/dotnet/core/performance/
- Web Vitals: https://web.dev/vitals/
