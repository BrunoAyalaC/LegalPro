<#
.SYNOPSIS
    Build & Push v2.0.5 — LegalPro (4 imágenes)
.DESCRIPTION
    Construye y sube las 4 imágenes Docker a Docker Hub.
    NO usa git. NO toca src/.
    Ejecutar desde PowerShell como administrador.
#>

$VERSION = "2.0.5"
$REGISTRY = "docker.io"
$ORG = "brunoayala97"
$TIMESTAMP = Get-Date -Format "yyyyMMddHHmmss"

Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  LegalPro - Build & Push v$VERSION                        " -ForegroundColor Cyan
Write-Host "║  Registry: $REGISTRY/$ORG                        " -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ═══ 1. Verificar login ═══
Write-Host "1. Verificando login en Docker Hub..." -ForegroundColor Yellow
$loginStatus = docker system info 2>&1 | Select-String -Pattern "Username"
if (-not $loginStatus) {
    Write-Host "   ⚠️  No estás logueado. Ejecuta: docker login" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Logueado correctamente"
Write-Host ""

# ═══ 2. Build Frontend ═══
Write-Host "2. Building legalpro-frontend:$VERSION..." -ForegroundColor Yellow
docker build --tag "$REGISTRY/$ORG/legalpro-frontend:$VERSION" --tag "$REGISTRY/$ORG/legalpro-frontend:latest" --file Dockerfile.frontend .
if ($LASTEXITCODE -ne 0) { Write-Host "   ❌ FAIL: frontend" -ForegroundColor Red; exit 1 }
Write-Host "   ✅ legalpro-frontend:$VERSION"

# ═══ 3. Build Backend Node ═══
Write-Host "3. Building legalpro-node:$VERSION..." -ForegroundColor Yellow
docker build --tag "$REGISTRY/$ORG/legalpro-node:$VERSION" --tag "$REGISTRY/$ORG/legalpro-node:latest" --file legalpro-app/Dockerfile .
if ($LASTEXITCODE -ne 0) { Write-Host "   ❌ FAIL: node" -ForegroundColor Red; exit 1 }
Write-Host "   ✅ legalpro-node:$VERSION"

# ═══ 4. Build Backend .NET ═══
Write-Host "4. Building legalpro-dotnet:$VERSION..." -ForegroundColor Yellow
docker build --tag "$REGISTRY/$ORG/legalpro-dotnet:$VERSION" --tag "$REGISTRY/$ORG/legalpro-dotnet:latest" --file LegalProBackend_Net/Dockerfile LegalProBackend_Net
if ($LASTEXITCODE -ne 0) { Write-Host "   ❌ FAIL: dotnet" -ForegroundColor Red; exit 1 }
Write-Host "   ✅ legalpro-dotnet:$VERSION"

# ═══ 5. Build Owner Dashboard ═══
Write-Host "5. Building legalpro-owner:$VERSION..." -ForegroundColor Yellow
docker build --tag "$REGISTRY/$ORG/legalpro-owner:$VERSION" --tag "$REGISTRY/$ORG/legalpro-owner:latest" --file legalpro-owner-dashboard/Dockerfile legalpro-owner-dashboard
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
    docker manifest inspect "$REGISTRY/$ORG/legalpro-$svc:$VERSION" > $null 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ $REGISTRY/$ORG/legalpro-$svc:$VERSION"
    } else {
        Write-Host "   ⚠️  $REGISTRY/$ORG/legalpro-$svc:$VERSION (espera 30s)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Build & Push COMPLETADO — v$VERSION                      " -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Tags para deploy manual:" -ForegroundColor Cyan
Write-Host "  frontend → $REGISTRY/$ORG/legalpro-frontend:$VERSION" -ForegroundColor White
Write-Host "  node     → $REGISTRY/$ORG/legalpro-node:$VERSION" -ForegroundColor White
Write-Host "  dotnet   → $REGISTRY/$ORG/legalpro-dotnet:$VERSION" -ForegroundColor White
Write-Host "  owner    → $REGISTRY/$ORG/legalpro-owner:$VERSION" -ForegroundColor White
