---
name: <slug>
description: <1 línea, max 160 chars>
when-to-use: "<trigger>"
allowed-tools: <subset>
---

# <Título del Skill>

## Inputs

- <input 1>
- <input 2>

## Output schema

```json
{
  "type": "object",
  "properties": {}
}
```

## Steps

1. <paso 1>
2. <paso 2>
3. <paso 3>

## Quality gates

- [ ] <gate 1>
- [ ] <gate 2>

## Audit log

- Emitir evento `<EVENT_NAME>` con payload <X>

## Rollback

- <cómo revertir>

## References

- `catalogs/<x>.json`
- `.opencode/agents/<y>.md`
- `tools/verifiers/<z>.mjs`
