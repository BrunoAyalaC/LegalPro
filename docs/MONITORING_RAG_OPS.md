# Monitoring & Alertas RAG en Producción

> **SRE Owner:** @sre · **Última actualización:** 2026-08-01 · **Versión:** 1.0.0
>
> Este documento describe **cómo operar** los dashboards y alertas del sistema RAG en producción.
> Para la **estrategia de monitoreo** (qué métricas y por qué), ver `docs/MONITORING_RAG.md`.
> Para los **SLOs y umbrales canónicos**, ver `catalogs/sla-slo.md`.
> Para los **runbooks de triage**, ver `arneses/runbooks/`.

---

## 1. Stack de Observabilidad

| Componente | Función | Endpoint | Cómo se carga |
|------------|---------|----------|---------------|
| **Grafana** | Dashboards operativos + SLO | `https://grafana.legalpro.app` | Importar `ops/grafana/rag-dashboard.json` |
| **Sentry** | APM + alertas (Monitors) | `https://sentry.io/legalpro` | `ops/scripts/sync-sentry-alerts.mjs` (idempotente) |
| **Prometheus** | Métricas time-series | `https://prometheus.legalpro.app` | `rule_files: ops/prometheus/rag-rules.yml` |
| **Alertmanager** | Routing de alertas | interno | Recibe de Prometheus y de Sentry webhooks |
| **PostgreSQL** | Fuente primaria (rag_audit_log) | via `DATABASE_URL` | Grafana PostgreSQL datasource `legalpro-rag` |
| **OpenTelemetry** | Trazas distribuidas | `OTEL_EXPORTER_OTLP_ENDPOINT` | SDK Node ya integrado (`server/sentry.js` + logger) |

### Diagrama de flujo

```
┌──────────────┐      logRAGQuery()       ┌──────────────────┐
│  legalpro-   │ ────────────────────────►│  rag_audit_log   │
│  app (Node)  │  tools/rag/metrics.mjs   │  + vistas        │
│  / .NET      │ ───────────────┐         │  (PostgreSQL)    │
└──────┬───────┘                │         └────────┬─────────┘
       │ OTel spans             │                  │
       ▼                        ▼                  ▼
┌──────────────┐         ┌──────────────┐    ┌──────────────┐
│   Sentry     │         │  Prometheus  │    │   Grafana    │
│  (errors +   │         │  /metrics    │    │  (PostgreSQL │
│   APM)       │         │  (recording) │    │  datasource) │
└──────┬───────┘         └──────┬───────┘    └──────────────┘
       │                        │
       ▼                        ▼
  ┌────────────────────────────────┐
  │       Alertmanager             │
  │  Slack / PagerDuty / Email     │
  └────────────────────────────────┘
```

---

## 2. Dashboards Críticos

### 2.1. RAG Dashboard (`legalpro-rag-v1`)

| Campo | Valor |
|-------|-------|
| Path | `ops/grafana/rag-dashboard.json` |
| UID | `legalpro-rag-v1` |
| Refresh | 30s |
| Time default | `now-24h` |
| Tags | `legalpro`, `rag`, `production`, `sre` |
| URL | `https://grafana.legalpro.app/d/legalpro-rag-v1` |

**Paneles (11 en total):**

| # | Panel | Tipo | Fuente | Métrica clave |
|---|-------|------|--------|---------------|
| 1 | Consultas RAG / hora | timeseries | `rag_audit_log` | `COUNT(*)` por hora |
| 2 | Latencia p50/p95/p99 | timeseries | `rag_audit_log` | `PERCENTILE_CONT` con umbral SLO 3s |
| 3 | Cache Hit Rate | gauge | `rag_audit_log` | `cache_hit` ratio |
| 4 | Costo IA por hora | timeseries | `rag_audit_log` | `SUM(costo_usd)` |
| 5 | Distribución `cache_layer` | piechart | `rag_audit_log` | redis / memory / none |
| 6 | Citaciones baja confianza | timeseries | `rag_audit_log` | `similitud_promedio < 0.60` |
| 7 | Top 10 Materias | table | `rag_audit_log` | agregados por materia |
| 8 | Top baja similitud (24h) | table | `v_rag_top_low_confidence` | drill-down por materia/hora |
| 9 | Alucinaciones 24h | stat | `rag_audit_log` | `COUNT(WHERE alucinaciones_detectadas > 0)` |
| 10 | Retrieval latency p95 | timeseries | `rag_audit_log` | `PERCENTILE_CONT(0.95) retrieval_latency_ms` |
| 11 | Costo diario vs plan | timeseries | `rag_audit_log` | `SUM(costo_usd) BY organization_id, day` |

**Variables:**
- `DS_POSTGRES` (datasource) — apunta al PostgreSQL de LegalPro.
- `organization_id` (query, multi-tenant) — filtra por tenant. Por defecto `All`.

**Cómo importar el dashboard:**

```bash
# Opción 1: UI Grafana → "+" → Import → Upload JSON
# Opción 2: API
curl -X POST "https://grafana.legalpro.app/api/dashboards/db" \
  -H "Authorization: Bearer $GRAFANA_TOKEN" \
  -H "Content-Type: application/json" \
  -d @ops/grafana/rag-dashboard.json
```

### 2.2. Otros dashboards referenciados

| Dashboard | UID | Propósito |
|-----------|-----|-----------|
| SLO Global | `legalpro-slo` | Latencia / error rate / availability global |
| Costos IA | `legalpro-cost-ia` | MRR, costo por tenant, optimización |
| Owner | `legalpro-owner` | Spike de costos por tenant, plan limits |

---

## 3. Alertas — Catálogo completo

### 3.1. Sentry (APM + Issues) — `ops/sentry/rag-alerts.yml`

13 monitors definidos. Severidades:

| Severidad | Count | Tiempo de respuesta |
|-----------|------:|---------------------|
| `critical` | 2 | Página inmediata (< 5min) |
| `high` | 8 | Slack + email < 5min |
| `medium` | 3 | Slack < 30min |

**Monitors críticos (página):**

- `RAG - Hallucinations Detectadas (1)` → PagerDuty `tech-lead-on-call`
- `RAG - PostgreSQL Down (1min)` → PagerDuty `db-on-call`

**Despliegue de las alertas Sentry:**

```bash
export SENTRY_AUTH_TOKEN=sntrys_xxx
export SENTRY_ORG=legalpro
node ops/scripts/sync-sentry-alerts.mjs \
  --config ops/sentry/rag-alerts.yml \
  --dry-run                # quítalo para aplicar
```

### 3.2. Prometheus (métricas RAG) — `ops/prometheus/rag-rules.yml`

3 grupos, 24 reglas (9 recording + 13 alerting + 2 provider).

| Grupo | Reglas | Frecuencia |
|-------|-------:|-----------:|
| `rag_recording_rules` | 9 | 30s |
| `rag_alerts` | 13 | 30s |
| `rag_provider_alerts` | 2 | 60s |

**Validar antes de cargar:**

```bash
promtool check rules ops/prometheus/rag-rules.yml
# Esperado: SUCCESS - 24 rules found
```

**Cargar en Prometheus:**

```yaml
# prometheus.yml
rule_files:
  - /etc/prometheus/rules/*.yml

# O montar el archivo:
# - /opt/legalpro/ops/prometheus/rag-rules.yml
```

### 3.3. Alertas de calidad (cruzadas)

Estas son las alertas que **deben investigarse manualmente** y generan post-mortem:

#### Alucinaciones

1. **Detección:** Prometheus `RAGHallucinationsDetected` (severity `critical`) o Sentry `RAG - Hallucinations Detectadas`.
2. **Triage (< 5 min):**
   - Buscar `correlation_id` en `rag_audit_log`.
   - Revisar manualmente la respuesta.
   - Si supera 1% del tráfico → degradar a "modo seguro" (sin generación libre).
3. **Post-mortem obligatorio** (P0/P1) — crear `arneses/post-mortems/PM-NNN-hallucinacion-*.md`.

#### Baja confianza en citaciones

1. **Detección:** `RAGLowCitationConfidence` (>10% citaciones con similitud < 0.60).
2. **Triage (< 30 min):**
   - Abrir Grafana → panel 8 (Top baja similitud 24h).
   - Identificar materia(s) afectada(s).
   - Revisar `rag_corpus_snapshot` — ¿hubo cambio reciente?
3. **Acciones:**
   - Reindexar corpus si la métrica no se recupera en 24h.
   - Considerar bajar `RAG_THRESHOLD` temporalmente.

#### Cuota de proveedor

1. **Detección:** `RAGProviderQuotaHigh` (>90% de cuota).
2. **Triage:** Revisar consumo por organización → identificar outlier.
3. **Acciones:**
   - Si es legítimo → upgrade de plan.
   - Si es anómalo → activar rate-limit por tenant (ver `quotaMiddleware.js`).

---

## 4. SLO — Service Level Objectives

Referencia canónica: `catalogs/sla-slo.md`. Resumen aplicado al RAG:

| SLO | Target | Ventana | Alerta cuando | Sentry monitor | Prometheus alert |
|-----|--------|---------|---------------|----------------|------------------|
| **Latencia p95** (con IA) | < 3s | 1h | > 3s x 15min | `RAGSLOBreachP95` | `RAGSLOBreachP95` |
| **Latencia p95 crítica** | < 5s | 5min | > 5s x 5min | `RAG - Latencia p95 > 5s` | `RAGHighLatencyP95` |
| **Error rate 5xx** | < 0.1% | 5min | > 1% x 5min | `RAG - Error rate 5xx > 1%` | `RAG5xxSpike` |
| **Citation accuracy** | >= 98% | 1h | < 98% indirecto via baja confianza | (vía Sentry custom) | `RAGLowCitationConfidence` |
| **Hallucination rate** | < 2% | Diario | > 0 absoluto | `RAG - Hallucinations` (critical) | `RAGHallucinationsDetected` (critical) |
| **Retrieval latency p95** | < 1s | 5min | > 1s x 5min | `RAG - pgvector p95 > 1s` | `RAGPgvectorSlow` |
| **Costo diario PRO** | < $9/día | 24h | > $50 (anomaly) | `RAG - Costo diario > $50` | `RAGDailyCostSpike` |
| **Cache hit rate** | >= 60% | 1h | < 30% x 15min | `RAG - Cache Hit Rate < 30%` | `RAGLowCacheHitRate` |
| **Uptime** | 99.9% | Mensual | < 99.5% en 24h | (Status monitor) | `RAGPostgresDown` |

---

## 5. Runbooks de referencia

| Runbook | Cuándo abrirlo |
|---------|----------------|
| `arneses/runbooks/RB-001-5xx-spike.md` | 5xx > 1% sostenido |
| `arneses/runbooks/RB-006-pg-down.md` | PostgreSQL no responde / pgvector lento / Redis caído |
| `arneses/runbooks/RB-009-migration-failed.md` | Deploy + falla de migración |
| `arneses/runbooks/RB-012-cost-ia-spike.md` | Costo IA mensual/anomalía |
| `arneses/runbooks/RB-013-slo-violation.md` | Cualquier SLO breach |

---

## 6. Operación diaria del SRE

### 6.1. Checklist matutino (9:00 AM PET)

- [ ] Revisar dashboard `legalpro-rag-v1` → panel "Alucinaciones 24h" (debe ser 0).
- [ ] Revisar panel "Citaciones baja confianza" → si > 5% sostenido, abrir issue.
- [ ] Revisar panel "Costo diario" → si > $30/día sin justificación, abrir issue.
- [ ] Verificar panel "Distribución cache_layer" → si solo "memory" y "none", Redis está caído.
- [ ] Revisar canal `#legalpro-alerts` → no debería haber alertas sin triagiar.

### 6.2. Revisión semanal (lunes 10:00 AM)

- [ ] Correr `node tools/rag/metrics.mjs 7` y archivar en `reports/weekly/`.
- [ ] Comparar latencia p95 semanal vs. semana anterior (tendencia).
- [ ] Revisar top 5 materias (panel 7) → identificar oportunidades de optimización de corpus.
- [ ] Validar que el `rag_corpus_snapshot` activo tiene `created_by` válido.
- [ ] Revisar `rag_audit_log` retention → `fn_cleanup_old_rag_audit(90)` debe estar corriendo.

### 6.3. Revisión mensual (primer lunes del mes)

- [ ] `node tools/rag/metrics.mjs 30` → reporte completo.
- [ ] Comparar contra SLOs de `catalogs/sla-slo.md`.
- [ ] Calcular error budget consumido.
- [ ] Si se cumplió SLO →表彰 al equipo.
- [ ] Si NO se cumplió → post-mortem y plan correctivo.

---

## 7. Métricas custom requeridas (instrumentación)

> El dashboard Grafana **lee directamente de `rag_audit_log`** (PostgreSQL).
> Las alertas **Prometheus asumen** que el backend exporta las siguientes
> métricas vía prom-client. Si todavía no están, ver §8 "Pendiente".

| Métrica Prometheus | Tipo | Labels | Origen |
|--------------------|------|--------|--------|
| `rag_query_duration_seconds` | histogram | `materia`, `organization_id`, `status` | middleware `ragMiddleware.js` |
| `rag_query_total` | counter | `materia`, `organization_id`, `status` | wrapper `junior-rag-wrapper.mjs` |
| `rag_query_errors_total` | counter | `materia`, `organization_id`, `error_code` | wrapper `junior-rag-wrapper.mjs` |
| `rag_retrieval_duration_seconds` | histogram | `materia` | `tools/rag/retrieve.mjs` |
| `rag_cache_lookups_total` | counter | `cache_layer` (`redis`/`memory`/`none`) | wrapper `junior-rag-wrapper.mjs` |
| `rag_cache_hits_total` | counter | `cache_layer` | wrapper `junior-rag-wrapper.mjs` |
| `rag_cache_redis_up` | gauge | — | healthcheck periódico |
| `rag_cost_usd_total` | counter | `provider`, `model`, `organization_id` | wrapper `junior-rag-wrapper.mjs` |
| `rag_provider_quota_pct` | gauge | `provider`, `model` | job diario de quota |
| `rag_citations_total` | counter | `materia`, `organization_id` | post-procesamiento de citaciones |
| `rag_citations_low_confidence_total` | counter | `materia`, `organization_id` | post-procesamiento de citaciones |
| `rag_hallucinations_total` | counter | `materia`, `organization_id` | validador de alucinaciones |
| `rag_provider_requests_total` | counter | `provider`, `model` | wrapper cliente IA |
| `rag_provider_errors_total` | counter | `provider`, `error_code` | wrapper cliente IA |
| `rag_provider_timeouts_total` | counter | `provider` | wrapper cliente IA |

> **Importante:** `organization_id` es label en métricas **internas de auditoría** (PostgreSQL), pero **NO debería ser label en Prometheus** por cardinalidad (1 serie por tenant activo). Si es estrictamente necesario, aplicar sharding o aggregation rollups.

---

## 8. Pendiente (gap actual)

| # | Pendiente | Owner | Esfuerzo |
|---|-----------|-------|----------|
| 1 | Instrumentar el backend Node con `prom-client` y exportar las métricas listadas en §7 | @BackendNode | M |
| 2 | Crear `ops/scripts/sync-sentry-alerts.mjs` (traductor YAML → Sentry API) | @SRE | S |
| 3 | Montar `rag-rules.yml` en el Prometheus del cluster de producción | @DevOps | S |
| 4 | Configurar Alertmanager routing (Slack, PagerDuty) | @DevOps | S |
| 5 | Configurar la integración de Sentry con Slack + PagerDuty + email | @SRE | S |
| 6 | Crear dashboard `legalpro-rag-cost-ia` con breakdown por tenant | @SRE + @PlataformaFinanzas | M |
| 7 | Crear dashboard `legalpro-slo` con error budget tracking | @SRE | M |
| 8 | Implementar RAG eval-set semanal (precision/recall) | @PromptEngineer | M |

---

## 9. Compliance y Privacidad

- **LPDP (Ley 29733)**: las métricas Prometheus y Sentry **NO deben incluir** PII.
  La auditoría detallada vive en `rag_audit_log` (PostgreSQL con RLS).
- **Multi-tenant**: Grafana filtra por `organization_id` para que un admin
  de un tenant no vea métricas de otros.
- **Retención**: `rag_audit_log` se purga a 90 días vía `fn_cleanup_old_rag_audit()`.
  Métricas Prometheus se retienen según configuración de TSDB (default 15 días).
- **Access logs**: el acceso al dashboard queda auditado en Grafana audit log
  y se replica a `audit_log` (PostgreSQL).

---

## 10. Referencias

- Estrategia de monitoreo RAG: [`docs/MONITORING_RAG.md`](./MONITORING_RAG.md)
- Catálogo SLO/SLA: [`catalogs/sla-slo.md`](../catalogs/sla-slo.md)
- Catálogo de eventos: [`catalogs/audit-events.json`](../catalogs/audit-events.json)
- Variables de entorno: [`catalogs/env-vars.md`](../catalogs/env-vars.md)
- Auditoría RAG (queries SQL): [`tools/rag/metrics.mjs`](../tools/rag/metrics.mjs)
- Tablas RAG (schema): [`tools/migrations/2026-08-01-rag-audit-tables.sql`](../tools/migrations/2026-08-01-rag-audit-tables.sql)
- Middleware RAG (instrumentación): [`legalpro-app/server/middleware/ragMiddleware.js`](../legalpro-app/server/middleware/ragMiddleware.js)
- Observabilidad RAG (logger): [`legalpro-app/server/utils/rag-observability.js`](../legalpro-app/server/utils/rag-observability.js)
- Inicialización Sentry: [`legalpro-app/server/sentry.js`](../legalpro-app/server/sentry.js)
- Reporte de investigación RAG: [`REPORTE_INVESTIGACION_RAG_2026.md`](../REPORTE_INVESTIGACION_RAG_2026.md)

---

**Mantenido por @sre.** Cambios requieren sign-off de @SRE + @PlataformaFinanzas
(alertas de costo) + @GobernanzaChief (cumplimiento LPDP).
