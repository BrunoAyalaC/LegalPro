#!/usr/bin/env bash
# pre-commit.lint-eslint.sh
# Lint JS/TS files con ESLint --max-warnings 0
set -e

cd "$(git rev-parse --show-toplevel)"

FILES="$@"
if [ -z "$FILES" ]; then
  echo "No files to lint"
  exit 0
fi

echo "==> ESLint con --max-warnings 0"
npx eslint --max-warnings 0 $FILES
RC=$?

if [ $RC -ne 0 ]; then
  echo "FAIL: ESLint encontró problemas"
  exit $RC
fi

echo "OK: ESLint pasó"
