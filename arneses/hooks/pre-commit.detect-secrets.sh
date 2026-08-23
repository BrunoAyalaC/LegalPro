#!/usr/bin/env bash
# pre-commit.detect-secrets.sh
# Detecta secrets con gitleaks
set -e

cd "$(git rev-parse --show-toplevel)"

if ! command -v gitleaks &> /dev/null; then
  echo "WARN: gitleaks no instalado, saltando"
  exit 0
fi

echo "==> Gitleaks detect-secrets"
gitleaks protect --staged --no-banner --redact --config=arneses/hooks/gitleaks.toml
RC=$?

if [ $RC -ne 0 ]; then
  echo "FAIL: Gitleaks detectó secrets"
  exit $RC
fi

echo "OK: Gitleaks pasó"
