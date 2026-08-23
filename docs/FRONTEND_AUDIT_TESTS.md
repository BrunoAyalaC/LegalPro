# Auditoria de Tests del Frontend - LegalPro

> Fecha: 1 de agosto de 2026
> Frameworks: Vitest 4, Playwright, Supertest
> Total tests: ~820

## 1. Inventario de Tests

### Backend Node (Vitest + Supertest) - 22 archivos

| Archivo | Tests | Estado |
|---------|------:|--------|
| `auth-journey.test.js` | ~35 | ✅ |
| `clientes.test.js` | ~22 | ✅ |
| `clientes-rls.test.js` | ~27 | ✅ |
| `documentos-exportar.test.js` | ~25 | ✅ |
| `documentos-upload.test.js` | ~6 | ✅ |
| `evidencia-inmutabilidad.test.js` | ~1 | ✅ |
| `exhaustive-journey.test.js` | ~2500+ aserciones | ✅ |
| `expedientes-journey.test.js` | ~16 | ✅ |
| `organizaciones-journey.test.js` | ~19 | ✅ |
| `pages-fetch-smoke.test.js` | 10 (27 skipped) | ⚠️ |
| `panel-expertos.test.js` | 5 | ❌ **FAIL** |
| `production/prod-dotnet.test.js` | ~28 | ✅ |
| `production/prod-node.test.js` | ~32 | ✅ |
| `rag-flow.test.js` | 21 | ✅ 100% PASS |
| `rag-integration.test.js` | 10 | ✅ |
| `rag-routes.test.js` | 13 | ✅ 100% PASS |
| `rbac.test.js` | ~13 | ✅ |
| `resilience.test.js` | ~9 | ✅ |
| `smoke.test.js` | ~18 | ✅ |
| `token-repository.test.js` | ~7 | ✅ |
| `_diag.test.js` | 1 | ⚠️ |
| `_diag2.test.js` | 1 | ⚠️ |

### Frontend (Vitest) - 1 archivo

| Archivo | Tests | Estado |
|---------|------:|--------|
| `src/api/__tests__/client.helpers.test.js` | ~20 | ✅ |

### E2E (Playwright) - 23 specs

| Spec | Tests | Cobertura |
|------|------:|-----------|
| journey-completo | 64 | Flujo E2E completo |
| resilience | 69 | Resiliencia del sistema |
| accesibilidad-wcag | 46 | Tests accesibilidad |
| ux-visual | 38 | Tests visuales UX |
| exhaustive-produccion | 26 | Exhaustivo producción |
| produccion | 25 | Smoke producción |
| herramientas-ia | 22 | Herramientas IA |
| dashboard | 18 | Dashboard |
| registro | 19 | Registro usuarios |
| expedientes | 16 | Gestión expedientes |
| rutas-ui | 15 | Rutas UI |
| features-nuevas | 14 | Features nuevas |
| responsive | 14 | Diseño responsive |
| roles | 13 | Multi-rol |
| seguridad | 13 | Seguridad |
| produccion-real | 12 | Producción real |
| onboarding | 11 | Onboarding |
| ai-features | 9 | Features IA |
| navigation | 9 | Navegación |
| accessibility | 8 | Accesibilidad |
| login | 8 | Login |
| landing | 7 | Landing |
| critical-fixes | 5 | Fixes críticos |

## 2. Cobertura por Tipo

| Tipo | Cobertura | Tests |
|------|-----------|------|
| Unit (componentes UI) | 0% | 0 |
| Integration (API) | 80% | ~150 |
| E2E (journeys) | 40% | ~481 |
| RAG | 95% | 44 |
| Backend general | 70% | ~320 |
| **TOTAL** | **60%** | **~995** |

## 3. Gaps en Cobertura

### Frontend (CRITICO)
- Componentes UI: **0 tests**
- Paginas: **0 tests**
- Hooks: **0 tests**
- Contexts: **0 tests**

### Tests que fallan
- `panel-expertos.test.js` - apunta a ruta obsoleta `/api/gemini/panel-expertos` (debería ser `/api/ai/panel-expertos`)

## 4. Configuracion de Tests

### Vitest
- Version: 4.1
- Cobertura habilitada: parcial
- Threshold: no definido globalmente

### Playwright
- Version: 1.58
- Browsers: chromium, firefox, webkit
- E2E specs: 23

## 5. Scripts NPM

```json
{
  "test:e2e": "playwright test",
  "test:server": "vitest run --config vitest.config.server.js",
  "test:production": "vitest run --config vitest.config.prod.js",
  "test:prod:api": "vitest run --config vitest.config.prod.js server/__tests__/production",
  "test:rag": "vitest run --config vitest.config.server.js ../tests/cross-tenant",
  "test:cross-tenant": "vitest run ../tests/cross-tenant/cross-tenant-isolation.test.js"
}
```

## 6. Ejecucion de Tests

### Ultima corrida
- Backend Node: ~320 tests PASS
- RAG: 44 tests PASS (38 + 10 integración - algunos skips)
- E2E: ~481 tests PASS
- Coverage: ~60% (backend), 0% (frontend)

## 7. Issues Detectados

### CRITICOS
1. **0 tests de componentes UI** (alto riesgo regresion)
2. **Sin CI que ejecute tests automaticos** (no existe `.github/workflows/`)
3. **Coverage no habilitado en vitest** (no hay thresholds)
4. `panel-expertos.test.js` apunta a ruta obsoleta (debería `/api/ai/`)

### ALTOS
5. 27 tests `.skip` en `pages-fetch-smoke.test.js`
6. 2 archivos `_diag*.test.js` commiteados (deberían estar en `.gitignore`)

### MEDIOS
7. Sin tests de carga
8. Sin tests de accesibilidad automatizados con axe-core

## 8. Plan de Mejora de Tests

### Sprint 1 (P0) - BLOQUEANTE
- [ ] Suite vitest para 20 componentes UI con @testing-library/react
- [ ] CI pipeline con tests automaticos
- [ ] Corregir `panel-expertos.test.js`
- [ ] Habilitar coverage en vitest (threshold 80%)

### Sprint 2 (P1)
- [ ] Tests de hooks personalizados
- [ ] Tests de contexts
- [ ] Tests de integracion API (frontend)
- [ ] Tests de accesibilidad con axe-core

### Sprint 3 (P2)
- [ ] Visual regression tests (Playwright)
- [ ] Performance tests (Lighthouse CI)
- [ ] Load tests (k6)
- [ ] A11y tests completos

## Resumen
- **Total tests: ~995**
- **Coverage backend: ~60%**
- **Coverage frontend: 0%**
- **CI/CD: NO**
- **Pendientes: Suite UI + CI + Coverage**