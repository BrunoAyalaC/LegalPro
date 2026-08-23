# Makefile — ops/ (observability)
# Atajos para validar y desplegar dashboards/alertas.
# Uso: make -f ops/Makefile <target>

SHELL := pwsh.exe
.SHELLFLAGS := -NoProfile -Command

GRAFANA_URL  ?= https://grafana.legalpro.app
GRAFANA_TOKEN ?= $(GRAFANA_TOKEN)
SENTRY_ORG   ?= legalpro

.PHONY: help
help:
	@Write-Host "Targets disponibles:"; `
	  Write-Host "  validate    - Valida JSON/YAML de dashboards y alertas"; `
	  Write-Host "  test        - Smoke test del traductor YAML -> Sentry payload"; `
	  Write-Host "  grafana     - Importa el dashboard a Grafana"; `
	  Write-Host "  sentry      - Sincroniza los Monitors a Sentry (idempotente)"; `
	  Write-Host "  sentry-dry  - Misma operacion, --dry-run"; `
	  Write-Host "  promtool    - Valida reglas con promtool"

.PHONY: validate
validate:
	@Write-Host ">> Validando Grafana JSON..."; `
	  node -e "JSON.parse(require('fs').readFileSync('ops/grafana/rag-dashboard.json','utf8'))"; `
	  Write-Host "OK grafana dashboard JSON"; `
	  Write-Host ">> Validando Sentry YAML..."; `
	  node --input-type=module -e "import('yaml').then(async ({parse})=>{const {readFileSync}=await import('node:fs');const cfg=parse(readFileSync('ops/sentry/rag-alerts.yml','utf8'));console.log('OK sentry',cfg.monitors.length,'monitors');})"; `
	  Write-Host ">> Validando Prometheus YAML..."; `
	  node --input-type=module -e "import('yaml').then(async ({parse})=>{const {readFileSync}=await import('node:fs');const cfg=parse(readFileSync('ops/prometheus/rag-rules.yml','utf8'));console.log('OK prometheus',cfg.groups.length,'groups,',cfg.groups.reduce((s,g)=>s+(g.rules||[]).length,0),'rules');})"

.PHONY: test
test:
	@Write-Host ">> Smoke test traductor Sentry..."; `
	  node --input-type=module -e "import('./ops/scripts/sync-sentry-alerts.mjs').then(async ({toSentryMonitor})=>{const {readFileSync}=await import('node:fs');const {parse}=await import('yaml');const cfg=parse(readFileSync('ops/sentry/rag-alerts.yml','utf8'));let ok=0;for(const m of cfg.monitors){const p=toSentryMonitor(m,cfg.sentry_integrations);if(!p.name||!p.query||p.threshold===undefined)throw new Error('fail '+m.name);ok++}console.log('OK',ok,'monitors translated');})"

.PHONY: sentry
sentry:
	@node ops/scripts/sync-sentry-alerts.mjs --config ops/sentry/rag-alerts.yml

.PHONY: sentry-dry
sentry-dry:
	@node ops/scripts/sync-sentry-alerts.mjs --config ops/sentry/rag-alerts.yml --dry-run

.PHONY: grafana
grafana:
	@if (-not (Test-Path env:GRAFANA_TOKEN)) { Write-Host "ERROR: GRAFANA_TOKEN no definido"; exit 2 }; `
	  curl.exe -X POST "$(GRAFANA_URL)/api/dashboards/db" `
	    -H "Authorization: Bearer $$env:GRAFANA_TOKEN" `
	    -H "Content-Type: application/json" `
	    -d "@ops/grafana/rag-dashboard.json"

.PHONY: promtool
promtool:
	@if (-not (Get-Command promtool -ErrorAction SilentlyContinue)) { Write-Host "promtool no instalado. Instalar: https://prometheus.io/docs/prometheus/latest/commandline/promtool/"; exit 2 }; `
	  promtool check rules ops/prometheus/rag-rules.yml
