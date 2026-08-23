---
name: deploy-backend
description: Despliega backend .NET 9 o Node 20 a Railway con Docker multi-stage, health checks, env vars, secrets rotation, zero-downtime.
when-to-use: "Cuando se pida deploy a Railway staging/production, o ejecutar drill de DR"
allowed-tools: Read, Bash, Grep, Glob
updated: 2026-07-31
plataforma: Railway (https://railway.com)
servicios: [legalpro-node, legalpro-dotnet, legalpro-frontend, legalpro-owner]
entornos: [dev, staging, production]
---

# deploy-backend (v3.0 RAG-optimized)

Despliega backend a **Railway** con Docker multi-stage, health checks, secrets rotation y zero-downtime. **Manual con docker push** (sin CI/CD por decisión del proyecto). **A julio 2026**.

## ⚠️ Reglas inquebrantables

- 🚫 **NUNCA** `git push` desde CI
- 🚫 **NUNCA** commitear `.env` con secretos reales
- 🚫 **NUNCA** deployar directo a producción sin pasar por staging
- ✅ Deploy manual con `docker push` + Railway dashboard
- ✅ Canary release si hay tráfico real

## Inputs

```yaml
servicio: legalpro-node | legalpro-dotnet | legalpro-frontend | legalpro-owner
entorno: dev | staging | production
version: tag_git  # ej: v1.2.0
requiere_migracion: bool
requiere_smoke_test: bool
rollback_plan: string  # versión anterior
```

## Output schema

```json
{
  "version": "3.0",
  "servicio": "string",
  "version": "vX.Y.Z",
  "entorno": "string",
  "deploy_id": "uuid",
  "started_at": "iso8601",
  "completed_at": "iso8601",
  "duration_ms": "int",
  "health_checks": {
    "/health": "OK|FAIL",
    "/health/ready": "OK|FAIL",
    "/health/live": "OK|FAIL"
  },
  "smoke_test": {
    "status": "OK|FAIL",
    "tests_passed": "int",
    "tests_failed": "int"
  },
  "rollback": "string|null",
  "audit_events": ["DEPLOY_STARTED", "DEPLOY_SUCCESS"]
}
```

## Pasos (protocolo RAG)

### 1. Pre-deploy (CHECKLIST)

- [ ] `git tag vX.Y.Z` existe y está firmado con GPG
- [ ] CI verde (28 verificadores pasan)
- [ ] Sign-off de los 3 chiefs (Arquitecto, Gobernanza, Release)
- [ ] Secrets rotados según `docs/SECRET_ROTATION_CHECKLIST.md`
- [ ] Migraciones probadas en staging
- [ ] Plan de rollback documentado

### 2. Build imagen Docker multi-stage

```bash
# legalpro-app/Dockerfile.frontend (Vite + Nginx)
docker build -f Dockerfile.frontend -t brunoayala97/legalpro-frontend:v1.2.0 .

# legalpro-app/Dockerfile (Node 20)
docker build -f Dockerfile -t brunoayala97/legalpro-node:v1.2.0 .

# LegalProBackend_Net/Dockerfile (.NET 8)
docker build -f LegalProBackend_Net/Dockerfile -t brunoayala97/legalpro-dotnet:v1.2.0 .

# legalpro-owner-dashboard/Dockerfile
docker build -f Dockerfile -t brunoayala97/legalpro-owner:v1.2.0 .
```

### 3. Push a GHCR/Docker Hub

```bash
docker push brunoayala97/legalpro-frontend:v1.2.0
docker push brunoayala97/legalpro-node:v1.2.0
docker push brunoayala97/legalpro-dotnet:v1.2.0
docker push brunoayala97/legalpro-owner:v1.2.0
```

### 4. Deploy a Railway (zero-downtime)

```bash
# Via Railway dashboard o CLI
railway up --service legalpro-node --detach
# Tag de imagen actualizado → redeploy automático con health checks
```

### 5. Si requiere migración

```bash
# Ejecutar ANTES del deploy
railway run --service legalpro-dotnet dotnet ef database update
# Verificar migración exitosa
railway logs --service legalpro-dotnet | grep "migration"
```

### 6. Validación post-deploy

- Health checks:
  - `GET /health` → 200 OK
  - `GET /health/ready` → 200 OK (incluye DB, Redis, MiniMax)
  - `GET /health/live` → 200 OK
- Smoke test:
  ```bash
  # Contra el servicio desplegado
  SMOKE_NODE_URL=https://node.example.com node server/smoke-production.mjs
  ```
- Smoke cubre los 5 roles demo (ABOGADO, FISCAL, JUEZ, CONTADOR, OWNER)

### 7. Si falla: rollback automático

```bash
railway rollback --service legalpro-node --to-version v1.1.9
# Notificar a #deploys Slack
# Ejecutar RB-008-deploy-failed.md runbook
```

## Quality gates

- [ ] Tag git firmado con GPG
- [ ] 28 verificadores en verde (CI)
- [ ] 3 sign-offs (Arquitecto, Gobernanza, Release)
- [ ] Health checks OK (3 endpoints)
- [ ] Smoke test OK (5 roles demo)
- [ ] Sin degradación de performance
- [ ] Sin nuevos warnings en logs
- [ ] Audit event emitido

## Audit log

Emitir `DEPLOY_STARTED`, `DEPLOY_SUCCESS` o `DEPLOY_FAILURE` con payload: `servicio, version, deployer, environment, duration_ms, error (si falla)`.

## Procedimiento de rotación de secrets

Seguir `docs/SECRET_ROTATION_CHECKLIST.md` antes de cada deploy a producción:

1. **Gemini API key**: rotar cada 90 días
2. **JWT_SECRET**: rotar con doble-cookie (mantener anterior activo por 24h)
3. **Supabase keys**: rotar cada 180 días
4. **Postgres password**: rotar cada 180 días
5. **Owner secrets**: PBKDF2 + AES-256-GCM
6. **Stripe webhook secret**: rotar en cada evento de seguridad

## Referencias

- `catalogs/env-vars.md`
- `catalogs/sla-slo.md`
- `catalogs/release-policy.md`
- `docs/SECRET_ROTATION_CHECKLIST.md`
- `docs/SECRET_ROTATION_PLAN.md`
- `tools/verifiers/verifier-owasp.mjs`
- `tools/verifiers/verifier-catalogos.mjs`
- `arneses/runbooks/RB-008-deploy-failed.md`
- `arneses/runbooks/RB-009-migration-failed.md`
- `arneses/runbooks/RB-021-deploy-railway.md`
- `arneses/runbooks/RB-DR-001-disaster-recovery.md`
- Railway docs: https://docs.railway.com/
- Docker multi-stage: https://docs.docker.com/build/building/multi-stage/
