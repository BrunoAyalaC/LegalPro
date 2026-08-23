# Variables de Entorno — Catálogo canónico

> Reemplaza la duplicación que existía en 3 archivos: `devops.agent.md`, `deploy-backend/SKILL.md`, `copilot-instructions.md`.

## Formato

| Campo | Descripción |
|---|---|
| `nombre` | Nombre exacto de la variable (mayúsculas, snake_case) |
| `proposito` | Para qué se usa |
| `requerida` | Si es obligatoria para arrancar el servicio |
| `secret` | Si es información sensible (nunca commitear) |
| `default` | Valor por defecto si no se provee (NUNCA secretos) |
| `validacion` | Regex o constraints (longitud, charset) |
| `entorno` | dev / staging / prod / all |
| `servicios` | Qué servicios la consumen |
| `ejemplo_enmascarado` | Ejemplo con valores enmascarados (e.g. `sk-***`) |

## Variables comunes

### Auth / JWT

| nombre | proposito | requerida | secret | default | validacion | entorno | servicios | ejemplo_enmascarado |
|---|---|---|---|---|---|---|---|---|
| `JWT_SECRET` | Firma de tokens JWT HS256 | sí | sí | — | `>=32 chars`, base64 | all | node, dotnet | `mi-clave-super-secreta-de-32+chars...` |
| `JWT_EXPIRY_SECONDS` | Expiración de access token | sí | no | `3600` | int > 0 | all | node, dotnet | `3600` |
| `JWT_REFRESH_EXPIRY_SECONDS` | Expiración de refresh token | sí | no | `2592000` | int > 0 | all | node, dotnet | `2592000` |
| `JWT_ISSUER` | Issuer claim | sí | no | `LegalProAPI` | string | all | node, dotnet | `LegalProAPI` |
| `JWT_AUDIENCE` | Audience claim | sí | no | `LegalProClients` | string | all | node, dotnet | `LegalProClients` |

### Database

| nombre | proposito | requerida | secret | default | validacion | entorno | servicios | ejemplo_enmascarado |
|---|---|---|---|---|---|---|---|---|
| `DATABASE_URL` | Connection string Postgres | sí | sí | — | `postgres://` o `postgresql://` | all | node, dotnet | `postgresql://user:***@host:5432/db` |
| `PGSSLMODE` | Modo SSL PG | sí | no | `Require` | enum: `Disable, Require, VerifyCA, VerifyFull` | prod | node, dotnet | `Require` |
| `PG_POOL_SIZE` | Tamaño del pool | no | no | `10` | int 1-100 | all | node, dotnet | `10` |
| `PG_STATEMENT_TIMEOUT_MS` | Timeout de statement | no | no | `30000` | int > 0 | all | node, dotnet | `30000` |

### Supabase

| nombre | proposito | requerida | secret | default | validacion | entorno | servicios | ejemplo_enmascarado |
|---|---|---|---|---|---|---|---|---|
| `SUPABASE_URL` | URL del proyecto | sí | no | — | `https://*.supabase.co` | all | node, dotnet | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Key pública cliente | sí | sí | — | `^eyJ` (JWT) | all | node, dotnet | `eyJhbGciOiJIUzI1NiIs***` |
| `SUPABASE_SERVICE_KEY` | Service role key | sí | sí | — | `^eyJ` (JWT) | all | node, dotnet | `eyJhbGciOiJIUzI1NiIs***` |
| `SUPABASE_STORAGE_BUCKET_EVIDENCIA` | Bucket para evidencia | sí | no | `evidencia` | string sin espacios | all | node, dotnet | `evidencia` |

### OpenCode Go (proveedor IA principal) — reemplaza a Gemini

> **Migración OPENCODE-FIRST (2026-08):** OpenCode Go es el proveedor de IA principal.
> Plan de bajo costo con modelos open (DeepSeek V4 Flash). API key: https://opencode.ai/auth
> API compatible con el formato OpenAI (`/chat/completions`, streaming, function calling, embeddings).

| nombre | proposito | requerida | secret | default | validacion | entorno | servicios | ejemplo_enmascarado |
|---|---|---|---|---|---|---|---|---|
| `OPENCODE_API_KEY` | API key de OpenCode Go | sí | sí | — | string no vacío | all | node, dotnet | `oc-***` |
| `OPENCODE_BASE_URL` | Base URL de la API de OpenCode | no | no | `https://opencode.ai/api/v1` | URL `https://` | all | node, dotnet | `https://opencode.ai/api/v1` |
| `OPENCODE_MODEL` | Modelo por defecto (DeepSeek V4 Flash) | no | no | `deepseek/deepseek-v4-flash-0731` | string | all | node, dotnet | `deepseek/deepseek-v4-flash-0731` |
| `OPENCODE_TEMPERATURE` | Temperatura por defecto | no | no | `0.2` | float 0-1 | all | node, dotnet | `0.2` |
| `OPENCODE_MAX_TOKENS` | Tokens máximos output | no | no | `8192` | int > 0 | all | node, dotnet | `8192` |
| `MIMO_VISION_API_KEY` | API key para visión (MiMo V2.5) | condicional | sí | — | string no vacío | all | node, dotnet | `mimo-***` |
| `MIMO_VISION_MODEL` | Modelo de visión (Xiaomi MiMo) | no | no | `xiaomi/mimo-v2.5` | string | all | node, dotnet | `xiaomi/mimo-v2.5` |
| `MIMO_VISION_BASE_URL` | Base URL de visión | no | no | `https://opencode.ai/api/v1` | URL `https://` | all | node, dotnet | `https://opencode.ai/api/v1` |
| `RATE_LIMIT_OPENCODE_RPM` | RPM para endpoints IA OpenCode | no | no | `60` | int > 0 | all | node, dotnet | `60` |

**Notas:**
- `OPENCODE_API_KEY` es **obligatoria** en producción; el servicio debe fallar rápido (fail-fast) si falta.
- `MIMO_VISION_API_KEY` es `condicional`: solo se exige en flujos que usan visión/OCR (MiMo V2.5).
- La API de OpenCode Go es compatible con el SDK OpenAI, lo que simplifica la migración.

### Google Gemini (ELIMINADO — no usar)

> **⛔ ELIMINADO definitivamente (2026-08-01).** Gemini se elimina para siempre de la infraestructura.
> No configurar ni usar `GEMINI_API_KEY` en ningún entorno. Todas las variables Gemini quedan obsoletas.

| nombre | proposito | requerida | secret | default | validacion | entorno | servicios | ejemplo_enmascarado |
|---|---|---|---|---|---|---|---|---|
| `GEMINI_API_KEY` | ~~API key de Google AI~~ | ❌ eliminada | sí | — | — | — | — | — |
| `GEMINI_MODEL_DEFAULT` | ~~Modelo por defecto~~ | ❌ eliminada | no | `gemini-2.5-flash` | — | — | — | — |
| `GEMINI_TEMPERATURE_DEFAULT` | ~~Temperatura por defecto~~ | ❌ eliminada | no | `0.2` | — | — | — | — |
| `GEMINI_MAX_TOKENS` | ~~Tokens máximos output~~ | ❌ eliminada | no | `8192` | — | — | — | — |
| `GEMINI_QUOTA_ALERT_USD` | ~~Alerta de cuota USD~~ | ❌ eliminada | no | `500` | — | — | — | — |

### RAG / Embeddings (OpenAI + pgvector)

| nombre | proposito | requerida | secret | default | validacion | entorno | servicios | ejemplo_enmascarado |
|---|---|---|---|---|---|---|---|---|
| `OPENAI_API_KEY` | API key de OpenAI (embeddings, legacy) | condicional | sí | — | `^sk-` | all | node, dotnet | `sk-***` |
| `ENABLE_RAG` | Feature flag RAG global (`true` activa) | no | no | `false` | bool (`true`/`false`) | all | node, dotnet | `true` |
| `RAG:EmbeddingModel` | Modelo de embeddings (override) | no | no | `text-embedding-3-small` | enum: `text-embedding-3-small`, `text-embedding-3-large` | all | dotnet | `text-embedding-3-small` |
| `RAG:TopK` | Top-K por defecto en retrieval | no | no | `5` | int 1-50 | all | dotnet | `5` |
| `RAG:Threshold` | Umbral similitud coseno por defecto | no | no | `0.70` | float 0.0-1.0 | all | dotnet | `0.70` |

**Notas:**

- `OPENAI_API_KEY` es `condicional` porque solo se exige cuando `ENABLE_RAG=true` (embeddings legacy).
- Para embeddings con OpenCode Go (recomendado OPENCODE-FIRST), usar `OPENCODE_API_KEY` (ver sección OpenCode Go).
- Sin `ENABLE_RAG=true`, los endpoints `/api/ai/rag/*` devuelven 503 Service Unavailable
  sin llamar a OpenAI ni a la BD (fail-fast controlado).
- `RAG:EmbeddingModel` debe coincidir con las dimensiones del índice pgvector:
  actualmente el corpus `rag_vectors` usa `vector(768)` (configurado al indexar).

### Frontend (Vite)

| nombre | proposito | requerida | secret | default | validacion | entorno | servicios | ejemplo_enmascarado |
|---|---|---|---|---|---|---|---|---|
| `VITE_NODE_API_URL` | URL del backend Node | sí | no | `http://localhost:3000` | URL | all | frontend | `https://legalpro-node.railway.app` |
| `VITE_DOTNET_API_URL` | URL del backend .NET | sí | no | `http://localhost:5000` | URL | all | frontend | `https://legalpro-dotnet.railway.app` |
| `VITE_SUPABASE_URL` | Supabase URL (público) | sí | no | — | URL | all | frontend | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (público) | sí | sí | — | `^eyJ` | all | frontend | `eyJhbGciOiJIUzI1NiIs***` |
| `VITE_SENTRY_DSN` | Sentry DSN (opcional) | no | sí | — | URL | prod | frontend | `https://***@sentry.io/123` |

### Observability

| nombre | proposito | requerida | secret | default | validacion | entorno | servicios | ejemplo_enmascarado |
|---|---|---|---|---|---|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Endpoint OTel | no | no | — | URL | prod | node, dotnet | `https://api.honeycomb.io` |
| `OTEL_EXPORTER_OTLP_HEADERS` | Headers OTel | no | sí | — | string | prod | node, dotnet | `x-honeycomb-team=***` |
| `SENTRY_DSN` | Sentry DSN backend | no | sí | — | URL | prod | node, dotnet | `https://***@sentry.io/123` |
| `LOG_LEVEL` | Nivel de log | no | no | `Information` | enum | all | node, dotnet | `Information` |
| `CORRELATION_ID_HEADER` | Header de correlation | no | no | `X-Correlation-Id` | string | all | node, dotnet | `X-Correlation-Id` |

### Rate Limit / Brute Force

| nombre | proposito | requerida | secret | default | validacion | entorno | servicios | ejemplo_enmascarado |
|---|---|---|---|---|---|---|---|---|
| `RATE_LIMIT_GEMINI_RPM` | ~~RPM para endpoints Gemini~~ (obsoleta — Gemini eliminado) | ❌ | no | `60` | — | — | — | — |
| `RATE_LIMIT_OPENCODE_RPM` | RPM para endpoints IA OpenCode | no | no | `60` | int > 0 | all | node, dotnet | `60` |
| `RATE_LIMIT_STANDARD_RPM` | RPM general | no | no | `120` | int > 0 | all | node, dotnet | `120` |
| `BRUTE_FORCE_MAX_ATTEMPTS` | Intentos antes de lockout | no | no | `5` | int > 0 | all | node, dotnet | `5` |
| `BRUTE_FORCE_LOCKOUT_MINUTES` | Duración de lockout | no | no | `15` | int > 0 | all | node, dotnet | `15` |

### Almacenamiento

| nombre | proposito | requerida | secret | default | validacion | entorno | servicios | ejemplo_enmascarado |
|---|---|---|---|---|---|---|---|---|
| `UPLOADS_DIR` | Directorio de uploads | sí | no | `/app/uploads` | path absoluto | all | node | `/app/uploads` |
| `MAX_UPLOAD_SIZE_MB` | Tamaño máximo upload | no | no | `50` | int > 0 | all | node | `50` |

### CI/CD (GitHub Actions)

| nombre | proposito | requerida | secret | default | validacion | entorno | servicios | ejemplo_enmascarado |
|---|---|---|---|---|---|---|---|---|
| `GHCR_TOKEN` | Token GHCR | sí | sí | — | `ghp_` | CI | — | `ghp_***` |
| `RAILWAY_TOKEN` | Token Railway deploy | sí | sí | — | string | CI | — | `***` |

## Reglas duras

1. **NUNCA** commitear valores de secrets
2. **SIEMPRE** usar `appsettings.Development.json` o `.env.local` (en `.gitignore`)
3. **SIEMPRE** validar al arranque del servicio
4. **SIEMPRE** fallar rápido si una variable requerida falta
5. **SIEMPRE** documentar el cambio en este catálogo
6. **SIEMPRE** rotar secrets cada 90 días (ver `gestionar-secret-rotation`)
7. **SIEMPRE** auditar en `verifier-secretos.mjs`

## Cómo se inyectan

- **Node**: `process.env.NOMBRE` (con validación en `config.js` o `env.js`)
- **.NET**: `IConfiguration["Nombre"]` (con `EnvironmentVariables` provider)
- **Vite**: `import.meta.env.VITE_NOMBRE` (expuesto al cliente)
- **Docker**: `--env-file .env` o secrets de Railway
- **CI**: `${{ secrets.NOMBRE }}` en GitHub Actions

## Auditoría

Cada cambio en este archivo requiere PR con sign-off de @DevOps y @AuditorSeguridad.
