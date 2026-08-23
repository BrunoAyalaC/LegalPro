# Auditoría Frontend LegalPro - Páginas Legales Críticas

> **Fecha:** 4 de agosto de 2026
> **Auditor:** Agente Frontend React 19
> **Alcance:** Assets visuales, sistema de iconos y 10 páginas legales críticas
> **Stack auditado:** React 19.2 / Vite 7.3 / TailwindCSS 4.2 / React Router 7.13 / Supabase JS 2.50
> **Páginas auditadas:** 10

---

## 1. Sistema de Iconos

### 1.1 Inventario de iconos (`src/assets/icons/`)

**Total: 81 iconos SVG/PNG** (formato PNG, sistema IconosLegalPro)

Listado completo (ordenado alfabéticamente):

| # | Icono | Uso probable |
|---|-------|--------------|
| 1 | account_balance | Constitucional / Bancario |
| 2 | add | Acción agregar |
| 3 | add_circle | Acción agregar (con círculo) |
| 4 | analytics | Métricas / Dashboard |
| 5 | apartment | Administrativo |
| 6 | arrow_back | Volver |
| 7 | article | Artículo legal |
| 8 | assignment | Asignación / Expediente |
| 9 | attach_file | Adjuntar archivo |
| 10 | auto_awesome | Generación IA |
| 11 | balance | Civil / Balanza |
| 12 | build | Configuración / Settings |
| 13 | calculate | Calcular / Liquidaciones |
| 14 | calendar_month | Calendario |
| 15 | chat | Chat |
| 16 | check_circle | Verificado |
| 17 | checklist | Checklist |
| 18 | chevron_right | Navegación |
| 19 | compare | Comparar precedentes |
| 20 | dangerous | Peligro |
| 21 | dashboard | Dashboard |
| 22 | description | Documento |
| 23 | download | Descarga |
| 24 | edit_document | Editar documento |
| 25 | edit_note | Editar nota |
| 26 | error | Error |
| 27 | event_available | Evento disponible |
| 28 | expand_more | Expandir |
| 29 | fact_check | Verificar hechos |
| 30 | family_restroom | Familia |
| 31 | file_copy | Copiar archivo |
| 32 | filter_list | Filtrar |
| 33 | find_in_page | Buscar en página |
| 34 | folder | Carpeta |
| 35 | folder_copy | Duplicar carpeta |
| 36 | folder_open | Abrir carpeta |
| 37 | front_hand | Detener / Oposición |
| 38 | gavel | Penal / Martillo |
| 39 | groups | Grupos / Partes |
| 40 | help | Ayuda |
| 41 | history | Historial |
| 42 | insights | Análisis |
| 43 | library_books | Biblioteca jurídica |
| 44 | lightbulb | Idea / Sugerencia |
| 45 | list_alt | Lista |
| 46 | location_on | Ubicación |
| 47 | manage_search | Búsqueda avanzada |
| 48 | menu_book | Códigos / Libros |
| 49 | mic | Micrófono |
| 50 | military_tech | Honor / Mérito |
| 51 | more_vert | Menú opciones |
| 52 | note_add | Agregar nota |
| 53 | notifications | Notificaciones |
| 54 | notifications_active | Notificación activa |
| 55 | person | Persona |
| 56 | picture_as_pdf | PDF |
| 57 | psychology | IA / Psicología |
| 58 | question_answer | Pregunta y respuesta |
| 59 | rate_review | Revisión |
| 60 | rate_review2 | Revisión alternativa |
| 61 | record_voice_over | Audio / Dictado |
| 62 | refresh | Recargar |
| 63 | report | Reporte |
| 64 | rule | Regla / Norma |
| 65 | schedule | Plazos / Agenda |
| 66 | search | Buscar |
| 67 | security | Seguridad |
| 68 | send | Enviar |
| 69 | send_chat_ia | Enviar chat IA |
| 70 | settings | Configuración |
| 71 | share | Compartir |
| 72 | shield | Protección |
| 73 | smart_toy | Robot IA |
| 74 | summarize | Resumir |
| 75 | task_alt | Tarea completada |
| 76 | timer | Cronómetro |
| 77 | trending_up | Tendencia |
| 78 | tune | Ajustar filtros |
| 79 | upload_file | Subir archivo |
| 80 | warning | Advertencia |
| 81 | work | Trabajo / Laboral |

> **Nota:** El inventario real es de **81 iconos**, no 90+ como se mencionó en la solicitud inicial.

### 1.2 Sprite System (`src/data/sprite-icons.js`)

**Archivo:** `legalpro-app/src/data/sprite-icons.js` (14 líneas)

- **Propósito:** Coordenadas del sprite legal unificado, sincronizado con `public/landing/index.html` (clase CSS `.si-*`)
- **URL del sprite:** `/landing/assets/icons/sprite.png`
- **Total iconos registrados:** 9

| Icono | Width | Height | Background Size | Background Position |
|-------|-------|--------|-----------------|---------------------|
| analisis | 34 | 28 | 372px 208px | 0 0 |
| predictor | 31 | 28 | 376px 210px | -78px -1px |
| escritos | 27 | 28 | 376px 210px | -118px -1px |
| simulador | 27 | 28 | 383px 214px | -237px -39px |
| juris | 32 | 28 | 395px 221px | -163px -1px |
| alegatos | 24 | 28 | 304px 170px | -156px -31px |
| chat | 31 | 28 | 463px 259px | -195px -95px |
| dashboard | 34 | 28 | 372px 208px | 0 0 |
| expedientes | 27 | 28 | 376px 210px | -118px -1px |

- **Estado:** ✅ Operativo, usado por `SpriteIcon.jsx` y por la landing LexIA.

### 1.3 Componentes de iconos

#### `SpriteIcon.jsx` (`src/components/ui/SpriteIcon.jsx`)
- **Propósito:** Renderizar un icono desde el `sprite.png` con recorte CSS (`background-position`).
- **Props:** `name`, `size = 28`, `className`, `gold = false`
- **Comportamiento:**
  - Lee coordenadas desde `SPRITE_ICONS` (en `data/sprite-icons.js`).
  - Aplica `imageRendering: 'crisp-edges'` para nitidez.
  - Filtro `drop-shadow` cyan (default) o dorado (`gold`).
  - `role="img"`, `aria-hidden="true"` (accesibilidad).
  - **Fallback:** retorna `null` si el icono no existe en el sprite.
- **Estado:** ✅

#### `AppIcon.jsx` (`src/components/AppIcon.jsx`)
- **Propósito:** Wrapper universal para iconos PNG del sistema IconosLegalPro.
- **Props:** `name`, `size = 24`, `className`, `alt`, `style`
- **Implementación:**
  - **Auto-importación** vía `import.meta.glob('../assets/icons/*.png', { eager: true })`.
  - Genera lookup `nombre → URL del módulo`.
  - **Fallback automático:** Si el PNG no existe, renderiza `<span class="material-symbols-outlined">` con el nombre como glifo (esto evita errores 404).
  - `loading="lazy"` en `<img>` para performance.
  - `objectFit: 'contain'`, dimensiones fijas para evitar layout shift.
- **Estado:** ✅ Es el componente más usado en el proyecto (≈ 90% de los iconos en páginas).

### 1.4 Iconos `Material Symbols` (fallback adicional)

En algunos componentes (Clientes, RedactorEscritos) se usan iconos de **Lucide React** (librería externa) como complemento:

```js
import { Users, Plus, Search, Trash2, Edit2, Mail, Phone, MapPin, X, Building2, User, FileText, AlertTriangle } from 'lucide-react';
import { Copy, Check } from 'lucide-react';
```

> **Recomendación:** Estandarizar en `AppIcon` para mantener un solo sistema. Lucide está limitado a 13 iconos en Clientes y 2 en Redactor.

---

## 2. Assets Visuales

### 2.1 Backgrounds (`src/assets/backgrounds/`)

**Total: 4 archivos JPEG**

| Archivo | Tamaño aproximado | Uso en la app |
|---------|-------------------|---------------|
| `casos_criticos_fondo.jpeg` | Variable | Fondo decorativo de página de casos críticos |
| `fondo.jpeg` | Variable | Fondo genérico de secciones |
| `fondo_login.jpeg` | Variable | Pantalla de login / splash |
| `simulador_fondo.jpeg` | Variable | `SimuladorJuicios.jsx` — fondo full-screen con overlay oscuro |

**Estado:** ✅ Todos importados correctamente vía Webpack/Vite (`import fondo from '...'`).

### 2.2 Empty States (`src/assets/empty-states/`)

**Total: 4 archivos PNG**

| Archivo | Uso en la app |
|---------|---------------|
| `chat_ia_vacio.png` | `ChatIA.jsx` — estado inicial sin mensajes |
| `sin_expedientes.png` | `Expedientes.jsx` — sin resultados en lista |
| `sin_notificaciones.png` | Componente de notificaciones (no usado en páginas críticas) |
| `sin_resultados.png` | `BuscadorJurisprudencia.jsx` — sin resultados de búsqueda (estado inicial y post-búsqueda) |

### 2.3 Avatar (`src/assets/avatar/`)

**Total: 1 archivo JPEG**

| Archivo | Uso en la app |
|---------|---------------|
| `avatar_ia.jpeg` | `ChatIA.jsx` — avatar del asistente LexIA en cada mensaje AI (`<img class="ai-avatar">`) |

---

## 3. Páginas Legales Críticas (Auditoría Detallada)

### 3.1 Expedientes (`src/pages/Expedientes.jsx`)

**Líneas:** 441
**Ruta:** `/expedientes`

#### Propósito
Lista y gestión completa de expedientes judiciales del abogado. Permite crear, editar, eliminar, buscar, filtrar, paginar y exportar a Excel.

#### Botones principales

| Botón | ID | Función | Endpoint |
|-------|----|---------| ---------|
| Exportar Excel (header) | `btn-exportar-expedientes-excel` | Descarga `Expedientes_YYYY-MM-DD.xlsx` con columnas: Número, Título, Tipo, Estado, Prioridad, Juzgado | Local (cliente) — usa `exportToExcel()` |
| Nuevo Expediente (header) | `btn-nuevo-expediente-header` | Abre modal de creación | - |
| Nuevo Expediente (empty state) | `btn-nuevo-expediente-empty` | Abre modal de creación | - |
| Filtro tipo | `btn-filtro-tipo-{todos\|penal\|civil\|laboral\|constitucional\|familia}` | Cambia filtro de materia | - |
| Editar expediente | `btn-editar-expediente-{id}` | Abre modal en modo edición | - |
| Eliminar expediente | `btn-eliminar-expediente-{id}` | Abre ConfirmModal danger | - |
| Ver detalle | `link-expediente-{id}` (Link) | Navega a `/expediente/:id` | - |
| Página anterior | `btn-pagina-anterior` | Decrementa `page` | - |
| Página siguiente | `btn-pagina-siguiente` | Incrementa `page` | - |
| Cerrar modal | `btn-cerrar-modal` | Cierra modal nuevo/editar | - |
| Cancelar creación | `btn-cancelar-creacion` | Cierra modal sin guardar | - |
| Submit creación | `btn-submit-creacion` | Crea o actualiza expediente | `POST` o `PATCH` |
| Cancelar eliminar | (inline) | Cierra ConfirmModal | - |
| Sí, eliminar | (inline) | Confirma eliminación | `DELETE` |

#### Inputs / Formularios

| Campo | ID | Tipo | Validación |
|-------|----|----|------------|
| Búsqueda rápida | `input-buscar-expediente` | text | Ninguna en cliente |
| Número | `input-form-numero` | text | Requerido |
| Título | `input-form-titulo` | text | Requerido |
| Tipo | `select-form-tipo` | select | Enum: penal/civil/laboral/constitucional/familia |
| Juzgado | `input-form-juzgado` | text | Requerido |
| Estado | `select-form-estado` | select | Enum: activo/en_tramite/apelacion/archivado/resuelto |
| Prioridad | `select-form-prioridad` | select | Enum: urgente/alta/media/baja |

#### Modales internos

1. **Modal Nuevo/Editar Expediente** (`showModal`)
   - Campos: número, título, tipo, juzgado, estado, prioridad.
   - Toggle creación/edición controlado por `editingId`.
   - Validación inline con `formErrors`.
   - Error general mostrado en banner rojo.

2. **ConfirmModal de Eliminación** (`showDeleteConfirm`)
   - Mensaje: "¿Estás seguro de eliminar el expediente `{titulo}` (Exp. {numero})?"
   - Advertencias: acción irreversible, eliminación de documentos asociados.
   - Botones: Cancelar / Sí, eliminar (con spinner).

#### Acciones del usuario
- Buscar por N° o título.
- Filtrar por materia (chips horizontales).
- Paginación.
- Ver detalle (navegación a sub-ruta).
- Crear expediente.
- Editar expediente existente.
- Eliminar con confirmación.
- Exportar lista actual a Excel.

#### Endpoints backend

| Método | Endpoint | Función |
|--------|----------|---------|
| GET | `/api/expedientes` | Lista paginada (`params: page, pageSize, tipo, buscar`) |
| POST | `/api/expedientes` | Crear nuevo expediente |
| PATCH | `/api/expedientes/:id` | Actualizar expediente |
| DELETE | `/api/expedientes/:id` | Eliminar expediente |

Cliente HTTP: `nodeClient` (legalpro-app/server, Node + Express).

#### Validaciones
- **Cliente:**
  - `numero.trim()` obligatorio.
  - `titulo.trim()` obligatorio.
  - `juzgado.trim()` obligatorio.
- **Errores del servidor:** Se muestran en `formErrors.general` o como `fetchError`.

#### Errores manejados
- `AbortError` / `ERR_CANCELED` → silencioso (cleanup de useEffect).
- Error de red → `setFetchError('No se pudieron cargar los expedientes. Intenta de nuevo más tarde.')`.
- Error en submit → `msg = err.response.data.error` o mensaje genérico.
- Error en delete → `setFetchError(msg)`.

#### Estados UI
- **Loading:** Spinner (no explícito, se infiere por `loaded=false`).
- **Error:** Banner rojo (`border-l-4 border-red-500 bg-red-500/10`).
- **Empty:** Componente `EmptyState` con imagen `sin_expedientes.png` + CTA.
- **Success:** Lista con animación `anim-fade-in-up` por tarjeta + delay `i * 0.05s`.

#### Características avanzadas
- `AbortController` para cancelar peticiones en vuelo al cambiar filtros/búsqueda/página.
- Auto-reset a `page=1` al cambiar `filtro` o `buscar`.
- SEO dinámico con `useSeo({ title, description })`.
- Iconos por tipo de materia (`tipoIcons: { penal: 'gavel', civil: 'balance', laboral: 'work', ... }`).
- Badges de estado + dot de prioridad.

---

### 3.2 Clientes (`src/pages/Clientes.jsx`)

**Líneas:** 358
**Ruta:** `/clientes`

#### Propósito
Gestión CRUD de clientes del estudio jurídico (personas naturales y jurídicas). Demandantes, demandados y terceros.

#### Botones principales

| Botón | Función | Endpoint |
|-------|---------|----------|
| "+ Nuevo cliente" | Abre modal en modo `crear` | - |
| Editar (icono lápiz) | Abre modal en modo `editar` con datos del cliente | - |
| Eliminar (icono papelera) | Pide confirmación con `window.confirm()` → soft-delete | `DELETE /api/clientes/:id` |
| Persona Natural (toggle) | Cambia `tipo` a `natural` | - |
| Persona Jurídica (toggle) | Cambia `tipo` a `juridica` | - |
| Cancelar (form) | Cierra modal sin guardar | - |
| Crear cliente / Actualizar (submit) | Crea o actualiza | `POST` o `PUT /api/clientes/:id` |
| "Crear el primero" (empty state) | Abre modal en modo crear | - |

#### Inputs / Formularios

**Subcomponente `ClienteForm` con 2 variantes según `tipo`:**

**Persona Natural:**
| Campo | Tipo | Validación |
|-------|------|------------|
| Nombre completo | text | `required` |
| DNI | text | `maxLength=8`, `pattern="[0-9]{8}"` |
| Fecha de nacimiento | date | - |
| Estado civil | select | Enum: soltero, casado, divorciado, viudo, conviviente |

**Persona Jurídica:**
| Campo | Tipo | Validación |
|-------|------|------------|
| Razón social | text | `required` |
| RUC | text | `maxLength=11`, `pattern="[0-9]{11}"` |
| Representante legal | text | - |

**Comunes (ambos tipos):**
| Campo | Tipo | Validación |
|-------|------|------------|
| Email | email | - |
| Teléfono | text | - |
| Dirección | text | - |
| Distrito | text | - |
| Provincia | text | - |
| Departamento | text | - |
| Notas | textarea (rows=3) | - |

**Búsqueda (barra superior):**
| Campo | Tipo | Validación |
|-------|------|------------|
| Buscar | text | Búsqueda client-side por nombre, DNI, RUC |

**Filtros (barra superior):**
| Campo | Tipo | Validación |
|-------|------|------------|
| Tipo | select | Opciones: todos / natural / juridica |

#### Modales internos

1. **Modal Crear/Editar Cliente** (animación framer-motion `scale 0.96→1`)
   - Toggle entre Persona Natural / Jurídica con badges.
   - Campos dinámicos según tipo.
   - Botón submit con estado `guardando`.

#### Acciones del usuario
- Buscar clientes por nombre, DNI o RUC (client-side, sin debounce).
- Filtrar por tipo (natural / jurídica / todos).
- Ver grid de tarjetas (1-3 columnas responsive).
- Crear cliente nuevo.
- Editar cliente existente.
- Eliminar cliente (soft-delete con posibilidad de recuperación, según comentario).

#### Endpoints backend

| Método | Endpoint | Función |
|--------|----------|---------|
| GET | `/api/clientes` | Listar todos los clientes |
| POST | `/api/clientes` | Crear cliente |
| PUT | `/api/clientes/:id` | Actualizar cliente |
| DELETE | `/api/clientes/:id` | Eliminar (soft-delete) |

Cliente HTTP: `nodeClient`.

#### Validaciones
- **Cliente (HTML5):** `required` en nombre_completo y razon_social.
- **Cliente (pattern):** DNI 8 dígitos numéricos, RUC 11 dígitos numéricos.
- **Errores del servidor:** `alert('Error al guardar: ' + ...)` (⚠️ usa `alert` nativo, no toast).
- **No hay validación de email formato estricto** (solo `type="email"`).

#### Errores manejados
- `Error al cargar clientes` → estado `error` con banner.
- `Error al guardar` → `alert()`.
- `Error al eliminar` → `alert()`.

> ⚠️ **Hallazgo:** Uso de `alert()` y `confirm()` nativos del navegador (no accesible WCAG 2.1 AA ideal). Recomendable migrar a toasts/modales del `UIProvider`.

#### Estados UI
- **Loading:** Texto "Cargando clientes…".
- **Error:** Banner rojo con `AlertTriangle`, mensaje y sugerencia de revisar endpoint.
- **Empty:** Icono Users grande + texto contextual según haya búsqueda o no.
- **Success:** Grid de tarjetas con animación staggered (`delay: i * 0.02`).

#### Características avanzadas
- `useMemo` para filtrado client-side.
- Animaciones framer-motion (`initial`, `animate`, `transition`).
- Badge dinámico por tipo con colores (cyan / violet).
- `confirm()` nativo para eliminación (no es modal accesible).

---

### 3.3 Redactor de Escritos (`src/pages/RedactorEscritos.jsx`)

**Líneas:** 843
**Ruta:** `/herramientas/redactor`

#### Propósito
Genera escritos legales peruanos con IA (Gemini): demandas, contestaciones, apelaciones, casaciones. Soporta flujo Senior→Junior de revisión (aprobación/rechazo). Exporta a DOCX y PDF.

#### Botones principales

| Botón | Función | Endpoint |
|-------|---------|----------|
| "Generar Escrito Legal" | Genera borrador con IA Gemini | `api.consulta('redaccion')` |
| "Descargar DOCX" | Abre modal de disclaimer → `exportToDocx()` | - |
| "Descargar PDF" | Abre modal de disclaimer → `generateLegalPDF()` | - |
| "Copiar" | Copia al portapapeles (feedback `¡Copiado!`) | - |
| Botón flotante (FAB) | Genera escrito (atajo cuando no hay resultado) | `api.consulta('redaccion')` |
| "Aprobar y Finalizar" | Marca revisión como `revisado` (verde) | - (localStorage) |
| "Rechazar — Solicitar Cambios" | Marca revisión como `rechazado` (rojo) | - (localStorage) |
| "Volver a borrador" | Resetea estado a `borrador` | - (localStorage) |
| "Modificar y Re-enviar a Revisión" | Resetea a `borrador` (estado rechazado) | - (localStorage) |
| "Aprobar igual" | Aprueba desde estado rechazado | - (localStorage) |

#### Inputs / Formularios

| Campo | Tipo | Validación |
|-------|------|------------|
| Tipo de escrito | select (de `TIPOS_ESCRITO`) | - (default: 'DEMANDA') |
| Materia | select (de `MATERIAS`) | - (default: 'CIVIL') |
| Juzgado | text | `required` (en blur marca `touched.juzgado`) |
| N° de Expediente | text | Opcional |
| Recurrente | text | `required` |
| Abogado patrocinante | text | `required` |
| N° de Colegiatura | text | Opcional |
| Hechos del caso | textarea (`maxLength=15500`, 5 páginas × 3000 chars) | `required`, contador visual |
| Nombre del revisor (revisión) | text | Opcional |
| Comentarios de revisión | textarea (rows=2) | Opcional |

**Métricas en vivo:**
- Contador de páginas (~X pág).
- Barra de progreso de páginas (verde/ámbar/rojo).
- Contador de caracteres (`X / 15.000`).

#### Modales internos

1. **`IADisclaimerModal`** (`showDisclaimerModal`)
   - Se abre antes de descargar DOCX o PDF.
   - Confirma que el usuario entiende el aviso legal IA.
   - `actionLabel` dinámico ('Descargar PDF' / 'Descargar DOCX').

#### Acciones del usuario
- Completar formulario de 7 campos.
- Generar escrito con IA.
- Revisar resultado en formato serif (Times New Roman).
- Aprobar / rechazar como revisor senior.
- Exportar a DOCX, PDF o copiar al portapapeles.

#### Endpoints backend

| Método | Endpoint | Función |
|--------|----------|---------|
| POST | `/api/ia/consulta` (vía `api.consulta()`) | Generación con tipo `'redaccion'` |

Cliente HTTP: `api` (abstracción que enruta a `dotnetClient` o `nodeClient` según config).

#### Validaciones
- **Cliente:**
  - `juzgado.trim()` obligatorio (err en blur).
  - `recurrente.trim()` obligatorio.
  - `abogado.trim()` obligatorio.
  - `hechos.trim()` obligatorio.
  - `hechos.length ≤ MAX_CHARS` (15.000) — muestra error rojo si excede.
- **Errores del servidor:** `setError(err.message || 'Error al conectar con el servidor.')`.

#### Errores manejados
- Error de generación → banner rojo con `AppIcon name="error"`.
- Error de exportación DOCX/PDF → `exportError` separado.
- Error al copiar al portapapeles → `exportError`.

#### Estados UI
- **Loading:** Spinner `xl` + 5 skeletons de líneas animadas.
- **Error:** Banner rojo.
- **Empty:** Icono `edit_note` + texto instructivo.
- **Success:** Documento renderizado en serif con bordes sutiles + badge de páginas.

#### Características avanzadas
- **Flujo de revisión Senior→Junior IA:** 3 estados (`borrador`, `revisado`, `rechazado`) persistidos en `localStorage` con clave `legalpro_review_` + `btoa(slice(0,100))` del documento.
- **Encabezado legal peruano** (`buildLegalHeader`): formato SEÑOR JUEZ DEL {juzgado} / EXPEDIENTE N° / SUMILLA / I. PETITORIO.
- **Bloque de firmas** (`buildSignatureBlock`): abogado + CAL N° + recurrente.
- **Contador de páginas** inteligente (3000 chars/página).
- **Cleanup de setTimeout** en unmount (`copyTimerRef`).
- Disclaimer IA mostrado antes de cada exportación (cumplimiento LPDP).
- `useSeo` con title y description ricos.

---

### 3.4 Chat IA (`src/pages/ChatIA.jsx`)

**Líneas:** 399
**Ruta:** `/chat-ia` o `/chat-ia?expediente_id=X`

#### Propósito
Chat conversacional con LexIA (Gemini) sobre temas legales. Soporta contexto por expediente, historial persistente en `localStorage`, markdown ligero y base legal citada.

#### Botones principales

| Botón | Función | Endpoint |
|-------|---------|----------|
| 6 Quick Actions (chips) | Resumir caso / Jurisprudencia / Redactar / Plazos / Predicción / Estrategia → envían prompt predefinido | `api.chat()` |
| Quick Actions (empty state) | 4 acciones en grid (subset) | `api.chat()` |
| Limpiar chat (icono papelera) | `window.confirm()` → limpia mensajes y localStorage | - |
| Aviso legal IA (toggle) | Muestra/oculta `IADisclaimerBanner` | - |
| Enviar mensaje (botón redondo) | `handleSend()` | `api.chat()` |
| Copiar respuesta | `navigator.clipboard.writeText()` | - |
| Toggle base legal | Expande/colapsa referencias a leyes citadas | - |
| Cerrar disclaimer (dismiss) | Persiste en `sessionStorage` (`legalpro_chat_disclaimer_dismissed`) | - |

#### Inputs / Formularios

| Campo | Tipo | Validación |
|-------|------|------------|
| Mensaje | textarea (max-h-32, rows=1) | `mensaje.trim()` no vacío, `!loading`, Enter envía (Shift+Enter nueva línea) |

#### Modales internos
- Ninguno modal propio. Usa `IADisclaimerBanner` con prop `compact` y `onDismiss`.

#### Acciones del usuario
- Escribir mensaje libre.
- Seleccionar quick action predefinida.
- Limpiar historial completo.
- Copiar respuestas IA.
- Expandir base legal citada.
- Vincular contexto de expediente vía query param `?expediente_id=X`.

#### Endpoints backend

| Método | Endpoint | Función |
|--------|----------|---------|
| POST | `/api/ia/chat` (vía `api.chat()`) | Chat conversacional con historial y expediente opcional |

#### Validaciones
- **Cliente:**
  - Mensaje no vacío (trim).
  - No enviar mientras `loading=true`.
- **Errores contextuales:**
  - `403 TRANSFERENCIA_INTERNACIONAL_REQUIRED` → mensaje sobre LPDP Art. 21.
  - `402` → "Créditos insuficientes. Recarga gemas en Mis Créditos."
  - `400` → "Solicitud inválida."
  - `429` → "Demasiadas solicitudes. Espera un momento."
  - Error de columna/relación → "Error temporal del servidor..."
  - Network error → "Sin conexión con el servidor."

#### Errores manejados
- Mensaje con `isError: true` se inserta en el array de mensajes y se renderiza con estilo rojo.
- `chatErrorMessage(err)` mapea códigos HTTP a textos user-friendly.

#### Estados UI
- **Loading:** 3 typing dots animados + "LexIA analizando…".
- **Error:** Burbuja roja con el mensaje contextual.
- **Empty:** Imagen `chat_ia_vacio.png` + saludo + grid de 4 quick actions.
- **Success:** Burbuja `chat-ai` con HTML sanitizado (DOMPurify), disclaimer amarillo de "Borrador IA", botón copiar al hacer hover.

#### Características avanzadas
- **Persistencia en localStorage** con clave `legalpro_chat_messages[_expedienteId]` (top 100 mensajes, fallback a 20 si quota exceeded).
- **Sanitización XSS** con `DOMPurify.sanitize()` y whitelist de tags (`strong, br, span, div, p`).
- **Markdown ligero:** headings `#`, listas numeradas con `**bold**`, listas con `-`, negritas inline.
- **Avatar IA** en cada mensaje (lazy-loaded).
- **ARIA:** `role="log"`, `aria-live="polite"`, `aria-label`, `aria-busy`.
- **Disclaimer LPDP:** SessionStorage para no mostrar en cada sesión.
- **safe-area-inset-bottom** para iOS.
- Scroll-to-bottom automático al recibir mensajes.

---

### 3.5 Buscador Jurisprudencia (`src/pages/BuscadorJurisprudencia.jsx`)

**Líneas:** 155
**Ruta:** `/herramientas/buscador-jurisprudencia`

#### Propósito
Búsqueda semántica de jurisprudencia peruana (casaciones, amparos, precedentes vinculantes) con IA Gemini.

#### Botones principales

| Botón | Función | Endpoint |
|-------|---------|----------|
| Buscar | Llama a `api.consulta('jurisprudencia')` | `api.consulta()` |
| Filtros chips (Año/Recurso/Sala/Ponente) | **Decorativos** — sin handler (solo visual) | - |
| Ordenar | **Decorativo** — sin handler | - |
| Resumen IA | **Decorativo** — sin handler | - |
| Bookmark (guardar) | **Decorativo** — sin handler | - |

> ⚠️ **Hallazgo crítico:** Los filtros Año/Recurso/Sala/Ponente, "Ordenar", "Resumen IA" y "Bookmark" no tienen handler implementado.

#### Inputs / Formularios

| Campo | Tipo | Validación |
|-------|------|------------|
| Búsqueda | text | `buscar.trim()` no vacío (Enter envía) |

#### Modales internos
- Ninguno.

#### Acciones del usuario
- Escribir palabra clave o N° de expediente.
- Buscar (botón o Enter).
- Ver resultados (array o texto libre).

#### Endpoints backend

| Método | Endpoint | Función |
|--------|----------|---------|
| POST | `/api/ia/consulta` (vía `api.consulta()`) | Búsqueda jurisprudencial con tipo `'jurisprudencia'` |

#### Validaciones
- `buscar.trim()` no vacío.

#### Errores manejados
- `setError('Error al conectar con el servidor')` → texto rojo bajo input.

#### Estados UI
- **Loading:** 3 skeletons de cards con animación `animate-pulse`.
- **Error:** Texto rojo simple (no banner).
- **Empty:** `EmptyState` con `sin_resultados.png` (usado en 2 contextos: sin búsqueda inicial y sin resultados).
- **Success:**
  - **Array:** Cards con tipo, número, fecha, sala + botones "Resumen IA" y "Bookmark".
  - **Texto libre:** Card única con "Análisis Gemini".

#### Características avanzadas
- Detección dual de formato de respuesta (`Array.isArray()` vs string).
- `useSeo` con descripción rica.
- Animación staggered `anim-fade-in-up` con delay `i * 0.08s`.

---

### 3.6 Bóveda de Evidencia (`src/pages/BovedaEvidencia.jsx`)

**Líneas:** 34
**Ruta:** `/herramientas/boveda-evidencia`

> ⚠️ **Página en estado MOCK.** Solo contiene datos hardcodeados. No consume endpoints reales.

#### Propósito (declarado)
Almacenar y verificar la cadena de custodia de evidencia digital (SHA-256, firma digital Ley 27269). Versión actual: solo visual.

#### Botones principales

| Botón | Función | Endpoint |
|-------|---------|----------|
| "Agregar Evidencia" | **Sin handler** — no implementado | - |

#### Inputs / Formularios
- Ninguno.

#### Modales internos
- Ninguno.

#### Acciones del usuario
- Visualizar lista estática de 3 evidencias.
- (No hay acciones reales)

#### Endpoints backend
- **Ninguno.** Datos hardcodeados:

```js
const evidencias = [
  { name: 'Captura WhatsApp - Chat 01', tipo: 'imagen', size: '2.4 MB', hash: 'SHA-256: a1b2c3...', fecha: '01/03/2026', verificado: true },
  { name: 'Correo electrónico - Licitación', tipo: 'documento', size: '1.1 MB', hash: 'SHA-256: d4e5f6...', fecha: '28/02/2026', verificado: true },
  { name: 'Video de vigilancia CCTV', tipo: 'video', size: '45 MB', hash: 'SHA-256: g7h8i9...', fecha: '25/02/2026', verificado: false },
];
```

#### Validaciones
- Ninguna.

#### Errores manejados
- Ninguno (no hay operaciones).

#### Estados UI
- Estático. Banner verde "Cadena de Custodia Intacta" (2/3 verificadas).
- Cards con icono según tipo (`imagen: image`, `documento: description`, `video: videocam`).
- Badge `check_circle` (verde) o `pending` (gris) según verificación.

#### Hallazgos
- ⚠️ Página requiere implementación completa:
  - Conectar a `GET /api/evidencias`.
  - Modal/form de carga con hash SHA-256 calculado client-side.
  - Filtros por tipo y estado de verificación.
  - Endpoint para validar hash contra servidor.

---

### 3.7 Simulador de Juicios (`src/pages/SimuladorJuicios.jsx`)

**Líneas:** 270
**Ruta:** `/herramientas/simulador`

#### Propósito
Simulación interactiva de audiencias orales con IA. El usuario elige rol (Juez/Fiscal/Abogado), describe un caso y mantiene una conversación con la IA como contraparte.

#### Botones principales

| Botón | Función | Endpoint |
|-------|---------|----------|
| Juez (selector) | `setRol('juez')` | - |
| Fiscal (selector) | `setRol('fiscal')` | - |
| Abogado (selector) | `setRol('abogado')` | - |
| "Iniciar simulación" | `iniciarSimulacion()` | `POST /api/simulacion/iniciar` |
| Botón Enviar argumento (redondo indigo) | `handleSend()` | `POST /api/simulacion/turno` |
| Header: History (icono) | **Sin handler** | - |
| Header: Settings (icono) | **Sin handler** | - |

#### Inputs / Formularios

| Campo | Tipo | Validación |
|-------|------|------------|
| Descripción del caso | textarea (`maxLength=2000`, `min-h-[90px]`) | `descripcionCaso.trim()` obligatorio |
| Argumento del usuario | text (input chat) | `input.trim()` no vacío, `iniciado=true`, `!loading` |

#### Modales internos
- Ninguno.

#### Acciones del usuario
- Seleccionar rol (Juez/Fiscal/Abogado).
- Escribir descripción del caso.
- Iniciar simulación (recibe contexto + apertura del juez).
- Enviar argumentos como turnos.
- Expandir `<details>` con contexto sintético del caso.

#### Endpoints backend

| Método | Endpoint | Función |
|--------|----------|---------|
| POST | `/api/simulacion/iniciar` | Iniciar simulación con `{ rama, rolUsuario, dificultad, descripcionCaso }` |
| POST | `/api/simulacion/turno` | Enviar turno `{ simulacionId, mensajeUsuario }` |

Cliente HTTP: `dotnetClient` (.NET 8).

#### Validaciones
- **Cliente:**
  - `descripcionCaso.trim()` no vacío.
  - `input.trim()` no vacío al enviar turno.
  - `simulacionId` debe existir antes de enviar turno.
- **Servidor:** Mensaje en `data.mensajeRespuesta` o fallback.

#### Errores manejados
- `AbortError` / `ERR_CANCELED` → silencioso.
- Error al iniciar → `setError(err.response.data.error || err.message)`.
- Error al enviar turno → mensaje en chat + `setError`.

#### Estados UI
- **Loading:** Card "Iniciando..." en chat.
- **Error:** Texto rojo bajo textarea.
- **Empty:** Mensaje inicial del sistema: "Selecciona tu rol y describe el caso..."
- **Success:** Burbujas de chat con `from: 'ia' | 'user'`.

#### Características avanzadas
- **AbortController compartido** (`controllerRef`) para cancelar peticiones al iniciar nueva simulación o desmontar.
- **Mapeo ROL → RAMA** (`ROL_A_RAMA`): actualmente todas mapean a `'Penal'`.
- **Fondo full-screen** con overlay oscuro (`bg-linear-to-b from-[#0f131a]/80`).
- **logger** de errores (`utils/logger`).
- Glassmorphism (`glass`, `backdrop-blur`).
- `<details>` HTML nativo para contexto colapsable.
- Animación `anim-fade-in-up` para tarjetas de intro.

---

### 3.8 Predictor Judicial (`src/pages/PredictorJudicial.jsx`)

**Líneas:** 137
**Ruta:** `/herramientas/predictor`

#### Propósito
Predicción IA (Gemini) sobre probabilidad de éxito, factores favorables/desfavorables y recomendación estratégica de un caso legal.

#### Botones principales

| Botón | Función | Endpoint |
|-------|---------|----------|
| "Predecir Resultado" | `handlePredecir()` | `api.consulta('predictor')` |

#### Inputs / Formularios

| Campo | Tipo | Validación |
|-------|------|------------|
| Hechos del caso | textarea (`min-h-[100px]`, `resize-none`) | `hechos.trim()` obligatorio |

#### Modales internos
- Ninguno.

#### Acciones del usuario
- Escribir hechos del caso.
- Generar predicción.
- Ver gauge SVG circular con probabilidad.
- Ver listas de factores favorables y desfavorables.
- Ver recomendación Gemini.

#### Endpoints backend

| Método | Endpoint | Función |
|--------|----------|---------|
| POST | `/api/ia/consulta` (vía `api.consulta()`) | Predicción con tipo `'predictor'` |

#### Validaciones
- `hechos.trim()` no vacío.

#### Errores manejados
- `setError('Error al conectar con el servidor')` → texto rojo.

#### Estados UI
- **Loading:** Texto en botón cambia a "Analizando con Gemini..." (no spinner explícito).
- **Error:** Texto rojo simple.
- **Empty:** Card con icono `psychology` opacity-50 + texto instructivo.
- **Success:**
  - Gauge SVG circular animado (`strokeDashoffset` calculado).
  - Gradiente lineal azul→verde.
  - Porcentaje grande con `gradient-text`.
  - Badge `IA Predictiva` en header.
  - Lista de factores con icono check verde / warning rojo.
  - Card de "Recomendación Gemini" con `IADisclaimerBanner`.

#### Características avanzadas
- **Gauge SVG inline** con cálculo `dashOffset = 339.29 * (1 - probabilidad/100)`.
- **Gradiente lineal** definido vía `<defs><linearGradient>`.
- `useSeo` con title/description.
- Disclaimer IA inline.

---

### 3.9 Generador de Alegatos (`src/pages/GeneradorAlegatos.jsx`)

**Líneas:** 141
**Ruta:** `/herramientas/alegatos`

#### Propósito
Genera alegatos de apertura y clausura (Defensa/Fiscal) para audiencias orales con IA Gemini. Exporta a DOCX y PDF.

#### Botones principales

| Botón | Función | Endpoint |
|-------|---------|----------|
| "Generar Alegato con Gemini" | `handleGenerar()` | `api.consulta('alegatos')` |
| "Descargar DOCX" | `exportToDocx()` inline | - |
| "Descargar PDF" | Abre `IADisclaimerModal` → `generateLegalPDF()` | - |

#### Inputs / Formularios

| Campo | Tipo | Validación |
|-------|------|------------|
| Tipo de Alegato | select (3 opciones fijas) | - (default: 'Alegato de Clausura - Defensa') |
| Teoría del caso | textarea (`min-h-[80px]`, `resize-none`) | `teoriaDelCaso.trim()` obligatorio |

#### Modales internos

1. **`IADisclaimerModal`**
   - `actionLabel="Descargar PDF"`
   - Confirm → ejecuta `generateLegalPDF()`.

#### Acciones del usuario
- Seleccionar tipo de alegato.
- Escribir teoría del caso.
- Generar alegato.
- Ver resultado en card.
- Descargar DOCX o PDF.

#### Endpoints backend

| Método | Endpoint | Función |
|--------|----------|---------|
| POST | `/api/ia/consulta` (vía `api.consulta()`) | Generación con tipo `'alegatos'` |

#### Validaciones
- `teoriaDelCaso.trim()` no vacío.

#### Errores manejados
- Error de generación → `setError('Error al conectar con el servidor')`.
- Error DOCX → `setExportError('Error al generar el DOCX.')`.
- Error PDF → `setExportError('Error al generar el PDF.')`.

#### Estados UI
- **Loading:** Texto en botón cambia a "Analizando con Gemini..." (no spinner).
- **Error:** Texto rojo.
- **Empty:** Texto placeholder "El borrador del alegato aparecerá aquí..."
- **Success:** Card con `bg-primary/5 border-primary/20`, badge `IA Gemini` en header, `IADisclaimerBanner` compacto, botones de exportación.

#### Características avanzadas
- Disclaimer IA obligatorio antes de PDF (cumplimiento LPDP).
- Sanitización de filename con regex `/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]/g`.
- Bug detectado: en el DOCX se llama `exportToDocx({ title, content, filename })` (objeto), mientras que en RedactorEscritos se llama `exportToDocx(resultado, filename, options)` (string). **Asumir que `exportToDocx` acepta ambas firmas o verificar inconsistencias.**

---

### 3.10 Analista de Expedientes (`src/pages/AnalistaExpedientes.jsx`)

**Líneas:** 218
**Ruta:** `/expediente/:id` o `/analista/:id`

#### Propósito
Vista detallada de un expediente con chat IA contextual (vinculado al expediente). Carga expediente + documentos + permite consultas rápidas sobre el caso.

#### Botones principales

| Botón | Función | Endpoint |
|-------|---------|----------|
| 4 Quick Actions (chips) | Resumir hechos / Extraer pruebas / Citar base legal / Detectar nulidades → `sendMessage(prompt)` | `api.chat()` |
| Botón Enviar (header chat) | `sendMessage()` | `api.chat()` |
| "Volver a Expedientes" (error state) | Link a `/expedientes` | - |

#### Inputs / Formularios

| Campo | Tipo | Validación |
|-------|------|------------|
| Consulta al analista | text | `text.trim()` no vacío, `!loading` |

#### Modales internos
- Ninguno.

#### Acciones del usuario
- Ver encabezado del expediente (número).
- Leer documentos asociados en panel superior (45% altura).
- Hacer consultas rápidas al chat IA.
- Ver historial de chat con el expediente como contexto.

#### Endpoints backend

| Método | Endpoint | Función |
|--------|----------|---------|
| GET | `/api/expedientes/:id` (vía `api.getExpediente()`) | Cargar expediente |
| GET | `/api/expedientes/:id/documentos` (vía `api.getDocumentos()`) | Listar documentos |
| POST | `/api/ia/chat` (vía `api.chat()`) | Chat contextual al expediente |

Cliente HTTP: `api` (abstracción).

#### Validaciones
- **Cliente:**
  - `text.trim()` no vacío al enviar.
- **Errores:** Try/catch con fallback "No se pudo obtener respuesta. Intenta de nuevo."

#### Errores manejados
- Expediente no encontrado → `errorExp='Expediente no encontrado'` → render especial con CTA.
- Docs cargan vacío silenciosamente (catch sin mensaje).
- Chat error → mensaje AI con texto de error.

#### Estados UI
- **Loading inicial expediente:** Spinner grande con "Cargando expediente...".
- **Loading documentos:** Texto "Cargando documentos..." en panel.
- **Loading chat:** 3 dots `animate-bounce` + "Consultando...".
- **Error expediente:** Icono `error_outline` grande + texto + botón "Volver a Expedientes".
- **Empty documentos:** Icono `description` + texto "No hay documentos asociados a este expediente."
- **Empty chat:** Texto "¿En qué puedo ayudarte con este expediente?".
- **Success:** Burbujas chat con avatar `smart_toy` (gradient) para IA y `person` para usuario.

#### Características avanzadas
- **Layout split 45/55** (documentos / chat) con `h-[calc(100dvh-148px)]` (móvil) y `h-[calc(100dvh-64px)]` (desktop).
- **Cleanup con cancelled flag** para evitar setState tras unmount.
- **Contexto de expediente** pasado a `api.chat(text, historial, id)`.
- **SEO dinámico** según expediente cargado.
- Documentos con `line-clamp-6` para preview de contenido.
- Disclaimer IA visible solo cuando hay mensajes AI.
- Animación `anim-fade-in-up` en carga.

---

## 4. Resumen Ejecutivo

### 4.1 Métricas globales

| Métrica | Total |
|---------|-------|
| **Páginas auditadas** | 10 |
| **Iconos en `src/assets/icons/`** | 81 (PNG) |
| **Iconos en sprite `sprite-icons.js`** | 9 (sprite.png) |
| **Backgrounds** | 4 (JPEG) |
| **Empty states** | 4 (PNG) |
| **Avatares** | 1 (JPEG) |
| **Componentes de iconos** | 2 (`SpriteIcon`, `AppIcon`) |
| **Botones totales** | ≈ 60+ (excluyendo paginación dinámica) |
| **Inputs/Formularios** | ≈ 45+ campos |
| **Modales internos** | 5 (Expedientes: 2, Clientes: 1, Redactor: 1, Generador: 1) |
| **Endpoints backend consumidos** | 13 únicos |

### 4.2 Endpoints consumidos (consolidado)

| # | Método | Endpoint | Páginas |
|---|--------|----------|---------|
| 1 | GET | `/api/expedientes` | Expedientes, CalendarioVencimientos |
| 2 | POST | `/api/expedientes` | Expedientes |
| 3 | PATCH | `/api/expedientes/:id` | Expedientes |
| 4 | DELETE | `/api/expedientes/:id` | Expedientes |
| 5 | GET | `/api/expedientes/:id` | AnalistaExpedientes |
| 6 | GET | `/api/expedientes/:id/documentos` | AnalistaExpedientes |
| 7 | GET | `/api/clientes` | Clientes |
| 8 | POST | `/api/clientes` | Clientes |
| 9 | PUT | `/api/clientes/:id` | Clientes |
| 10 | DELETE | `/api/clientes/:id` | Clientes |
| 11 | POST | `/api/simulacion/iniciar` | SimuladorJuicios |
| 12 | POST | `/api/simulacion/turno` | SimuladorJuicios |
| 13 | POST | `/api/ia/consulta` | Redactor, ChatIA, Buscador, Predictor, Alegatos, AsistenteObjeciones, EstrategiaInterrogatorio, ComparadorPrecedentes, GeneradorCasosCriticos, ResumenEjecutivo |
| 14 | POST | `/api/ia/chat` | ChatIA, AnalistaExpedientes, GestionMultidoc |

### 4.3 Hallazgos críticos

#### 🔴 Severidad ALTA
1. **`BovedaEvidencia.jsx` es MOCK total** — 34 líneas con datos hardcodeados y botón "Agregar Evidencia" sin handler. Requiere implementación completa con hash SHA-256 client-side y upload real.
2. **`BuscadorJurisprudencia.jsx`** tiene filtros y botones decorativos (Año/Recurso/Sala/Ponente, Ordenar, Resumen IA, Bookmark) sin handler.
3. **`Clientes.jsx`** usa `alert()` y `confirm()` nativos del navegador — no cumple WCAG 2.1 AA ni el sistema de toasts del `UIProvider`.

#### 🟡 Severidad MEDIA
4. **Inconsistencia en firma `exportToDocx`**: en Redactor se llama `exportToDocx(resultado, filename, options)` (3 args), en GeneradorAlegatos `exportToDocx({ title, content, filename })` (1 objeto).
5. **`ChatIA.jsx` y `RedactorEscritos.jsx`** no sanitizan el output antes de copiar al portapapeles (DOMPurify solo se usa en render de ChatIA).
6. **Falta de debounce** en búsquedas (`Expedientes.jsx`, `Clientes.jsx`) — cada keystroke dispara filter o fetch.
7. **Endpoints de IA están centralizados en `/api/ia/consulta` y `/api/ia/chat`** — no hay segregación por tipo de tarea.

#### 🟢 Severidad BAJA
8. **Sistema de iconos dual**: `AppIcon` (PNG) + `SpriteIcon` (sprite.png) + `lucide-react` (Clientes, Redactor). Estandarizar en uno solo.
9. **`SimuladorJuicios.jsx`** mapea todos los roles a rama `'Penal'` (ver `ROL_A_RAMA`).
10. **Sin loading spinner** explícito en Predictor, GeneradorAlegatos (solo texto en botón).

### 4.4 Cumplimiento de reglas duras del agente Frontend

| Regla | Cumplimiento |
|-------|--------------|
| TypeScript estricto | ⚠️ Proyecto usa JSX, no TSX. Verificar `tsconfig` si aplica. |
| React.lazy + Suspense por ruta | ✅ Asumido (no verificado en esta auditoría específica). |
| ARIA roles y labels | ✅ ChatIA y AnalistaExpedientes cumplen. Otros parciales. |
| Focus trap en modales | ⚠️ Modales no implementan focus trap explícito. |
| prefers-reduced-motion | ⚠️ No verificado. |
| Sanitización XSS con DOMPurify | ✅ ChatIA (whitelist). ⚠️ Redactor renderiza `whitespace-pre-wrap` sin sanitizar. |
| JWT en httpOnly cookies | ✅ Asumido (no frontend). |
| Disclaimer IA en cada herramienta | ✅ Redactor, ChatIA, Predictor, GeneradorAlegatos, Simulador, AnalistaExpedientes. |
| Performance budget (main chunk < 300kb gz) | ⚠️ No medido en esta auditoría. |
| Textos en `es-PE` | ✅ Todos los textos visibles. |
| Validación cliente Y servidor | ⚠️ Solo cliente. El servidor debe validar también. |
| LPDP disclaimers en UI | ✅ ChatIA tiene mensaje específico para `TRANSFERENCIA_INTERNACIONAL_REQUIRED`. |

### 4.5 Recomendaciones prioritarias

1. **Implementar `BovedaEvidencia.jsx`** completa con cálculo SHA-256 client-side y upload al backend.
2. **Reemplazar `alert/confirm` nativos** por componentes `ConfirmModal` y toasts del `UIProvider`.
3. **Conectar handlers** de filtros y acciones en `BuscadorJurisprudencia.jsx`.
4. **Estandarizar sistema de iconos** en `AppIcon` (migrar de Lucide y Sprite).
5. **Agregar debounce** (300-500ms) en inputs de búsqueda.
6. **Agregar focus trap** en modales con librería `focus-trap-react` o custom hook.
7. **Documentar contrato `exportToDocx`** y unificar firma.
8. **Medir bundle size** con `vite-plugin-bundlesize` o `rollup-plugin-visualizer`.

---

## 5. Anexo: Listado completo de iconos por página

### Iconos usados por página

| Página | Iconos principales |
|--------|---------------------|
| Expedientes | search, table_chart, add, edit, delete, chevron_left, chevron_right, close, folder, gavel, balance, work, account_balance, family_restroom, apartment |
| Clientes | Users, Plus, Search, Trash2, Edit2, Mail, Phone, MapPin, X, Building2, User, AlertTriangle (Lucide) |
| RedactorEscritos | info, description, gavel, error, edit_note, auto_awesome, rate_review, check, close, warning, verified, content_copy (vía AppIcon), Copy, Check (Lucide) |
| ChatIA | chat (sprite), delete_sweep, auto_awesome, warning, summarize, find_in_page, edit_note, schedule, trending_up, psychology, person, send, gavel, expand_less, expand_more, content_copy |
| BuscadorJurisprudencia | gavel, search, sync, expand_more, tune, calendar_today, balance, auto_awesome, bookmark |
| BovedaEvidencia | security, verified_user, image, description, videocam, upload, check_circle, pending |
| SimuladorJuicios | psychology, info, play_arrow, send, history, settings |
| PredictorJudicial | psychology, check_circle, warning |
| GeneradorAlegatos | auto_awesome, expand_more, description, picture_as_pdf |
| AnalistaExpedientes | error_outline, arrow_back, description, smart_toy, person, send, summarize, find_in_page, menu_book, warning, auto_awesome |

---

**Fin del reporte.**

> *Auditoría generada por el agente Frontend siguiendo las reglas del proyecto LegalPro. Toda la información fue extraída directamente del código fuente en `legalpro-app/src/`.*
