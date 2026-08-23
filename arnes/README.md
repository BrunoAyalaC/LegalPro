# Arnés Agentic de Ingeniería Estricta — LegalPro / LexIA Perú

> 55 agentes, 19 catálogos, 9 verificadores funcionales, 4 runbooks críticos, 6 plantillas, 4 hooks, formato OpenCode nativo con `permission: allow` y temperaturas optimizadas.

## 🏛️ Arquitectura: Las 3 Capas del Proyecto

El proyecto LegalPro / LexIA tiene **3 capas claramente separadas**, todas cubiertas por el arnés:

```
┌─────────────────────────────────────────────────────────────────────┐
│ CAPA 1: 👥 USUARIOS FINALES                                       │
│ Apps: legalpro-app/ (React+Vite), LegalProAndroid/ (Kotlin)      │
│ Backend: legalpro-app/server/ (Node), LegalProBackend_Net/ (.NET)  │
│ Roles: ABOGADO, FISCAL, JUEZ, CONTADOR                              │
│ 16 herramientas IA + 14 features                                    │
│ Rutas: /analista, /objeciones, /boveda, /predictor, /redactor...   │
│ Puerto: 3000 (web), 5000 (.NET), Android                            │
│ Agentes: 35 (ia-*, legal-*, contador-*, stack engineers)           │
└─────────────────────────────────────────────────────────────────────┘
                              ↕ auth JWT + RLS + audit log
┌─────────────────────────────────────────────────────────────────────┐
│ CAPA 2: 👑 OWNER DEL SISTEMA (SaaS Admin)                            │
│ App: legalpro-owner-dashboard/ (Node + Express + PostgreSQL)        │
│ E2EE: PBKDF2 (100k) + AES-256-GCM                                  │
│ Puerto: 3005                                                        │
│ Auth: OWNER_SECRET_KEY (Bearer) + OWNER_DECRYPTION_SECRET (E2EE)    │
│ Ve: KPIs de costos USD/tokens, consumo por tenant, por modelo      │
│ Acciones: suspender tenant, cambiar plan, ver PII (con aprobación)│
│ Agentes: 5 (owner-admin, plataforma-finanzas, soporte-cliente,     │
│          marketing-growth, ux-ui)                                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↕ mismo PostgreSQL, RLS preservado
┌─────────────────────────────────────────────────────────────────────┐
│ CAPA 3: 🛡️ SISTEMA INTERNO (DevOps/SRE/Compliance)                  │
│ Agentes del arnés: @SRE, @DevOps, @GobernanzaChief, @AuditorLPDP   │
│ Backstage: configs, secrets, deploys, runbooks                    │
│ No expuesto a usuarios ni al owner                                │
└─────────────────────────────────────────────────────────────────────┘
```

## 📊 Agentes del Arnés (55 total)

### Mando y gobernanza (5)
- `@arquitecto-chief`, `@planner-chief`, `@product-owner`, `@gobernanza-chief`, `@release-manager`

### Ingeniería de stacks (5)
- `@backend-dotnet`, `@backend-node`, `@android`, `@frontend`, `@database`

### IA Legal especialistas (16)
- 16 herramientas IA del usuario: analista, objeciones, boveda, buscador, comparador, estrategia, alegatos, casos-criticos, multidoc, monitor, predictor, redactor, retroalimentacion, resumen, simulador, chat

### Legal por rama (5)
- `@legal-penalista`, `@legal-civilista`, `@legal-laboralista`, `@legal-constitucionalista`, `@legal-fiscalista`

### Contador (2)
- `@contador-tributarista`, `@contador-laboralista`

### Calidad / Auditoría (8)
- `@reviser`, `@auditor-seguridad`, `@auditor-legal`, `@auditor-lpdp`, `@auditor-accesibilidad`, `@auditor-multi-tenant`, `@auditor-performance`, `@auditor-cost-ia`

### Journey / Smoke / Observabilidad (4)
- `@journey-tester`, `@smoke-tester`, `@sre`, `@prompt-engineer`

### Integraciones (2)
- `@integraciones-peru`, `@devops`

### Operación interna (4)
- `@onboarding-mentor`, `@localization`, `@docs-writer`, `@debug`

### **Owner & Plataforma (5 NUEVOS)**
- `@owner-admin` — Gestiona tenants, planes, facturación, KPIs
- `@plataforma-finanzas` — Costos IA, precios, MRR, márgenes
- `@soporte-cliente` — Tickets, escalaciones, KB, NPS
- `@marketing-growth` — Landing, conversión, A/B, SEO, email
- `@ux-ui` — Diseño UX/UI, WCAG, heurísticas Nielsen

## 🛡️ Verificadores (9 funcionales + 13 pendientes)

### Implementados ✅

| # | Verificador | Cubre |
|---|---|---|
| 1 | `verifier-catalogos.mjs` | Valida 9 catálogos JSON |
| 2 | `verifier-owasp.mjs` | OWASP Top 10, secrets hardcoded |
| 3 | `verifier-lpdp.mjs` | LPDP 29733: consentimientos, ARCO, transferencia, firma |
| 4 | `verifier-multi-tenant.mjs` | Aislamiento, IgnoreQueryFilters, RLS |
| 5 | `verifier-owner-auth.mjs` | Auth del owner dashboard |
| 6 | `verifier-owner-e2ee.mjs` | PBKDF2 100k + AES-256-GCM |
| 7 | `verifier-owner-secrets.mjs` | OWNER_SECRET_KEY no hardcoded |
| 8 | `verifier-cost-spike.mjs` | Detección de spikes de costo IA |
| 9 | `verifier-glosario-juridico.mjs` (en runbooks) | — |

### Pendientes

10. `verifier-rbac.mjs`, 11. `verifier-rls.mjs`, 12. `verifier-idempotencia.mjs`, 13. `verifier-quota.mjs`, 14. `verifier-outbox.mjs`, 15. `verifier-firma-digital.mjs`, 16. `verifier-arco.mjs`, 17. `verifier-transferencia-internacional.mjs`, 18. `verifier-bundle-size.mjs`, 19. `verifier-accesibilidad.mjs`, 20. `verifier-masking.mjs`, 21. `verifier-coverage.mjs`, 22. `verifier-arneses-registry.mjs`

## 📚 Catálogos (19)

1. `role-tools.json` — Capacidades por rol
2. `minimax-functions.json` — 16 Function Declarations
3. `env-vars.md` — Variables de entorno (auth, DB, Supabase, MiniMax, observability)
4. `supabase-schema.md` — 17 tablas PostgreSQL con RLS
5. `tipos-penales-peru.json` — 25 tipos penales CP
6. `plazos-procesales.json` — 17 plazos procesales
7. `glosario-juridico.md` — Glosario controlado
8. `delitos-economicos.json` — 16 delitos económicos
9. `codigos-leyes.json` — 20 códigos/leyes peruanas
10. `reguladores-peru.json` — 13 reguladores peruanos
11. `audit-events.json` — 30 eventos canónicos
12. `owasp-mapping.md` — Mapeo OWASP Top 10
13. `sla-slo.md` — SLOs/SLAs
14. `disclaimers-ia.json` — 13 disclaimers IA
15. `dependabot.yml` — Dependabot
16. `CODEOWNERS` — Reglas de propiedad
17. `security-policy.md` — Política de seguridad
18. `release-policy.md` — Política de release
19. **`owner-dashboard.json` (NUEVO)** — Variables, KPIs, acciones, alertas, E2EE del owner

## 🏃 Runbooks (4 críticos + 16 pendientes)

### Implementados ✅
- `RB-001-5xx-spike.md` — Picos de errores 5xx
- `RB-010-lpdp-breach.md` — Breach de datos personales (P0, <= 5 días hábiles)
- `RB-017-owner-cost-spike.md` (NUEVO) — Spike de costo en plataforma
- `RB-018-owner-tenant-suspicious.md` (NUEVO) — Tenant con consumo anómalo
- `RB-019-owner-credentials-compromised.md` (NUEVO) — Credenciales del owner comprometidas
- `RB-020-owner-tenant-suspension.md` (NUEVO) — Suspensión de tenant (ToS)

## 🔐 Características del Formato OpenCode

- ✅ **Sin campo `model`** en ningún agente (usa el default del sistema)
- ✅ **`permission: allow`** global para `edit`, `bash`, `webfetch` en todos los agentes
- ✅ **Temperaturas diferenciadas**: 0.05 (auditores críticos) → 0.5 (simulador/onboarding/marketing)
- ✅ **`mode: subagent`** en todos
- ✅ **`color` Hex** por categoría
- ✅ **`steps`** configurados según criticidad (40-100)

## ⚖️ Cumplimiento Regulatorio Peruano

- **LPDP 29733**: consentimientos, ARCO, transferencia internacional, firma digital
- **Ley 27269**: firma digital
- **OWASP Top 10 2021**: 10 categorías cubiertas
- **NCPP, CPC, CC, CP**: bases legales en catálogos
- **LOPJ art. 290, CPC art. 132, CPP art. IX**: disclaimers IA
- **BCRP**: tipo de cambio e intereses en `owner-dashboard.json`
- **SUNAT, SUNARP, INDECOPI, ANPDP, MTPE**: 13 reguladores catalogados

## 🎯 Quick Start

```bash
# 1. Ver el plan completo
cat ARNES_AGENTIC_PLAN.md

# 2. Ver el índice del arnés
cat arneses/registry/INDEX.json

# 3. Ejecutar verificadores funcionales
node tools/verifiers/verifier-catalogos.mjs
node tools/verifiers/verifier-owasp.mjs
node tools/verifiers/verifier-lpdp.mjs
node tools/verifiers/verifier-multi-tenant.mjs
node tools/verifiers/verifier-owner-auth.mjs
node tools/verifiers/verifier-owner-e2ee.mjs
node tools/verifiers/verifier-owner-secrets.mjs
node tools/verifiers/verifier-cost-spike.mjs

# 4. Usar OpenCode
opencode
```

## 📈 Métricas de éxito

- Cobertura de tests >= 80%
- Cumplimiento LPDP score 4/4
- Citas legales verificadas 100%
- Cross-tenant leaks 0
- Secrets en código 0 (incluido owner dashboard)
- Costo IA controlado (alertas de spike)
- E2EE owner: tests pasan
- Latencia p95 < SLO

## 🗂️ Estructura

```
.
├── opencode.json                          # 55 agentes registrados
├── ARNES_AGENTIC_PLAN.md                  # Plan completo
├── arneses/README.md                      # Este archivo
│
├── .opencode/agents/                      # 55 agentes
│   ├── arquitecto-chief.md a ux-ui.md
│   └── (categoría: owner & plataforma = 5)
│
├── catalogs/                              # 19 catálogos
│   ├── role-tools.json, minimax-functions.json, ...
│   └── owner-dashboard.json (NUEVO)
│
├── tools/verifiers/                       # 9 funcionales
│   ├── verifier-catalogos.mjs a verifier-cost-spike.mjs
│
├── arneses/
│   ├── registry/                          # 3 registros
│   ├── templates/                         # 6 plantillas
│   ├── runbooks/                          # 6 críticos (RB-001, RB-010, RB-017-020)
│   ├── fixtures/                          # 2 fixtures
│   └── hooks/                             # 4 hooks
│
└── .github/governance/                    # 7 docs
```

## 🚀 Próximos pasos

- ✅ Ola 1: Catálogos + agentes + verifiers core + runbooks críticos
- ⏳ Ola 2: Actualizar opencode.json con 5 agentes owner nuevos
- ⏳ Ola 3: 13 verificadores restantes
- ⏳ Ola 4: 32 commands + 86 skills + 15 rules
- ⏳ Ola 5: 12 runbooks restantes + 16 fixtures + 12 JSON schemas

---

**Versión**: 1.1.0 (Owner agregado)
**Fecha**: 2026-06-12
**Owner**: @arquitecto-chief
**Aprobación**: @gobernanza-chief, @release-manager
