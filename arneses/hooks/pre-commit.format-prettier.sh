#!/usr/bin/env bash
# pre-commit.format-prettier.sh
# Valida formato con Prettier
set -e
cd "$(git rev-parse --show-toplevel)"
FILES="$@"
if [ -z "$FILES" ]; then
  exit 0
fi
echo "==> Prettier check"
npx prettier --check $FILES
RC=$?
if [ $RC -ne 0 ]; then
  echo "FAIL: ejecutar 'npx prettier --write $FILES'"
  exit $RC
fi
echo "OK: Prettier paso"
