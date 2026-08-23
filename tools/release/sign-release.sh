#!/usr/bin/env bash
# tools/release/sign-release.sh
# Generado por @release-manager
# Script para firmar releases con GPG

set -euo pipefail

VERSION="${1:?Usage: sign-release.sh <version>}"
GPG_KEY="${GPG_KEY:?GPG_KEY env var required}"
GPG_FINGERPRINT="${GPG_FINGERPRINT:?GPG_FINGERPRINT env var required}"

echo "📝 Firmando release v$VERSION"

# 1. Verificar tag
if ! git rev-parse "v$VERSION" >/dev/null 2>&1; then
  echo "❌ Tag v$VERSION no existe"
  exit 1
fi

# 2. Verificar CI
CI_STATUS=$(gh run list --workflow=verifiers.yml --branch="v$VERSION" --limit 1 --json status --jq '.[0].status' || echo "unknown")
if [[ "$CI_STATUS" != "success" ]]; then
  echo "❌ CI no esta en success: $CI_STATUS"
  exit 1
fi

# 3. Crear tag firmado (si no existe ya)
git tag -u "$GPG_FINGERPRINT" "v$VERSION" --message "Release v$VERSION" --force
git push --tags --force

# 4. Crear release notes
RELEASE_NOTES="arneses/releases/v${VERSION}_RELEASE_NOTES.md"
if [ ! -f "$RELEASE_NOTES" ]; then
  echo "⚠️ No se encontraron release notes en $RELEASE_NOTES"
  echo "Generando notas automaticas..."
  git log "v${VERSION}~1"..HEAD --pretty=format:"- %s" > "$RELEASE_NOTES"
fi

# 5. Generar checksums
echo "🔐 Generando checksums..."
sha256sum legalpro-frontend-v${VERSION}.tar.gz > legalpro-frontend-v${VERSION}.tar.gz.sha256
sha256sum legalpro-node-v${VERSION}.tar.gz > legalpro-node-v${VERSION}.tar.gz.sha256
sha256sum legalpro-dotnet-v${VERSION}.tar.gz > legalpro-dotnet-v${VERSION}.tar.gz.sha256
sha256sum legalpro-owner-v${VERSION}.tar.gz > legalpro-owner-v${VERSION}.tar.gz.sha256

# 6. Firmar checksums
for f in *.sha256; do
  gpg --batch --yes --local-user "$GPG_FINGERPRINT" \
    --armor --detach-sign --output "${f}.sig" "$f"
done

# 7. Crear release en GitHub
gh release create "v$VERSION" \
  --title "v$VERSION" \
  --notes-file "$RELEASE_NOTES" \
  --target main \
  --draft \
  legalpro-*.tar.gz \
  legalpro-*.sha256 \
  legalpro-*.sha256.sig

echo "✅ Release v$VERSION firmado y draft creado en GitHub"
echo "🔍 Revisiona en: https://github.com/legalpro/lexia/releases"
