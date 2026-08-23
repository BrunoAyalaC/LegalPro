---
description: Reglas para tests E2E con Playwright
globs:
  - "legalpro-app/e2e/*.spec.js"
---

# Reglas de Tests E2E con Playwright

Aplicar estas reglas al escribir tests E2E en `legalpro-app/e2e/`.

## Selectores

- **Priorizar** `getByRole`, `getByLabel`, `getByText`
- Evitar selectores por clase CSS (frágiles)
- Usar `data-testid` solo cuando no haya alternativa accesible

## Accesibilidad

- SIEMPRE validar WCAG con axe-core
- SIEMPRE usar `@axe-core/playwright`
- Verificar contraste, ARIA, focus

## Assertions

- **NO usar** `body.isVisible()` como única aserción
- Verificar contenido, estado, y efectos colaterales
- Aserciones reales del comportamiento esperado

## Setup/Teardown

- SIEMPRE `beforeEach` con datos limpios
- SIEMPRE `afterEach` con limpieza
- Screenshot en fallos
- Video on-failure

## Selectores resilientes

- `await page.getByRole('button', { name: 'Crear demanda' }).click()`
- NO `await page.click('.btn-primary')`

## Variables de entorno

- `BASE_URL` para staging vs production
- `TEST_USER_EMAIL` para tests
- `HEADLESS` para CI

## Cobertura de journeys

- 1 journey completo por rol (ABOGADO, FISCAL, JUEZ, CONTADOR)
- 1 journey por herramienta IA
- 1 journey RBAC cross-rol
