# ops/ — Observability & Operations

Configuración declarativa de dashboards, alertas y runbooks del sistema RAG de LegalPro.

## Estructura

```
ops/
├── grafana/
│   └── rag-dashboard.json       # Dashboard RAG (11 paneles, multi-tenant)
├── sentry/
│   └── rag-alerts.yml            # 13 Monitors Sentry (APM + custom metrics)
├── prometheus/
│   └── rag-rules.yml             # 9 recording + 13 alerting + 2 provider rules
└── scripts/
    └── sync-sentry-alerts.mjs    # Sincronizador idempotente YAML → Sentry API
```

## Comandos rápidos

### Validar sintaxis local

```bash
# Grafana dashboard (JSON Schema)
node -e "JSON.parse(require('fs').readFileSync('ops/grafana/rag-dashboard.json','utf8'))" && echo OK

# Prometheus rules
promtool check rules ops/prometheus/rag-rules.yml

# Sentry alerts (YAML + traductor)
node --input-type=module -e "
import { toSentryMonitor } from './ops/scripts/sync-sentry-alerts.mjs';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
const cfg = parse(readFileSync('ops/sentry/rag-alerts.yml','utf8'));
for (const m of cfg.monitors) toSentryMonitor(m, cfg.sentry_integrations);
console.log('OK', cfg.monitors.length, 'monitors');
"
```

### Desplegar en producción

```bash
# 1. Grafana — importar dashboard
curl -X POST "https://grafana.legalpro.app/api/dashboards/db" \
  -H "Authorization: Bearer $GRAFANA_TOKEN" \
  -H "Content-Type: application/json" \
  -d @ops/grafana/rag-dashboard.json

# 2. Sentry — sincronizar Monitors (idempotente)
export SENTRY_AUTH_TOKEN=sntrys_xxx
export SENTRY_ORG=legalpro
node ops/scripts/sync-sentry-alerts.mjs --config ops/sentry/rag-alerts.yml

# 3. Prometheus — montar reglas
# Copiar a /etc/prometheus/rules/ en el servidor y reiniciar prometheus.
# O montar como ConfigMap en k8s (futuro).
scp ops/prometheus/rag-rules.yml prometheus.legalpro.app:/etc/prometheus/rules/
ssh prometheus.legalpro.app 'killall -HUP prometheus'
```

## Documentación

- **Estrategia de monitoreo:** [`../docs/MONITORING_RAG.md`](../docs/MONITORING_RAG.md)
- **Operación diaria (SRE):** [`../docs/MONITORING_RAG_OPS.md`](../docs/MONITORING_RAG_OPS.md)
- **SLO/SLA canónico:** [`../catalogs/sla-slo.md`](../catalogs/sla-slo.md)
- **Runbooks:** [`../arneses/runbooks/`](../arneses/runbooks/)

## Convenciones

- **Nombres de alerta**: `RAG - <síntoma> (<ventana>)` en Sentry;
  `RAG<SíntomaPascalCase>` en Prometheus.
- **Severidades** (alineadas con `sla-slo.md`):
  - `critical` → página on-call (P0/P1)
  - `high` → Slack + email < 5min (P1)
  - `medium` → Slack < 30min (P2)
  - `low` → Slack digest diario (P3)
- **Runbook siempre presente** en cada alerta vía `runbook_url` (Prometheus)
  o `runbook:` (Sentry).

## Mantenimiento

- Cambios en este directorio → PR con sign-off de **@sre**.
- Cambios en alertas de costo → sign-off de **@PlataformaFinanzas**.
- Cambios en LPDP/privacidad → sign-off de **@GobernanzaChief** + **@AuditorLPDP**.
