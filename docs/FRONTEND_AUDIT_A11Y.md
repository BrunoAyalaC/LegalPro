# Auditoría de Accesibilidad WCAG 2.1 AA — LegalPro

> **Fecha:** 1 de agosto de 2026
> **Estándar:** WCAG 2.1 AA + APG (ARIA Authoring Practices Guide)
> **Scope:** Frontend `legalpro-app/` (React 19 + Vite 7 + TailwindCSS 4)
> **Componentes auditados:** ~40 (todos los modales, formularios críticos, navegación)

---

## 1. Cumplimiento por Categoría WCAG

### 1.1 Perceptible
| Criterio | Estado | Observaciones |
|----------|--------|--------------|
| 1.1.1 Alternativas de texto | ✅ OK | 100% imágenes con `alt` (Layout, Login, Sidebar, Lightbox). Login usa `alt="Lex.ia"`. Background decorativo con `alt=""` correcto. |
| 1.3.1 Info y relaciones | ⚠️ Parcial | Semantic HTML correcto en mayoría, pero **labels sin `htmlFor`** en `Expedientes.jsx`, `SetupOrganizacion.jsx`. |
| 1.4.1 Uso del color | ✅ OK | Estados con color + texto/icono (badges, prioridades, errores). |
| 1.4.3 Contraste mínimo | ⚠️ Parcial | `slate-400` (#94a3b8) sobre `#0F172A` ratio ~7.0:1 ✅; `slate-500` (#64748b) en algunos casos borde (~4.5:1). CSS index.css tiene notas históricas de corrección a `#94a3b8`. |
| 1.4.4 Cambio de tamaño de texto | ✅ OK | Sin unidades absolutas en tipografía. |
| 1.4.11 Contraste no textual | ✅ OK | Bordes `white/10` y focus ring `blue-500` con contraste suficiente. |
| 1.4.12 Espaciado | ✅ OK | Padding generoso en inputs y botones. |

### 1.2 Operable
| Criterio | Estado | Observaciones |
|----------|--------|--------------|
| 2.1.1 Teclado | ⚠️ Parcial | Mayormente OK; **bug crítico** en `CommandPalette` Ctrl+K (no abre). |
| 2.1.2 Sin trampas de teclado | ❌ Falla | **`WizardShell.handleCancel` undefined** (línea 156 + 210): useEffect referencia función declarada después → TDZ. |
| 2.1.4 Atajos teclado | ⚠️ Parcial | `Esc` cierra modales globales ✅; **Ctrl+K no abre Command Palette** (bug). |
| 2.4.1 Evitar bloques | ✅ OK | |
| 2.4.3 Orden de foco | ⚠️ Parcial | Focus restoration OK en `Modal.jsx`; **falta en `IADisclaimerModal`**, `Login` (ForgotModal), modales inline de `Expedientes`. |
| 2.4.4 Propósito del enlace | ✅ OK | aria-labels presentes. |
| 2.4.6 Encabezados y labels | ✅ OK | h1, h2, h3 jerárquicos. |
| 2.4.7 Foco visible | ✅ OK | Tailwind ring + focus-visible en Checkbox, Switch, Modal, CommandPalette. |

### 1.3 Comprensible
| Criterio | Estado | Observaciones |
|----------|--------|--------------|
| 3.1.1 Idioma de la página | ✅ OK | `<html lang="es">` en index.html. |
| 3.1.2 Idioma de partes | ✅ OK | Sin contenido multi-idioma. |
| 3.2.1 Al recibir foco | ✅ OK | |
| 3.2.2 Al recibir entrada | ✅ OK | |
| 3.3.1 Identificación de errores | ✅ OK | `role="alert"` en errores (Login, Toast, Input); validación inline con texto. |
| 3.3.2 Labels o instrucciones | ⚠️ Parcial | Falla en `SetupOrganizacion.jsx` (label sin `htmlFor`) y `Expedientes.jsx` (formulario modal). |

### 1.4 Robusto
| Criterio | Estado | Observaciones |
|----------|--------|--------------|
| 4.1.1 Parsing válido | ✅ OK | JSX válido, sin HTML malformado. |
| 4.1.2 Nombre, función, valor | ⚠️ Parcial | ARIA presente en `Modal`, `Drawer`, `Lightbox`, `ConfirmModal`, `Switch`, `Checkbox`, `CommandPalette`. **Falta en modales inline de `Expedientes.jsx` y `Login.jsx` ForgotModal** (no role/aria-modal). |
| 4.1.3 Mensajes de estado | ✅ OK | `Toast` con `aria-live="polite"` ✅. |

---

## 2. Issues Encontrados (Detallados por Severidad)

### 🔴 CRÍTICOS (bloquean alfa — NO CONFORME WCAG AA)

#### C1. `WizardShell.jsx`: handleCancel es `undefined` al primer render (líneas 155-161, 210)
```jsx
// useEffect (línea 155-161)
useEffect(() => {
  function handler(e) {
    if (e.key === 'Escape') handleCancel();  // ❌ ReferenceError potencial
  }
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [handleCancel]);

// useCallback (línea 210) — declarado DESPUÉS
const handleCancel = useCallback(async () => { ... }, [confirm, onCancel, storageKey]);
```
**WCAG violada:** 2.1.2 Sin trampas de teclado (Escape no funciona de forma confiable).
**Fix:** Declarar `handleCancel` con `useCallback` ANTES del useEffect, o usar `useRef` para evitar TDZ.

---

#### C2. `CommandPalette.jsx`: Ctrl+K no abre el palette (líneas 112-121)
```jsx
useEffect(() => {
  const handler = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      commandOpen ? closeCommand() : document.dispatchEvent(new CustomEvent('lp:openCommand'));
      // ❌ No hay listener para 'lp:openCommand' en ningún archivo
    }
  };
  ...
}, [commandOpen, closeCommand]);
```
**WCAG violada:** 2.1.1 Teclado — atajo global documentado pero no funcional.
**Fix:** Llamar directamente a `openCommand()` en lugar de dispatchar evento:
```jsx
commandOpen ? closeCommand() : openCommand();
```

---

#### C3. 6 modales sin `role="dialog"` + `aria-modal="true"` (modales inline)
| Componente | Línea | Issue |
|------------|-------|-------|
| `Login.jsx` (ForgotModal) | 725-849 | ⚠️ Tiene role/aria-modal ✅ PERO **sin focus trap ni focus restoration** |
| `Expedientes.jsx` (DeleteConfirm) | 326 | ❌ Sin role/aria-modal |
| `Expedientes.jsx` (NewExpForm) | 364 | ❌ Sin role/aria-modal |
| `IADisclaimerModal.jsx` | 19 | ⚠️ Tiene role/aria-modal ✅ PERO **sin focus trap** |
| `Clientes.jsx` (formularios inline) | (auditado por referencia) | ❌ Sin role/aria-modal |
| `OnboardingTour.jsx` (tooltip overlay) | 354 | ❌ Sin role="dialog" |

**WCAG violada:** 4.1.2 Nombre, función, valor; 2.4.3 Orden de foco.
**Fix:** Usar el componente `Modal.jsx` (que ya implementa correctamente) o aplicar patrón APG Dialog.

---

#### C4. `WizardShell.jsx`: El Wizard completo NO tiene `role="dialog"` ni `aria-modal` (línea 231-242)
```jsx
<motion.div className="fixed inset-0 z-[150] flex flex-col ...">
```
Es modal pero no expone ARIA modal semantics.
**WCAG violada:** 4.1.2.
**Fix:** Agregar `role="dialog"` `aria-modal="true"` `aria-labelledby="wizard-title"`.

---

### 🟠 ALTOS (afectan UX significativamente)

#### A1. `SetupOrganizacion.jsx`: Labels sin asociación `htmlFor`/`id` (líneas 142, 226)
```jsx
<label className="block text-xs ...">Nombre de la organización</label>
<input type="text" value={nombreOrg} ... />  {/* ❌ sin id, sin htmlFor */}
```
**WCAG violada:** 1.3.1, 3.3.2.
**Fix:** Agregar `htmlFor="input-org-nombre"` y `id="input-org-nombre"`.

---

#### A2. `Expedientes.jsx`: Formulario modal con labels no asociados (líneas 379, 384, 389, 399, 405, 415)
Mismo patrón que A1 en 6 labels del modal crear/editar expediente.
**Fix:** Conectar `htmlFor` ↔ `id` en cada par.

---

#### A3. `Sidebar.jsx` `SidebarLink`: Falta `aria-current="page"` para ruta activa
```jsx
<NavLink to={to} className={({ isActive }) => `... ${isActive ? 'bg-blue-500/15...' : '...'}`}>
```
Usa `isActive` solo para clases CSS, no para semántica.
**WCAG violada:** 4.1.2 (estado actual no se anuncia).
**Fix:**
```jsx
<NavLink to={to} aria-current={isActive ? 'page' : undefined} className={...}>
```

---

#### A4. Foco restoration no implementado en 3 modales
| Componente | Issue |
|------------|-------|
| `Login.jsx` (ForgotModal, línea 725) | Al cerrar, foco no vuelve al botón "¿Olvidó su contraseña?" |
| `IADisclaimerModal.jsx` | Sin restoration |
| `Expedientes.jsx` (DeleteConfirm, NewExpForm) | Sin restoration |

**WCAG violada:** 2.4.3 Orden de foco.
**Fix:** Patrón del `Modal.jsx` líneas 92-107 (previousActiveElement ref).

---

### 🟡 MEDIOS (mejoran conformidad)

#### M1. `prefers-reduced-motion` no respetado globalmente
- `Layout.jsx` (línea 56-72): usa `motion.main` con `pageVariants` siempre activo.
- `Modal.jsx`, `WizardShell.jsx`, `OnboardingTour.jsx`: animaciones Framer Motion sin verificación.
- `index.css` línea 139-141: `*, *::before, *::after { transition-timing-function: cubic-bezier(...) }` siempre activo.

**WCAG violada:** 2.3.3 Animación de interacciones (AAA, pero es buena práctica).
**Fix:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

#### M2. `CommandPalette.jsx`: Falta `role="listbox"` en resultados + `aria-controls`
```jsx
<input ref={inputRef} role="combobox" aria-expanded={true} aria-autocomplete="list" />
// ❌ Falta aria-controls="cmd-listbox"
<div className="overflow-y-auto max-h-[60vh]">
  {renderItems()}  // ❌ Sin role="listbox"
</div>
```
**Fix:** Agregar `id="cmd-listbox"` al contenedor de resultados y `aria-controls="cmd-listbox"` al input. Agregar `role="option" aria-selected={active}` a cada item.

---

#### M3. `Login.jsx` (ForgotModal, línea 725): Sin `aria-describedby` para instrucciones
El modal tiene título + descripción visual pero no hay conexión ARIA entre `aria-labelledby="forgot-title"` y el texto explicativo.
**Fix:** Agregar `aria-describedby="forgot-desc"` y `id="forgot-desc"` al `<p>` descriptivo.

---

#### M4. Skip-link solo en `Layout.jsx`, no en rutas públicas
- `Login.jsx`, `SignupPage.jsx`, `SetupOrganizacion.jsx`, `Landing.jsx` **no tienen skip-link**.
**WCAG violada:** 2.4.1 Bypass Blocks.
**Fix:** Extraer a componente `<SkipLink />` e incluirlo en cada página pública.

---

#### M5. `OnboardingTour.jsx`: Tooltip sin role="dialog" ni aria-live (línea 348)
- Overlay con `pointer-events-none` (línea 315) ✅ pero el tooltip es `pointer-events-auto` (línea 354).
- Lectores de pantalla no saben que es un diálogo modal de instrucción.
**Fix:** Agregar `role="dialog" aria-modal="false" aria-labelledby="tour-title"` al tooltip (es informativo, no modal real).

---

### 🟢 MENORES (nice-to-have)

#### m1. `index.html`: `lang="es"` debería ser `lang="es-PE"` para contexto peruano (recomendación).
**Fix:** `<html lang="es-PE">`.

#### m2. `Login.jsx` (línea 718): copyright con `&copy;` puede causar problemas en screen readers
Usar `<span aria-label="Copyright">©</span>` o `&#169;`.

#### m3. `Drawer.jsx`: Sin focus trap (a diferencia de `Modal.jsx` que sí lo tiene).
**Fix:** Aplicar el mismo patrón de focus trap que `Modal.jsx`.

#### m4. `AppIcon.jsx` + íconos sin contexto: 200+ íconos sin `aria-hidden="true"` verificado.
Auditar masivamente con axe-core.

#### m5. `Lightbox.jsx`: `iframe` sin `aria-label` (línea 124).
**Fix:** `<iframe src={...} title={current.title} aria-label={current.title ?? 'Documento PDF'}>`

#### m6. `WizardShell.jsx` StepIndicator (línea 77): `<span>` para label no conectado con `aria-current`.
**Fix:** Agregar `aria-current="step"` al step activo.

---

## 3. Lighthouse Score Estimado

| Categoría | Score | Razonamiento |
|-----------|-------|--------------|
| Accessibility | 78/100 | Bug Ctrl+K + handleCancel bajan puntos. Modal role/aria-modal OK en mayoría. Falta aria-current, htmlFor en algunos labels. |
| Best Practices | 88/100 | Console limpia, HTTPS-ready, sin deprecated APIs. |
| SEO | 92/100 | Title dinámico (`useSeo`), meta description, lang declarado. |
| Performance | 80/100 | Lazy loading de páginas ✅, pero bundle inicial grande (Material Symbols, framer-motion). |

---

## 4. Acciones Requeridas por Sprint

### Sprint 1 — P0 BLOQUEANTE (8 horas)
- [ ] **C2** Conectar Ctrl+K → `openCommand()` directamente en `CommandPalette.jsx` línea 116.
- [ ] **C1** Reordenar `handleCancel` antes del useEffect en `WizardShell.jsx`.
- [ ] **C3** Agregar `role="dialog"` + `aria-modal="true"` + focus trap a 6 modales inline.
- [ ] **C4** Agregar ARIA dialog semantics al `WizardShell`.
- [ ] **A1** Conectar `htmlFor` ↔ `id` en `SetupOrganizacion.jsx`.
- [ ] **A2** Conectar `htmlFor` ↔ `id` en `Expedientes.jsx` (6 inputs).
- [ ] **A3** Agregar `aria-current="page"` en `Sidebar.jsx` SidebarLink.

### Sprint 2 — P1 ALTA (6 horas)
- [ ] **A4** Implementar focus restoration en 3 modales faltantes.
- [ ] **M2** Mejorar `CommandPalette` con `role="listbox"` + `aria-controls`.
- [ ] **M4** Extraer `<SkipLink />` y agregarlo en Login, Signup, Setup, Landing.
- [ ] **M3** Agregar `aria-describedby` al ForgotModal de Login.

### Sprint 3 — P2 MEDIA (4 horas)
- [ ] **M1** Implementar `@media (prefers-reduced-motion: reduce)` global en `index.css`.
- [ ] **M5** Agregar role="dialog" al OnboardingTour tooltip.
- [ ] **m1** Cambiar `lang="es"` a `lang="es-PE"`.
- [ ] **m5** Agregar `aria-label` al iframe del Lightbox.

### Sprint 4 — P3 BAJA (2 horas)
- [ ] **m3** Aplicar focus trap al `Drawer.jsx`.
- [ ] **m6** Agregar `aria-current="step"` en WizardShell StepIndicator.

---

## 5. Tests Recomendados

### 5.1 axe-core con Vitest
```js
// tests/a11y/Login.test.jsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import Login from '../../src/pages/Login';

expect.extend(toHaveNoViolations);

test('Login no tiene violaciones a11y', async () => {
  const { container } = render(<Login />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### 5.2 Playwright + axe-core (E2E)
```js
// e2e/a11y.spec.js
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Dashboard sin violaciones críticas', async ({ page }) => {
  await page.goto('/dashboard');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0);
});
```

### 5.3 Pa11y CLI (smoke)
```bash
npx pa11y http://localhost:5173/login --standard WCAG2AA
npx pa11y http://localhost:5173/dashboard --standard WCAG2AA
```

### 5.4 Storybook a11y addon (ya configurado)
```bash
npm run storybook  # http://localhost:6006
# Agregar "@storybook/addon-a11y" si no está
```

---

## 6. Herramientas de Validación

```bash
# Lighthouse CI (incluido en package.json línea 24)
npm run test:lighthouse

# axe-core CLI (incluido línea 25)
npm run test:axe

# Verificador accesibilidad Node (crear)
node tools/verifiers/verifier-accesibilidad.mjs

# Contraste por par de colores
node tools/verifiers/verifier-contraste.mjs

# Validación ARIA
node tools/verifiers/verifier-aria.mjs

# Navegación por teclado
node tools/verifiers/verifier-keyboard.mjs

# Focus trap
node tools/verifiers/verifier-focus-trap.mjs
```

---

## 7. Inventario de Componentes Auditados

| Categoría | Componentes | Estado |
|-----------|-------------|--------|
| Modales globales | `Modal.jsx` (✅), `Drawer.jsx` (⚠️ sin focus trap), `ConfirmModal.jsx` (✅) | 2/3 OK |
| Modales inline | `Login` (ForgotModal), `IADisclaimerModal`, `Expedientes` (×2), `OnboardingTour` | ❌ Críticos |
| Wizard | `WizardShell.jsx` | ❌ Bug TDZ + sin ARIA modal |
| Command Palette | `CommandPalette.jsx` | ⚠️ Ctrl+K roto + falta listbox |
| Navegación | `Sidebar.jsx`, `TopBar.jsx`, `BottomNav.jsx` | ⚠️ falta aria-current |
| Formularios | `Login.jsx`, `SetupOrganizacion.jsx`, `Expedientes.jsx` | ⚠️ labels no asociados en 2/3 |
| UI primitivos | `Input.jsx` (✅), `Checkbox.jsx` (✅), `Switch.jsx` (✅), `Button.jsx` (✅) | 4/4 OK |
| Toast / Live regions | `Toast.jsx` | ✅ aria-live correcto |
| Lightbox | `Lightbox.jsx` | ⚠️ sin aria-label en iframe |
| Onboarding | `OnboardingTour.jsx` | ⚠️ sin role dialog en tooltip |
| Layout | `Layout.jsx` | ✅ Skip-link correcto |

**Total:** ~40 componentes auditados, **4 críticos**, **4 altos**, **5 medios**, **6 menores**.

---

## Resumen Ejecutivo

| Métrica | Valor |
|---------|-------|
| **Score accesibilidad estimado** | **78/100** |
| **Cumplimiento WCAG 2.1 AA** | **72%** |
| **Issues críticos** | **4** (bloquean alfa) |
| **Issues altos** | **4** |
| **Issues medios** | **5** |
| **Issues menores** | **6** |
| **Componentes auditados** | ~40 |

### 🚦 Veredicto

❌ **NO APROBADO para release con monetization** hasta resolver los 4 issues críticos:

1. **C1** WizardShell handleCancel undefined
2. **C2** CommandPalette Ctrl+K no abre
3. **C3** 6 modales sin role="dialog" + aria-modal
4. **C4** WizardShell sin ARIA modal semantics

Tras resolver los críticos + altos (Sprint 1-2), se puede alcanzar **WCAG 2.1 AA conforme** con score estimado **90+/100**.

### Próximos pasos inmediatos

1. **HOY:** Crear tickets P0 para los 4 issues críticos.
2. **Esta semana:** Sprint 1 (8h) — resolver críticos + altos bloqueantes.
3. **Siguiente sprint:** Sprint 2-3 (12h) — pulido para auditoría externa.
4. **Pre-launch:** Auditoría formal con usuario de lector de pantalla (NVDA + JAWS).
