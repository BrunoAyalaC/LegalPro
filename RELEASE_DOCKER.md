# RELEASE DOCKER v1.0.0-ALFA — LegalPro / LexIA

> **Fecha:** 1 de agosto de 2026
> **Versión:** v1.0.0-alfa
> **Registry:** Docker Hub (`brunoayala97`)
> **Estado:** ✅ ALFA MONETIZABLE — Imágenes publicadas

---

## 🎯 Resumen Ejecutivo

Se completó el pipeline de Docker build + push para los **4 servicios** de LegalPro, alcanzando el hito de **alfa monetizable**. Todas las imágenes están publicadas en Docker Hub con tags `v1.0.0-alfa` y `latest`.

**Antes del build se resolvieron 2 bloqueadores P0 del frontend:**
- ✅ Bug #7: WizardShell `handleCancel` TDZ (Temporal Dead Zone)
- ✅ Bug #8: CommandPalette Ctrl+K no abría la paleta

---

## 📦 Imágenes Publicadas en Docker Hub

| Imagen | Tag | Tamaño | Digest SHA256 |
|--------|-----|-------:|---------------|
| `brunoayala97/legalpro-frontend` | v1.0.0-alfa + latest | 217 MB | `910ef83cbbc1...` |
| `brunoayala97/legalpro-node-api` | v1.0.0-alfa + latest | 1.37 GB | `70821ba4dbad...` |
| `brunoayala97/legalpro-dotnet-api` | v1.0.0-alfa + latest | 383 MB | `271a78d2fa91...` |
| `brunoayala97/legalpro-owner-dashboard` | v1.0.0-alfa + latest | 207 MB | `e5238f91e541...` |

**Total: 8 tags publicados (4 imágenes × 2 tags)**

---

## 🏗️ Detalles de Build por Servicio

### 1. Frontend (React + Vite + Nginx)
- **Dockerfile:** `legalpro-app/Dockerfile.frontend`
- **Base:** `node:20-alpine` (build) → `nginx:alpine` (runtime)
- **Build time:** ~24s
- **Puerto:** 3000
- **Bundle principal:** 354 KB (103 KB gzip)
- **Validación:** HTTP 200 + contiene "LegalPro" ✅
- **Incluye fixes P0:** WizardShell + CommandPalette ✅

### 2. Backend Node (Express 5)
- **Dockerfile:** `legalpro-app/Dockerfile`
- **Base:** `node:20-alpine` (multi-stage)
- **Puerto:** 3001
- **Usuario:** non-root (`nodejs`, UID 1001)
- **Healthcheck:** `GET /health`
- **Incluye:** catalogs/ (catálogos legales RAG)

### 3. Backend .NET 9 (ASP.NET Core)
- **Dockerfile:** `LegalProBackend_Net/Dockerfile`
- **Base:** `mcr.microsoft.com/dotnet/sdk:9.0` (build) → `aspnet:9.0` (runtime)
- **Puerto:** 5000
- **Usuario:** non-root (`app`)
- **Healthcheck:** `GET /health`
- **Warnings:** 2 pre-existentes (CS8604 null reference, no bloqueantes)

### 4. Owner Dashboard (E2EE)
- **Dockerfile:** `legalpro-owner-dashboard/Dockerfile`
- **Base:** `node:20-alpine` (multi-stage)
- **Puerto:** 3005
- **Usuario:** non-root (`nodejs`, UID 1001)
- **Healthcheck:** `GET /health`

---

## 🔧 Comandos de Uso

### Pull de imágenes
```bash
docker pull brunoayala97/legalpro-frontend:v1.0.0-alfa
docker pull brunoayala97/legalpro-node-api:v1.0.0-alfa
docker pull brunoayala97/legalpro-dotnet-api:v1.0.0-alfa
docker pull brunoayala97/legalpro-owner-dashboard:v1.0.0-alfa
```

### Orquestación local completa
```bash
# Desde la raíz del proyecto
docker compose up -d

# Ver logs
docker compose logs -f

# Detener
docker compose down -v
```

### Run individual (ejemplo frontend)
```bash
docker run -d -p 3000:3000 brunoayala97/legalpro-frontend:v1.0.0-alfa
```

---

## ✅ Verificaciones Realizadas

| Verificación | Resultado |
|--------------|-----------|
| Docker daemon activo | ✅ v28.5.1 |
| Build frontend | ✅ 24s, sin errores |
| Build node-api | ✅ sin errores |
| Build dotnet-api | ✅ 2 warnings pre-existentes |
| Build owner-dashboard | ✅ sin errores |
| Push a Docker Hub | ✅ 8 tags publicados |
| Smoke test frontend | ✅ HTTP 200 + "LegalPro" |
| Fixes P0 incluidos | ✅ WizardShell + CommandPalette |

---

## 🔐 Seguridad de las Imágenes

- ✅ **Non-root:** Todas las imágenes corren con usuario sin privilegios
- ✅ **Multi-stage:** Solo artefactos de producción en imagen final
- ✅ **Healthchecks:** Configurados en todas las imágenes
- ✅ **Sin secretos:** No hay credenciales hardcodeadas en las imágenes
- ⚠️ **Pendiente:** Escaneo de vulnerabilidades con `docker scout` o Trivy

---

## 🚀 Estado Alfa Monetizable

### ✅ Completado
- [x] 4 imágenes Docker buildeadas
- [x] 8 tags publicados en Docker Hub
- [x] Fixes P0 del frontend incluidos
- [x] Smoke test de frontend passing
- [x] Sistema RAG integrado (319 docs legales)
- [x] Compliance LPDP (92%)
- [x] Multi-tenant con RLS

### ⚠️ Pendiente para Producción Full
- [ ] Escaneo de vulnerabilidades (Trivy/docker scout)
- [ ] Configurar variables de entorno reales (secrets rotados)
- [ ] Ejecutar migraciones SQL (MT-03, LPDP-3.5, RAG audit)
- [ ] Desplegar en Railway/producción
- [ ] Resolver 6 bloqueadores P0 restantes del frontend (ver PLAN_REMEDIACION_P0.md)
- [ ] CI/CD con tests automáticos

---

## 📋 Variables de Entorno Requeridas (Producción)

```bash
# Base de datos
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Auth (ROTAR - no usar los de dev)
JWT_SECRET=<generar con: openssl rand -hex 64>

# IA
MINIMAX_API_KEY=<rotada>
OPENAI_API_KEY=<para RAG embeddings>

# OpenCode Go (proveedor IA principal — OPENCODE-FIRST)
OPENCODE_API_KEY=<obtener en https://opencode.ai/auth>
OPENCODE_BASE_URL=https://opencode.ai/api/v1
OPENCODE_MODEL=deepseek/deepseek-v4-flash-0731
OPENCODE_TEMPERATURE=0.2
OPENCODE_MAX_TOKENS=8192

# Visión (MiMo V2.5 de Xiaomi, open source)
MIMO_VISION_API_KEY=<obtener en https://opencode.ai/auth>
MIMO_VISION_MODEL=xiaomi/mimo-v2.5
MIMO_VISION_BASE_URL=https://opencode.ai/api/v1

# RAG
ENABLE_RAG=true

# Owner Dashboard
OWNER_SECRET_KEY=<generar>
OWNER_DECRYPTION_SECRET=<generar>
```

> ⛔ **GEMINI ELIMINADO:** No configurar `GEMINI_API_KEY`. Gemini se elimina definitivamente de la infraestructura (2026-08-01). Ver sección «Migración OPENCODE-FIRST».

---

## 🎯 Próximo Hito: Producción Full

Para pasar de **alfa** a **producción full**:

1. **Sprint 1 (2 semanas):** Resolver 6 bloqueadores P0 restantes del frontend
   - BovedaEvidencia (MOCK → real)
   - MonitorSinoe (MOCK → real)
   - JWT localStorage → httpOnly cookies
   - IADisclaimerModal (1 → 4 disclaimers)
   - Focus trap en modales
   - role="dialog" en modales

2. **Sprint 2 (1 semana):** Escaneo de seguridad + migraciones SQL

3. **Sprint 3 (1 semana):** Deploy producción + CI/CD

**Inversión estimada:** ~$8,000 USD (2 ingenieros × 2 semanas)

---

**Generado por:** `lexia-orchestrator` + subagentes `@devops`, `@frontend`, `@release-manager`
**Fecha:** 1 de agosto de 2026
**Registry:** https://hub.docker.com/u/brunoayala97

> **Disclaimer:** Este release es ALFA. Las imágenes están publicadas pero requieren configuración de secrets reales y resolución de bloqueadores P0 restantes antes de producción con clientes pagos. Los secretos de desarrollo en docker-compose.yml NO deben usarse en producción.

---

## 🔄 Migración OPENCODE-FIRST (2026-08-01)

### Qué cambió

| Antes | Después |
|---|---|
| **Google Gemini** (IA secundaria) | **Eliminado definitivamente** — no usar |
| **MiniMax M3** (IA principal) | Se mantiene en el stack, pero **OpenCode Go pasa a ser el proveedor IA principal** |
| Visión Gemini | **MiMo V2.5 (Xiaomi)** vía OpenCode Go |

### Proveedores activos

1. **OpenCode Go** → `deepseek/deepseek-v4-flash-0731` (texto, razonamiento, RAG, function calling)
2. **MiMo V2.5** → `xiaomi/mimo-v2.5` (visión, OCR, multimodal)
3. **MiniMax M3** → se conserva para casos de uso legados (compatibilidad)

### Cambios de infraestructura incluidos

- `legalpro-app/.env.example`: bloque `OPENCODE_*` + `MIMO_VISION_*`, Gemini eliminado
- `docker-compose.yml`: servicio `node-api` con variables `OPENCODE_*`
- `catalogs/env-vars.md`: documentadas variables OpenCode/MiMo, Gemini marcado eliminado
- `catalogs/opencode-functions.json`: nuevo catálogo de capacidades y modelos OpenCode
- `MAPA_LEGALPRO.md`: stack IA actualizado (OpenCode-First)

### Activación en Railway

1. Obtener API key en https://opencode.ai/auth
2. En cada servicio Railway (`legalpro-node-production`, `legalpro-dotnet-production`):
   - Agregar `OPENCODE_API_KEY` (secret)
   - Agregar `OPENCODE_BASE_URL=https://opencode.ai/api/v1`
   - Agregar `OPENCODE_MODEL=deepseek/deepseek-v4-flash-0731`
   - (opcional) `MIMO_VISION_API_KEY` + `MIMO_VISION_MODEL=xiaomi/mimo-v2.5`
3. **Eliminar** `GEMINI_API_KEY` de todos los servicios
4. Redeploy y validar `/health` + smoke test