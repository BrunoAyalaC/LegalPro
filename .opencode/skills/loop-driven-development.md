---
name: loop-driven-development
version: 1.0.0
categoria: meta-proceso
agente_owner: "@lexia-orchestrator"
updated: 2026-08-21
descripcion: "Protocolo Loop Driven Development Engine (LDDE): loop obligatorio de 6 etapas (BUILD→AUDIT→REFUTE→OPTIMIZE→SECURE→GATE) que TODO output de skill debe recorrer antes de ship. Config canónica en arneses/registry/ldde-loop.json."
---

# 🔄 Skill: Loop Driven Development Engine (LDDE) v1.0

> **REGLA ARNÉS v3.2**: Tú (subagent) NO ejecutas este loop completo por ti mismo.
> El `lexia-orchestrator` (único primary, sin model propio — tú tampoco tienes model:
> heredas del primary) te despacha UNA etapa a la vez. Esta skill define el contrato
> de cada etapa y los criterios de gate.

## Arquitectura del arnés (contexto obligatorio)

```
lexia-orchestrator (PRIMARY, único, temperature 0.2)
    │  despacha etapas vía @task con instrucciones LDDE
    ▼
144 subagents (mode: subagent, model: null → heredan del primary,
               permissions {task,edit,bash,webfetch} = allow)
```

- **Sin modelo propio**: tu config NO declara `model`. Heredas el del primary.
  Esto centraliza costo, swapping y cero drift de versiones.
- **Permisos totales**: tienes task/edit/bash/webfetch allow. La seguridad NO vive
  en permisos sino en: matriz `catalogs/skill-access-control.json` + verifiers CI
  + gates de este loop.
- **Anti-robo de skills**: solo puedes invocar skills listadas para ti en
  `skills_por_agente`. Si una tarea requiere una skill ajena, DEVUELVE el control
  al orquestador (`NEEDS_SKILL_DELEGATION`) — nunca la invoques por tu cuenta.

## Las 6 etapas del loop

```
S1 BUILD ──► S2 AUDIT ──► S3 REFUTE ──► S4 OPTIMIZE ──► S5 SECURE ──► S6 GATE
   ▲                                                                  │
   │                    FAIL (hallazgos como input)                   │
   └──────────────────────────────────────────────────────────────────┘
                        max_iterations (2-3 según categoría)
                                   │ max alcanzado
                                   ▼
                             ESCALATE → chief del dominio
```

### S1 — BUILD (owner de la skill)
- Ejecuta TU skill principal siguiendo su frontmatter (inputs/outputs/quality gates).
- Self-check antes de devolver: ¿cumple tus propios quality gates? ¿4+ disclaimers IA
  si aplica? ¿citas contra `catalogs/codigos-leyes.json`?
- Output: resultado + declaración explícita de qué gates crees cumplir.

### S2 — AUDIT (auditor del dominio)
- Config: `ldde-loop.json → loops_por_categoria[categoría].auditores`
- Valida el output contra catálogos canónicos (`catalogs/*.json`).
- Produce: informe con score 0-100 + hallazgos por severidad (archivo:línea si código).

### S3 — REFUTE (refutador adversarial)
- Config: `.refutadores`
- Misión: ROMPER el output. Casos borde, prompt injection, citas falsas, cross-tenant,
  PII leakage, N+1, regresiones. Un refutador que no encuentra nada no trabajó.
- Produce: vectores confirmados/refutados con evidencia.

### S4 — OPTIMIZE (optimizador)
- Config: `.optimizadores`
- Mejora performance/costo SIN sacrificar corrección del S2/S3.
- Prohibido: optimizar eliminando validaciones, disclaimers o masking.
- Produce: diff + métricas antes/después.

### S5 — SECURE (seguridad)
- Config: `.seguridad`
- Pase final OWASP Top 10 + LPDP Art. 21 (transferencia internacional), masking PII,
  disclaimers #DC2626 donde aplica.
- Produce: hallazgos con severidad; CRITICAL = gate fail automático.

### S6 — GATE (verifiers automáticos)
- Ejecuta los verifiers de `.gates_verifiers` (existen en `tools/verifiers/`).
- Veredicto:
  - **SHIP**: todos PASS + criterios_gate cumplidos → emite `LDDE_SHIP` audit event.
  - **ITERATE**: fallas no críticas → vuelve a S1 con hallazgos como input (iteración n+1).
  - **ESCALATE**: falla crítica o `iteration > max_iterations` → escala al chief del
    dominio (`escalation_map`).

## Contrato de respuesta por etapa

Toda respuesta de etapa incluye SIEMPRE:

```json
{
  "etapa": "S2",
  "skill_origen": "crear-endpoint",
  "loop_categoria": "creacion",
  "iteracion": 1,
  "veredicto": "PASS | FAIL | NEEDS_SKILL_DELEGATION",
  "hallazgos": [{ "severidad": "HIGH", "descripcion": "...", "evidencia": "file:línea" }],
  "gates_candidatos": ["verifier-owasp.mjs"],
  "disclaimers_ia": 4,
  "citas_verificadas_pct": 100
}
```

## Anti-robo de skills (hard rules)

1. **Matriz es ley**: `catalogs/skill-access-control.json → skills_por_agente[agente]`.
2. **Loop roles ≠ skill access**: ser auditor en un loop NO te autoriza a ejecutar la
   skill del builder; solo evalúas su output.
3. **Verificación doble**: orquestador valida en dispatch-time; verifiers
   (`verifier-skills-access.mjs`, `verifier-ldde-loop.mjs`) validan en CI.
4. **Violación = escalada**: uso de skill no autorizada → audit event
   `SKILL_ACCESS_VIOLATION` + reporte a `@arquitecto-chief`.

## Quality gates mínimos universales

| Gate | Criterio |
|---|---|
| Disclaimers IA | ≥ 4 cuando el output involucra IA generativa |
| Citas legales | 100% verificadas contra catálogos (0 alucinaciones toleradas) |
| PII | masking obligatorio en logs/outputs; dni/ruc cifrados con pgcrypto |
| Multi-tenant | ningún leak cross-tenant; tenantContext presente |
| RAG | `degraded:true` ⇒ `rag_verificado:false` obligatorio |
| Costo IA | < $0.10 por request |

## Referencias

- Config máquina: `arneses/registry/ldde-loop.json`
- Matriz acceso: `catalogs/skill-access-control.json`
- Registry skills: `arneses/registry/skills.json` (v3.1, campo `ldde`)
- Registry agentes: `arneses/registry/agents.json` (v3.2, reglas_v32)
- Verifiers: `tools/verifiers/verifier-*.mjs`
