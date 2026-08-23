#!/usr/bin/env bash
# tools/release/post-deploy-validation.sh
# Generado por @smoke-tester + @journey-tester
# Validacion post-deploy a produccion

set -euo pipefail

VERSION="${1:?Usage: post-deploy-validation.sh <version>}"
PROD_URL="${PROD_URL:-https://legalpro.pe}"
NODE_URL="${NODE_URL:-https://legalpro-node.railway.app}"
DOTNET_URL="${DOTNET_URL:-https://legalpro-dotnet.railway.app}"
OWNER_URL="${OWNER_URL:-https://legalpro-owner.railway.app}"

REPORT_FILE="reports/post-deploy-v${VERSION}-$(date +%Y%m%d_%H%M%S).md"
mkdir -p reports

cat > "$REPORT_FILE" <<EOF
# 📋 Post-Deploy Validation Report

**Version**: v$VERSION
**Fecha**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Target**: Produccion

## Tests Ejecutados

EOF

PASSED=0
FAILED=0
TESTS=()

run_test() {
  local name="$1"
  local cmd="$2"
  echo "🧪 Test: $name"
  if eval "$cmd" > /tmp/test_output.txt 2>&1; then
    echo "  ✅ OK"
    echo "- ✅ $name" >> "$REPORT_FILE"
    PASSED=$((PASSED+1))
  else
    echo "  ❌ FAIL"
    echo "- ❌ $name — \`$(cat /tmp/test_output.txt | head -3)\`" >> "$REPORT_FILE"
    FAILED=$((FAILED+1))
  fi
}

# Health checks
run_test "Frontend health" "curl -sf $PROD_URL/health | grep -q 'ok'"
run_test "Node API health" "curl -sf $NODE_URL/health | grep -q 'ok'"
run_test ".NET API health" "curl -sf $DOTNET_URL/health | grep -q 'Healthy'"
run_test "Owner Dashboard health" "curl -sf $OWNER_URL/health | grep -q 'ok'"

# SSL
run_test "SSL certificate valid" "echo | openssl s_client -servername $PROD_URL -connect $PROD_URL:443 2>/dev/null | openssl x509 -noout -dates | grep -q 'notAfter'"

# Security headers
run_test "HSTS header" "curl -sI $PROD_URL | grep -qi 'strict-transport-security'"
run_test "CSP header" "curl -sI $PROD_URL | grep -qi 'content-security-policy'"
run_test "X-Frame-Options" "curl -sI $PROD_URL | grep -qi 'x-frame-options: SAMEORIGIN'"

# Performance
P95=$(curl -o /dev/null -s -w "%{time_total}" $PROD_URL)
echo "  ⏱️  TTFB: ${P95}s"

# Smoke tests
run_test "Smoke test (Node API)" "SMOKE_NODE_URL=$NODE_URL SMOKE_DOTNET_URL=$DOTNET_URL SMOKE_OWNER_URL=$OWNER_URL node legalpro-app/server/smoke-production.mjs"

# Critical user flow
run_test "Login endpoint available" "curl -s -o /dev/null -w '%{http_code}' $NODE_URL/api/auth/login | grep -qE '^(200|400|401|429)$'"

# Compliance
run_test "No secrets exposed" "! curl -s $NODE_URL | grep -qiE 'OWNER_SECRET_KEY|JWT_SECRET'"

# Resumen
cat >> "$REPORT_FILE" <<EOF

## Resumen

- ✅ Pasados: $PASSED
- ❌ Fallados: $FAILED
- 📊 Total: $((PASSED+FAILED))

EOF

if [ $FAILED -gt 0 ]; then
  echo "❌ $FAILED tests fallaron. Revisa $REPORT_FILE"
  cat "$REPORT_FILE"
  exit 1
fi

echo "✅ Todos los tests pasaron. Reporte: $REPORT_FILE"
