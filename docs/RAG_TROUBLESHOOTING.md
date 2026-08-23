# RAG Troubleshooting — LegalPro

> **Audiencia:** SRE, on-call, ingenieros de operaciones.
> **Severidad:** este documento cubre incidentes **P1 a P3** según `catalogs/sla-slo.md`.
> **Alcance:** `tools/rag/*`, `legalpro-app/server/middleware/ragMiddleware.js`, `legalpro-app/server/routes/ai.js`, base `rag_vectors`, cache Redis opcional.
> **Canales de escalamiento:** alineados con `catalogs/sla-slo.md` (`#ops`, `#security`, `#lpdp`).

---

## 0. Antes de empezar (checklist de triage)

```text
[ ] ¿ENABLE_RAG=true? (legalpro-app/.env)
[ ] ¿DATABASE_URL apunta a la BD con la tabla rag_vectors y la extensión `vector`?
[ ] ¿Hay al menos un proveedor de embeddings (OPENAI_API_KEY o GEMINI_API_KEY)?
[ ] ¿rag_vectors tiene filas?  SELECT COUNT(*) FROM rag_vectors;
[ ] ¿RAG_CACHE_DISABLE != "1" si esperamos cache distribuido?
[ ] ¿Versión del despliegue?  git rev-parse HEAD
[ ] ¿Último run del CRON?  logs/rag-updates/update-YYYY-MM-DD.json
[ ] ¿Hay deploy reciente?  Railway:  node tools/railway/legalpro-ops.ps1 status
```

---

## 1. Problemas de configuración / setup

### 1.1 `No embedding provider configured`

**Síntoma:** el log muestra `❌ Ningún proveedor de embeddings configurado` y el indexer termina con exit code `1`. El wrapper responde con error 500.

**Causa:** ni `OPENAI_API_KEY` ni `GEMINI_API_KEY` están definidas.

**Solución (Windows PowerShell):**

```powershell
$env:OPENAI_API_KEY = "sk-..."
# o
$env:GEMINI_API_KEY = "AIza..."

# Persistir en el .env (NO commitear)
Add-Content legalpro-app/.env "OPENAI_API_KEY=sk-..."

# Reintentar
node tools/rag/setup-rag.mjs
```

Verificación: `tools/rag/index-corpus.mjs:174` y `tools/rag/retrieve.mjs:64` lanzan este mensaje.

### 1.2 `DATABASE_URL not configured`

**Síntoma:** `throw new Error('DATABASE_URL not configured')` desde `retrieve.mjs:84` o error genérico de conexión.

**Causa:** variable no definida o apunta a una base sin `pgvector`.

**Solución:**

```powershell
$env:DATABASE_URL = "postgresql://legalpro_node:********@host:5432/legalpro"

# Verificar la extensión vector
psql $env:DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql $env:DATABASE_URL -c "SELECT extname, extversion FROM pg_extension WHERE extname='vector';"
```

### 1.3 `ENABLE_RAG=false` (RAG inactivo)

**Síntoma:** las páginas IA devuelven respuesta, pero **no hay citaciones** ni `RAGStatus` en `AIAssistantPanel.jsx`. Latencia similar a la versión sin RAG.

**Causa:** feature flag apagado en `.env` o variables de Railway.

**Solución:**

```powershell
# Editar .env (NO commitear)
Set-Content -Path legalpro-app/.env -Value "ENABLE_RAG=true" -Force

# O en Railway
& tools/railway/legalpro-ops.ps1 env set ENABLE_RAG true
& tools/railway/legalpro-ops.ps1 redeploy
```

> El middleware es **no-op** cuando `ENABLE_RAG !== "true"`. No afecta performance.

---

## 2. Problemas de datos / corpus

### 2.1 "Sin base legal específica — respuesta general"

**Síntoma:** la respuesta muestra el banner naranja de `RAGStatus.jsx` con `chunks_usados === 0`. El subagente cae a conocimiento general.

**Causa:** ningún chunk pasó el umbral `RAG_THRESHOLD` (default `0.70`). Posibles razones:

1. El corpus no contiene documentos relevantes para esa materia.
2. La consulta es muy corta (mínimo 5 caracteres, validado en `junior-rag-wrapper.mjs:128`).
3. El embedding del query está mal calculado (API key sin cuota, modelo no disponible).

**Diagnóstico:**

```powershell
# Confirmar contenido del corpus
psql $env:DATABASE_URL -c "SELECT source, COUNT(*) FROM rag_vectors GROUP BY source ORDER BY 2 DESC;"

# Probar retrieval directo
node tools/rag/retrieve.mjs "<misma consulta>"   # umbral interno 0.75

# Probar wrapper
node tools/rag/junior-rag-wrapper.mjs "<misma consulta>" civil
```

**Solución:**

- Reformular con términos más específicos (artículo + norma).
- Si el corpus no tiene cobertura de esa materia, agregar el JSON correspondiente y re-indexar (ver `docs/DEVELOPER_GUIDE_RAG.md` § 5).
- Bajar `RAG_THRESHOLD=0.60` temporalmente y medir con `metrics.mjs`.

### 2.2 Catálogo no indexa (no aparece en `rag_vectors`)

**Síntoma:** `index-corpus.mjs` loguea `⚠️ No encontrado: <archivo>.json` o `❌ Error parseando`.

**Causa:** el archivo no está en `catalogs/` o no tiene la clave raíz soportada.

**Diagnóstico:**

```powershell
Get-ChildItem catalogs/*.json | Select-Object Name
node -e "const c=require('./catalogs/codigos-leyes.json'); console.log(Object.keys(c))"
```

**Solución:**

- Verificar que el JSON existe en `catalogs/` y es válido (`jq . catalogs/<archivo>.json`).
- Si la clave raíz no es una de las reconocidas (`jurisprudencia`, `normas`, `resoluciones`, `plazos`, `tipos`, `delitos`, `disclaimers`), renombrar o envolver en una de ellas. Ver `tools/rag/index-corpus.mjs:278`.
- Verificar que el nombre del archivo esté en `CONFIG.sources` (`index-corpus.mjs:40`).

### 2.3 Citaciones sin URL verificable

**Síntoma:** el panel `CitacionesPanel.jsx` muestra la fuente pero **sin enlace** (sin ícono `ExternalLink`).

**Causa:** el documento no tiene `metadata.url` o `url_fuente`. `CitacionesPanel.sanitizarUrl()` exige protocolo `http:` / `https:` (mitigación XSS / tab-nabbing).

**Diagnóstico:**

```sql
SELECT id, source, metadata
FROM rag_vectors
WHERE metadata->>'url' IS NULL
LIMIT 20;
```

**Solución:** editar el JSON del catálogo y agregar `url_fuente` por documento. Después re-indexar con `node tools/rag/index-corpus.mjs`.

---

## 3. Problemas de latencia y rendimiento

### 3.1 p95 > 3 000 ms

**Síntoma:** `node tools/rag/metrics.mjs 7` reporta `latency_p95_ms` ≥ 3000 y dispara la alerta P2 de `docs/MONITORING_RAG.md` § Alertas.

**Causa probable:** sin cache distribuido, índice ivfflat mal calibrado o proveedor de embeddings saturado.

**Solución (orden de menor a mayor impacto):**

1. **Activar cache Redis:**

   ```powershell
   $env:REDIS_URL = "redis://host:6379"
   $env:RAG_CACHE_TTL = "3600"
   & tools/railway/legalpro-ops.ps1 env set REDIS_URL "redis://..."
   & tools/railway/legalpro-ops.ps1 redeploy
   ```

2. **Reducir `RAG_TOP_K=3`** (en lugar de 5) si la similitud promedio > 0.85 en métricas históricas.

3. **Recalibrar el índice ivfflat** si `rag_vectors` tiene > 10 000 filas:

   ```sql
   DROP INDEX IF EXISTS idx_rag_vectors_embedding;
   CREATE INDEX idx_rag_vectors_embedding
     ON rag_vectors USING ivfflat (embedding vector_cosine_ops)
     WITH (lists = CEIL(SQRT(total_filas)::int / 10) * 10);
   -- Ejemplo con 12 300 filas: lists = 110
   ```

4. **Migrar a embeddings Gemini** (puede ser más rápido en la región). Setear `GEMINI_API_KEY` y dejar `OPENAI_API_KEY` vacía (la selección es automática en `retrieve.mjs:30` y `index-corpus.mjs:137`).

5. **Ejecutar `node tools/rag/stress-test.mjs --users=100 --reqs=1000`** para verificar mejora.

### 3.2 Timeouts intermitentes del embedding

**Síntoma:** `retrieve.mjs:42` lanza `OpenAI error: 408/429/500/503`. El middleware degrada con `req.ragContext = null` (fail-open) y la respuesta se entrega sin RAG.

**Causa:** rate limit del proveedor o saturación regional.

**Solución:**

1. Cambiar a Gemini (`GEMINI_API_KEY`) o alternar entre proveedores (los `if` en `retrieve.mjs:30-58` lo soportan).
2. Activar `RAG_CACHE_TTL=7200` para reducir hits al proveedor.
3. Implementar reintentos con backoff exponencial (los scrapers ya lo hacen, ver `tools/scrapers/`).

### 3.3 Stress test falla con `STRESS_MAX_P95_MS`

**Síntoma:** `node tools/rag/stress-test.mjs --users=50 --reqs=500` finaliza con `FAIL` y p95 > 3000 ms.

**Causa:** cuello en pgvector (índice mal calibrado) o saturación del pool de conexiones.

**Solución:**

1. **Aumentar el pool de conexiones** del driver `pg` (configurado en `legalpro-app/server/db.js`).
2. **Reducir concurrencia**: `--users=20` mientras se repara.
3. **Reindexar ivfflat** (ver § 3.1).
4. **Verificar el query plan**:

   ```sql
   EXPLAIN ANALYZE
   SELECT id, 1 - (embedding <=> $1::vector) AS similarity
   FROM rag_vectors
   WHERE 1 - (embedding <=> $1::vector) > 0.70
   ORDER BY embedding <=> $1::vector
   LIMIT 5;
   ```

---

## 4. Problemas de observabilidad y compliance

### 4.1 `metrics.mjs` no devuelve datos (métricas en `null`)

**Síntoma:** `node tools/rag/metrics.mjs 7` muestra `null` en `latencia.p95`, `costos[].costo_total`, etc., y `alerts` reporta "sin datos para evaluar".

**Causa:** la tabla `rag_audit_log` no existe o no se está poblando.

**Diagnóstico:**

```powershell
psql $env:DATABASE_URL -c "\d rag_audit_log"
psql $env:DATABASE_URL -c "SELECT COUNT(*) FROM rag_audit_log WHERE created_at >= NOW() - INTERVAL '7 days';"
```

**Solución:**

1. **Crear la tabla** con la migración documentada en `docs/DEVELOPER_GUIDE_RAG.md` § 7.
2. **Cablear `logRAGQuery()`** en `legalpro-app/server/middleware/ragMiddleware.js` (actualmente solo emite `RAG_CONTEXT_INJECTED` con `logAudit`).

   ```js
   import { logRAGQuery } from '../utils/rag-observability.js';

   const t0 = Date.now();
   const baseLegal = await consultarBaseLegal({ materia, consulta, contexto });
   const latencyMs = Date.now() - t0;

   await logRAGQuery({
     userId: req.user?.sub,
     organizationId: req.organizationId,
     correlationId: req.headers['x-correlation-id'],
     materia,
     consulta,
     chunksUsados: baseLegal.chunks_usados,
     similitudPromedio: baseLegal.audit_metadata?.similitud_promedio,
     citacionesUsadas: baseLegal.citaciones?.length,
     latencyMs,
     proveedorEmbeddings: baseLegal.audit_metadata?.proveedor_embeddings,
   });
   ```

3. Re-ejecutar `node tools/rag/metrics.mjs 7` y validar que los SLOs se evalúan.

### 4.2 `hallucination_rate >= 0.02`

**Síntoma:** alerta P2 de `docs/MONITORING_RAG.md` § Alertas.

**Causa probable:** corpus desactualizado, prompt poco estricto, modelo nuevo con drift.

**Triage:**

1. Confirmar última ejecución del CRON (`cat logs/rag-updates/update-2026-08-01.json`).
2. Comparar con despliegues recientes (`railway:status`).
3. Si el corpus es reciente, revisar el `prompt_aumentado` generado por `retrieve.mjs:153` (`buildAugmentedPrompt`). El wrapper ya exige:

   ```text
   - NUNCA inventes artículos o leyes.
   - Si el contexto es insuficiente, di "No encuentro base normativa suficiente".
   - SIEMPRE incluye los 4 disclaimers IA al final.
   ```

4. Considerar **degradación segura**: bajar `RAG_TOP_K=3` y subir `RAG_THRESHOLD=0.75` para forzar respuestas más conservadoras.

### 4.3 Falta el banner ámbar de IA en alguna pantalla

**Síntoma:** una página IA no muestra `IADisclaimerBanner` (transparencia activa LPDP Art. 21).

**Causa:** la página no importa `IADisclaimerBanner` o no se renderiza con la prop `compact`.

**Páginas que SÍ lo muestran hoy (verificadas):** `AnalistaExpedientes.jsx`, `ChatIA.jsx`, `EstrategiaInterrogatorio.jsx`, `GeneradorAlegatos.jsx`, `PanelExpertos.jsx`, `SimuladorJuicios.jsx`, `PredictorJudicial.jsx`, `RedactorEscritos.jsx`, `ResumenEjecutivo.jsx`, `SignupPage.jsx`.

**Solución:** añadir el import y la línea:

```jsx
import IADisclaimerBanner from '../components/IADisclaimerBanner';
// …
<IADisclaimerBanner className="mb-2" compact />
```

### 4.4 `logRAGQuery` no emite hash de la consulta

**Síntoma:** el log no incluye `consultaHash` (LPDP).

**Causa:** `ragMiddleware.js` solo llama a `logAudit('RAG_CONTEXT_INJECTED', {...})` que **no** hashea la consulta (registra el path y metadatos agregados, no el texto).

**Solución:** integrar `logRAGQuery()` (definido en `legalpro-app/server/utils/rag-observability.js`) que usa `hashConsulta()` con SHA-256 truncado a 16 chars hex. La función rechaza consultas vacías con `TypeError`.

---

## 5. Problemas de seguridad

### 5.1 Posible prompt injection en `/api/ai/jurisprudencia`

**Síntoma:** log muestra `[SECURITY] Posible prompt injection en /jurisprudencia`. Ver `legalpro-app/server/routes/ai.js:663`.

**Causa:** `promptSanitizer.js` detecta uno de los 16 patrones de inyección sobre la query.

**Triage:**

1. Capturar `X-Correlation-ID` y `userId` del log.
2. Revisar si la organización tiene muchos reportes del mismo usuario (posible abuso).
3. Si es tráfico legítimo, ampliar la lista blanca en `promptSanitizer.js` con revisión de seguridad.

### 5.2 Citación con URL sospechosa

**Síntoma:** `CitacionesPanel.sanitizarUrl()` retorna `null` (filtra protocolos no `http(s)`).

**Causa:** un chunk tiene `metadata.url` con `javascript:`, `data:`, `vbscript:` o `mailto:`. Comportamiento esperado: el panel **no renderiza el enlace**, no es bug.

**Si necesitas auditar:**

```sql
SELECT id, source, metadata
FROM rag_vectors
WHERE metadata->>'url' IS NOT NULL
  AND metadata->>'url' !~* '^https?://';
```

### 5.3 Tenant leak en RAG

**Síntoma:** alerta P1 de `arneses/runbooks/RB-003-tenant-leak.md` indica cruce de datos entre organizaciones.

**Causa:** `rag_vectors` con RLS ON pero una política permisiva. La tabla contiene **normas públicas**, por lo que la política por defecto es de lectura libre; sin embargo, la metadata podría contener `organizationId` accidentalmente.

**Triage:**

1. Inspeccionar la política:

   ```sql
   SELECT polname, polcmd, polqual
   FROM pg_policy
   WHERE polrelid = 'rag_vectors'::regclass;
   ```

2. Verificar que ningún chunk contenga `metadata.organizationId` o PII:

   ```sql
   SELECT id, source, metadata
   FROM rag_vectors
   WHERE metadata ? 'organizationId'
      OR metadata ? 'dni'
      OR metadata ? 'ruc'
      OR metadata->>'content' ILIKE '%@%';
   ```

3. Si hay PII, purgarla con `UPDATE rag_vectors SET metadata = metadata - 'organizationId' WHERE ...;` y notificar al equipo LPDP (canal `#lpdp`).

---

## 6. Diagnóstico rápido (comandos copy-paste)

```powershell
# === Variables de entorno (ajustar) ===
$env:DATABASE_URL  = "postgresql://legalpro_node:****@host:5432/legalpro"
$env:OPENAI_API_KEY = "sk-..."
$env:REDIS_URL      = "redis://host:6379"

# === Verificar schema y datos ===
psql $env:DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql $env:DATABASE_URL -c "SELECT source, COUNT(*) FROM rag_vectors GROUP BY source ORDER BY 2 DESC;"
psql $env:DATABASE_URL -c "SELECT COUNT(*) FILTER (WHERE metadata->>'url' IS NULL) AS sin_url, COUNT(*) AS total FROM rag_vectors;"

# === Verificar embeddings ===
psql $env:DATABASE_URL -c "SELECT id, source, array_length(string_to_array(embedding::text, ','), 1) AS dims FROM rag_vectors LIMIT 3;"

# === Retrieval directo ===
node tools/rag/retrieve.mjs "plazo para contestar demanda civil"
node tools/rag/retrieve.mjs "tasa IGV restaurantes 2026"

# === Wrapper con cache ===
node tools/rag/junior-rag-wrapper.mjs "plazo prescripción civil" civil
node tools/rag/junior-rag-wrapper.mjs "habeas corpus plazo razonable" constitucional

# === Métricas ===
node tools/rag/metrics.mjs 1    # últimas 24 h
node tools/rag/metrics.mjs 7    # últimos 7 días
node tools/rag/metrics.mjs 30   # últimos 30 días

# === Costos ===
node tools/rag/cost-analysis.mjs

# === Stress test ===
node tools/rag/stress-test.mjs --users=50 --reqs=200 --duration=60 --warmup=10

# === Cache Redis ===
redis-cli -u $env:REDIS_URL KEYS "rag:cache:*" | Select-Object -First 5
redis-cli -u $env:REDIS_URL INFO memory | Select-String used_memory_human

# === Verificar logs RAG ===
Get-ChildItem logs/rag-updates/*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 5
```

---

## 7. Inventario de errores por stack

| Stack | Mensaje típico | Archivo | Acción |
|---|---|---|---|
| RAG | `No embedding provider configured` | `tools/rag/index-corpus.mjs:174` | Configurar `OPENAI_API_KEY` o `GEMINI_API_KEY`. |
| RAG | `DATABASE_URL not configured` | `tools/rag/retrieve.mjs:84` | Definir `DATABASE_URL`. |
| RAG | `consulta debe tener al menos 5 caracteres` | `tools/rag/junior-rag-wrapper.mjs:128` | El cliente envió query < 5 chars. |
| RAG | `⚠️ No se encontró base legal específica` | `tools/rag/junior-rag-wrapper.mjs:158` | Reformular o ampliar corpus. |
| RAG | `[redis-cache] ioredis no disponible, fallback a memoria` | `tools/rag/redis-cache.mjs:91` | Instalar `ioredis` o verificar `REDIS_URL`. |
| Node | `Error: RAG_CONTEXT_INJECTED audit log failed (non-critical)` | `legalpro-app/server/middleware/ragMiddleware.js:97` | Verificar tabla `audit_log`. No bloquea la respuesta (fail-open). |
| Node | `403 TRANSFERENCIA_INTERNACIONAL_REQUIRED` | `legalpro-app/server/utils/iaTransferenciaGuard.js` | Aceptar consentimiento en `/perfil` (LPDP Art. 21). |
| Node | `402 INSUFFICIENT_CREDITS` | `legalpro-app/server/routes/ai.js:204` | Recargar gemas en `/creditos`. |
| Node | `429 Too Many Requests` | `legalpro-app/server/middleware/minimaxLimiter` | Rate limit alcanzado; esperar y reintentar. |
| Catálogo | `❌ Error parseando <archivo>.json` | `tools/rag/index-corpus.mjs:272` | Validar JSON con `jq . catalogs/<archivo>.json`. |
| Catálogo | `⚠️ No encontrado: <archivo>.json` | `tools/rag/index-corpus.mjs:262` | Verificar ruta y `CONFIG.sources`. |

---

## 8. Procedimientos operativos (runbooks resumidos)

### 8.1 Re-indexar el corpus completo

```powershell
# 1. Snapshot
& tools/railway/legalpro-ops.ps1 backup

# 2. Re-indexar
node tools/rag/index-corpus.mjs

# 3. Validar
psql $env:DATABASE_URL -c "SELECT source, COUNT(*) FROM rag_vectors GROUP BY source ORDER BY 1;"
node tools/rag/metrics.mjs 1
```

`index-corpus.mjs` es idempotente (`ON CONFLICT (id) DO UPDATE`).

### 8.2 Invalidar cache de RAG

```powershell
# Manualmente vía wrapper (preferido en staging)
# Editar tools/rag/redis-cache.mjs y exponer un endpoint admin, o:

# Desde psql + redis-cli
$keys = redis-cli -u $env:REDIS_URL KEYS "rag:cache:*"
$keys | ForEach-Object { redis-cli -u $env:REDIS_URL DEL $_ }

# O reiniciar la app (cache en memoria se purga solo, el distribuido requiere DEL)
```

### 8.3 Rotar API key de OpenAI / Gemini

```powershell
# 1. Crear nueva API key en el proveedor
# 2. Setear variable en Railway
& tools/railway/legalpro-ops.ps1 env set OPENAI_API_KEY "sk-..."
# 3. Redeploy
& tools/railway/legalpro-ops.ps1 redeploy
# 4. Verificar
node tools/rag/retrieve.mjs "habeas corpus"
# 5. Revocar la key anterior en el proveedor
```

### 8.4 Bajar el servicio de RAG temporalmente

Si necesitas operar sin RAG (por ejemplo, durante una migración grande del corpus):

```powershell
& tools/railway/legalpro-ops.ps1 env set ENABLE_RAG false
& tools/railway/legalpro-ops.ps1 redeploy

# El middleware será no-op y los endpoints IA devolverán respuesta sin citaciones.
# Anunciar a usuarios por #status y actualizar docs/USER_GUIDE_RAG.md § 7.4.

# Reactivar
& tools/railway/legalpro-ops.ps1 env set ENABLE_RAG true
& tools/railway/legalpro-ops.ps1 redeploy
```

---

## 9. Escalamiento y contactos

| Severidad | Condición | SLA respuesta | Canal | Runbook |
|---|---|---|---|---|
| P0 | LPDP breach / tenant leak / RAG expone PII | < 15 min | `#lpdp` + email CISO + ANPDP en ≤ 5 días hábiles | `arneses/runbooks/RB-003-tenant-leak.md` |
| P1 | PostgreSQL o Supabase caído | < 15 min | `#ops` + `#status` | `arneses/runbooks/RB-006-pg-down.md`, `RB-007-supabase-outage.md` |
| P1 | `citation_accuracy < 0.98` | < 15 min | `#security` | (interno) |
| P1 | Migración fallida durante re-index | < 30 min | `#ops` | `arneses/runbooks/RB-009-migration-failed.md` |
| P2 | `hallucination_rate >= 0.02` | < 1 h | `#ops` | § 4.2 |
| P2 | p95 ≥ 6 000 ms (2× SLO) | < 30 min | `#ops` | § 3 |
| P2 | 5xx ≥ 0.1 % en endpoints IA | < 30 min | `#ops` | `arneses/runbooks/RB-001-5xx-spike.md` |
| P3 | Costo promedio ≥ USD 0.10 | < 4 h | `#ops` + `@AuditorCostIA` | `docs/MONITORING_RAG.md` |
| P3 | precision/recall < umbral | < 4 h | `#ops` | `docs/MONITORING_RAG.md` |

Plantillas de incidente, post-mortem y triage básico en `docs/MONITORING_RAG.md` § Triage básico.

---

## 10. Checklist post-incidente

```text
[ ] Restaurar servicio (rollout, rollback, fix).
[ ] Confirmar métricas SLO dentro de umbrales durante al menos 2 ventanas.
[ ] Documentar causa raíz en runbook correspondiente.
[ ] Actualizar `docs/RAG_TROUBLESHOOTING.md` si se descubrió un modo de fallo nuevo.
[ ] Notificar cierre a #ops y #status.
[ ] Si LPDP, notificar cierre a #lpdp y DPO.
[ ] Programar post-mortem si fue P0/P1.
```
