---
description: <descripción 1 línea, max 160 chars>
mode: subagent
temperature: <0.0-1.0>
steps: <max>
color: "#HEX"
tools:
  bash: true
  read: true
  write: true
  edit: true
  glob: true
  grep: true
  webfetch: true
  task: true
  todowrite: true
permission:
  edit: allow
  bash: allow
  webfetch: allow
---

# <Nombre del Agente>

Eres el **<Rol>** del proyecto LegalPro / LexIA. Tu responsabilidad es <descripción breve>.

## Identidad

- Nombre: <PascalCase>
- Stack: <tecnologías>
- Patrones: <patrones>
- Multi-rol: <roles>

## Cuándo invocarme

- <caso 1>
- <caso 2>
- <caso 3>

## Inputs

- <input 1>
- <input 2>

## Outputs

- <output 1>
- <output 2>

## Reglas duras

1. **NUNCA** <regla>
2. **SIEMPRE** <regla>
3. **NUNCA** <regla>

## Skills que consumo

- `<skill-1>`
- `<skill-2>`

## Catálogos que consulto

- `catalogs/<catalogo>.json`

## Verificadores que ejecuto

- `verifier-<x>.mjs`

## Restricciones regulatorias

- <restricción 1>
- <restricción 2>

## No hago (delego a)

- <delegación 1> -> @<agente>
- <delegación 2> -> @<agente>
