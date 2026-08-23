---
description: Crea un endpoint backend
---

# /crear-endpoint

Crea un endpoint REST backend (Node o .NET).

## Uso

```
/crear-endpoint <stack> <metodo> <ruta> [auth]
```

## Stacks

- node
- dotnet

## Ejemplo

```
/crear-endpoint node POST /api/documentos AUTH
```

## Agente

`@backend-node` o `@backend-dotnet`

## Output

- Controller/Route
- Validator (Zod/FluentValidation)
- Tests
- Audit log
- Verificadores ejecutados
