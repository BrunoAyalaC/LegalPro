/**
 * Utilidad de detección de datos sensibles según LPDP peruana (Art. 4 inc. 7).
 * 
 * Detecta: salud, ideología política, origen racial, filiación sindical,
 * datos biométricos, orientación sexual, creencias religiosas.
 * 
 * @param {string} texto - Texto a analizar
 * @returns {{esSensible: boolean, severidad: string, patrones: string[], recomendacion: string}}
 */
export function detectarDatosSensibles(texto) {
  if (!texto || typeof texto !== 'string') {
    return {
      esSensible: false,
      severidad: 'ninguna',
      patrones: [],
      recomendacion: 'Sin contenido para analizar',
    };
  }

  const patrones = [];
  const lower = texto.toLowerCase();

  const categorias = [
    {
      id: 'salud',
      regex: /\b(salud|enfermedad|hospital|clínica|diagnóstico|tratamiento médico|discapacidad|psicólogo|psiquiatría|vih|sida|cáncer|diabetes|hipertensión|enfermo|paciente|cuadro clínico)\b/gi,
    },
    {
      id: 'ideologia_politica',
      regex: /\b(ideología política|partido político|militante|simpatizante|comunista|socialista|liberal|conservador|aprista|fujimorista|política partidaria|afiliación política)\b/gi,
    },
    {
      id: 'origen_racial',
      regex: /\b(origen racial|etnia|indígena|afroperuano|mestizo|raza|discriminación racial|comunidad nativa|quechua|aymara|amazónico)\b/gi,
    },
    {
      id: 'filiacion_sindical',
      regex: /\b(sindicato|sindical|filiación sindical|gremio|trabajadores sindicalizados|huelga|negociación colectiva|sindicalización)\b/gi,
    },
    {
      id: 'datos_biometricos',
      regex: /\b(biométrico|huella dactilar|reconocimiento facial|iris|adn|genética|marcadores genéticos|huella digital|escaneo ocular)\b/gi,
    },
    {
      id: 'orientacion_sexual',
      regex: /\b(orientación sexual|homosexual|gay|lesbiana|bisexual|transgénero|lgbt|identidad de género|transexual|intersexual)\b/gi,
    },
    {
      id: 'creencias_religiosas',
      regex: /\b(creencia religiosa|religión|católico|evangélico|protestante|judío|musulmán|ateo|agnóstico|iglesia|templo|budista|hindú)\b/gi,
    },
  ];

  for (const cat of categorias) {
    if (cat.regex.test(lower)) {
      patrones.push(cat.id);
    }
  }

  let severidad = 'ninguna';
  if (patrones.length >= 3) severidad = 'alta';
  else if (patrones.length >= 2) severidad = 'media';
  else if (patrones.length === 1) severidad = 'baja';

  const recomendaciones = {
    alta: 'ALERTA: Se detectaron múltiples categorías de datos sensibles. Se requiere consentimiento expreso adicional y medidas de seguridad reforzadas (Art. 4 inc. 7 LPDP).',
    media: 'ATENCIÓN: Se detectaron datos sensibles. Se recomienda verificar consentimiento explícito del titular.',
    baja: 'Precaución: Posible dato sensible detectado. Revise el contenido antes de procesar.',
    ninguna: 'No se detectaron datos sensibles en el contenido analizado.',
  };

  return {
    esSensible: patrones.length > 0,
    severidad,
    patrones,
    recomendacion: recomendaciones[severidad],
  };
}

/**
 * Middleware Express para detectar datos sensibles en el body de la request.
 * Agrega req.datosSensiblesDetectados al objeto de request.
 */
export function middlewareDeteccionSensibles(campos = ['prompt', 'mensaje', 'hechos', 'contenido']) {
  return (req, _res, next) => {
    const textos = [];
    for (const campo of campos) {
      if (req.body?.[campo]) {
        textos.push(String(req.body[campo]));
      }
    }
    const textoCompleto = textos.join(' ');
    req.datosSensiblesDetectados = detectarDatosSensibles(textoCompleto);

    if (req.datosSensiblesDetectados.esSensible && req.logger) {
      req.logger.warn('[LPDP] Datos sensibles detectados en request', {
        userId: req.user?.sub,
        organizationId: req.organizationId,
        severidad: req.datosSensiblesDetectados.severidad,
        patrones: req.datosSensiblesDetectados.patrones,
        path: req.path,
      });
    }

    next();
  };
}
