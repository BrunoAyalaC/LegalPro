// legalpro-app/server/legal-router.js
// Router de especialidades legales - detecta qué juniors activar
// Generado por @abogado-chief + @arquitecto-chief

// Mapa de palabras clave a especialidades
const KEYWORD_MAP = {
  // Civil
  'civil': ['civil', 'contrato', 'propiedad', 'obligacion', 'posesion', 'prescripcion', 'usucapion', 'servidumbre', 'hipoteca'],
  // Familia
  'familia': ['familia', 'alimentos', 'divorcio', 'tenencia', 'patria potestad', 'adopcion', 'matrimonio', 'union de hecho', 'violencia familiar'],
  // Penal sustantivo
  'penal': ['penal', 'delito', 'imputabilidad', 'tipicidad', 'antijuridicidad', 'culpabilidad', 'lesiones', 'hurto', 'robo', 'estafa'],
  // Penal económico
  'penal-economico': ['lavado', 'activos', 'corrupcion', 'peculado', 'colusion', 'concussion', 'enriquecimiento ilicito', 'mineria ilegal'],
  // Procesal penal
  'procesal-penal': ['procesal', 'investigacion preparatoria', 'acusacion', 'juzgamiento', 'prueba ilicita', 'apelacion penal'],
  // Constitucional
  'amparo': ['amparo', 'habeas corpus', 'habeas data', 'accion popular', 'proceso constitucional'],
  // Crimen organizado
  'crimen-organizado': ['organizacion criminal', 'banda criminal', 'ley 30077', 'narcotrafico'],
  // Trata
  'trabajo-forzoso': ['trata', 'explotacion laboral', 'trabajo forzado', 'trabajo infantil', 'esclavitud'],
  // Comercial
  'comercial': ['comercial', 'sociedad', 'sociedad anonima', 'sac', 'srl', 'accionista', 'junta general', 'escritura publica'],
  // PI
  'propiedad-intelectual': ['propiedad intelectual', 'marca', 'patente', 'derecho de autor', 'indecopi', 'licencia'],
  // Notarial
  'notarial': ['notario', 'notarial', 'escritura publica', 'protocolo', 'fe publica', 'sunarp'],
  // Consumidor
  'consumidor': ['consumidor', 'idc', 'indecopi', 'reclamo', 'publicidad engañosa', 'producto defectuoso'],
  // Arbitraje
  'arbitraje': ['arbitraje', 'laudo arbitral', 'tribunal arbitral', 'centro de arbitraje', 'conciliacion'],
  // Administrativo
  'administrativo': ['administrativo', 'procedimiento administrativo', 'silencio administrativo', 'recurso administrativo', 'tuoley'],
  // Tributario
  'tributario': ['tributario', 'sunat', 'igv', 'renta', 'impuesto', 'tributo', 'fiscal', 'tasa', 'contribucion'],
  // Concursal
  'concursal': ['concursal', 'quiebra', 'reorganizacion', 'refinanciamiento', 'insolvencia', 'indecopi concursal'],
  // Ambiental
  'ambiental': ['ambiental', 'minam', 'oeFA', 'eia', 'impacto ambiental', 'recurso natural', 'contaminacion'],
  // Minería
  'mineria-energia': ['mineria', 'minero', 'osinergmin', 'ingemmet', 'canon minero', 'regalias', 'energia electrica', 'hidrocarburos'],
  // Sanitario
  'sanitario': ['sanitario', 'salud', 'minsa', 'susalud', 'historia clinica', 'consentimiento informado', 'responsabilidad medica'],
  // Educación
  'educacion': ['educacion', 'minedu', 'sunedu', 'universitario', 'carrera docente', 'ley 28044', 'ley 30220'],
  // Compliance
  'compliance': ['compliance', 'lavado de activos', 'uif', 'sbs', 'ofac', 'modelo de prevencion', 'dso'],
  // Laboral colectivo
  'laboral-colectivo': ['sindicato', 'huelga', 'convenio colectivo', 'libertad sindical', 'fuero sindical', 'pliego de reclamos'],
  // Seguridad social
  'seguridad-social': ['pension', 'onp', 'afp', 'essalud', 'sctr', 'jubilacion', 'cesantia'],
  // Migratorio
  'migratorio': ['migratorio', 'extranjeria', 'migraciones', 'visa', 'residencia', 'refugio', 'deportacion'],
  // Forense contable
  'forense': ['peritaje contable', 'fraude contable', 'lavado', 'auditoria forense', 'cuantificacion daño patrimonial']
};

// Mapeo de especialidades a "abogado-senior-X" responsable
const SPECIALTY_TO_SENIOR = {
  'civil': 'abogado-senior-civil',
  'familia': 'abogado-senior-civil',
  'comercial': 'abogado-senior-civil',
  'propiedad-intelectual': 'abogado-senior-civil',
  'notarial': 'abogado-senior-civil',
  'consumidor': 'abogado-senior-civil',
  'arbitraje': 'abogado-senior-civil',
  'penal': 'abogado-senior-penal',
  'penal-economico': 'abogado-senior-penal',
  'procesal-penal': 'abogado-senior-penal',
  'crimen-organizado': 'abogado-senior-penal',
  'trabajo-forzoso': 'abogado-senior-penal',
  'amparo': 'abogado-senior-constitucional',
  'administrativo': 'abogado-senior-publico',
  'tributario': 'abogado-senior-publico',
  'concursal': 'abogado-senior-empresarial',
  'ambiental': 'abogado-senior-publico',
  'mineria-energia': 'abogado-senior-publico',
  'sanitario': 'abogado-senior-publico',
  'educacion': 'abogado-senior-publico',
  'compliance': 'abogado-senior-empresarial',
  'laboral-colectivo': 'abogado-senior-laboral',
  'seguridad-social': 'abogado-senior-laboral',
  'migratorio': 'abogado-senior-laboral',
  'forense': 'abogado-senior-empresarial'
};

/**
 * Detecta las especialidades relevantes a partir de la query
 */
function detectSpecialties(query, context = {}) {
  const lowerQuery = (query || '').toLowerCase();
  const detected = new Set();

  // Si el contexto especifica especialidades, usarlas
  if (context.specialties && Array.isArray(context.specialties)) {
    context.specialties.forEach(s => detected.add(s));
  }

  // Detectar por palabras clave
  for (const [specialty, keywords] of Object.entries(KEYWORD_MAP)) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        detected.add(specialty);
        break;
      }
    }
  }

  // Si no se detecto nada, usar "civil" como default (el mas comun)
  if (detected.size === 0) {
    detected.add('civil');
  }

  // Limitar a max 5 especialidades (para no exceder el contexto)
  return Array.from(detected).slice(0, 5);
}

/**
 * Determina que abogado-senior debe consolidar la respuesta
 */
function determineSenior(specialties) {
  if (specialties.length === 0) return 'abogado-senior-civil';
  // Si hay especialidades claras, usar la primera
  return SPECIALTY_TO_SENIOR[specialties[0]] || 'abogado-senior-civil';
}

/**
 * Sugiere el abogado-senior mas apropiado para una consulta inicial
 * (Usado en opencode.json para configurar al agente principal)
 */
function suggestSeniorForQuery(query) {
  const specialties = detectSpecialties(query);
  return determineSenior(specialties);
}

export {
  KEYWORD_MAP,
  SPECIALTY_TO_SENIOR,
  detectSpecialties,
  determineSenior,
  suggestSeniorForQuery
};

const legalRouter = { detectSpecialties, determineSenior, suggestSeniorForQuery };
export { legalRouter };
export default legalRouter;
