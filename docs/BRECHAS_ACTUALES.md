# Brechas Actuales del Sistema LegalPro

> Fecha: 7 de agosto de 2026
> Auditor: verificación integral (solo lectura — verificado en vivo contra producción, BD, git y código local)

---

## 🔴 Brechas CRÍTICAS (bloquean alfa monetizable)

| # | Brecha | Impacto | Solución |
|---|--------|---------|----------|
| 1 | `POST /api/boveda/guardar-documento` → **404 en producción** ("Cannot POST"). Existe en código local (`server/routes/boveda-chat.js`) y montado en `index.js`, pero `boveda-chat.js` **NO está commiteado en git** (git cat-file HEAD = no existe) | Bóveda de evidencia (Ley 27269) rota en prod: el chat no puede guardar documentos generados como evidencia inmutable | Commitear `boveda-chat.js` + cambios de `index.js` → desplegar a Railway |
| 2 | `rag_vectors` = **0 docs** y `rag_vectors_v2` = **0 docs** (confirmado en vivo vía SQL contra BD Railway; pgvector 0.8.2 instalada) | RAG sin datos: retrieval devuelve vacío, respuestas IA sin base legal peruana; ChatIA "cita" sin fuente | Ejecutar `populate-lento.mjs` o `indexer-v2.mjs` (previa validación) con rate limit para poblar `rag_vectors_v2` |
| 3 | **Sin `OPENAI_API_KEY`** en `.env` raíz ni `legalpro-app/.env` | Embeddings limitados a MiniMax `embo-01` (1536 dims) con **RPM 60** → indexación lenta; sin fallback OpenAI | Configurar `OPENAI_API_KEY` en Railway + `.env` (proveedor A según `stress-test.mjs`) |

## 🟠 Brechas ALTAS

| # | Brecha | Impacto | Solución |
|---|--------|---------|----------|
| 4 | Feature completo "generación de documentos desde chat" **NO commiteado**: `server/routes/documento-chat.js` y `server/routes/boveda-chat.js` + referencias en `index.js` ausentes en HEAD (`git grep HEAD` = 0 resultados) | Todo el flujo detectar → redactar → guardar existe solo en disco; cualquier redeploy desde GitHub pierde el feature o rompe el build | `git add` + commit semántico; verificar que `index.js` no importe archivos sin commitear antes de push |
| 5 | `tools/rag/indexer-v2.mjs` → **`node --check` se cuelga** (>25 s sin terminar, reproducido 2 veces) mientras `retrieve.mjs` y `rag-advanced.mjs` pasan OK | No se puede validar sintaxis ni ejecutar el pipeline v2 con confianza → `rag_vectors_v2` no se puebla | Depurar por qué el parseo se cuelga (posible import pesado de `chunker-advanced.mjs` / línea problemática) o usar `populate-lento.mjs` |
| 6 | **Credenciales hardcodeadas en disco**: `populate-rag-minimax.mjs` (DATABASE_URL con password real de Railway) y `datos.txt` (MiniMax key). NO están en git (mitigado) | Riesgo de filtración si se commitean por error; viola regla "NUNCA secretos en código" | Mover a `.env`, rotar las claves expuestas en archivos, añadir `populate-rag-*.mjs`/`datos.txt` a `.gitignore` |

## 🟡 Brechas MEDIAS

| # | Brecha | Impacto | Solución |
|---|--------|---------|----------|
| 7 | **Imagen Railway desincronizada con git**: prod tiene `/api/ai/detectar-documento` (responde 401, auth gate = la ruta existe) pero `/api/boveda/guardar-documento` da 404, mientras que **HEAD no tiene ninguno de los dos** → la imagen activa es un build manual Docker desincronizado del repo | Deploys futuros desde GitHub romperán o perderán features; estado no reproducible | Verificar Source en Railway (GitHub vs Docker Hub) y `RAILWAY_DOCKER_IMAGE` en dashboard; alinear con git |
| 8 | MiniMax **RPM = 60** (`RATE_LIMIT_MINIMAX_RPM=60` en `.env`) | Poblar catálogo completo (46 leyes + jurisprudencia + casaciones) toma horas con retries; `populate-rag-minimax.mjs` reintenta con sleeps de 5-15 s | Subir RPM en plan MiniMax o usar `populate-lento.mjs` con chunking por lotes y checkpointing |
| 9 | `.env` raíz con **placeholders**: `JWT_SECRET=__GENERAR_CON_OPENSSL_RAND_BASE64_48__`, `MINIMAX_API_KEY=__DE_MINIMAX__` | Si alguien usa este `.env` en un entorno, auth e IA quedan rotos silenciosamente (prod responde 401 real → Railway usa sus propios secrets, pero es una trampa local) | Reemplazar placeholders o eliminar el archivo; documentar que los secrets viven en Railway |

## 🟢 Brechas BAJAS

| # | Brecha | Impacto | Solución |
|---|--------|---------|----------|
| 10 | `rag_vectors_v2` **existe pero vacía** (no "no existe" como se hipotetizó): la tabla se creó (probablemente `populate-lento.mjs`) pero nunca se pobló | Estado intermedio: la tabla lista, los datos no | Ejecutar el poblado |
| 11 | **Inconsistencia de dimensiones**: `index-corpus.mjs` crea `rag_vectors` con `vector(768)`; `populate-rag-minimax.mjs` la crea con `vector(1536)` | Si ambos scripts corren sobre la misma tabla, el segundo falla con dimension mismatch (hoy vacía → latente) | Unificar dimensiones según proveedor; usar `rag_vectors_v2` (1536) para MiniMax |
| 12 | `populate-rag-minimax.mjs` ejecuta **`TRUNCATE rag_vectors` antes de poblar** | Si el script falla (rate limit), deja la tabla en 0 — es la causa más probable del estado actual | Cambiar a upsert idempotente (`ON CONFLICT`) como ya hace `populate-lento.mjs` |

## Verificación por componente

| Componente | Estado REAL verificado | Detalle |
|---|---|---|
| **Node API prod** (`legalpro-node-production-34ac`) | 🟢 Vivo | `/health` → 200 `{"status":"ok"}` |
| **Frontend prod** (`legalpro-frontend-production-a988`) | 🟢 Vivo | HTML 200 |
| **.NET API prod** (`legalpro-dotnet-production-5a39`) | 🟢 Vivo | `/health` → 200 "Healthy" |
| `POST /api/ai/detectar-documento` (prod) | 🟢 Existe | Responde 401 (auth gate); NO es 404 como se hipotetizó |
| `POST /api/ai/chat` (prod) | 🟡 No reproducido 500 | Sin token responde 401; el 500 del enunciado no se confirma sin credenciales válidas |
| `POST /api/boveda/guardar-documento` (prod) | 🔴 **404** | "Cannot POST" — no está en la imagen desplegada |
| `POST /api/ai/redactar-documento` (prod) | 🟢 Existe | Responde 401 (auth gate) |
| Agentes arnés | 🟢 OK | **133 archivos** en `.opencode/agents/` = **133 definidos** en `opencode.json`; incluye bancario, contrataciones, aduanero, telecomunicaciones, pesca, seguros, turismo, policial (también en `role-tools.json`, `jerarquia-especialistas.json`, `arneses/registry/agents.json`) |
| `catalogs/codigos-leyes.json` | 🟢 OK | JSON válido, **46** normas |
| `catalogs/reguladores-peru.json` | 🟢 OK | JSON válido, **30** reguladores |
| `catalogs/plazos-procesales.json` | 🟢 OK | JSON válido, **26** plazos |
| `catalogs/tipos-penales-peru.json` | 🟢 OK | JSON válido, **29** tipos |
| `tools/rag/retrieve.mjs` | 🟢 OK | Sintaxis OK; **hybrid search** (BM25 `to_tsvector('spanish')` + pgvector coseno, pesos 0.6/0.4) |
| `tools/rag/rag-advanced.mjs` | 🟢 OK | Sintaxis OK |
| `tools/rag/indexer-v2.mjs` | 🔴 Se cuelga | `node --check` > 25 s sin terminar (673 líneas) |
| BD `rag_vectors` | 🔴 **0 docs** | Vacía (truncada por `populate-rag-minimax.mjs` y nunca repoblada) |
| BD `rag_vectors_v2` | 🟡 0 docs | Tabla existe, vacía (nunca poblada) |
| BD pgvector | 🟢 Instalada | ext 0.8.2 |
| `OPENAI_API_KEY` | 🔴 Ausente | No existe en `.env` raíz ni `legalpro-app/.env` |
| ChatIA.jsx | 🟢 OK | Selector expediente (`expedienteSeleccionado`/`expedienteId`), botón generar documento (`/api/ai/detectar-documento`), descarga PDF (L510) y DOCX (L518) vía `/api/ai/redactar-documento` |
| `server/services/documentoDetector.js` | 🟢 Existe | En disco |
| `server/services/documentoRedactor.js` | 🟢 Existe | En disco |
| `server/services/documentoExportador.js` | 🟢 Existe | En disco y en HEAD |
| `server/routes/documento-chat.js` | 🔴 Sin commitear | En disco, NO en HEAD |
| `server/routes/boveda-chat.js` | 🔴 Sin commitear | En disco, NO en HEAD |
| Git HEAD | 🔴 Desincronizado | `git grep HEAD` no encuentra documento-chat/boveda/detectar-documento en `index.js` ni `routes/` |

## Acciones priorizadas

1. **Commitear el feature de documentos** (`documento-chat.js`, `boveda-chat.js`, cambios en `index.js`, schemas, tests) → `git add` + commit semántico → desplegar a Railway → **responsable: Backend Node (backend-node)**
2. **Verificar Source de Railway** (GitHub vs Docker Hub) y alinear imagen con git; confirmar `RAILWAY_DOCKER_IMAGE` en dashboard → **responsable: DevOps (devops)**
3. **Poblar RAG**: ejecutar `populate-lento.mjs` (o arreglar y ejecutar `indexer-v2.mjs`) contra `rag_vectors_v2` con rate limit; añadir `OPENAI_API_KEY` como fallback → **responsable: Backend Node + SRE**
4. **Remover credenciales hardcodeadas** de `populate-rag-minimax.mjs` y `datos.txt`; rotar las claves → **responsable: Auditor de Seguridad + DevOps**
5. **Unificar dimensiones de embeddings** (768 vs 1536) y convertir `populate-rag-minimax.mjs` a upsert idempotente (sin `TRUNCATE` destructivo) → **responsable: Backend Node**
6. **Verificar el 500 de `/api/ai/chat`** con credenciales reales (el 401 no lo reproduce; el síntoma puede ser MiniMax key o imagen) → **responsable: Smoke Tester + SRE**

---
*Reporte generado por AuditorSeguridad — verificación integral de solo lectura, 7 de agosto de 2026. No se modificó ningún archivo del sistema.*
