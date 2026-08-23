# LegalPro / LexIA — Arnés Agentic v3.1

> **Actualizado al 31/07/2026** · **Arquitectura PRIMARY + SUBAGENTS** · 1 orquestador + 96 subagents · 18 skills · 28 verificadores

Arnés agentic del proyecto LegalPro, plataforma legal peruana cloud-native. Diseñado para asistir en análisis jurídico, redacción procesal, cumplimiento regulatorio (LPDP, firma digital), auditorías de seguridad, optimización de performance, y más.

---

## 🎯 Arquitectura v3.1 (alineada con opencode.ai/agents)

### 1 agente PRIMARY + 96 subagents

```
┌───────────────────────────────────────────────────────────────┐
│  USUARIO                                                       │
│     ↓                                                          │
│  Tab key / @lexia-orchestrator                                │
│     ↓                                                          │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  lexia-orchestrator (UNICO PRIMARY)                     │  │
│  │  • mode: primary                                        │  │
│  │  • temperature: 0.2                                     │  │
│  │  • steps: 200                                           │  │
│  │  • task: allow para 96 subagents (glob patterns)       │  │
│  │  • Clasifica → Delega → Coordina → Valida → Responde   │  │
│  └─────────────────────────────────────────────────────────┘  │
│         ↓ @task tool                                           │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  96 SUBAGENTS (mode: subagent, sin model propio)        │  │
│  │  • Abogados (31)  • Contadores (5)  • Stack (5)        │  │
│  │  • IA Legal (16)  • Legal Legacy (5) • Auditores (7)   │  │
│  │  • Refutadores (5) • Red Team (1)  • Reviser (1)       │  │
│  │  • Observabilidad (4) • Integraciones (2)              │  │
│  │  • Operación (4)  • Owner Plataforma (5)              │  │
│  │  • Mando Chiefs (4)                                     │  │
│  └─────────────────────────────────────────────────────────┘  │
│         ↓ cada subagent consume skills (RAG-optimized)        │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  18 SKILLS (knowledge units, RAG-optimized)             │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

---

## 📊 Estadísticas (julio 2026)

| Categoría | Cantidad |
|---|---|
| **Agentes PRIMARY** | 1 (`lexia-orchestrator`) |
| **Agentes SUBAGENT** | 96 |
| **Total agentes** | 97 |
| **Skills** | 18 (8 actualizadas + 9 nuevas + 1 renombrada) |
| **Prompts** | 19 archivos (.txt) |
| **Commands** | 15 comandos slash |
| **Rules** | 15 reglas globales |
| **Verificadores** | 28 scripts automatizados |
| **Catálogos canónicos** | 25 archivos JSON |
| **Runbooks** | 22 (RB-001 a RB-021 + RB-DR-001) |
| **ADRs** | 3 firmados (Clean Arch, Adapter, Release) |
| **Hooks** | 11 (pre-commit, pre-push, post-merge) |

---

## 🗂️ Estructura del directorio

```
.opencode/
├── agents/              # 97 archivos (.md) — 1 PRIMARY + 96 SUBAGENTS
│   └── lexia-orchestrator.md  ← UNICO agente PRIMARY
├── commands/            # 15 comandos slash (.md)
├── prompts/             # 19 prompts optimizados (.txt)
├── rules/               # 15 reglas globales (.md)
├── skills/              # 18 skills (.md) — RAG-optimized
├── node_modules/        # plugins opencode (ignorar)
└── README.md            # este archivo
```

---

## 🤖 Agentes (97)

### 1 agente PRIMARY (orquestador)

| ID | Modo | Temperatura | Steps | Color |
|---|---|---|---|---|
| `lexia-orchestrator` | primary | 0.2 | 200 | `#0F172A` |

**¿Por qué solo 1 PRIMARY?** Per la documentación oficial de opencode.ai/agents:
> "There are two types of agents in OpenCode; primary agents and subagents. Primary agents are the main assistants you interact with directly."

> "Subagents are specialized assistants that primary agents can invoke for specific tasks."

`lexia-orchestrator` es el **único** agente primary custom que delega via `@task` tool a los 96 subagents especializados. Los usuarios pueden alternar entre los 3 primary agents disponibles (build, plan, lexia-orchestrator) usando la tecla **Tab**.

### 96 subagents especializados

#### Abogados (31)
- 1 chief (`abogado-chief`)
- 6 seniors (civil, constitucional, empresarial, laboral, penal, público)
- 24 juniors (penal, civil-procesal, laboral-colectivo, familia, tributario, ambiental, amparo, comercial, compliance, concursal, consumidor, crimen-organizado, educación, migratorio, minería-energía, notarial, penal-económico, procesal-penal, propiedad-intelectual, sanitario, seguridad-social, trabajo-forzoso, administrativo, arbitraje)

#### Contadores (5)
- 2 seniors (laboral, tributario)
- 3 juniors (forense, laboralista, tributarista)

#### Mando / Chiefs (4)
- arquitecto-chief, gobernanza-chief, planner-chief, product-owner, release-manager (5 - incluye release-manager)

#### Stack Engineers (5)
- backend-dotnet, backend-node, android, frontend, database

#### IA Legal Specialists (16)
- analista-expedientes, objeciones, boveda-evidencia, buscador-jurisprudencia, comparador-precendentes, estrategia-interrogatorio, generador-alegatos, generador-casos-criticos, gestion-multidoc, monitor-sinoe, predictor-judicial, redactor-escritos, reporte-retroalimentacion, resumen-ejecutivo, simulador-juicios, chat-legal

#### Legal Legacy (5)
- penalista, civilista, laboralista, constitucionalista, fiscalista

#### Auditores (7)
- accesibilidad, cost-ia, legal, lpdp, multi-tenant, performance, seguridad

#### Refutadores (5 — adversarial)
- arquitectura, legal, lpdp, performance, seguridad

#### Red Team (1) · Reviser (1) · Observabilidad (4) · Integraciones (2) · Operación (4) · Owner Plataforma (5)

---

## 🎯 Skills (18 — v3.0 RAG-optimized)

### Auditoría
- **auditar-lpdp** — Ley 29733 + ANPD + sanciones 2026
- **auditar-seguridad** — OWASP Top 10 2025 + CWE Top 25 2026

### IA-Legal
- **analizar-expediente** — 5 subtipos con RAG
- **redactar-escrito-legal** — 17 tipos de escritos PJ peruano
- **buscar-jurisprudencia** — 5 fuentes oficiales (TC, PJ, INDECOPI, SUNARP, MINJUSDH)
- **analisis-riesgos-procesales** — matriz probabilidad × impacto
- **liquidacion-laboral** — CTS, gratificaciones, vacaciones, utilidades

### IA-Config & RAG
- **configurar-minimax** — SDK oficial MiniMax M3 con Function Calling
- **rag-busqueda-semantica** — pipeline completo RAG legal

### Creación
- **crear-endpoint** — Node Express 5 ESM o .NET 8 CQRS
- **crear-pagina** — React 19 + Vite 7 + WCAG 2.1 AA

### DevOps
- **deploy-backend** — Railway + Docker multi-stage + secrets rotation

### Patrones Arquitectónicos
- **decoradores-patterns** — Higher-Order Functions (pipe, logging, retry, validation, circuit breaker, idempotencia)
- **observadores-eventos** — EventBus con outbox + prioridad + wildcard
- **adaptadores-externos** — Adapter Pattern (BCRP, SUNAT, SPIJ, etc.)
- **protocolos-pipeline** — Behaviors .NET + Middlewares Node + Decorators

### Performance
- **optimizadores-rendimiento** — Node, .NET, React, Postgres, IA

### Producto
- **objetivos-y-metas** — SMART, OKRs, KPIs, MoSCoW, RICE, DoD

---

## 📜 Reglas Globales (15)

Aplican por glob pattern. Cada regla se carga automáticamente cuando se edita un archivo matching el patrón.

| Regla | Aplica a | Descripción |
|---|---|---|
| `multitenant.md` | `**/*.cs`, `**/server/**/*.js`, `**/*.sql` | Multi-tenancy estricto |
| `frontend-react.md` | `legalpro-app/src/**/*.{jsx,tsx,ts}` | React 19 + Vite 7 + WCAG 2.1 AA |
| `node-express.md` | `legalpro-app/server/**/*.js` | Node 20 + Express 5 ESM |
| `dotnet-cqrs.md` | `LegalProBackend_Net/**/*.cs` | .NET 8 + CQRS + Clean Architecture |
| `csharp-async.md` | `LegalProBackend_Net/**/*.cs` | Async/await patterns |
| `react-hooks.md` | `legalpro-app/src/hooks/*.{js,ts}`, `*.{jsx,tsx}` | React Hooks |
| `sql-postgres.md` | `**/*.sql` | PostgreSQL/Supabase + RLS |
| `android-compose.md` | `LegalProAndroid/**/*.kt` | Android Kotlin/Compose + Hilt |
| `playwright-e2e.md` | `legalpro-app/e2e/*.spec.js` | Playwright + axe-core |
| `lpdp-compliance.md` | `**/usuarios*.{js,ts,cs}`, `**/consentimientos*`, `**/datos-personales*` | LPDP 29733 |
| `legal-prompts.md` | `**/services/minimax*.{js,ts,cs}` | Prompts legales MiniMax |
| `minimax-error-handling.md` | `**/services/minimax*.{js,ts,cs}` | Manejo errores MiniMax |
| `prompt-engineering-legal.md` | `**/prompts/**/*`, `**/*MiniMax*.{js,cs}` | Prompt engineering |
| `owner-dashboard.md` | `legalpro-owner-dashboard/**/*.js` | E2EE con PBKDF2 + AES-256-GCM |
| `pnpm-monorepo.md` | — | (vacío, pendiente) |

---

## 🎯 Comandos (15 slash commands)

- `/analizar-expediente` — Analiza un expediente judicial
- `/auditar-lpdp` — Auditoría LPDP completa
- `/auditar-owasp` — Auditoría OWASP
- `/auditar-seguridad` — Auditoría seguridad integral
- `/buscar-jurisprudencia` — Búsqueda jurisprudencia
- `/calcular-plazos` — Calcula plazos procesales
- `/crear-endpoint` — Crea endpoint REST
- `/liquidar-cts` — Calcula CTS
- `/liquidar-tributario` — Liquidación tributaria
- `/monitor-sinoe` — Monitorea SINOE
- `/predecir-resultado` — Predicción probabilística
- `/redactar.demanda` — Redacta demanda
- `/review-pr` — Review de PR
- `/simular-juicio` — Simulación de audiencia
- `/smoke-test` — Smoke test post-deploy

---

## 🛠️ Verificadores (28)

Ejecutar suite completa:
```bash
for v in tools/verifiers/verifier-*.mjs; do echo "=== $v ==="; node "$v"; done
```

### Categorías
- **Seguridad**: owasp, secretos, rls, rbac, brute-force, masking, idempotencia, refutador-seguridad
- **LPDP**: lpdp, arco, transferencia-internacional, firma-digital
- **Multitenant**: multi-tenant, rls
- **Performance**: bundle-size, cost-spike, deprecation-modelos
- **Owner**: owner-auth, owner-e2ee, owner-secrets
- **Adaptadores**: adaptadores, contrato-api
- **Core**: catalogos, arneses-registry, cobertura

---

## 🚀 Quickstart

```bash
# 1. Abrir el proyecto
cd C:\Users\Pc\Desktop\Abogacia

# 2. Iniciar opencode
opencode

# 3. Alternar entre primary agents con Tab
#    - build (default, full tools)
#    - plan (análisis sin cambios)
#    - lexia-orchestrator (orquestador de LegalPro)

# 4. El orquestador delega a subagents via @task
#    Usuario: "@lexia-orchestrator necesito analizar el expediente X"
#    Orchestrator:
#      → @task ia-analista-expedientes (análisis)
#      → @task ia-buscador-jurisprudencia (precedentes)
#      → Sintetiza respuesta final

# 5. Invocar subagent directamente (con permiso manual)
@ia-redactor-escritos redacta demanda de alimentos

# 6. Comandos slash
/analizar-expediente <uuid> completo ABOGADO

# 7. Skills explícitas
skill("auditar-lpdp")
```

---

## 🔐 Permisos (v3.1)

### opencode.json — task permissions

```json
{
  "agent": {
    "lexia-orchestrator": {
      "mode": "primary",
      "permission": {
        "task": {
          "*": "deny",
          "abogado-*": "allow",
          "contador-*": "allow",
          "ia-*": "allow",
          "legal-*": "allow",
          "auditor-*": "allow",
          "refutador-*": "allow",
          "red-team": "allow",
          "reviser": "allow",
          "arquitecto-chief": "allow",
          "gobernanza-chief": "allow",
          "planner-chief": "allow",
          "product-owner": "allow",
          "release-manager": "allow",
          "backend-dotnet": "allow",
          "backend-node": "allow",
          "android": "allow",
          "frontend": "allow",
          "database": "allow",
          "devops": "allow",
          "integraciones-peru": "allow",
          "journey-tester": "allow",
          "smoke-tester": "allow",
          "sre": "allow",
          "prompt-engineer": "allow",
          "debug": "allow",
          "docs-writer": "allow",
          "localization": "allow",
          "onboarding-mentor": "allow",
          "owner-admin": "allow",
          "plataforma-finanzas": "allow",
          "soporte-cliente": "allow",
          "marketing-growth": "allow",
          "ux-ui": "allow"
        }
      }
    }
  }
}
```

**Reglas de matching** (opencode.ai/agents docs):
- "Rules are evaluated in order, and the last matching rule wins"
- `"*": "deny"` se evalúa primero → deniega TODO por defecto
- `"abogado-*": "allow"` después → habilita TODOS los abogados

---

## 📚 Documentación complementaria

- **`arneses/registry/INDEX.json`** — índice maestro con estadísticas
- **`arneses/registry/agents.json`** — registro de 97 agentes (1 primary + 96 subagents)
- **`arneses/registry/skills.json`** — registro de 18 skills
- **`catalogs/codigos-leyes.json`** — 20 leyes peruanas
- **`catalogs/plazos-procesales.json`** — 17 plazos procesales
- **`docs/PRD-MVP-PRODUCTION.md`** — PRD del MVP
- **`docs/CHECKLIST-PRE-PRODUCCION.md`** — checklist de release
- **`docs/GAPS-IDENTIFICADOS.md`** — gaps identificados
- **`https://opencode.ai/docs/agents/`** — documentación oficial opencode (jul-2026)

---

## 🔄 Changelog

### [3.1.0] — 2026-07-31 — Arquitectura Primary + Subagents

**ARQUITECTURA CORRECTA per opencode.ai/agents docs**:

- ✅ **1 agente PRIMARY** (`lexia-orchestrator`) creado
  - Modo: primary, temperatura: 0.2, steps: 200
  - Color distintivo: `#0F172A`
  - Sin `model` (heredado del global)
  - `task` permissions: allow para 96 subagents via glob
  - Matriz de routing completa (6 categorías)
  - Métricas objetivo: routing ≥95%, latencia p95 <10s

- ✅ **96 subagents** verificados
  - Todos con `mode: subagent`
  - Todos con `temperature` (diferenciada por criticidad)
  - **CERO uso de `model`** (cumple opencode.ai/agents docs)
  - CERO `model` en cualquier agente

- ✅ **opencode.json v3.1** actualizado
  - 3 primary agents: build, plan, lexia-orchestrator
  - task permissions configuradas (allow/deny con glob)
  - Política: subagents NUNCA usan `model`

- ✅ **Registry actualizado** (INDEX.json, agents.json, CHANGELOG.md)
  - agents.json con 97 agentes (1 primary + 96 subagents)
  - Estadísticas reflejan nueva arquitectura

### [3.0.0] — 2026-07-31 — RAG-optimized + Patrones Arquitectónicos
*(versión previa — sin orquestador)*

### [1.0.0] — 2026-06-12 — Versión inicial
*(versión previa — sin orquestador)*

---

## 📞 Contacto / Soporte

- **Documentación**: `docs/` y `arneses/`
- **OpenCode docs**: https://opencode.ai/docs/agents/
- **Issues**: revisar `docs/GAPS-IDENTIFICADOS.md` antes de reportar
- **Compliance**: contactar `@gobernanza-chief` o `@auditor-lpdp`
- **Arquitectura**: contactar `@arquitecto-chief`
- **Orquestación**: contactar `@lexia-orchestrator`

---

> **Última actualización**: 31/07/2026 · v3.1 · 1 PRIMARY + 96 SUBAGENTS · 322 archivos totales
