---
description: Liquida impuestos
---

# /liquidar-tributario

Calcula IGV o IR según el tipo.

## Uso

```
/liquidar-tributario <tipo> <monto> [periodo]
```

## Tipos

- `igv` (18%)
- `ir_3ra` (categoría)
- `ir_4ta` (categoría)
- `ir_5ta` (categoría)
- `percepcion`
- `retencion`

## Agente

`@contador-tributarista`

## Output

- Impuesto calculado
- Base imponible
- Tasa efectiva
- Crédito fiscal (si aplica)
