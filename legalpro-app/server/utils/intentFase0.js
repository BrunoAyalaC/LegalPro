/**
 * FASE 0 — Detección determinista de intención (regex) del Router de Intenciones
 * del chat LegalPro/LexIA.
 *
 * Coste ~0, latencia <5ms, SIN dependencias externas (ESM puro). Si la regex
 * resuelve con alta confianza NO se llama al LLM (FASE 1).
 *
 * Skill: .opencode/skills/enrutamiento-intenciones-chat.md
 * Catálogo: catalogs/chat-intent-functions.json
 *
 * @author BackendNode
 */

/** Normaliza: minúsculas y sin tildes (para regex sin acentos). */
export function normalizar(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Términos gatillo por intención con NIVEL de especificidad:
 *   3 = muy específico (jurisprudencia/precedente → domina a verbos genéricos)
 *   2 = fuerte (verbo de intención: redactar, plazo, analizar, predecir)
 *   1 = débil/genérico (sustantivo de documento, "busca", "resultado")
 * El score de una intención es la suma de niveles de los términos matcheados.
 */
const FASE0 = [
  {
    intent: 'redactar_documento',
    terminos: [
      { nivel: 2, regex: /\b(redact|escrib|elabora|prepara|genera)\w*/ },
      { nivel: 1, regex: /\b(demanda|contestacion|apelacion|casacion|amparo|habeas corpus|medida cautelar|escrito|memorial|alegato|acusacion|sobreseimiento|requerimiento|reconvencion)\b/ },
    ],
  },
  {
    intent: 'calcular_plazo',
    terminos: [
      { nivel: 2, regex: /\b(plazo|venc|prescri|caduc|feriado|termino|comput)\w*|\bcuantos dias\b|\bdias habiles\b|\bdia habil\b|\bcuando presentar\b/ },
    ],
  },
  {
    intent: 'analizar_expediente',
    terminos: [
      { nivel: 2, regex: /\b(analiz|revisa|estudia)\w*|\b(expediente|fortalezas|debilidades|riesgos|nulidades)\b/ },
      { nivel: 1, regex: /\bestrategia (procesal|del caso)\b/ },
    ],
  },
  {
    intent: 'buscar_jurisprudencia',
    terminos: [
      { nivel: 3, regex: /\b(jurisprudencia|precedente\w*|casaciones? sobre|sentencias? sobre|indecopi|sunarp|minjus)\b|\bque ha dicho el (tc|tribunal)\b/ },
      { nivel: 1, regex: /\bbusca\b/ },
    ],
  },
  {
    intent: 'predecir_resultado',
    terminos: [
      { nivel: 2, regex: /\b(predic\w*|probabilidad|chances|vamos a ganar|ganamos|porcentaje de exito|que tan probable)\b/ },
      { nivel: 1, regex: /\bresultado (probable|del caso)\b/ },
    ],
  },
];

/**
 * Prioridad ordinal ante EMPATE de score (skill sección 3):
 * PREDECIR > CALCULAR > REDACTAR > ANALIZAR > BUSCAR
 */
const PRIORIDAD = {
  predecir_resultado: 5,
  calcular_plazo: 4,
  redactar_documento: 3,
  analizar_expediente: 2,
  buscar_jurisprudencia: 1,
};

export const TIPOS_DOCUMENTO = [
  'demanda', 'contestacion', 'apelacion', 'casacion', 'amparo', 'habeas corpus',
  'medida cautelar', 'acusacion', 'sobreseimiento', 'pericial', 'alegato',
  'requerimiento', 'resolucion', 'reconvencion', 'queja', 'reposicion', 'traslado',
];

export const MATERIAS = [
  'penal', 'civil', 'laboral', 'constitucional', 'comercial', 'tributario',
  'administrativo', 'familia',
];

export function extraerUuid(texto) {
  const m = String(texto || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0] : null;
}

export function extraerFecha(texto) {
  const m = String(texto || '').match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

/** Detecta un tipo de documento del catálogo dentro del texto. */
export function detectarTipoDocumentoTexto(texto) {
  const norm = normalizar(texto);
  for (const t of TIPOS_DOCUMENTO) {
    if (norm.includes(normalizar(t))) return t === 'habeas corpus' ? 'habeas_corpus' : t;
  }
  return null;
}

/**
 * Infiere argumentos básicos desde el texto (best-effort; la FASE 1 LLM
 * completa argumentos cuando FASE 0 no es suficiente).
 */
function inferirArgs(intent, texto, norm) {
  const args = { _texto: texto };
  switch (intent) {
    case 'redactar_documento': {
      const tipo = detectarTipoDocumentoTexto(texto);
      if (tipo) args.tipo_documento = tipo;
      const materia = MATERIAS.find((m) => norm.includes(normalizar(m)));
      if (materia) args.materia = materia;
      args.hechos = texto;
      return args;
    }
    case 'calcular_plazo': {
      const fecha = extraerFecha(texto);
      if (fecha) args.fecha_inicio = fecha;
      args.acto_procesal = texto;
      return args;
    }
    case 'analizar_expediente': {
      const uuid = extraerUuid(texto);
      if (uuid) args.expediente_id = uuid;
      if (/fortalezas|debilidades/.test(norm)) args.tipo_analisis = 'fortalezas_debilidades';
      else if (/riesgo/.test(norm)) args.tipo_analisis = 'riesgos';
      else if (/estrategia/.test(norm)) args.tipo_analisis = 'estrategia';
      else if (/resumen/.test(norm)) args.tipo_analisis = 'resumen';
      else args.tipo_analisis = 'completo';
      return args;
    }
    case 'buscar_jurisprudencia': {
      args.query = texto;
      const materia = MATERIAS.find((m) => norm.includes(normalizar(m)));
      if (materia) args.materia = materia;
      return args;
    }
    case 'predecir_resultado': {
      const uuid = extraerUuid(texto);
      if (uuid) args.expediente_id = uuid;
      const materia = MATERIAS.find((m) => norm.includes(normalizar(m)));
      if (materia) args.materia = materia;
      args.tipo_prediccion = 'probabilidad';
      return args;
    }
    default:
      return args;
  }
}

/**
 * Detecta la intención del mensaje con regex (FASE 0).
 * @param {string} texto - Mensaje del usuario (crudo).
 * @returns {{ intent: string, args: object } | null} intención y args inferidos,
 *          o null si ninguna regex matchea con confianza.
 */
export function detectarIntencionFase0(texto) {
  if (!texto || typeof texto !== 'string') return null;
  const norm = normalizar(texto);
  if (!norm.trim()) return null;

  const scores = {};
  for (const def of FASE0) {
    let score = 0;
    for (const t of def.terminos) {
      if (t.regex.test(norm)) score += t.nivel;
    }
    if (score > 0) scores[def.intent] = score;
  }

  const intents = Object.keys(scores);
  if (intents.length === 0) return null;

  // Ganador: mayor score; empate → prioridad ordinal.
  intents.sort((a, b) => {
    if (scores[b] !== scores[a]) return scores[b] - scores[a];
    return PRIORIDAD[b] - PRIORIDAD[a];
  });

  const intent = intents[0];
  return { intent, args: inferirArgs(intent, texto, norm) };
}

/** Stem ligero (primeros 5 chars) para resolver acto_procesal → plazo_id. */
function stemPalabra(w) {
  const s = normalizar(w);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

/** Prefijo común más largo entre dos strings (0 si vacío). */
function prefijoComun(a, b) {
  if (!a || !b) return 0;
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i++;
  return i;
}

/**
 * Resuelve un acto_procesal libre contra el catálogo de plazos (match por
 * tokens + materia, con desempate por prefijo común más largo).
 *
 * SKILL: enrutamiento-intenciones-chat v1.1.0 — fix bug P0 (auditor-legal 2026-08-08).
 * Inputs como "demandar contencioso-administrativo" empatan a varios plazos porque
 * el stem de "conte" matchea tanto con "contencioso-administrativo" como con
 * "contestacion". Para desempatar usamos la SUMA de prefijos comunes (chars):
 * "contencioso-administrativo" comparte 26 chars con "contencioso-administrativa"
 * pero solo 4 con "contestacion" → gana el plazo específico.
 *
 * @param {object} catalog - Contenido de catalogs/plazos-procesales.json
 * @param {string} actoProcesal - Texto del acto (ej: "apelar la sentencia civil")
 */
export function resolverPlazoId(catalog, actoProcesal) {
  if (!actoProcesal) return null;
  const norm = normalizar(actoProcesal);
  const tokens = norm.split(/\s+/).filter((t) => t.length > 3);
  if (tokens.length === 0) return null;

  let mejor = null;
  let mejorScore = 0;
  let mejorPrefijo = 0;
  for (const p of catalog?.plazos || []) {
    const actoNorm = normalizar(p.acto || '');
    const materiaNorm = normalizar(p.materia || '');
    const palabrasActo = actoNorm.split(/\s+/).filter((w) => w.length > 3);
    const stemActo = palabrasActo.map(stemPalabra);
    const stemMateria = materiaNorm.split(/\s+/).filter((w) => w.length > 3).map(stemPalabra);

    // 1) Match por stem (legacy, mantiene compat con eval-set).
    let matActo = 0;
    let sumaPrefijos = 0;
    for (const t of tokens) {
      const st = stemPalabra(t);
      if (st && stemActo.includes(st)) matActo++;
      // Prefijo común máximo de este token contra cualquier palabra del acto.
      for (const pa of palabrasActo) {
        sumaPrefijos += prefijoComun(t, pa);
      }
    }
    const matMateria = tokens.some((t) => {
      const st = stemPalabra(t);
      return st && stemMateria.includes(st);
    }) ? 1 : 0;

    // Score principal (compat) + desempate por suma de prefijos comunes.
    const score = matActo * 2 + matMateria;
    if (
      score > mejorScore
      || (score === mejorScore && sumaPrefijos > mejorPrefijo)
    ) {
      mejorScore = score;
      mejorPrefijo = sumaPrefijos;
      mejor = p;
    }
  }
  return mejor && mejorScore > 0 ? mejor.id : null;
}
