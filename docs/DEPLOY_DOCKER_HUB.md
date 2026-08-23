# Deploy vía Docker Hub

Publicación de imágenes de LegalPro en Docker Hub (`docker.io/brunoayalac/*`), complementaria al flujo GHCR existente (`docker-publish.yml`).

## Imágenes publicadas

| Imagen | Dockerfile | Contexto |
|---|---|---|
| `brunoayalac/legalpro-frontend` | `legalpro-app/Dockerfile.frontend` | `./legalpro-app` |
| `brunoayalac/legalpro-node` | `legalpro-app/Dockerfile` | `.` |
| `brunoayalac/legalpro-dotnet` | `LegalProBackend_Net/Dockerfile` | `./LegalProBackend_Net` |
| `brunoayalac/legalpro-owner-dashboard` | `legalpro-owner-dashboard/Dockerfile` | `./legalpro-owner-dashboard` |

Tags por imagen: `latest`, `<version>` (desde tag git `v*`, ej. `v0.9.0` → `0.9.0`) y `sha-<commit corto>`. Plataforma: `linux/amd64`.

## Prereqs (una sola vez)

1. Cuenta en [hub.docker.com](https://hub.docker.com) (usuario: `brunoayalac`).
2. Crear **Access Token**: Account Settings → Security → New Access Token (permisos *Read & Write*).
3. Agregar secrets en el repo GitHub (*Settings → Secrets and variables → Actions*):
   - `DOCKERHUB_USERNAME` = `brunoayalac`
   - `DOCKERHUB_TOKEN` = el access token del paso 2
4. Los secrets `VITE_*` ya deben existir (los usa el build del frontend).

## Disparar el publish

**Manual** (GitHub UI o CLI):

```bash
gh workflow run docker-hub-publish.yml
```

**Por release** (recomendado — genera tag semver):

```bash
git tag v0.9.0
git push origin v0.9.0   # push --tags también sirve
```

Al terminar, el job `publish-summary` muestra una tabla con los digests en el resumen del run.

## Consumir las imágenes

```bash
# Pull individual
docker pull brunoayalac/legalpro-node:latest
docker pull brunoayalac/legalpro-dotnet:0.9.0

# Stack completo sin build local:
# 1) En docker-compose.yml, reemplaza los bloques `build:` por `image:` según
#    el bloque comentado "ALTERNATIVA" dentro del compose.
# 2) Configura .env (ver catalogs/env-vars.md): MINIMAX_API_KEY, OPENCODE_API_KEY, etc.
docker compose up -d
docker compose ps        # verificar healthchecks healthy
```

## Rollback

Cada publicación es inmutable por digest. Para revertir:

```bash
docker pull brunoayalac/legalpro-node:<version-anterior>
# y fija esa versión en docker-compose.yml / Railway (image pin)
```

## Rotación de credenciales

Rota `DOCKERHUB_TOKEN` mensualmente (ver `docs/SECRET_ROTATION_PLAN.md`): genera token nuevo → actualiza secret en GitHub → revoca el anterior.
