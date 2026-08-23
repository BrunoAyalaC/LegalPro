# Guía de Usuario — Sistema RAG de LegalPro

> **Audiencia:** Abogados, fiscales, jueces y contadores que usan LegalPro en sus expedientes.
> **Fecha de esta guía:** 1 de agosto de 2026.
> **Versión del producto:** `legalpro-app@6.10.1` · `lexia-landing@1.0.0`.
> **Alcance:** Web (React + Node 20 + .NET 8). Cubre todas las herramientas IA con Retrieval-Augmented Generation (RAG).

---

## 1. ¿Qué es el RAG de LegalPro?

El **RAG (Retrieval-Augmented Generation)** es la capa de base legal que alimenta las respuestas IA de LegalPro. Antes de generar un escrito, un análisis, una predicción o una búsqueda de jurisprudencia, el sistema:

1. **Convierte tu consulta en un vector** (embedding) con un proveedor externo — OpenAI `text-embedding-3-small` o Google Gemini `embedding-001` (768 dimensiones).
2. **Busca los 5 chunks más similares** en la tabla `rag_vectors` de PostgreSQL + extensión `pgvector` (umbral de similitud coseno configurable, por defecto `RAG_THRESHOLD=0.70`).
3. **Re-ranking híbrido** (70 % semántico + 30 % keywords exactos) para priorizar artículos y términos jurídicos densos.
4. **Acompaña la respuesta con citaciones verificables** (enlace SPIJ, TC, PJ, INDECOPI, SUNARP, El Peruano, SUNAT, etc.) y los **4 disclaimers IA obligatorios** exigidos por la LPDP (Ley 29733) y el catálogo `catalogs/disclaimers-ia.json`.

> **Beneficio medible declarado:** `docs/ARQUITECTURA_RAG.md` reporta reducción de alucinaciones de ~15 % a `< 2 %` y `citation_accuracy ≥ 0.98` cuando el RAG está activo (umbral SLO vigente en `tools/rag/metrics.mjs`).

### ¿Por qué existe?

| Sin RAG | Con RAG (LegalPro) |
|---|---|
| Riesgo de citar leyes derogadas o artículos inexistentes. | Solo norma indexada con `metadata.fecha_publicacion` verificable. |
| Imposible auditar la fuente de la respuesta. | Cada citación expone URL oficial, fuente, similitud coseno. |
| Subagentes pueden “inventar” jurisprudencia. | `necesita_revision_humana: true` siempre presente y audit log por consulta. |

### ¿Qué fuentes usa el corpus?

El indexer (`tools/rag/index-corpus.mjs`) procesa 8 catálogos base (`CONFIG.sources`) que suman **123 documentos oficiales** (verificado en `catalogs/fuentes-rag-2026.json` → `total_documentos_indexados_inmediatos: 123`). El roadmap de `docs/ARQUITECTURA_RAG.md` proyecta llegar a 319 → 1.000 → 10.000+ documentos a medida que se incorporen scrapers adicionales.

Cobertura vigente al 2026-08-01:

| Catálogo | Documentos |
|---|---:|
| `catalogs/codigos-leyes.json` (Constitución, CC, CP, CPC, CPP, CT, etc.) | 19 |
| `catalogs/plazos-procesales.json` | 17 |
| `catalogs/tipos-penales-peru.json` | 25 |
| `catalogs/delitos-economicos.json` | 16 |
| `catalogs/disclaimers-ia.json` | 14 |
| `catalogs/jurisprudencia-tc-2026.json` | 8 |
| `catalogs/normas-minjusdh-2026.json` | 12 |
| `catalogs/resoluciones-indecopi-2026.json` | 12 |
| **Total indexado por el indexer** | **123** |

Hay catálogos adicionales en disco (`casaciones-pj-2026.json`, `sentencias-tc-completas-2026.json`, `directivas-sunarp-2026.json`, `normas-sunat-2026.json`, `normas-elperuano-2026.json`, `normas-oefa-2026.json`, `contrataciones-osce-2026.json`, `resoluciones-anpd-2026.json`, `normas-mtpe-2026.json`, `normas-minsa-2026.json`, `normas-onp-2026.json`, `normas-sbs-2026.json`, `resoluciones-tribunal-fiscal-2026.json`, `normas-cgr-2026.json`) que el **CRON diario** (`tools/rag/daily-update.mjs`) puede ampliar en próximas iteraciones.

---

## 2. Cómo entrar a cada herramienta RAG

Todas las rutas viven dentro de la aplicación web. En la barra lateral encontrarás:

| Herramienta | Ruta frontend | Endpoint backend | Página |
|---|---|---|---|
| Analista de Expedientes | `/analista` o `/expediente/:id` | `POST /api/ai/chat` (vía `AnalistaExpedientes.jsx` → `api.chat()`) | `legalpro-app/src/pages/AnalistaExpedientes.jsx` |
| Buscador Jurisprudencial | `/buscador` | `POST /api/jurisprudencia/buscar` (vía `api.consulta(..., 'jurisprudencia')`) | `legalpro-app/src/pages/BuscadorJurisprudencia.jsx` |
| Redactor Legal IA | `/redactor` | `POST /api/redactor/generar` (vía `api.consulta(..., 'redaccion')`) | `legalpro-app/src/pages/RedactorEscritos.jsx` |
| Predictor Judicial | `/predictor` | `POST /api/predictor/predecir` (vía `api.consulta(..., 'predictor')`) | `legalpro-app/src/pages/PredictorJudicial.jsx` |
| Chat LexIA | `/chat-ia` | `POST /api/ai/chat` | `legalpro-app/src/pages/ChatIA.jsx` |

> El frontend también expone alias `/jurisprudencia` y `/buscador-jurisprudencia` (compatibilidad con `legalpro-app/e2e/ai-features.spec.js` y `roles.spec.js`) y un acceso rápido `Analizar con IA` desde cada tarjeta de expediente (`ExpedienteCard.jsx`).

---

## 3. Tutorial paso a paso

### 3.1 Analizar un expediente con RAG

Ruta: `Expedientes` → selecciona el caso → botón **“Analizar con IA”** (`ExpedienteCard.jsx`).

```text
1. En la barra lateral pulsa "Expedientes" o usa Cmd/Ctrl + K → "Mis Expedientes".
2. Selecciona el expediente que quieres analizar.
3. En la tarjeta del expediente pulsa "Analizar con IA" (ícono Sparkles).
4. La página "Expediente N° …" carga el chat contextualizado con los documentos.
5. Usa las acciones rápidas: Resumir hechos · Extraer pruebas · Citar base legal · Detectar nulidades.
6. Cada respuesta muestra el banner de RAG ("Respuesta con N fuentes legales · 87 % relevancia")
   y, si está disponible, el panel "fuentes citadas" con enlaces SPIJ / TC / PJ.
```

> El indicador `RAGStatus` (`legalpro-app/src/components/legal/RAGStatus.jsx`) cambia a naranja y muestra **"Sin base legal específica — respuesta general. Requiere revisión humana."** si la búsqueda no encontró chunks con el umbral configurado.

### 3.2 Buscar jurisprudencia

Ruta: `Jurisprudencia` (en la barra lateral) o `Cmd/Ctrl + K → "Buscador de Jurisprudencia"`.

```text
1. Ve a /buscador.
2. Escribe palabra clave o N° de expediente. Por ejemplo: "habeas corpus plazo razonable".
3. Pulsa "Buscar" o Enter.
4. La API ejecuta una búsqueda híbrida:
   a. Embedding semántico (pgvector) sobre el corpus.
   b. El modelo IA (MiniMax M3 por defecto; Gemini opcional) genera un resumen
      estructurado con citaciones verificables.
5. Resultados: tarjetas con tipo, número, fecha, sala y botón "Resumen IA".
```

> El endpoint `GET /api/ai/jurisprudencia` (en `legalpro-app/server/routes/ai.js`) y `POST /api/jurisprudencia/buscar` (en .NET vía `dotnetClient`) son los entrypoints del RAG. Ambos pasan por `iaTransferenciaGuard` y `quotaMiddleware` para aplicar la LPDP y los créditos.

### 3.3 Redactar un escrito con base legal

Ruta: `Redactor Legal` (sidebar) o `Cmd/Ctrl + R`.

```text
1. Ve a /redactor.
2. Selecciona tipo de escrito (Demanda, Contestación, Apelación, Casación, Medida Cautelar, etc.)
   y materia (CIVIL, PENAL, LABORAL, FAMILIA, CONSTITUCIONAL, ADMINISTRATIVO, COMERCIAL, TRIBUTARIO).
3. Completa los campos obligatorios: juzgado, recurrente, abogado patrocinante, hechos del caso.
4. Pulsa "Generar escrito". El redactor consulta la base legal peruana y produce
   un borrador con encabezado legal peruano, petitorio, fundamentos de hecho, fundamentos
   de derecho y bloque de firma.
5. Edita el resultado, exporta a PDF o DOCX, o guárdalo como borrador.
6. Cada bloque cita las normas con [N] y al final del escrito aparecen los 4 disclaimers IA.
```

> El formulario limita los hechos a `MAX_CHARS = 5 páginas × 3 000 caracteres` y muestra un contador de páginas estimadas. La generación llama a `api.consulta(prompt, 'redaccion')` que el helper `consulta()` de `legalpro-app/src/api/client.ts` mapea a `POST /api/redactor/generar`.

### 3.4 Predecir un resultado judicial

Ruta: `Predictor Judicial` o `Cmd/Ctrl + K → "Predecir Resultado"`.

```text
1. Ve a /predictor.
2. Describe los hechos del caso en lenguaje natural.
3. Pulsa "Predecir Resultado".
4. El sistema devuelve:
   - % de probabilidad de éxito (gráfico circular).
   - Veredicto probable (Favorable / Desfavorable / Incierto).
   - Factores favorables y desfavorables.
   - Recomendación estratégica.
5. Lee el banner de Disclaimer IA: la predicción es orientativa, la decisión final es humana.
```

> El predictor usa `POST /api/predictor/predecir` (definido en `legalpro-app/src/api/client.ts:375`). Los campos `probabilidadExito`, `veredictoGeneral`, `factoresFavorables/Desfavorables` y `recomendacion` son generados vía function-calling estructurado sobre MiniMax M3.

### 3.5 Chat LexIA con RAG contextual

Ruta: `Chat IA Legal` (sidebar) o `Cmd/Ctrl + K → "Chat IA"`.

```text
1. Ve a /chat-ia.
2. Acciones rápidas:
   - Resumir caso
   - Jurisprudencia
   - Redactar
   - Plazos
   - Predicción
   - Estrategia
3. Escribe tu consulta (mínimo 5 caracteres; el backend rechaza más cortos).
4. Si abres el chat con un expediente activo (?expediente_id=...), el historial
   se guarda por expediente y se cita la base legal con los mismos criterios.
```

---

## 4. Cómo leer las citaciones y el porcentaje de similitud

Cada respuesta IA muestra un panel con citaciones. Los porcentajes de similitud semántica se colorean según `legalpro-app/src/components/legal/CitacionesPanel.jsx`:

| % Similitud | Color | Lectura recomendada |
|---|---|---|
| ≥ 80 % | Verde (`text-emerald-400`) | Alta confianza. Confirmar con la fuente y usar. |
| 65 – 79 % | Ámbar (`text-amber-400`) | Confianza media. Verificar contexto antes de aplicar. |
| < 65 % | Naranja (`text-orange-400`) | Baja confianza. Revisar manualmente; pedir al abogado senior. |

Cuando la similitud promedio cae por debajo de `0.65` el flag `necesita_revision_humana` se activa en `AIAssistantPanel.jsx` y la UI lo refleja en el badge de RAG.

### Disclaimers IA obligatorios (4)

El wrapper `tools/rag/junior-rag-wrapper.mjs` define la constante `DISCLAIMERS_OBLIGATORIOS` con exactamente cuatro mensajes, replicados también en el helper `inyectarDisclaimers()` del middleware. Estos cuatro textos SIEMPRE deben acompañar cualquier contenido IA que cite normativa:

```text
⚠️ Esta respuesta es generada por IA y NO constituye asesoría legal.
⚠️ Siempre consulta con un abogado colegiado antes de tomar decisiones legales.
⚠️ La información proviene de fuentes oficiales pero puede estar sujeta a cambios.
⚠️ Verifica las citas consultando directamente las fuentes oficiales.
```

El componente `IADisclaimerBanner` (`legalpro-app/src/components/IADisclaimerBanner.jsx`) muestra un quinto banner ámbar de “Contenido generado por IA” encima del chat; descártalo después de leerlo.

---

## 5. Interpretar el estado del RAG en la UI

`legalpro-app/src/components/legal/RAGStatus.jsx` resume el estado RAG de cada mensaje IA:

| Indicador visual | Significado | Acción |
|---|---|---|
| Banner verde-azul: *"Respuesta con 5 fuentes legales · 87 % relevancia"* | RAG encontró al menos 1 chunk con similitud ≥ 0.70. | Revisar citaciones y aplicar. |
| Banner naranja: *"Sin base legal específica — respuesta general. Requiere revisión humana."* | `chunks_usados === 0` o similitud promedio por debajo del umbral. | No usar como fundamentación firme; valida con otra fuente. |
| Sin banner | El endpoint no estaba bajo `/api/ai/*` o `/api/legal/*`, o `ENABLE_RAG=false` (ver `ragMiddleware.js`). | Contactar al administrador si esperabas RAG y no aparece. |

---

## 6. Compliance LPDP (Ley 29733) — qué se registra de tu consulta

Para cumplir con la **Ley 29733** de Protección de Datos Personales y su modificatoria **D.S. 016-2024-JUS**:

- **No se guarda el texto de tu consulta.** El hash se calcula en `legalpro-app/server/utils/rag-observability.js` con `SHA-256` truncado a 16 caracteres hexadecimales. La línea de auditoría es `RAG_QUERY` con `consultaHash` (no `consulta`).
- **El middleware actual emite `RAG_CONTEXT_INJECTED`** en `audit_log` con materia, chunks, similitud, latencia, top_k, threshold, `organizationId` e IP. **No** almacena la consulta en claro. Ver `legalpro-app/server/middleware/ragMiddleware.js:87`.
- **Tu `organizationId` y `userId`** quedan asociados al evento para auditoría multi-tenant. La métrica Prometheus no usa `organizationId` como label por alta cardinalidad.
- **El banner ámbar** está en todas las páginas IA por cumplimiento de **transparencia activa** (LPDP Art. 21).

> Si el flag `RAG_QUERY` no aparece en tu instalación, significa que `logRAGQuery()` aún no está cableado en la ruta (`ragMiddleware.js` solo emite `RAG_CONTEXT_INJECTED` hoy). Pide a tu equipo de operaciones que ejecute la migración descrita en `docs/RAG_TROUBLESHOOTING.md` § 4.

---

## 7. Preguntas frecuentes (FAQ)

### 7.1 ¿Puedo confiar en las citaciones?
Sí. Cada citación expone `fuente`, `metadata.url` y `similitud`. Al hacer clic en el ícono **ExternalLink** del panel `CitacionesPanel` se abre la URL oficial (SPIJ, TC, PJ, INDECOPI, SUNARP, SUNAT, El Peruano). Las URLs pasan por `sanitizarUrl()` y solo se aceptan protocolos `http:` / `https:` (mitigación XSS / tab-nabbing).

### 7.2 ¿Por qué a veces no encuentro jurisprudencia reciente?
El corpus activo a 2026-08-01 prioriza códigos y catálogos base (123 documentos indexados). Las sentencias del TC, casaciones del PJ y normas del diario El Peruano se actualizan diariamente con `tools/rag/daily-update.mjs` (CRON 06:00 PET). Si necesitas una norma específica:

1. Confirma que el documento esté en `catalogs/`.
2. Si el documento no está, tu administrador puede agregarlo y re-indexar (ver `docs/DEVELOPER_GUIDE_RAG.md`).
3. Mientras tanto, el sistema te dirá **"Sin base legal específica — respuesta general"** y NO inventará contenido. Ver `junior-rag-wrapper.mjs:155` (fallback explícito).

### 7.3 ¿Mis consultas quedan registradas?
Sí, en `audit_log` (LPDP Ley 29733 + D.S. 016-2024-JUS). Solo se almacena el `consultaHash` (SHA-256 truncado) y metadatos agregados (materia, chunks, similitud, latencia, costo, proveedor de embeddings). **El texto de tu consulta NO se guarda** por diseño.

### 7.4 ¿Cómo desactivo el RAG?
El RAG se controla por el **feature flag `ENABLE_RAG` en el backend** (`.env` o variables de Railway), no por un toggle del usuario final. Si tu organización necesita operar sin RAG (por ejemplo, para usar solo el conocimiento base del modelo):

1. Coordina con tu **administrador SaaS** o equipo de operaciones.
2. El operador cambia `ENABLE_RAG=false` en Railway y redespliega (`tools/railway/legalpro-ops.ps1 redeploy`).
3. Mientras el flag esté en `false`, `ragMiddleware.js` se vuelve **no-op** (no añade latencia) y los endpoints IA devuelven respuestas sin citaciones RAG.

No existe un switch por usuario en el frontend actual; si lo necesitas, solicítalo a producto (issue conocido: el toggle "Configuración → Modo IA" todavía no está implementado en la UI; el control actual es 100 % a nivel de despliegue).

### 7.5 ¿Cuánto cuesta cada consulta con RAG?
El SLO vigente (declarado en `tools/rag/metrics.mjs` y `docs/MONITORING_RAG.md`) es **costo promedio < USD 0.10 por request** y **latencia p95 < 3 000 ms**. `docs/ARQUITECTURA_RAG.md` reporta que, con todas las optimizaciones activas (cache Redis + hybrid scoring + embeddings económicos + MiniMax M3), el costo objetivo por consulta puede bajar a **< USD 0.001** según `tools/rag/cost-analysis.mjs`.

Para una cifra exacta de tu organización ejecuta `node tools/rag/cost-analysis.mjs` y revisa los dashboards de `docs/MONITORING_RAG.md`.

### 7.6 ¿El RAG usa mis datos para entrenar al modelo?
No. `legalpro-app/server/middleware/ragMiddleware.js` solo lee del corpus público (`rag_vectors`) y los embeddings NO contienen PII. El flag `ENABLE_RAG` se combina con `iaTransferenciaGuard` (`/api/ai/*` y `/api/legal/*`) para exigir el consentimiento LPDP de transferencia internacional.

### 7.7 ¿Cómo reporto una citación incorrecta?
1. Captura el `X-Correlation-ID` (si está disponible) o el `consultaHash` (visible en el panel de admin).
2. Anota el ID del chunk y la URL a la que apunta.
3. Envía el reporte a `#ops` o al canal de soporte con los datos de tu organización.
4. SRE ejecutará `node tools/rag/metrics.mjs 7` para verificar `citation_accuracy` y `hallucination_rate`.

### 7.8 ¿Funciona sin conexión?
No. El wrapper requiere `DATABASE_URL` y un proveedor de embeddings (`OPENAI_API_KEY` o `GEMINI_API_KEY`). En modo degradado el middleware registra `req.ragContext = null` y la respuesta IA se entrega sin citaciones (fail-open documentado en `ragMiddleware.js:101`).

---

## 8. Glosario rápido

| Término | Significado |
|---|---|
| **Embedding** | Vector numérico (768 dimensiones) que representa semánticamente un texto. |
| **Chunk** | Fragmento de un documento (sumilla, título, caso, palabras clave) indexado en `rag_vectors`. |
| **pgvector** | Extensión de PostgreSQL para búsqueda por similitud sobre embeddings. |
| **Threshold (umbral)** | Similitud coseno mínima (`RAG_THRESHOLD`, default 0.70) por debajo de la cual un chunk se descarta. |
| **Top-K** | Número máximo de chunks devueltos por consulta (`RAG_TOP_K`, default 5). |
| **Híbrido (70/30)** | Re-ranking del wrapper: 70 % similitud semántica + 30 % match exacto de keywords. |
| **Disclaimers IA** | Los 4 mensajes obligatorios exigidos por LPDP Art. 21 + catálogo de disclaimers. |
| **Hallucination rate** | % de respuestas con afirmaciones no sustentadas; SLO `< 0.02` (2 %). |
| **Citation accuracy** | % de citaciones verificables; SLO `≥ 0.98` (98 %). |
| **consultaHash** | SHA-256 truncado (16 chars hex) del texto de la consulta; nunca se guarda el texto en claro. |

---

## 9. Soporte y escalamiento

- **Bugs y soporte general:** canal interno `#ops` (alineado con `catalogs/sla-slo.md`).
- **Incidentes LPDP / citación incorrecta / tenant leak:** `#lpdp` o `#security` con severidad P1.
- **Tickets externos:** crea un ticket en el portal de soporte de LegalPro indicando el `consultaHash` y la URL del problema.
- **Documentación técnica adicional:**
  - `docs/ARQUITECTURA_RAG.md` — arquitectura de alto nivel, scrapers y CRON.
  - `docs/MONITORING_RAG.md` — SLOs, alertas y dashboards.
  - `docs/DEVELOPER_GUIDE_RAG.md` — para ingenieros que mantienen o extienden el sistema.
  - `docs/RAG_TROUBLESHOOTING.md` — diagnóstico operativo paso a paso.
