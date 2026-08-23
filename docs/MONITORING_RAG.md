# Monitoring RAG - LegalPro

## Objetivo

Monitorear la calidad, rendimiento, costo y seguridad del sistema RAG. Toda consulta debe emitir un evento estructurado `RAG_QUERY`, usar `X-Correlation-ID` y evitar almacenar el texto original de la consulta. El logger conserva únicamente un hash SHA-256 truncado para correlación técnica sin exponer PII.

## SLO y métricas obligatorias

| Métrica | Umbral | Fuente |
|---|---:|---|
| `retrieval_precision_at_k` | >= 0.85 | evaluación RAG / `rag_audit_log` |
| `retrieval_recall_at_k` | >= 0.90 | evaluación RAG / `rag_audit_log` |
| `citation_accuracy` | >= 0.98 | verificador de citas / `rag_audit_log` |
| `hallucination_rate` | < 0.02 | validador RAG / `rag_audit_log` |
| `context_relevance_score` | >= 0.80 | evaluación RAG / `rag_audit_log` |
| `answer_relevance_score` | >= 0.85 | evaluación RAG / `rag_audit_log` |
| Latencia p95 | < 3000 ms | `latency_ms` |
| Costo promedio | < USD 0.10/request | proveedor IA / `costo_usd` |

La tabla `rag_audit_log` debe exponer las columnas consultadas por `tools/rag/metrics.mjs`, incluyendo las métricas de calidad. Los valores de precisión, recall, accuracy, alucinación y relevancia se almacenan en escala `0..1`.

## Comandos

```bash
# Reporte diario/semanal
node tools/rag/metrics.mjs 7

# Reporte mensual
node tools/rag/metrics.mjs 30

# La salida no cero indica una métrica degradada o sin datos
node tools/rag/metrics.mjs 1
```

En CI o cron, el código de salida `1` debe integrarse con Alertmanager, Sentry o el proveedor de guardia. No se recomienda usar correo local como único canal de alerta.

## Logging y privacidad

`legalpro-app/server/utils/rag-observability.js` registra:

- usuario y organización para auditoría multi-tenant;
- `correlationId`, propagado desde `X-Correlation-ID`;
- materia, proveedor, chunks, citas, latencia y costo;
- métricas de retrieval y relevancia cuando estén disponibles;
- hash de la consulta; nunca la consulta en texto claro;
- resultado de verificación de citas y detección de alucinaciones.

No deben incluirse prompts, respuestas, expedientes, DNI, nombres, tokens ni secretos en logs o etiquetas de métricas. `organizationId` se admite en logs de auditoría, pero en métricas Prometheus debe evitarse como label por su alta cardinalidad.

## Alertas

| Severidad | Condición | Ventana sugerida | Acción |
|---|---|---|---|
| P1 | posible tenant leak o exposición LPDP | inmediata | responder en < 15 min, aislar tráfico y activar incidente |
| P1 | PostgreSQL/Supabase indisponible | 2 min | verificar `/health/ready`, failover y proveedor |
| P2 | `hallucination_rate >= 0.02` | 15 min | revisar corpus, prompt y validador; considerar degradación segura |
| P2 | `citation_accuracy < 0.98` | 15 min | bloquear respuestas no verificadas y revisar citas |
| P2 | p95 >= 6000 ms (2x SLO) | 10 min | inspeccionar trazas por proveedor y materia |
| P2 | error rate 5xx >= 0.1% | 5 min | revisar deploy, dependencias y saturación |
| P3 | costo promedio >= USD 0.10 | 1 h | revisar tokens, top-k, caché y proveedor |
| P3 | precision/recall/relevancia bajo umbral | 1 h | ejecutar eval-set y revisar indexación |

Toda alerta requiere triage. Los incidentes P1/P2 requieren post-mortem y actualización del runbook correspondiente.

## Dashboard sugerido

### Sentry / OpenTelemetry

- Transaction: `rag.query`.
- Spans: `rag.embedding`, `rag.vector_search`, `rag.rerank`, `rag.generation`, `rag.citation_validation`.
- Tags de baja cardinalidad: `materia`, `proveedor_embeddings`, `status`.
- Contexto de traza: `correlation_id` y `organization_id` solo en contexto seguro de auditoría.
- Métricas: `latency_ms`, `chunks_usados`, `citaciones_verificadas`, costo y scores de calidad.

### Grafana

1. Latencia p50/p95/p99 total y por materia/proveedor.
2. Tasa de consultas, errores y organizaciones activas.
3. Precision@k, recall@k y relevancia de contexto/respuesta.
4. Citation accuracy y hallucination rate por materia.
5. Costo total y promedio por proveedor; desglose por organización en vistas de acceso restringido.
6. Saturación de Node/PostgreSQL: CPU, RAM, pool de conexiones y queries lentas.
7. Estado de `/health`, `/health/ready` y `/health/live` por separado.

## Triage básico

1. Confirmar el alcance temporal, materias, organizaciones y proveedor afectados.
2. Buscar la traza con `X-Correlation-ID` sin copiar datos personales a canales de incidente.
3. Comparar con deploys, migraciones, cambios de corpus y estado de proveedores.
4. Mitigar: caché, reducción de top-k, cambio de proveedor o respuesta segura sin base normativa.
5. Verificar recuperación durante al menos dos ventanas de evaluación.
6. Documentar causa, impacto, línea de tiempo y acciones preventivas.
