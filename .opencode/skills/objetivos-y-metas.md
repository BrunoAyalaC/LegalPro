---
name: objetivos-y-metas
description: Definicion de objetivos SMART, OKRs, KPIs, metas operacionales y criterios de exito para features, releases, y agentes IA. Alineado con Rubrica de Calidad del proyecto.
when-to-use: "Al planificar feature, release, sprint, o evaluar desempeno de un agente"
allowed-tools: Read, Write, Edit, Grep, Glob, todowrite
updated: 2026-07-31
metodologias: [SMART, OKR, MoSCoW, RICE, ICE, Definition-of-Done]
---

# objetivos-y-metas (v3.0 RAG-optimized)

Documenta la metodología para definir **objetivos SMART**, **OKRs**, **KPIs** y **criterios de éxito** medibles y verificables. Aplicable a features, releases, sprints, desempeño de agentes IA. **A julio 2026**.

## Inputs

```yaml
tipo_objetivo: feature | release | sprint | agente_ia | operativo | regulatorio
descripcion: string
metodologia: SMART | OKR | MoSCoW | RICE | ICE
horizonte: sprint_2w | trimestre | semestre | ano
stakeholders: [array]
restricciones: [array]
```

## Output schema (OKR)

```json
{
  "version": "3.0",
  "objetivo": "string (inspiracional, cualitativo)",
  "key_results": [
    {
      "kr": "string (medible, cuantificable)",
      "baseline": "X",
      "target": "Y",
      "unidad": "string",
      "fecha_limite": "iso8601",
      "estado": "0.0 - 1.0"
    }
  ],
  "owner": "string",
  "criterios_exito": ["..."],
  "metricas_seguimiento": ["..."]
}
```

## Metodología SMART (objetivos atómicos)

Cada objetivo debe cumplir:

| Letra | Significado | Ejemplo legal |
|---|---|---|
| **S** | Specific | "Reducir alucinaciones en citas legales" |
| **M** | Measurable | "de 15% a < 2% medido en eval-set de 50 casos" |
| **A** | Achievable | "Factible con Function Calling forzado + validación contra catálogo" |
| **R** | Relevant | "Reduce riesgo de sanción por mala praxis" |
| **T** | Time-bound | "Antes del release v1.3.0 (30 sept 2026)" |

## OKR — Estructura

### **Objetivo** (cualitativo, inspiracional)
> "Ser la plataforma legal peruana con menor tasa de alucinaciones en IA"

### **Key Results** (cuantitativos, verificables)

| KR | Baseline | Target | Plazo |
|---|---|---|---|
| KR1: Tasa de alucinación en citas legales | 15% | < 2% | Q3 2026 |
| KR2: Cobertura de catálogo `codigos-leyes.json` | 18 leyes | 25 leyes | Q3 2026 |
| KR3: Latencia p95 con verificación | 800ms | < 1500ms | Q3 2026 |
| KR4: Score de auditoría LPDP | 3.2/4 | ≥ 3.8/4 | Q3 2026 |

## KPIs por dimensión

### Dimensión: Calidad Legal
- **Tasa de alucinación**: citas inventadas / total de citas (< 2%)
- **Cobertura de catálogo**: % de leyes peruanas catalogadas (> 95%)
- **Score auditoría LPDP**: 0-4 (≥ 3.8/4)
- **Precisión de plazos**: % de plazos correctamente calculados (> 99%)
- **Score de fundamentación jurídica**: 0-10 (> 8/10)

### Dimensión: Performance
- **API latency p95**: < 500ms (no-IA), < 3000ms (IA)
- **Web Core Web Vitals**: LCP < 2.5s, FID < 100ms, CLS < 0.1
- **Bundle main**: < 300kb gz
- **DB query p95**: < 50ms
- **MiniMax cost/req**: < $0.10 promedio
- **Uptime**: > 99.9% (medido por Sentry/uptime monitor)

### Dimensión: Seguridad
- **Hallazgos CRITICAL**: 0
- **Hallazgos HIGH sin remediación**: 0
- **OWASP A01-A10 cobertura**: 100%
- **LPDP score**: ≥ 3.8/4
- **Multi-tenant leaks**: 0
- **Brute force attempts bloqueados**: > 99%

### Dimensión: Producto
- **Active tenants**: count (crecimiento mensual > 5%)
- **MAU (Monthly Active Users)**: count
- **Feature adoption**: % de tenants usando feature X
- **NPS**: > 50
- **Churn mensual**: < 3%

## Definición de Done (DoD)

Una feature está **Done** cuando:

- [ ] Cumple los OKRs asociados
- [ ] Tests pasan (unit + integration + E2E)
- [ ] Cobertura ≥ 80%
- [ ] Documentación actualizada (README + OpenAPI)
- [ ] Verificadores pasan (28 verifiers)
- [ ] Sign-off de los 3 chiefs (Arquitecto, Gobernanza, Release)
- [ ] Audit log emite eventos correctos
- [ ] Performance cumple SLOs (p95, bundle, Core Web Vitals)
- [ ] Sin warnings de compilación ni linting
- [ ] Sin TODOs ni código muerto
- [ ] Deployado a staging y validado

## RICE (priorización)

Para backlog de features:

```
RICE Score = (Reach × Impact × Confidence) / Effort

Reach:     # usuarios alcanzados por trimestre
Impact:    0.25 (minimal) | 0.5 (low) | 1 (medium) | 2 (high) | 3 (massive)
Confidence: 0.5 (low) | 0.8 (medium) | 1.0 (high)
Effort:    person-months
```

## MoSCoW (priorización release)

- **Must have**: crítico para release
- **Should have**: importante pero no bloqueante
- **Could have**: deseable si hay tiempo
- **Won't have (this time)**: explícitamente fuera del alcance

## Aplicación a agentes IA

Cada agente del arnés tiene:

1. **Misión**: 1 frase clara
2. **Inputs esperados**: schema
3. **Outputs**: schema
4. **Reglas duras**: invariantes
5. **KPIs propios**:
   - Tasa de cita correcta (> 98%)
   - Latencia (< 3s para análisis)
   - Costo/req (< $0.10)
   - Tasa de disclaimer presente (100%)
6. **Audit events**: qué emite
7. **Criterio de éxito**: condiciones de GO

## Quality gates

- [ ] Objetivo SMART verificable
- [ ] OKR con 3-5 Key Results cuantificables
- [ ] Baseline documentado
- [ ] Target con fecha límite
- [ ] Owner asignado
- [ ] Métricas de seguimiento instrumentadas
- [ ] Revisión periódica (semanal/sprint)

## Audit log

Emitir `OBJECTIVE_DEFINED` con payload: `objetivo_id, tipo, metodologia, owner, fecha`.

## Referencias

- `docs/PRD-MVP-PRODUCTION.md`
- `docs/CHECKLIST-PRE-PRODUCCION.md`
- `catalogs/sla-slo.md`
- `catalogs/role-tools.json`
- Andy Grove — High Output Management (OKRs originador)
- John Doerr — Measure What Matters (OKRs modernos)
- SMART: https://en.wikipedia.org/wiki/SMART_criteria
