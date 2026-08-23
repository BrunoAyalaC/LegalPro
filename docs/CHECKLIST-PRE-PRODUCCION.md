# ✅ Checklist Pre-Producción Web

> **Generado por**: @release-manager + @arquitecto-chief + @gobernanza-chief
> **Fecha**: 2026-06-12
> **Estado**: Pendiente - bloqueo para producción

## 🎯 Criterios GO/NO-GO

### 1. CRITICAL (Bloquea producción)

- [ ] **Fix IDOR cross-tenant** (refutador-seguridad) — VALIDAR con `verifier-multi-tenant.mjs`
- [ ] **4 checkboxes separados en signup** (refutador-lpdp) — VALIDAR con test E2E
- [ ] **MFA en roles críticos** (refutador-redteam) — IMPLEMENTAR `auth-mfa.js`
- [ ] **Probar todos los smoke tests contra staging** — `node smoke-production.mjs`
- [ ] **Coverage >= 80%** en Node y .NET

### 2. HIGH (Recomendable antes de producción)

- [ ] **Cache de MiniMax con Redis** — IMPLEMENTAR `cache-redis.js`
- [ ] **Webhooks de Stripe** (si se va a cobrar) — `webhooks/stripe-handler.js`
- [ ] **CORS restrictivo en producción** — Solo `legalpro.pe`
- [ ] **Rate limit por usuario** (no solo IP) — `quotaMiddleware`
- [ ] **Detección de anomalías** (geo-IP) — Pendiente
- [ ] **Backups automatizados** — `tools/backup/backup.sh`
- [ ] **Disaster recovery** — `arneses/runbooks/RB-DR-001.md`

### 3. MEDIUM (Post-producción)

- [ ] **Pentest externo anual** (contratar)
- [ ] **Bug bounty program** (futuro)
- [ ] **Sentry/Datadog** — `tools/monitoring/sentry-init.js`
- [ ] **Refactorizar God Class** en MinimaxService.cs
- [ ] **Event sourcing** para acciones críticas

## 🛠️ Pasos Técnicos (Orden)

### Paso 1: Configurar entorno
```bash
# 1.1 Crear .env.production (NO commitear)
cp .env.production.example .env.production
# Editar con valores REALES

# 1.2 Generar secretos
openssl rand -base64 48  # JWT_SECRET
openssl rand -base64 48  # OWNER_SECRET_KEY
openssl rand -base64 32  # OWNER_DECRYPTION_SECRET
openssl rand -base64 32  # SESSION_SECRET
openssl rand -base64 32  # REDIS_PASSWORD
```

### Paso 2: Configurar Railway

```bash
# 2.1 Instalar CLI
npm install -g @railway/cli
railway login

# 2.2 Crear proyecto
railway init legalpro

# 2.3 Crear servicios
railway service create legalpro-frontend
railway service create legalpro-node
railway service create legalpro-dotnet
railway service create legalpro-owner

# 2.4 Crear PostgreSQL
railway add --plugin postgresql

# 2.5 Crear Redis
railway add --plugin redis

# 2.6 Configurar variables (cada servicio)
railway env set NODE_ENV=production
railway env set DATABASE_URL=${{Postgres.DATABASE_URL}}
railway env set REDIS_URL=${{Redis.REDIS_URL}}
# ... etc
```

### Paso 3: Migrar base de datos

```bash
# 3.1 Conectar a la DB de Railway
railway connect Postgres

# 3.2 Ejecutar migraciones
psql $DATABASE_URL < legalpro-app/server/init.sql
psql $DATABASE_URL < LegalProBackend_Net/Migrations.sql

# 3.3 Seed (solo en staging)
node legalpro-app/server/seed.mjs
```

### Paso 4: Build y push de imágenes

```bash
# 4.1 Build
docker build -t ghcr.io/legalpro/frontend:v1.0.0 -f Dockerfile.frontend .
docker build -t ghcr.io/legalpro/node:v1.0.0 -f legalpro-app/Dockerfile .
docker build -t ghcr.io/legalpro/dotnet:v1.0.0 -f LegalProBackend_Net/Dockerfile .
docker build -t ghcr.io/legalpro/owner:v1.0.0 -f legalpro-owner-dashboard/Dockerfile .

# 4.2 Push
docker push ghcr.io/legalpro/frontend:v1.0.0
docker push ghcr.io/legalpro/node:v1.0.0
docker push ghcr.io/legalpro/dotnet:v1.0.0
docker push ghcr.io/legalpro/owner:v1.0.0
```

### Paso 5: Deploy

```bash
# 5.1 Deploy a staging
railway up --service legalpro-frontend --detach
railway up --service legalpro-node --detach
railway up --service legalpro-dotnet --detach
railway up --service legalpro-owner --detach

# 5.2 Esperar health checks
sleep 60

# 5.3 Validar
SMOKE_NODE_URL=https://legalpro-node-staging.railway.app \
  node legalpro-app/server/smoke-production.mjs
```

### Paso 6: Canary

```bash
# 6.1 Canary 10% en frontend
railway canary set 10% --service legalpro-frontend
# Monitorear 10 min
railway canary set 50% --service legalpro-frontend
# Monitorear 10 min
railway canary set 100% --service legalpro-frontend
```

### Paso 7: Post-deploy

```bash
# 7.1 Validar monitor (Sentry, Grafana)
# 7.2 Notificar
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"✅ v1.0.0 en producción"}' $SLACK_WEBHOOK_OPS

# 7.3 Cerrar release
gh release create v1.0.0 --generate-notes
```

## ✅ Firmas Requeridas

- [ ] @arquitecto-chief: Aprueba arquitectura
- [ ] @gobernanza-chief: Aprueba LPDP y compliance
- [ ] @auditor-seguridad: Aprueba verificación OWASP
- [ ] @auditor-lpdp: Aprueba verificación LPDP
- [ ] @auditor-performance: Aprueba performance
- [ ] @release-manager: Aprueba release
- [ ] @product-owner: Aprueba PRD
- [ ] CTO humano: Go/No-Go final

## 📊 Métricas Post-Deploy (Primeras 24h)

- [ ] Uptime >= 99.5% (SLO FREE)
- [ ] Latencia p95 < 500ms (no IA)
- [ ] Latencia p95 < 3s (IA)
- [ ] Error rate < 0.1%
- [ ] 0 breach de LPDP
- [ ] 0 secrets commiteados
- [ ] 0 cross-tenant leaks
