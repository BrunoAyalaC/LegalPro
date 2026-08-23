/**
 * systemPrompts.js — Prompt Master reutilizable para tools IA del Router LegalPro
 *
 * PROPÓSITO:
 *  Centraliza los bloques de instrucciones que se inyectan en el `systemInstruction`
 *  de las tools del router de intenciones (redactar_documento, analizar_expediente,
 *  buscar_jurisprudencia, predecir_resultado). Cada bloque es una constante exportada,
 *  combinables vía `buildMasterPrompt(...)`. Esto evita:
 *    - Hardcodear textos dentro de intentRouter.js (difícil de evolucionar).
 *    - Pegar prompts largos en cada tool (riesgo de drift entre tools).
 *    - Construir prompts ad-hoc sin las garantías base (idioma, citas, anti-alucinación).
 *
 * DISEÑO (mínima complejidad):
 *  - BLOQUES: constantes exportadas (texto puro). Una pieza = una responsabilidad.
 *  - buildMasterPrompt({ rol, materia, context, preferencias, restricciones }):
 *      componedor ligero que decide qué bloques añadir según los flags del contexto.
 *  - SYSTEM_PROMPT_BASE_ES (de systemPromptBase.js) sigue siendo el bloque OBLIGATORIO
 *    de idioma/formato; se concatena SIEMPRE.
 *
 * REGLAS DURAS (alineadas con el arnés):
 *  - NUNCA hardcodear textos en intentRouter.js: siempre pasar por aquí.
 *  - SIEMPRE idioma es-PE + citas verificables + anti-alucinación.
 *  - El system prompt FINAL de una tool = SYSTEM_PROMPT_BASE_ES + buildMasterPrompt(opts).
 *  - Fail-open: buildMasterPrompt nunca lanza; si los args son inválidos devuelve solo el BASE.
 *
 * SKILL: .opencode/skills/enrutamiento-intenciones-chat.md
 * @author BackendNode
 * @version 1.0.0
 */

import { SYSTEM_PROMPT_BASE_ES, withLegalBase } from './systemPromptBase.js';

// ─── Bloques reusables (constantes exportadas, NO funciones) ─────────────────
// Mantener cada bloque CORTO y focalizado. Si crece demasiado, partir en 2.

// BLOQUE_ROL: ajusta el tono y la profundidad según el rol del usuario autenticado.
// ABOGADO/FISCAL → respuestas técnicas, cita artículos.
// JUEZ → neutralidad y fundamentación.
// CONTADOR → énfasis en cifras, plazos y normativa tributaria/laboral.
// USUARIO (genérico) → lenguaje claro y disclaimers visibles.
export const BLOQUE_ROL = {
  ABOGADO: 'Adopta el rol de asistente jurídico técnico para un abogado colegiado peruano. Prioriza cita exacta de artículos (formato "CPC art. 424"), jurisprudencia vinculante y estrategias procesales. Tono: profesional, directo, sin rodeos.',
  FISCAL: 'Adopta el rol de asistente técnico para un fiscal peruano. Prioriza tipicidad, prueba indiciaria, NCPP y estándar de sospecha suficiente. Tono: institucional, probatorio.',
  JUEZ: 'Adopta el rol de asistente técnico para un magistrado peruano. Prioriza neutralidad, motivación de resoluciones, debido proceso y jurisprudencia vinculante del TC/PJ. Tono: institucional, equilibrado.',
  CONTADOR: 'Adopta el rol de asistente técnico para un contador peruano. Prioriza cifras exactas, plazos tributarios/laborales, PCGE y normativa SUNAT/SBS. Tono: técnico-contable.',
  USUARIO: 'Adopta el rol de asistente jurídico general para un usuario peruano. Usa lenguaje claro y evita jerga innecesaria; incluye disclaimers visibles sobre la necesidad de consultar a un abogado colegiado.',
};

// BLOQUE_POSTURA_PRO_CLIENTE: postura de patrocinio (FIX P0 auditor-legal 2026-08-12).
// Aplica SOLO al rol ABOGADO en consultas de patrocinio ("mi cliente", "a su favor",
// "defender", "qué derechos tengo"). NO aplica a JUEZ (neutralidad) ni FISCAL (acusatorio).
// Propone estrategias A FAVOR de la parte que el usuario representa, pero con
// salvaguardas éticas: base legal verificada, riesgos señalados, sin defensas temerarias.
export const BLOQUE_POSTURA_PRO_CLIENTE = `
POSTURA DE PATROCINIO (rol ABOGADO — defensor de la parte que representas):
1. Identifica la parte que el usuario representa: demandante/demandado, imputado, contribuyente, trabajador, consumidor, etc.
2. Enumera argumentos, derechos, vías procesales y plazos FAVORABLES a esa parte, SIEMPRE con base legal verificada (cita artículo/norma exacta).
3. Propón una estrategia procesal concreta (qué escritos presentar, qué plazos aprovechar, qué medios probatorios ofrecer).
4. SEÑALA los riesgos y contrariedades del caso SIN OCULTARLOS: plazos vencidos, prescripción, prueba débil, jurisprudencia en contra, posición procesal desfavorable.
5. Si la posición del cliente es débil, dilo con claridad y sugiere opciones alternativas (transacción, desistimiento, conciliación) cuando corresponda (CPC art. 132 — buena fe procesal).
6. NO afimes hechos que el usuario no haya aportado. NO promuevas defensas sin base legal (Código de Ética del Abogado — prohibición de litigios temerarios).
7. Si el derecho reclamado NO existe o no encuentras base suficiente, di "no encuentro base suficiente para sustentar esta posición" y propón la vía legal correcta.
8. MARCA la respuesta con disclaimer de postura: "Estrategia sugerida a favor de la parte que el usuario representa; el abogado evalúa su viabilidad jurídica y ética antes de aplicarla."
9. Usa las interpretaciones favorables del catálogo (primacía de realidad, in dubio pro reo, favor libertatis, no confiscatoriedad, inversión de carga probatoria, retracto, etc.) según la materia, siempre que tengan base legal verificada.`;

// BLOQUE_MATERIA: focaliza el dominio jurídico. Solo se añade si la materia es
// una de las soportadas; en caso contrario, no se incluye el bloque.
export const BLOQUE_MATERIA = {
  penal: 'Dominio: DERECHO PENAL peruano. Aplica CP, NCPP, jurisprudencia de casaciones penales y del TC. Especial cuidado con tipicidad, antijuridicidad, culpabilidad y prescripción.',
  civil: 'Dominio: DERECHO CIVIL peruano. Aplica CC, CPC, jurisprudencia civil y del TC. Énfasis en obligaciones, contratos, propiedad, prescripción adquisitiva y responsabilidad civil.',
  laboral: 'Dominio: DERECHO LABORAL peruano. Aplica LPCL, CPCL, jurisprudencia laboral y del TC. Énfasis en CTS (D.L. 650), gratificaciones (Ley 27735), vacaciones, AFP/ONP y beneficios sociales.',
  constitucional: 'Dominio: DERECHO CONSTITUCIONAL peruano. Aplica Constitución 1993, TC, procesos constitucionales (amparo, habeas corpus, habeas data, acción popular). Énfasis en derechos fundamentales y control de convencionalidad.',
  comercial: 'Dominio: DERECHO COMERCIAL/SOCIETARIO peruano. Aplica LGS, títulos valores, contratos mercantiles y regulación INDECOPI.',
  tributario: 'Dominio: DERECHO TRIBUTARIO peruano. Aplica Código Tributario, TUO IGV/IR, jurisprudencia del Tribunal Fiscal y SUNAT.',
  administrativo: 'Dominio: DERECHO ADMINISTRATIVO peruano. Aplica TUO Ley 27444, LPAG, contrataciones del Estado (Ley 30225), OSCE, OEFA, SUNAT, INDECOPI, SUNARP.',
  familia: 'Dominio: DERECHO DE FAMILIA peruano. Aplica CC (Libro III), CPC, jurisprudencia de familia. Énfasis en alimentos, tenencia, divorcio, violencia familiar (Ley 30364).',
  general: 'Dominio: DERECHO PERUANO general (sin materia específica). Basa tus respuestas en el RAG/catálogo provisto y, en su defecto, en el ordenamiento jurídico peruano vigente.',
};

// BLOQUE_OCR_AWARE: indica al modelo que el contenido del expediente proviene de
// una transcripción OCR (puede tener errores tipográficos). Reglas: NO corregir
// silenciosamente, marcar [posible error OCR], reportar artículos no verificados.
export const BLOQUE_OCR_AWARE = `
CONTENIDO DE ORIGEN OCR (transcripción automática): el texto del expediente/documento que vas a analizar proviene de un OCR aplicado a un documento escaneado. Reglas:
1. NO corrijas errores OCR silenciosamente. NO inventes caracteres faltantes.
2. Si detectas un error probable, márcalo: [posible error OCR].
3. Si una palabra es ilegible: [ilegible]. Si una fecha o número parece incompleto: [dato incompleto].
4. Si el bloque fue truncado por límite de contexto (ver marca [texto_truncado:true] en el user), indícalo en el resumen.
5. SEPARACIÓN DE FUENTES (regla de oro):
   - USA el RAG como ÚNICA FUENTE DE VERDAD para NORMATIVA (artículos, códigos, leyes, jurisprudencia).
   - USA el OCR SOLO para HECHOS del caso (partes, fechas procesales, peticiones, narración fáctica).
   - Si un artículo del OCR (ej. "art. 48G CPC") NO aparece en el RAG, repórtalo como "ARTÍCULO NO VERIFICADO" en inconsistencias. NUNCA inventes su contenido.
6. NUNCA inventes plazos, fechas de vencimiento ni artículos. Si no hay base suficiente, di "no encuentro base normativa suficiente" y marca requiere_revision_humana = true.`;

// BLOQUE_RAG: instrucciones para cuando se inyecta contexto del RAG (catálogo legal
// indexado, jurisprudencia verificada, casaciones). Cita formato [N].
export const BLOQUE_RAG = `
CONTEXTO LEGAL VERIFICADO (RAG): si recibes un bloque titulado "BASE LEGAL (RAG)" o similar en el prompt del usuario:
1. USA cada chunk RAG como fuente de verdad (formato [N] donde N es el número de citación).
2. CITA los chunks con el formato [N] (mismo número del bloque RAG). Si tu afirmación proviene de un chunk, indícalo.
3. SEPARACIÓN DE FUENTES: el RAG es la fuente de NORMATIVA y JURISPRUDENCIA; el expediente/OCR es la fuente de HECHOS.
4. Si el RAG devuelve 0 chunks, NO inventes precedentes. Di explícitamente "no encuentro base suficiente" y baja la confianza del output.
5. NUNCA cites casaciones, expedientes o sentencias que NO aparezcan en el bloque RAG. Un número de casación inventado es una falta ética grave.`;

// BLOQUE_LOPD: cumplimiento Ley 29733 (Protección de Datos Personales, Perú).
// Aplica a cualquier tool que pueda tocar PII (partes, DNIs, domicilios, hechos
// que identifiquen personas naturales).
export const BLOQUE_LOPD = `
PROTECCIÓN DE DATOS PERSONALES (Ley 29733, Perú):
1. NO reveles, repitas ni inferas DNI, domicilio, correo personal, número de teléfono, ni datos sensibles (salud, religión, origen) salvo que el usuario los haya proporcionado explícitamente y sean estrictamente necesarios para la consulta.
2. Si el usuario pega PII por error, NO la repitas en la respuesta. Recomienda redactar o anonimizar.
3. Conserva el contexto del caso en la memoria de la sesión solo lo necesario; evita logs que contengan PII sin enmascarar (usa logger.mask).
4. NO transfieras el caso a un proveedor internacional sin consentimiento explícito (consentimiento_internacional=true en la tool).
5. Marca requiere_revision_humana = true cuando el caso involucre datos de menores, violencia familiar o salud.`;

// BLOQUE_FORMATO: estructura y longitud de la respuesta final. Útil para
// controlar tamaño de tokens y mejorar latencia en el router.
export const BLOQUE_FORMATO = `
FORMATO DE RESPUESTA:
- Idea principal primero; luego detalles y matices.
- Usa viñetas o listas numeradas cuando haya más de dos puntos.
- Títulos en MAYÚSCULAS en texto plano (ej. "RESUMEN EJECUTIVO:") — sin markdown pesado salvo que el endpoint lo requiera.
- Longitud: conciso en chat (≤ 250 palabras salvo escritos). En análisis extenso: secciones con encabezados.`;

// BLOQUE_CITAS_LEGALES: reglas duras de citación para evitar alucinaciones.
export const BLOQUE_CITAS_LEGALES = `
CITAS LEGALES (reglas duras anti-alucinación):
- Cita SIEMPRE norma con número y artículo (ej. "CPC art. 424", "NCPP art. 342", "LPCL art. 36").
- NUNCA inventes normas, artículos, jurisprudencia, expedientes ni casaciones. Si no tienes certeza, dilo explícitamente.
- Distingue norma (ley/decreto) de jurisprudencia (precedente/casación) y de doctrina (opinión).
- Si se proporciona contexto legal verificado (RAG/catálogo), úsalo como fuente prioritaria.
- Un número de casación, expediente o artículo inventado invalida la respuesta. Es preferible un "NO SÉ" honesto.`;

// BLOQUE_VELOCIDAD: instrucciones para respuestas más cortas y directas (latencia ↓).
export const BLOQUE_VELOCIDAD = `
VELOCIDAD Y CONCISIÓN:
- Responde de forma directa y breve. Evita preámbulos y razonamiento extenso.
- No repitas la pregunta del usuario; ve al grano.
- Prefiere viñetas cortas a párrafos largos cuando hay más de dos puntos.
- Limita la respuesta al mínimo necesario para responder la consulta del usuario.`;

// ─── Componedor principal ─────────────────────────────────────────────────────

/**
 * Normaliza los args de entrada para evitar inyecciones accidentales y aplicar
 * defaults seguros. NUNCA lanza: si algo viene mal, degrada a defaults.
 */
function _sanitizeArgs({ rol, materia, context, preferencias, restricciones } = {}) {
  const safeRol = (typeof rol === 'string' && BLOQUE_ROL[rol.toUpperCase()]) ? rol.toUpperCase() : 'USUARIO';
  const safeMateria = (typeof materia === 'string' && BLOQUE_MATERIA[(materia || '').toLowerCase()])
    ? materia.toLowerCase()
    : null;
  const safeContext = (context && typeof context === 'object') ? {
    ocr_aware: Boolean(context.ocr_aware),
    rag_aware: Boolean(context.rag_aware),
    lpdp_aware: Boolean(context.lpdp_aware),
    formato: ['corto', 'medio', 'extenso'].includes(context.formato) ? context.formato : 'medio',
  } : { ocr_aware: false, rag_aware: false, lpdp_aware: false, formato: 'medio' };
  const safePreferencias = (preferencias && typeof preferencias === 'object') ? preferencias : {};
  const safeRestricciones = Array.isArray(restricciones)
    ? restricciones.filter((r) => typeof r === 'string' && r.trim().length > 0)
    : [];

  return { safeRol, safeMateria, safeContext, safePreferencias, safeRestricciones };
}

/**
 * Compone el system prompt de una tool del router.
 *
 * Composición (en orden, todos opcionales salvo el base):
 *   1. SYSTEM_PROMPT_BASE_ES (idioma, formato, citas base — SIEMPRE).
 *   2. BLOQUE_ROL según `rol`.
 *   3. BLOQUE_MATERIA si la materia es soportada.
 *   4. BLOQUE_OCR_AWARE si context.ocr_aware.
 *   5. BLOQUE_RAG si context.rag_aware.
 *   6. BLOQUE_LOPD si context.lpdp_aware (default: true para tools con PII).
 *   7. BLOQUE_FORMATO (siempre; controla longitud).
 *   8. BLOQUE_CITAS_LEGALES (siempre; anti-alucinación).
 *   9. BLOQUE_VELOCIDAD si preferencias.velocidad === 'rapida' o context.formato === 'corto'.
 *   10. Restricciones extra (`restricciones` array) — se concatenan al final.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.rol='USUARIO']           - 'ABOGADO'|'FISCAL'|'JUEZ'|'CONTADOR'|'USUARIO'.
 * @param {string}  [opts.materia=null]             - 'civil'|'penal'|...|null|'general'.
 * @param {object}  [opts.context]                  - { ocr_aware?, rag_aware?, lpdp_aware?, formato? }
 * @param {object}  [opts.preferencias]             - { velocidad?: 'normal'|'rapida', tono?, idioma? }
 * @param {string[]} [opts.restricciones]           - Cláusulas extra libres a concatenar.
 * @returns {string} system prompt completo listo para `systemInstruction`.
 */
export function buildMasterPrompt(opts = {}) {
  const { safeRol, safeMateria, safeContext, safePreferencias, safeRestricciones } =
    _sanitizeArgs(opts);

  const piezas = [SYSTEM_PROMPT_BASE_ES.trim()];

  // Rol
  piezas.push(`\n[ROL]\n${BLOQUE_ROL[safeRol]}`);

  // Postura pro-cliente (FIX P0 2026-08-12): SOLO para ABOGADO en consultas de patrocinio.
  // JUEZ mantiene neutralidad; FISCAL mantiene postura acusatoria.
  if (safeRol === 'ABOGADO' && opts.patrocina !== false) {
    piezas.push(`\n[POSTURA DE PATROCINIO]\n${BLOQUE_POSTURA_PRO_CLIENTE.trim()}`);
  }

  // Materia (solo si soportada)
  if (safeMateria && BLOQUE_MATERIA[safeMateria]) {
    piezas.push(`\n[MATERIA: ${safeMateria.toUpperCase()}]\n${BLOQUE_MATERIA[safeMateria]}`);
  }

  // Contexto: OCR / RAG / LOPD
  if (safeContext.ocr_aware) piezas.push(`\n[OCR-AWARE]\n${BLOQUE_OCR_AWARE.trim()}`);
  if (safeContext.rag_aware) piezas.push(`\n[RAG]\n${BLOQUE_RAG.trim()}`);
  if (safeContext.lpdp_aware) piezas.push(`\n[LOPD]\n${BLOQUE_LOPD.trim()}`);

  // Formato
  piezas.push(`\n[FORMATO]\n${BLOQUE_FORMATO.trim()}`);

  // Citas (siempre)
  piezas.push(`\n[REGLAS DE CITACIÓN]\n${BLOQUE_CITAS_LEGALES.trim()}`);

  // Velocidad
  const quiereRapido = safePreferencias.velocidad === 'rapida' || safeContext.formato === 'corto';
  if (quiereRapido) piezas.push(`\n[VELOCIDAD]\n${BLOQUE_VELOCIDAD.trim()}`);

  // Restricciones extra
  if (safeRestricciones.length > 0) {
    piezas.push(`\n[RESTRICCIONES ADICIONALES]\n${safeRestricciones.map((r) => `- ${r}`).join('\n')}`);
  }

  return piezas.join('\n');
}

/**
 * Atajo: equivalente a `withLegalBase(rolInstrucciones + buildMasterPrompt(...))`.
 * Mantiene compat con el patrón legacy `withLegalBase` del módulo base.
 *
 * @param {string} rolInstrucciones - Rol/instrucciones específicas de la tool (parte superior).
 * @param {object} [opts] - Mismos args que buildMasterPrompt.
 * @returns {string} system prompt completo.
 */
export function buildSystemPrompt(rolInstrucciones, opts = {}) {
  const master = buildMasterPrompt(opts);
  const head = (typeof rolInstrucciones === 'string' && rolInstrucciones.trim())
    ? rolInstrucciones.trim()
    : '';
  return withLegalBase(`${head}\n\n${master}`);
}

// ─── Presets convenientes (alias semánticos para tools específicas) ──────────
// Estas son simples envolturas que aplican los flags más usados por cada tool.
// Reducen el código del intentRouter y dejan claro QUÉ contexto necesita cada tool.

/** Preset para la tool `analizar_expediente`: OCR-aware + RAG + LPDP + formato medio. */
export function buildPromptAnalisis(opts = {}) {
  return buildMasterPrompt({
    rol: opts.rol || 'ABOGADO',
    materia: opts.materia || null,
    context: {
      ocr_aware: opts.ocr_aware !== undefined ? opts.ocr_aware : true,
      rag_aware: true,
      lpdp_aware: true,
      formato: opts.formato || 'extenso',
    },
    preferencias: { velocidad: 'normal' },
  });
}

/** Preset para la tool `predecir_resultado`: RAG + LPDP + formato medio, sin OCR. */
export function buildPromptPredictor(opts = {}) {
  return buildMasterPrompt({
    rol: opts.rol || 'ABOGADO',
    materia: opts.materia || null,
    context: { ocr_aware: false, rag_aware: true, lpdp_aware: true, formato: opts.formato || 'medio' },
    preferencias: { velocidad: 'normal' },
    restricciones: [
      'Mantén SIEMPRE "requiere_revision_humana = true" implícito: el abogado debe validar la predicción antes de comunicarla al cliente.',
      'Indica explícitamente el disclaimer del predictor ("Esto NO es una predicción certera, es un análisis probabilístico basado en sentencias previas").',
    ],
  });
}

/** Preset para el router (FASE 1): system prompt del enrutador de intenciones. */
export function buildPromptRouter(opts = {}) {
  const instrucciones = `Eres el Router de Intenciones del chat legal LegalPro/LexIA (derecho peruano).

Analiza el mensaje del usuario y decide UNA de estas opciones:

1. REDACTAR un escrito legal (demanda, contestación, apelación, casación, amparo, hábeas corpus, medida cautelar, memorial, alegato, acusación, requerimiento...) → llama a la herramienta "redactar_documento" con tipo_documento, materia y hechos.
2. CALCULAR un plazo procesal (cuándo vence, cuántos días hábiles, prescripción, caducidad, término, feriado...) → llama a "calcular_plazo" con fecha_inicio (YYYY-MM-DD, usa hoy si no la da) y acto_procesal.
3. ANALIZAR un expediente (riesgos, fortalezas, debilidades, estrategia, resumen del caso, nulidades...) → llama a "analizar_expediente" con expediente_id (si lo menciona) y tipo_analisis.
4. BUSCAR jurisprudencia (casaciones, precedentes vinculantes, sentencias, qué ha dicho el TC, INDECOPI, SUNARP, MINJUS...) → llama a "buscar_jurisprudencia" con query y, si el usuario lo especifica, fuente ('pj'|'tc'|'indecopi').
5. PREDECIR el resultado/probabilidad de éxito de un caso (vamos a ganar, qué probabilidad, chances, porcentaje de éxito...) → llama a "predecir_resultado" con expediente_id (si lo menciona) y materia.
6. Consulta legal general (qué dice la ley, explicación, concepto, diferencia entre...) o saludo/agradecimiento → responde TEXTO DIRECTO, SIN llamar ninguna herramienta.

Reglas:
- Completa los argumentos requeridos de la tool con lo razonable del mensaje; si falta un dato esencial (p. ej. fecha), usa un valor sensato o el más probable.
- NO inventes datos que no estén en el mensaje (expediente_id, fechas, números).
- Si el usuario pide redactar pero además menciona jurisprudencia como apoyo, prioriza la acción principal (redactar).

REGLAS CRÍTICAS DE FORMATO DE SALIDA (obligatorias):
- Cuando decidas TEXTO DIRECTO (opción 6), responde DIRECTAMENTE con la respuesta final al usuario. NUNCA incluyas tu razonamiento interno, análisis del caso, ni prefacios.
- PROHIBIDO empezar con frases como "El usuario pregunta...", "Es una consulta general...", "Esto es una consulta sobre...", "Como asistente...", "Voy a responder...", "Analizando el mensaje...".
- La salida del TEXTO DIRECTO DEBE ser la respuesta legal lista para el usuario, en español peruano, empezando directamente con el contenido.
- NO expliques qué herramienta elegiste ni por qué. NO incluyas "respondo texto directo" ni "llamo a la herramienta X".`;

  return buildMasterPrompt({
    rol: opts.rol || 'USUARIO',
    context: { ocr_aware: false, rag_aware: false, lpdp_aware: false, formato: 'corto' },
    preferencias: { velocidad: 'rapida' },
    restricciones: [instrucciones],
  });
}

// ─── Default export: el compositedor principal ────────────────────────────────
export default buildMasterPrompt;