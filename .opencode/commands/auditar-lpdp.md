---
description: Audita cumplimiento LPDP
---

# /auditar-lpdp

Ejecuta auditoría de cumplimiento LPDP 29733.

## Uso

```
/auditar-lpdp [--pr=NUMERO] [--scope=archivos]
```

## Agente

`@auditor-lpdp`

## Verificadores que ejecuta

- `verifier-lpdp.mjs`
- `verifier-arco.mjs`
- `verifier-transferencia-internacional.mjs`
- `verifier-firma-digital.mjs`

## Output

- Reporte con hallazgos por artículo LPDP
- Severidad (CRITICAL, HIGH, MEDIUM, LOW)
- Sanciones potenciales (S/)
- Plan de remediación
- Plazo (5 días hábiles para breach)
