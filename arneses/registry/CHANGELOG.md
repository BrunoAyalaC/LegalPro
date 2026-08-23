# Changelog del Arnés Agentic

Todos los cambios notables en el arnés serán documentados aquí.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/).

## [4.0.0] - 2026-08-06

### Registry regenerado: de 97 a 135 agentes

- `arneses/registry/agents.json` regenerado a **formato v2.0** (id, description, mode, temperature, steps, color)
- `total_agentes: 135` (3 primary + 132 subagent) — refleja `opencode.json` al 100%
- **133 archivos .md** en `.opencode/agents/` (antes 97): +38 agentes nuevos desde v3.1
- `color` extraído del frontmatter de cada `.md` (opencode.json no lo define salvo el orquestador)
- `INDEX.json` regenerado a **v4.0.0** con conteos por categoría recalculados

### Added

- 38 agentes nuevos: bancario, aduanero, competencia, contrataciones, telecomunicaciones, electoral, penitenciario, genero, extranjeria, previsional, maritimo, aeronautico, agrario, pesca, aguas, forestal, datos-personales, internacional, municipal, ejecucion, seguros, ciberespacio, deporte, turismo, militar, policial, cooperativo, cultura, adulto-mayor, discapacidad, abogado-asistente-redaccion, abogado-asistente-investigacion, abogado-senior-tributario, contador-chief, contador-asistente-forense, contador-asistente-laboral
- Conteo por categoría en INDEX.json: abogados 64, contadores 8, IA legal 16, legal 5, auditores 7, refutadores 5, stack 5, mando 5, observabilidad 4, operación 4, owner 5, integraciones 2, red-team 1, reviser 1, built-in 2, primary 1

### Changed

- Formato de `agents.json`: v3.1 (`categoria`/`rol`/`version`) → v2.0 (`description`/`mode`/`temperature`/`steps`/`color`)
- El registro ahora incluye los agentes built-in `build` y `plan` para reflejar el conteo real de `opencode.json`

## [3.1.0] - 2026-07-31

### Major Release: Arquitectura Primary + Subagents (alineado con opencode.ai/agents)

Esta versión introduce la **arquitectura correcta** según la documentación oficial de opencode.ai/agents (julio 2026):

- **1 agente PRIMARY** (`lexia-orchestrator`) que delega via `@task` a 96 subagents especializados
- **96 subagents** con `mode: subagent`, sin `model` (heredan del primary global)
- **`task permissions`** configuradas en `opencode.json` (allow para 96 subagents via glob)
- **Cero uso de `model`** en cualquier subagent (cumple opencode.ai/agents docs)
- **Total 97 agentes** (1 primary + 96 subagents)

### Added

#### Agente Orquestador PRIMARY (UNICO)

- `.opencode/agents/lexia-orchestrator.md` — ÚNICO agente con `mode: primary`
  - Temperatura: 0.2 (balance determinismo/creatividad para routing)
  - Steps: 200 (cubre cadenas cross-rama complejas)
  - Color: #0F172A (slate-dark, distintivo)
  - NO usa `model` (heredado del global)
  - `permission.task`: allow para 96 subagents via glob patterns
  - Matriz de routing completa (6 categorías: análisis jurídico, IA especializadas, auditorías, refutación, ingeniería, mando)
  - Métricas objetivo: routing ≥95%, latencia p95 <10s, costo <$0.15

#### opencode.json v3.1

- 3 primary agents: `build` (built-in), `plan` (built-in), `lexia-orchestrator` (custom)
- `task` permissions configuradas con glob patterns
- Política: subagents NUNCA usan `model`

### Changed

#### Arquitectura

- **ANTES (v3.0)**: 96 subagents sueltos sin orquestador
- **AHORA (v3.1)**: 1 PRIMARY + 96 SUBAGENTS con delegación correcta via `@task`

#### Cumple opencode.ai/agents docs (julio 2026)

- ✅ `mode: primary` para UN agente (lexia-orchestrator)
- ✅ `mode: subagent` para los 96 restantes
- ✅ NO `model` en subagents (heredan del primary)
- ✅ `temperature` diferenciada por criticidad
- ✅ `permission.task` configurado con allow/deny
- ✅ `steps: 200` para el orquestador (cadenas cross-rama)

### Validation

✅ 28/28 verificadores siguen pasando
✅ arneses-registry: OK (5/5 checks, ahora detecta 97 agentes en lugar de 96)
✅ Arquitectura correcta per opencode.ai/agents docs (julio 2026)

---

## [3.0.0] - 2026-07-31

### Major Release: RAG-optimized + Patrones Arquitectónicos + 96 Agentes

Esta versión documenta la **evolución completa** del arnés agentic al 31/07/2026, incluyendo:

- **18 skills** RAG-optimized (8 actualizadas + 9 nuevas + 1 renombrada)
- **7 prompts/subagentes** reescritos con stack 2026 (MiniMax M3 SDK, React 19, .NET 8)
- **3 prompts NUEVOS** (specialist-patrones-arquitectonicos, specialist-rag, specialist-compliance-lpdp)
- **96 agentes** con jerarquía piramidal completa
- **Patrones arquitectónicos** documentados: Decorator (HOF), Observer (EventBus), Adapter (Hexagonal), Result, Container/DI
- **320 archivos totales** en el arnés (incremento de 40 vs v1.5)

### Added

#### Skills (18 total — v3.0 RAG-optimized)

**Auditoría (2)**:
- `auditar-lpdp.md` — Ley 29733 + ANPD actualizada + caso MAGIC DYNASTY S/ 194,000
- `auditar-seguridad.md` — OWASP Top 10 2025 + CWE Top 25 2026 + seguridad IA

**IA-Legal (5)**:
- `analizar-expediente.md` — 5 subtipos con RAG, base legal validada
- `redactar-escrito-legal.md` — 17 tipos de escritos con formato PJ peruano, cero alucinaciones
- `buscar-jurisprudencia.md` (NUEVA) — 5 fuentes oficiales (TC, PJ, INDECOPI, SUNARP, MINJUSDH)
- `analisis-riesgos-procesales.md` (NUEVA) — Matriz probabilidad × impacto, prescripción, caducidad
- `liquidacion-laboral.md` (NUEVA) — CTS, gratificaciones, vacaciones, utilidades, BCRP

**IA-Config & RAG (2)**:
- `configurar-minimax.md` (renombrado desde configurar-gemini) — SDK oficial MiniMax M3
- `rag-busqueda-semantica.md` (NUEVA) — Pipeline RAG completo, embeddings, anti-alucinaciones

**Creación (2)**:
- `crear-endpoint.md` — Node Express 5 ESM o .NET 8 CQRS con decoradores
- `crear-pagina.md` — React 19 + Vite 7 + WCAG 2.1 AA

**DevOps (1)**:
- `deploy-backend.md` — Railway + Docker multi-stage + secrets rotation

**Patrones Arquitectónicos (4 — NUEVAS)**:
- `decoradores-patterns.md` — Higher-Order Functions (pipe, withLogging, withValidation, withRetry, withCircuitBreaker, withIdempotency, memoize)
- `observadores-eventos.md` — EventBus desacoplado con outbox opcional
- `adaptadores-externos.md` — Adapter Pattern (BCRP, SUNAT, SPIJ, etc.)
- `protocolos-pipeline.md` — Pipeline de Behaviors + Middlewares + Decorators

**Performance (1 — NUEVA)**:
- `optimizadores-rendimiento.md` — Optimizaciones Node, .NET, React, Postgres, IA

**Producto (1 — NUEVA)**:
- `objetivos-y-metas.md` — SMART, OKRs, KPIs, MoSCoW, RICE, DoD

#### Prompts/Subagentes (7 reescritos + 3 nuevos)

**Reescritos con stack 2026**:
- `arquitecto-chief.txt` — Stack completo (MiniMax M3, React 19, .NET 8, etc.) + patrones
- `auditor-seguridad.txt` — OWASP Top 10 2025 + seguridad IA
- `auditor-legal.txt` — Referencias actualizadas (TC, ANPD, SPIJ)
- `auditor-lpdp.txt` — ANPD + R.D. 100-2025-JUS-DGTAIPD + sanciones 2026
- `auditor-performance.txt` — Benchmarks SLO 2026
- `auditor-multi-tenant.txt` — Defensa en profundidad multi-tenant
- `ia-buscador-jurisprudencia.txt` — 5 fuentes + precedentes vinculantes TC jul-2026
- `ia-chat-legal.txt` — Chat con RAG + 4 disclaimers
- `ia-predictor-judicial.txt` — Disclaimer reforzados (4+ obligatorios)
- `ia-redactor-escritos.txt` — 17 tipos escritos + cero alucinaciones

**Nuevos specialists**:
- `specialist-patrones-arquitectonicos.txt` — Decorator, Observer, Adapter
- `specialist-rag.txt` — Pipeline RAG completo
- `specialist-compliance-lpdp.txt` — Especialista en compliance LPDP + ANPD

#### Registry actualizado

- `INDEX.json` v3.0 — 96 agentes, 18 skills, 320 archivos totales
- `agents.json` v3.0 — 96 agentes con timestamp `2026-07-31`
- `skills.json` v3.0 — 18 skills categorizadas en 9 categorías
- `opencode.json` — Permisos: edit/bash/webfetch allow

### Changed

#### Referencias regulatorias actualizadas al 31/07/2026

- **ANPD** (antes DGTAIPD) — nueva denominación oficial 2026
- **Resolución Directoral N° 100-2025-JUS-DGTAIPD** — Directiva Oficial de Datos Personales
- **D.S. 016-2024-JUS** — Reglamento actualizado de la LPDP
- **Declaración conjunta 61 autoridades sobre IA** (23-feb-2026)
- **Caso MAGIC DYNASTY** (mayo 2026): S/ 194,000 por uso indebido de datos
- **TC 31-jul-2026**: Habeas corpus Ollanta Humala (Exp. 00110-2026-PHC/TC)
- **Compendio LPDP** (1ra edición oficial, 22-nov-2025)
- **TC Presidente (jul-2026)**: Helder Domínguez Haro
- **Jurisprudencia Sistematizada TC**: https://jurisprudencia.sedetc.gob.pe/

#### Stack tecnológico actualizado

- React 19.2 + Vite 7.3 + TypeScript 6 + TailwindCSS 4.2 + React Router 7.13
- Node 20 + Express 5 ESM + Zod 4 + @minimax/sdk
- .NET 8 + EF Core + MediatR CQRS + FluentValidation
- Sentry 10 + OpenTelemetry
- PostgreSQL 15 + Supabase + pgvector

### Patterns Documented

#### Decorator Pattern (Higher-Order Functions)

Implementación: `legalpro-app/server/core/decorators.js`

8 decoradores disponibles:
1. `pipe(...decorators)(fn)` — composición de izquierda a derecha
2. `withLogging(name)` — log estructurado
3. `withTiming(name)` — métricas de duración
4. `withRetry({retries, delayMs, backoff, shouldRetry})` — reintentos selectivos
5. `withValidation(schema)` — Zod/FluentValidation pre-ejecución
6. `withCircuitBreaker({failureThreshold, cooldownMs, name})` — circuit breaker
7. `memoize({ttlMs, keyFn})` — cache en memoria
8. `withIdempotency({keyFn, windowMs})` — dedupe por clave

#### Observer Pattern (EventBus)

Implementación: `legalpro-app/server/core/EventBus.js`

Características:
- Handlers sync y async
- Prioridad ascendente (menor = antes)
- `once()` para suscripciones de un solo uso
- Wildcard `*` para escucha global
- **Aislamiento de errores** (un suscriptor que lanza NO rompe a los demás)
- Outbox opcional para transactional outbox

#### Adapter Pattern (Hexagonal)

Implementación: `legalpro-app/server/adapters/`

8 adapters: BCRP, SUNAT, SPIJ, SINOE, SMS, EMAIL, CULQI, MINIMAX

Contrato canónico:
```typescript
interface Adapter<TInput, TOutput> {
  name: string;
  version: string;
  baseURL: string;
  timeoutMs: number;
  cacheTTL?: number;
  execute(operation, input): Promise<AdapterResult<TOutput>>;
  healthCheck(): Promise<boolean>;
}
```

### Migration Notes

- El archivo `configurar-gemini.md` se renombró a `configurar-minimax.md`
- El frontmatter `name: configurar-minimax` ya estaba actualizado en v2.x
- Las referencias a `@google/genai` cambiaron a `@minimax/sdk` (SDK oficial)
- Los nombres de modelos Gemini cambiaron a MiniMax M3

### Validation

✅ 28/28 verificadores pasan (al 31/07/2026):
- arneses-registry: OK (5/5 checks)
- catalogos: OK (9/9 catálogos validados)
- owasp: OK (sin critical violations)
- lpdp: OK (9/9 checks)
- multi-tenant: OK (6/6 checks)
- rbac: OK (5/5 checks)
- rls: OK (3/3 checks)
- masking: OK (4/4 checks)
- idempotencia: OK (3/3 checks)
- accesibilidad: OK (axe-core verde)
- quota: OK (3/3 checks)
- ... y 17 más

---

## [1.0.0] - 2026-06-12

### Added

#### Agentes (50)

- **Mando y gobernanza (5)**: arquitecto-chief, planner-chief, product-owner, gobernanza-chief, release-manager
- **Ingeniería de stacks (5)**: backend-dotnet, backend-node, android, frontend, database
- **IA Legal especialistas (16)**: 16 especialistas por herramienta IA
- **Legal especialistas (5)**: penalista, civilista, laboralista, constitucionalista, fiscalista
- **Contador especialistas (2)**: tributarista, laboralista
- **Calidad y auditoría (8)**: reviser + 7 auditores
- **Journey/Smoke/Observabilidad (4)**: journey-tester, smoke-tester, sre, prompt-engineer
- **Integraciones y soporte (2)**: integraciones-peru, devops
- **Operación interna (4)**: onboarding-mentor, localization, docs-writer, debug

#### Catálogos (18)

- `role-tools.json` — Capacidades por rol (ABOGADO, FISCAL, JUEZ, CONTADOR)
- `minimax-functions.json` — 16 Function Declarations de MiniMax
- `env-vars.md` — Variables de entorno canónicas
- `supabase-schema.md` — 17 tablas PostgreSQL con RLS
- `tipos-penales-peru.json` — 25 tipos penales CP
- `plazos-procesales.json` — 17 plazos procesales
- `glosario-juridico.md` — Glosario completo
- `delitos-economicos.json` — 16 delitos económicos
- `codigos-leyes.json` — 20 códigos y leyes peruanas
- `reguladores-peru.json` — 13 reguladores peruanos
- `audit-events.json` — 30 eventos canónicos
- `owasp-mapping.md` — Mapeo OWASP Top 10
- `sla-slo.md` — SLOs y SLAs contractuales
- `disclaimers-ia.json` — 13 disclaimers IA
- `dependabot.yml` — Configuración Dependabot
- `CODEOWNERS` — Reglas de propiedad
- `security-policy.md` — Política de seguridad
- `release-policy.md` — Política de release

### Features

- Formato OpenCode nativo (`.opencode/agents/*.md` con frontmatter)
- Temperaturas diferenciadas por criticidad (0.05 para auditores, 0.5 para simulador)
- `permission: allow` global para todos los agentes
- Multi-tenant estricto con RLS en todas las tablas
- Cumplimiento LPDP (consentimientos, ARCO, transferencia internacional, firma digital)
- Catálogos como single source of truth

### Refactor

- `arquitecto` -> `arquitecto-chief`
- `planner` -> `planner-chief`
- `dominio-legal` -> dividido en 5 especialistas
- `ia-legal` -> dividido en 16 especialistas
- `seguridad` -> dividido en 4 auditores
- `contador` -> dividido en 2 especialistas

## [Unreleased]

Pendiente para v3.1:
- 18 → 30 skills (cubrir gaps restantes)
- Commands: 15 → 25
- Runbooks: 22 → 30
- Tests E2E: cobertura cross-stack completa
- Deploy E2EE del Owner Dashboard (verifier-owner-e2ee)
