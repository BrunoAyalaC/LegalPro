#!/usr/bin/env pwsh
# =============================================================================
# build-and-tag.ps1 — Build y tag de todas las imágenes Docker de LegalPro
# =============================================================================
# Uso:
#   ./build-and-tag.ps1              → build todo con :1.0.0 y :latest
#   ./build-and-tag.ps1 -Push        → build + push a ghcr.io
#   ./build-and-tag.ps1 -Tag 2.0.0   → build con tag específico
# =============================================================================

param(
    [string]$Tag = "1.0.0",
    [switch]$Push = $false,
    [string]$Registry = "ghcr.io/brunoayalac/abogacia"
)

$ErrorActionPreference = "Stop"

# ── Verificar Docker disponible ──────────────────────────────────────────────
docker info > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker no está corriendo. Inicia Docker Desktop primero."
    exit 1
}

# ── Obtener short commit SHA ─────────────────────────────────────────────────
$CommitSHA = (git rev-parse --short HEAD 2>$null)
if (-not $CommitSHA) { $CommitSHA = "local" }
Write-Host "[INFO] Build tag: $Tag | commit: sha-$CommitSHA"
Write-Host ""

# =============================================================================
# IMAGE 1: legalpro-node (Backend Express)
# Tags: :latest, :1.0.0, :sha-<commit>
# =============================================================================
Write-Host "==> [1/3] Building legalpro-node..."
docker build `
    -t "${Registry}/legalpro-node:latest" `
    -t "${Registry}/legalpro-node:${Tag}" `
    -t "${Registry}/legalpro-node:sha-${CommitSHA}" `
    -f legalpro-app/Dockerfile `
    legalpro-app/

if ($LASTEXITCODE -ne 0) { Write-Error "Build legalpro-node falló"; exit 1 }
Write-Host "[OK] legalpro-node:latest | legalpro-node:${Tag} | legalpro-node:sha-${CommitSHA}"
Write-Host ""

# =============================================================================
# IMAGE 2: legalpro-dotnet (Backend ASP.NET Core 9)
# Tags: :latest, :1.0.0, :sha-<commit>
# =============================================================================
Write-Host "==> [2/3] Building legalpro-dotnet..."
docker build `
    -t "${Registry}/legalpro-dotnet:latest" `
    -t "${Registry}/legalpro-dotnet:${Tag}" `
    -t "${Registry}/legalpro-dotnet:sha-${CommitSHA}" `
    -f LegalProBackend_Net/Dockerfile `
    LegalProBackend_Net/

if ($LASTEXITCODE -ne 0) { Write-Error "Build legalpro-dotnet falló"; exit 1 }
Write-Host "[OK] legalpro-dotnet:latest | legalpro-dotnet:${Tag} | legalpro-dotnet:sha-${CommitSHA}"
Write-Host ""

# =============================================================================
# IMAGE 3: legalpro-frontend (React/Vite → nginx)
# Tags: :latest, :1.0.0, :sha-<commit>
# Build args (pasar URLs de Railway producción):
# =============================================================================
Write-Host "==> [3/3] Building legalpro-frontend..."
$NODE_URL = $env:VITE_NODE_API_URL
if (-not $NODE_URL) { $NODE_URL = "https://legalpro-node-production-34ac.up.railway.app" }
$DOTNET_URL = $env:VITE_DOTNET_API_URL
if (-not $DOTNET_URL) { $DOTNET_URL = "https://legalpro-dotnet-production-5a39.up.railway.app" }
$APK_URL = $env:VITE_APK_URL
if (-not $APK_URL) { $APK_URL = "https://github.com/BrunoAyalaC/Abogacia/releases/download/v1.0.0/LegalPro-debug.apk" }

docker build `
    -t "${Registry}/legalpro-frontend:latest" `
    -t "${Registry}/legalpro-frontend:${Tag}" `
    -t "${Registry}/legalpro-frontend:sha-${CommitSHA}" `
    --build-arg VITE_NODE_API_URL=$NODE_URL `
    --build-arg VITE_DOTNET_API_URL=$DOTNET_URL `
    --build-arg VITE_APK_URL=$APK_URL `
    -f legalpro-app/Dockerfile.frontend `
    legalpro-app/

if ($LASTEXITCODE -ne 0) { Write-Error "Build legalpro-frontend falló"; exit 1 }
Write-Host "[OK] legalpro-frontend:latest | legalpro-frontend:${Tag} | legalpro-frontend:sha-${CommitSHA}"
Write-Host ""

# =============================================================================
# RESUMEN de imágenes construidas
# =============================================================================
Write-Host "============================================================"
Write-Host "DOCKER IMAGES CONSTRUIDAS:"
Write-Host "------------------------------------------------------------"
docker images "${Registry}/*" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
Write-Host ""

# =============================================================================
# PUSH opcional a ghcr.io
# =============================================================================
if ($Push) {
    Write-Host "==> Haciendo push a $Registry..."
    Write-Host "    (Requiere: docker login ghcr.io -u <user> -p <PAT>)"

    foreach ($svc in @("legalpro-node", "legalpro-dotnet", "legalpro-frontend")) {
        docker push "${Registry}/${svc}:latest"
        docker push "${Registry}/${svc}:${Tag}"
        docker push "${Registry}/${svc}:sha-${CommitSHA}"
    }
    Write-Host "[OK] Push completado."
}

Write-Host ""
Write-Host "============================================================"
Write-Host "TAGS DISPONIBLES:"
Write-Host "  ${Registry}/legalpro-node:latest"
Write-Host "  ${Registry}/legalpro-node:${Tag}"
Write-Host "  ${Registry}/legalpro-node:sha-${CommitSHA}"
Write-Host "  ${Registry}/legalpro-dotnet:latest"
Write-Host "  ${Registry}/legalpro-dotnet:${Tag}"
Write-Host "  ${Registry}/legalpro-dotnet:sha-${CommitSHA}"
Write-Host "  ${Registry}/legalpro-frontend:latest"
Write-Host "  ${Registry}/legalpro-frontend:${Tag}"
Write-Host "  ${Registry}/legalpro-frontend:sha-${CommitSHA}"
Write-Host ""
Write-Host "RAILWAY PostgreSQL Plugin (gestionado automáticamente):"
Write-Host "  registry.railway.app/<project>/legalpro-postgres:latest"
Write-Host "============================================================"
