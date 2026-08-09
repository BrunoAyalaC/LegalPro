---
name: enrutamiento-intenciones-chat
description: Router de intenciones del chat legal LegalPro/LexIA. Detecta la intencion del mensaje del usuario (FASE 0 determinista + FASE 1 LLM), selecciona la function declaration canonica correcta (redactar_documento, calcular_plazo, analizar_expediente, buscar_jurisprudencia, predecir_resultado) o modo directo sin tool, y ejecuta la herramienta real del backend (plazos.js, documento-chat.js, RAG, predictor). Requiere catalogo catalogs/chat-intent-functions.json.
when-to-use: "Cuando se implementa, optimiza o valida el enrutamiento de intenciones del chat IA; cuando se crea una nueva function declaration del router; cuando se detecta una regresion de routing (tool equivocada); cuando se evalua el router con eval-set o A/B benchmark"
allowed-tools: Read, Write, Edit, Grep, Glob, Bash (node para validar JSON y correr eval), WebFetch
updated: 2026-08-08
catalogo_functions: catalogs/chat-intent-functions.json
provider_router: legalpro-app/server/utils/providerRouter.js
eval_set: ".opencode/skills/eval-sets/enrutamiento-intenciones-chat.eval.json (ver seccion Eval-set)"
umbral_routing_accuracy: 0.90
temperatura_router_max: 0.3
---

# enrutamiento-intenciones-chat (v1.0.0)

Router de intenciones del chat legal. Convierte el mensaje del usuario en una **tool real** (Function Calling real, NO fake) o en respuesta directa. Elimina el FC "fake" del chat: el router **ejecuta** servicios reales del backend.

> ⚠️ **Referencia rota corregida**: este skill sustituye las referencias a `catalogs/minimax-functions.json` (que **nunca existió**). El catálogo canónico ahora es **`catalogs/chat-intent-functions.json`**.

## 1. Catálogo de intenciones (6 tipos + directo)

| # | Intención | Tool | Verbo gatillo / patrón | Ejemplos |
|---|---|---|---|---|
| 1 | `REDACTAR_DOCUMENTO` | `redactar_documento` | redacta, escribe, elabora, prepara, genera, demanda, contestación, apelación, casación, amparo, hábeas corpus, medida cautelar, escrito, memorial, alegato, acusación, sobreseimiento, requerimiento | "Redacta una demanda de alimentos", "Necesito un escrito de apelación", "Elabora una casación civil" |
| 2 | `CALCULAR_PLAZO` | `calcular_plazo` | plazo, vence, vencimiento, cuántos días, día hábil, feriado, término, computo, prescripción, caducidad, cuándo presentar | "¿Cuándo vence el plazo para apelar?", "¿Cuántos días hábiles tengo para contestar?", "¿Cae en feriado?" |
| 3 | `ANALIZAR_EXPEDIENTE` | `analizar_expediente` | analiza, revisa, estudia, fortalezas, debilidades, riesgos, estrategia, resumen del caso, nulidades, expediente | "Analiza el expediente 2026-001", "¿Qué riesgos tiene mi caso?", "Estrategia procesal para el expediente X" |
| 4 | `BUSCAR_JURISPRUDENCIA` | `buscar_jurisprudencia` | jurisprudencia, precedente, casación sobre, sentencia sobre, qué ha dicho el TC, INDECOPI, SUNARP, MINJUS, busca jurisprudencia | "Busca jurisprudencia sobre desalojo", "Precedentes del TC sobre habeas corpus", "Casaciones sobre despido arbitrario" |
| 5 | `PREDECIR_RESULTADO` | `predecir_resultado` | predice, probabilidad, vamos a ganar, qué resultado, porcentaje de éxito, chances, ¿ganamos?, resultado probable | "¿Qué probabilidad tengo de ganar?", "Predice el resultado del expediente X", "¿Vamos a ganar la demanda?" |
| 6 | `CONSULTA_LEGAL_GENERAL` | `chat_legal` (chat general) | qué dice la ley, artículo, norma, explicación, diferencia entre, es legal, conceptos, asesoría general | "¿Qué dice el artículo 144 CPC?", "¿Es legal grabar una conversación?", "Explícame la prescripción" |
| — | `DIRECTO` (sin tool) | ninguna | saludo, gracias, adiós, pregunta no jurídica, pequeño talk, pedido de aclaración sin contexto | "Hola", "Gracias", "¿Cómo estás?" |

**Regla de prioridad entre intenciones:**
1. `PREDECIR_RESULTADO` > `CALCULAR_PLAZO` > `REDACTAR_DOCUMENTO` > `ANALIZAR_EXPEDIENTE` > `BUSCAR_JURISPRUDENCIA` > `CONSULTA_LEGAL_GENERAL` (cuando hay solapamiento de verbos, el orden de la lista decide).
2. Si la FASE 0 no resuelve (conflicto o ninguna regex matchea), pasa a **FASE 1 LLM** con las 6 intenciones como opciones.
3. Si ambas fases fallan → `DIRECTO` (responder con chat general, sin tool).

## 2. Function Declarations canónicas

El catálogo **`catalogs/chat-intent-functions.json`** es la **única fuente de verdad**. Formato consumido por `mapTools` de `providerRouter.js`:

```js
// providerRouter.js → mapTools() espera:
config.tools = [{ functionDeclarations: [{ name, description, parametersJsonSchema }] }]
```

Las 5 function declarations:
1. `redactar_documento` — required: `["tipo_documento", "materia", "hechos"]`
2. `calcular_plazo` — required: `["fecha_inicio", "acto_procesal"]`
3. `analizar_expediente` — required: `["expediente_id", "tipo_analisis"]`
4. `buscar_jurisprudencia` — required: `["query"]`
5. `predecir_resultado` — required: `["expediente_id"]`

Cada declaración incluye en `description` **"CUÁNDO USARLA / CUÁNDO NO"** para guiar la selección del modelo.

> **Máximo 8 tools en un request.** El catálogo actual tiene 5 → siempre cabe. Si se agregan más, subdividir o priorizar por rol.

## 3. Guardas deterministas (FASE 0) — regex

La FASE 0 corre **antes** de llamar al LLM, con costo ~0 y latencia <5ms. Devuelve la intención si una regex matchea con alta confianza.

```javascript
// FASE 0 — regex de intención (normalizar: minúsculas, sin tildes)
const normalizar = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const FASE0 = [
  {
    intencion: 'PREDECIR_RESULTADO',
    regex: /\b(predic|probabilidad|chances|vamos a ganar|ganamos|resultado (probable|del caso)|porcentaje de exito|que tan probable)\b/,
  },
  {
    intencion: 'CALCULAR_PLAZO',
    regex: /\b(plazo|vence|vencimien|cuantos dias|dias habiles|dia habil|feriado|termino|computo|prescri|caducidad|cuando presentar|presentar .*\b(antes|dentro))\b/,
  },
  {
    intencion: 'REDACTAR_DOCUMENTO',
    regex: /\b(redact|escrib|elabora|prepara|genera|demanda|contestacion|apelacion|casacion|amparo|habeas corpus|medida cautelar|escrito|memorial|alegato|acusacion|sobreseimiento|requerimiento|reconvencion)\b/,
  },
  {
    intencion: 'ANALIZAR_EXPEDIENTE',
    regex: /\b(analiz|revisa|estudia|expediente|fortalezas|debilidades|riesgos|estrategia (procesal|del caso)|resumen del caso|nulidades)\b/,
  },
  {
    intencion: 'BUSCAR_JURISPRUDENCIA',
    regex: /\b(jurisprudencia|precedente|casaciones? sobre|sentencias? sobre|que ha dicho el (tc|tribunal)|indecopi|sunarp|minjus|busca .*(jurisprudencia|precedente|sentencia))\b/,
  },
  {
    intencion: 'CONSULTA_LEGAL_GENERAL',
    regex: /\b(que dice|articulo|norma|ley|es legal|es ilegal|diferencia entre|explicame|concepto de|definicion)\b/,
  },
];
```

### Casos de prueba FASE 0 (obligatorios al tocar el router)

| Entrada (normalizada) | Esperado |
|---|---|
| "redacta una demanda de alimentos" | REDACTAR_DOCUMENTO |
| "necesito un escrito de apelacion" | REDACTAR_DOCUMENTO |
| "cuando vence el plazo para apelar" | CALCULAR_PLAZO |
| "cuantos dias habiles tengo para contestar" | CALCULAR_PLAZO |
| "analiza el expediente 2026-001" | ANALIZAR_EXPEDIENTE |
| "que riesgos tiene mi caso" | ANALIZAR_EXPEDIENTE |
| "busca jurisprudencia sobre desalojo" | BUSCAR_JURISPRUDENCIA |
| "precedentes del tc sobre habeas corpus" | BUSCAR_JURISPRUDENCIA |
| "que probabilidad tengo de ganar" | PREDECIR_RESULTADO |
| "predice el resultado del expediente x" | PREDECIR_RESULTADO |
| "que dice el articulo 144 cpc" | CONSULTA_LEGAL_GENERAL |
| "hola" | DIRECTO (sin tool) |
| "gracias" | DIRECTO (sin tool) |
| "redacta que plazo vence para apelar" (conflicto redactar+plazo) | CALCULAR_PLAZO (prioridad 2 sobre 1) |
| "busca jurisprudencia sobre la demanda que debo redactar" (conflicto) | BUSCAR_JURISPRUDENCIA (ordinal: ver nota) |

> Nota de conflicto "busca jurisprudencia... demanda... redactar": la regex de BUSCAR_JURISPRUDENCIA matchea primero por `jurisprudencia` explícito; la prioridad de la lista decide solo entre igualdad de fuerza. Regla de oro: **verbo más específico gana** — `jurisprudencia` > `redactar`.

## 4. Protocolo de ejecución (Function Calling REAL)

Cada tool resuelve a un **servicio real** del backend. El router **ejecuta** la tool y devuelve el resultado al usuario; **NUNCA** devuelve los `args` del modelo como si fueran el resultado.

### 4.1 `redactar_documento` → `documento-chat.js`

- **Endpoint real**: `POST /api/ai/redactar-documento` (ver `legalpro-app/server/routes/documento-chat.js`)
- **Previo**: `POST /api/ai/detectar-documento` (detecta tipo desde conversación, opcional si ya hay `tipo_documento`)
- **Servicios**: `services/documentoDetector.js` → `services/documentoRedactor.js` → `services/documentoExportador.js` (PDF/DOCX)
- **Middleware**: `authMiddleware`, `tenantMiddleware`, `requireTransferenciaInternacional`, `idempotencyMiddleware`, `quotaMiddleware`, `validate` (Zod), `validarPermisoIA`, `validarDisclaimerAceptado` (`disclaimerAceptado=true` obligatorio)
- **Validación**: 100% de citas contra `catalogs/codigos-leyes.json`; firma digital Ley 27269 al exportar.

### 4.2 `calcular_plazo` → `plazos.js`

- **Endpoint real**: `POST /api/plazos/calcular` (ver `legalpro-app/server/routes/plazos.js`)
- **Catálogo**: `catalogs/plazos-procesales.json` (resolver `acto_procesal` → `plazo_id`)
- **Cálculo**: `utils/feriados.js` → `sumarDiasHabiles`, `esDiaHabil`, `getDiasNoHabilesDelAnio`
- **Prorroga**: CPC art. 144 (si vence en inhábil → siguiente día hábil). `tipo_plazo` habil/calendario/administrativo.
- **Validación**: fecha_inicio requerida (YYYY-MM-DD); plazo_id o dias requerido.
- **CONSULTA CONCEPTUAL SIN fecha_inicio (v1.1.0, fix P0 auditor-legal 2026-08-08)**: si el usuario pregunta "Cuánto tiempo tengo para demandar contencioso-administrativo?" sin fecha, NO se debe hacer default a `fecha_inicio=hoy` (devuelve vencimiento FALSO). En su lugar `ejecutarCalcularPlazo` retorna ficha del catálogo con `fecha_vencimiento: null`, `dias_calendario: null`, `requiere_fecha_inicio: true`, y mensaje natural pidiendo la fecha para calcular vencimiento exacto. Mantiene shape canónico (frontend renderiza tarjeta "plazo" con info completa).
- **DESEMPATE EN `resolverPlazoId` (v1.1.0)**: inputs como "demandar contencioso-administrativo" empatan a varios plazos porque el stem `conte` matchea tanto con `contencioso-administrativo` como con `contestacion`. Se desempata por **suma de prefijos comunes más largos** (chars compartidos): `contencioso-administrativo` comparte 26 chars con `contencioso-administrativa` pero solo 4 con `contestacion` → gana el plazo específico.

### 4.3 `analizar_expediente` → RAG + agente `ia-analista-expedientes`

- **RAG**: `tools/rag/junior-rag-wrapper.mjs` → `consultarBaseLegal({ materia, consulta, contexto })`
- **Pipeline**: FASE 0 → carga expediente por `expediente_id` → RAG con top-K=5, threshold 0.70 → prompt (MiniMax/OpenCode vía `providerRouter`) → informe estructurado con citas [1][2][3], 4 disclaimers, `necesita_revision_humana: true`, hash SHA-256.
- **Validación**: retrieval precision ≥ 0.70; citation accuracy (cada [N] referencia chunk real); hallucination rate 0.

### 4.4 `buscar_jurisprudencia` → RAG + skill `buscar-jurisprudencia`

- **Skill**: `.opencode/skills/buscar-jurisprudencia.md` (v3.0 RAG-optimized, 5 fuentes: PJ, TC, INDECOPI, SUNARP, MINJUS)
- **Grounding obligatorio**: RAG + `web_search` (server tool). **NUNCA** jurisprudencia sin grounding real.
- **Validación**: `verifier-urls-jurisprudencia.mjs` (HEAD 200), `verifier-fechas.mjs`, `verifier-citas-legales.mjs` contra `catalogs/codigos-leyes.json`; score relevancia ≥ 0.70.
- **Métricas**: retrieval_precision_at_k ≥ 0.85; citation_accuracy ≥ 0.98; latencia p95 < 3s.

### 4.5 `predecir_resultado` → agente `ia-predictor-judicial`

- **Base**: +50,000 sentencias previas (94% accuracy publicitado).
- **DISCLAIMER OBLIGATORIO** en cada output: *"Esto NO es una predicción certera, es un análisis probabilístico basado en sentencias previas"*.
- **Reglas**: mostrar nivel de confianza (bajo/medio/alto); citar sentencias base; NUNCA presentar como verdad absoluta; NUNCA para manipulación de mercado o fraude procesal.
- **Validación**: `verifier-disclaimers.mjs` (4+ disclaimers), `verifier-pii.mjs`.

### 4.6 `chat_legal` (consulta general) → `ai.js`

- **Endpoint real**: `POST /api/ai/chat` (o ruta equivalente del chat, `routes/ai.js`)
- Chat general con contexto opcional de expediente, historial, 4 roles. Sin tool específica (modo directo o chat_legal declarada).

## 5. Eval-set

> **Umbral**: routing accuracy **≥ 90%** en el eval-set completo. Debajo → NO mergear cambios de router/prompts.

### Distribución (180 consultas = 30 por intención × 6)

| Intención | Consultas | Tool esperado | % fallo admisible |
|---|---|---|---|
| REDACTAR_DOCUMENTO | 30 | `redactar_documento` | ≤ 3 |
| CALCULAR_PLAZO | 30 | `calcular_plazo` | ≤ 3 |
| ANALIZAR_EXPEDIENTE | 30 | `analizar_expediente` | ≤ 3 |
| BUSCAR_JURISPRUDENCIA | 30 | `buscar_jurisprudencia` | ≤ 3 |
| PREDECIR_RESULTADO | 30 | `predecir_resultado` | ≤ 3 |
| CONSULTA_LEGAL_GENERAL | 30 | `chat_legal` | ≤ 3 |
| (DIRECTO) | 20 adicionales | sin tool | ≤ 2 |

### Muestra (consultas representativas por intención)

**REDACTAR_DOCUMENTO (30):** demanda de alimentos; demanda de divorcio; demanda laboral por despido; contestación de demanda; apelación de sentencia civil; apelación de sentencia penal; casación civil; casación laboral; amparo contra resolución judicial; hábeas corpus; hábeas data; medida cautelar de embargo; medida cautelar fuera del proceso; acusación fiscal; escrito de sobreseimiento; alegato de clausura; requerimiento de pago; reconvención; queja; reposición; traslado; demanda de desalojo; demanda de reivindicación; demanda de prescripción adquisitiva; demanda de nulidad de acto jurídico; demanda de alimentos del adulto mayor; solicitud de pensión de alimentos; denuncia INDECOPI; escrito de absolución de traslado; memorial simple.

**CALCULAR_PLAZO (30):** plazo para apelar sentencia civil; plazo para contestar demanda laboral; plazo para interponer casación; plazo para ofrecer pruebas; término probatorio; plazo para absolver traslado; plazo de prescripción de la acción penal; plazo de prescripción civil; caducidad de medida cautelar; días hábiles para presentar demanda de amparo; plazo de la investigación preliminar; plazo para recurrir resolución administrativa; cuándo vence el plazo de 5 días; cuántos días tengo para apelar; vence en feriado; computar días hábiles desde notificación; plazo administrativo SUNAT; plazo para reclamar ante INDECOPI; plazo de prórroga de detención; plazo para interponer hábeas corpus; término de la distancia; plazo para pagar costas; cuándo presentar la contestación; plazo para impugnar laudo arbitral; plazo de ejecución de sentencia; vencimiento de medida de protección; plazo del procedimiento de alimentos; cuánto tengo para quejarme; fecha de vencimiento del plazo de gracia; calcular con feriados 2026.

**ANALIZAR_EXPEDIENTE (30):** analiza el expediente 2026-001; revisa mi caso; qué riesgos tiene el expediente; fortalezas y debilidades del caso; estrategia procesal; resumen del expediente; detecta nulidades; análisis completo del expediente; ¿hay vicio procesal?; valoración de pruebas; calificación jurídica de los hechos; análisis de la demanda; riesgos de la pretensión; ¿conviene conciliar?; análisis de la contestación; examen de la prueba documental; evaluación de testigos; análisis de prescripción en el expediente; estudio del expediente penal; análisis de la investigación preliminar; riesgos del proceso laboral; estrategia para juicio oral; análisis de medidas cautelares del expediente; resumen ejecutivo para cliente; análisis de jurisprudencia aplicable al expediente; verificación de plazos en el expediente; análisis de la sentencia de primera instancia; preparación de apelación desde el expediente; análisis de costos del proceso; revisión de ofrecimiento de pruebas.

**BUSCAR_JURISPRUDENCIA (30):** busca jurisprudencia sobre desalojo; precedentes del TC sobre habeas corpus; casaciones sobre despido arbitrario; sentencias sobre violencia familiar; jurisprudencia INDECOPI consumidor; resoluciones SUNARP calificación registral; opiniones MINJUS derecho penal; precedentes vinculantes sobre debido proceso; casaciones civiles sobre prescripción adquisitiva; sentencias TC sobre libertad de expresión; jurisprudencia sobre alimentos; casaciones laborales sobre CTS; precedentes sobre tutela procesal efectiva; sentencias sobre responsabilidad civil médica; jurisprudencia sobre contratos de arrendamiento; casaciones sobre nulidad de acto jurídico; precedentes sobre reparación civil; sentencias sobre lavado de activos; jurisprudencia sobre cobro de deudas; casaciones sobre reivindicación; sentencias TC sobre igualdad; jurisprudencia sobre propiedad intelectual; resoluciones INDECOPI dumping; precedentes sobre protección al consumidor; sentencias sobre seguridad social; jurisprudencia sobre migración; casaciones sobre sucesiones; precedentes sobre arbitrariedad administrativa; sentencias sobre delito de omisión de asistencia familiar; jurisprudencia sobre alimentos del adulto mayor.

**PREDECIR_RESULTADO (30):** qué probabilidad tengo de ganar; predice el resultado del expediente 2026-001; ¿vamos a ganar la demanda?; chances del caso; porcentaje de éxito de la apelación; ¿ganamos el juicio?; predicción del desalojo; probabilidad de ganar la casación; resultado probable de la demanda laboral; ¿qué tan probable es ganar?; predicción del amparo; análisis probabilístico del expediente; ¿tenemos posibilidad de éxito?; predicción de la acusación fiscal; probabilidad de sobreseimiento; chances de la medida cautelar; resultado del proceso penal; predicción del divorcio; probabilidad de ganar la reivindicación; ¿ganamos la prescripción adquisitiva?; predicción del juicio oral; chances de la nulidad procesal; resultado probable de la conciliación; predicción del cobro de deuda; probabilidad de éxito del habeas corpus; predicción del tribunal fiscal; chances de la denuncia INDECOPI; resultado probable de la arbitraje; predicción del proceso de alimentos; ¿qué resultado esperar del expediente X?

**CONSULTA_LEGAL_GENERAL (30):** qué dice el artículo 144 CPC; diferencia entre prescripción y caducidad; ¿es legal grabar una conversación?; explícame la responsabilidad civil; concepto de dolo; definición de cosa juzgada; qué dice el artículo 132 CP; ¿es ilegal no pagar la pensión?; explicación de la Ley 29733; qué norma regula el arrendamiento; ¿qué es el habeas corpus?; diferencia entre amparo y hábeas data; qué dice el TUO IGV sobre facturación; concepto de buena fe; definición de posesión; qué es el debido proceso; norma sobre violencia familiar; explicación del silencio administrativo; qué dice la LPCL sobre despido; diferencia entre contrato y convenio; concepto de usufructo; qué es la prescripción adquisitiva; norma sobre datos personales; explicación del IR de 5ta categoría; qué dice la Ley 30225; concepto de evicción; qué es el pacto comisorio; diferencia entre dolo y culpa; explicación del derecho de superficie; qué es la conciliación extrajudicial.

### Cómo correr el eval

```bash
# Router + catálogo (validar JSON primero)
node -e "JSON.parse(require('fs').readFileSync('catalogs/chat-intent-functions.json','utf8'))"

# Correr eval-set (script de referencia en tools/eval/router-eval.mjs — ver roadmap)
# Output esperado: routing_accuracy >= 0.90 por intención y global
```

**Guardas de merge:**
- [ ] routing_accuracy ≥ 90% global
- [ ] routing_accuracy ≥ 85% en la peor intención
- [ ] latencia FASE 0 (regex) < 5ms
- [ ] latencia p95 end-to-end < 5s (jurisprudencia) / < 3s (resto)
- [ ] Sin regresión en eval-set anterior (regression detector)

## 6. Anti-patrones

1. **NO usar FC solo para devolver JSON**: si la tool no ejecuta un servicio real, no es FC real. El FC del router SIEMPRE ejecuta backend.
2. **NO devolver los `args` del modelo como resultado**: `calcular_plazo` no responde con el JSON de argumentos; ejecuta `plazos.js` y devuelve la fecha real calculada.
3. **NO más de 8 tools por request**: el catálogo tiene 5; si crece, priorizar por rol o subdividir catálogos.
4. **NO jurisprudencia sin grounding**: `buscar_jurisprudencia` requiere RAG/web_search; si no hay resultados reales, decirlo explícitamente (nunca inventar expedientes o casaciones).
5. **NO temperatura > 0.5 en el router**: la FASE 1 LLM (selección de intención) debe usar temperatura **0.1–0.3**; recomendado **0.2**. Legal → determinismo.
6. **NO cambiar prompt sin eval-set verde**: todo cambio de router/function declarations requiere eval ≥ 90% antes de merge.
7. **NO llamar a MiniMax directamente**: todo pasa por `providerRouter.js` (OPENCODE-FIRST, MiniMax fallback). Nunca importar `@minimax/sdk` en el router.
8. **NO ignorar disclaimers**: `predecir_resultado` y `redactar_documento` exigen disclaimer IA + consentimiento de transferencia internacional (LPDP art. 21).
9. **NO eliminar FASE 0**: las regex son la guarda determinista de costo ~0; el LLM solo decide en casos ambiguos.
10. **NO hardcodear prompts en el router**: system prompts y descriptions viven en catálogos (`chat-intent-functions.json`) y skills, no embebidos en código.
11. **NO inventar `fecha_inicio` con default a hoy** (v1.1.0): si el usuario pregunta por un plazo sin fecha explícita, devolver ficha del catálogo + pedir fecha; NUNCA calcular vencimiento desde hoy (información falsa). Ver §6.1.A.
12. **NO quedarse con el primer match en empate de score** (v1.1.0): `resolverPlazoId` debe desempatar por suma de prefijos comunes más largos; stems de 5 chars colisionan (conte→contencioso/Contestación). Ver §6.1.B.

## 6.1 Patrones descubiertos en producción (v1.1.0)

> **Lecciones aprendidas del fix P0 (auditor-legal 2026-08-08)** — agregar al eval-set.

### A) "Consulta conceptual de plazo" (sin fecha_inicio)

**Anti-patrón detectado**: preguntar "¿Cuánto tiempo tengo para demandar contencioso-administrativo?" entraba al FC con `fecha_inicio` requerida y el modelo se atascaba en loop pidiendo fecha. **Causa raíz**: `args.fecha_inicio || new Date()` inventaba la fecha de hoy por defecto, devolviendo una fecha de vencimiento FALSA y confundiendo al usuario.

**Regla nueva**:
- `fecha_inicio` explícita del usuario (string no vacío o `Date` válido) → calcular fecha de vencimiento como antes.
- `fecha_inicio` ausente, vacía o `null` → devolver ficha del catálogo (`acto_procesal`, `base_legal`, `dias`, `tipo`, `consecuencia`, `nota`) con `fecha_vencimiento: null`, `dias_calendario: null`, `requiere_fecha_inicio: true`, y pedir fecha para cálculo exacto.

**Tests obligatorios**:
- "demandar contencioso-administrativo" sin fecha → `plazo_contencioso_administrativo`, `dias_naturales: 90`, `requiere_fecha_inicio: true`.
- "apelar sentencia civil" sin fecha → `dias_habiles: 10`, `requiere_fecha_inicio: true`.
- "prescripción penal" sin fecha → cae en rama legacy (`dias_habiles: null`, sin `requiere_fecha_inicio`).

### B) Desempate en `resolverPlazoId` por prefijo común

**Anti-patrón detectado**: stem matching con 5 chars genera colisiones. "conte" matchea con `contestacion` (Contestación de demanda civil, laboral) Y con `contencioso-administrativo`. Cuando el input es "demandar contencioso-administrativo", los 3 plazos empatan con score 4 y el algoritmo devolvía el primero del catálogo (`plazo_contestacion_demanda_civil`) — información incorrecta.

**Regla nueva**:
- Mantener score principal `matActo * 2 + matMateria` (compat con eval-set).
- En empate de score, usar **suma de prefijos comunes más largos** entre cada token del input y cada palabra del acto del catálogo como tie-breaker.

**Tests obligatorios**:
- "demandar contencioso-administrativo" → `plazo_contencioso_administrativo` (antes `plazo_contestacion_demanda_civil`).
- "prescripción civil" → `plazo_prescripcion_civil` (no `plazo_contestacion_demanda_civil` por colisión de `conte`).

## 7. Métricas

| Métrica | Objetivo | Cómo se mide |
|---|---|---|
| routing_accuracy | ≥ 90% | eval-set 180 consultas + 20 directas |
| FASE 0 hit-rate | ≥ 85% | % de consultas resueltas por regex sin LLM |
| latencia FASE 0 | < 5ms | timer en FASE 0 |
| latencia p95 end-to-end | < 3s (resto) / < 5s (jurisprudencia) | logs con `withTiming` |
| coste por request | ≤ $0.10 | auditor-cost-ia (verifier-costo-tokens) |
| tool_activation_rate | ≥ 95% | % de llamadas FC que ejecutan tool real |
| fallback_rate (DIRECTO indebido) | ≤ 10% | % de consultas con tool esperada que caen a directo |
| determinismo | variación < 5% | misma consulta 3× → misma intención |
| temperatura router | 0.2 (máx 0.3) | config del adaptador |

## 8. Referencias

- `catalogs/chat-intent-functions.json` (catálogo canónico)
- `legalpro-app/server/utils/providerRouter.js` (mapTools, mapToolChoice, normalizeResponse)
- `legalpro-app/server/routes/plazos.js` (calcular_plazo)
- `legalpro-app/server/routes/documento-chat.js` (redactar_documento)
- `legalpro-app/server/routes/ai.js` (chat_legal)
- `.opencode/skills/buscar-jurisprudencia.md` (buscar_jurisprudencia)
- `.opencode/skills/redactar-escrito-legal.md` (redactar_documento)
- `.opencode/skills/analizar-expediente.md` (analizar_expediente)
- `catalogs/plazos-procesales.json` (cálculo de plazos)
- `catalogs/codigos-leyes.json` (validación de citas)
- `catalogs/disclaimers-ia.json` (disclaimers obligatorios)
- `tools/verifiers/verifier-citas-legales.mjs`
- `tools/verifiers/verifier-urls-jurisprudencia.mjs`
