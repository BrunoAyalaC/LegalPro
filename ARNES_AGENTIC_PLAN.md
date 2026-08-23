# ARNÉS AGENTIC DE INGENIERÍA ESTRICTA — LEGALPRO / LEXIA PERÚ

**Versión**: 1.0
**Fecha**: 2026-06-12
**Proyecto**: LegalPro / LexIA Perú
**Estado**: PLAN DE IMPLEMENTACIÓN — solo lectura hasta aprobación
**Alcance**: 350+ archivos de arnés agentic distribuidos en `.github/`, `arneses/`, `catalogs/`, `runbooks/`, `templates/`, `prompts/` y `tools/verifiers/`

---

## 0. RESUMEN EJECUTIVO

### 0.1 Diagnóstico del estado actual

Inventario existente:
- **13 agentes** (`android`, `arquitecto`, `backend-dotnet`, `contador`, `database`, `debug`, `devops`, `dominio-legal`, `frontend`, `ia-legal`, `planner`, `seguridad`, `testing`) — **falta `backend-node` referenciado en AGENTS_GUIDE.md**.
- **8 skills** (`analizar-expediente`, `configurar-minimax`, `crear-endpoint`, `crear-pagina`, `deploy-backend`, `generar-escrito-legal`, `migrar-base-datos`, `simulacion-juicio`).
- **3 instructions** (`android-compose`, `dotnet-cqrs`, `legal-prompts`).
- **4 workflows** (`ci`, `deploy-landing`, `docker-publish`, `security`).
- **Sin catálogos únicos**: las 7 funciones de MiniMax están duplicadas en 4 archivos; las herramientas por rol en 5 archivos; variables de entorno en 3.
- **Sin CODEOWNERS, PR templates, hooks, observabilidad post-prod, journey-test cross-stack, ni auditores automatizados**.
- **Cumplimiento LPDP**: score 0.5/4 según `PLAN_MADUREZ_LEGAL_PERU.md`; 6 áreas críticas sin verificadores.

### 0.2 Objetivo del arnés

Construir un sistema agentic que permita que cualquier IA agente (TRAE/Copilot/Cursor/Claude/Custom) opere sobre el repositorio de forma:
1. **Trazable** — cada acción registrada, cada decisión documentada (ADR).
2. **Verificable** — quality gates automáticos antes de merge.
3. **Especializada** — un agente por dominio, no agentes generalistas.
4. **Cumplidora** — LPDP, ARCO, transferencia internacional, firma digital, multi-tenant.
5. **Reproducible** — los prompts/skills/instructions viven en archivos versionados.
6. **Defendible** — múltiples auditores (legal, seguridad, accesibilidad, performance) antes de release.

### 0.3 Número total de archivos a crear/modificar

| Categoría | Nuevos | Modificar | Total |
|---|---|---|---|
| Catálogos (single source of truth) | 18 | 0 | 18 |
| Agentes (.github/agents/) | 37 | 13 (refactor) | 50 |
| Skills (.github/skills/) | 78 | 8 (refactor v2) | 86 |
| Instructions (.github/instructions/) | 12 | 3 (refactor) | 15 |
| Workflows (.github/workflows/) | 16 | 4 (refactor) | 20 |
| Prompts reutilizables (.github/prompts/) | 32 | 0 | 32 |
| Hooks (arneses/hooks/) | 10 | 0 | 10 |
| Plantillas (arneses/templates/) | 24 | 0 | 24 |
| Runbooks (arneses/runbooks/) | 16 | 0 | 16 |
| Verificadores/auditores (tools/verifiers/) | 22 | 0 | 22 |
| Registros/Indexadores (arneses/registry/) | 14 | 0 | 14 |
| Esquemas JSON (catalogs/schemas/) | 12 | 0 | 12 |
| Gobernanza (.github/governance/) | 10 | 0 | 10 |
| Fixtures (arneses/fixtures/) | 18 | 0 | 18 |
| **TOTAL** | **329** | **28** | **357** |

---

## 1. TAXONOMÍA DEL ARNÉS

### 1.1 Reglas de oro (qué va dónde)

| Tipo | Responde a… | Persiste en | Quién lo invoca | Cadencia |
|---|---|---|---|---|
| **CATÁLOGO** | "¿Cuál es la verdad?" | `catalogs/*.json`/`*.md` | Todos los demás | Por versión de schema |
| **AGENTE** | "¿Quién lo hace?" | `.github/agents/*.agent.md` | TRAE/Copilot | Por tarea |
| **SKILL** | "¿Cómo se hace?" | `.github/skills/*/SKILL.md` | El agente cuando lo invoca | Por tarea |
| **INSTRUCTION** | "¿Qué reglas aplica este código al editarlo?" | `.github/instructions/*.instructions.md` (auto-aplicado por `applyTo` glob) | El IDE al editar | Pasivo/continuo |
| **WORKFLOW** | "¿Qué pasa cuando…?" | `.github/workflows/*.yml` | GitHub Actions en eventos | Por evento |
| **PROMPT** | "¿Qué prompt reusable uso para…?" | `.github/prompts/*.prompt.md` | El usuario con `/` slash command | Manual/selectivo |
| **HOOK** | "¿Qué validar antes/después de…?" | `arneses/hooks/*.{sh,ps1,yml}` | Lefthook/pre-commit | Por commit |
| **VERIFIER** | "¿Cómo audito X?" | `tools/verifiers/*.mjs` | CI o un agente Auditor | Por PR / nightly |
| **TEMPLATE** | "¿Cuál es la estructura canónica de X?" | `arneses/templates/*` | Cualquier agente al crear | Por uso |
| **RUNBOOK** | "¿Cómo respondo a incidente X?" | `arneses/runbooks/*.md` | SRE / On-call | Por incidente |
| **REGISTRY** | "¿Qué hay en el arnés?" | `arneses/registry/*.json` | Sistema de descubrimiento | Por build |
| **FIXTURE** | "Dame datos de prueba de X" | `arneses/fixtures/*` | Tests | Por test |
| **GOVERNANCE** | "¿Cuáles son las reglas del juego?" | `.github/governance/*.md` | Todos | Por release |

### 1.2 Cadena de mando del arnés

```
                  ┌──────────────────────────────┐
                  │   @arquitecto-chief          │
                  │  Decisiones cross-stack      │
                  └──────────────┬───────────────┘
                                 │ aprueba ADRs
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
  @planner-chief          @product-owner          @gobernanza-chief
  MoSCoW + roadmap        PRD + DoD + ROI         LPDP/ARCO/políticas
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 ▼
   ┌─────────────┬─────────────┬─────────────┬─────────────┐
   ▼             ▼             ▼             ▼             ▼
@backend-dotnet @backend-node  @android    @frontend   @database
   │             │             │             │             │
   └─────────────┴─────────────┴─────────────┴─────────────┘
                                 ▼
   ┌──────────────────────────────────────────────────────────┐
   │          ESPECIALISTAS DE DOMINIO (16 tools IA)          │
   │  @ia-analista, @ia-objeciones, @ia-boveda, ...           │
   └──────────────────────────────────────────────────────────┘
                                 ▼
   ┌──────────────┬──────────────┬──────────────┬─────────────┐
   ▼              ▼              ▼              ▼             ▼
@seguridad    @auditor-legal  @auditor-seg  @auditor-wcag  @sre
@auditor-rls  @auditor-arco   @auditor-rbac @auditor-perf  @testing
                                                                │
                                          ┌─────────────────────┘
                                          ▼
                                    @reviser (code review)
```

---

## 2. CATÁLOGOS (Single Source of Truth) — 18 archivos

Ubicación: `catalogs/`

| # | Archivo | Tipo | Propósito | Consumido por |
|---|---|---|---|---|
| 1 | `catalogs/minimax-functions.json` | Schema JSON | Las 7 (extensibles a 16) function declarations de MiniMax: nombre, descripción, parámetros JSON-schema, modo FC (AUTO/ANY/NONE), claim de consentimiento, coste estimado. | `@ia-legal`, `configurar-minimax`, `legal-prompts` |
| 2 | `catalogs/role-tools.json` | Schema JSON | Catálogo de herramientas por rol: ABOGADO (13), FISCAL (10), JUEZ (8), CONTADOR (5), con permisos READ/WRITE/EXECUTE, plan mínimo, disclaimers requeridos. | `@arquitecto`, `@planner`, `@ia-legal`, `@dominio-legal`, `AGENTS_GUIDE.md` |
| 3 | `catalogs/env-vars.md` | Markdown | Lista canónica de variables de entorno: nombre, propósito, requerida, secret, default, dev/prod, validación regex, longitud mínima, ejemplo enmascarado. | `@devops`, `deploy-backend`, `Program.cs` |
| 4 | `catalogs/supabase-schema.md` | Markdown | Las 9+ tablas de Supabase/PG con columnas, tipos, índices, FKs, RLS policies, multi-tenant, soft-delete, audit_log. | `@database`, `migrar-base-datos`, `dominio-legal` |
| 5 | `catalogs/tipos-penales-peru.json` | Schema JSON | Taxonomía de tipos penales peruanos CP 2024: hurto, robo, estafa, lesiones, homicidio, violación, peculado, colusión, lavado, etc. con art. CP, pena mínima/máxima, agravantes, jurisprudencia vinculante. | `@ia-penalista`, `@auditor-legal`, `analizar-expediente` |
| 6 | `catalogs/glosario-juridico.md` | Markdown | Diccionario controlado de términos jurídicos peruanos: expediente, ejecutoria, casación, acuerdo plenario, precedente vinculante, medio probatorio, etc. | `@ia-legal`, `@dominio-legal`, `auditar-citas-legales` |
| 7 | `catalogs/plazos-procesales.json` | Schema JSON | Reglas hardcoded de plazos: CPC, NCPP, laboral, contencioso, habeas corpus, amparo. Tabla: tipo_acto → días, hábiles/calendario, suspensiones por feriado, dies_ad-quem. | `@ia-legal`, `calcular-plazos`, `liquidar-laboral` |
| 8 | `catalogs/delitos-economicos.json` | Schema JSON | Tipos de delitos económicos: lavado de activos (DL 1249), colusión (art. 384 CP), peculado (art. 387), concusión (art. 382), enriquecimiento ilícito, con elementos típicos, jurisprudencia SUNAT/SBS. | `@ia-penalista`, `@contador-tributarista`, `analizar-expediente` |
| 9 | `catalogs/codigos-leyes.json` | Schema JSON | Códigos y leyes peruanas con número, nombre oficial, fecha, artículos más citados, links a SPIJ. | Todos los `@ia-*`, `@auditor-legal` |
| 10 | `catalogs/reguladores-peru.json` | Schema JSON | Reguladores: PJ, MINJUS, SUNAT, SUNARP, INDECOPI, LPDP/ANPDP, BCRP, MTPE, SBS, ONPE, JNE, con URL de API (cuando exista), siglas, ámbito. | `@ia-legal`, `@integraciones-peru` |
| 11 | `catalogs/audit-events.json` | Schema JSON | Eventos canónicos del `IAuditLogger`: nombre, severidad, ISO27001 control, LPDP artículo, retención en días, PII masking. | `@seguridad`, `@auditor-seg`, `seguridad.agent.md` |
| 12 | `catalogs/owasp-mapping.md` | Markdown | Mapeo OWASP Top 10 → control concreto en código. | `@seguridad`, `@auditor-seg`, `seguridad.agent.md` |
| 13 | `catalogs/sla-slo.md` | Markdown | SLO por endpoint: latencia p95, p99, tasa de error, disponibilidad mensual, alerta umbral. | `@sre`, `smoke-postdeploy.yml` |
| 14 | `catalogs/disclaimers-ia.json` | Schema JSON | Los 5 disclaimers canónicos que se insertan en cada output IA: "Esto no constituye asesoría legal", cita a LOPJ art. 290, CPC art. 132, etc. | `@ia-legal`, `exportToDocx` |
| 15 | `catalogs/dependabot.yml` | YAML | Configuración Dependabot para npm, NuGet, Gradle, GH Actions con grupos, reviewers, auto-merge. | `dependabot.yml` |
| 16 | `catalogs/CODEOWNERS` | Texto | Reglas de propiedad de código por carpeta: backend-dotnet, legalpro-app/src, legalpro-app/server, android, .github/agents, .github/skills, catalogs. | CODEOWNERS |
| 17 | `catalogs/security-policy.md` | Markdown | Política de seguridad, versiones soportadas, cómo reportar vulnerabilidad (coordinación 90d). | `SECURITY.md` |
| 18 | `catalogs/release-policy.md` | Markdown | Versionado semver, changelog, rama de release, criterios de release, sign-off. | `release.yml`, `@release-manager` |

### 2.1 Esquemas JSON Schema (validación) — 12 archivos

Ubicación: `catalogs/schemas/`

| # | Esquema | Valida |
|---|---|---|
| 1 | `minimax-functions.schema.json` | `minimax-functions.json` |
| 2 | `role-tools.schema.json` | `role-tools.json` |
| 3 | `tipos-penales.schema.json` | `tipos-penales-peru.json` |
| 4 | `plazos-procesales.schema.json` | `plazos-procesales.json` |
| 5 | `delitos-economicos.schema.json` | `delitos-economicos.json` |
| 6 | `codigos-leyes.schema.json` | `codigos-leyes.json` |
| 7 | `reguladores.schema.json` | `reguladores-peru.json` |
| 8 | `audit-events.schema.json` | `audit-events.json` |
| 9 | `disclaimers-ia.schema.json` | `disclaimers-ia.json` |
| 10 | `arneses-registry.schema.json` | `arneses/registry/agents.json`, `skills.json`, etc. |
| 11 | `ia-eval.schema.json` | Resultados de evals IA (golden tests) |
| 12 | `verifier-report.schema.json` | Output de los `tools/verifiers/*.mjs` |

---

## 3. AGENTES (Sub-agents) — 50 archivos

Ubicación: `.github/agents/`

### 3.1 Mando y gobernanza (5)

| # | Archivo | name | Modelo | Propósito |
|---|---|---|---|---|
| 1 | `.github/agents/arquitecto-chief.agent.md` | ArquitectoChief | Claude Opus 4.6 (copilot) | Versión mejorada del `arquitecto` actual. Aprueba ADRs cross-stack, tiene veto técnico, evalúa impacto regulatorio, firma releases. |
| 2 | `.github/agents/planner-chief.agent.md` | PlannerChief | Claude Sonnet 4.6 | Versión mejorada del `planner`. Genera roadmaps trimestrales, dependencias cross-equipo, métricas de salud. |
| 3 | `.github/agents/product-owner.agent.md` | ProductOwner | Claude Sonnet 4.6 | PRD, DoD, priorización RICE/ICE, valor de negocio, feedback de usuarios. |
| 4 | `.github/agents/gobernanza-chief.agent.md` | GobernanzaChief | Claude Opus 4.6 | Cumplimiento LPDP/ARCO/INDECOPI, normatividad publicitaria, versionado de docs legales. Tiene veto de release. |
| 5 | `.github/agents/release-manager.agent.md` | ReleaseManager | Claude Sonnet 4.6 | Semver, changelog, GitHub Release, sign-off, rollback plan. |

### 3.2 Ingeniería de stacks (5 — todos refactorizados)

| # | Archivo | name | Modelo | Propósito |
|---|---|---|---|---|
| 6 | `.github/agents/backend-dotnet.agent.md` | BackendDotNet | Claude Sonnet 4.6 | Refactor del actual: ahora referencia `catalogs/env-vars.md` y `catalogs/owasp-mapping.md`. Añade directrices de testing xUnit y observabilidad OTel. |
| 7 | `.github/agents/backend-node.agent.md` | BackendNode | Claude Sonnet 4.6 | **FALTABA**. Express 5 + ESM, Supabase Auth, Railway, multi-tenant, RBAC. Cubre `legalpro-app/server/`. |
| 8 | `.github/agents/android.agent.md` | Android | Claude Sonnet 4.6 | Refactor: añade directrices de testing Compose, Hilt avanzado, KSP, R8. |
| 9 | `.github/agents/frontend.agent.md` | Frontend | Claude Sonnet 4.6 | Refactor: añade directrices de testing Vitest, Storybook, ARIA WCAG, performance budget. |
| 10 | `.github/agents/database.agent.md` | Database | Claude Sonnet 4.6 | Refactor: añade directrices de versionado de migraciones (DbUp/FluentMigrator), query plans, índices, RLS. |

### 3.3 Especialistas de dominio legal — herramientas IA (16)

Cada uno cubre una herramienta IA específica:

| # | Archivo | name | Rol primario | Modelo |
|---|---|---|---|---|
| 11 | `.github/agents/ia-analista-expedientes.agent.md` | IALegal.AnalistaExpedientes | Todos | Sonnet |
| 12 | `.github/agents/ia-objeciones.agent.md` | IALegal.Objeciones | Abogado/Fiscal | Sonnet |
| 13 | `.github/agents/ia-boveda-evidencia.agent.md` | IALegal.BovedaEvidencia | Todos | Sonnet |
| 14 | `.github/agents/ia-buscador-jurisprudencia.agent.md` | IALegal.BuscadorJurisprudencia | Todos | Sonnet |
| 15 | `.github/agents/ia-comparador-precendentes.agent.md` | IALegal.ComparadorPrecedentes | Abogado/Fiscal/Juez | Sonnet |
| 16 | `.github/agents/ia-estrategia-interrogatorio.agent.md` | IALegal.EstrategiaInterrogatorio | Abogado/Fiscal (NCPP) | Sonnet |
| 17 | `.github/agents/ia-generador-alegatos.agent.md` | IALegal.GeneradorAlegatos | Abogado/Fiscal | Sonnet |
| 18 | `.github/agents/ia-generador-casos-criticos.agent.md` | IALegal.GeneradorCasosCriticos | Abogado | Sonnet |
| 19 | `.github/agents/ia-gestion-multidoc.agent.md` | IALegal.GestionMultidoc | Todos | Sonnet |
| 20 | `.github/agents/ia-monitor-sinoe.agent.md` | IALegal.MonitorSinoe | Abogado | Sonnet |
| 21 | `.github/agents/ia-predictor-judicial.agent.md` | IALegal.PredictorJudicial | Abogado/Fiscal | Sonnet |
| 22 | `.github/agents/ia-redactor-escritos.agent.md` | IALegal.RedactorEscritos | Abogado/Fiscal | Sonnet |
| 23 | `.github/agents/ia-reporte-retroalimentacion.agent.md` | IALegal.ReporteRetroalimentacion | Abogado/Fiscal | Sonnet |
| 24 | `.github/agents/ia-resumen-ejecutivo.agent.md` | IALegal.ResumenEjecutivo | Todos | Sonnet |
| 25 | `.github/agents/ia-simulador-juicios.agent.md` | IALegal.SimuladorJuicios | Abogado/Fiscal | Sonnet |
| 26 | `.github/agents/ia-chat-legal.agent.md` | IALegal.ChatLegal | Todos | Sonnet |

### 3.4 Especialistas legales por rama (5)

| # | Archivo | name | Rama | Modelo |
|---|---|---|---|---|
| 27 | `.github/agents/legal-penalista.agent.md` | LegalPenalista | Penal / NCPP / CP | Sonnet |
| 28 | `.github/agents/legal-civilista.agent.md` | LegalCivilista | Civil / CPC / CC | Sonnet |
| 29 | `.github/agents/legal-laboralista.agent.md` | LegalLaboralista | Laboral / LPCL | Sonnet |
| 30 | `.github/agents/legal-constitucionalista.agent.md` | LegalConstitucionalista | Constitucional / TC | Sonnet |
| 31 | `.github/agents/legal-fiscalista.agent.md` | LegalFiscalista | Fiscal / Ministerio Público | Sonnet |

### 3.5 Especialistas contables (2)

| # | Archivo | name | Área | Modelo |
|---|---|---|---|---|
| 32 | `.github/agents/contador-tributarista.agent.md` | ContadorTributarista | Tributario / SUNAT / IGV / IR | Sonnet |
| 33 | `.github/agents/contador-laboralista.agent.md` | ContadorLaboralista | CTS / Gratificaciones / AFP / ONP | Sonnet |

### 3.6 Calidad, auditoría y verificación (8)

| # | Archivo | name | Modelo | Propósito |
|---|---|---|---|---|
| 34 | `.github/agents/reviser.agent.md` | Reviser | Sonnet | Code review continuo con checklist SOLID/DRY/KISS/convenciones del repo. |
| 35 | `.github/agents/auditor-seguridad.agent.md` | AuditorSeguridad | Opus | OWASP, secretos, RLS, RBAC, brute force, rate limit, masking. Ejecuta `tools/verifiers/verifier-*.mjs`. |
| 36 | `.github/agents/auditor-legal.agent.md` | AuditorLegal | Opus | Valida citas legales contra `catalogs/codigos-leyes.json` y `catalogs/tipos-penales-peru.json`. Detecta alucinaciones. |
| 37 | `.github/agents/auditor-lpdp.agent.md` | AuditorLPDP | Opus | Valida cumplimiento LPDP: consentimientos, retención, ARCO, transferencia internacional, firma digital. |
| 38 | `.github/agents/auditor-accesibilidad.agent.md` | AuditorAccesibilidad | Sonnet | WCAG 2.1 AA con axe-core. Genera informe de issues por severidad. |
| 39 | `.github/agents/auditor-multi-tenant.agent.md` | AuditorMultiTenant | Sonnet | Detecta `IgnoreQueryFilters()`, ausencia de `ITenantRequest`, cross-tenant leaks. |
| 40 | `.github/agents/auditor-performance.agent.md` | AuditorPerformance | Sonnet | Bundle size, latencia API, query plans, coste de tokens MiniMax. |
| 41 | `.github/agents/auditor-cost-ia.agent.md` | AuditorCostIA | Sonnet | Coste de MiniMax por request, por org, por mes. Optimización de modelo. |

### 3.7 Journey, smoke y observabilidad (4)

| # | Archivo | name | Modelo | Propósito |
|---|---|---|---|---|
| 42 | `.github/agents/journey-tester.agent.md` | JourneyTester | Sonnet | Orquestador de journeys cross-stack (Playwright + server tests + Android UI). |
| 43 | `.github/agents/smoke-tester.agent.md` | SmokeTester | Sonnet | Ejecuta `smoke-production.mjs` post-deploy y tras migraciones. |
| 44 | `.github/agents/sre.agent.md` | SRE | Sonnet | Observabilidad: logs, métricas, trazas, alertas, SLOs, runbooks. |
| 45 | `.github/agents/prompt-engineer.agent.md` | PromptEngineer | Sonnet | Optimización de prompts MiniMax: latencia, coste, calidad, evals. |

### 3.8 Integraciones y soporte (2)

| # | Archivo | name | Modelo | Propósito |
|---|---|---|---|---|
| 46 | `.github/agents/integraciones-peru.agent.md` | IntegracionesPeru | Sonnet | APIs reales de PJ/SUNARP/SUNAT/INDECOPI/BCRP/ANPDP. Mock-first; integración cuando exista API. |
| 47 | `.github/agents/devops.agent.md` | DevOps | Sonnet | Refactor: añade OTel, Datadog/Sentry, secrets rotation, WAF, k8s si aplica. |

### 3.9 Operación interna (3)

| # | Archivo | name | Modelo | Propósito |
|---|---|---|---|---|
| 48 | `.github/agents/onboarding-mentor.agent.md` | OnboardingMentor | Sonnet | Asistente para nuevos devs (estudiantes, pasantes): tour guiado, glossary, FAQ. |
| 49 | `.github/agents/localization.agent.md` | Localization | Sonnet | i18n, es-PE, aymara/quechua (futuro), formatos fecha/moneda. |
| 50 | `.github/agents/docs-writer.agent.md` | DocsWriter | Sonnet | Mantenimiento de docs: README, ADRs, OpenAPI, manpages, runbooks. |

### 3.10 Plantilla canónica de agente

Ver `arneses/templates/AGENT.template.md`:

```markdown
---
name: <PascalCase>
description: <1 línea, <160 chars>
model: <opus|sonnet|haiku>
tools: <subset declarado>
argument-hint: "Prompt de invocación"
handoffs:
  - agent: <nombre>
    prompt: <string>
---

# <Role>

## Identidad
## Cuándo invocarme
## Inputs que necesito
## Outputs que produzco
## Reglas duras
## Skills que consumo
## Catálogos que consulto
## Verificadores que ejecuto
## Restricciones regulatorias
## No hago (delego a)
```

---

## 4. SKILLS — 86 archivos

Ubicación: `.github/skills/`

### 4.1 Conteo por categoría

| Categoría | Nuevos | Refactor (de los 8 actuales) | Total |
|---|---|---|---|
| Auditoría/Verificación | 22 | 0 | 22 |
| IA Legal — Análisis y razonamiento | 11 | 1 (`analizar-expediente`) | 12 |
| IA Legal — Redacción de escritos | 14 | 1 (`generar-escrito-legal`) | 15 |
| IA Legal — Simulación/audiencia | 3 | 1 (`simulacion-juicio`) | 4 |
| IA Legal — Otras herramientas | 12 | 0 | 12 |
| Configuración IA/ML | 3 | 1 (`configurar-minimax`) | 4 |
| Creación/desarrollo de stacks | 4 | 2 (`crear-endpoint`, `crear-pagina`) | 6 |
| DevOps/Deploy/Migración | 5 | 2 (`deploy-backend`, `migrar-base-datos`) | 7 |
| Seguridad y cumplimiento | 4 | 0 | 4 |
| Calidad y testing | 3 | 0 | 3 |
| Datos y catálogos | 2 | 0 | 2 |
| **TOTAL** | **83** | **8** | **91** |

> Ajuste: el plan final cuenta 86 skills (algunos contadores comparten skill). Se entrega 78 nuevos + 8 refactor = 86.

### 4.2 Listado detallado

#### A. Auditoría y verificación (22 nuevos)

| # | Skill | Detecta/Audita |
|---|---|---|
| 1 | `auditar-lpdp/` | LPDP completo: consentimientos, retención, ARCO, transferencia internacional, firma digital, breach notification |
| 2 | `auditar-arco/` | Derechos ARCO: GET/PUT/DELETE /mis-datos, soft-delete, purge cron |
| 3 | `auditar-transferencia-internacional/` | Flag de consentimiento, redacción PII antes de MiniMax, cláusula contractual |
| 4 | `auditar-firma-digital/` | Hash SHA-256, timestamp, PKCS#7, columna firma_digital_id |
| 5 | `auditar-rls/` | Policies RLS sobre migraciones nuevas |
| 6 | `auditar-seguridad-owasp/` | OWASP Top 10 con grep semántico |
| 7 | `auditar-secretos/` | Gitleaks + JWT_SECRET≥32 chars + keys en appsettings.Development |
| 8 | `auditar-multi-tenant/` | `IgnoreQueryFilters()`, cross-tenant leaks, `ITenantRequest` |
| 9 | `auditar-rbac/` | Matriz rol×endpoint, SoD, separación privilegios |
| 10 | `auditar-accesibilidad-wcag/` | axe-core, ARIA, contraste, focus traps |
| 11 | `auditar-rendimiento-ia/` | Latencia MiniMax, tokens consumidos, retry storms |
| 12 | `auditar-costo-tokens/` | Costo USD por request/org/mes, modelo adecuado |
| 13 | `auditar-deprecation-modelos/` | Modelos MiniMax deprecados |
| 14 | `auditar-contrato-api/` | Pact consumer/provider entre Node y .NET |
| 15 | `auditar-schema/` | `ALTER TABLE` ad-hoc vs migración versionada |
| 16 | `auditar-outbox/` | Reintentos, poison messages, DLQ |
| 17 | `auditar-quota/` | Race conditions en créditos, rollback |
| 18 | `auditar-idempotencia/` | Cache hit/miss, TTL, concurrentes |
| 19 | `auditar-brute-force/` | Umbral 5 intentos, lockout ≥15 min, `RATE_LIMIT_HIT` |
| 20 | `auditar-masking/` | Snapshot test de `MaskingTextFormatter` con PII |
| 21 | `auditar-cobertura-tests/` | Coverlet + threshold 80%, fail si baja |
| 22 | `auditar-slo/` | Latencia p95/p99, error rate, alerta |

#### B. IA Legal — Análisis y razonamiento (11 nuevos + 1 refactor)

| # | Skill |
|---|---|
| 23 | `analizar-expediente/` (refactor v2: añade journey visual, citas verificadas) |
| 24 | `analizar-caso-critico/` |
| 25 | `resumir-expediente/` |
| 26 | `comparar-precendentes/` |
| 27 | `detectar-nulidades/` |
| 28 | `detectar-riesgos-procesales/` |
| 29 | `evaluar-tipicidad/` |
| 30 | `evaluar-antijuridicidad/` |
| 31 | `evaluar-culpabilidad/` |
| 32 | `calificar-juridica-hechos/` |
| 33 | `probar-pretension/` |
| 34 | `sugerir-prueba/` |

#### C. IA Legal — Redacción de escritos (14 nuevos + 1 refactor)

| # | Skill |
|---|---|
| 35 | `generar-escrito-legal/` (refactor v2: añade validación de citas) |
| 36 | `redactar-demanda/` |
| 37 | `redactar-contestacion/` |
| 38 | `redactar-reconvencion/` |
| 39 | `redactar-apelacion/` |
| 40 | `redactar-casacion/` |
| 41 | `redactar-queja/` |
| 42 | `redactar-reposicion/` |
| 43 | `redactar-acusacion/` |
| 44 | `redactar-sobreseimiento/` |
| 45 | `redactar-alegato-clausura/` |
| 46 | `redactar-medida-cautelar/` |
| 47 | `redactar-amparo/` |
| 48 | `redactar-habeas-corpus/` |
| 49 | `redactar-pericial/` (contable, médica, ingeniería) |

#### D. IA Legal — Simulación/audiencia (3 nuevos + 1 refactor)

| # | Skill |
|---|---|
| 50 | `simulacion-juicio/` (refactor v2: añade scoring rúbrica) |
| 51 | `simular-objecion/` |
| 52 | `simular-interrogatorio/` |
| 53 | `simular-alegato/` |

#### E. IA Legal — Otras herramientas (12 nuevos)

| # | Skill |
|---|---|
| 54 | `asistente-objeciones/` |
| 55 | `gestion-multidoc/` |
| 56 | `boveda-custodia/` |
| 57 | `buscar-jurisprudencia/` |
| 58 | `monitor-sinoe/` |
| 59 | `predecir-resultado/` |
| 60 | `reporte-retroalimentacion/` |
| 61 | `chat-legal/` |
| 62 | `panel-expertos/` |
| 63 | `cargar-jurisprudencia/` (pipeline de ingesta vectorial) |
| 64 | `embeddings-juridicos/` (gestión de la base vectorial) |
| 65 | `liquidar-laboral/` (CTS, gratificaciones, vacaciones) |

#### F. Configuración IA/ML (3 nuevos + 1 refactor)

| # | Skill |
|---|---|
| 66 | `configurar-minimax/` (refactor v2: usa catalogs/minimax-functions.json) |
| 67 | `optimizar-prompt-minimax/` (eval, regression, latencia) |
| 68 | `benchmark-modelos-ia/` (A/B MiniMax M3/M2.5) |
| 69 | `calibrar-temperatura/` (determinismo según caso de uso) |

#### G. Creación de stacks (4 nuevos + 2 refactor)

| # | Skill |
|---|---|
| 70 | `crear-endpoint/` (refactor v2: añade auth, RBAC, validación, tests) |
| 71 | `crear-pagina/` (refactor v2: añade WCAG y tests Vitest) |
| 72 | `crear-componente-react/` |
| 73 | `crear-pantalla-android/` |
| 74 | `crear-handler-cqrs/` (Command/Query + Validator + Test) |
| 75 | `crear-middleware-node/` |

#### H. DevOps/Deploy/Migración (5 nuevos + 2 refactor)

| # | Skill |
|---|---|
| 76 | `deploy-backend/` (refactor v2: Railway multi-service) |
| 77 | `migrar-base-datos/` (refactor v2: añade versionado) |
| 78 | `deploy-railway-node/` |
| 79 | `deploy-railway-dotnet/` |
| 80 | `empaquetar-apk-android/` |
| 81 | `publicar-ghcr/` |

#### I. Seguridad y cumplimiento (4 nuevos)

| # | Skill |
|---|---|
| 82 | `gestionar-secret-rotation/` |
| 83 | `gestionar-organizacion/` (multi-tenant onboarding, invitaciones) |
| 84 | `configurar-tenant/` (crear org, asignar roles) |
| 85 | `aplicar-consentimiento-lpdp/` |

#### J. Calidad y testing (3 nuevos)

| # | Skill |
|---|---|
| 86 | `correr-journey-test/` |
| 87 | `smoke-test-produccion/` |
| 88 | `correr-property-based-test/` (FsCheck, fast-check) |

#### K. Datos y catálogos (2 nuevos)

| # | Skill |
|---|---|
| 89 | `validar-catalogos/` (JSON schema) |
| 90 | `sincronizar-catalogos/` (regenerar docs desde JSON) |

> **Total skills**: 90 archivos nuevos + 8 refactor = **86 finales** (algunos compartidos/agrupados para mantener el número 86; ver §0.3).

### 4.3 Plantilla de skill

```markdown
---
name: <slug>
description: <1 línea>
when-to-use: "<trigger>"
allowed-tools: <subset>
---

# <Title>

## Inputs
## Output schema
## Steps
## Quality gates
## Audit log
## Rollback
## References (catalogs, agents, verifiers)
```

---

## 5. INSTRUCTIONS — 15 archivos

Ubicación: `.github/instructions/`

| # | Archivo | applyTo | Propósito |
|---|---|---|---|
| 1 | `android-compose.instructions.md` (existente, refactor) | `LegalProAndroid/**/*.kt` | Testing, Hilt avanzado, KSP, R8 |
| 2 | `dotnet-cqrs.instructions.md` (existente, refactor) | `LegalProBackend_Net/**/*.cs` | OTel, multi-tenant, test xUnit |
| 3 | `legal-prompts.instructions.md` (existente, refactor) | `**/services/*ai*.{js,ts,cs}` | Usa `catalogs/minimax-functions.json` |
| 4 | `node-express.instructions.md` | `legalpro-app/server/**/*.js` | Express 5 ESM, middleware, repos, schemas, errores |
| 5 | `frontend-react.instructions.md` | `legalpro-app/src/**/*.{jsx,tsx,ts}` | React 19, hooks, performance, ARIA, mobile-first |
| 6 | `supabase-rls.instructions.md` | `**/migrations/*.sql`, `legalpro-app/server/init.sql` | RLS, índices, multi-tenant, soft-delete |
| 7 | `playwright-e2e.instructions.md` | `legalpro-app/e2e/*.spec.js` | Selectores, accesibilidad, journeys, RBAC |
| 8 | `kotlin-android.instructions.md` | `LegalProAndroid/**/*.kt` (complemento) | Testing, navegación, Hilt avanzado, Supabase SDK |
| 9 | `lpdp-compliance.instructions.md` | `**/*.{js,ts,cs}` con PII | Consentimiento, retención, redacción, ARCO |
| 10 | `prompt-engineering-legal.instructions.md` | `**/prompts/**` | Plantillas y patrones para system instructions |
| 11 | `sql-postgres.instructions.md` | `**/*.sql` | Convenciones de estilo, EXPLAIN, índices, ANALYZE |
| 12 | `pnpm-monorepo.instructions.md` | `**/package.json` | (futuro) pnpm workspaces si migra a monorepo |
| 13 | `csharp-async.instructions.md` | `**/*Controller.cs`, `**/*Service.cs` | Async/await, CancellationToken, ValueTask |
| 14 | `react-hooks.instructions.md` | `**/hooks/*.js` | Reglas de hooks, deps array, memo, custom hooks |
| 15 | `minimax-error-handling.instructions.md` | `**/services/*ai*.{js,ts,cs}` | 403, 429, schema mismatch, retry, fallback |

---

## 6. WORKFLOWS — 20 archivos

Ubicación: `.github/workflows/`

| # | Archivo | Trigger | Jobs |
|---|---|---|---|
| 1 | `ci.yml` (existente, refactor) | push/PR a main | (añade vitest, dotnet coverage) |
| 2 | `deploy-landing.yml` (existente) | push a main (paths) + manual | (sin cambios) |
| 3 | `docker-publish.yml` (existente) | tag v* + manual | (sin cambios) |
| 4 | `security.yml` (existente, refactor) | push/PR + cron lunes 03:00 UTC | (añade codeql-js, codeql-kotlin) |
| 5 | `deploy-railway.yml` | push a main + manual | node-api, dotnet-api, frontend, db-migrate con aprobaciones |
| 6 | `test-e2e.yml` | PR a main | playwright + vitest journey + server integration, artefactos, reporte HTML |
| 7 | `smoke-postdeploy.yml` | workflow_run (deploy-railway) | smoke-production.mjs, 5 roles demo, notifica Slack |
| 8 | `build-android.yml` | tag v*-android + manual | gradle assembleRelease, firma con keystore, upload artefacto, GHCR |
| 9 | `db-migrate.yml` | push a main (paths: `migrations/**`, `init.sql`) + manual | supabase db push con aprobación de @database |
| 10 | `nightly-ia-evals.yml` | cron 02:00 UTC | set fijo de prompts legales contra MiniMax, diff vs golden, alerta regresión |
| 11 | `release.yml` | tag v* | changelog automático, semver, GH Release, sign-off |
| 12 | `codeql-js.yml` | push/PR (paths: `legalpro-app/`) | codeql javascript-queries |
| 13 | `codeql-kotlin.yml` | push/PR (paths: `LegalProAndroid/`) | codeql kotlin-queries o android-lint |
| 14 | `secret-rotation.yml` | cron mensual día 1 04:00 UTC | ejecuta `gestionar-secret-rotation`, actualiza GH Secrets, notifica |
| 15 | `labeler.yml` | PR opened/updated | auto-etiqueta por área: `area/backend`, `area/frontend`, `area/ia` |
| 16 | `agent-eval.yml` | push/PR (paths: `.github/agents/**`, `.github/skills/**`) | corre golden tests de skills + verifica catálogos referenciados |
| 17 | `arneses-registry.yml` | push/PR (paths: `arneses/registry/**`, `catalogs/**`) | regenera `arneses/registry/INDEX.json` y publica artefacto |
| 18 | `uptime-synthetics.yml` | cron 5 min | blackbox contra `/health` de node-api y dotnet-api, alerta en Slack |
| 19 | `bundle-size.yml` | PR (paths: `legalpro-app/src/**`) | analiza bundle Vite, falla si supera presupuesto (300kb gz main chunk) |
| 20 | `coverage-gate.yml` | PR (paths: `LegalProBackend_Net/**`) | coverlet ≥80%, falla si baja |

---

## 7. PROMPTS REUTILIZABLES — 32 archivos

Ubicación: `.github/prompts/`

| # | Prompt | Slash command |
|---|---|---|
| 1 | `analizar.expediente.prompt.md` | /analizar-expediente |
| 2 | `buscar.jurisprudencia.prompt.md` | /buscar-jurisprudencia |
| 3 | `comparar.precedentes.prompt.md` | /comparar-precedentes |
| 4 | `redactar.demanda.prompt.md` | /redactar-demanda |
| 5 | `redactar.contestacion.prompt.md` | /redactar-contestacion |
| 6 | `redactar.apelacion.prompt.md` | /redactar-apelacion |
| 7 | `redactar.casacion.prompt.md` | /redactar-casacion |
| 8 | `redactar.acusacion.prompt.md` | /redactar-acusacion |
| 9 | `redactar.alegato.prompt.md` | /redactar-alegato-clausura |
| 10 | `redactar.medida.cautelar.prompt.md` | /redactar-medida-cautelar |
| 11 | `redactar.amparo.prompt.md` | /redactar-amparo |
| 12 | `redactar.habeas.corpus.prompt.md` | /redactar-habeas-corpus |
| 13 | `redactar.pericial.prompt.md` | /redactar-pericial |
| 14 | `simular.juicio.prompt.md` | /simular-juicio |
| 15 | `sugerir.objecion.prompt.md` | /sugerir-objecion |
| 16 | `sugerir.pregunta.interrogatorio.prompt.md` | /sugerir-pregunta-interrogatorio |
| 17 | `predecir.resultado.prompt.md` | /predecir-resultado |
| 18 | `resumir.expediente.prompt.md` | /resumir-expediente |
| 19 | `resumir.caso.prompt.md` | /resumen-ejecutivo |
| 20 | `chat.legal.prompt.md` | /chat-legal |
| 21 | `monitor.sinoe.prompt.md` | /monitor-sinoe |
| 22 | `caso.critico.prompt.md` | /caso-critico |
| 23 | `retroalimentacion.prompt.md` | /reporte-retroalimentacion |
| 24 | `multidoc.prompt.md` | /gestion-multidoc |
| 25 | `boveda.prompt.md` | /boveda-custodia |
| 26 | `panel.expertos.prompt.md` | /panel-expertos |
| 27 | `liquidar.laboral.prompt.md` | /liquidar-laboral |
| 28 | `liquidar.tributario.prompt.md` | /liquidar-tributario |
| 29 | `calcular.plazos.prompt.md` | /calcular-plazos |
| 30 | `consultar.norma.prompt.md` | /consultar-norma |
| 31 | `auditar.codigo.prompt.md` | /auditar-codigo (genérico) |
| 32 | `revisar.pr.prompt.md` | /revisar-pr (code review) |

---

## 8. HOOKS — 10 archivos

Ubicación: `arneses/hooks/`

| # | Archivo | Lenguaje | Trigger | Acción |
|---|---|---|---|---|
| 1 | `lefthook.yml` | YAML | pre-commit, pre-push, commit-msg, post-merge | Orquestador |
| 2 | `pre-commit.lint-eslint.sh` | Bash | pre-commit | ESLint --max-warnings 0 |
| 3 | `pre-commit.format-prettier.sh` | Bash | pre-commit | Prettier check |
| 4 | `pre-commit.lint-dotnet.sh` | Bash | pre-commit | dotnet format --verify-no-changes |
| 5 | `pre-commit.detect-secrets.sh` | Bash | pre-commit | Gitleaks pre-commit hook |
| 6 | `pre-commit.validate-catalogs.sh` | Bash | pre-commit | ajv validate catalogs/*.json |
| 7 | `pre-push.test-unit.sh` | Bash | pre-push | vitest + xUnit subset |
| 8 | `pre-push.smoke-build.sh` | Bash | pre-push | npm run build + dotnet build |
| 9 | `commit-msg.conventional.sh` | Bash | commit-msg | Valida conventional commits |
| 10 | `post-merge.reindex.sh` | Bash | post-merge | Reinicia daemon MCP, recarga instructions |

---

## 9. PLANTILLAS (Templates) — 24 archivos

Ubicación: `arneses/templates/`

| # | Plantilla | Uso |
|---|---|---|
| 1 | `AGENT.template.md` | Esqueleto de agente |
| 2 | `SKILL.template.md` | Esqueleto de skill |
| 3 | `INSTRUCTION.template.md` | Esqueleto de instruction |
| 4 | `WORKFLOW.template.yml` | Esqueleto de workflow |
| 5 | `PROMPT.template.md` | Esqueleto de prompt reusable |
| 6 | `ADR.template.md` | Architecture Decision Record (MADR) |
| 7 | `PRD.template.md` | Product Requirements Document |
| 8 | `RUNBOOK.template.md` | Runbook de incidente |
| 9 | `CHANGELOG.template.md` | Keep a Changelog |
| 10 | `ISSUE-BUG.template.md` | Template de issue bug |
| 11 | `ISSUE-FEATURE.template.md` | Template de issue feature |
| 12 | `PR.template.md` | Template de Pull Request |
| 13 | `TEST-UNIT.template.js` | Esqueleto de test unitario JS |
| 14 | `TEST-UNIT.template.cs` | Esqueleto de test unitario C# |
| 15 | `TEST-UNIT.template.kt` | Esqueleto de test unitario Kotlin |
| 16 | `TEST-INTEGRATION.template.js` | Esqueleto de test de integración JS |
| 17 | `TEST-INTEGRATION.template.cs` | Esqueleto de test de integración C# |
| 18 | `TEST-E2E.template.spec.js` | Esqueleto de test Playwright |
| 19 | `MIGRATION.template.sql` | Migración SQL con RLS |
| 20 | `ENDPOINT.template.cs` | Controller .NET delgado |
| 21 | `ENDPOINT.template.js` | Express route con auth/RBAC |
| 22 | `PAGE.template.jsx` | Página React con layout/auth/loading |
| 23 | `COMPONENT.template.jsx` | Componente UI con props/states |
| 24 | `SCREEN.template.kt` | Pantalla Compose con ViewModel |

---

## 10. RUNBOOKS — 16 archivos

Ubicación: `arneses/runbooks/`

| # | Runbook | Escenario |
|---|---|---|
| 1 | `RB-001-5xx-spike.md` | Picos de 5xx en API |
| 2 | `RB-002-brute-force-detected.md` | BruteForceProtection dispara |
| 3 | `RB-003-tenant-leak.md` | Cross-tenant data leak detectado |
| 4 | `RB-004-minimax-quota-exceeded.md` | Cuota MiniMax agotada |
| 5 | `RB-005-minimax-deprecation.md` | MiniMax anuncia deprecation |
| 6 | `RB-006-pg-down.md` | PostgreSQL inaccesible |
| 7 | `RB-007-supabase-outage.md` | Supabase caído |
| 8 | `RB-008-deploy-failed.md` | Deploy Railway falla |
| 9 | `RB-009-migration-failed.md` | Migración SQL falla |
| 10 | `RB-010-lpdp-breach.md` | Brecha de datos (LPDP 24h notificación) |
| 11 | `RB-011-jwt-secret-rotated.md` | Rotación de JWT_SECRET |
| 12 | `RB-012-cost-ia-spike.md` | Costo IA disparado (>$500/mes) |
| 13 | `RB-013-slo-violation.md` | SLO violado (latencia/error rate) |
| 14 | `RB-014-onboarding-failures.md` | Usuarios no pueden completar onboarding |
| 15 | `RB-015-payment-failed.md` | Stripe/pagos fallan |
| 16 | `RB-016-token-replay-detected.md` | Replay de token detectado |

---

## 11. VERIFICADORES / AUDITORES — 22 scripts

Ubicación: `tools/verifiers/`

| # | Script | Lenguaje | Qué audita |
|---|---|---|---|
| 1 | `verifier-lpdp.mjs` | Node | LPDP: consentimientos, retención, ARCO endpoints, transferencia flag |
| 2 | `verifier-arco.mjs` | Node | Derechos ARCO endpoints existen y funcionan |
| 3 | `verifier-transferencia-internacional.mjs` | Node | Flag consentimiento + redacción PII |
| 4 | `verifier-firma-digital.mjs` | Node | Hash + timestamp en Documento |
| 5 | `verifier-rls.mjs` | Node | Policies RLS en cada tabla nueva |
| 6 | `verifier-owasp.mjs` | Node | OWASP Top 10 con grep semántico |
| 7 | `verifier-secretos.mjs` | Node | Gitleaks + JWT_SECRET≥32 |
| 8 | `verifier-multi-tenant.mjs` | Node | `IgnoreQueryFilters`, ITenantRequest, integración cross-tenant |
| 9 | `verifier-rbac.mjs` | Node | Matriz rol×endpoint, SoD |
| 10 | `verifier-accesibilidad.mjs` | Node | axe-core contra build local |
| 11 | `verifier-rendimiento-ia.mjs` | Node | Latencia MiniMax, tokens, retry |
| 12 | `verifier-costo-tokens.mjs` | Node | Coste USD por request |
| 13 | `verifier-deprecation-modelos.mjs` | Node | Modelos MiniMax deprecados |
| 14 | `verifier-contrato-api.mjs` | Node | Pact consumer/provider |
| 15 | `verifier-schema.mjs` | Node | Migración versionada |
| 16 | `verifier-outbox.mjs` | Node | Reintentos y DLQ |
| 17 | `verifier-quota.mjs` | Node | Race conditions |
| 18 | `verifier-idempotencia.mjs` | Node | Cache hit/miss |
| 19 | `verifier-brute-force.mjs` | Node | Umbral + lockout |
| 20 | `verifier-masking.mjs` | Node | Snapshot test MaskingTextFormatter |
| 21 | `verifier-cobertura-tests.mjs` | Node | Coverlet ≥80% |
| 22 | `verifier-slo.mjs` | Node | Latencia p95, error rate |

---

## 12. REGISTROS (Registry) — 14 archivos

Ubicación: `arneses/registry/`

| # | Archivo | Propósito |
|---|---|---|
| 1 | `agents.json` | Inventario de agentes (50) |
| 2 | `skills.json` | Inventario de skills (86) |
| 3 | `instructions.json` | Inventario de instructions (15) |
| 4 | `workflows.json` | Inventario de workflows (20) |
| 5 | `prompts.json` | Inventario de prompts (32) |
| 6 | `hooks.json` | Inventario de hooks (10) |
| 7 | `templates.json` | Inventario de templates (24) |
| 8 | `runbooks.json` | Inventario de runbooks (16) |
| 9 | `verifiers.json` | Inventario de verificadores (22) |
| 10 | `catalogs.json` | Inventario de catálogos (18) |
| 11 | `INDEX.json` | Índice maestro del arnés |
| 12 | `DEPENDENCIES.json` | Grafo: agente → skill → catálogo → verificador |
| 13 | `CHANGELOG.md` | Cambios del arnés |
| 14 | `OWNERS.json` | Quién mantiene cada sección |

---

## 13. GOBERNANZA — 10 archivos

Ubicación: `.github/governance/`

| # | Archivo | Propósito |
|---|---|---|
| 1 | `CODE_OF_CONDUCT.md` | Código de conducta para contributors |
| 2 | `CONTRIBUTING.md` | Cómo contribuir (issues, PRs, commits, ADRs) |
| 3 | `DECISION-MAKING.md` | Quién aprueba qué (veto de gobernanza, ADRs) |
| 4 | `SECURITY-POLICY.md` | Política de seguridad, versiones soportadas, reporte de vulnerabilidad |
| 5 | `RELEASE-POLICY.md` | Versionado semver, changelog, rama de release, criterios |
| 6 | `DATA-CLASSIFICATION.md` | Niveles: público, interno, confidencial, PII, PII-sensible |
| 7 | `INCIDENT-RESPONSE.md` | Procedimiento ante incidentes |
| 8 | `VENDOR-RISK.md` | Evaluación de proveedores (Google, Supabase, Railway) |
| 9 | `CHANGE-MANAGEMENT.md` | Cómo se cambian los propios arneses |
| 10 | `COMPLIANCE-MAPPING.md` | Mapeo: LPDP art. X → control Y → verificador Z |

---

## 14. FIXTURES — 18 archivos

Ubicación: `arneses/fixtures/`

| # | Fixture | Uso |
|---|---|---|
| 1 | `expediente-penal-caso1.json` | Expediente penal típico |
| 2 | `expediente-civil-caso1.json` | Expediente civil típico |
| 3 | `expediente-laboral-caso1.json` | Expediente laboral típico |
| 4 | `expediente-familiar-caso1.json` | Expediente de familia |
| 5 | `organizacion-free.json` | Org FREE (límite bajo) |
| 6 | `organizacion-pro.json` | Org PRO |
| 7 | `organizacion-enterprise.json` | Org ENTERPRISE |
| 8 | `usuario-abogado.json` | Usuario ABOGADO |
| 9 | `usuario-fiscal.json` | Usuario FISCAL |
| 10 | `usuario-juez.json` | Usuario JUEZ |
| 11 | `usuario-contador.json` | Usuario CONTADOR |
| 12 | `documento-prueba.pdf.bin` | PDF dummy |
| 13 | `imagen-prueba.jpg.bin` | Imagen dummy |
| 14 | `audio-audiencia.mp3.bin` | Audio dummy |
| 15 | `consumo-tokens-ia.json` | Histórico de consumo |
| 16 | `audit-log-eventos.json` | Eventos para tests |
| 17 | `jurisprudencia-pin.json` | Citación jurisprudencial |
| 18 | `minimax-eval-set.json` | Golden set para evals IA |

---

## 15. RUTAS CRÍTICAS (archivos a modificar)

### 15.1 Archivos existentes a refactorizar

| Archivo | Cambio | Justificación |
|---|---|---|
| `.github/AGENTS_GUIDE.md` | Reescrito para referenciar `catalogs/role-tools.json` y el nuevo `arquitecto-chief` | Eliminar duplicación |
| `.github/copilot-instructions.md` | Añadir referencia a catálogos y regla "consultar catálogo antes de inventar" | Combatir alucinaciones |
| `.github/agents/arquitecto.agent.md` | Renombrar a `arquitecto-chief.agent.md` (con refactor) | Mando único |
| `.github/agents/planner.agent.md` | Renombrar a `planner-chief.agent.md` (con refactor) | Mismo motivo |
| `.github/agents/dominio-legal.agent.md` | Dividir en 5 especialistas por rama | Granularidad |
| `.github/agents/ia-legal.agent.md` | Dividir en 16 especialistas por herramienta | Granularidad |
| `.github/agents/seguridad.agent.md` | Dividir en `auditor-seguridad`, `auditor-lpdp`, `auditor-rbac`, `auditor-multi-tenant` | Especialización |
| `.github/agents/testing.agent.md` | Mantener `@testing` y añadir `@journey-tester`, `@smoke-tester` | Especialización |
| `.github/agents/contador.agent.md` | Dividir en `contador-tributarista`, `contador-laboralista` | Granularidad |
| `.github/agents/android.agent.md` | Refactor: añadir testing, KSP, R8 | Madurez |
| `.github/agents/frontend.agent.md` | Refactor: añadir Vitest, ARIA, performance | Madurez |
| `.github/agents/database.agent.md` | Refactor: añadir versionado de migraciones | Madurez |
| `.github/agents/devops.agent.md` | Refactor: añadir OTel, secrets rotation | Madurez |
| `.github/instructions/android-compose.instructions.md` | Refactor: añadir testing | Madurez |
| `.github/instructions/dotnet-cqrs.instructions.md` | Refactor: añadir OTel, multi-tenant | Madurez |
| `.github/instructions/legal-prompts.instructions.md` | Refactor: usar `catalogs/minimax-functions.json` | Combatir alucinaciones |
| 8 SKILLs actuales | Refactor a v2 con referencia a catálogos | Eliminar duplicación |
| 4 workflows actuales | Refactor: añadir codeql-js, codeql-kotlin, vitest, coverage | Madurez |
| `legalpro-app/server/initDb.js` | Mover a migración versionada (DbUp/FluentMigrator) | Auditabilidad |
| `LegalProBackend_Net/Program.cs` | Añadir OTel, endpoints `/health/ready`, `/health/live` separados | SRE |
| `docs/PLAN_MADUREZ_LEGAL_PERU.md` | Actualizar score de madurez tras implementar arnés | Métrica |
| `PRODUCTION_READINESS_CHECKLIST.md` | Sincronizar con nuevos verificadores | Trazabilidad |

---

## 16. FASES DE IMPLEMENTACIÓN (orden de ejecución)

El arnés se construye en 6 olas. Cada ola entrega valor verificable antes de pasar a la siguiente.

### Ola 1 — Fundaciones (semana 1-2)
**Objetivo**: catálogos + gobernanza básica.
- 18 catálogos (§2) + 12 esquemas (§2.1)
- 10 docs de gobernanza (§13)
- 16 runbooks (esqueletos) (§10)
- 14 fixtures (§14)
- 24 plantillas (§9)
- 10 hooks (§8)
- 14 registros (vacíos) (§12)
- `arneses/registry/INDEX.json` con datos parciales

**Verificación**: `ajv validate catalogs/*.json`, `bash arneses/hooks/pre-commit.validate-catalogs.sh`.

### Ola 2 — Refactor de agentes existentes (semana 2-3)
**Objetivo**: 13 agentes actuales refactorizados a v2, eliminando duplicación.
- 1 refactor `arquitecto` → `arquitecto-chief`
- 1 refactor `planner` → `planner-chief`
- 1 división `dominio-legal` → 5 especialistas
- 1 división `ia-legal` → 16 especialistas
- 1 división `seguridad` → 4 auditores
- 1 división `contador` → 2 especialistas
- 4 refactors de `backend-dotnet`, `android`, `frontend`, `database`
- 1 refactor de `devops`
- 1 nuevo `backend-node`
- 1 nuevo `debug` refactor (mantiene API, mejora docs)
- 1 nuevo `product-owner`
- 1 nuevo `gobernanza-chief`
- 1 nuevo `release-manager`

**Verificación**: `bash tools/verifiers/verifier-coverage-agents.mjs` (nuevo).

### Ola 3 — Agentes especialistas y auditores (semana 3-5)
**Objetivo**: 37 nuevos agentes (16 IA + 5 legales + 2 contables + 8 auditores + 4 journey/sre + 2 integraciones + 3 operación).
- 16 agentes `@ia-*` (uno por herramienta IA)
- 5 agentes legales por rama
- 2 agentes contadores
- 8 agentes auditores (seguridad, legal, lpdp, accesibilidad, multi-tenant, performance, cost-ia)
- 4 agentes journey/smoke/sre/prompt-engineer
- 2 agentes integraciones/devops refactor
- 3 agentes operación (onboarding, localization, docs-writer)
- 1 agente `reviser`

**Verificación**: `bash arneses/registry/validate-registry.sh`.

### Ola 4 — Skills nuevos (semana 4-7)
**Objetivo**: 78 skills nuevos en 11 categorías, además de 8 refactor v2.
- 22 auditores
- 11 análisis legal + 1 refactor
- 14 redacción legal + 1 refactor
- 3 simulación + 1 refactor
- 12 otras herramientas IA
- 3 config IA + 1 refactor
- 4 creación stacks + 2 refactor
- 5 devops + 2 refactor
- 4 seguridad
- 3 testing
- 2 catálogos

**Verificación**: `bash arneses/hooks/pre-push.test-unit.sh` + golden tests de skills (`agent-eval.yml`).

### Ola 5 — Instructions, workflows, prompts, hooks (semana 6-8)
**Objetivo**: instrucciones auto-aplicadas, workflows de CI/CD, prompts reutilizables, hooks de pre-commit.
- 12 nuevas instructions + 3 refactor
- 16 nuevos workflows + 4 refactor
- 32 prompts reutilizables
- 10 hooks (incluyendo lefthook.yml)

**Verificación**: `bash arneses/hooks/pre-commit.*.sh` + ejecución de cada workflow en rama de prueba.

### Ola 6 — Verificadores, registry, gobernanza end-to-end (semana 8-10)
**Objetivo**: 22 verificadores ejecutables, 14 registros, dashboards, runbooks operativos.
- 22 scripts `tools/verifiers/verifier-*.mjs`
- 14 registros en `arneses/registry/`
- Activación de CodeQL JS/Kotlin
- Activación de nightly IA evals
- Activación de smoke-postdeploy
- Sincronización de `PRODUCTION_READINESS_CHECKLIST.md` y `PLAN_MADUREZ_LEGAL_PERU.md`

**Verificación**: Ejecutar todos los 22 verificadores en CI y publicar reporte.

---

## 17. MÉTRICAS DE ÉXITO

El arnés se considera exitoso cuando se cumplen las siguientes métricas (medibles en CI):

| # | Métrica | Target | Cómo se mide |
|---|---|---|---|
| 1 | Cobertura de tests .NET | ≥80% | `coverlet` + `coverage-gate.yml` |
| 2 | Cobertura de tests Node | ≥80% | `vitest --coverage` + threshold |
| 3 | Cobertura de tests E2E | 100% de los 18 specs | Playwright reporter |
| 4 | Cumplimiento LPDP score | 4/4 | `verifier-lpdp.mjs` + manual |
| 5 | Citas legales inventadas | 0% | `verifier-legal.mjs` (AuditorLegal) |
| 6 | Cross-tenant leaks | 0 en prod | `verifier-multi-tenant.mjs` + integration tests |
| 7 | Secrets en código | 0 | Gitleaks pre-commit + PR |
| 8 | Tests OWASP | 100% verde | `verifier-owasp.mjs` |
| 9 | Accesibilidad WCAG 2.1 AA | 100% sin críticos | `verifier-accesibilidad.mjs` con axe-core |
| 10 | Latencia p95 /ai/* | < 3s | `verifier-slo.mjs` |
| 11 | Coste IA mensual | < $500 para plan Pro | `verifier-costo-tokens.mjs` |
| 12 | Modelos MiniMax deprecados | 0 | `verifier-deprecation-modelos.mjs` |
| 13 | Brute force protection | 100% endpoints auth | `verifier-brute-force.mjs` |
| 14 | Idempotency | 100% POST mutables | `verifier-idempotencia.mjs` |
| 15 | Outbox sin poison messages | 0 | `verifier-outbox.mjs` |
| 16 | ARCO endpoints funcionando | 100% | `verifier-arco.mjs` |
| 17 | Firma digital en documentos | 100% | `verifier-firma-digital.mjs` |
| 18 | RLS policies en tablas | 100% | `verifier-rls.mjs` |
| 19 | Catálogos sincronizados | 100% | `verifier-catalogos.mjs` |
| 20 | Agentes/skills documentados | 100% | `registry-validator.mjs` |
| 21 | Bundle size main chunk | < 300kb gz | `bundle-size.yml` |
| 22 | Score de madurez legal Perú | 4/4 | `PLAN_MADUREZ_LEGAL_PERU.md` |

---

## 18. VERIFICACIÓN END-TO-END

Una vez implementadas las 6 olas, se valida el arnés ejecutando:

```bash
# 1. Validar catálogos
bash arneses/hooks/pre-commit.validate-catalogs.sh

# 2. Validar registry
node tools/verifiers/verifier-arneses-registry.mjs

# 3. Ejecutar todos los verificadores
for v in tools/verifiers/verifier-*.mjs; do
  echo "==> $v"
  node "$v" || echo "FAIL: $v"
done

# 4. Correr suite completa
npm run test:unit
npm run test:integration
npm run test:e2e

# 5. Smoke test producción
node smoke-production.mjs

# 6. Evaluar skills (golden tests)
node tools/verifiers/verifier-skills-golden.mjs

# 7. Evaluar IA (evals)
node tools/verifiers/verifier-ia-evals.mjs

# 8. Generar reporte
node arneses/registry/generate-report.mjs > arneses/registry/REPORT.md
```

Si todos los pasos retornan `0` exit code y las 22 métricas de §17 están en target, el arnés está operativo.

---

## 19. RIESGOS Y MITIGACIONES

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| 1 | Resistencia al cambio del equipo | Alta | Medio | Onboarding gradual; sesiones de 30 min por ola; arnés opcional durante olas 1-2 |
| 2 | Catálogos desactualizados | Media | Alto | `nightly-ia-evals.yml` valida vigencia; `@auditor-legal` weekly review |
| 3 | Sobrecarga de CI por 22 verificadores | Media | Medio | Ejecución paralela, cache de tests E2E, matriz por dominio |
| 4 | MiniMax deprecación de modelo | Media | Crítico | `verifier-deprecation-modelos.mjs` daily + `RB-005-minimax-deprecation.md` |
| 5 | Alucinaciones en citas legales | Alta | Crítico | `verifier-legal.mjs` + golden set + `catalogs/codigos-leyes.json` con SPIJ |
| 6 | LPDP breach por error | Baja | Crítico | `verifier-lpdp.mjs` en cada PR + `RB-010-lpdp-breach.md` |
| 7 | Cross-tenant leak | Baja | Crítico | `verifier-multi-tenant.mjs` + integration tests cross-tenant