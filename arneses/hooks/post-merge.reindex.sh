#!/usr/bin/env bash
# post-merge.reindex.sh
# Despues de merge, reindexa catalogos y reinicia caches
set -e
cd "$(git rev-parse --show-toplevel)"
echo "==> Validando catalogos despues de merge"
node tools/verifiers/verifier-catalogos.mjs 2>&1 | tail -10
echo "==> Limpiando caches"
rm -rf legalpro-app/.cache 2>/dev/null || true
rm -rf legalpro-app/node_modules/.cache 2>/dev/null || true
rm -rf LegalProBackend_Net/bin/obj 2>/dev/null || true
echo "OK: Post-merge reindex completo"
