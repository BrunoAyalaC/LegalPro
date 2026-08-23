---
description: Reglas para código Node 20 + Express 5
globs:
  - "legalpro-app/server/**/*.js"
  - "legalpro-app/server/**/*.mjs"
---

# Reglas Backend Node 20 + Express 5

Aplicar estas reglas al editar archivos JS en `legalpro-app/server/`.

## ESM puro

- `"type": "module"` en package.json
- `import`/`export` (NO `require`)
- `__filename` y `__dirname` con `fileURLToPath(import.meta.url)`

## Middleware

- SIEMPRE `authMiddleware` antes de cualquier ruta protegida
- SIEMPRE `tenantMiddleware` para validar `X-Organization-Id`
- SIEMPRE `requireRole([...])` en endpoints con RBAC
- `idempotencyMiddleware` en POST mutables
- `quotaMiddleware` en endpoints IA
- `promptSanitizer` antes de enviar a MiniMax

## Respuestas JSON consistentes

```js
{
  success: true,
  data: {},
  error: null,
  correlationId: "uuid"
}
```

## Seguridad

- Helmet con CSP estricta
- CORS restrictivo desde `ALLOWED_ORIGINS`
- HTTPS-only cookies (httpOnly, secure, sameSite=lax)
- Sanitización de input con Zod/Joi
- bcrypt para passwords
- JWT >= 32 chars

## Testing

- Vitest + Supertest
- Mockear MiniMax y Supabase
- Tests de RBAC, multi-tenant, idempotencia
