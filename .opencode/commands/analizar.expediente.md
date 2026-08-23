---
description: Analiza un expediente judicial con 5 subtipos
---

# /analizar-expediente

Analiza un expediente judicial peruano con el tipo de análisis especificado.

## Uso

```
/analizar-expediente <expediente_id> [tipo_analisis] [rol]
```

## Parámetros

- `expediente_id` (requerido): UUID del expediente
- `tipo_analisis` (opcional, default: completo): completo | fortalezas_debilidades | riesgos | estrategia | resumen
- `rol` (opcional, default: ABOGADO): ABOGADO | FISCAL | JUEZ | CONTADOR

## Agente

`@ia-analista-expedientes`

## Ejemplos

```
/analizar-expediente abc-123-uuid completo ABOGADO
/analizar-expedientes abc-123-uuid riesgos
```
