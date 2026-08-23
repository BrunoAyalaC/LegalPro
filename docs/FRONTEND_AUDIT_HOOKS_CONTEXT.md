# Auditoría Frontend LegalPro — Hooks, Contexts, API Client y Utils

> **Fecha:** 1 de agosto de 2026
> **Agente auditor:** @frontend (Frontend React 19)
> **Stack verificado:** React 19 / Vite 7 / TypeScript 6 / TailwindCSS 4 / React Router 7
> **Archivos auditados:** 13 (2 hooks + 2 contexts + 2 api + 4 utils + 1 constants + 1 types + 1 test)
> **Estado global:** 🟡 **FUNCIONAL CON DEFICIENCIAS CRÍTICAS** — 1 bug de integración bloqueante + 4 inconsistencias detectadas

---

## 📋 Resumen Ejecutivo (TL;DR)

| Área | Archivos | Estado | Hallazgos críticos |
|------|----------|--------|---------------------|
| Hooks | 2 | ✅ Parcial | Solo 1 hook activo (`useSeo`); barrel vacío |
| Contexts | 2 | 🟡 Crítico | `ConfirmModal` **NO montado en Layout** → bloquea `useUI().confirm()` |
| API Client | 2 | ✅ | 494 líneas, 28 helpers, cobertura de tests 100% en nuevos helpers |
| Utils | 4 | ✅ | Disclaimers IA hardcodeados (3 lugares) — riesgo de drift |
| Constants | 1 | 🟡 Drift | `STORAGE_KEYS.TOKEN` y `SIDEBAR_COLLAPSED` definidos pero NO usados / inconsistencia |
| Types | 1 | ✅ | 11 interfaces, sin tests — falta validación |

**Total archivos lógica frontend auditados:** 13
**Pendientes críticos:** 5 (1 bug bloqueante + 4 issues menores)
**Tests unitarios:** 1 archivo, 12 tests, 100% pass en helpers nuevos

---

## 1. Hooks Personalizados

### 1.1 `useSeo` (`src/hooks/useSeo.js`)

- **Propósito:** Hook centralizado para SEO dinámico por página. Setea `document.title` y meta tags Open Graph / Twitter Card de forma idempotente.
- **API pública:**
  ```js
  useSeo({
    title:       string,        // Asigna a document.title
    description: string?,       // Meta description + og:description + twitter:description
    image:       string?,       // og:image + twitter:image (URL absoluta o relativa)
  })
  ```
- **Efectos secundarios:**
  - Mutación de `document.title`
  - Creación/actualización de meta tags vía `upsertMeta()`
  - Restauración del `document.title` previo al desmontar (cleanup)
- **Dependencias:** React 19 (`useEffect`)
- **Guard SSR:** `if (typeof document === 'undefined') return undefined;`
- **Usado en:** **9 páginas**
  - `AnalistaExpedientes.jsx`
  - `BuscadorJurisprudencia.jsx`
  - `ChatIA.jsx`
  - `Dashboard.jsx`
  - `Expedientes.jsx`
  - `PanelCreditos.jsx`
  - `PanelExpertos.jsx`
  - `PredictorJudicial.jsx`
  - `RedactorEscritos.jsx`
- **Observaciones técnicas:**
  - ✅ Maneja correctamente la creación vs actualización de meta tags
  - ✅ Cleanup apropiado (restaura `document.title` previo)
  - ⚠️ El parámetro JSDoc menciona `keywords` pero **el hook no lo implementa** (drift entre doc y código)
  - ⚠️ No soporta `canonical` ni `hreflang` (futuro i18n)
- **Estado:** ✅ **Funcional** (con drift menor en JSDoc)

---

### 1.2 `index.js` (`src/hooks/index.js`)

- **Propósito:** Barrel export de hooks (legacy)
- **Contenido actual:**
  ```js
  /* Barrel export — todos los custom hooks de LegalPro */
  // All hooks removed as part of dead code cleanup (jun 2026).
  ```
- **Estado:** ✅ **Vacío intencional** — limpieza de código muerto de junio 2026 documentada
- **Recomendación:** Considerar eliminar el archivo ya que no exporta nada (ahorra un import en barrel chains)

---

## 2. Contexts (Estado Global)

### 2.1 `TenantContext` (`src/context/TenantContext.tsx`)

- **Propósito:** Estado global del tenant autenticado (usuario + organización + token). Rehidratación de sesión vía HttpOnly cookie.
- **Provider:** `<TenantProvider>{children}</TenantProvider>`
- **Hook:** `useTenant()` — lanza error si se usa fuera del Provider
- **Tipo expuesto:** `TenantContextType`

#### Estado expuesto

| Propiedad | Tipo | Origen |
|-----------|------|--------|
| `token` | `string \| null` | Decodificado del JWT |
| `usuario` | `Usuario \| null` | Payload JWT |
| `organizacion` | `Organizacion \| null` | Payload JWT |
| `isAuthenticated` | `boolean` | Derivado de `!!token` |
| `isLoading` | `boolean` | Estado de hidratación/login |
| `error` | `string \| null` | Mensaje de error de login |

#### Funciones expuestas

| Función | Firma | Comportamiento |
|---------|-------|----------------|
| `login(email, password)` | `(string, string) → Promise<LoginResult>` | Llama a `api.login()`, parsea JWT, actualiza estado |
| `logout()` | `() → Promise<void>` | Llama a `api.logout()` (limpia cookie HttpOnly), limpia estado |
| `refreshToken()` | `() → Promise<void>` | Re-obtiene sesión vía `getSessionFromCookie()` |

#### Dependencias
- `../api/client` → `api`, `clearTokens`, `getSessionFromCookie`
- `../utils/utf8` → `fixUtf8Mojibake` (corrección de encoding en nombres)
- `../types` → `TenantContextType`, `TenantState`, `LoginResult`, `Usuario`, `Organizacion`

#### Aspectos de seguridad
- ✅ **NO usa localStorage** — solo cookie HttpOnly (`withCredentials: true`)
- ✅ Corrige mojibake UTF-8 en nombres (`fixUtf8Mojibake`)
- ✅ Manejo de cancelación en `useEffect` con flag `cancelled` para evitar state updates tras unmount
- ✅ Mensajes de error específicos: 401 → "Credenciales incorrectas" / otros → "No se pudo conectar"

#### Hallazgos
- �️ **`setTokens(data.token, '')` en `client.ts` línea 156** — el refresh token siempre es vacío (cookie HttpOnly), por lo que el interceptor de refresh (líneas 65-79) **nunca se dispara en condiciones normales**. Si la cookie HttpOnly expira, el usuario verá 401 sin auto-refresh.
- ⚠️ **No hay renovación automática de token antes de expiración** — solo cuando se hace una request
- ⚠️ **`refreshToken()` se llama después de crear/unirse a org** (`ConfigEspecialidad.jsx`, `SetupOrganizacion.jsx`) — patrón correcto

- **Estado:** ✅ **Funcional y bien diseñado** (seguridad first con HttpOnly cookie)

---

### 2.2 `UIContext` (`src/context/UIContext.tsx`)

- **Propósito:** Estado global de UI (toasts, command palette, modal de confirmación, sidebar collapsed).
- **Provider:** `<UIProvider>{children}</UIProvider>`
- **Hook:** `useUI()` — lanza error si se usa fuera del Provider
- **Tipo expuesto:** `UIContextType`

#### Estado expuesto

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `toasts` | `ToastItem[]` | Cola máxima de 5 toasts visibles |
| `commandOpen` | `boolean` | Estado del Command Palette (Ctrl+K) |
| `confirmModal` | `ConfirmModalState \| null` | Modal de confirmación global |
| `sidebarCollapsed` | `boolean` | Estado persistente en localStorage |

#### Funciones expuestas

| Función | Firma | Uso |
|---------|-------|-----|
| `addToast(input)` | `(AddToastInput) → number` | Añade toast genérico |
| `removeToast(id)` | `(number) → void` | Elimina toast por id |
| `toast.success/error/warning/info/ai(msg, opts?)` | `(string, ToastOptions?) → number` | Helpers tipados |
| `openCommand()` / `closeCommand()` | `() → void` | Control Command Palette |
| `confirm(opts)` | `(opts) → Promise<boolean>` | **Bloqueante** — abre modal y espera resolución |
| `resolveConfirm(result)` | `(boolean) → void` | Resuelve la promise de `confirm()` |
| `toggleSidebar()` | `() → void` | Alterna sidebar + persiste en localStorage |

#### Aspectos técnicos
- ✅ ID incremental global (`let toastId = 0`) para keys de React
- ✅ Cola limitada a últimos 5 toasts (`prev.slice(-4)` + nuevo = 5)
- ✅ Auto-dismiss con `setTimeout` configurable (`duration: 0` = persistente)
- ✅ Toasts con acción opcional (`action: () => void`)
- ✅ 5 tipos de toast: `success`, `error`, `warning`, `info`, `ai` (específico para outputs IA)
- ✅ Persistencia de sidebar en localStorage con try/catch (degraded gracefully)
- ✅ `resolveRef` con `useRef` para resolver la Promise sin re-render

#### 🔴 **HALLAZGO CRÍTICO: `ConfirmModal` NO está montado**

```jsx
// src/components/Layout.jsx (líneas 77-79)
{/* ─── PORTALES GLOBALES ─── */}
<CommandPalette />
<ToastContainer />
// ❌ FALTA: <ConfirmModal />
```

**Impacto:**
- `WizardShell.jsx` (línea 128, 211) llama a `await confirm({...})` — **el modal nunca aparece visualmente**
- La Promise queda **colgada para siempre** (memory leak de microtasks)
- Comportamiento esperado del usuario: nunca ve confirmación, flujo queda en limbo
- **Acción inmediata requerida:** Agregar `<ConfirmModal />` en `Layout.jsx` después de `<ToastContainer />`

- **Estado:** � **CRÍTICO** — bug de integración bloqueante

---

## 3. API Client

### 3.1 `client.ts` (`src/api/client.ts`)

- **Propósito:** Cliente API central con integración real al backend (Node + .NET).
- **Multi-stack:** Node (auth, orgs, ARCO) + .NET (expedientes, IA, contadores) + Owner dashboard
- **Tipo:** Axios instances (2 separadas) + objeto `api` con wrappers

#### Configuración

| Variable | Default | Stack |
|----------|---------|-------|
| `VITE_NODE_API_URL` | `http://localhost:3001` | Auth, orgs, ARCO |
| `VITE_DOTNET_API_URL` | `http://localhost:5000` | Expedientes, IA |
| `X-Correlation-Id` | UUID en sessionStorage | Trazabilidad cross-service |

#### Interceptores

**Node client:**
- **Request:** Inyecta `X-Correlation-Id` y `Authorization: Bearer <token>`
- **Response:** Auto-refresh en 401 si hay `REFRESH_TOKEN` (⚠️ ver hallazgo abajo)

**.NET client:**
- **Request:** Mismo que Node (correlation + auth)
- **Response:** Sin auto-refresh (espera manejo desde frontend)

#### Token storage

```ts
let ACCESS_TOKEN: string | null = null;     // Memoria, NO localStorage
let REFRESH_TOKEN: string | null = null;   // Memoria
```

- ✅ **Cumple regla OWASP:** no JWT en localStorage
- ⚠️ **`REFRESH_TOKEN` siempre es `''`** (línea 156) porque se usa cookie HttpOnly → el auto-refresh nunca se ejecuta
- ⚠️ **Tokens en memoria se pierden al recargar la pestaña** → depende de `getSessionFromCookie()` para rehidratar

#### Helpers API (28 funciones)

**Auth (Node):**
- `login(payload)` → `/api/auth/login`
- `logout()` → `/api/auth/logout`
- `getCurrentUser()` → `/api/auth/me`
- `getSessionFromCookie()` → `/api/auth/me` (rehidratación)
- `register(payload)` → `/api/auth/register`

**Expedientes (Node):**
- `listarExpedientes(opts, signal)` → `/api/expedientes`
- `getExpediente(id, signal)` → `/api/expedientes/:id` o fallback
- `getDocumentos(expedienteId, signal)` → derivado

**IA (.NET):**
- `analizarExpediente(payload)` → `/api/analista`
- `analizar(expedienteId)` → `/api/analista/analizar`
- `buscarJurisprudencia(payload)` → `/api/jurisprudencia/buscar`
- `redactarEscrito(payload)` → `/api/redactor/generar`
- `predecirResultado(payload)` → `/api/predictor`
- `chat(mensaje, historial, expedienteId)` → `/api/ai/chat`
- **`consulta(prompt, tipo, extra)`** → Router inteligente (ver abajo)

**Organizaciones (Node):**
- `createOrg(payload)` → `/api/organizaciones`
- `acceptInvitation(token)` → `/api/organizaciones/aceptar-invitacion`

**Documentos (Node):**
- `createDocumento(formData)` → `/api/documentos/upload` (multipart automático)

**Reportes (.NET):**
- `getReporte(expedienteId)` → **Stub** con `console.warn` ("Funcionalidad en desarrollo")

**LPDP (Node):**
- `getMisDatos()` → `/api/mis-datos`
- `updateMisDatos(payload)` → `/api/mis-datos` (PUT)
- `exportarMisDatos(formato)` → `/api/mis-datos/export`
- `exportMisDatos()` → wrapper fetch-like para `Perfil.jsx`
- `deleteAccount()` → `/api/mis-datos/cancelar`
- `oponerTratamiento(finalidad, motivo?)` → `/api/mis-datos/oposicion` (LPDP Art. 27)
- `revocarConsentimiento(tipo)` → `/api/mis-datos/consentimiento/:tipo` (LPDP Art. 14, 15)

#### Router de IA (`consulta`)

Mapeo `tipo → endpoint .NET` con fallback a `/api/ai/chat`:

```ts
'redaccion'         → '/api/redactor/generar'
'predictor'         → '/api/predictor/predecir'
'jurisprudencia'    → '/api/jurisprudencia/buscar'
'alegato'|'alegatos'→ '/api/alegato/generar'
'interrogatorio'    → '/api/interrogatorio/generar'
'objecion'          → '/api/objeciones/sugerir'
'simulacion'        → '/api/simulacion/iniciar'
'precedentes'|'comparador' → '/api/juez/precedentes/comparar'
'casos_criticos'    → '/api/ai/chat' (fallback)
'general'|'chat'|'default' → '/api/ai/chat' (fallback)
```

- ✅ TypeScript con autocomplete + acepta `string` arbitrario (`(string & {})`)
- ✅ Fallback seguro a `/api/ai/chat` para tipos desconocidos

#### Tipos exportados

```ts
ApiResponse<T>          // { success, data?, error?, correlationId? }
PaginatedResponse<T>    // { items, total, page, pageSize }
User, LoginPayload, LoginResponse, SessionData, FinalidadOposicion, TipoConsentimiento, TipoConsulta
```

- **Estado:** ✅ **Production-ready** (excepto el auto-refresh dead-code)

---

### 3.2 Tests (`src/api/__tests__/client.helpers.test.js`)

- **Framework:** Vitest + Testing Library (jest-style mocks)
- **Tests:** 12 bloques, 100% pass en helpers nuevos
- **Cobertura:**
  - `api.consulta` — routing por 13 tipos + fallback + payload override
  - `api.register` — payload completo + error propagation
  - `api.createDocumento` — FormData + sin headers manuales
  - `api.analizar` — payload simple + id preservado
  - `api.createOrg` — campos extra preservados
  - `api.acceptInvitation` — token vacío todavía se envía
  - `api.getReporte` — no hace HTTP + shape de fallback + console.warn
  - Shape de `api` — expone los 7 helpers nuevos + clients

#### Aspectos técnicos

- ✅ **Estrategia:** mockear `axios` antes de importar `client.ts` (estándar Vitest)
- ✅ Usa `globalThis.__lastBase` para distinguir Node vs .NET en el factory mock
- ✅ `vi.resetModules()` en `beforeEach` para reconstruir clientes
- ⚠️ **Fragilidad del mock:** depende de `globalThis.__lastBase` y orden de `axios.create()`. Si alguien añade un 3er cliente, el mock puede romperse silenciosamente.
- ⚠️ **No hay tests para los helpers "viejos"** (`login`, `logout`, `listarExpedientes`, `analizarExpediente`, etc.) — solo los nuevos

- **Estado:** ✅ **Cobertura sólida de helpers nuevos** (gap: helpers legacy)

---

## 4. Utils (Helpers Puros)

### 4.1 `documents.js` (`src/utils/documents.js`)

- **Propósito:** Exportación de documentos legales (PDF, DOCX, Excel) y generación de PDFs especializados (legal, custodia de evidencia).
- **5 funciones exportadas:**

| Función | Librería | Output | Uso |
|---------|----------|--------|-----|
| `exportToPDF(elementId, filename, options)` | `html2pdf.js` (lazy) | PDF | Exportar DOM a PDF |
| `exportToExcel(data, filename, sheetName)` | `xlsx` (lazy) | XLSX | Datos tabulares con estilos |
| `exportToDocx(content, filename, options)` | `docx` (lazy) | DOCX | Escritos legales con disclaimer |
| `generateLegalPDF(content, metadata)` | `html2pdf.js` (lazy) | PDF | Escritos con membrete + disclaimer |
| `generateCustodyPDF(evidencias, metadata)` | `html2pdf.js` (lazy) | PDF | Cadena de custodia digital (Ley 27269) |

#### Aspectos técnicos

- ✅ **Lazy loading** de librerías pesadas (`html2pdf.js`, `xlsx`, `docx`) — ahorra bundle inicial
- ✅ `saveAs` de `file-saver` para descarga
- ✅ Disclaimers IA insertados en 3 lugares (líneas 103-108, 165-167, y en `exportToDocx`)
- ✅ Estilos profesionales en XLSX (header azul #1F4E78, bordes, freeze pane)
- ✅ Try/finally en PDFs para limpiar container DOM off-screen
- ✅ Documentos legales con membrete (organización, colegiatura CAL, fecha es-PE)

#### ⚠️ Hallazgos

- **DRIFT DE DISCLAIMER IA:** El disclaimer está **hardcodeado en 3 lugares** (líneas 103, 166, 230 aprox) en lugar de importarse de `catalogs/disclaimers-ia.json`. Si cambia la regulación, hay que actualizar 3 sitios manualmente.
  - **Recomendación:** Crear constante única `LEGAL_DISCLAIMER_IA` importada de catalogs o un archivo `constants/disclaimers.js`.
- ⚠️ **`generateCustodyPDF` no sanitiza inputs** (`ev.titulo`, `ev.descripcion`, `ev.hash`) — uso de `innerHTML` directo. Si un hash SHA-256 contiene `<script>`, podría ejecutarse. Mitigado parcialmente porque SHA-256 hex es seguro, pero títulos/descripciones vienen del usuario.
  - **Recomendación:** Usar `textContent` o `DOMPurify.sanitize()` antes de inyectar.
- ⚠️ **`exportToDocx` no tiene header/footer** ni numeración de páginas — `PageNumber` y `Header` se importan pero no se usan
- ⚠️ **`exportToExcel` aplica estilo solo a header row, no a data rows** — solo aplica el estilo si `ws[addr]` existe (puede haber celdas vacías)

- **Estado:** 🟡 **Funcional con riesgos de seguridad y mantenimiento**

---

### 4.2 `logger.js` (`src/utils/logger.js`)

- **Propósito:** Wrapper minimalista sobre `console` para evitar logs en producción.
- **API:**
  ```js
  logger.error(...args)   // Solo en DEV
  logger.warn(...args)    // Solo en DEV
  logger.info(...args)    // Solo en DEV
  logger.debug(...args)   // Solo en DEV
  ```
- **Aspectos técnicos:**
  - ✅ Usa `import.meta.env.DEV` (Vite 7) — strip en build de producción
  - ✅ Cumple regla de no exponer PII en consola de producción
  - ⚠️ **No envia logs a servicio externo** (Sentry, Datadog) — si hay error en producción, no hay trazabilidad
  - ⚠️ **No incluye contexto** (timestamp, correlation ID, user ID)
  - ⚠️ **No hay niveles configurables** — todo es "isDev check"

- **Estado:** ✅ **Adecuado para MVP, insuficiente para escala producción**

---

### 4.3 `utf8.js` (`src/utils/utf8.js`)

- **Propósito:** Corrección de mojibake UTF-8 (común cuando el backend lee UTF-8 como Latin-1).
- **API:**
  ```js
  fixUtf8Mojibake(text: string): string
  ```
- **Algoritmo:**
  1. Detecta caracteres sospechosos (`Ã`, `�`)
  2. Convierte cada char a byte (`& 0xff`)
  3. Decodifica con `TextDecoder('utf-8')`
- **Aspectos técnicos:**
  - ✅ **10 líneas, una sola función pura** — fácil de testear y mantener
  - ✅ Manejo defensivo: try/catch, return original si falla
  - ✅ **Usado en `TenantContext.tsx`** para corregir nombres de usuario y organización
  - ⚠️ **No test unitario** — solo verificado manualmente

- **Estado:** ✅ **Funcional y bien diseñado**

---

### 4.4 `index.js` (`src/utils/index.js`) — Barrel de utilidades

- **Propósito:** Barrel export de helpers puros (sin side effects).
- **20 funciones + 5 re-exports de `documents.js`**

#### Categorías

| Categoría | Funciones |
|-----------|-----------|
| **Fechas** | `formatDate`, `formatDateShort`, `timeAgo`, `countdownTo` |
| **Expedientes** | `formatExpNum`, `genExpNum` (formato peruano `00147-2024-0-1801-JR-CI-01`) |
| **Texto** | `truncate`, `capitalize`, `titleCase`, `highlightMatches` |
| **Números** | `formatPEN` (PEN con `Intl.NumberFormat('es-PE')`), `formatNumber` |
| **DOM/UI** | `uid`, `copyToClipboard`, `downloadText` |
| **Arrays** | `groupBy`, `uniqueBy` |
| **Validaciones** | `isValidEmail`, `isValidCAL` (5-6 dígitos) |
| **Re-exports** | `exportToPDF`, `exportToExcel`, `exportToDocx`, `generateLegalPDF`, `generateCustodyPDF` |

#### Hallazgos

- ⚠️ **`uid()` usa `Math.random()`** — NO criptográficamente seguro. OK para IDs de DOM, NO para tokens ni IDs de entidades.
- ⚠️ **`copyToClipboard` retorna boolean pero NO mensaje de error** — UX debugging difícil
- ⚠️ **`isValidCAL` es muy laxa** — solo 5-6 dígitos. CAL peruano tiene reglas más estrictas (prefijo por región)
- ⚠️ **`countdownTo` retorna objeto `{ label, urgency }`** pero algunas funciones retornan string — **inconsistencia de API** (debería ser siempre objeto o siempre string)
- ⚠️ **`highlightMatches` con `query` regex unsafe** — escapa correctamente pero `regex.test(part)` se llama 2 veces (split + map)
- ⚠️ **No hay tests unitarios** para ninguna de las 20 funciones puras — cobertura = 0%

- **Estado:** ✅ **Funcional, falta cobertura de tests**

---

## 5. Constants (`src/constants/index.js`)

- **Propósito:** Fuente única de verdad para roles, materias, estados, instancias, planes, etc.
- **9 grupos de constantes exportadas**

#### Roles

```js
ROLES       = { ABOGADO, FISCAL, JUEZ, CONTADOR }
ROL_LABELS  = { ABOGADO: 'Abogado Litigante', ... }
ROL_COLORS  = { ABOGADO: 'blue', ... }
```

#### Materias legales (8)

```js
MATERIAS = [
  { value: 'PENAL', label: 'Penal', color: 'red' },
  { value: 'CIVIL', label: 'Civil', color: 'blue' },
  // ... 6 más
]
```

#### Estados de expedientes (5)

```js
EXPEDIENTE_STATUS = { ACTIVO, PENDIENTE, URGENTE, ARCHIVADO, RESUELTO }
STATUS_LABELS     // UI strings
STATUS_VARIANTS   // clases Tailwind
```

#### Instancias judiciales (4 grupos, 17 items)

- Primera Instancia (5), Segunda Instancia (4), Corte Suprema (5), Tribunal Constitucional (3)

#### Tipos de escrito legal (13)

- `DEMANDA`, `CONTESTACION`, `APELACION`, `CASACION`, `RECURSO_AMPARO`, `HABEAS_CORPUS`, `MEDIDA_CAUTELAR`, `ESCRITO_SIMPLE`, `REQUERIMIENTO`, `ACUSACION`, `SOBRESEIMIENTO`, `INFORME_PERICIAL`, `ALEGATO_CLAUSURA`

#### Otros

```js
TIMELINE_EVENT_TYPES = ['creacion', 'escrito', 'audiencia', 'resolucion', 'notificacion', 'documento']
PLANES               = { FREE: 5 exp / 10 IA, PRO: 100 exp / 500 IA, ENTERPRISE: -1 (ilimitado) }
FUENTES_JURISPRUDENCIA = [PJ, TC, INDECOPI, SUNARP, MINJUS]
PAGE_SIZES           = [10, 25, 50, 100]
DEFAULT_PAGE_SIZE    = 25
```

#### 🔴 **HALLAZGO: Drift en `STORAGE_KEYS`**

```js
// src/constants/index.js (líneas 142-149)
STORAGE_KEYS = {
  TOKEN:             'legalpro_token',              // ⚠️ NO usado en código principal
  SIDEBAR_COLLAPSED: 'legalpro_sidebar_collapsed',  // ⚠️ INCONSISTENCIA
  TOUR_COMPLETED:    'legalpro_tour_completed',
  THEME:             'legalpro_theme',
  LAST_ROUTE:        'legalpro_last_route',
  FILTER_STATE:      'legalpro_filter_state',
};
```

**Inconsistencias detectadas (grep):**

1. **`STORAGE_KEYS.TOKEN` (`legalpro_token`)** — definido pero el código principal **NO lo usa** (auth via HttpOnly cookie). Solo aparece en:
   - `Landing.jsx:12` → `localStorage.getItem('legalpro_token')` �️ **viola regla OWASP**
   - `Landing.jsx:21` → `localStorage.removeItem('legalpro_token')`
   - `SetupOrganizacion.jsx:261` → `localStorage.removeItem('legalpro_token')`

2. **`STORAGE_KEYS.SIDEBAR_COLLAPSED` (`legalpro_sidebar_collapsed`)** — definido pero `UIContext.tsx` usa **`'lp_sidebar'`** (líneas 56, 62) — **NO coincide**

**Recomendación:**
- Eliminar `STORAGE_KEYS.TOKEN` (ya no aplica)
- Corregir `UIContext.tsx` para usar `STORAGE_KEYS.SIDEBAR_COLLAPSED`
- Auditar `Landing.jsx` y `SetupOrganizacion.jsx` para eliminar referencias a `legalpro_token`

- **Estado:** � **Drift detectado, requiere limpieza**

---

## 6. Types (`src/types/index.ts`)

- **Propósito:** Interfaces TypeScript compartidas para tipado estricto en todo el frontend.
- **11 interfaces exportadas:**

| Interface | Uso |
|-----------|-----|
| `Usuario` | User de `TenantContext` |
| `Organizacion` | Org del tenant (con plan, límites, isOrgAdmin) |
| `TenantState` | Estado completo del tenant |
| `LoginResult` | Retorno de `login()` |
| `TenantContextType` | Tipo del context (extends `TenantState` + métodos) |
| `ToastItem` | Item individual de toast |
| `ToastOptions` | Opciones de toast |
| `AddToastInput` | Input de `addToast()` |
| `ConfirmModalState` | Estado del modal de confirmación |
| `UIContextType` | Tipo del UIContext |
| `Caso` | Modelo de expediente/caso |

#### Aspectos técnicos

- ✅ **TypeScript estricto** — todo opcional marcado con `?`, nullable con `| null`
- ✅ Consistencia con `TenantContext` y `UIContext` (todos los campos están reflejados)
- ⚠️ **`TenantContextType.logout` está tipado como `() => void`** pero la implementación retorna `Promise<void>` (drift menor)
- ⚠️ **No hay tipos para:** `Expediente`, `Documento`, `Cliente`, `Escrito`, `Audiencia` (entidades de dominio) — están como `any` en `api/client.ts`
- ⚠️ **No hay tests de tipos** (`tsc --noEmit` en CI sería ideal)

- **Estado:** ✅ **Adecuado para contextos, falta cobertura de dominio**

---

## 📊 Hallazgos Consolidados

### 🔴 Críticos (Bloqueantes)

| # | Archivo | Hallazgo | Acción |
|---|---------|----------|--------|
| 1 | `Layout.jsx` | `ConfirmModal` NO está montado | Agregar `<ConfirmModal />` después de `<ToastContainer />` |

### 🟡 Importantes (Drift / Inconsistencias)

| # | Archivos | Hallazgo | Acción |
|---|----------|----------|--------|
| 2 | `Landing.jsx:12,21`, `SetupOrganizacion.jsx:261` | Uso de `localStorage` para JWT (viola OWASP) | Eliminar referencias a `legalpro_token` |
| 3 | `constants/index.js` ↔ `UIContext.tsx` | `STORAGE_KEYS.SIDEBAR_COLLAPSED` (`legalpro_sidebar_collapsed`) ≠ `'lp_sidebar'` usado | Estandarizar usando constante |
| 4 | `documents.js` | Disclaimer IA hardcodeado en 3 lugares | Extraer a `constants/disclaimers.js` desde catalogs |
| 5 | `documents.js` (`generateCustodyPDF`) | Inyección de HTML sin sanitizar | Usar `DOMPurify.sanitize()` o `textContent` |
| 6 | `client.ts:65-79` | Auto-refresh nunca se dispara (REFRESH_TOKEN siempre `''`) | Implementar refresh con cookie HttpOnly o eliminar dead code |

### 🟢 Menores (Mejoras)

| # | Archivos | Hallazgo | Acción |
|---|----------|----------|--------|
| 7 | `useSeo.js` | JSDoc menciona `keywords` pero no implementado | Actualizar JSDoc o implementar |
| 8 | `utils/index.js` | `countdownTo` retorna objeto, otros string | Estandarizar API |
| 9 | `utils/index.js` | `uid()` usa `Math.random()` (no crypto-safe) | Documentar limitación |
| 10 | `types/index.ts` | `logout` tipado `() => void` pero retorna `Promise<void>` | Corregir tipo |
| 11 | `api/client.ts` | Helpers legacy sin tests (`login`, `listarExpedientes`, etc.) | Agregar tests |
| 12 | `hooks/index.js` | Barrel vacío | Eliminar archivo |

---

## ✅ Resumen Final

### Estado por categoría

| Categoría | Total archivos | ✅ Funciona | 🟡 Con drift | � Crítico |
|-----------|----------------|-------------|--------------|------------|
| Hooks | 2 | 2 | 0 | 0 |
| Contexts | 2 | 1 | 0 | 1 |
| API Client | 2 | 2 | 0 | 0 |
| Utils | 4 | 3 | 1 | 0 |
| Constants | 1 | 0 | 1 | 0 |
| Types | 1 | 1 | 0 | 0 |
| **TOTAL** | **13** | **9 (69%)** | **3 (23%)** | **1 (8%)** |

### Métricas

- **Total hooks personalizados:** 1 (`useSeo`)
- **Total contexts:** 2 (`TenantContext`, `UIContext`)
- **Total utils exportados:** 25 (20 propios + 5 re-exports)
- **Total constants:** 9 grupos
- **Total interfaces TS:** 11
- **Total funciones API:** 28
- **Total tests:** 12 bloques (100% pass en cobertura actual)
- **Pendientes críticos:** 1 (bloqueante)
- **Pendientes importantes:** 5
- **Pendientes menores:** 6

### 🎯 Acción inmediata recomendada

**PRIORIDAD 1 (5 min, bloqueante):**
```jsx
// src/components/Layout.jsx línea 79, agregar:
<ConfirmModal />
```

**PRIORIDAD 2 (30 min):**
- Eliminar referencias a `localStorage('legalpro_token')` en `Landing.jsx` y `SetupOrganizacion.jsx`
- Corregir `STORAGE_KEYS.SIDEBAR_COLLAPSED` para que coincida con `UIContext.tsx`

**PRIORIDAD 3 (2h):**
- Centralizar disclaimers IA en un solo archivo
- Sanitizar inputs en `generateCustodyPDF`
- Agregar tests para utils puros (formatters, validators)
- Agregar tests para helpers legacy de `api/client.ts`

---

## 📎 Anexo: Archivos Auditados (Hash de Inventario)

| # | Ruta | Líneas | Estado |
|---|------|--------|--------|
| 1 | `src/hooks/useSeo.js` | 54 | ✅ |
| 2 | `src/hooks/index.js` | 2 | ✅ Vacío |
| 3 | `src/context/TenantContext.tsx` | 172 | ✅ |
| 4 | `src/context/UIContext.tsx` | 84 | 🟡 |
| 5 | `src/api/client.ts` | 494 | ✅ |
| 6 | `src/api/__tests__/client.helpers.test.js` | 343 | ✅ |
| 7 | `src/utils/documents.js` | 276 | ✅ |
| 8 | `src/utils/logger.js` | 16 | ✅ |
| 9 | `src/utils/utf8.js` | 10 | ✅ |
| 10 | `src/utils/index.js` | 245 | ✅ |
| 11 | `src/constants/index.js` | 149 | 🟡 |
| 12 | `src/types/index.ts` | 103 | ✅ |
| 13 | `src/components/modals/ConfirmModal.jsx` | 181 | 🟡 (no montado) |
| 14 | `src/components/Layout.jsx` | 86 | 🔴 (falta ConfirmModal) |

**Total líneas auditadas:** ~2,131

---

> **Auditoría completada.** Pendiente ejecutar acción PRIORIDAD 1 para desbloquear `useUI().confirm()`.
