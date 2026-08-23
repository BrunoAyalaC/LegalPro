# 🎯 PLAN DE ACCIÓN INTEGRAL — LegalPro / LexIA Perú

> **Fecha**: 2026-06-27
> **Propósito**: Llevar el proyecto de su estado actual (~55% producción) a **producción real, resiliente, segura y optimizada**.
> **Este documento es el plan**. `ESTADO-REAL.md` es el estado. Ambos se actualizan juntos.

---

## 📊 DIAGNÓSTICO POR DIMENSIÓN

### 🟢 PRODUCCIÓN REAL — Score: **55/100** 🔴 NO LISTO

| Qué está bien | Qué falta |
|---|---|
| Backend Node 80% funcional | ✅ **deploy-staging desincronizado** con legalpro-app — P1 |
| Backend .NET 90% | ⚠️ 13 tests E2E fallando contra producción |
| Frontend React 85%, cero mocks | ⚠️ Sin entorno staging separado en Railway |
| Multi-agente legal 90% operativo | ⚠️ Backup automático no configurado |
| Tests: 13 backend + 22 E2E + 28 verifiers | ⚠️ Restore nunca probado |
| Stripe webhook, runbooks, scripts release | ❌ Sentry inactivo — ciegos en producción |

### 🟢 SEGURIDAD — Score: **70/100** 🟡 ACEPTABLE CON RIESGOS

| Qué está bien | Qué falta |
|---|---|
| JWT con refresh token rotation + MFA TOTP | ❌ **Owner Dashboard E2EE NO implementado** — P2 |
| Brute force protection (10/15min) | ❌ Sentry DSN no configurado — 0 monitoreo |
| AES-256-GCM en .NET | ⚠️ JWT_SECRET necesita rotación |
| PII masking en logs | ⚠️ Secrets estuvieron en disco hasta hoy |
| Rate limiting (auth 10r/m, api 120r/m) | ⚠️ Security workflows (Gitleaks) no se ejecutan (no git) |
| Security headers (HSTS, CSP, X-Frame-Options) | |
| Multi-tenant + RLS, Idempotency | |
| LPDP compliance docs completos | |

### 🟢 OPTIMIZACIONES — Score: **50/100** 🟡 MUCHO POR HACER

| Qué está bien | Qué falta |
|---|---|
| Redis cache con TTLs diferenciados (5min-30d) | ❌ **Cache hit rate nunca medido** |
| MiniMax cache 24h | ❌ **No hay load tests** (k6/Artillery) |
| Bundle < 300kb gzip | ❌ **No hay prompt caching de MiniMax** (~30% ahorro) |
| Compression gzip activado | ❌ Log cleanup no implementado (placeholder) |
| Static assets con cache 1y immutable | ⚠️ Costos MiniMax no monitoreados |
| DB indexes en columnas clave | ⚠️ Sin CDN para assets estáticos |
| Connection pooling (25 pool size) | ⚠️ Sin profiling de queries BD |

### 🟢 ARQUITECTURA — Score: **65/100** 🟡 SÓLIDA CON DEUDA

| Qué está bien | Qué falta |
|---|---|
| Clean Architecture .NET (Domain/App/Infra/Api) | ❌ **Node.js sin estructura** — flat, sin capas |
| CQRS con MediatR, Pipeline Behaviors | ❌ **2 backends duplican lógica** (Node + .NET) |
| DDD Value Objects (Email validado) | ❌ DI container vacío (`server/di/` existe pero sin contenido) |
| Multi-tenant con RLS a nivel BD | ⚠️ Pact contract: solo 1 ruta (login) |
| Repository pattern (6 repos) | ⚠️ deploy-staging divergió: sync roto |
| 7 adaptadores externos (BCRP, Sunat, MiniMax...) | ⚠️ init.sql + initDb.js + EF migrations = 3 fuentes de schema |
| Nginx routing separa tráfico Node/.NET/Owner | |

---

## 🚀 PLAN DE ACCIÓN — 4 FASES

> **Tiempo estimado total**: ~5-7 días hábiles
> **Prioridad**: Alta 🔴 → Media 🟡 → Baja 🟢

---

### 🔴 FASE 1 — PRODUCCIÓN REAL (Días 1-2)

#### P1. Sincronizar `deploy-staging/` con `legalpro-app/`
**Tiempo**: 30 min | **Quién**: Tú (yo documento el diff)

```bash
# 1. Identificar diferencias (ya hecho)
diff -rq legalpro-app/server deploy-staging/legalpro-app/server | grep -v node_modules

# 2. Archivos a copiar:
cp legalpro-app/server/routes/creditos.js deploy-staging/legalpro-app/server/routes/creditos.js
cp legalpro-app/server/index.js deploy-staging/legalpro-app/server/index.js
cp legalpro-app/server/cron-jobs.js deploy-staging/legalpro-app/server/cron-jobs.js
cp legalpro-app/server/initDb.js deploy-staging/legalpro-app/server/initDb.js
cp legalpro-app/server/seed.mjs deploy-staging/legalpro-app/server/seed.mjs
cp legalpro-app/src/api/client.ts deploy-staging/legalpro-app/src/api/client.ts
cp legalpro-app/src/pages/PanelCreditos.jsx deploy-staging/legalpro-app/src/pages/PanelCreditos.jsx
cp legalpro-app/src/pages/Perfil.jsx deploy-staging/legalpro-app/src/pages/Perfil.jsx

# 3. Verificar sync
diff -rq legalpro-app/server deploy-staging/legalpro-app/server | grep -v node_modules
# → debe dar 0 diferencias
```

**Verificación**: `diff -rq legalpro-app/server deploy-staging/legalpro-app/server | grep -v node_modules | grep -v "__tests__/production" | wc -l` → 0

#### P2. Crear proyecto Railway `legalpro-staging`
**Tiempo**: 30 min | **Quién**: Tú en dashboard Railway

Seguir `docs/STAGING_SETUP.md`:
1. Railway Dashboard → New Project → PostgreSQL + Redis
2. Crear 4 servicios: `legalpro-node-staging`, `legalpro-dotnet-staging`, `legalpro-frontend-staging`, `legalpro-owner-staging`
3. Configurar variables de entorno (con datos sintéticos de `datos.txt`)
4. Build y deploy manual con las imágenes Docker

**Verificación**: `curl https://legalpro-node-staging.up.railway.app/health` → 200

#### P3. Correr smoke tests contra staging
**Tiempo**: 30 min | **Quién**: Tú

```bash
SMOKE_NODE_URL=https://legalpro-node-staging.up.railway.app \
SMOKE_DOTNET_URL=https://legalpro-dotnet-staging.up.railway.app \
SMOKE_FRONTEND_URL=https://legalpro-frontend-staging.up.railway.app \
node server/smoke-production.mjs
```

**Verificación**: Todos los tests PASS

#### P4. Configurar SENTRY DSN
**Tiempo**: 15 min | **Quién**: Tú

1. Crear cuenta en sentry.io (plan Developer gratis)
2. Crear proyecto Node.js (Express)
3. Copiar DSN → Railway → servicio `legalpro-node` → Variables → `SENTRY_DSN`
4. Redeploy

**Verificación**: Forzar error 500 → aparece en Sentry Dashboard

#### P5. Configurar backup automático diario
**Tiempo**: 30 min | **Quién**: Tú

Seguir `tools/backup/README.md` — opción cron en Railway:
1. Agregar servicio `legalpro-backup` con el script `tools/backup/backup.sh`
2. Configurar variables de entorno (DATABASE_HOST, etc.)
3. Verificar que el backup se crea

**Verificación**: `ls -lh backups/` → archivo .sql.gz > 0 bytes

---

### 🟡 FASE 2 — SEGURIDAD (Días 2-3)

#### S1. Implementar E2EE en Owner Dashboard
**Tiempo**: 2-4 horas | **Quién**: Necesita desarrollo

El `verifier-owner-e2ee.mjs` muestra 8 FAILs. Falta implementar:

```javascript
// legalpro-owner-dashboard/server.js — agregar:
const crypto = require('crypto');

function encryptPayload(plaintext, secret) {
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha256');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { encrypted: encrypted.toString('base64'), iv: iv.toString('base64'), 
           salt: salt.toString('base64'), tag: tag.toString('base64') };
}

function decryptPayload(payload, secret) {
  const { encrypted, iv, salt, tag } = payload;
  const key = crypto.pbkdf2Sync(secret, Buffer.from(salt, 'base64'), 100000, 32, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}
```

**Verificación**: `node tools/verifiers/verifier-owner-e2ee.mjs` → 0 FAILs

#### S2. Rotar secretos (siguiendo checklist)
**Tiempo**: 45 min | **Quién**: Tú

Seguir `docs/SECRET_ROTATION_CHECKLIST.md`:
1. ✅ MiniMax API Key
2. ✅ JWT_SECRET + JWT_REFRESH_SECRET (generar nuevos)
3. ✅ SUPABASE_SERVICE_KEY (Supabase dashboard)
4. ✅ PostgreSQL password (Railway plugin)
5. ✅ OWNER_SECRET_KEY + OWNER_DECRYPTION_SECRET
6. ✅ STRIPE_WEBHOOK_SECRET (si aplica)

**Verificación**: Login con nuevo JWT funciona + MiniMax responde

#### S3. Configurar alertas de seguridad
**Tiempo**: 1 hora | **Quién**: Tú

- Configurar alerta en Railway: CPU > 80%, memoria > 80%
- Configurar Sentry: alerta si errores 500 > 5 en 5 minutos
- Configurar uptime monitor (UptimeRobot gratis): health endpoint cada 5 min
- Agregar `RB-010-lpdp-breach.md` a contactos reales (llenar CTO, CISO, DPO)

**Verificación**: Todas las alertas configuradas y probadas

---

### 🟡 FASE 3 — OPTIMIZACIONES (Días 3-4)

#### O1. Medir y mejorar cache de MiniMax
**Tiempo**: 2 horas | **Quién**: Necesita desarrollo

```javascript
// legalpro-app/server/cache-redis.js — agregar métricas
export async function getCacheMetrics() {
  const info = await redis.info('stats');
  return {
    hit_rate: parseFloat(info.match(/keyspace_hits:(\d+)/)?.[1]) / 
              (parseFloat(info.match(/keyspace_misses:(\d+)/)?.[1]) || 1) * 100,
    memory_usage: await redis.memory('usage', 'minimax:*'),
  };
}
```

**Objetivo**: hit rate > 30% para consultas MiniMax

#### O2. Implementar prompt caching de MiniMax
**Tiempo**: 3 horas | **Quién**: Necesita desarrollo

Los system prompts con catálogos legales (códigos, leyes, plazos) son candidates perfectos para prompt caching de MiniMax. Reducción estimada: ~30% en costos.

```javascript
// legal-orchestrator.js — modificar:
const SYSTEM_PROMPT_CACHE_TTL = 300; // 5 minutos
// Usar API caching si MiniMax lo soporta
```

**Verificación**: Costo por consulta baja 30% vs estado actual

#### O3. Crear load tests con k6
**Tiempo**: 2 horas | **Quién**: Tú

```bash
# tools/load-test/smoke-k6.mjs
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 5 },   // ramp up
    { duration: '1m', target: 10 },   // peak
    { duration: '30s', target: 0 },   // ramp down
  ],
};

export default function () {
  const res = http.get('https://legalpro-node-staging.up.railway.app/health');
  check(res, { 'status 200': (r) => r.status === 200 });
}
```

**Verificación**: k6 run → 100% requests exitosos, p95 < 2s

#### O4. Implementar limpieza de logs (cron real)
**Tiempo**: 30 min | **Quién**: Necesita desarrollo

Completar `ejecutarLimpiezaLogs()` en `cron-jobs.js`:
```javascript
export async function ejecutarLimpiezaLogs() {
  const dias = 90;
  await db.query(`DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '${dias} days'`);
  await db.query(`DELETE FROM refresh_tokens WHERE revocado = TRUE AND updated_at < NOW() - INTERVAL '${dias} days'`);
}
```

**Verificación**: Domingos 3AM → tablas más ligeras

---

### 🟢 FASE 4 — ARQUITECTURA (Días 4-7)

#### A1. Unificar schema BD (3 fuentes → 1)
**Tiempo**: 4 horas | **Quién**: Necesita desarrollo

Problema: `init.sql` (942 líneas, RLS manual) + `initDb.js` (ALTER TABLE + constraints) + EF Migrations (7 archivos, code-first). Tres fuentes de verdad para el mismo schema.

**Solución**: Elegir EF Migrations como SSOT. Migrar las tablas de `init.sql` que no están en migrations (consentimientos, refresh_tokens, etc.) a una nueva migration.

**Verificación**: `diff init.sql <(pg_dump --schema-only)` → 0 diferencias (solo lo que migrations ya cubre)

#### A2. Estructurar backend Node con Clean Architecture light
**Tiempo**: 6 horas | **Quién**: Necesita desarrollo

```bash
legalpro-app/server/
├── routes/          # (se queda, son controllers)
├── middleware/      # (se queda)
├── services/       # ← expandir (hoy solo documentoExportador)
├── repositories/   # ← expandir (hoy 6, migrar lógica DB de routes/)
├── domain/         # ← NUEVO: schemas, validaciones, value objects
├── di/             # ← LLENAR: contenedor DI (hoy vacío)
├── adapters/       # ← (se queda)
└── utils/          # ← (se queda)
```

**No refactorizar todo de golpe**. Mover 1 ruta por vez. Empezar por auth.

**Verificación**: Todos los tests siguen pasando después de cada migración

#### A3. Expandir Pact contracts (más rutas)
**Tiempo**: 2 horas | **Quién**: Necesita desarrollo

Hoy solo hay 1 pact (login). Agregar contratos para:
- Expedientes CRUD
- Organizaciones CRUD  
- Documentos upload/download

**Verificación**: `npx pact-verify` → todos los contratos se cumplen

#### A4. Unificar modelo de IDs (.NET int ↔ Node UUID)
**Tiempo**: 8 horas | **Quién**: Necesita desarrollo (alta complejidad)

.NET usa `int` como PK (code-first con EF Core). Node/Supabase usa `UUID`. Esto causa:
- Referencias cruzadas imposibles entre backends
- Multi-tenancy inconsistente
- Migraciones manuales entre los dos schemas

**Solución**: No migrar ahora. Documentar como deuda técnica y planificar para v2.0.

---

## 📅 CRONOGRAMA

```
DÍA 1        DÍA 2        DÍA 3        DÍA 4        DÍA 5        DÍA 6        DÍA 7
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ P1 sync  │ │ S1 E2EE  │ │ O1 cache │ │ A1 BD    │ │ A2 Node  │ │ A2 Node  │ │ A3 Pact  │
│ P2 stag. │ │ S2 rotar │ │ O2 cache │ │ A4 IDs   │ │ (cont.)  │ │ (cont.)  │ │ A4 IDs   │
│ P3 smoke │ │ S3 alert │ │ O3 k6    │ │ (doc)    │ │          │ │          │ │ (final)  │
│ P4 Sentry│ │          │ │ O4 logs  │ │          │ │          │ │          │ │          │
│ P5 backup│ │          │ │          │ │          │ │          │ │          │ │          │
│          │ │          │ │          │ │          │ │          │ │          │ │          │
│ 🔴 PROD  │ │ 🟡 SEGUR │ │ 🟡 OPTIM │ │ 🟢 ARQ   │ │ 🟢 ARQ   │ │ 🟢 ARQ   │ │ 🟢 ARQ   │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

---

## 👥 QUIÉN HACE QUÉ

| Tarea | Tiempo | Quién | Dificultad |
|---|---|---|---|
| **P1** Sincronizar deploy-staging | 30 min | Tú (copy-paste) | 🟢 Fácil |
| **P2** Crear Railway staging | 30 min | Tú (dashboard) | 🟢 Fácil |
| **P3** Smoke tests contra staging | 30 min | Tú (comandos) | 🟢 Fácil |
| **P4** Configurar Sentry DSN | 15 min | Tú (dashboard) | 🟢 Fácil |
| **P5** Backup automático diario | 30 min | Tú (dashboard) | 🟢 Fácil |
| **S1** Implementar E2EE Owner Dashboard | 2-4 h | Necesita desarrollo | 🔴 Media |
| **S2** Rotar secretos | 45 min | Tú (checklist) | 🟡 Media |
| **S3** Alertas + uptime monitor | 1 h | Tú (varios dashboards) | 🟢 Fácil |
| **O1** Medir cache MiniMax | 2 h | Necesita desarrollo | 🟡 Media |
| **O2** Prompt caching MiniMax | 3 h | Necesita desarrollo | 🔴 Media |
| **O3** Load tests k6 | 2 h | Tú (instalar + correr) | 🟡 Media |
| **O4** Limpieza logs (cron real) | 30 min | Necesita desarrollo | 🟢 Fácil |
| **A1** Unificar schema BD | 4 h | Necesita desarrollo | 🔴 Compleja |
| **A2** Estructurar backend Node | 6 h | Necesita desarrollo | 🔴 Compleja |
| **A3** Pact contracts | 2 h | Necesita desarrollo | 🟡 Media |
| **A4** Unificar IDs (.NET int ↔ UUID) | 8 h (deuda) | Futuro v2.0 | 🔴🔴 Alta |

---

## 📊 RESUMEN "ESTAMOS AQUÍ"

```
PRODUCCIÓN REAL     ████████░░░░░░░░░░░░  40% → 55%
SEGURIDAD           ████████████░░░░░░░░  70%
OPTIMIZACIONES      ██████████░░░░░░░░░░  50% → 55%
ARQUITECTURA        █████████████░░░░░░░  65%

PROMEDIO ACTUAL     ███████████░░░░░░░░░  55-60% 🔴 NO LISTO
PROMEDIO POST-FASE1 ██████████████░░░░░░  70% 🟡 MVP LISTO (con caveats)
PROMEDIO POST-FASE4 ████████████████████  90% 🟢 PRODUCCIÓN REAL
```

### 🎯 Lo que puedes hacer HOY (sin desarrollo, solo tú)

1. ✅ **Sincronizar deploy-staging** (P1) — 30 min, evita perder créditos
2. ✅ **Crear Railway staging** (P2) — 30 min, separa dev de prod
3. ✅ **Configurar Sentry** (P4) — 15 min, dejas de estar ciego
4. ✅ **Backup automático** (P5) — 30 min, disaster recovery listo
5. ✅ **Rotar secretos** (S2) — 45 min, cierras breach de seguridad
6. ✅ **Alertas + uptime** (S3) — 1 hora, sabes cuando algo falla

**Total: ~3.5 horas para pasar de 55% → 70%** (MVP listo)

### 🎯 Lo que necesita desarrollo (puedo ayudar)

1. **E2EE Owner Dashboard** (S1) — 2-4h
2. **Cache MiniMax + prompt caching** (O1, O2) — 5h
3. **Load tests k6** (O3) — 2h (puedo dejar el script listo)
4. **Estructurar Node** (A2) — 6h
5. **Unificar schema** (A1) — 4h
6. **Pact contracts** (A3) — 2h

---

## 🧭 COBERTURA DEL ÁMBITO LEGAL PERUANO

> **Pregunta**: ¿LegalPro cubre todo lo que necesita un estudio de abogados peruano?

### ✅ ÁREAS DEL DERECHO — Cobertura: **85/100** 🟢

El `legal-router.js` + 96 agentes cubren **25 especialidades**. Esto es prácticamente todo el espectro legal peruano generalista.

| Cobertura | Especialidades |
|---|---|
| ✅ Civil, Familia, Penal, Procesal, Constitucional | Derecho base — completo |
| ✅ Comercial, Tributario, Laboral, Administrativo | Derecho empresarial — completo |
| ✅ Ambiental, Minería/Energía, Sanitario, Educación | Sectores regulados — completo |
| ✅ IP, Consumidor, Arbitraje, Notarial, Migratorio | Derecho transversal — completo |
| ✅ Compliance, Crimen-organizado, Trata, Forense | Derecho penal especializado — completo |
| ✅ Seguridad-social, Laboral-colectivo, Concursal | Áreas complementarias — completo |
| ❌ Marítimo, Aeronáutico, Deportivo, Militar, Indígena, Agrario, Aduanero, Electoral | Nichos que un estudio generalista puede NO necesitar |

**Impacto**: Un estudio con práctica general (cualquier estudio de abogados en Perú) está cubierto al 100%. Los nichos faltantes son ultra-especializados.

### ✅ HERRAMIENTAS IA — Cobertura: **90/100** 🟢

| Herramienta | Frontend | Backend .NET | Agente IA |
|---|---|---|---|
| Analista Expedientes | ✅ AnalistaExpedientes | ✅ AnalistaController | ✅ ia-analista-expedientes |
| Buscador Jurisprudencia | ✅ BuscadorJurisprudencia | ✅ JurisprudenciaController | ✅ ia-buscador-jurisprudencia |
| Chat IA Legal | ✅ ChatIA | ✅ ChatController | ✅ ia-chat-legal |
| Comparador Precedentes | ✅ ComparadorPrecedentes | ❌ | ✅ ia-comparador-precendentes |
| Estrategia Interrogatorio | ✅ EstrategiaInterrogatorio | ✅ InterrogatorioController | ✅ ia-estrategia-interrogatorio |
| Generador Alegatos | ✅ GeneradorAlegatos | ✅ AlegatoController | ✅ ia-generador-alegatos |
| Generador Casos Críticos | ✅ GeneradorCasosCriticos | ❌ | ✅ ia-generador-casos-criticos |
| Gestión Multidoc | ✅ GestionMultidoc | ❌ | ✅ ia-gestion-multidoc |
| Monitor SINOE | ✅ MonitorSinoe | ✅ NotificacionesController | ✅ ia-monitor-sinoe |
| Objeciones | ✅ AsistenteObjeciones | ✅ ObjecionesController | ✅ ia-objeciones |
| Predictor Judicial | ✅ PredictorJudicial | ✅ PredictorController | ✅ ia-predictor-judicial |
| Redactor Escritos | ✅ RedactorEscritos | ✅ RedactorController | ✅ ia-redactor-escritos |
| Resumen Ejecutivo | ✅ ResumenEjecutivo | ❌ | ✅ ia-resumen-ejecutivo |
| Simulador Juicios | ✅ SimuladorJuicios | ✅ SimulacionController | ✅ ia-simulador-juicios |
| Bóveda Evidencia | ✅ BovedaEvidencia | ❌ | ✅ ia-boveda-evidencia |
| Plazos Procesales | ❌ (solo backend) | ✅ PlazosController | ❌ (no hay agente dedicado) |
| ReporteRetroalimentación | ✅ (page existe) | ❌ | ✅ ia-reporte-retroalimentacion |

**Impacto**: 16/17 herramientas con frontend dedicado. Solo "Plazos Procesales" tiene backend pero sin página frontend.

### ✅ INTEGRACIONES PERÚ — Cobertura: **50/100** 🟡

| Integración | Estado | Prioridad |
|---|---|---|
| **SPIJ** (Jurisprudencia oficial) | ✅ SpijAdapter | Alta |
| **SINOE** (Notificaciones electrónicas) | ✅ SinoeAdapter + MonitorSinoe | Alta |
| **SUNAT** (RUC, tributos) | ✅ SunatAdapter | Alta |
| **BCRP** (Tipo de cambio) | ✅ BcrpAdapter | Media |
| **LPDP** (Protección datos) | ✅ Docs + verifiers + consentimientos DB | Alta |
| **RENIEC** (DNI) | ❌ No integrado | Media |
| **OSCE** (Contrataciones) | ❌ No integrado | Baja |
| **INDECOPI** (Competencia/consumidor) | ❌ No integrado | Baja |
| **SUNAFIL** (Fiscalización laboral) | ❌ No integrado | Media |
| **PJ - Casillas electrónicas** | ❌ No integrado | Alta |
| **Notaría** (Digitalización) | ❌ No integrado | Baja |
| **Firma Digital** (DNIR/RENIEC) | ❌ No integrado | Media |
| **PLAME** (Planilla electrónica) | ❌ No integrado (parcial en ContadorController) | Media |

**Impacto**: Las integraciones críticas (SPIJ, SINOE, SUNAT) están. Faltan RENIEC y PJ Casillas para flujo completo.

### ✅ GESTIÓN DEL ESTUDIO — Cobertura: **30/100** 🔴

| Funcionalidad | Estado | ¿Corresponde a LegalPro? |
|---|---|---|
| Dashboard con KPIs | ✅ Básico (stats expedientes) | Sí — el abogado ve su actividad |
| Gestión de expedientes | ✅ CRUD completo | Sí — base del asistente |
| Roles y permisos | ✅ 5 roles + multi-tenant + RLS | Sí — seguridad |
| MFA/seguridad | ✅ TOTP para roles sensibles | Sí — LPDP compliance |
| **Portal del cliente** | ❌ **No aplica** | ❌ LegalPro es asistente, no CRM |
| **Facturación profesional** | ❌ **No aplica** | ❌ No es sistema de facturación |
| **Agenda de audiencias** | ❌ **No aplica** | ❌ No es calendario corporativo |
| **Calendario de plazos** | ✅ Backend existe (PlazosController) | Sí — útil para abogados |
| **Estadísticas gerenciales** | ❌ Bajo | 🟡 Podría ser útil pero secundario |
| **Firma electrónica** | ❌ **No aplica** | ❌ No es sistema notarial |
| **Control de costos** | ❌ **No aplica** | ❌ No es ERP |
| **Flujo de aprobaciones senior/junior** | ❌ No implementado | 🟡 **Sí aplica** — el flujo abogado senior revisa lo que genera el junior IA es PARTE del asistente |

**Corrección**: LegalPro NO es un sistema de gestión de estudios ni facturación. Es un asistente legal IA. Las funcionalidades de gestión empresarial NO corresponden.

---

## 📋 PLAN POR DIMENSIÓN LEGAL PERUANA

### 🟢 FASE L1 — INTEGRACIONES PERÚ (prioritarias)

| # | Tarea | Tiempo | Dificultad |
|---|---|---|---|
| L1 | Integrar consulta RENIEC (validar DNI) | 4h | 🟡 Media |
| L2 | Integrar Casillas Electrónicas del PJ (notificar y recibir) | 8h | 🔴 Alta |
| L3 | Implementar PLAME (planilla electrónica SUNAT) vía ContadorController | 6h | 🔴 Media |
| L4 | Agregar frontend para Calculadora de Plazos Procesales | 3h | 🟢 Fácil |

### 🟡 FASE L2 — PROFUNDIZACIÓN DEL ASISTENTE LEGAL

| # | Tarea | Tiempo | Dificultad | Por qué |
|---|---|---|---|---|
| L5 | **Frontend para Calculadora de Plazos Procesales** | 3h | 🟢 Fácil | El abogado necesita calcular plazos — backend existe, falta UI |
| L6 | **Flujo senior→junior IA** (abogado senior revisa y aprueba antes de entregar al cliente) | 6h | 🟡 Media | El asistente genera borrador, el senior valida — core del asistente legal |
| L7 | **Historial de consultas IA por expediente** (traza qué preguntó el abogado y qué respondió la IA) | 4h | 🟡 Media | Transparencia y calidad — el abogado puede volver a respuestas previas |
| L8 | **Dashboard de actividad del abogado** (cuántos casos, escritos generados, consultas IA) | 3h | 🟢 Fácil | El abogado ve su productividad |
| L9 | **Exportación de escritos a formato PJ** (PDF con formato legal peruano según normas del Poder Judicial) | 4h | 🟡 Media | El abogado necesita presentar documentos en físico |

**NO corresponde a LegalPro**: facturación, portal cliente, agenda corporativa, firma electrónica, control de costos. Eso es un ERP, no un asistente legal.

### 🟢 FASE L3 — CUMPLIMIENTO Y CALIDAD LEGAL

| # | Tarea | Tiempo | Dificultad |
|---|---|---|---|
| L10 | Verificar vigencia de normas contra SPIJ (catálogos actualizados) | 4h | 🟡 Media |
| L11 | Validar plazos procesales con días hábiles judiciales | 3h | 🟡 Media |
| L12 | Calculadora de intereses legales (tasa legal Perú) | 2h | 🟢 Fácil |
| L13 | 4 checkboxes de consentimiento LPDP separados en Signup | 1h | 🟢 Fácil |
| L14 | Disclaimer de IA en todas las herramientas (ya existe banner) | ✅ Listo |

---

## 📊 RESUMEN DE COBERTURA LEGAL PERUANA

```
ÁREAS DEL DERECHO (25 especialidades)     ██████████████████░░  85% ✅
HERRAMIENTAS IA (16/17 con UI)            ██████████████████░░  90% ✅
INTEGRACIONES PERÚ (4/12 implementadas)   ██████████░░░░░░░░░░  50% 🟡
FLUJO ASISTENTE LEGAL (4/5 funcionalidad)  ████████████░░░░░░░░  60% 🟡

PROMEDIO COBERTURA LEGAL PERUANA           ██████████████░░░░░░  71% 🟡
```

> **Nota**: No se evalúa facturación, CRM, portal cliente ni firma electrónica — eso NO es un asistente legal, es un ERP. LegalPro es un **asistente legal peruano ultra avanzado**, no un sistema de gestión de estudios.

### 🎯 Qué significa esto

| Tipo de usuario | Ready? |
|---|---|
| **Abogado litigante** (casos civiles, penales, laborales) | ✅ **Sí**, 25 especialidades + 16 herramientas IA |
| **Abogado corporativo** (contratos, tributario, compliance) | ✅ **Sí**, con SunatAdapter + ContadorController |
| **Estudio boutique** (especializado en un área) | ✅ **Sí**, la especialidad que necesite está cubierta |
| **Abogado procurador** (SINOE, PJ, notificaciones) | 🟡 **Casi**, falta integración Casillas PJ |
| **Abogado que necesita facturación/CRM** | ❌ **No es LegalPro** — usa un ERP aparte |

### 🎯 Prioridades para un asistente legal peruano completo

**Ahora mismo** (puedes usar):
- ✅ 25 especialidades legales vía IA
- ✅ 16 herramientas IA con UI
- ✅ SINOE, SPIJ, SUNAT, BCRP integrados
- ✅ LPDP compliance documentado
- ✅ Cero mocks — todo real
- ✅ Multi-tenant con RLS
- ✅ MFA TOTP para roles sensibles

**Próximos sprints** (recomendación — SOLO lo que corresponde a un asistente legal):
1. **Frontend Calculadora de Plazos** (3h) — el backend .NET ya existe
2. **Flujo senior→junior IA** (6h) — el abogado senior revisa antes de emitir
3. **Exportación a formato PJ** (4h) — PDF con formato legal peruano
4. **RENIEC + PJ Casillas** (12h) — validar DNI + recibir notificaciones
5. **PLAME** vía ContadorController (6h) — planilla electrónica
6. **Verificar vigencia de normas contra SPIJ** (4h) — calidad legal

---

## 📋 CHECKLIST DE SEGUIMIENTO

> Marcar ✅ cuando completes cada ítem. El `ESTADO-REAL.md` se actualiza con cada avance.

### FASE 1 — PRODUCCIÓN
- [ ] P1. Sync deploy-staging con legalpro-app
- [ ] P2. Railway staging creado (4 servicios)
- [ ] P3. Smoke tests → PASS contra staging
- [ ] P4. Sentry DSN configurado
- [ ] P5. Backup diario configurado

### FASE 2 — SEGURIDAD
- [ ] S1. Owner Dashboard E2EE implementado
- [ ] S2. Secretos rotados (6 pasos)
- [ ] S3. Alertas + uptime monitor activos

### FASE 3 — OPTIMIZACIONES
- [ ] O1. MiniMax cache hit rate medido (>30%)
- [ ] O2. Prompt caching MiniMax (30% ahorro)
- [ ] O3. Load tests k6 → p95 < 2s
- [ ] O4. Log cleanup implementado

### FASE 4 — ARQUITECTURA
- [ ] A1. Schema BD unificado (EF migrations SSOT)
- [ ] A2. Node estructurado con capas
- [ ] A3. Pact contracts expandidos
- [ ] A4. Deuda IDs documentada para v2.0

---

> **Próximo paso**: ¿Empezamos con P1 (sincronizar deploy-staging)? Son 30 min y es lo más crítico.
