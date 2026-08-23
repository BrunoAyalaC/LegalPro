#!/usr/bin/env bash
# pre-commit.no-console-log.sh
# Detecta console.log en produccion
set -e
cd "$(git rev-parse --show-toplevel)"
FILES="$@"
if [ -z "$FILES" ]; then
  exit 0
fi
echo "==> Detectando console.log en produccion"
PATTERN='console\.(log|debug|info|trace)'
OUT=$(grep -rE "$PATTERN" --include="*.js" --include="*.ts" $FILES 2>/dev/null | grep -v "__tests__" | grep -v ".test." | grep -v "logger" || true)
if [ -n "$OUT" ]; then
  echo "FAIL: console.log/debug/info/trace encontrados:"
  echo "$OUT"
  echo ""
  echo "Usar logger (logger.info, logger.error) en su lugar"
  exit 1
fi
echo "OK: Sin console.log en codigo de produccion"
