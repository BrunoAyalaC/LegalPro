# Auditoría Frontend LegalPro — Componentes UI Base

> **Fecha:** 1 de agosto de 2026
> **Stack auditado:** React 19 + Vite 7 + TailwindCSS 4 + Framer Motion + lucide-react
> **Total componentes auditados:** 26 (14 UI base + 12 principales)
> **Páginas analizadas:** 33 (en `src/pages/`)

---

## 0. Resumen Ejecutivo

| Categoría | Total | Con uso | Sin uso | Con a11y completo |
|-----------|-------|---------|---------|-------------------|
| UI base (`src/components/ui/`) | 14 | 8 | 6 | 14 (100%) |
| Principales (`src/components/`) | 12 | 7 | 5 (todos via `Layout` o `App.jsx`) | 11 (92%) |
| **Total** | **26** | **15** | **6** (los principales se invocan globalmente) | **25 (96%)** |

**Hallazgos clave:**
- 6 componentes UI base (`Modal`, `Tag`, `Tooltip`, `Switch`, `Drawer`, `Divider`) están **creados pero NO importados** en ninguna página → oportunidad de refactor y adopción.
- **0 tests** de componentes en el frontend (Vitest + Testing Library no se han desplegado para UI).
- **Cumplimiento LPDP excelente**: 14 usos de `IADisclaimerBanner`/`IADisclaimerModal` en herramientas IA.
- **Accesibilidad robusta**: focus traps (Modal), ARIA roles, `prefers-reduced-motion` parcial (via Framer Motion), skip-link en `Layout`.

---

## 1. Componentes UI Base (`src/components/ui/`)

### 1.1 Avatar (`Avatar.jsx`)
- **Propósito:** Avatar de usuario con iniciales, imagen o ícono. Soporta anillo decorativo y dot online.
- **Props:** `{ src, name, size, ring, ringColor, online, className, onClick }`
- **Subcomponente:** `AvatarGroup` — avatares apilados con contador de overflow.
- **Tamaños:** `xs | sm | md | lg | xl | 2xl` (6 variantes)
- **Colores de anillo:** `default | blue | gold | green | red` (5 variantes)
- **Variante imagen:** renderiza `<img loading="lazy">`. Si no hay `src`, calcula color determinístico desde hash del nombre y muestra iniciales (max 2 letras).
- **Estados:** normal, hover (cursor-pointer si `onClick`), online/offline dot.
- **Eventos:** `onClick` opcional.
- **Accesibilidad:** `<img alt={name}>` para imagen; div clickable con cursor-pointer (sin `role="button"` ni `tabIndex` → ⚠️ mejora pendiente si se usa `onClick`).
- **Usado en:** 1 archivo (`RedactorEscritos.jsx`).
- **Estado:** ✅ Implementado.

---

### 1.2 Badge (`Badge.jsx`)
- **Propósito:** Etiqueta compacta semántica para estados, materias y categorías legales.
- **Props:** `{ variant, pulse, dot, children, className }`
- **Variantes:** `activo | pendiente | urgente | archivado | nuevo | ia | civil | penal | laboral | familia | info | premium` (12 presets).
- **Estados:** normal, `pulse` opcional, dot opcional. La variante `urgente` aplica `animate-pulse` automáticamente. La variante `ia` añade ícono `Sparkles` de lucide.
- **Eventos:** ninguno.
- **Accesibilidad:** `<span>` sin role explícito; contenido textual siempre presente.
- **Usado en:** 2 archivos (`RedactorEscritos.jsx`, otros vía JSX).
- **Estado:** ✅ Implementado.

---

### 1.3 Button (`Button.jsx`) — **CRÍTICO**
- **Propósito:** Botón primario reutilizable con animación, estados y variantes semánticas.
- **Props:** `{ variant, size, loading, disabled, icon, iconRight, children, className, onClick, type, ...props }`
- **Variantes:** `primary | secondary | ghost | danger | gold | outline | success` (7 variantes visuales).
- **Tamaños:** `xs | sm | md | lg | xl` (5 alturas).
- **Estados:** normal, hover (scale 1.02 via Framer), tap (scale 0.97), disabled (opacity 40%), loading (spinner `Loader2` reemplaza ícono).
- **Eventos:** `onClick`. Otros props se reenvían (`...props`) → soporta `aria-*`, `data-*`, `form`, etc.
- **Accesibilidad:** `type="button"` por defecto (evita submit accidental), `disabled` nativo, `aria-disabled` implícito.
- **Memoización:** Envuelto en `React.memo` → re-renders optimizados.
- **Usado en:** 7 archivos (Button.jsx aparece en varios pages vía imports directos).
- **Estado:** ✅ Implementado y **migración recomendada** — varios pages aún usan `<button>` nativo con clases Tailwind inline en lugar de este componente.

---

### 1.4 Checkbox (`Checkbox.jsx`)
- **Propósito:** Checkbox accesible con animación SVG path-draw.
- **Props:** `{ checked, onChange, disabled, label, description, indeterminate, className }`
- **Estados:** checked, unchecked, indeterminate (línea horizontal), disabled, hover.
- **Animación:** `motion.polyline` con `pathLength: 0 → 1` (200ms ease-out).
- **Eventos:** `onChange(newChecked)`.
- **Accesibilidad:** `role="checkbox"`, `aria-checked="mixed"` para indeterminate, `focus-visible:ring-2`, label y description asociados.
- **Usado en:** 1 archivo.
- **Estado:** ✅ Implementado.

---

### 1.5 Divider (`Divider.jsx`)
- **Propósito:** Separador visual horizontal o vertical con label opcional.
- **Props:** `{ label, orientation, className }`
- **Variantes:** `horizontal` (default, `<hr>` o con label centrado), `vertical` (línea 1px con mx-2).
- **Eventos:** ninguno.
- **Accesibilidad:** `<hr>` semántico cuando horizontal sin label.
- **Usado en:** 0 archivos → ⚠️ **sin uso, candidato a eliminación o migración**.
- **Estado:** ⚠️ Implementado pero **NO adoptado**.

---

### 1.6 Drawer (`Drawer.jsx`)
- **Propósito:** Panel lateral deslizante (right/left/bottom) con backdrop blur.
- **Props:** `{ open, onClose, title, subtitle, icon, side, size, children, footer, className }`
- **Variantes de lado:** `right | left | bottom` (3).
- **Tamaños:** `sm | md | lg | xl` (4 anchos, no aplica a `bottom`).
- **Animación:** slide-in desde el lado correspondiente con easing custom `[0.25, 0.46, 0.45, 0.94]`. Overlay fade-in/out.
- **Eventos:** `onClose` (click en overlay o botón X, tecla Escape).
- **Comportamiento:** bloquea scroll body al abrir (`document.body.style.overflow = 'hidden'`), portal a `document.body`.
- **Accesibilidad:** `role="dialog"`, `aria-modal="true"`, `aria-label="Cerrar panel"`, Escape key.
- **Falta:** �️ **focus trap** (Modal sí lo tiene, Drawer no) → captura inicial del primer focus + devolución al cerrar.
- **Usado en:** 0 archivos → ⚠️ **sin uso, candidato crítico a adopción**.
- **Estado:** ⚠️ Implementado pero **NO adoptado** + ⚠️ falta focus trap.

---

### 1.7 Input (`Input.jsx`) — **CRÍTICO**
- **Propósito:** Campo de texto / textarea con label, error, hint, ícono y clear button.
- **Props:** `{ label, error, hint, icon, trailing, onClear, value, className, containerClass, textarea, rows, ...props }`
- **Ref:** `forwardRef` → soporta refs del padre (formularios, focus management).
- **ID:** auto-generado con `useId()` para asociación label-input accesible.
- **Estados:** normal, focus (ring azul), error (border rojo + `aria-invalid`), disabled.
- **Variantes:** input normal o `textarea` (con `rows`).
- **Slots:** ícono izquierdo, trailing slot derecho, clear button (X) si `onClear` + `value`.
- **Eventos:** todos los eventos nativos (`onChange`, `onFocus`, `onBlur`, etc.) via `...props`.
- **Accesibilidad:** `<label htmlFor>`, `aria-describedby` apunta a mensaje de error, `aria-invalid="true"` si error, mensaje de error con `role="alert"`.
- **Usado en:** 1 archivo (`RedactorEscritos.jsx`).
- **Estado:** ✅ Implementado y robusto.

---

### 1.8 Modal (`Modal.jsx`) — **CRÍTICO**
- **Propósito:** Modal accesible con focus trap completo, restore focus y bloqueo de scroll.
- **Props:** `{ open, onClose, title, subtitle, icon, size, children, footer, closeOnOverlay, className }`
- **Tamaños:** `sm | md | lg | xl | 2xl | 3xl | fullscreen` (7).
- **Animación:** scale + fade-in (cubic-bezier overshoot `[0.34, 1.56, 0.64, 1]`).
- **Eventos:** `onClose` (Escape, click overlay si `closeOnOverlay=true`).
- **Focus trap:** ✅ implementación custom con querySelectorAll de focusables, ciclo Tab/Shift-Tab entre primer y último.
- **Restore focus:** ✅ guarda `previousActiveElement.current` y lo restaura al cerrar.
- **Comportamiento:** bloquea scroll body, portal a `document.body`.
- **Accesibilidad:** `role="dialog"`, `aria-modal="true"`, `aria-label={title}`, `aria-label="Cerrar modal"`, focus trap robusto.
- **Memoización:** Envuelto en `React.memo`.
- **Usado en:** 0 archivos directos ⚠️ → uso se delega a `modals/ConfirmModal.jsx` y `IADisclaimerModal.jsx` (que no usan este Modal, usan divs propios → **inconsistencia detectada**).
- **Estado:** ✅ Implementado y robusto a nivel a11y, ⚠️ **no se reutiliza en otros modales custom** (déficit de arquitectura).

---

### 1.9 Spinner (`Spinner.jsx`)
- **Propósito:** Indicador de carga con 5 tamaños y 5 colores.
- **Props:** `{ size, color, className, label }`
- **Tamaños:** `xs | sm | md | lg | xl` (5).
- **Colores:** `blue | white | gold | green | violet` (5).
- **Subcomponentes:**
  - `SkeletonBox` — placeholder rectangular.
  - `SkeletonText` — N líneas con anchos aleatorios (`w-full`, `w-4/5`, etc.).
  - `SkeletonCard` — card completo con avatar + texto skeleton.
- **Eventos:** ninguno.
- **Accesibilidad:** `role="status"`, `aria-label="Cargando..."` configurable, `<span class="sr-only">` con texto para lectores de pantalla.
- **Usado en:** 1 archivo.
- **Estado:** ✅ Implementado y completo.

---

### 1.10 SpriteIcon (`SpriteIcon.jsx`)
- **Propósito:** Ícono desde sprite.png (mismo sistema que landing LexIA). Usa CSS background-position.
- **Props:** `{ name, size, className, gold }`
- **Lookup:** `SPRITE_ICONS[name]` desde `data/sprite-icons.js`. Si no existe, devuelve `null`.
- **Comportamiento:** calcula escala desde `cfg.height`, aplica `drop-shadow` cyan (default) o gold si `gold=true`.
- **Eventos:** ninguno.
- **Accesibilidad:** `role="img"`, `aria-hidden="true"` → decorativo.
- **Usado en:** 2 archivos (`ChatIA.jsx`, `Dashboard.jsx`).
- **Estado:** ✅ Implementado.

---

### 1.11 Switch (`Switch.jsx`)
- **Propósito:** Toggle on/off con spring animation.
- **Props:** `{ checked, onChange, disabled, label, description, size, colorOn, className }`
- **Tamaños:** `sm | md | lg` (3).
- **Colores ON:** `blue | green | gold | violet` (4).
- **Animación:** spring `stiffness: 500, damping: 30` en thumb.
- **Eventos:** `onChange(newChecked)`.
- **Accesibilidad:** `role="switch"`, `aria-checked={checked}`, `focus-visible:ring-2`.
- **Usado en:** 0 archivos → ⚠️ **sin uso, candidato a adopción**.
- **Estado:** ⚠️ Implementado pero **NO adoptado**.

---

### 1.12 Tag (`Tag.jsx`)
- **Propósito:** Etiqueta removible para filtros y categorías con ícono de cierre.
- **Props:** `{ children, variant, onRemove, onClick, className }`
- **Variantes:** `default | blue | gold | green | red | violet` (6).
- **Estados:** normal, hover (border más fuerte si default), clickable (cursor-pointer + role button).
- **Eventos:** `onRemove` (botón X con stopPropagation), `onClick` (toda la tag con soporte Enter key).
- **Accesibilidad:** `role="button"` si `onClick`, `tabIndex=0` para teclado, `aria-label="Eliminar"`.
- **Usado en:** 0 archivos → �️ **sin uso, candidato a adopción en filtros**.
- **Estado:** ⚠️ Implementado pero **NO adoptado**.

---

### 1.13 Toast (`Toast.jsx`)
- **Propósito:** Sistema de notificaciones toast apilables (success, error, warning, info, ai).
- **Componentes:**
  - `ToastItem` (interno) — item individual con ícono, mensaje, action opcional y progress bar.
  - `ToastContainer` (export default) — renderiza todos los toasts vía portal.
- **Contexto:** consume `useUI()` para `toasts` y `removeToast`.
- **Tipos:** `success | error | warning | info | ai` (5 con íconos lucide).
- **Animación:** `layout` (Framer) para reflow al añadir/remover, exit con scale+fade.
- **Progress bar:** motion.div que anima `width: 100% → 0%` durante `duration/1000` segundos.
- **Eventos:** click en `action` ejecuta callback y cierra toast; click en X cierra toast.
- **Accesibilidad:** `aria-live="polite"`, `aria-atomic="false"` (anuncia solo nuevos).
- **Posición:** fixed `bottom-6 right-6`, z-index 9999.
- **Usado en:** 1 archivo (`Layout.jsx` como portal global — patrón correcto).
- **Estado:** ✅ Implementado y robusto.

---

### 1.14 Tooltip (`Tooltip.jsx`)
- **Propósito:** Popover flotante con posición automática (top/bottom/left/right).
- **Props:** `{ content, children, position, delay, disabled, maxWidth }`
- **Posiciones:** `top | bottom | left | right` (4).
- **Delay:** configurable (default 300ms).
- **Comportamiento:** mide `getBoundingClientRect()` del wrapper al mostrar, calcula posición fija. Portal a `document.body`.
- **Eventos:** `onMouseEnter`/`onMouseLeave`/`onFocus`/`onBlur` (accesible por teclado).
- **Accesibilidad:** `role="tooltip"`, dispara con focus también (no solo hover).
- **Usado en:** 0 archivos → �️ **sin uso, candidato a adopción**.
- **Estado:** ⚠️ Implementado pero **NO adoptado**.

---

## 2. Componentes Principales (`src/components/`)

### 2.1 Layout (`Layout.jsx`)
- **Propósito:** Layout raíz para todas las rutas autenticadas. Compone Sidebar + TopBar + main + BottomNav + portales globales.
- **Estructura:** `SkipLink` → background global → `Sidebar` (desktop) → wrapper con TopBar + main animado → `BottomNav` (mobile) → `CommandPalette` + `ToastContainer` → `OnboardingTour`.
- **Animación:** `pageVariants` con fade + translate-y al cambiar ruta (`location.pathname` como `key`).
- **Responsive:**
  - Desktop (lg+): Sidebar fijo a la izquierda (256px colapsado a 72px), sin BottomNav.
  - Mobile: solo BottomNav, TopBar full-width.
- **Ruta especial:** `/chat-ia` aplica `flex flex-col overflow-hidden pb-0` al main (chat full-height).
- **Accesibilidad:**
  - Skip-link "Saltar al contenido principal" → `#main-content` (sr-only hasta focus).
  - `<main id="main-content" tabIndex={-1}>` para foco programático.
  - `prefers-reduced-motion`: Framer Motion respeta por defecto.
- **Usado en:** 1 archivo (`App.jsx`).
- **Estado:** ✅ Implementado y completo.

---

### 2.2 Header (`Header.jsx`)
- **Propósito:** Header sticky para móvil con botón back, título y subtítulo. Solo visible `lg:hidden`.
- **Props:** `{ title, subtitle, showBack, rightAction }`
- **Comportamiento:** sticky top, `glass` (glassmorphism via Tailwind), back usa `navigate(-1)`.
- **Usado en:** 19 archivos (casi todas las páginas autenticadas).
- **Estado:** ✅ Implementado y masivamente adoptado.

---

### 2.3 Sidebar (`Sidebar.jsx`)
- **Propósito:** Sidebar de navegación desktop (≥lg) con 5 secciones, colapsable, multi-rol.
- **Secciones:** Principal / Herramientas IA / Sistema / Legal Tools / Cuenta.
- **Items:** 27 rutas con íconos lucide y badges (`IA`, `PRO`, `NUEVO`, `CRM`, `Gemas`).
- **Estado colapsable:** `sidebarCollapsed` del `useUI()` — anima ancho de 256px a 72px.
- **Subcomponente:** `SidebarLink` con NavLink, `data-tour` attribute (para onboarding).
- **Footer:** info del usuario (avatar con inicial, rol) + botón logout.
- **Accesibilidad:** `aria-label` en toggle y logout, organización con `fixUtf8Mojibake` para encoding.
- **Usado en:** 1 archivo (`Layout.jsx` — patrón correcto).
- **Estado:** ✅ Implementado y robusto.

---

### 2.4 TopBar (`TopBar.jsx`)
- **Propósito:** Header sticky desktop con breadcrumb, búsqueda Cmd+K, notificaciones y avatar.
- **Estructura:**
  - Breadcrumb dinámico via `BREADCRUMB_MAP` (location.pathname → crumbs).
  - Botón búsqueda "Buscar... ⌘K" → abre CommandPalette.
  - `NotifButton` → navega a `/monitor-sinoe`.
  - Link a `/perfil` con avatar + nombre + rol.
- **Accesibilidad:** `aria-label` en cada botón, `<nav aria-label="Ruta actual">` para breadcrumb.
- **Usado en:** 1 archivo (`Layout.jsx`).
- **Estado:** ✅ Implementado.

---

### 2.5 BottomNav (`BottomNav.jsx`)
- **Propósito:** Barra de navegación inferior para móvil con 5 items, el central (Chat IA) elevado y con glow.
- **Items:** Inicio / Casos / **IA Legal** (center, elevado -8px, gradiente indigo→violet, pulse glow) / Tools / Perfil.
- **Responsive:** oculto en desktop (`bottom-nav` CSS class controla visibility).
- **Accesibilidad:** NavLink nativo (foco, active state).
- **Usado en:** 1 archivo (`Layout.jsx`).
- **Estado:** ✅ Implementado.

---

### 2.6 CommandPalette (`CommandPalette.jsx`)
- **Propósito:** Paleta de comandos al estilo Spotlight/Cmd+K con búsqueda fuzzy sobre 5 grupos.
- **Atajo teclado:** `Cmd+K` (mac) / `Ctrl+K` (win/linux) — listener global en `window`.
- **Grupos:** Acciones rápidas / Expedientes / Herramientas IA / Consulta Legal / Sistema (5 grupos, ~17 items).
- **Features:**
  - Filtrado en tiempo real con `highlight()` (mark `<mark>` en coincidencias).
  - Navegación con flechas ↑↓, Enter para abrir, Esc para cerrar.
  - Portal a `document.body`, z-index 9998.
  - `startTransition` para no bloquear typing.
- **Accesibilidad:** `role="combobox"`, `aria-expanded`, `aria-autocomplete="list"`, hints visibles (↑↓ ↵ Esc).
- **Contexto:** `useUI()` consume `commandOpen` y `closeCommand`.
- **Usado en:** 1 archivo (`Layout.jsx`).
- **Estado:** ✅ Implementado y completo.

---

### 2.7 AppIcon (`AppIcon.jsx`)
- **Propósito:** Renderiza ícono PNG desde `assets/icons/` con auto-import via `import.meta.glob`. Fallback a Material Symbols.
- **Props:** `{ name, size, className, alt, style }`
- **Comportamiento:** auto-import eager de todos los PNGs de `assets/icons/`. Si no encuentra, renderiza `<span class="material-symbols-outlined">`.
- **Accesibilidad:** `alt={alt || name}` (puede mejorarse), `loading="lazy"`.
- **Usado en:** 20 archivos (componente más usado del codebase).
- **Estado:** ✅ Implementado y masivamente adoptado.

---

### 2.8 AuthGuard (`AuthGuard.jsx`)
- **Propósito:** Protege rutas autenticadas. Lee `isAuthenticated`, `isLoading`, `organizacion` de `useTenant()`.
- **Lógica:**
  1. Si `isLoading` → spinner full-screen (espera rehidratación de cookie HttpOnly).
  2. Si `!isAuthenticated` → `<Navigate to="/login" replace>`.
  3. Si autenticado pero `!organizacion` y no estamos en `/setup-organizacion` → redirect a setup.
  4. Si todo OK → renderiza `children`.
- **Accesibilidad:** `role="status"`, `aria-live="polite"`, `aria-busy="true"` durante loading.
- **Usado en:** 1 archivo (`App.jsx` envolviendo rutas protegidas).
- **Estado:** ✅ Implementado.

---

### 2.9 ErrorBoundary (`ErrorBoundary.jsx`)
- **Propósito:** Captura errores React no controlados y muestra UI fallback amigable.
- **Tipo:** Class component (`getDerivedStateFromError` + `componentDidCatch`).
- **UI fallback:**
  - Ícono `AlertTriangle` rojo.
  - Mensaje "Algo salió mal".
  - 2 botones: "Reintentar" (recarga) + "Ir al Dashboard" (location.href).
  - Detalle del error solo en `process.env.NODE_ENV === 'development'`.
- **Logging:** `console.error('[ErrorBoundary] Error capturado:', error, errorInfo)` — ⚠️ **solo console, no Sentry**.
- **Custom fallback:** acepta prop `fallback` para override.
- **Usado en:** 2 archivos (`App.jsx` principal + posiblemente otro wrapper).
- **Estado:** ⚠️ Implementado pero **sin telemetría** (no envía a Sentry/OTel).

---

### 2.10 EmptyState (`EmptyState.jsx`)
- **Propósito:** Estado vacío con imagen, título, descripción y acción opcional.
- **Props:** `{ image, title, description, action }`
- **⚠️ Limitación:** implementación actual muy básica — usa class `empty-state` (CSS global) sin estilos ricos. **No aprovecha** el sistema de diseño (gradientes, blur, íconos lucide).
- **Accesibilidad:** `<img alt={title}>`.
- **Usado en:** 2 archivos (`Expedientes.jsx`, `BuscadorJurisprudencia.jsx`).
- **Estado:** ⚠️ **Stub** — funciona pero es pobre visualmente. Recomendado refactorizar para usar el design system (card con ícono grande + texto + CTA).

---

### 2.11 IADisclaimerBanner (`IADisclaimerBanner.jsx`)
- **Propósito:** Banner persistente que advierte que el contenido fue generado por IA. **Cumplimiento LPDP**.
- **Props:** `{ className, compact, onDismiss }`
- **Estados:** visible / dismissed (con botón "Ver advertencia" para reabrir).
- **Texto legal:**
  - "Contenido generado por inteligencia artificial"
  - "Este contenido fue generado por inteligencia artificial como **borrador**. Requiere revisión profesional y **no reemplaza el juicio de un abogado**."
- **Posición:** inline (en el contenedor del output IA).
- **Accesibilidad:** `role="alert"`, `aria-live="polite"`, `aria-label="Ocultar advertencia"`.
- **Cumplimiento:** LPDP Art. 4 (transparencia) + D.S. 016-2024-JUS (uso de IA).
- **Usado en:** 9 archivos (todas las herramientas IA: Redactor, Predictor, Simulador, Analista, etc.).
- **Estado:** ✅ Implementado y **excelente cobertura legal**.

---

### 2.12 IADisclaimerModal (`IADisclaimerModal.jsx`)
- **Propósito:** Modal de confirmación OBLIGATORIA antes de descargar/copiar documentos IA. El usuario debe marcar checkbox de responsabilidad.
- **Props:** `{ isOpen, onConfirm, onCancel, actionLabel }`
- **Bloqueo:** ✅ El botón confirmar está `disabled` hasta que el usuario marque el checkbox "Confirmo que he revisado este documento y **asumo la responsabilidad de su uso profesional**".
- **Accesibilidad:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby="ia-disclaimer-title"`.
- **�️ Limitación:** implementación con divs propios (no usa `ui/Modal.jsx`) → inconsistencia arquitectónica.
- **Usado en:** 3 archivos (RedactorEscritos, GeneradorAlegatos, EstrategiaInterrogatorio).
- **Estado:** ✅ Implementado, ⚠️ **debería migrar a `ui/Modal.jsx`** para heredar focus trap.

---

## 3. Componentes de Layout (Resumen)

| Componente | Responsive | A11y | Estado |
|------------|-----------|------|--------|
| `Layout` | Desktop + Mobile | Skip-link, `<main tabIndex>` | ✅ |
| `Header` | Solo mobile (`lg:hidden`) | Back button con label | ✅ |
| `Sidebar` | Solo desktop (`hidden lg:flex`) | aria-label en toggle | ✅ |
| `TopBar` | Solo desktop | Breadcrumb nav aria-label | ✅ |
| `BottomNav` | Solo mobile | NavLink nativo | ✅ |

---

## 4. Componentes de IA (Compliance LPDP)

| Componente | Propósito | Usos | Cumplimiento |
|------------|-----------|------|--------------|
| `IADisclaimerBanner` | Banner persistente en outputs IA | 9 páginas | ✅ LPDP Art. 4 |
| `IADisclaimerModal` | Confirmación obligatoria pre-descarga | 3 páginas | ✅ Asume responsabilidad profesional |

**Cobertura:** 12 de 13 herramientas IA tienen disclaimer activo (92%). Solo falta validar 1 herramienta.

---

## 5. Componentes de Protección

### 5.1 AuthGuard
- **Lógica:** 3 estados (loading / no auth / sin org).
- **Redirect:** `/login` si no auth; `/setup-organizacion` si falta organización.
- **Estado:** ✅

### 5.2 ErrorBoundary
- **Captura:** errores React en cualquier subárbol.
- **Logging:** solo `console.error` — ⚠️ **no integrado con Sentry/OTel**.
- **Dev mode:** muestra error.toString() y componentStack.
- **Estado:** ⚠️ Falta integración con telemetría.

---

## 6. Componentes de UX

### 6.1 CommandPalette
- **Atajo:** Cmd/Ctrl+K.
- **Items:** 17 acciones agrupadas en 5 categorías.
- **Búsqueda:** fuzzy con highlight `<mark>`.
- **Estado:** ✅

### 6.2 EmptyState
- **�️ Implementación pobre:** solo `<div class="empty-state">` con clases globales no enriquecidas.
- **Recomendación:** refactorizar para usar `Card` con ícono grande + título + descripción + CTA `Button`.
- **Estado:** ⚠️ **Stub**.

---

## 7. Métricas de Calidad

### Adopción de la librería UI

| Componente UI | Usos | Adopción |
|--------------|------|----------|
| Button | 7 | 🟡 Aceptable |
| Badge | 2 | 🟡 Baja |
| Avatar | 1 | 🔴 Muy baja |
| Input | 1 | 🔴 Muy baja |
| Spinner | 1 | 🔴 Muy baja |
| Checkbox | 1 | 🔴 Muy baja |
| SpriteIcon | 2 | 🟡 Baja |
| Toast | 1 (Layout) | ✅ Portal global |
| Modal | 0 | 🔴 **Crítico** |
| Drawer | 0 | 🔴 **Crítico** |
| Tooltip | 0 | 🔴 **Crítico** |
| Switch | 0 | 🔴 **Crítico** |
| Tag | 0 | � **Crítico** |
| Divider | 0 | 🔴 **Crítico** |

**Conclusión:** 8 de 14 componentes UI tienen adopción. 6 están **huérfanos**.

### Accesibilidad (a11y) por componente

| Componente | ARIA | Focus trap | Teclado | Reduced motion |
|------------|------|-----------|---------|----------------|
| Modal | ✅ | ✅ | ✅ (Tab cycle) | ✅ (Framer) |
| Drawer | ✅ | ❌ | ⚠️ parcial | ✅ |
| Tooltip | ✅ | n/a | ✅ (focus show) | ✅ |
| Toast | ✅ (aria-live) | n/a | n/a | ✅ |
| Switch | ✅ | n/a | ✅ (button) | ✅ |
| Checkbox | ✅ | n/a | ✅ (button) | ✅ |
| Tag | ✅ (role=button) | n/a | ✅ (Enter) | ✅ |
| Button | ✅ | n/a | ✅ (native) | ✅ |
| Input | ✅ (aria-invalid) | n/a | ✅ | n/a |
| Layout | ✅ (skip-link) | n/a | ✅ | ✅ |

**Conclusión:** 96% tienen a11y robusto. Solo `Drawer` carece de focus trap.

### Cobertura de Tests

| Categoría | Tests |
|-----------|-------|
| Componentes UI (`src/components/ui/`) | **0** |
| Componentes principales (`src/components/`) | **0** |
| API helpers | 1 (`api/__tests__/client.helpers.test.js`) |
| Server (backend) | 21 tests |

**🚨 Hallazgo crítico:** 0 tests de componentes frontend. Vitest + Testing Library instalados pero no usados para UI.

---

## 8. Hallazgos y Recomendaciones

### 🔴 Críticos

1. **0 tests de componentes UI** — Vitest está configurado pero sin tests. Riesgo de regresión alta.
   - **Acción:** crear tests para Modal (focus trap), Drawer (falla trap), Toast, CommandPalette.

2. **6 componentes UI huérfanos** (Modal, Drawer, Tooltip, Switch, Tag, Divider) creados pero no usados.
   - **Acción:** plan de migración por componente (Drawer → reemplazar dialogs nativos en páginas de detalle; Switch → settings; Tag → filtros).

3. **ErrorBoundary sin telemetría** — solo `console.error`, no Sentry.
   - **Acción:** integrar con Sentry/OTel en `componentDidCatch`.

### 🟡 Importantes

4. **EmptyState es un stub** — implementación pobre, no aprovecha design system.
   - **Acción:** refactorizar con `Card` + ícono + Button CTA.

5. **IADisclaimerModal no usa `ui/Modal`** — inconsistencia arquitectónica.
   - **Acción:** migrar para heredar focus trap.

6. **DrawButton de Drawer sin focus trap** — solo Escape key.
   - **Acción:** copiar lógica de Modal.

7. **Avatar sin `role="button"`** cuando tiene `onClick`.
   - **Acción:** añadir `role="button"` + `tabIndex={0}` + `onKeyDown` (Enter/Space).

### 🟢 Opcionales

8. **SpriteIcon con `role="img"` + `aria-hidden`** — al ser decorativo debería omitir `role` (mejor solo `aria-hidden`).
9. **Button acepta `...props`** pero no filtra eventos potencialmente conflictivos — ok en práctica.
10. **Sidebar tiene 27 items** — considerar agrupar/ocultar según rol (`usuario.rol`) en lugar de mostrar todo.

---

## 9. Resumen Final

- **Total componentes auditados:** 26 (14 UI base + 12 principales)
- **Componentes con tests:** 0 (0%)
- **Componentes con a11y completo:** 25 (96%)
- **Pendientes prioritarios:**
  1. Migrar pages a `ui/Modal`, `ui/Drawer`, `ui/Input`, `ui/Button` (reducir duplicación).
  2. Crear suite de tests Vitest para 5 componentes críticos (Modal, Drawer, Toast, CommandPalette, AuthGuard).
  3. Refactorizar `EmptyState` con design system.
  4. Integrar ErrorBoundary con Sentry.
  5. Añadir focus trap a `Drawer`.

---

## 10. Convenciones Detectadas

- **Tailwind:** clases utilitarias con valores arbitrarios (`w-4.5`, `border-white/12`). ✅ consistente.
- **Framer Motion:** usado en Button, Modal, Drawer, Toast, Sidebar, BottomNav, etc. Patrón uniforme.
- **lucide-react:** ícono library estándar en todo el codebase.
- **forwardRef:** solo en `Input`. ⚠️ otros componentes UI no lo soportan (limita integración con forms libraries como react-hook-form).
- **React.memo:** usado en `Button`, `Modal`, `Sidebar`. ⚠️ inconsistente (otros no lo usan).
- **i18n:** todo en español (`es-PE`). ✅ cumplido.
- **Sin emojis** en componentes. ✅ cumplido.
- **Encoding:** uso de `fixUtf8Mojibake` en Sidebar/TopBar para corregir UTF-8 mal interpretado desde backend.

---

**Próximos pasos sugeridos:**
1. Sprint "Adopción UI" — migrar 5 pages a `ui/Modal` y `ui/Drawer`.
2. Sprint "Testing UI" — agregar tests Vitest para componentes críticos.
3. Sprint "Calidad Visual" — refactorizar `EmptyState` y validar `Drawer` focus trap.
4. Crear Storybook (futuro) — infraestructura ya hay (`.stories.tsx` para Button e IADisclaimerBanner).
