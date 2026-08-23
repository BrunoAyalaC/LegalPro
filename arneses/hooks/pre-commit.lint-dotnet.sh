#!/usr/bin/env bash
# pre-commit.lint-dotnet.sh
# Valida formato de archivos .NET con dotnet format
set -e
cd "$(git rev-parse --show-toplevel)"
echo "==> dotnet format --verify-no-changes"
dotnet format LegalProBackend_Net/LegalPro.sln --verify-no-changes --verbosity minimal
RC=$?
if [ $RC -ne 0 ]; then
  echo "FAIL: ejecutar 'dotnet format' primero"
  exit $RC
fi
echo "OK: dotnet format paso"
