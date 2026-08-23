# SLO / SLA — Catálogo canónico

> Catálogo único de Service Level Objectives (SLOs) y Service Level Agreements (SLAs).

## SLOs Globales

| SLO | Target | Ventana | Medición | Alerta |
|---|---|---|---|---|
| **Availability** | 99.9% (43 min downtime/mes) | Mensual | Uptime monitor | <99.5% en 24h |
| **Latency p95** (no IA) | < 500ms | 1h | APM | > 750ms sostenido |
| **Latency p99** (no IA) | < 1s | 1h | APM | > 1.5s sostenido |
| **Latency p95** (con IA) | < 3s | 1h | APM | > 5s sostenido |
| **Latency p99** (con IA) | < 5s | 1h | APM | > 8s sostenido |
| **Error rate 5xx** | < 0.1% | 1h | APM | > 0.5% en 5min |
| **Error rate 4xx** (no auth) | < 5% | 1h | APM | > 10% en 1h |
| **Saturation CPU** | < 70% avg | 1h | Prometheus | > 85% en 5min |
| **Saturation RAM** | < 80% avg | 1h | Prometheus | > 90% en 5min |
| **DB connections** | < 80% pool | 1h | Prometheus | > 90% en 5min |
| **IA quota usage** | < 80% plan | Mensual | Cost IA | > 90% |
| **Cold start** | < 5s | Por deploy | APM | > 10s |

## SLOs por Endpoint (no IA)

| Endpoint | p95 | p99 | Error rate |
|---|---|---|---|
| `POST /api/auth/login` | 400ms | 800ms | < 0.2% |
| `POST /api/auth/register` | 600ms | 1.2s | < 0.5% |
| `POST /api/auth/refresh` | 200ms | 400ms | < 0.1% |
| `GET /api/auth/me` | 200ms | 400ms | < 0.1% |
| `GET /api/expedientes` | 400ms | 800ms | < 0.1% |
| `POST /api/expedientes` | 500ms | 1s | < 0.3% |
| `GET /api/expedientes/:id` | 300ms | 600ms | < 0.1% |
| `PUT /api/expedientes/:id` | 400ms | 800ms | < 0.3% |
| `DELETE /api/expedientes/:id` | 400ms | 800ms | < 0.3% |
| `GET /api/documentos` | 400ms | 800ms | < 0.1% |
| `POST /api/documentos/upload` | 2s | 4s | < 0.5% |
| `GET /api/organizaciones/me` | 200ms | 400ms | < 0.1% |
| `GET /api/organizaciones/members` | 300ms | 600ms | < 0.1% |
| `POST /api/organizaciones/invite` | 500ms | 1s | < 0.3% |
| `GET /api/mis-datos` | 500ms | 1s | < 0.1% (LPDP) |
| `DELETE /api/mis-datos` | 1s | 2s | < 0.3% (LPDP) |
| `GET /health` | 50ms | 100ms | < 0.1% |
| `GET /health/ready` | 100ms | 200ms | < 0.1% |
| `GET /health/live` | 50ms | 100ms | < 0.1% |

## SLOs por Endpoint (con IA)

| Endpoint | p95 | p99 | Error rate | Notas |
|---|---|---|---|---|
| `POST /api/analista` | 5s | 8s | < 1% | Analizar expediente |
| `POST /api/jurisprudencia` | 3s | 5s | < 1% | Buscar jurisprudencia |
| `POST /api/redactor` | 8s | 12s | < 2% | Generar escrito largo |
| `POST /api/predictor` | 4s | 6s | < 1% | Predecir resultado |
| `POST /api/chat` | 3s | 5s | < 1% | Chat streaming |
| `POST /api/consulta` | 3s | 5s | < 1% | Consulta puntual |
| `POST /api/alegatos` | 6s | 10s | < 2% | Generar alegato |
| `POST /api/interrogatorio` | 5s | 8s | < 1% | Plan de interrogatorio |
| `POST /api/objeciones` | 3s | 5s | < 1% | Sugerir objeción |
| `POST /api/casos-criticos` | 4s | 6s | < 1% | Identificar críticos |
| `POST /api/resumen` | 3s | 5s | < 1% | Resumen ejecutivo |
| `POST /api/comparador` | 5s | 8s | < 1% | Comparar precedentes |
| `POST /api/retroalimentacion` | 5s | 8s | < 1% | Reporte feedback |
| `POST /api/multidoc` | 8s | 12s | < 2% | OCR + análisis |
| `POST /api/boveda` | 2s | 4s | < 0.5% | Custodia |
| `POST /api/sinoe` | 2s | 4s | < 0.5% | Consultar SINOE |

## SLOs Android

| SLO | Target | Ventana | Medición |
|---|---|---|---|
| **Cold start** | < 2s | Por sesión | Firebase Performance |
| **APK size** | < 50 MB | Por release | Play Console |
| **Crash-free users** | > 99.5% | Semanal | Firebase Crashlytics |
| **API p95** | < 1s | 1h | Sentry |
| **Offline support** | 100% lectura, 0% escritura | Por feature | manual |

## SLOs Frontend (Web)

| SLO | Target | Ventana | Medición |
|---|---|---|---|
| **LCP** (Largest Contentful Paint) | < 2.5s | Por visita | Lighthouse / Web Vitals |
| **FID** (First Input Delay) | < 100ms | Por visita | Lighthouse / Web Vitals |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Por visita | Lighthouse / Web Vitals |
| **TTFB** | < 600ms | Por visita | Lighthouse |
| **Bundle main chunk** | < 300kb gz | Por release | rollup-plugin-visualizer |
| **Lighthouse score** | > 90 | Por release | Lighthouse CI |
| **WCAG 2.1 AA** | 100% sin críticos | Por release | axe-core |
| **Uptime** | 99.9% | Mensual | uptime-synthetics |

## SLOs de Costos IA

| SLO | Target | Ventana | Plan |
|---|---|---|---|
| **Costo mensual IA** | < S/ 1000 | Mensual | Pro (cualquier org) |
| **Costo por request IA** | < $0.10 | Mensual | avg |
| **Costo FREE tier** | < S/ 50 | Mensual | FREE |
| **Costo ENTERPRISE** | < S/ 5000 | Mensual | ENTERPRISE |

## Alertas

| Evento | Severidad | Canal | Responsable |
|---|---|---|---|
| Availability < 99.5% en 24h | P1 | Slack #ops + on-call | @SRE |
| Latency p95 > 2x SLO en 5min | P1 | Slack #ops + on-call | @SRE |
| Error rate 5xx > 1% en 5min | P1 | Slack #ops + on-call | @SRE |
| IA quota > 90% | P2 | Slack #ops | @SRE + @AuditorCostIA |
| Costo IA > 1.5x plan | P2 | Slack #ops | @SRE + @AuditorCostIA |
| TENANT_VIOLATION detectado | P1 | Slack #security + email CTO | @AuditorMultiTenant |
| BRUTE_FORCE_DETECTED | P1 | Slack #security + bloqueo | @AuditorSeguridad |
| LPDP_BREACH_SUSPECTED | P0 | Slack #lpdp + email CISO + ANPDP | @GobernanzaChief + @AuditorLPDP |
| Deploy failure | P2 | Slack #ops | @SRE + @DevOps |
| Migration failure | P1 | Slack #ops + rollback auto | @SRE + @Database |
| IA model deprecation | P3 | Slack #ops | @PromptEngineer |

## Compromisos con Usuarios (SLAs contractuales)

| Plan | Availability | Latency p95 | Costo IA | Soporte |
|---|---|---|---|---|
| FREE | 99.5% (best effort) | < 1s | < S/ 50/mes | Community |
| PRO | 99.9% garantizado | < 500ms | < S/ 1000/mes | Email 24h |
| ENTERPRISE | 99.95% garantizado + SLA penal | < 300ms | < S/ 5000/mes | Slack dedicado + on-call 1h |

## Revisión

- SRE revisa SLOs mensualmente
- GobernanzaChief firma SLAs contractuales
- AuditorPerformance valida mensualmente
