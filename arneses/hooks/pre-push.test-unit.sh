#!/usr/bin/env bash
# pre-push.test-unit.sh
# Ejecuta tests unitarios antes de push
set -e
cd "$(git rev-parse --show-toplevel)"
echo "==> Vitest (Node)"
cd legalpro-app
npx vitest run --reporter=dot 2>&1 | tail -20
cd ..
echo "==> xUnit (.NET)"
dotnet test LegalProBackend_Net/LegalPro.UnitTests/ --no-build --verbosity minimal 2>&1 | tail -20
echo "OK: Tests unitarios pasaron"
