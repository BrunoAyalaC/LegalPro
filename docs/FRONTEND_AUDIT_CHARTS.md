# Auditoría Frontend LegalPro - Charts, Filtros y Wizards

> **Fecha:** 1 de agosto de 2026
> **Auditor:** @frontend (Agente Frontend Senior)
> **Stack auditado:** React 19.2 / Vite 7.3 / TailwindCSS 4.2 / recharts 3.8 / framer-motion 12.36 / lucide-react 0.577
> **Componentes auditados:** 8 (2 charts + 4 filtros + 1 wizard + 1 onboarding)

---

## 📑 Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Charts (`components/charts/`)](#1-charts-componentscharts)
3. [Filtros (`components/filters/`)](#2-filtros-componentsfilters)
4. [Wizards (`components/wizards/`)](#3-wizards-componentswizards)
5. [Onboarding (`components/onboarding/`)](#4-onboarding-componentsonboarding)
6. [Mapa de Uso por Página](#5-mapa-de-uso-por-página)
7. [Análisis de Cobertura e Interactividad](#6-análisis-de-cobertura-e-interactividad)
8. [Accesibilidad (WCAG 2.1 AA)](#7-accesibilidad-wcag-21-aa)
9. [Pendientes y Recomendaciones](#8-pendientes-y-recomendaciones)
10. [Resumen Final](#resumen-final)

---

## Resumen Ejecutivo

| Categoría | Total | En Uso | Sin Uso | Tests |
|-----------|-------|--------|---------|-------|
| **Charts** | 2 | 2 | 0 | 0 |
| **Filtros** | 4 | 1* | 3 | 0 |
| **Wizards** | 1 | 0 | 1 | 0 |
| **Onboarding** | 1 | 1 | 0 | 0 |
| **TOTAL** | **8** | **4** | **4** | **0** |

> *DateRangePicker se usa internamente dentro de FilterPanel, no en páginas directamente.

**Hallazgos críticos:**
- ⚠️ **FilterBar, FilterPanel, FilterChip y WizardShell están implementados pero NO se usan en ninguna página** — deuda técnica o trabajo previo.
- ⚠️ **0% cobertura de tests unitarios** para estos 8 componentes.
- ⚠️ **WizardShell exporta un hook `useWizard`** que tampoco se está usando.
- ✅ **Charts con carga dinámica de recharts** — excelente optimización de bundle.
- ✅ **OnboardingTour con persistencia en localStorage** y portalización — bien implementado.

---

## 1. Charts (`components/charts/`)

### 1.1 ActivityAreaChart

**Archivo:** `legalpro-app/src/components/charts/ActivityAreaChart.jsx` (88 líneas)

- **Propósito:** Visualizar la **carga procesal reciente** mostrando la evolución mensual de expedientes (nuevos, resueltos, en proceso) en los últimos 6 meses.

- **Librería:** `recharts` (v3.8.0) — **cargada dinámicamente** vía `import('recharts')` para optimizar el bundle inicial (recharts pesa ~389KB). Solo se descarga cuando el usuario ve la gráfica.

- **Props:**
  ```js
  {
    data: Array<{
      mes: string,        // "Ene", "Feb", etc. (formato es-PE)
      nuevos: number,     // Expedientes nuevos creados
      resueltos: number,  // Expedientes cerrados/resueltos
      proceso: number     // Expedientes actualmente en proceso
    }>
  }
  ```

- **Datos fuente:**
  - **Endpoint:** `GET /api/expedientes/stats`
  - **Consumido en:** `src/pages/Dashboard.jsx` (línea 5)
  - **Estado local:** `activityData` (Dashboard normaliza con `normalizeDashboardStats()`)

- **Componentes recharts utilizados:**
  - `<AreaChart>` (principal)
  - `<Area>` × 3 (Nuevos / Resueltos / En proceso)
  - `<XAxis>`, `<YAxis>` con `axisLine={false}`, `tickLine={false}`
  - `<Tooltip>` con `CustomTooltip` (estilo glassmorphism `bg-slate-900/95 backdrop-blur-xl`)
  - `<ResponsiveContainer>` (100% width/height)
  - `<CartesianGrid>` con `strokeDasharray="3 3"`
  - `<defs>` con 3 `linearGradient` (azul, verde, ámbar)

- **Interacciones:**
  - ✅ **Hover** sobre áreas → muestra tooltip flotante con nombre y valor
  - ✅ **Cursor personalizado** (`stroke: 'rgba(255,255,255,0.05)'`)
  - ✅ **Animaciones de recharts** integradas (entrada de áreas)

- **Estados manejados:**
  | Estado | Comportamiento |
  |--------|----------------|
  | **Loading** | Skeleton con `animate-pulse` (`bg-white/5 rounded-xl`) |
  | **Vacío** (`!data?.length`) | Mini `BarChart` decorativo + texto "Aún no hay actividad registrada" |
  | **Con datos** | AreaChart completo con 3 series |

- **Colores (hardcoded):**
  - Nuevos → `#3B82F6` (azul) con gradiente `gBlue`
  - Resueltos → `#10B981` (verde) con gradiente `gGreen`
  - En proceso → `#F59E0B` (ámbar) con gradiente `gAmber`

- **Responsive:** ✅ `ResponsiveContainer` width="100%" height="100%"

- **Accesibilidad:**
  - ⚠️ No expone `aria-label` descriptivo (mejorable: añadir `<title>` SVG o ARIA)
  - ⚠️ Tooltip no es accesible por teclado
  - ✅ Texto de fallback visible cuando no hay datos

- **Performance:**
  - ✅ Carga dinámica de recharts (bundle splitting)
  - ✅ Cleanup con `mounted` flag para evitar memory leak
  - ✅ `useState(null)` inicial → primer render ligero

- **Usado en:**
  - ✅ `pages/Dashboard.jsx` (header "Carga Procesal Reciente" + botón "Exportar")

---

### 1.2 MateriaPieChart

**Archivo:** `legalpro-app/src/components/charts/MateriaPieChart.jsx` (68 líneas)

- **Propósito:** Mostrar la **distribución porcentual de expedientes por materia jurídica** (Civil, Penal, Laboral, etc.) en un gráfico de torta/donut.

- **Librería:** `recharts` (v3.8.0) — **cargada dinámicamente** (mismo patrón que ActivityAreaChart).

- **Props:**
  ```js
  {
    data: Array<{
      name: string,    // "Civil", "Penal", "Laboral", etc.
      value: number,   // Cantidad o porcentaje
      color?: string   // Color hex (opcional, se aplica por Cell)
    }>
  }
  ```

- **Datos fuente:**
  - **Endpoint:** `GET /api/expedientes/stats` (campo `materia` del response)
  - **Consumido en:** `src/pages/Dashboard.jsx` (línea 6)
  - **Fallback en Dashboard:** Si no hay datos, se calcula de `data.civiles`, `data.penales`, `data.laborales`, etc., filtrando los que tengan `value > 0`.

- **Componentes recharts utilizados:**
  - `<PieChart>` (principal)
  - `<Pie>` con `innerRadius={42}`, `outerRadius={65}` (donut chart), `paddingAngle={4}`
  - `<Cell>` con `fill={entry.color}` (color por entrada)
  - `<Tooltip>` con `contentStyle` custom (fondo `#0f172a`, border `rgba(255,255,255,0.08)`)
  - `<ResponsiveContainer>`

- **Interacciones:**
  - ✅ **Hover** sobre sectores → muestra tooltip
  - ✅ **Animación de entrada** automática de recharts

- **Estados manejados:**
  | Estado | Comportamiento |
  |--------|----------------|
  | **Loading** | Spinner circular `border-t-blue-500 animate-spin` |
  | **Vacío** | Mini PieChart decorativo + texto "Sin datos de materias" |
  | **Con datos** | PieChart completo con leyenda visual debajo (renderizada por Dashboard) |

- **Colores:**
  - ⚠️ **Los colores vienen en `entry.color`** del payload (no definidos en el componente).
  - Dashboard renderiza la leyenda manualmente debajo del chart (no es parte del componente).

- **Responsive:** ✅ `ResponsiveContainer` 100%

- **Accesibilidad:**
  - ⚠️ No tiene leyenda accesible (la leyenda está en Dashboard, fuera del componente)
  - ⚠️ Tooltip no accesible por teclado
  - ✅ Estado vacío con mensaje claro

- **Performance:**
  - ✅ Carga dinámica de recharts
  - ✅ `mounted` flag para cleanup

- **Usado en:**
  - ✅ `pages/Dashboard.jsx` (header "Distribución por Materia" + lista de porcentajes abajo)

---

## 2. Filtros (`components/filters/`)

### 2.1 DateRangePicker

**Archivo:** `legalpro-app/src/components/filters/DateRangePicker.jsx` (172 líneas)

- **Propósito:** Selector de rango de fechas con **presets rápidos** (Hoy, Esta semana, Este mes, 3 meses, Este año) y rango personalizado.

- **Librerías:**
  - `framer-motion` v12.36 (animaciones de apertura/cierre del dropdown)
  - `lucide-react` (iconos `Calendar`, `ChevronDown`, `X`)
  - **Sin dependencias externas de fechas** — usa `Date` nativo + `toLocaleDateString('es-PE')`

- **Props:**
  ```js
  {
    value?: { from: string, to: string },  // ISO dates 'YYYY-MM-DD'
    onChange?: (range) => void,
    label?: string,           // Default: 'Rango de fecha'
    placeholder?: string,     // Default: 'Seleccionar período'
  }
  ```

- **Presets disponibles:**
  | Label | Días |
  |-------|------|
  | Hoy | 0 |
  | Esta semana | 7 |
  | Este mes | 30 |
  | Últimos 3 meses | 90 |
  | Este año | 365 |

- **Validación:**
  - ✅ `from` tiene `max={local.to || today()}`
  - ✅ `to` tiene `min={local.from}` y `max={today()}`
  - ✅ Botón "Aplicar rango" deshabilitado si no hay fechas (`disabled={!local.from && !local.to}`)

- **Locale:** ✅ `es-PE` (`{ day: '2-digit', month: 'short', year: 'numeric' }`)

- **Interacciones:**
  - ✅ Click en trigger → toggle dropdown
  - ✅ Click en preset → aplica y cierra
  - ✅ Click en input date → selector nativo
  - ✅ Botón "Aplicar rango" → confirma y cierra
  - ✅ Botón X → limpia rango (con `stopPropagation`)

- **Estados manejados:**
  - **Vacío:** muestra `placeholder` con icono gris
  - **Con valor:** muestra rango formateado "01 ene 2026 → 15 ene 2026" (si from≠to) o solo from
  - **Abierto/Cerrado:** animación `motion.div` con `opacity`, `y`, `scale`

- **Responsive:** ✅ `w-full` con `grid-cols-2` para inputs

- **Accesibilidad:**
  - ⚠️ Trigger es `<button>` sin `aria-expanded` (mejorable)
  - ⚠️ Inputs `<input type="date">` sin `<label>` visible (mejorable, aunque están dentro de `<label>`)
  - ✅ Focus ring visible (`focus:ring-2 focus:ring-blue-500/50`)
  - ✅ `[color-scheme:dark]` para que el datepicker nativo se vea oscuro

- **Usado en:**
  - ✅ `components/filters/FilterPanel.jsx` (dentro de la sección "Fecha")

---

### 2.2 FilterBar

**Archivo:** `legalpro-app/src/components/filters/FilterBar.jsx` (220 líneas)

- **Propósito:** Barra de filtros **horizontal y sticky** con buscador, ordenamiento, filtros activos como chips y botón para abrir el panel avanzado.

- **Librerías:**
  - `framer-motion` (animaciones de dropdown sort, chips con `layout`, entrada/salida)
  - `lucide-react` (`Filter`, `X`, `ChevronDown`, `SlidersHorizontal`, `Search`, `ArrowUpDown`, `Check`)

- **Props:**
  ```js
  {
    filters?: Array<{ id: string, label: string, value?: string }>,  // Chips activos
    onRemoveFilter?: (id) => void,
    onClearAll?: () => void,
    onOpenPanel?: () => void,        // Abre FilterPanel
    resultCount?: number | null,
    sort?: 'recent' | 'oldest' | 'alpha' | 'urgent',
    onSortChange?: (value) => void,
    searchQuery?: string,
    onSearchChange?: (query) => void,
    placeholder?: string,           // Default: 'Buscar...'
    className?: string,
  }
  ```

- **Opciones de ordenamiento (`SORT_OPTIONS`):**
  | Value | Label |
  |-------|-------|
  | `recent` | Más recientes |
  | `oldest` | Más antiguos |
  | `alpha` | A → Z |
  | `urgent` | Urgentes primero |

- **Interacciones:**
  - ✅ **Búsqueda en tiempo real** (`onChange` en input)
  - ✅ **Dropdown de sort** con cierre automático al hacer click fuera (`useEffect` + `mousedown` listener)
  - ✅ **Botón limpiar filtros** con icono X (visible si `searchQuery` no está vacío)
  - ✅ **Botón "Filtrar"** con badge contador (`{filters.length > 0 && <span>{filters.length}</span>}`)
  - ✅ **Chips removibles** con animación `motion.span layout`
  - ✅ **"Limpiar todo"** solo visible si `filters.length > 1`

- **Estados manejados:**
  - **Sin filtros:** solo fila 1 (search + sort + botón filtrar)
  - **Con filtros:** fila 2 aparece con animación (`height: 0 → auto`)
  - **Chips activos:** aparecen con `layout` animation y salen con `scale: 0.8`

- **Responsive:**
  - ✅ Labels ocultos en mobile (`hidden sm:inline`) — solo iconos visibles
  - ✅ `max-w-md` para el buscador
  - ⚠️ En mobile muy pequeño el botón "Filtrar" puede comprimir el buscador (mejorable con `flex-wrap`)

- **Accesibilidad:**
  - ✅ `aria-label="Limpiar filtros"` en botón X
  - ⚠️ Search input sin `<label>` visible (mejorable)
  - ⚠️ Botón "Filtrar" sin `aria-label` cuando solo muestra icono en mobile (mejorable)
  - ⚠️ Dropdown de sort no usa `role="listbox"` ni `aria-expanded` (mejorable)

- **CSS Custom usado:**
  - ✅ `.filter-bar` (en `index.css` línea 1224): flex horizontal con scrollbar oculto
  - ✅ `.filter-chip` (línea 1233): pill con color azul
  - ✅ `.filter-chip-remove` (línea 1249): botón X con hover opacity

- **Usado en:**
  - ❌ **NO se está usando en ninguna página actualmente** (componente nuevo sin consumidor)

---

### 2.3 FilterChip

**Archivo:** `legalpro-app/src/components/filters/FilterChip.jsx` (41 líneas)

- **Propósito:** Chip individual **removible** que representa un filtro activo. Versión standalone de los chips que usa FilterBar internamente.

- **Librerías:**
  - `framer-motion` (`layout`, entrada/salida con `scale`)
  - `lucide-react` (`X`)

- **Props:**
  ```js
  {
    label?: string,                       // "Materia"
    value: string,                        // "Civil"
    onRemove?: () => void,
    color?: 'blue' | 'gold' | 'green' | 'red' | 'violet' | 'gray',  // Default: 'blue'
  }
  ```

- **Variantes de color:**
  | Color | Clases Tailwind |
  |-------|------------------|
  | `blue` | `bg-blue-500/15 text-blue-400 border-blue-500/30` |
  | `gold` | `bg-amber-500/15 text-amber-400 border-amber-500/30` |
  | `green` | `bg-emerald-500/15 text-emerald-400 border-emerald-500/30` |
  | `red` | `bg-red-500/15 text-red-400 border-red-500/30` |
  | `violet` | `bg-violet-500/15 text-violet-400 border-violet-500/30` |
  | `gray` | `bg-slate-500/15 text-slate-400 border-slate-500/30` |

- **Interacciones:**
  - ✅ Click en botón X → ejecuta `onRemove`
  - ✅ Animación de layout (reordering) cuando hay otros chips

- **Accesibilidad:**
  - ✅ `aria-label={\`Eliminar filtro ${label ?? value}\`}` en el botón X
  - ✅ `select-none` para evitar selección accidental
  - ✅ Focus visible (heredado de Tailwind)

- **Usado en:**
  - ❌ **NO se está usando en ninguna página** (componente standalone, listo para usar)

---

### 2.4 FilterPanel

**Archivo:** `legalpro-app/src/components/filters/FilterPanel.jsx` (229 líneas)

- **Propósito:** **Drawer lateral derecho** (360px) con filtros avanzados organizados en secciones colapsables. Secciones: **Fecha | Estado | Materia | Instancia/Juzgado | Monto**.

- **Librerías:**
  - `framer-motion` (drawer slide-in, secciones colapsables)
  - `react-dom` (`createPortal` para renderizar fuera del DOM tree)
  - `lucide-react` (`X`, `ChevronDown`, `SlidersHorizontal`, `RotateCcw`)
  - Componentes internos: `Checkbox` (../ui/Checkbox), `DateRangePicker`, `Button`

- **Props:**
  ```js
  {
    open?: boolean,
    onClose?: () => void,
    filters?: {
      fecha?: { from: string, to: string },
      estados?: string[],          // ['activo', 'pendiente', etc.]
      materias?: string[],         // ['Civil', 'Penal', ...]
      instancias?: string[],       // ['Juzgado de Paz Letrado', ...]
      montoMin?: string,
      montoMax?: string,
    },
    onChange?: (filters) => void,
    resultCount?: number,
  }
  ```

- **Datos hardcoded (a refactorizar):**
  ```js
  const ESTADOS = [
    { value: 'activo',    label: 'Activo',    count: 45, color: 'text-emerald-400' },
    { value: 'pendiente', label: 'Pendiente', count: 12, color: 'text-amber-400' },
    { value: 'urgente',   label: 'Urgente',   count: 3,  color: 'text-red-400' },
    { value: 'archivado', label: 'Archivado', count: 8,  color: 'text-slate-400' },
  ];
  const MATERIAS = ['Penal', 'Civil', 'Laboral', 'Constitucional', 'Familia', 'Administrativo'];
  const INSTANCIAS = ['Juzgado de Paz Letrado', 'Juzgado Especializado', 'Sala Superior', 'Sala Suprema', 'Tribunal Constitucional'];
  ```
  ⚠️ Los `count` de ESTADOS son **hardcoded** — deberían venir del backend.

- **Interacciones:**
  - ✅ **Drawer slide-in** desde la derecha (`x: '100%' → 0`)
  - ✅ **Overlay oscuro** cierra el panel al hacer click
  - ✅ **Acordeón por sección** con `Section` component (animación `height: 0 ↔ auto`)
  - ✅ **Checkboxes multi-select** para estados e instancias (`toggleSet` con `Set`)
  - ✅ **Pills toggle** para materias (mejor UX que checkboxes para muchas opciones)
  - ✅ **DateRangePicker** integrado para fechas
  - ✅ **Inputs numéricos** para monto min/max con `min="0"`
  - ✅ **Botón "Limpiar"** resetea todos los filtros
  - ✅ **Botón "Aplicar filtros"** confirma y cierra

- **Estados manejados:**
  - **Cerrado** (`open=false`): no se renderiza (gracias a `AnimatePresence`)
  - **Abierto**: drawer + overlay con animación
  - **Sección abierta/cerrada**: control independiente por sección

- **Z-index:** 100 (overlay) / 101 (panel) — por debajo de modales pero por encima del contenido

- **Responsive:**
  - ⚠️ **No es responsive en mobile**: ancho fijo de **360px** que en pantallas < 360px no cabe
  - ⚠️ En mobile, debería ocupar **full-width** (`w-full sm:w-[360px]`)

- **Accesibilidad:**
  - ✅ `aria-label="Cerrar filtros"` en botón X
  - ✅ `createPortal(document.body)` → fuera del stacking context del padre
  - ✅ Overlay clickeable para cerrar
  - ⚠️ Falta `role="dialog"` y `aria-modal="true"` (mejorable)
  - ⚠️ **Falta focus trap** (mejorable — debería atrapar Tab/Shift+Tab dentro del panel)
  - ⚠️ Falta `aria-labelledby` apuntando al título "Filtros avanzados"
  - ⚠️ Falta cerrar con tecla `Escape`

- **Usado en:**
  - ❌ **NO se está usando en ninguna página** (componente nuevo, listo para integrar)
  - Internamente usa `DateRangePicker`

---

## 3. Wizards (`components/wizards/`)

### 3.1 WizardShell

**Archivo:** `legalpro-app/src/components/wizards/WizardShell.jsx` (396 líneas)

- **Propósito:** **Shell reutilizable** para wizards multi-paso con validación por paso, persistencia de progreso, animaciones, indicador visual y confirmación al cancelar.

- **Librerías:**
  - `framer-motion` (transición de pasos con `AnimatePresence mode="wait"`, step indicator)
  - `lucide-react` (`X`, `ChevronLeft`, `ChevronRight`, `Check`, `AlertTriangle`)
  - `Button` (componente UI)
  - `useUI()` hook (`confirm`, `toast` del contexto UI)

- **Props:**
  ```js
  {
    steps: Array<{
      label: string,              // "Datos básicos"
      icon?: ReactComponent,      // Ícono del paso
      description?: string,       // Descripción debajo del título
      component: ReactComponent,  // El componente del paso
      validate?: async (data) => true | string  // Validación custom
    }>,
    title?: string,               // Default: 'Asistente'
    subtitle?: string,
    onComplete: async (data) => void,
    onCancel?: () => void,
    storageKey?: string,          // Persiste paso actual en sessionStorage
    fullscreen?: boolean,         // Default: false (max-w-2xl centrado)
    data: object,                 // Estado compartido entre pasos
    setData: (data) => void,      // Setter del estado
  }
  ```

- **Exporta también:** Hook `useWizard(initialData)` que retorna `{ data, setData, updateField, resetData }`

- **Funcionalidades implementadas:**
  - ✅ **Navegación prev/next** con botones (`ChevronLeft` / `ChevronRight`)
  - ✅ **Indicador de progreso visual** (`StepIndicator` con círculos numerados + líneas conectoras animadas)
  - ✅ **Validación por paso asíncrona** (`step.validate(data) → true | string`)
  - ✅ **Banner de error** con `AlertTriangle` si la validación falla
  - ✅ **Persistencia en `sessionStorage`** con clave `wizard_step_${storageKey}` (sobrevive recargas)
  - ✅ **Auto-restaura paso** al montar (lee de sessionStorage)
  - ✅ **Auto-elimina storageKey** al completar exitosamente
  - ✅ **Confirmación al cancelar** con `confirm()` del UIContext
  - ✅ **Indicador de puntos en mobile** (`sm:hidden` con barras de progreso)
  - ✅ **Animaciones direccionales** (slide left/right según navegación)
  - ✅ **Modo fullscreen** opcional (`fullscreen={true}` → `w-full h-full`)
  - ✅ **Loading states** (`validating`, `completing`) en botones
  - ✅ **Tecla Escape** → confirma cancelación
  - ✅ **Botón "Finalizar"** con variant `gold` cuando es el último paso

- **StepIndicator — diseño:**
  - Círculos numerados (1, 2, 3...) que cambian a ✓ cuando se completa
  - Ring pulsante `animate-ping` en paso activo
  - Líneas conectoras que se llenan de izquierda a derecha con `width: 0 → 100%`
  - Labels debajo de cada círculo (`max-w-[72px]`)
  - Distancia entre círculos: `w-12 sm:w-16`

- **Estados manejados:**
  | Estado | UI |
  |--------|-----|
  | **Loading validación** | Spinner en botón "Siguiente" |
  | **Loading complete** | Spinner en botón "Finalizar" |
  | **Error de validación** | Banner rojo con mensaje |
  | **Último paso** | Botón "Finalizar" con `variant="gold"` |

- **Z-index:** 150 (overlay del wizard)

- **Responsive:**
  - ✅ Mobile: indicador de puntos (`sm:hidden`)
  - ✅ Desktop: step indicator completo (`hidden sm:flex`)
  - ✅ Mobile: `max-w-2xl max-h-[90vh]` en modo modal, fullscreen si `fullscreen=true`

- **Accesibilidad:**
  - ✅ `aria-label="Cerrar asistente"` en botón X
  - ✅ `role="dialog"` **FALTA** (mejorable)
  - ✅ `aria-modal="true"` **FALTA** (mejorable)
  - ⚠️ **Falta focus trap** — Tab puede escapar del wizard
  - ⚠️ Falta `aria-live="polite"` en el banner de error
  - ⚠️ Falta `<h1>` o `<h2>` semántico en el header (usa `<h2>` que es OK)

- **Usado en:**
  - ❌ **NO se está usando en ninguna página actualmente**
  - **POTENCIALES consumidores** (detectados en grep):
    - `pages/SetupOrganizacion.jsx` — actualmente es un formulario simple (no wizard)
    - `pages/RedactorEscritos.jsx` — actualmente es página única con form completo
    - `pages/SignupPage.jsx` — usa su propio `useState step` manual

---

## 4. Onboarding (`components/onboarding/`)

### 4.1 OnboardingTour

**Archivo:** `legalpro-app/src/components/onboarding/OnboardingTour.jsx` (496 líneas)

- **Propósito:** **Tour guiado contextual** para nuevos usuarios con spotlight animado sobre elementos del DOM (seleccionados por `data-tour="..."`).

- **Librerías:**
  - `framer-motion` (overlay, tooltip, badge flotante)
  - `react-dom` (`createPortal` para renderizar en `document.body`)
  - `react-router-dom` (`useLocation` para detectar rutas inmersivas)
  - `lucide-react` (iconos de features + `X`, `ChevronLeft`, `ChevronRight`, `SkipForward`, `Sparkles`)
  - `Button` (componente UI)
  - **Hooks de React:** `useState`, `useEffect`, `useCallback`, `startTransition` (React 19)

- **Props:**
  ```js
  {
    role?: 'ABOGADO' | 'FISCAL' | 'JUEZ' | 'CONTADOR',  // Default: 'ABOGADO'
  }
  ```

- **Exporta también:** Hook `useResetTour()` para resetear el tour desde Settings.

- **Tours definidos por rol:**

  | Rol | Pasos | Features destacadas |
  |-----|-------|---------------------|
  | **ABOGADO** | 8 | Dashboard → Expedientes → Redactor → Simulador → Predictor → Buscador → Monitor SINOE → Bóveda |
  | **FISCAL** | 4 | Dashboard → Expedientes → Redactor → Predictor |
  | **JUEZ** | 3 | Dashboard → Expedientes → Buscador (Precedentes) |
  | **CONTADOR** | 2 | Dashboard → Herramientas multidisciplinarias |

- **Estructura de cada paso:**
  ```js
  {
    target: '[data-tour="dashboard"]',  // Selector CSS
    title: '¡Bienvenido al Dashboard!',
    description: '...',
    icon: LayoutDashboard,              // Componente de icono
    position: 'right',                  // 'right' | 'left' | 'bottom' | 'top'
  }
  ```

- **Persistencia:**
  - **Storage key:** `legalpro_tour_completed`
  - **Tipo:** `localStorage` (sobrevive cierre de sesión)
  - **Trigger:** Solo se inicia si `!done && location.pathname === '/dashboard'` después de 1.2s

- **Funcionalidades implementadas:**
  - ✅ **Spotlight animado** con `radial-gradient` que ilumina el elemento target
  - ✅ **Highlight ring** alrededor del target con `boxShadow` azul + ping animation
  - ✅ **Tooltip flotante** con posición inteligente (`computeTooltipStyle`):
    - `right` / `left` / `bottom` / fallback `top`
    - Clamp vertical para que no se salga del viewport
  - ✅ **Scroll automático** al target (`scrollIntoView({ behavior: 'smooth', block: 'center' })`)
  - ✅ **Recálculo de posición** en `resize` y al cambiar paso
  - ✅ **Indicador de puntos** clickeable (`onClick={() => setStep(i)}`)
  - ✅ **Progress bar inferior** con gradiente azul-violeta
  - ✅ **Badge flotante** de progreso (bottom-right)
  - ✅ **Botones "Omitir"** múltiples (header X, footer, badge)
  - ✅ **Botón "Anterior"** solo si `step > 0`
  - ✅ **Botón "¡Listo!"** (variant gold) en el último paso
  - ✅ **Auto-cierre en rutas inmersivas** (`/chat-ia`, `/simulador`, `/redactor`, `/analista`)
  - ✅ **Flecha indicadora** hacia el target (solo posición `right`)
  - ✅ **`startTransition` de React 19** para recálculo no bloqueante

- **Z-index:** 200 (overlay) / 201 (highlight) / 202 (tooltip + badge)

- **Responsive:**
  - ✅ Tooltip con `width: 320` (fijo)
  - ✅ `computeTooltipStyle` con clamp horizontal (`Math.min(vw - tooltipWidth - margin, ...)`)
  - ✅ Auto-clamp vertical (`if (style.top + 260 > vh)`)
  - ⚠️ En mobile muy pequeño (< 360px) el tooltip puede comprimir el viewport (mejorable con `width: 'calc(100vw - 32px)'`)

- **Accesibilidad:**
  - ✅ `aria-label="Omitir tour"` en botones X
  - ✅ `aria-label={\`Ir al paso ${i + 1}\`}` en dots
  - ✅ `aria-label="Paso anterior"` en ChevronLeft
  - ⚠️ Falta `role="dialog"` y `aria-modal="true"` en el overlay
  - ⚠️ Falta `aria-live="polite"` para anunciar el paso actual a lectores de pantalla
  - ⚠️ Falta **focus trap** dentro del tooltip
  - ⚠️ Falta soporte de **navegación por teclado** para avanzar (Enter/Space)
  - ⚠️ Falta **skip link** o descripción alternativa del tour
  - ⚠️ El spotlight es puramente visual (no anuncia el elemento target a screen readers)

- **Usado en:**
  - ✅ `components/Layout.jsx` (línea 8) — se renderiza globalmente con el rol del usuario
  - ✅ `data-tour` atributos en `components/Sidebar.jsx` (línea 204) → `NavLink` con `data-tour={to.replace('/', '')}`

---

## 5. Mapa de Uso por Página

### Componentes en uso ✅

| Componente | Consumido en | Notas |
|------------|--------------|-------|
| `ActivityAreaChart` | `pages/Dashboard.jsx` | Carga procesal reciente (200px height) |
| `MateriaPieChart` | `pages/Dashboard.jsx` | Distribución por materia (140px height) |
| `OnboardingTour` | `components/Layout.jsx` | Renderizado global con `role={userRole}` |
| `DateRangePicker` | `components/filters/FilterPanel.jsx` | Usado dentro del panel (no en páginas directas) |

### Componentes sin uso ❌ (deuda técnica)

| Componente | Estado | Posibles consumidores |
|------------|--------|----------------------|
| `FilterBar` | Implementado, sin consumidor | `Expedientes`, `Buscador`, `Jurisprudencia` |
| `FilterPanel` | Implementado, sin consumidor | Idem FilterBar |
| `FilterChip` | Implementado, sin consumidor | Idem FilterBar |
| `WizardShell` | Implementado, sin consumidor | `SetupOrganizacion`, `RedactorEscritos`, `SignupPage` |

---

## 6. Análisis de Cobertura e Interactividad

### Charts (`components/charts/`)

| Feature | ActivityAreaChart | MateriaPieChart |
|---------|-------------------|------------------|
| Tooltip on hover | ✅ | ✅ |
| Animaciones de entrada | ✅ (recharts built-in) | ✅ (recharts built-in) |
| Responsive | ✅ (ResponsiveContainer) | ✅ (ResponsiveContainer) |
| Loading state | ✅ (animate-pulse) | ✅ (spinner) |
| Empty state | ✅ (mensaje + mini chart) | ✅ (mensaje + mini pie) |
| Error state | ❌ | ❌ |
| Exportar PNG | ❌ | ❌ |
| Exportar CSV/Excel | ✅ (Dashboard externo) | ❌ |
| Drill-down / click handler | ❌ | ❌ |
| Leyenda integrada | ❌ (en Dashboard externo) | ❌ (en Dashboard externo) |
| Datos en tiempo real | ❌ (carga inicial) | ❌ (carga inicial) |
| Tooltip accesible por teclado | ❌ | ❌ |
| ARIA labels | ❌ | ❌ |
| Carga dinámica de recharts | ✅ | ✅ |

### Filtros (`components/filters/`)

| Feature | DateRangePicker | FilterBar | FilterChip | FilterPanel |
|---------|-----------------|-----------|------------|-------------|
| Persistencia URL | ❌ | ❌ | N/A | ❌ |
| Persistencia localStorage | ❌ | ❌ | ❌ | ❌ |
| Filtros guardados (saved presets) | ❌ | ❌ | ❌ | ❌ |
| Combinación AND/OR | N/A (rango) | AND implícito | N/A | AND (todos los filtros aplican simultáneamente) |
| Multi-select | ❌ (rango) | ❌ | ❌ | ✅ (estados, instancias, materias) |
| Búsqueda free-text | ❌ | ✅ | ❌ | ❌ |
| Sort options | ❌ | ✅ (4 opciones) | N/A | N/A |
| Animaciones entrada/salida | ✅ | ✅ | ✅ | ✅ |
| Responsive | ✅ | ⚠️ parcial | ✅ | ⚠️ (360px fijo) |
| Accesibilidad ARIA | ⚠️ parcial | ⚠️ parcial | ✅ | ⚠️ parcial |
| Focus trap en modal | N/A | N/A | N/A | ❌ |
| Cerrar con Escape | ❌ | ✅ (sort dropdown) | N/A | ❌ |

### Wizards (`components/wizards/`)

| Feature | WizardShell |
|---------|-------------|
| Navegación prev/next | ✅ |
| Indicador de progreso visual | ✅ (StepIndicator + dots mobile) |
| Validación por paso | ✅ (async) |
| Persistencia de progreso | ✅ (sessionStorage) |
| Resumen antes de completar | ❌ (falta implementar step de resumen) |
| Skip step (saltar paso opcional) | ❌ |
| Animaciones direccionales | ✅ |
| Modo fullscreen | ✅ |
| Confirmación al cancelar | ✅ |
| Loading states | ✅ (validating + completing) |
| Banner de error | ✅ |
| Tecla Escape → cancelar | ✅ |
| Focus trap | ❌ |
| ARIA dialog/modal | ❌ |
| Hook auxiliar `useWizard` | ✅ (exportado) |

### Onboarding (`components/onboarding/`)

| Feature | OnboardingTour |
|---------|----------------|
| Spotlight en elementos del DOM | ✅ (radial-gradient) |
| Tooltips flotantes | ✅ |
| Auto-scroll al target | ✅ |
| Recálculo en resize | ✅ |
| Persistencia en localStorage | ✅ |
| Skip tour (en header + footer + badge) | ✅ |
| Tours por rol (4 roles) | ✅ |
| Progreso guardado (step actual) | ❌ (solo "completed") |
| Navegación libre (click en dots) | ✅ |
| Soporte teclado (Enter/Space) | ❌ |
| Focus trap | ❌ |
| ARIA dialog + aria-live | ❌ |
| Animación de flecha al target | ✅ (solo posición `right`) |
| Progress bar visual | ✅ |
| Badge flotante de progreso | ✅ |
| Auto-cierre en rutas inmersivas | ✅ |

---

## 7. Accesibilidad (WCAG 2.1 AA)

### Estado de cumplimiento

| Componente | Roles ARIA | Labels | Focus trap | Teclado | Live regions | Score |
|------------|------------|--------|------------|---------|--------------|-------|
| `ActivityAreaChart` | ❌ | ❌ | N/A | ⚠️ parcial | ❌ | 🟡 40% |
| `MateriaPieChart` | ❌ | ❌ | N/A | ⚠️ parcial | ❌ | 🟡 40% |
| `DateRangePicker` | ⚠️ parcial | ⚠️ parcial | N/A | ✅ | ❌ | 🟢 70% |
| `FilterBar` | ⚠️ parcial | ⚠️ parcial | N/A | ✅ | ❌ | 🟢 65% |
| `FilterChip` | ✅ | ✅ | N/A | ✅ | ❌ | 🟢 90% |
| `FilterPanel` | ❌ | ⚠️ parcial | ❌ | ⚠️ parcial | ❌ | 🔴 35% |
| `WizardShell` | ❌ | ⚠️ parcial | ❌ | ⚠️ parcial | ❌ | 🟡 45% |
| `OnboardingTour` | ❌ | ⚠️ parcial | ❌ | ⚠️ parcial | ❌ | 🟡 45% |

### Issues prioritarios de accesibilidad

1. 🔴 **FilterPanel**: falta `role="dialog"`, `aria-modal="true"`, focus trap, cerrar con Escape
2. 🔴 **WizardShell**: falta `role="dialog"`, `aria-modal="true"`, focus trap
3. 🔴 **OnboardingTour**: falta `role="dialog"`, `aria-modal="true"`, soporte teclado completo, anuncios a screen readers
4. 🟡 **Charts (ambos)**: necesitan ARIA labels descriptivos o tabla de datos alternativa para screen readers
5. 🟡 **DateRangePicker**: falta `aria-expanded` en trigger
6. 🟡 **FilterBar**: falta `role="listbox"` en sort dropdown

---

## 8. Pendientes y Recomendaciones

### 🔴 Alta prioridad (deuda técnica)

1. **Consumir componentes sin uso** (FilterBar, FilterPanel, FilterChip, WizardShell):
   - **FilterBar + FilterPanel + FilterChip**: integrar en `pages/Expedientes.jsx` para filtros por materia/estado/fecha
   - **WizardShell**: refactorizar `pages/SetupOrganizacion.jsx` para usar wizard de 2 pasos (crear/unir)
   - **WizardShell**: opcionalmente usar en `pages/SignupPage.jsx` para reemplazar el step manual
   - **WizardShell**: considerar para wizard de MFA en `pages/Perfil.jsx`

2. **Tests unitarios (Vitest + Testing Library)**: 0% cobertura en estos 8 componentes. Crear tests para:
   - Renderizado correcto
   - Interacciones (click, type, change)
   - Estados (loading, empty, error)
   - Validaciones (WizardShell.validate)
   - Accesibilidad (axe-core)

### 🟡 Media prioridad (mejoras)

3. **Accesibilidad:**
   - Añadir `role="dialog"` + `aria-modal="true"` en `FilterPanel`, `WizardShell`, `OnboardingTour`
   - Implementar focus trap en los 3 modales
   - Soporte teclado completo en `OnboardingTour` (Enter para avanzar, Esc para cerrar)
   - ARIA live regions para anunciar cambios de paso

4. **Funcionalidad:**
   - **Persistencia de filtros en URL** (query params) para compartir links filtrados
   - **Filtros guardados** (saved presets) en FilterPanel
   - **Skip step** opcional en WizardShell
   - **Resumen final** en WizardShell antes de completar

5. **Performance:**
   - `FilterPanel` en mobile debería ser full-width
   - `Charts`: lazy load más agresivo con `React.lazy()` + `Suspense`

### 🟢 Baja prioridad (nice-to-have)

6. **Visualización:**
   - Exportar charts como PNG/SVG
   - Drill-down en charts (click en área → ver detalle)
   - Leyenda integrada en `MateriaPieChart`

7. **UX:**
   - Atajos de teclado para `WizardShell` (flechas para navegar pasos)
   - Animaciones más fluidas en `FilterPanel` al cambiar secciones

---

## Resumen

### Componentes auditados: **8**

| Categoría | Componentes | Líneas código | En uso | Pendientes |
|-----------|-------------|---------------|--------|------------|
| Charts | 2 | 156 | 2 | 0 |
| Filtros | 4 | 662 | 1 | 3 |
| Wizards | 1 | 396 | 0 | 1 |
| Onboarding | 1 | 496 | 1 | 0 |
| **TOTAL** | **8** | **1,710** | **4** | **4** |

### Funcionalidades cubiertas vs pendientes

| Feature | Cubierto | Pendiente | % Cobertura |
|---------|----------|-----------|-------------|
| Charts con loading state | 2/2 | 0 | 🟢 100% |
| Charts con empty state | 2/2 | 0 | 🟢 100% |
| Charts con tooltip | 2/2 | 0 | 🟢 100% |
| Carga dinámica de recharts | 2/2 | 0 | 🟢 100% |
| Filtros con presets (DateRange) | 1/1 | 0 | 🟢 100% |
| Filtros con animación | 3/3 | 0 | 🟢 100% |
| Filtros multi-select | 1/3 | 2 | 🟡 33% |
| Filtros con búsqueda | 1/3 | 2 | 🟡 33% |
| Filtros con sort | 1/3 | 2 | 🟡 33% |
| Wizard con validación | 1/1 | 0 | 🟢 100% |
| Wizard con persistencia | 1/1 | 0 | 🟢 100% |
| Wizard con confirmación cancel | 1/1 | 0 | 🟢 100% |
| Onboarding con spotlight | 1/1 | 0 | 🟢 100% |
| Onboarding con persistencia | 1/1 | 0 | 🟢 100% |
| Onboarding con tours por rol | 4/4 | 0 | 🟢 100% |
| **ARIA dialog/modal** | **0/3** | **3** | **🔴 0%** |
| **Focus trap en modales** | **0/3** | **3** | **🔴 0%** |
| **Tests unitarios** | **0/8** | **8** | **🔴 0%** |
| **Persistencia filtros en URL** | **0/3** | **3** | **🔴 0%** |

### 🎯 Conclusión

- ✅ **Implementación sólida en general** — los 8 componentes están bien diseñados y siguen las convenciones del repo (glassmorphism con `backdrop-blur`, gradientes, animaciones suaves).
- ✅ **Optimización de bundle correcta** — `recharts` se carga dinámicamente.
- ✅ **Onboarding bien implementado** — tours por rol, persistencia, spotlight animado.
- ⚠️ **3 filtros y 1 wizard NO se están usando** — deben integrarse o eliminarse.
- ⚠️ **Tests = 0%** — bloqueador crítico para producción.
- ⚠️ **Accesibilidad incompleta** — falta `role="dialog"`, focus trap, soporte teclado en 3 modales (FilterPanel, WizardShell, OnboardingTour).

**Próximos pasos sugeridos:**
1. Integrar `FilterBar + FilterPanel + FilterChip` en `Expedientes.jsx`
2. Refactorizar `SetupOrganizacion.jsx` para usar `WizardShell`
3. Crear suite de tests Vitest para los 8 componentes
4. Mejorar accesibilidad de los 3 modales (FilterPanel, WizardShell, OnboardingTour)