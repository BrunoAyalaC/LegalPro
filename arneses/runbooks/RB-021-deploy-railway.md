# RB-021: Deploy a Railway

## Metadata
- **Severidad**: P2 (deploy normal)
- **Owner**: @devops
- **Última actualización**: 2026-06-12

## Pre-requisitos

- [ ] Tag `vX.Y.Z` firmado con GPG
- [ ] CI ejecutó los 25 verificadores (verde)
- [ ] 3 sign-offs de los chiefs
- [ ] Migraciones probadas en staging

## Procedimiento

### Paso 1: Tag y push

```bash
git tag -s v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

### Paso 2: Build de imágenes

```bash
docker build -t legalpro-frontend:v1.0.0 -f Dockerfile.frontend .
docker build -t legalpro-node:v1.0.0 .
docker build -t legalpro-dotnet:v1.0.0 -f ../LegalProBackend_Net/Dockerfile .
docker build -t legalpro-owner:v1.0.0 -f ../legalpro-owner-dashboard/Dockerfile .
```

### Paso 3: Push a GHCR

```bash
docker push ghcr.io/legalpro/frontend:v1.0.0
docker push ghcr.io/legalpro/node:v1.0.0
docker push ghcr.io/legalpro/dotnet:v1.0.0
docker push ghcr.io/legalpro/owner:v1.0.0
```

### Paso 4: Deploy a Railway

```bash
railway up --service legalpro-node --detach
railway up --service legalpro-dotnet --detach
railway up --service legalpro-frontend --detach
railway up --service legalpro-owner --detach
```

### Paso 5: Migrar DB (si hay)

```bash
railway run --service legalpro-dotnet "dotnet ef database update"
```

### Paso 6: Smoke test post-deploy

```bash
SMOKE_NODE_URL=https://legalpro-node.railway.app \
SMOKE_DOTNET_URL=https://legalpro-dotnet.railway.app \
SMOKE_OWNER_URL=https://legalpro-owner.railway.app \
  node legalpro-app/server/smoke-production.mjs
```

### Paso 7: Canary (10% → 50% → 100%)

```bash
# Si Railway lo soporta
railway canary set 10% --service legalpro-frontend
# Esperar 5 min
railway canary set 50% --service legalpro-frontend
# Esperar 5 min
railway canary set 100% --service legalpro-frontend
```

### Paso 8: Notificación

```bash
# Slack
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"✅ Release v1.0.0 deployed successfully"}' \
  $SLACK_WEBHOOK_OPS

# Email a stakeholders
mail -s "LegalPro v1.0.0 en producción" stakeholders@legalpro.pe < release-notes.md
```

## Rollback

Si falla el deploy en menos de 24h:

```bash
railway rollback --service legalpro-node --to v0.9.0
railway rollback --service legalpro-dotnet --to v0.9.0
```

## Monitoreo Post-Deploy

- [ ] SLOs cumplidos (latencia, error rate)
- [ ] No hay alertas CRITICAL
- [ ] Smoke tests pasan
- [ ] Logs normales
- [ ] APM muestra tráfico

## Si todo OK

- [ ] Tag confirmado en producción
- [ ] CHANGELOG.md actualizado
- [ ] Notificación a usuarios (release notes)
- [ ] Post-mortem si hubo issues
- [ ] Plan del siguiente release

## Compliance

- [ ] LPDP: sin nuevos tratamientos de datos
- [ ] OWASP: ningún HIGH/CRITICAL en verifiers
- [ ] Firma digital: PSC acreditado para docs firmados
