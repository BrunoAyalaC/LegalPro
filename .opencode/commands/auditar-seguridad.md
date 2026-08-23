---
description: Audita seguridad OWASP
---

# /auditar-seguridad

Ejecuta auditoría de seguridad OWASP Top 10.

## Uso

```
/auditar-seguridad [--pr=NUMERO]
```

## Agente

`@auditor-seguridad`

## Verificadores

- `verifier-owasp.mjs`
- `verifier-secretos.mjs`
- `verifier-brute-force.mjs`
- `verifier-rate-limit.mjs`
- `verifier-multi-tenant.mjs`

## Output

- Reporte con hallazgos OWASP A01-A10
- CWE/CVE asociado
- Severidad
- Fix sugerido
