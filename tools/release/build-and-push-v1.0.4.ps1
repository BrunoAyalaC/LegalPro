<#
.SYNOPSIS
    Build & Push v1.0.4 — LegalPro (4 imágenes)
.DESCRIPTION
    Construye y sube las 4 imágenes Docker a Docker Hub.
    NO usa git. NO toca src/.
    Ejecutar desde PowerShell como administrador.
#>

$VERSION = "1.0.4"
$REGISTRY = "docker.io"
$ORG = "brunoayala97"
$TIMESTAMP = Get-Date -Format "yyyyMMddHHmmss"

Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  LegalPro - Build & Push v$VERSION                        " -ForegroundColor Cyan
Write-Host "║  Registry: $REGISTRY/$ORG                        " -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ═══ 1. Login (si no está logueado) ═══
Write-Host "1. Verificando login en Docker Hub..." -ForegroundColor Yellow
$loginStatus = docker system info 2>&1 | Select-String -Pattern "Username"
if (-not $loginStatus) {
    Write-Host "   ⚠️  No estás logueado. Ejecuta: docker login" -ForegroundColor Red
    Write-Host "   Luego vuelve a ejecutar este script." -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Logueado correctamente"
Write-Host ""

# ═══ 2. Build Frontend ═══
Write-Host "2. Building legalpro-frontend:$VERSION..." -ForegroundColor Yellow
docker build `
    --tag "$REGISTRY/$ORG/legalpro-frontend:$VERSION" `
    --tag "$REGISTRY/$ORG/legalpro-frontend:latest" `
    --file Dockerfile.frontend `
    --build-arg VERSION="$VERSION" `
    --label "org.opencontainers.image.version=$VERSION" `
    --label "org.opencontainers.image.created=$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')" `
    .
if ($LASTEXITCODE -ne 0) { Write-Host "   ❌ FAIL: frontend" -ForegroundColor Red; exit 1 }
Write-Host "   ✅ legalpro-frontend:$VERSION"

# ═══ 3. Build Backend Node ═══
Write-Host "3. Building legalpro-node:$VERSION..." -ForegroundColor Yellow
docker build `
    --tag "$REGISTRY/$ORG/legalpro-node:$VERSION" `
    --tag "$REGISTRY/$ORG/legalpro-node:latest" `
    --file legalpro-app/Dockerfile `
    --build-arg VERSION="$VERSION" `
    --label "org.opencontainers.image.version=$VERSION" `
    --label "org.opencontainers.image.created=$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')" `
    legalpro-app
if ($LASTEXITCODE -ne 0) { Write-Host "   ❌ FAIL: node" -ForegroundColor Red; exit 1 }
Write-Host "   ✅ legalpro-node:$VERSION"

# ═══ 4. Build Backend .NET ═══
Write-Host "4. Building legalpro-dotnet:$VERSION..." -ForegroundColor Yellow
docker build `
    --tag "$REGISTRY/$ORG/legalpro-dotnet:$VERSION" `
    --tag "$REGISTRY/$ORG/legalpro-dotnet:latest" `
    --file LegalProBackend_Net/Dockerfile `
    --build-arg VERSION="$VERSION" `
    --label "org.opencontainers.image.version=$VERSION" `
    --label "org.opencontainers.image.created=$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')" `
    LegalProBackend_Net
if ($LASTEXITCODE -ne 0) { Write-Host "   ❌ FAIL: dotnet" -ForegroundColor Red; exit 1 }
Write-Host "   ✅ legalpro-dotnet:$VERSION"

# ═══ 5. Build Owner Dashboard ═══
Write-Host "5. Building legalpro-owner:$VERSION..." -ForegroundColor Yellow
docker build `
    --tag "$REGISTRY/$ORG/legalpro-owner:$VERSION" `
    --tag "$REGISTRY/$ORG/legalpro-owner:latest" `
    --file legalpro-owner-dashboard/Dockerfile `
    --build-arg VERSION="$VERSION" `
    --label "org.opencontainers.image.version=$VERSION" `
    --label "org.opencontainers.image.created=$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')" `
    legalpro-owner-dashboard
if ($LASTEXITCODE -ne 0) { Write-Host "   ❌ FAIL: owner" -ForegroundColor Red; exit 1 }
Write-Host "   ✅ legalpro-owner:$VERSION"

# ═══ 6. Push ═══
Write-Host "6. Pushing imágenes a Docker Hub..." -ForegroundColor Yellow
$SERVICES = @("frontend", "node", "dotnet", "owner")
foreach ($svc in $SERVICES) {
    Write-Host "   → Push legalpro-$svc:$VERSION..." -ForegroundColor Gray
    docker push "$REGISTRY/$ORG/legalpro-$svc:$VERSION"
    if ($LASTEXITCODE -ne 0) { Write-Host "   ❌ FAIL: push legalpro-$svc" -ForegroundColor Red; exit 1 }
    docker push "$REGISTRY/$ORG/legalpro-$svc:latest"
    if ($LASTEXITCODE -ne 0) { Write-Host "   ❌ FAIL: push legalpro-$svc:latest" -ForegroundColor Red; exit 1 }
    Write-Host "   ✅ legalpro-$svc:$VERSION + latest"
}

# ═══ 7. Verificar ═══
Write-Host "7. Verificando push..." -ForegroundColor Yellow
foreach ($svc in $SERVICES) {
    $check = docker manifest inspect "$REGISTRY/$ORG/legalpro-$svc:$VERSION" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ $REGISTRY/$ORG/legalpro-$svc:$VERSION"
    } else {
        Write-Host "   ⚠️  $REGISTRY/$ORG/legalpro-$svc:$VERSION (espera 30s para propagación)" -ForegroundColor Yellow
    }
}

# ═══ 8. Resumen ═══
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Build & Push COMPLETADO                          " -ForegroundColor Green
Write-Host "╠════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Version: $VERSION                                           " -ForegroundColor Green
Write-Host "║  Registry: $REGISTRY/$ORG                       " -ForegroundColor Green
Write-Host "║  Timestamp: $TIMESTAMP                                     " -ForegroundColor Green
Write-Host "║                                                     " -ForegroundColor Green
Write-Host "║  Imágenes:                                         " -ForegroundColor Green
Write-Host "║    $REGISTRY/$ORG/legalpro-frontend:$VERSION  " -ForegroundColor Green
Write-Host "║    $REGISTRY/$ORG/legalpro-node:$VERSION      " -ForegroundColor Green
Write-Host "║    $REGISTRY/$ORG/legalpro-dotnet:$VERSION    " -ForegroundColor Green
Write-Host "║    $REGISTRY/$ORG/legalpro-owner:$VERSION     " -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Próximo paso: Deploy MANUAL en Railway" -ForegroundColor Cyan
Write-Host "  1. Ir a https://railway.app/dashboard" -ForegroundColor Cyan
Write-Host "  2. Cada servicio → Settings → Deploy → Deploy Image" -ForegroundColor Cyan
Write-Host "  3. Pegar la imagen correspondiente" -ForegroundColor Cyan
Write-Host "  4. Repetir para los 4 servicios" -ForegroundColor Cyan
