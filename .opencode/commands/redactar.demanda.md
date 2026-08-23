---
description: Redacta una demanda civil
---

# /redactar-demanda

Genera una demanda civil con formato del Poder Judicial peruano.

## Uso

```
/redactar-demanda <tipo> <expediente_id> [--hechos=X] [--fundamentos=Y]
```

## Parámetros

- `tipo` (requerido): demanda | contestacion | reconvencion | apelacion
- `expediente_id` (requerido): UUID
- `--hechos`: Descripción de los hechos
- `--fundamentos`: Fundamentos jurídicos

## Agente

`@ia-redactor-escritos`

## Output

- Demanda en formato Markdown
- Citas verificadas con link a SPIJ
- Disclaimers IA obligatorios
- Petitorio + fundamentación
- Sugerencia de prueba
