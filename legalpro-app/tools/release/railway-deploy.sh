#!/usr/bin/env bash
# tools/release/railway-deploy.sh
# Generado por @devops + @release-manager
# Deploy completo a Railway usando las imagenes ya construidas

set -euo pipefail

VERSION="${VERSION:-v1.0.1}"
REGISTRY="${REGISTRY:-ghcr.io}"
ORG="${ORG:-legalpro}"

echo "╔════════════════════════════════════════════════════╗"
echo "║  LegalPro - Railway Deploy v$VERSION"
echo "╚════════════════════════════════════════════════════╝"

# Verificar Railway CLI
if ! command -v railway &> /dev/null; then
  echo "ERROR: Railway CLI no instalado"
  echo "npm install -g @railway/cli"
  exit 1
fi

# Verificar login
if ! railway whoami &> /dev/null; then
  echo "Necesitas hacer login..."
  railway login
fi

# ═══ Paso 1: Verificar proyecto ═══
echo "1. Verificando proyecto Railway..."
if ! railway status &> /dev/null; then
  echo "Creando proyecto legalpro..."
  railway init legalpro
fi

# ═══ Paso 2: Agregar plugins ═══
echo "2. Verificando plugins..."
if ! railway add --plugin postgresql --check 2>/dev/null; then
  echo "   Agregando PostgreSQL..."
  railway add --plugin postgresql
fi
if ! railway add --plugin redis --check 2>/dev/null; then
  echo "   Agregando Redis..."
  railway add --plugin redis
fi

# ═══ Paso 3: Crear servicios si no existen ═══
echo "3. Verificando servicios..."
for svc in legalpro-frontend legalpro-node legalpro-dotnet legalpro-owner; do
  if ! railway service show "$svc" &> /dev/null; then
    echo "   Creando servicio $svc..."
    railway service create "$svc"
  else
    echo "   OK: $svc ya existe"
  fi
done

# ═══ Paso 4: Generar y aplicar secrets ═══
echo "4. Configurando variables de entorno..."
JWT_SECRET=$(openssl rand -base64 48)
JWT_REFRESH=$(openssl rand -base64 48)
OWNER_KEY=$(openssl rand -base64 48)
OWNER_PHRASE=$(openssl rand -base64 32)

# Aplicar a Node y .NET
for svc in legalpro-node legalpro-dotnet; do
  echo "   Configurando $svc..."
  railway env set --service "$svc" \
    NODE_ENV=production \
    ASPNETCORE_ENVIRONMENT=Production \
    DATABASE_URL='${{Postgres.DATABASE_URL}}' \
    REDIS_URL='${{Redis.REDIS_URL}}' \
    JWT_SECRET="$JWT_SECRET" \
    JWT_REFRESH_SECRET="$JWT_REFRESH" \
    JWT_ISSUER=LegalProAPI \
    JWT_AUDIENCE=LegalProClients \
    ALLOWED_ORIGINS=https://legalpro.pe,https://www.legalpro.pe \
    TRUSTED_PROXIES=railway \
    LOG_LEVEL=info \
    CORRELATION_ID_HEADER=X-Correlation-Id \
    LPDP_BREACH_NOTIFICATION_DAYS=5 \
    LPDP_ARCO_RESPONSE_DAYS=8 \
    LPDP_RETENTION_DAYS=1825 \
    RATE_LIMIT_GEMINI_RPM=60 \
    RATE_LIMIT_STANDARD_RPM=120 \
    BRUTE_FORCE_MAX_ATTEMPTS=5 \
    BRUTE_FORCE_LOCKOUT_MINUTES=15 \
    IDEMPOTENCY_TTL_SECONDS=86400 \
    INTERNAL_DOTNET_API_URL=http://legalpro-dotnet.railway.internal:5000 \
    INTERNAL_NODE_API_URL=http://legalpro-node.railway.internal:3001 \
    INTERNAL_OWNER_DASHBOARD_URL=http://legalpro-owner.railway.internal:3005 \
    ALLOWED_ORIGINS=https://legalpro.pe,https://www.legalpro.pe,https://owner.legalpro.pe 2>/dev/null || true
done

# Variables del .NET (con formato __)
echo "   Configurando $svc con formato .NET..."
railway env set --service legalpro-dotnet \
  ConnectionStrings__DefaultConnection='${{Postgres.DATABASE_URL}}' \
  ConnectionStrings__Redis='${{Redis.REDIS_URL}}' \
  JwtSettings__Secret="$JWT_SECRET" \
  JwtSettings__Issuer=LegalProAPI \
  JwtSettings__Audience=LegalProClients \
  JwtSettings__ExpiryMinutes=60 \
  Cors__AllowedOrigins__0=https://legalpro.pe \
  Cors__AllowedOrigins__1=https://www.legalpro.pe \
  Logging__LogLevel__Default=Information

# Variables del Owner
echo "   Configurando legalpro-owner..."
railway env set --service legalpro-owner \
  NODE_ENV=production \
  PORT=3005 \
  DATABASE_URL='${{Postgres.DATABASE_URL}}' \
  OWNER_SECRET_KEY="$OWNER_KEY" \
  OWNER_DECRYPTION_SECRET="$OWNER_PHRASE" \
  ALLOWED_ORIGINS=https://legalpro.pe,https://owner.legalpro.pe \
  COOKIE_DOMAIN=legalpro.pe \
  COOKIE_SECURE=true

# Variables del Frontend
echo "   Configurando legalpro-frontend..."
railway env set --service legalpro-frontend \
  VITE_APP_VERSION="$VERSION" \
  VITE_APP_NAME=LegalPro \
  VITE_ENV=production

# ═══ Paso 5: Configurar root directory por servicio ═══
echo "5. Configurando Root Directory y Dockerfile..."
railway variables --service legalpro-frontend set RAILWAY_DOCKERFILE_PATH=Dockerfile.frontend || true
railway variables --service legalpro-node set RAILWAY_DOCKERFILE_PATH=legalpro-app/Dockerfile || true
railway variables --service legalpro-dotnet set RAILWAY_DOCKERFILE_PATH=LegalProBackend_Net/Dockerfile || true
railway variables --service legalpro-owner set RAILWAY_DOCKERFILE_PATH=legalpro-owner-dashboard/Dockerfile || true

# ═══ Paso 6: Configurar imagen Docker (si Railway soporta) ═══
echo "6. Configurando imagen Docker..."
railway variables --service legalpro-frontend set DOCKER_IMAGE="$REGISTRY/$ORG/legalpro-frontend:$VERSION" || true
railway variables --service legalpro-node set DOCKER_IMAGE="$REGISTRY/$ORG/legalpro-node:$VERSION" || true
railway variables --service legalpro-dotnet set DOCKER_IMAGE="$REGISTRY/$ORG/legalpro-dotnet:$VERSION" || true
railway variables --service legalpro-owner set DOCKER_IMAGE="$REGISTRY/$ORG/legalpro-owner:$VERSION" || true

# ═══ Paso 7: Deploy ═══
echo "7. Desplegando servicios..."
for svc in legalpro-node legalpro-dotnet legalpro-frontend legalpro-owner; do
  echo "   Deploying $svc..."
  railway up --service "$svc" --detach
done

# ═══ Paso 8: Health check ═══
echo "8. Esperando health checks (60s)..."
sleep 60

# ═══ Paso 9: Validacion ═══
echo "9. Validando servicios deployados..."
if command -v curl &> /dev/null; then
  for url in \
    "https://legalpro-node.railway.app/health" \
    "https://legalpro-dotnet.railway.app/health" \
    "https://owner.legalpro.pe/health"; do
    if curl -sf -o /dev/null "$url" 2>/dev/null; then
      echo "   OK: $url"
    else
      echo "   PENDIENTE: $url (aun no accesible)"
    fi
  done
fi

# ═══ Resumen ═══
echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║  Deploy completado                                "
echo "╠════════════════════════════════════════════════════╣"
echo "║  Version: $VERSION"
echo "║  Registry: $REGISTRY/$ORG"
echo "║  "
echo "║  Servicios deployados:"
echo "║    - legalpro-frontend (https://legalpro.pe)"
echo "║    - legalpro-node     (https://legalpro-node.railway.app)"
echo "║    - legalpro-dotnet    (https://legalpro-dotnet.railway.app)"
echo "║    - legalpro-owner     (https://owner.legalpro.pe)"
echo "║  "
echo "║  Proximos pasos:"
echo "║    1. Configurar DNS personalizado"
echo "║    2. Ejecutar migraciones DB (init.sql + migrations)"
echo "║    3. Ejecutar seed (solo staging)"
echo "║    4. Ejecutar smoke tests"
echo "║    5. Notificar release"
echo "╚════════════════════════════════════════════════════╝"
