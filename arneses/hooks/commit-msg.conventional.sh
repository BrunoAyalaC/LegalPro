#!/usr/bin/env bash
# commit-msg.conventional.sh
# Valida conventional commits
set -e
MSG_FILE="$1"
MSG=$(cat "$MSG_FILE")
# Conventional commit pattern: type(scope): subject
PATTERN="^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\([a-z0-9_-]+\))?: .{1,100}"
if ! echo "$MSG" | head -1 | grep -qE "$PATTERN"; then
  echo "FAIL: Commit no sigue conventional commits"
  echo "Formato: <type>(<scope>): <subject>"
  echo "Tipos: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert"
  echo "Subject: <= 100 chars, minúscula, sin punto final"
  exit 1
fi
echo "OK: Conventional commit"
