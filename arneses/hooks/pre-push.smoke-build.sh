#!/usr/bin/env bash
# pre-push.smoke-build.sh
# Build de los proyectos para detectar errores
set -e
cd "$(git rev-parse --show-toplevel)"
echo "==> npm run build (Node)"
cd legalpro-app
npm run build 2>&1 | tail -10
cd ..
echo "==> dotnet build (.NET)"
dotnet build LegalProBackend_Net/LegalPro.sln --no-restore --verbosity minimal 2>&1 | tail -10
echo "OK: Builds pasaron"
