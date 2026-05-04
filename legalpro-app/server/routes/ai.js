import { Router } from 'express';
import { GoogleGenAI, FunctionCallingConfigMode } from '@google/genai';
import db from '../db.js';
import { authMiddleware, tenantMiddleware } from '../middleware/authMiddleware.js';
import { sanitizarPrompt, validarPermisoIA } from '../middleware/promptSanitizer.js';
import { validate } from '../middleware/validate.js';
import { aiConsultaSchema } from '../schemas/aiSchema.js';
import { MensajeRepository } from '../repositories/MensajeRepository.js';
import { middlewareDeteccionSensibles } from '../utils/datosSensibles.js';

const router = Router();
router.use(authMiddleware, tenantMiddleware);
router.use(middlewareDeteccionSensibles(['prompt', 'mensaje', 'hechos', 'contenido']));

/**
 * Valida que el usuario haya aceptado el disclaimer de IA antes de generar contenido.
 * Según principios éticos de IA y normativa peruana, el usuario debe ser informado
 * de que el contenido es generado por IA como borrador.
 */
function validarDisclaimerAceptado(req, res, next) {
  const { disclaimerAceptado } = req.body ?? {};
  if (disclaimerAceptado !== true) {
    req.logger?.warn('[LEGAL] Intento de uso de IA sin aceptar disclaimer', {
      userId: req.user?.sub,
      path: req.path,
      ip: req.ip,
    });
    return res.status(403).json({
      error: 'Debe aceptar el disclaimer de IA antes de generar contenido.',
      code: 'DISCLAIMER_REQUIRED',
    });
  }
  // Trazabilidad legal: loguear aceptación del disclaimer
  req.logger?.info('[LEGAL] Disclaimer de IA aceptado', {
    userId: req.user?.sub,
    organizationId: req.organizationId,
    path: req.path,
    timestamp: new Date().toISOString(),
  });
  next();
}

const mensajeRepo = new MensajeRepository(db);

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY no está configurada. Agrégala en Railway.');
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = 'gemini-3-flash-preview';

// ─── Function declarations para structured outputs legales ───────────────────
const predictorDeclaration = {
  name: 'emitirPrediccion',
  description: 'Emite una predicción estructurada sobre la viabilidad judicial del caso peruano.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      probabilidadExito: {
        type: 'number',
        description: 'Probabilidad de éxito del caso entre 0 y 100.',
      },
      veredictoGeneral: {
        type: 'string',
        description: 'Fallo probable en una o dos oraciones.',
      },
      factoresFavorables: {
        type: 'array',
        items: { type: 'string' },
        description: 'Argumentos y pruebas que benefician al cliente.',
      },
      factoresDesfavorables: {
        type: 'array',
        items: { type: 'string' },
        description: 'Argumentos y pruebas que perjudican al cliente.',
      },
      recomendacion: {
        type: 'string',
        description: 'Estrategia recomendada para el abogado.',
      },
    },
    required: ['probabilidadExito', 'veredictoGeneral', 'factoresFavorables', 'factoresDesfavorables', 'recomendacion'],
  },
};

const analisisDeclaration = {
  name: 'analizarExpediente',
  description: 'Analiza un expediente legal peruano e identifica puntos críticos, inconsistencias y estrategia.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      resumenGeneral: {
        type: 'string',
        description: 'Resumen del caso en 3-5 oraciones.',
      },
      hechosClave: {
        type: 'array',
        items: { type: 'string' },
        description: 'Hechos procesalmente relevantes.',
      },
      inconsistencias: {
        type: 'array',
        items: { type: 'string' },
        description: 'Contradicciones o vacios en el expediente.',
      },
      riesgosProcesales: {
        type: 'array',
        items: { type: 'string' },
        description: 'Riesgos como prescripción, caducidad o nulidades.',
      },
      estrategiaRecomendada: {
        type: 'string',
        description: 'Estrategia de defensa o ataque recomendada.',
      },
    },
    required: ['resumenGeneral', 'hechosClave', 'estrategiaRecomendada'],
  },
};

// ─── Utilidad: construir system prompt con contexto tenant ───────────────────
function buildSystemPrompt(user) {
  return `Eres LexIA, asistente legal IA especializada en derecho peruano para la plataforma LegalPro.
Contexto del usuario:
- Nombre: ${user.nombre_completo ?? 'Usuario'}
- Rol: ${user.rol ?? 'ABOGADO'}
- Especialidad: ${user.especialidad ?? 'GENERAL'}
- Organización: ${user.organization_name ?? 'Sin organización'}

Marco legal aplicable: Código Procesal Civil (CPC), Nuevo Código Procesal Penal (NCPP), Código Civil, Código Penal, legislación laboral y constitucional peruana.
Sistemas de referencia: SINOE, CEJ, INDECOPI, SUNARP, El Peruano.

Responde siempre en español, de forma profesional, precisa y citando artículos o normas cuando corresponda.
NO des consejos médicos, financieros ni fuera del ámbito legal peruano.
NUNCA inventes jurisprudencia o normas — si no tienes certeza, dilo claramente.`;
}

// ─── POST /api/ai/chat ────────────────────────────────────────────────────────
router.post('/chat', validate(aiConsultaSchema), validarDisclaimerAceptado, async (req, res, next) => {
  try {
    const {
      mensaje, historial = [], expediente_id, model,
    } = req.body;
    const orgId = req.organizationId;

    if (!validarPermisoIA(req.user?.rol, 'chat')) {
      return res.status(403).json({ error: 'Su rol no tiene acceso al chat IA.' });
    }

    const { sanitizado: mensajeSanitizado, advertencias } = sanitizarPrompt(mensaje, 'consulta');
    if (advertencias.some(a => a.includes('[SECURITY]'))) {
      req.logger?.warn('[SECURITY] Posible prompt injection en /chat', { userId: req.user?.sub, orgId, advertencias });
    }
    if (!mensajeSanitizado.trim()) {
      return res.status(400).json({ error: 'El mensaje contiene contenido no permitido.' });
    }

    // Contexto adicional del expediente si se provee
    let contextoExpediente = '';
    if (expediente_id) {
      const { rows: [exp] } = await db.query(
        'SELECT numero, titulo, tipo, estado FROM expedientes WHERE id=$1 AND organization_id=$2',
        [expediente_id, orgId]
      );
      if (exp) {
        contextoExpediente = `\n\nExpediente en contexto: ${exp.numero} — ${exp.titulo} (${exp.tipo}, ${exp.estado})`;
      }
    }

    const recentHistory = (historial ?? []).slice(-20);
    const contents = [
      ...recentHistory.map(h => ({
        role: (h.role === 'model' || h.role === 'assistant') ? 'model' : 'user',
        parts: [{ text: h.text ?? h.content ?? '' }],
      })),
      {
        role: 'user',
        parts: [{ text: mensajeSanitizado + contextoExpediente }],
      },
    ];

    const response = await ai.models.generateContent({
      model: model || MODEL,
      contents,
      config: {
        systemInstruction: buildSystemPrompt(req.user),
        maxOutputTokens: 2048,
        temperature: 0.4,
      },
    });

    const respuesta = response.text ?? 'No se pudo obtener respuesta.';

    // Guardar en historial de chat (fire & forget — no bloquea la respuesta)
    mensajeRepo.guardarParMensajes(req.user.sub, orgId, expediente_id ?? null, mensaje, respuesta).catch(() => {});

    return res.json({ respuesta, tokens: response.usageMetadata?.totalTokenCount ?? null });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/ai/consulta ────────────────────────────────────────────────────
router.post('/consulta', validate(aiConsultaSchema), validarDisclaimerAceptado, async (req, res, next) => {
  try {
    const { prompt, tipo = 'general', model } = req.body;

    const tiposValidos = ['general', 'analisis', 'redaccion', 'jurisprudencia', 'predictor', 'alegatos', 'interrogatorio'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ error: `Tipo inválido. Valores: ${tiposValidos.join(', ')}.` });
    }

    const featureMap = {
      predictor: 'predictor', analisis: 'analisis', redaccion: 'redactor',
      jurisprudencia: 'jurisprudencia', alegatos: 'alegato',
      interrogatorio: 'interrogatorio', general: 'chat',
    };
    const feature = featureMap[tipo] ?? 'chat';
    if (!validarPermisoIA(req.user?.rol, feature)) {
      return res.status(403).json({ error: 'Su rol no tiene acceso a esta función IA.' });
    }

    const tipoSanitizacion = ['escrito', 'alegato'].includes(tipo) ? tipo
      : tipo === 'analisis' ? 'expediente'
      : 'consulta';
    const { sanitizado: promptSanitizado, advertencias } = sanitizarPrompt(prompt, tipoSanitizacion);
    if (advertencias.some(a => a.includes('[SECURITY]'))) {
      req.logger?.warn('[SECURITY] Posible prompt injection en /consulta', { userId: req.user?.sub, tipo, advertencias });
    }
    if (!promptSanitizado.trim()) {
      return res.status(400).json({ error: 'El contenido del prompt contiene elementos no permitidos.' });
    }

    const systemPrompts = {
      analisis: 'Eres un analista jurídico experto. Analiza el expediente o documento proporcionado identificando: hechos relevantes, pretensiones, fundamentos jurídicos, pruebas clave, riesgos procesales y estrategia recomendada.',
      redaccion: 'Eres un redactor jurídico experto en escritos legales peruanos. Redacta con estructura formal: sumilla, hechos, fundamentos de derecho, petitorio y firma. Cita artículos específicos del CPC o NCPP según corresponda.',
      jurisprudencia: 'Eres un investigador jurídico especializado en jurisprudencia peruana. Cita precedentes del TC, Corte Suprema e INDECOPI relevantes. Indica el número de expediente o casación cuando sea posible.',
      predictor: 'Eres un analista predictivo judicial. Basándote en la información del caso, evalúa la probabilidad de éxito (porcentaje), factores favorables y desfavorables, casos similares y recomendaciones estratégicas.',
      alegatos: 'Eres un especialista en litigación oral. Redacta alegatos de clausura persuasivos, estructurados en: síntesis de hechos probados, argumentos jurídicos, refutación de la contraparte y petitorio final.',
      interrogatorio: 'Eres un estratega de interrogatorio conforme al NCPP. Diseña preguntas para examen directo y contraexamen, anticipando respuestas y objetivos probatorios.',
    };

    const systemInstruction = systemPrompts[tipo] ?? buildSystemPrompt(req.user);
    const tiposEstructurados = { predictor: predictorDeclaration, analisis: analisisDeclaration };
    const declaration = tiposEstructurados[tipo];

    if (declaration) {
      const response = await ai.models.generateContent({
        model: model || MODEL,
        contents: [{ role: 'user', parts: [{ text: promptSanitizado }] }],
        config: {
          systemInstruction,
          maxOutputTokens: 4096,
          temperature: tipo === 'predictor' ? 0.2 : 0.4,
          tools: [{ functionDeclarations: [declaration] }],
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.ANY,
              allowedFunctionNames: [declaration.name],
            },
          },
        },
      });

      const functionCall = response.functionCalls?.[0];
      const resultado = functionCall?.args
        ?? { error: 'No se obtuvo respuesta estructurada. Intente con más contexto.' };

      return res.json({
        resultado,
        tipo,
        tokens: response.usageMetadata?.totalTokenCount ?? null,
      });
    }

    const response = await ai.models.generateContent({
      model: model || MODEL,
      contents: [{ role: 'user', parts: [{ text: promptSanitizado }] }],
      config: {
        systemInstruction,
        maxOutputTokens: 4096,
        temperature: 0.5,
      },
    });

    return res.json({
      resultado: response.text ?? 'Sin respuesta.',
      tipo,
      tokens: response.usageMetadata?.totalTokenCount ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/ai/consulta/stream (SSE) ───────────────────────────────────────
router.post('/consulta/stream', validate(aiConsultaSchema), validarDisclaimerAceptado, async (req, res, next) => {
  try {
    const { prompt, tipo = 'redaccion', model } = req.body;

    const tiposStream = ['redaccion', 'alegatos', 'interrogatorio', 'chat', 'general'];
    if (!tiposStream.includes(tipo)) {
      return res.status(400).json({ error: `Tipo "${tipo}" no soporta streaming. Usa /consulta.` });
    }

    if (!validarPermisoIA(req.user?.rol, tipo === 'redaccion' ? 'redactor' : tipo)) {
      return res.status(403).json({ error: 'Su rol no tiene acceso a esta función IA.' });
    }

    const { sanitizado: promptSanitizado } = sanitizarPrompt(prompt, tipo === 'redaccion' ? 'escrito' : 'consulta');
    if (!promptSanitizado.trim()) {
      return res.status(400).json({ error: 'El contenido del prompt contiene elementos no permitidos.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const systemPrompts = {
      redaccion: 'Eres un redactor jurídico experto en escritos legales peruanos. Redacta con estructura formal: sumilla, hechos, fundamentos de derecho, petitorio y firma.',
      alegatos: 'Eres un especialista en litigación oral. Redacta alegatos de clausura persuasivos.',
      interrogatorio: 'Eres un estratega de interrogatorio conforme al NCPP. Diseña preguntas para examen directo y contraexamen.',
      chat: 'Eres LexIA, asistente legal IA especializada en derecho peruano.',
      general: 'Eres LexIA, asistente legal IA especializada en derecho peruano.',
    };

    const systemInstruction = systemPrompts[tipo] ?? buildSystemPrompt(req.user);

    const stream = await ai.models.generateContentStream({
      model: model || MODEL,
      contents: [{ role: 'user', parts: [{ text: promptSanitizado }] }],
      config: {
        systemInstruction,
        maxOutputTokens: 4096,
        temperature: 0.5,
      },
    });

    let totalTokens = 0;
    for await (const chunk of stream) {
      const text = chunk.text ?? '';
      if (chunk.usageMetadata?.totalTokenCount) {
        totalTokens = chunk.usageMetadata.totalTokenCount;
      }
      res.write(`data: ${JSON.stringify({ chunk: text }) }\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true, tokens: totalTokens }) }\n\n`);
    res.end();
  } catch (err) {
    if (!res.headersSent) return next(err);
    res.write(`data: ${JSON.stringify({ error: err.message }) }\n\n`);
    res.end();
  }
});

// ─── GET /api/ai/historial ────────────────────────────────────────────────────
router.get('/historial', async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const usuarioId = req.user.sub;
    const { limit = 50, expediente_id } = req.query;

    const historial = await mensajeRepo.obtenerHistorial(usuarioId, orgId, {
      limit: parseInt(limit),
      expedienteId: expediente_id,
    });

    return res.json({ historial });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/ai/notificaciones ──────────────────────────────────────────────
router.get('/notificaciones', async (req, res, next) => {
  try {
    const orgId = req.organizationId;

    const { rows: urgentes } = await db.query(
      `SELECT id, numero, titulo, tipo FROM expedientes
       WHERE organization_id=$1 AND estado='activo'
       ORDER BY created_at DESC
       LIMIT 5`,
      [orgId]
    );

    const notificaciones = (urgentes ?? []).map(exp => ({
      id: exp.id,
      titulo: 'Expediente Urgente',
      mensaje: `${exp.numero} — ${exp.titulo}`,
      tipo: 'urgente',
    }));

    return res.json(notificaciones);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/ai/jurisprudencia ──────────────────────────────────────────────
router.get('/jurisprudencia', async (req, res, next) => {
  try {
    const { q, rama = 'general', limit = 5, model } = req.query;

    if (!q?.trim()) {
      return res.status(400).json({ error: 'El parámetro de búsqueda "q" es requerido.' });
    }

    if (!validarPermisoIA(req.user?.rol, 'jurisprudencia')) {
      return res.status(403).json({ error: 'Su rol no tiene acceso a la búsqueda de jurisprudencia.' });
    }

    const { sanitizado: qSanitizado, advertencias } = sanitizarPrompt(q, 'default');
    if (advertencias.some(a => a.includes('[SECURITY]'))) {
      req.logger?.warn('[SECURITY] Posible prompt injection en /jurisprudencia', { userId: req.user?.sub, advertencias });
    }
    if (!qSanitizado.trim()) {
      return res.status(400).json({ error: 'El parámetro de búsqueda no es válido.' });
    }

    const prompt = `Busca jurisprudencia peruana relevante para: "${qSanitizado}".
Rama del derecho: ${rama}.
Proporciona exactamente ${Math.min(10, parseInt(limit))} resultados en formato JSON con la estructura:
[{
  "tribunal": "nombre del tribunal",
  "numero": "número de expediente o casación",
  "año": "año",
  "resumen": "resumen del fallo en 2-3 oraciones",
  "relevancia": "alta|media|baja",
  "url_referencia": "URL si la conoces con certeza, si no omite este campo"
}]
Solo incluye jurisprudencia real que conozcas con alta certeza. No inventes casos.`;

    const response = await ai.models.generateContent({
      model: model || MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: 'Eres un investigador jurídico especializado en jurisprudencia peruana. Responde ÚNICAMENTE en formato JSON válido, sin markdown ni texto adicional.',
        maxOutputTokens: 2048,
        temperature: 0.1,
      },
    });

    let resultados = [];
    try {
      const raw = response.text?.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '') ?? '[]';
      resultados = JSON.parse(raw);
    } catch {
      resultados = [{ error: 'No se pudo parsear respuesta', raw: response.text }];
    }

    return res.json({ resultados, query: qSanitizado, rama });
  } catch (err) {
    next(err);
  }
});

export default router;
