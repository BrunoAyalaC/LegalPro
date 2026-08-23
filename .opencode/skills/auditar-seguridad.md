---
name: auditar-seguridad
description: Auditoria OWASP Top 10 actualizada 2026 + secretos + RLS + RBAC + brute force + masking + idempotencia + proteccion IA.
when-to-use: "En cada PR, antes de release, o al menos 1 vez por semana"
allowed-tools: Bash, Grep, Glob
updated: 2026-07-31
estandares: OWASP Top 10 2025 + CWE Top 25 2026 + NIST SP 800-53 r2
---

# auditar-seguridad (v3.0 RAG-optimized)

Auditoría integral de seguridad alineada con **OWASP Top 10 2025** y prácticas actuales a julio 2026.

## Inputs

```yaml
scope: archivo | modulo | sistema
severidad_minima: INFO | LOW | MEDIUM | HIGH | CRITICAL
foco: [owasp, secrets, rls, rbac, brute_force, masking, idempotencia, ia, multi-tenant]
multitenant: bool
ia_activa: bool
```

## Output schema

```json
{
  "version": "3.0",
  "fecha_auditoria": "iso8601",
  "scope": "string",
  "owasp_a01_a10": {
    "A01_broken_access_control": { "score": "X/4", "hallazgos": [] },
    "A02_cryptographic_failures": { "score": "X/4", "hallazgos": [] },
    "A03_injection": { "score": "X/4", "hallazgos": [] },
    "A04_insecure_design": { "score": "X/4", "hallazgos": [] },
    "A05_security_misconfig": { "score": "X/4", "hallazgos": [] },
    "A06_vulnerable_components": { "score": "X/4", "hallazgos": [] },
    "A07_auth_failures": { "score": "X/4", "hallazgos": [] },
    "A08_data_integrity": { "score": "X/4", "hallazgos": [] },
    "A09_logging_failures": { "score": "X/4", "hallazgos": [] },
    "A10_ssrf": { "score": "X/4", "hallazgos": [] }
  },
  "total_hallazgos": "int",
  "criticos": "int",
  "altos": "int",
  "score_global": "X/4"
}
```

## Pasos (protocolo RAG — orden optimizado)

1. **Ejecutar suite completa de verificadores** (28 total):
   ```bash
   for v in tools/verifiers/verifier-*.mjs; do node "$v"; done
   ```
2. **Verificadores críticos** (orden de severidad):
   - `verifier-owasp.mjs` — OWASP Top 10 2025
   - `verifier-secretos.mjs` — Gitleaks + JWT_SECRET ≥ 32 chars
   - `verifier-rls.mjs` — Row Level Security policies
   - `verifier-rbac.mjs` — matriz rol × endpoint
   - `verifier-brute-force.mjs` — lockout ≥ 15 min tras 5 intentos
   - `verifier-masking.mjs` — PII en logs
   - `verifier-idempotencia.mjs` — POST mutables
   - `verifier-deprecation-modelos.mjs` — modelos MiniMax deprecados
   - `verifier-multi-tenant.mjs` — aislamiento
3. **Refutación adversarial** (Red Team mindset):
   - Buscar `IgnoreQueryFilters()`, `.skipTenant()`
   - Detectar hardcoded secrets, tokens, API keys
   - Buscar `console.log` con PII
   - Validar CORS estricto (no `*`)
   - Confirmar rate-limit en endpoints IA
4. **Componentes vulnerables** (A06):
   - `npm audit --production` (debe ser 0 high/critical)
   - `dotnet list package --vulnerable --include-transitive` (.NET)
   - `gradle dependencyUpdates` (Android)
5. **Seguridad IA** (nuevo 2026):
   - ¿Prompt injection mitigado? (declaración 23-feb-2026)
   - ¿Hay rate-limit por usuario en llamadas MiniMax?
   - ¿Output sanitization antes de retornar al usuario?

## Quality gates

- [ ] Cero hallazgos `CRITICAL`
- [ ] Cero `HIGH` sin remediación documentada
- [ ] Cobertura OWASP A01-A10 completa
- [ ] Plan de remediación con fechas
- [ ] A06: `npm audit` + `dotnet audit` limpios

## Audit log

Emitir `SECURITY_AUDIT_COMPLETED` con payload: `scope, total_hallazgos, criticos, altos, owasp_completo`.

## Referencias

- `catalogs/owasp-mapping.md` (controles OWASP 2025)
- `catalogs/audit-events.json`
- `catalogs/env-vars.md`
- `tools/verifiers/verifier-*.mjs` (28 verificadores)
- `arneses/runbooks/RB-002-brute-force-detected.md`
- `arneses/runbooks/RB-016-token-replay.md`
- OWASP Top 10 2025: https://owasp.org/Top10/
- CWE Top 25 2026: https://cwe.mitre.org/top25/
- Snyk Vulnerability DB: https://security.snyk.io/
- NIST SP 800-53 Rev. 2: https://csrc.nist.gov/publications/detail/sp/800-53/rev-2/final
