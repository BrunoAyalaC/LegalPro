# 🚂 PLAN DE STAGING SEPARADO — LegalPro en Railway

> **Objetivo**: crear un entorno `staging` físicamente separado de `production` para validar antes de cada deploy a usuarios reales.
> **Tiempo estimado de setup**: 1-2 horas.
> **Quién lo ejecuta**: el usuario (no se puede automatizar desde aquí porque Railway es un servicio externo).

---

## ⚠️ POR QUÉ ES CRÍTICO

**Estado actual** (verificado el 2026-06-27):
- Los tests E2E (`prod-node.test.js`, `prod-dotnet.test.js`, `playwright.config.prod.mjs`) apuntan directamente a `legalpro-node-production-34ac.up.railway.app`, etc.
- Si los corres "para verificar", **estás testeando contra producción con usuarios reales**.
- Cualquier test que cree datos (expedientes, usuarios) **muta la BD real**.
- Si el test falla, **los usuarios reales ven errores 500**.

**Después del fix**:
- Tests apuntan a staging (URL `legalpro-node-staging-*.up.railway.app`).
- Producción nunca se toca durante desarrollo.
- Deploy a producción = cambiar manualmente el tag de imagen en Railway del servicio de producción.

---

## 📋 PASO 1 — Crear proyecto Railway staging

### 1.1 Nuevo proyecto
1. Login en https://railway.app
2. Click **"+ New Project"**
3. Nombre: **`legalpro-staging`**
4. Visibilidad: **Private** (mismo equipo que producción)

### 1.2 Agregar PostgreSQL
1. Click **"+ New Service"** → **"Database"** → **"PostgreSQL"**
2. Espera a que termine el deploy (~2 min)
3. Click en el servicio → tab **"Variables"** → copia el `DATABASE_URL`

### 1.3 Agregar Redis
1. Click **"+ New Service"** → **"Database"** → **"Redis"**
2. Espera el deploy
3. Copia `REDIS_URL` (o `REDIS_PRIVATE_URL` según prefieras)

### 1.4 Crear los 4 servicios backend (deploys vacíos primero)
Para cada uno: **"+ New Service"** → **"Empty Service"** con nombre:
- `legalpro-node-staging`
- `legalpro-dotnet-staging`
- `legalpro-frontend-staging`
- `legalpro-owner-staging`

---

## 📋 PASO 2 — Variables de entorno en staging

Para **CADA servicio de staging**, click en el servicio → tab **"Variables"** → **"+ New Variable"**:

### Servicio `legalpro-node-staging`
```bash
NODE_ENV=staging
PORT=3001
APP_VERSION=staging-1.0.0
APP_URL=https://legalpro-node-staging.up.railway.app

# Database (la del paso 1.2)
DATABASE_URL=postgresql://...@...
PGSSLMODE=require

# Redis (la del paso 1.3)
REDIS_URL=rediss://default:...@...

# Auth — usa MISMAS claves que producción por ahora (o rotadas)
JWT_SECRET=mismo-que-produccion-o-nuevo
JWT_REFRESH_SECRET=mismo-que-produccion-o-nuevo
JWT_EXPIRY_SECONDS=3600
JWT_REFRESH_EXPIRY_SECONDS=2592000
JWT_ISSUER=LegalProAPI
JWT_AUDIENCE=LegalProClients
BCRYPT_ROUNDS=10  # menor para staging = más rápido

# Supabase — usa el proyecto NUEVO de staging (recomendado) o el mismo
SUPABASE_URL=https://staging-xxxxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...

# MiniMax API — usa OTRA key con cuota separada para staging
MINIMAX_API_KEY=mk-...  # key de staging
MINIMAX_MODEL_DEFAULT=MiniMax-M3
MINIMAX_TEMPERATURE_DEFAULT=0.2
MINIMAX_MAX_TOKENS=4096

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Sentry
SENTRY_DSN=https://...@sentry.io/...
```

### Servicio `legalpro-dotnet-staging`
```bash
ASPNETCORE_ENVIRONMENT=Staging
ASPNETCORE_URLS=http://+:8080

# Mismo DATABASE_URL y REDIS_URL
DATABASE_URL=...
REDIS_URL=...

# Auth — DEBE coincidir con Node
JWT_SECRET=mismo
JWT_REFRESH_SECRET=mismo

Minimax__ApiKey=mk-...
```

### Servicio `legalpro-frontend-staging`
```bash
VITE_NODE_API_URL=https://legalpro-node-staging.up.railway.app
VITE_DOTNET_API_URL=https://legalpro-dotnet-staging.up.railway.app
VITE_SUPABASE_URL=https://staging-xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_APK_URL=https://github.com/BrunoAyalaC/Abogacia/releases/download/v1.0/LegalPro-staging.apk
```

### Servicio `legalpro-owner-staging`
```bash
PORT=3005
DATABASE_URL=...
OWNER_SECRET_KEY=...
OWNER_DECRYPTION_SECRET=...
```

---

## 📋 PASO 3 — Conectar imágenes Docker a los servicios staging

Para cada servicio staging:

1. Click en el servicio → tab **"Settings"** → sección **"Deploy"**
2. **Source**: cambia de "GitHub Repo" a **"Docker Image"**
3. **Image**: `brunoayala97/legalpro-node:1.4.0` (o la versión actual)
4. Click **"Deploy"**
5. Espera 2-3 min al primer deploy

Repite para:
- `legalpro-dotnet-staging` ← `brunoayala97/legalpro-dotnet:1.3.0`
- `legalpro-frontend-staging` ← `brunoayala97/legalpro-frontend:1.2.0`
- `legalpro-owner-staging` ← `brunoayala97/legalpro-owner:1.2.0`

---

## 📋 PASO 4 — Inicializar base de datos staging

Conectarse a la base de staging y correr las migraciones:

```bash
# Opción A: desde local (necesitas psql instalado)
psql "$DATABASE_URL_STAGING" -f legalpro-app/server/init.sql

# Opción B: usar un script Node.js
node legalpro-app/server/initDb.js  # lee DATABASE_URL del env
```

Después sembrar usuarios demo:
```bash
node legalpro-app/server/seed.mjs
```

---

## 📋 PASO 5 — Actualizar tests E2E para apuntar a staging

Una vez que los servicios staging estén arriba, actualizar los archivos:

### Archivos a modificar (ya cambiados en este commit):

**`legalpro-app/server/smoke-production.mjs`** y **`deploy-staging/legalpro-app/server/smoke-production.mjs`**:
```javascript
// ANTES (apunta a producción)
const STACKS = {
  node: process.env.SMOKE_NODE_URL || 'https://legalpro-node-production-34ac.up.railway.app',
  // ...
};

// DESPUÉS (apunta a staging por defecto, override por env)
const STACKS = {
  node: process.env.SMOKE_NODE_URL || 'https://legalpro-node-staging.up.railway.app',
  // ...
};
```

**`deploy-staging/legalpro-app/playwright.config.prod.mjs`**:
```javascript
// ANTES
use: { baseURL: 'https://legalpro-frontend-production-a988.up.railway.app', ... }

// DESPUÉS
use: { baseURL: process.env.E2E_FRONTEND_URL || 'https://legalpro-frontend-staging.up.railway.app', ... }
```

**`legalpro-app/server/__tests__/production/prod-node.test.js`** y **`prod-dotnet.test.js`**:
```javascript
// ANTES
const NODE_URL = 'https://legalpro-node-production.up.railway.app';

// DESPUÉS
const NODE_URL = process.env.TEST_NODE_URL || 'https://legalpro-node-staging.up.railway.app';
```

### Override a producción (solo para validar deploy final):
```bash
# Para correr smoke contra producción (post-deploy, smoke manual):
SMOKE_NODE_URL=https://legalpro-node-production-34ac.up.railway.app node smoke-production.mjs
```

---

## 📋 PASO 6 — Verificación final

Después de todo configurado:

- [ ] `https://legalpro-node-staging.up.railway.app/api/health` responde 200
- [ ] `https://legalpro-dotnet-staging.up.railway.app/health` responde 200
- [ ] `https://legalpro-frontend-staging.up.railway.app` carga
- [ ] Login con `abogado@legalpro.pe` / `Demo2026!` funciona en staging
- [ ] `node smoke-production.mjs` (con env vars de staging) pasa 27/27 verifiers
- [ ] E2E `npm run test:prod:e2e` pasa contra staging
- [ ] Producción sigue intacta (no afectada)

---

## 💰 COSTO ESTIMADO

Railway cobra por uso. Staging dormido (servicios con 0 tráfico) cuesta ~$1-3 USD/mes.

---

## 🆘 ROLLBACK

Si staging se rompe:
- Click derecho en servicio → **"Redeploy"** → elige deployment anterior
- O borra el proyecto entero y recrea (es gratis, solo tarda 15 min)

---

## 📅 Log de creación

> Agregar cuando se complete.

### [YYYY-MM-DD] — Pendiente
- [ ] Proyecto Railway `legalpro-staging` creado
- [ ] PostgreSQL + Redis staging provisionados
- [ ] 4 servicios staging deployados
- [ ] Variables de entorno configuradas
- [ ] `init.sql` corrido en staging
- [ ] Tests E2E redirigidos a staging (cambios ya committeados)
- [ ] Smoke tests pasan 27/27 en staging
- [ ] Producción intacta verificada