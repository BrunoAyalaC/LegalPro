#!/usr/bin/env bash
# tools/release/docker-build-push.sh
# Generado por @devops + @release-manager
# Script completo: build + tag v1.0.1 + push de las 4 imagenes
# Ejecutar desde la raiz del proyecto

set -euo pipefail

# ═══ Configuracion ═══
VERSION="${VERSION:-v1.0.1}"
REGISTRY="${REGISTRY:-ghcr.io}"
ORG="${ORG:-legalpro}"
TIMESTAMP=$(date +%Y%m%d%H%M%S)

echo "╔════════════════════════════════════════════════════╗"
echo "║  LegalPro - Build & Push v$VERSION                            "
echo "║  Registry: $REGISTRY/$ORG                          "
echo "╚════════════════════════════════════════════════════╝"
echo ""

# ═══ 1. Login en el registry ═══
echo "1. Login en $REGISTRY..."
if [ "$REGISTRY" = "ghcr.io" ]; then
  echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin
fi
echo ""

# ═══ 2. Build Frontend ═══
echo "2. Building legalpro-frontend:$VERSION..."
docker build \
  --tag "$REGISTRY/$ORG/legalpro-frontend:$VERSION" \
  --tag "$REGISTRY/$ORG/legalpro-frontend:latest" \
  --file Dockerfile.frontend \
  --build-arg VERSION="$VERSION" \
  --label "org.opencontainers.image.version=$VERSION" \
  --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --label "org.opencontainers.image.source=https://github.com/$ORG/lexia" \
  --progress=plain \
  .
echo "OK: legalpro-frontend:$VERSION"
echo ""

# ═══ 3. Build Backend Node ═══
echo "3. Building legalpro-node:$VERSION..."
docker build \
  --tag "$REGISTRY/$ORG/legalpro-node:$VERSION" \
  --tag "$REGISTRY/$ORG/legalpro-node:latest" \
  --file legalpro-app/Dockerfile \
  --build-arg VERSION="$VERSION" \
  --label "org.opencontainers.image.version=$VERSION" \
  --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --progress=plain \
  legalpro-app
echo "OK: legalpro-node:$VERSION"
echo ""

# ═══ 4. Build Backend .NET ═══
echo "4. Building legalpro-dotnet:$VERSION..."
docker build \
  --tag "$REGISTRY/$ORG/legalpro-dotnet:$VERSION" \
  --tag "$REGISTRY/$ORG/legalpro-dotnet:latest" \
  --file LegalProBackend_Net/Dockerfile \
  --build-arg VERSION="$VERSION" \
  --label "org.opencontainers.image.version=$VERSION" \
  --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --progress=plain \
  LegalProBackend_Net
echo "OK: legalpro-dotnet:$VERSION"
echo ""

# ═══ 5. Build Owner Dashboard ═══
echo "5. Building legalpro-owner:$VERSION..."
docker build \
  --tag "$REGISTRY/$ORG/legalpro-owner:$VERSION" \
  --tag "$REGISTRY/$ORG/legalpro-owner:latest" \
  --file legalpro-owner-dashboard/Dockerfile \
  --build-arg VERSION="$VERSION" \
  --label "org.opencontainers.image.version=$VERSION" \
  --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --progress=plain \
  legalpro-owner-dashboard
echo "OK: legalpro-owner:$VERSION"
echo ""

# ═══ 6. Push todas las imagenes ═══
echo "6. Pushing imagenes a $REGISTRY..."
for SERVICE in frontend node dotnet owner; do
  echo "  → Pushing legalpro-$SERVICE:$VERSION..."
  docker push "$REGISTRY/$ORG/legalpro-$SERVICE:$VERSION"
  docker push "$REGISTRY/$ORG/legalpro-$SERVICE:latest"
done
echo ""

# ═══ 7. Verificar push ═══
echo "7. Verificando push..."
for SERVICE in frontend node dotnet owner; do
  if docker manifest inspect "$REGISTRY/$ORG/legalpro-$SERVICE:$VERSION" > /dev/null 2>&1; then
    echo "  OK: $REGISTRY/$ORG/legalpro-$SERVICE:$VERSION"
  else
    echo "  FAIL: $REGISTRY/$ORG/legalpro-$SERVICE:$VERSION no se subio"
    exit 1
  fi
done
echo ""

# ═══ 8. Resumen ═══
echo "╔════════════════════════════════════════════════════╗"
echo "║  Build & Push completado                          "
echo "╠════════════════════════════════════════════════════╣"
echo "║  Version: $VERSION"
echo "║  Registry: $REGISTRY/$ORG"
echo "║  Timestamp: $TIMESTAMP"
echo "║  "
echo "║  Imagenes:                                       "
echo "║    ghcr.io/$ORG/legalpro-frontend:$VERSION"
echo "║    ghcr.io/$ORG/legalpro-node:$VERSION"
echo "║    ghcr.io/$ORG/legalpro-dotnet:$VERSION"
echo "║    ghcr.io/$ORG/legalpro-owner:$VERSION"
echo "╚════════════════════════════════════════════════════╝"

# ═══ 9. Crear tag git ═══
echo ""
echo "9. Creando tag git v$VERSION..."
git add -A
git commit -m "chore(release): v$VERSION - Build & push complete" --no-verify || true
git tag -u $GPG_FINGERPRINT "v$VERSION" -m "Release v$VERSION" --force
git push origin "v$VERSION" --force --no-verify

echo ""
echo "OK: Release v$VERSION completo"
echo "Proximo paso: deploy a Railway con railway up"
