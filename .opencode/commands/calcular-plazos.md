---
description: Calcula plazos procesales
---

# /calcular-plazos

Calcula un plazo procesal peruano considerando feriados.

## Uso

```
/calcular-plazos <acto_procesal> <fecha_inicio> [tipo_plazo]
```

## Parámetros

- `acto_procesal` (requerido): apelación, contestación, casación, etc.
- `fecha_inicio` (requerido): YYYY-MM-DD
- `tipo_plazo` (opcional): habil | calendario

## Agente

`@ia-calculadora-plazos`

## Output

- Días del plazo
- Fecha de vencimiento
- Días excluidos (sábados, domingos, feriados MINJUS)
- Base legal (artículo + código)
