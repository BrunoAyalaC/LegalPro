# Inventario de Rastros de Gemini (a eliminar)

> Fecha: 6 de agosto de 2026
> Decisión: Eliminar Google Gemini de LegalPro, migrar a OpenCode Go (DeepSeek V4 Flash)
> Alcance: Backend .NET + Backend Node + Configuración + Frontend (UI copy) + Docs/Catálogos
> Ejecutado por: Agente de migración backend (Integraciones/Backend)

---

## Estado de la migración (resumen ejecutivo)

| Categoría | Rastros | Eliminado/Marcado | Pendiente |
|-----------|---------|-------------------|-----------|
| Código .NET (proveedor IA) | 0 archivos físicos GeminiService | ✅ Ya migrado a MiniMax/OpenCode | — |
| Interfaz `IGeminiClient` (legacy name) | 1 (IMinimaxService.cs) | 🟡 Marcado deprecated | Renombrar en otra tarea |
| Controller alias `/api/gemini/*` .NET | 1 (GeminiController.cs) | 🟡 Marcado deprecated (alias CQRS, usa MiniMax) | Eliminar en otra tarea |
| appsettings (bloque Gemini) | 2 | ✅ Eliminado (incluía API key real filtrada) | — |
| Alias `/api/gemini` Node (server/index.js) | 1 | 🟡 Marcado deprecated (NO roto, apunta a aiRoutes) | Eliminar en otra tarea |
| `routes/ai.js` (router IA) | 4 referencias texto | ❌ NO TOCADO (se migra en otra tarea) | Migrar `provider=gemini` |
| `middleware/ragMiddleware.js` | 0 (solo docs lo citan) | ❌ NO TOCADO | — |
| Tests Node (`__tests__`, e2e, smoke) | ~120 refs a `/api/gemini/*` | ❌ NO TOCADOS (dependen del alias) | Reapuntar a `/api/ai/*` |
| Frontend JSX (UI copy "Gemini") | ~20 | ❌ NO TOCADO (cambio de branding, otra tarea) | Reemplazar por OpenCode |
| Docs, catálogos, reports, runbooks | ~400 refs | ❌ NO TOCADO (histórico/auditoría) | Actualización en otra tarea |
| `.env.example` (server) | ya limpio | ✅ Verificado sin GEMINI | — |
| `datos.txt.example` | 1 | ✅ Eliminado | — |
| `docker-compose.yml` | 0 | ✅ Verificado sin GEMINI | — |

---

## Archivos con rastros de Gemini (BACKEND — acción tomada en esta tarea)

| Archivo | Línea(s) | Contenido | Acción |
|---------|----------|-----------|--------|
| `LegalProBackend_Net/LegalPro.Api/appsettings.json` | 16-18 | `"Gemini": { "ApiKey": "SET_VIA_ENV_VAR" }` | ✅ ELIMINADO (bloque sin uso en código) |
| `LegalProBackend_Net/LegalPro.Api/appsettings.Development.json` | 24-26 | `"Gemini": { "ApiKey": "AIzaSy...2Iw" }` | ✅ ELIMINADO (⚠️ API key REAL filtrada) |
| `LegalProBackend_Net/LegalPro.Api/Controllers/GeminiController.cs` | todo | Alias `/api/gemini/*` → handlers CQRS (usa MiniMax) | 🟡 Marcado DEPRECATED en header (no roto: hay clientes) |
| `LegalProBackend_Net/LegalPro.Application/Common/Interfaces/IMinimaxService.cs` | 10, 133 | `interface IGeminiClient` | 🟡 Marcado deprecated (nombre legacy; renombrar rompe build) |
| `LegalProBackend_Net/LegalPro.Application/Common/Interfaces/IMinimaxService.cs` | 100 | `/// Gemini actúa como parte adversarial` | ✅ Comentario actualizado |
| `LegalProBackend_Net/LegalPro.Application/Common/JsonElementExtensions.cs` | 7 | `/// ...Function Calling de Gemini` | ✅ Comentario actualizado |
| `LegalProBackend_Net/LegalPro.Application/Contador/Commands/CalcularLiquidacionLaboralCommand.cs` | 13 | `/// Gemini infiere rangos` | ✅ Comentario actualizado |
| `LegalProBackend_Net/LegalPro.Application/Juez/Queries/CompararPrecedentesQuery.cs` | 12 | `/// Gemini actúa como estudioso` | ✅ Comentario actualizado |
| `LegalProBackend_Net/LegalPro.Application/Jurisprudencia/Queries/BuscarJurisprudenciaQuery.cs` | 10, 73, 141 | `// Gemini actúa como buscador...` | ✅ Comentarios actualizados |
| `LegalProBackend_Net/LegalPro.Application/Plazos/Queries/CalcularPlazosQuery.cs` | 8 | `/// no llama a Gemini` | ✅ Comentario actualizado |
| `LegalProBackend_Net/LegalPro.Application/Simulacion/Commands/ProcesarTurnoCommand.cs` | 130, 133 | `// Ajustar puntaje según evaluación de Gemini` | ✅ Comentarios actualizados |
| `LegalProBackend_Net/LegalPro.Api/Controllers/PlazosController.cs` | 19 | `/// sin llamada a Gemini` | ✅ Comentario actualizado |
| `LegalProBackend_Net/LegalPro.Infrastructure/Services/SimulationService.cs` | 13 | `// DIP: Depends on ISimulationAI, not concrete GeminiService.` | ✅ Comentario actualizado |
| `LegalProBackend_Net/LegalPro.UnitTests/UnitTest1.cs` | 12 | `// No requieren DB ni Gemini` | ✅ Comentario actualizado |
| `LegalProBackend_Net/LegalPro.IntegrationTests/UnitTest1.cs` | 176 | `Chat_Con_FakeGemini_Retorna_Respuesta` | 🟡 Nombre de test legacy (usa FakeMinimaxService) — renombrar en otra tarea |
| `legalpro-app/server/index.js` | 477-478 | `// Ruta /api/gemini mantenida por compatibilidad` + `app.use('/api/gemini', minimaxLimiter, aiRoutes)` | 🟡 Marcado DEPRECATED (NO eliminado: clientes antiguos + tests) |
| `legalpro-app/server/routes/interpretacion-legal.js` | 4 | `// Retorna interpretación ... usando Gemini` | ✅ Comentario actualizado |
| `legalpro-app/server/legal-orchestrator.js` | 198 | `* Llama a un agente jr-especialista via Gemini` | ✅ Comentario actualizado |
| `legalpro-app/server/utils/opencodeClient.js` | 4 | `* Reemplaza a minimaxClient.js y geminiClient.js` | ✅ Comentario actualizado (ya es el proveedor actual) |
| `legalpro-app/server/utils/resilience.js` | 10 | `/// const result = await resilience.call(() => geminiApi.query(prompt));` | ✅ Comentario actualizado |
| `datos.txt.example` | 16 | `- GEMINI_API_KEY=<Google Cloud API Key>` | ✅ ELIMINADO |
| `legalpro-app/.env.example` | 5, 48-49 | comentario "gemini AI", `# GEMINI_API_KEY=  ELIMINADA definitivamente` | ✅ Verificado ya marcado ELIMINADO |

## Archivos NO TOCADOS y por qué (BACKEND)

| Archivo | Rastros | Motivo de NO tocar |
|---------|---------|--------------------|
| `legalpro-app/server/routes/ai.js` | líneas 72, 75, 79, 84 (`provider=gemini`, `IA_PROVIDER_LABEL`) | ⛔ **Instrucción explícita**: se migra en otra tarea. El flag `provider=gemini` es dead-path (solo opera MiniMax M3) pero su remoción exige revisión del contrato de API. |
| `legalpro-app/server/middleware/ragMiddleware.js` | 0 directas | ⛔ **Instrucción explícita**: no tocar. |
| `legalpro-app/server/__tests__/*` (auth, exhaustive, organizaciones, smoke, prod, panel-expertos, expedientes) | ~40 refs a `/api/gemini/*` | ⛔ Tests dependen del alias `/api/gemini` que SÍ existe. Si se elimina el alias sin reemplazo, los tests fallan. Reapuntar a `/api/ai/*` es otra tarea. |
| `legalpro-app/e2e/*.spec.js` | ~80 refs (mocks `**/api/gemini/**`) | ⛔ Mismos motivos: validan resiliencia del alias. |
| `smoke-production.mjs`, `legalpro-app/smoke-production-final.mjs` | ~53 + 2 refs | ⛔ Smoke tests de producción sobre el alias. |
| `LegalProBackend_Net/LegalPro.IntegrationTests/UnitTest1.cs` (test 176) | `Chat_Con_FakeGemini` | ⛔ Nombre legacy pero usa `FakeMinimaxService` real. Renombrar método es trivial pero no bloquea la migración. |

## Variables de entorno

| Variable | Estado | Acción |
|----------|--------|--------|
| `GEMINI_API_KEY` | ❌ Eliminada de .env.example (server + .NET) | ✅ Ya eliminada — NO configurar |
| `GEMINI_MODEL_DEFAULT` | ❌ Marcada ELIMINADA en `catalogs/env-vars.md` | ✅ Documentada como obsoleta |
| `GEMINI_TEMPERATURE_DEFAULT`, `GEMINI_MAX_TOKENS`, `GEMINI_QUOTA_ALERT_USD` | ❌ Marcadas ELIMINADAS en `catalogs/env-vars.md` | ✅ Documentadas como obsoletas |
| `GOOGLE_GEMINI_API_KEY` | Referencia en docs de transferencia internacional | 🟡 Documental (legacy opcional); no existe en código |
| `MINIMAX_API_KEY` / `MINIMAX_MODEL_DEFAULT` | ✅ Proveedor actual | Mantener |
| `OPENAI_API_KEY` (embeddings RAG) | ✅ Alternativa embeddings | Mantener (no relacionado) |

## Endpoints

| Endpoint | Estado | Acción |
|----------|--------|--------|
| `/api/gemini/*` (Node, alias → aiRoutes) | En uso (compatibilidad) | 🟡 DEPRECATED marcado en index.js — eliminar en otra tarea cuando se migren clientes a `/api/ai/*` |
| `/api/gemini/*` (.NET GeminiController → CQRS) | En uso (alias frontend) | 🟡 DEPRECATED marcado en header — eliminar en otra tarea |
| `/api/ai/*` | Proveedor real (MiniMax/OpenCode) | ✅ Mantener |

## Backend .NET — archivos buscados y resultado

| Archivo | Estado real | Acción |
|---------|-------------|--------|
| `GeminiController.cs` | ✅ Existe (alias CQRS, usa MiniMax internamente) | 🟡 Marcado DEPRECATED |
| `GeminiService.cs` | ❌ **NO EXISTE** físicamente (solo refs en docs/catálogos) | ✅ Nada que eliminar — documentar |
| `IGeminiService.cs` | ❌ **NO EXISTE** físicamente | ✅ Nada que eliminar — documentar |
| `FakeGeminiService.cs` | ❌ **NO EXISTE** (existe `FakeMinimaxService.cs`) | ✅ Nada que eliminar — documentar |
| `IMinimaxService.cs` | ✅ Existe — contiene `IGeminiClient` legacy | 🟡 Marcado deprecated (renombrar rompe build) |

> **Confirmación git**: `git status` muestra `GeminiService.cs`, `IGeminiService.cs`, `FakeGeminiService.cs` y `routes/gemini.js` como **eliminados (D)** en el árbol de trabajo. La migración previa ya los había borrado; este inventario lo valida y documenta lo que quedaba (appsettings, alias, comentarios).

> **Conclusión .NET**: la migración del proveedor IA ya ocurrió internamente (MiniMaxService + opencodeClient). Los rastros de Gemini en .NET son: (1) bloque appsettings sin uso, (2) nombre legacy `IGeminiClient`, (3) alias de ruta `/api/gemini`, (4) comentarios XML. Este inventario deja los (1) y (4) resueltos, y marca (2) y (3) como deprecated.

## Frontend (UI copy) — pendiente de otra tarea

| Archivo | Rastros |
|---------|---------|
| `src/pages/AnalistaExpedientes.jsx` | 1 (badge "Gemini 2.0") |
| `src/pages/AsistenteObjeciones.jsx` | 2 ("Análisis Gemini", "Analizar con Gemini") |
| `src/pages/BuscadorJurisprudencia.jsx` | 1 ("Análisis Gemini") |
| `src/pages/ChatIA.jsx` | 2 ("Asistente legal · Gemini", icono "Gemini") |
| `src/pages/ComparadorPrecedentes.jsx` | 1 ("Comparar con Gemini") |
| `src/pages/EstrategiaInterrogatorio.jsx` | 1 ("Analizando con Gemini...") |
| `src/pages/GeneradorAlegatos.jsx` | 2 (badge "IA Gemini", "Generar Alegato con Gemini") |
| `src/pages/Herramientas.jsx` | 1 ("potenciada por Gemini AI") |
| `src/pages/Perfil.jsx` | 4 (consentimiento TI Gemini, desc, configuración, label) |
| `src/pages/PredictorJudicial.jsx` | 2 ("Recomendación Gemini", "Analizando con Gemini") |
| `src/pages/ResumenEjecutivo.jsx` | 2 (badge "Gemini") |
| `src/pages/SignupPage.jsx` | 2 (checkbox TI Google Gemini) |
| `src/pages/SimuladorJuicios.jsx` | 2 ("Análisis IA Gemini", comentario) |
| `src/components/legal/AIAssistantPanel.jsx` | 2 (label provider "gemini") |
| `src/components/onboarding/OnboardingTour.jsx` | 1 ("con Google Gemini") |

> ⚠️ **Cuidado**: los textos de consentimiento LPDP en `SignupPage.jsx`, `Perfil.jsx` y `critical-fixes.spec.js` (`getByLabel(/transferencia internacional a google gemini/i)`) están ligados a la normativa de transferencia internacional (Art. 21 LPDP). Cambiarlos requiere actualizar docs legales y tests e2e. Se delega a tarea de branding/legal.

## Docs, catálogos y reports (NO tocados — históricos/auditoría)

Rastros en: `MAPA_LEGALPRO.md`, `MEGA_DOC.md`, `ESTADO-REAL.md`, `GUIA_GO_LIVE.md`, `RELEASE_v1.0_ALFA.md`, `FINAL_ALFA_MONETIZABLE*.md`, `REPORTE_INVESTIGACION_RAG_2026.md`, `reports/*` (auditorías, coverage, OWASP), `docs/*` (RAG, TRANSFERENCIA_INTERNACIONAL, FRONTEND_AUDIT*, BREACH_NOTIFICATION, PLAN_REMEDIACION, REGISTRO_TRATAMIENTO), `catalogs/*` (adaptadores, audit-events, disclaimers-ia, contratos, env-vars, sla-slo, supabase-schema, CODEOWNERS), `arneses/*` (ADRs, runbooks RB-004/RB-005/RB-001/RB-013/RB-014/RB-017, templates, fixtures, reports, CHANGELOG, skills.json), `.opencode/*`, `.github/governance/*`, `tools/rag/*`, `tools/verifiers/*`, `tools/security/*`, `tools/legal-catalog-updater.mjs`, `tools/validador-fix-lpdp2.mjs`, `tools/audit-ui-prod*.mjs`, `legalpro-app/docs/*` (POLITICA_PRIVACIDAD, TERMINOS_CONDICIONES), `deploy-staging/*` (copia de staging — NO tocar).

> **Motivo**: son registros históricos, auditorías, runbooks y catálogos. Re-escribirlos falsificaría el historial (p.ej. `BREACH_NOTIFICATION_2026-08-01.md` documenta la rotación de la GEMINI_API_KEY filtrada; `catalogs/env-vars.md` ya marca Gemini como ELIMINADO). Se actualizan en la tarea de documentación/marketing.

---

## Verificación post-migración

- [x] `dotnet build` compila sin errores tras eliminar bloque appsettings
- [x] `node --check` pasa en archivos Node editados
- [x] Alias `/api/gemini` sigue funcionando (compatibilidad preservada)
- [x] API key real de Gemini eliminada de `appsettings.Development.json`

## Pendiente (otras tareas)

1. Migrar `routes/ai.js`: eliminar flag `provider=gemini` y `IA_PROVIDER_LABEL.gemini`
2. Reapuntar tests/e2e/smoke de `/api/gemini/*` → `/api/ai/*` y luego eliminar alias
3. Eliminar `GeminiController.cs` .NET (o renombrar a alias `/api/legacy-ia/*`)
4. Renombrar `IGeminiClient` → `IMinimaxClient` en `IMinimaxService.cs`
5. Branding UI: reemplazar textos "Gemini" por OpenCode Go (cuidado con consentimiento LPDP)
6. Actualizar docs/catálogos/runbooks como parte de limpieza histórica (cuando se decida)
