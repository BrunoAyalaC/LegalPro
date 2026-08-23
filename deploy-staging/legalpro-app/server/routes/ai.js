import { Router } from 'express';
import { GoogleGenAI, FunctionCallingConfigMode } from '@google/genai';
import db from '../db.js';
import { authMiddleware, tenantMiddleware } from '../middleware/authMiddleware.js';
import { sanitizarPrompt, validarPermisoIA } from '../middleware/promptSanitizer.js';
import { validate } from '../middleware/validate.js';
import { aiConsultaSchema } from '../schemas/aiSchema.js';
import { MensajeRepository } from '../repositories/MensajeRepository.js';
import { TokenRepository } from '../repositories/TokenRepository.js';
import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware.js';
import { quotaMiddleware } from '../middleware/quotaMiddleware.js';
import { requireTransferenciaInternacional } from '../middleware/requireTransferenciaInternacional.js';
import { middlewareDeteccionSensibles } from '../utils/datosSensibles.js';
import { hashKey, get, set } from '../cache.js';

const router = Router();
const tokenRepo = new TokenRepository(db);
router.use(authMiddleware, tenantMiddleware);
router.use(middlewareDeteccionSensibles(['prompt', 'mensaje', 'hechos', 'contenido']));

/** Rutas que invocan Gemini (LPDP Art. 21) */
const iaTransferenciaGuard = requireTransferenciaInternacional();

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

// Inicialización perezosa del cliente de IA: una integración opcional ausente
// NO debe tumbar el arranque de toda la API. El error se emite por-petición (503).
let _ai = null;
function getAi() {
  if (!process.env.GEMINI_API_KEY) {
    const err = new Error('El servicio de IA no está disponible (GEMINI_API_KEY no configurada).');
    err.status = 503;
    err.code = 'IA_NO_DISPONIBLE';
    throw err;
  }
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _ai;
}
const MODEL = 'gemini-3.1-flash-lite';

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
router.post('/chat', iaTransferenciaGuard, idempotencyMiddleware(), quotaMiddleware(), validate(aiConsultaSchema), validarDisclaimerAceptado, async (req, res, next) => {
  try {
    const {
      mensaje, historial = [], expediente_id, model,
    } = req.body;
    const orgId = req.organizationId;

    const creditos = await tokenRepo.verificarCreditos(orgId);
    if (creditos <= 0) {
      return res.status(402).json({ error: 'Créditos insuficientes para realizar esta operación.', code: 'INSUFFICIENT_CREDITS' });
    }

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

    const cacheKey = hashKey('chat', mensajeSanitizado, model || MODEL, contextoExpediente);
    const cached = await get(cacheKey);
    if (cached) {
      return res.json({ respuesta: cached, desdeCache: true, tokens: null });
    }

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

    const response = await getAi().models.generateContent({
      model: model || MODEL,
      contents,
      config: {
        systemInstruction: buildSystemPrompt(req.user),
        maxOutputTokens: 2048,
        temperature: 0.4,
      },
    });

    const respuesta = response.text ?? 'No se pudo obtener respuesta.';

    set(cacheKey, respuesta, 7200);

    mensajeRepo.guardarParMensajes(req.user.sub, orgId, expediente_id ?? null, mensaje, respuesta).catch(() => {});

    // Registrar consumo en segundo plano
    const promptTokens = response.usageMetadata?.promptTokenCount || 0;
    const completionTokens = response.usageMetadata?.candidatesTokenCount || 0;
    tokenRepo.registrarConsumo(
      req.user.sub,
      orgId,
      'chat',
      model || MODEL,
      promptTokens,
      completionTokens,
      req.headers['x-idempotency-key'] || null
    ).catch(err => {
      req.logger?.error('Error al registrar consumo en chat:', err);
    });

    // Debitar 1 crédito por consulta de chat (no bloquear respuesta si falla registro contable)
    try {
      await tokenRepo.debitarCreditos(req.user.sub, orgId, expediente_id || null, 1, 'Consulta de Chat');
    } catch (creditErr) {
      req.logger?.error('debitarCreditos chat:', creditErr);
      const msg = String(creditErr.message || '');
      if (msg.includes('insuficientes') || msg.includes('Insuficiente')) {
        return res.status(402).json({ error: msg, code: 'INSUFFICIENT_CREDITS' });
      }
      // Respuesta IA ya generada — loguear pero no romper UX con error SQL
    }

    return res.json({ respuesta, tokens: response.usageMetadata?.totalTokenCount ?? null });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/ai/consulta ────────────────────────────────────────────────────
router.post('/consulta', iaTransferenciaGuard, idempotencyMiddleware(), quotaMiddleware(), validate(aiConsultaSchema), validarDisclaimerAceptado, async (req, res, next) => {
  try {
    const { prompt, tipo = 'general', model } = req.body;
    const orgId = req.organizationId;

    const creditos = await tokenRepo.verificarCreditos(orgId);
    if (creditos <= 0) {
      return res.status(402).json({ error: 'Créditos insuficientes para realizar esta operación.', code: 'INSUFFICIENT_CREDITS' });
    }

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

    const cacheKey = hashKey('consulta', promptSanitizado, tipo, model || MODEL);
    const cached = await get(cacheKey);
    if (cached) {
      return res.json(cached);
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
      const response = await getAi().models.generateContent({
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

      if (tipo === 'predictor' && resultado && resultado.probabilidadExito !== undefined) {
        try {
          const orgId = req.organizationId;
          const userId = req.user?.sub;
          await db.query(
            `INSERT INTO predicciones_judiciales (
              usuario_id, organization_id, tipo_proceso, materia, probabilidad_exito, analisis_ia, factores_favorables, factores_desfavorables, recomendaciones
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              userId,
              orgId,
              'GENERAL',
              'GENERAL',
              resultado.probabilidadExito,
              JSON.stringify({ veredictoGeneral: resultado.veredictoGeneral }),
              JSON.stringify(resultado.factoresFavorables || []),
              JSON.stringify(resultado.factoresDesfavorables || []),
              JSON.stringify([resultado.recomendacion || ''])
            ]
          );
        } catch (dbErr) {
          req.logger?.error('Error al guardar predicción judicial en la base de datos:', dbErr);
        }
      }

      // Registrar consumo de tokens
      const promptTokens = response.usageMetadata?.promptTokenCount || 0;
      const completionTokens = response.usageMetadata?.candidatesTokenCount || 0;
      tokenRepo.registrarConsumo(
        req.user?.sub,
        req.organizationId,
        `consulta_${tipo}`,
        model || MODEL,
        promptTokens,
        completionTokens,
        req.headers['x-idempotency-key'] || null
      ).catch(err => {
        req.logger?.error(`Error al registrar consumo en consulta estructurada (${tipo}):`, err);
      });

      // Debitar 1 crédito por consulta estructurada
      try {
        await tokenRepo.debitarCreditos(req.user?.sub, req.organizationId, req.body.expediente_id || null, 1, `Consulta Inteligente Estructurada: ${tipo}`);
      } catch (creditErr) {
        return res.status(402).json({ error: creditErr.message, code: 'INSUFFICIENT_CREDITS' });
      }

      const payload = { resultado, tipo, tokens: response.usageMetadata?.totalTokenCount ?? null };
      set(cacheKey, payload, 7200);
      return res.json(payload);
    }

    const response = await getAi().models.generateContent({
      model: model || MODEL,
      contents: [{ role: 'user', parts: [{ text: promptSanitizado }] }],
      config: {
        systemInstruction,
        maxOutputTokens: 4096,
        temperature: 0.5,
      },
    });

    // Registrar consumo de tokens
    const promptTokens = response.usageMetadata?.promptTokenCount || 0;
    const completionTokens = response.usageMetadata?.candidatesTokenCount || 0;
    tokenRepo.registrarConsumo(
      req.user?.sub,
      req.organizationId,
      `consulta_${tipo}`,
      model || MODEL,
      promptTokens,
      completionTokens,
      req.headers['x-idempotency-key'] || null
    ).catch(err => {
      req.logger?.error(`Error al registrar consumo en consulta libre (${tipo}):`, err);
    });

    const payload = { resultado: response.text ?? 'Sin respuesta.', tipo, tokens: response.usageMetadata?.totalTokenCount ?? null };
    set(cacheKey, payload, 7200);
    return res.json(payload);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/ai/consulta/stream (SSE) ───────────────────────────────────────
router.post('/consulta/stream', iaTransferenciaGuard, quotaMiddleware(), validate(aiConsultaSchema), validarDisclaimerAceptado, async (req, res, next) => {
  try {
    const { prompt, tipo = 'redaccion', model } = req.body;
    const orgId = req.organizationId;

    const creditos = await tokenRepo.verificarCreditos(orgId);
    if (creditos <= 0) {
      return res.status(402).json({ error: 'Créditos insuficientes para realizar esta operación.', code: 'INSUFFICIENT_CREDITS' });
    }

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

    const stream = await getAi().models.generateContentStream({
      model: model || MODEL,
      contents: [{ role: 'user', parts: [{ text: promptSanitizado }] }],
      config: {
        systemInstruction,
        maxOutputTokens: 4096,
        temperature: 0.5,
      },
    });

    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    for await (const chunk of stream) {
      const text = chunk.text ?? '';
      if (chunk.usageMetadata) {
        promptTokens = chunk.usageMetadata.promptTokenCount || promptTokens;
        completionTokens = chunk.usageMetadata.candidatesTokenCount || completionTokens;
        totalTokens = chunk.usageMetadata.totalTokenCount || totalTokens;
      }
      res.write(`data: ${JSON.stringify({ chunk: text }) }\n\n`);
    }

    // Registrar consumo en segundo plano
    if (totalTokens > 0) {
      tokenRepo.registrarConsumo(
        req.user?.sub,
        req.organizationId,
        `stream_${tipo}`,
        model || MODEL,
        promptTokens || Math.round(promptSanitizado.length / 4),
        completionTokens || Math.max(0, totalTokens - promptTokens),
        req.headers['x-idempotency-key'] || null
      ).catch(err => {
        req.logger?.error(`Error al registrar consumo en stream (${tipo}):`, err);
      });

      // Debitar 1 crédito por consulta en stream
      try {
        await tokenRepo.debitarCreditos(req.user?.sub, req.organizationId, req.body.expediente_id || null, 1, `Consulta Streaming: ${tipo}`);
      } catch (creditErr) {
        req.logger?.error('Error debitando créditos en stream:', creditErr);
      }
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

// ─── DELETE /api/ai/historial ─────────────────────────────────────────────────
// Limpia el historial de chat del usuario. Si se provee expediente_id, solo
// elimina los mensajes asociados a ese expediente.
router.delete('/historial', async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const usuarioId = req.user.sub;
    const { expediente_id } = req.query;

    const eliminados = await mensajeRepo.eliminarHistorial(usuarioId, orgId, {
      expedienteId: expediente_id || undefined,
    });

    req.logger?.info('[CHAT] Historial eliminado', {
      userId: usuarioId,
      orgId,
      expedienteId: expediente_id || null,
      cantidad: eliminados,
    });

    return res.json({
      mensaje: 'Historial eliminado correctamente.',
      eliminados,
    });
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
router.get('/jurisprudencia', iaTransferenciaGuard, quotaMiddleware(), async (req, res, next) => {
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

    const cacheKeyJuris = hashKey('jurisprudencia', qSanitizado, rama, limit);
    const cachedJuris = await get(cacheKeyJuris);
    if (cachedJuris) {
      return res.json(cachedJuris);
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

    const response = await getAi().models.generateContent({
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

    // Registrar consumo en segundo plano
    const promptTokens = response.usageMetadata?.promptTokenCount || 0;
    const completionTokens = response.usageMetadata?.candidatesTokenCount || 0;
    tokenRepo.registrarConsumo(
      req.user?.sub,
      req.organizationId,
      'jurisprudencia',
      model || MODEL,
      promptTokens,
      completionTokens,
      null
    ).catch(err => {
      req.logger?.error('Error al registrar consumo en jurisprudencia:', err);
    });

    const jurisPayload = { resultados, query: qSanitizado, rama };
    set(cacheKeyJuris, jurisPayload, 7200);
    return res.json(jurisPayload);
  } catch (err) {
    next(err);
  }
});

// ─── Configuración y Prompts de Especialistas Virtuales (Fase 6) ───────────────
const ESPECIALISTAS_CONFIG = {
  civil: {
    nombre: 'Derecho Civil y Procesal Civil',
    systemInstruction: `Eres el Dr. Civil Virtual, abogado senior especialista de LegalPro en Derecho Civil y Procesal Civil peruano.
Analiza el caso presentado bajo el prisma del Código Civil peruano de 1984 y el Código Procesal Civil (CPC), fundamentando con la base legal más reciente y vigente en el Perú.
Enfócate en plazos formales y procesales según la ley (ej. plazos de interposición, contestación de demandas, recursos de apelación y casación, etc.).
IMPRESCINDIBLE: Incorpora la realidad peruana. Advierte sobre las demoras crónicas en la calificación de demandas en los juzgados civiles (que legalmente toma 5 días pero en la práctica puede tardar entre 2 a 4 meses), la excesiva carga procesal, las demoras de las notificaciones físicas si no se cuenta con casilla electrónica activa en el SINOE, y la necesidad de solicitar constantemente el impulso procesal para evitar el abandono de la instancia.`,
    fallback: 'Análisis Civil Preliminar: Se advierte que de conformidad con el Código Procesal Civil peruano, los plazos procesales son perentorios e improrrogables. Sin embargo, en la práctica del Poder Judicial del Perú, existe un retraso promedio de 3 a 6 meses en el dictado de resoluciones debido a la excesiva carga procesal. Se recomienda priorizar la constitución de domicilio procesal electrónico (SINOE) para agilizar el cómputo de plazos y presentar escritos de impulso procesal constantes para evitar el archivo definitivo por inactividad o abandono.'
  },
  penal: {
    nombre: 'Derecho Penal y Procesal Penal',
    systemInstruction: `Eres el Dr. Penal Virtual, abogado senior especialista de LegalPro en Derecho Penal y Procesal Penal peruano.
Analiza el caso presentado bajo las normas del Código Penal y el Nuevo Código Procesal Penal (NCPP) de 2004, fundamentando con la base legal más reciente y vigente en el Perú.
Enfócate en la tipicidad del delito, las fases del proceso penal (Investigación Preparatoria, Etapa Intermedia, Juicio Oral) y plazos del NCPP (plazos de investigación preparatoria ordinaria y compleja, plazos de detención preliminar o prisión preventiva).
IMPRESCINDIBLE: Incorpora la realidad peruana. Señala la lentitud y burocracia en el Ministerio Público para formalizar denuncias, la demora en recibir informes periciales del Instituto de Medicina Legal o peritos de la PNP, y la recurrente práctica del uso excesivo de prisiones preventivas por parte de los jueces de investigación preparatoria ante la presión mediática o social.`,
    fallback: 'Análisis Penal Preliminar: Conforme al Nuevo Código Procesal Penal peruano (NCPP 2004), la investigación preparatoria tiene plazos estrictos (Art. 342: 120 días prorrogables por 60 más para casos simples). En la realidad, las fiscalías peruanas sufren un colapso de carga laboral, lo que genera retrasos prolongados en la recepción de declaraciones e informes periciales. Es crucial dar seguimiento diario en mesa de partes física o virtual y cooperar activamente para impulsar las diligencias de investigación.'
  },
  laboral: {
    nombre: 'Derecho Laboral y Procesal Laboral',
    systemInstruction: `Eres el Dr. Laboral Virtual, abogado senior especialista de LegalPro en Derecho Laboral y Procesal Laboral peruano.
Analiza el caso bajo el régimen laboral general de la actividad privada (D. Leg. 728, LPCL) o regímenes especiales, y la Nueva Ley Procesal del Trabajo (NLPT Ley N° 29497), fundamentando con la base legal más reciente y vigente en el Perú.
Enfócate en plazos críticos como el de caducidad para accionar contra el despido arbitrario (30 días hábiles de conformidad con el Art. 36 de la LPCL).
IMPRESCINDIBLE: Incorpora la realidad peruana. Considera el papel de la Superintendencia Nacional de Fiscalización Laboral (SUNAFIL), las demoras del procedimiento inspectivo y el retraso generalizado en la programación de audiencias de conciliación y de juzgamiento en las salas y juzgados laborales del Poder Judicial, las cuales de programarse en días teóricos terminan demorando entre 8 a 18 meses para llevarse a cabo.`,
    fallback: 'Análisis Laboral Preliminar: Bajo la Nueva Ley Procesal del Trabajo (Ley 29497), los procesos son eminentemente orales, pero los juzgados laborales peruanos programan audiencias con retrasos severos de hasta un año. Recuerde que el plazo de caducidad para demandar reposición o indemnización por despido arbitrario es de 30 días hábiles (Art. 36 D.Leg 728). Se aconseja iniciar un procedimiento de conciliación administrativa previa ante el Ministerio de Trabajo (MTPE) o recurrir a una inspección de SUNAFIL para resguardar las pruebas de la relación laboral.'
  },
  constitucional: {
    nombre: 'Derecho Constitucional',
    systemInstruction: `Eres el Dr. Constitucional Virtual, abogado senior especialista de LegalPro en Derecho Constitucional y Procesal Constitucional peruano.
Analiza el caso presentado bajo la Constitución Política del Perú de 1993 y el Nuevo Código Procesal Constitucional (Ley N° 31307), fundamentando con la base legal más reciente y vigente en el Perú.
Enfócate en la procedencia de procesos constitucionales de tutela de derechos: Amparo, Habeas Corpus, Habeas Data, Acción de Cumplimiento. Revisa requisitos de admisibilidad y el principio de subsidiariedad (vías igualmente satisfactorias).
IMPRESCINDIBLE: Incorpora la realidad peruana. Resalta que, a pesar de que el Nuevo Código Procesal Constitucional prohíbe el rechazo liminar y exige plazos de celeridad, los juzgados constitucionales en Lima y otras cortes sufren un severo embotellamiento. Un proceso de amparo puede tardar de 1 a 3 años en primera instancia, y la apelación ante las salas superiores u obtención de pronunciamiento del Tribunal Constitucional (TC) puede demorar varios años adicionales.`,
    fallback: 'Análisis Constitucional Preliminar: Conforme al Nuevo Código Procesal Constitucional (Ley 31307), la demanda de amparo debe presentarse dentro de los 60 días hábiles de producido el acto lesivo (o 30 días hábiles si es contra resolución judicial). Sin embargo, en la práctica peruana los procesos constitucionales experimentan grandes dilaciones debido a la alta litigiosidad. Se sugerirá adjuntar medidas cautelares bien fundamentadas para mitigar el daño irreparable durante el transcurso del proceso principal.'
  },
  familia: {
    nombre: 'Derecho de Familia',
    systemInstruction: `Eres el Dr. Familia Virtual, abogado senior especialista de LegalPro en Derecho de Familia peruano.
Analiza el caso bajo el Código Civil (Libro de Familia) y leyes especiales (ej. Ley N° 30364 para prevenir la violencia contra las mujeres y los integrantes del grupo familiar), fundamentando con la base legal más reciente y vigente en el Perú.
Enfócate en procesos de alimentos, tenencia, régimen de visitas, divorcio por causal o mutuo acuerdo, tutela y curatela.
IMPRESCINDIBLE: Incorpora la realidad peruana. Advierte sobre la demora en la liquidación de las pensiones alimenticias devengadas en los juzgados de paz letrados, el incumplimiento del plazo de otorgamiento de medidas de protección bajo la Ley 30364 (que en teoría debe ser de 24 a 72 horas, pero cuya ejecución por parte de la Policía Nacional suele ser ineficaz o nula por falta de recursos), y el alto impacto emocional del litigio familiar debido a la falta de personal multidisciplinario (psicólogos, asistentas sociales) en las cortes peruanas.`,
    fallback: 'Análisis de Familia Preliminar: En procesos familiares peruanos, en particular el de alimentos (tramitado ante Juzgados de Paz Letrado), el principal obstáculo es la liquidación y cobro efectivo de pensiones alimenticias devengadas. Asimismo, bajo la Ley 30364, las medidas de protección deben emitirse de inmediato, pero la PNP suele carecer de personal para hacerlas cumplir efectivamente. Se recomienda solicitar el apercibimiento de inscripción en el REDAM (Registro de Deudores Alimentarios Morosos) y denunciar penalmente por omisión a la asistencia familiar si persiste el incumplimiento.'
  },
  administrativo: {
    nombre: 'Derecho Administrativo',
    systemInstruction: `Eres el Dr. Administrativo Virtual, abogado senior especialista de LegalPro en Derecho Administrativo peruano.
Analiza la consulta bajo la LPAG (Ley N° 27444) y el Proceso Contencioso Administrativo, fundamentando con la base legal más reciente y vigente en el Perú.
Enfócate en plazos de recursos (15 días hábiles para reconsideración o apelación), el silencio administrativo (positivo o negativo) y los requisitos para el agotamiento de la vía administrativa.
IMPRESCINDIBLE: Incorpora la realidad peruana. Detalla la burocracia extrema de las entidades públicas peruanas (ej. ministerios, municipalidades, INDECOPI, SUNAT, etc.), el uso indebido del silencio administrativo negativo para eludir responsabilidades, las notificaciones defectuosas y la larga espera judicial en el proceso contencioso-administrativo, que puede prolongarse por años en las cortes superiores antes de ejecutarse una sentencia contra el Estado.`,
    fallback: 'Análisis Administrativo Preliminar: Conforme a la LPAG (Ley 27444), las entidades tienen un plazo general de 30 días hábiles para resolver peticiones. En la realidad administrativa peruana, es común que las entidades retrasen la resolución, forzando la aplicación del Silencio Administrativo Negativo para posibilitar la vía judicial contencioso-administrativa. Se sugiere vigilar rigurosamente los plazos de interposición de recursos administrativos (15 días útiles) y verificar si la entidad notificó válidamente conforme a las prelaciones de ley.'
  },
  tributario: {
    nombre: 'Derecho Tributario y Aduanero',
    systemInstruction: `Eres el Dr. Tributario Virtual, abogado senior especialista de LegalPro en Derecho Tributario y Procedimientos ante la SUNAT y el Tribunal Fiscal del Perú.
Analiza el caso presentado bajo el prisma del Código Tributario (D.S. N° 133-2013-EF y sus modificaciones recientes), la Ley del Impuesto a la Renta (LIR), la Ley del IGV e ISC, y resoluciones del Tribunal Fiscal (RTF) de observancia obligatoria, fundamentando con la base legal más reciente y vigente en el Perú.
Enfócate en la naturaleza de la deuda tributaria, plazos de prescripción de las facultades de determinación, cobro y sanción de la SUNAT (Arts. 43 y siguientes del Código Tributario), recursos de reclamación (20 días hábiles) y apelación ante el Tribunal Fiscal.
IMPRESCINDIBLE: Incorpora la realidad peruana. Advierte sobre el carácter agresivo y riguroso de los procedimientos de fiscalización y cobranza coactiva de la SUNAT (embargos en cuentas bancarias express), la extrema demora del Tribunal Fiscal para resolver apelaciones (que legalmente toma 9 meses pero en la práctica puede exceder los 2 a 4 años acumulando intereses moratorios capitalizados si no se aplica la suspensión del cobro), y la complejidad de los sistemas de detracciones y percepciones del IGV.`,
    fallback: 'Análisis Tributario Preliminar: De conformidad con el Código Tributario peruano, la interposición del recurso de reclamación contra valores de SUNAT (Orden de Pago, Resolución de Determinación o Multa) debe realizarse en un plazo máximo de 20 días hábiles para evitar la cobranza coactiva sin pago previo. Se advierte que SUNAT cuenta con facultades de ejecución coactiva inmediatas (como embargos en forma de retención en cuentas bancarias). Se sugiere verificar si los actos de SUNAT fueron notificados debidamente en el buzón electrónico SOL SUNAT y evaluar de inmediato la presentación de una reclamación con la documentación de sustento necesaria.'
  }
};

// ─── Funciones Auxiliares del Flujo de Panel de Expertos ──────────────────────
async function enrutarConsulta(prompt, model, req) {
  const systemInstruction = 'Eres un clasificador y enrutador legal experto de la plataforma LegalPro en el Perú. Tu tarea es analizar la consulta del usuario y listar las especialidades aplicables bajo el formato de JSON estructurado solicitado.';
  try {
    const response = await getAi().models.generateContent({
      model: model || MODEL,
      contents: [
        {
          role: 'user',
          parts: [{
            text: `Analiza la siguiente consulta jurídica y determina cuáles de las siguientes especialidades se ven involucradas de forma directa o indirecta. Puedes elegir una, dos o más especialidades si el caso es multidisciplinario.
Especialidades disponibles: civil, penal, laboral, constitucional, familia, administrativo, tributario.

Consulta: "${prompt}"`
          }]
        }
      ],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            especialidades: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['civil', 'penal', 'laboral', 'constitucional', 'familia', 'administrative', 'administrativo', 'tributario']
              },
              description: 'Lista de especialidades aplicables detectadas en la consulta'
            }
          },
          required: ['especialidades']
        },
        temperature: 0.1,
      }
    });

    // Registrar consumo del enrutador
    const promptTokens = response.usageMetadata?.promptTokenCount || 0;
    const completionTokens = response.usageMetadata?.candidatesTokenCount || 0;
    tokenRepo.registrarConsumo(
      req.user?.sub,
      req.organizationId,
      'panel_expertos_enrutamiento',
      model || MODEL,
      promptTokens,
      completionTokens,
      null
    ).catch(err => {
      req.logger?.error('Error al registrar consumo en enrutamiento panel de expertos:', err);
    });

    const raw = response.text?.trim() ?? '{"especialidades":[]}';
    const parsed = JSON.parse(raw);
    let especialidades = parsed.especialidades || [];
    // Mapear 'administrative' a 'administrativo'
    especialidades = especialidades.map(esp => esp === 'administrative' ? 'administrativo' : esp);
    
    // Filtrar para asegurarnos que solo contenga especialidades soportadas
    return especialidades.filter(esp => ESPECIALISTAS_CONFIG[esp]);
  } catch (err) {
    req.logger?.error('Error en enrutamiento automático de panel de expertos:', err);
    return ['civil']; // Fallback por defecto si falla la llamada
  }
}


async function ejecutarEspecialista(espId, prompt, model, req, textoOcr = null) {
  const promptConContexto = textoOcr
    ? `${prompt}\n\n[CONTEXTO ADICIONAL DE DOCUMENTOS DEL EXPEDIENTE (OCR)]:\n${textoOcr}`
    : prompt;

  const cacheKey = hashKey('panel_especialista', espId, promptConContexto, model || MODEL);
  try {
    const cachedResult = await get(cacheKey);
    if (cachedResult) {
      return { especialista: espId, analisis: cachedResult, desdeCache: true };
    }
  } catch (err) {
    req.logger?.error(`Error leyendo caché de Redis para especialista ${espId}:`, err);
  }

  const llamadaGemini = async () => {
    const config = ESPECIALISTAS_CONFIG[espId];
    const response = await getAi().models.generateContent({
      model: model || MODEL,
      contents: [
        {
          role: 'user',
          parts: [{ text: `Analiza minuciosamente el siguiente caso desde tu especialidad legal peruana: "${promptConContexto}"` }]
        }
      ],
      config: {
        systemInstruction: config.systemInstruction,
        maxOutputTokens: 2048,
        temperature: 0.4
      }
    });

    const promptTokens = response.usageMetadata?.promptTokenCount || 0;
    const completionTokens = response.usageMetadata?.candidatesTokenCount || 0;
    tokenRepo.registrarConsumo(
      req.user?.sub,
      req.organizationId,
      `panel_expertos_especialista_${espId}`,
      model || MODEL,
      promptTokens,
      completionTokens,
      null
    ).catch(err => {
      req.logger?.error(`Error al registrar consumo en especialista ${espId}:`, err);
    });

    const resultado = response.text ?? 'No se pudo obtener respuesta del especialista.';
    
    try {
      await set(cacheKey, resultado, 7200); // 2 horas de TTL
    } catch (err) {
      req.logger?.error(`Error guardando en caché de Redis para especialista ${espId}:`, err);
    }

    return { especialista: espId, analisis: resultado, desdeCache: false };
  };

  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        especialista: espId,
        analisis: ESPECIALISTAS_CONFIG[espId].fallback,
        desdeCache: false,
        timeout: true
      });
    }, 3500); // 3.5 segundos de timeout
  });

  return Promise.race([llamadaGemini(), timeoutPromise]);
}

// ─── POST /api/ai/panel-expertos ──────────────────────────────────────────────
router.post('/panel-expertos', iaTransferenciaGuard, quotaMiddleware(), validate(aiConsultaSchema), validarDisclaimerAceptado, async (req, res, next) => {
  try {
    const { prompt, mensaje, especialistas, model, expediente_id } = req.body;
    const orgId = req.organizationId;

    const creditos = await tokenRepo.verificarCreditos(orgId);
    if (creditos <= 0 || creditos < 3) {
      return res.status(402).json({ error: 'Créditos insuficientes para realizar esta operación.', code: 'INSUFFICIENT_CREDITS' });
    }

    if (!validarPermisoIA(req.user?.rol, 'analisis')) {
      return res.status(403).json({ error: 'Su rol no tiene acceso a esta función IA.' });
    }

    const promptText = prompt || mensaje;
    const { sanitizado: promptSanitizado } = sanitizarPrompt(promptText, 'consulta');
    if (!promptSanitizado.trim()) {
      return res.status(400).json({ error: 'El contenido del prompt contiene elementos no permitidos.' });
    }

    // 1. Fase de enrutamiento (Híbrido)
    let espSeleccionados = [];
    if (especialistas && Array.isArray(especialistas) && especialistas.length > 0) {
      espSeleccionados = especialistas.filter(esp => ESPECIALISTAS_CONFIG[esp]);
    } else {
      espSeleccionados = await enrutarConsulta(promptSanitizado, model, req);
    }

    if (espSeleccionados.length === 0) {
      espSeleccionados = ['civil'];
    }

    // Consultar caché consolidado completo
    const cacheKeyConsolidado = hashKey('panel_consolidado', promptSanitizado, espSeleccionados.join(','), model || MODEL);
    try {
      const cachedConsolidado = await get(cacheKeyConsolidado);
      if (cachedConsolidado) {
        return res.json({ ...cachedConsolidado, desdeCacheGlobal: true });
      }
    } catch (err) {
      req.logger?.error('Error leyendo caché consolidado general:', err);
    }

    // Obtener texto OCR si existe expediente_id
    let textoOcr = null;
    if (expediente_id) {
      try {
        const { rows: [exp] } = await db.query(
          'SELECT texto_ocr FROM expedientes WHERE id=$1 AND organization_id=$2',
          [expediente_id, orgId]
        );
        if (exp && exp.texto_ocr) {
          textoOcr = exp.texto_ocr;
        }
      } catch (dbErr) {
        req.logger?.error('Error al obtener texto_ocr en panel-expertos:', dbErr);
      }
    }

    // 2. Ejecución paralela con timeout
    const promesas = espSeleccionados.map(espId => ejecutarEspecialista(espId, promptSanitizado, model, req, textoOcr));
    const resultadosEspecialistas = await Promise.all(promesas);

    // 3. Consolidación Master
    const informesEspecialistas = resultadosEspecialistas.map(r => {
      const config = ESPECIALISTAS_CONFIG[r.especialista];
      const statusStr = r.timeout ? 'TIMEOUT (FALLBACK USADO)' : (r.desdeCache ? 'DESDE CACHE' : 'EXITOSO');
      return `--- ESPECIALIDAD: ${config.nombre} [Estado: ${statusStr}] ---\n${r.analisis}\n`;
    }).join('\n');

    const promptConsolidacion = `Actúa como el Consolidador Master de LegalPro, un abogado senior especialista en la unificación de estrategias multidisciplinarias y consultoría jurídica de alta complejidad en el Perú.
Tu objetivo es unificar las opiniones y análisis preliminares de los especialistas del panel de expertos legales y responder al usuario estructurando tu diagnóstico de forma clara y rigurosa.

Consulta Original del Abogado/Cliente:
"${promptSanitizado}"

Informes individuales del Panel de Expertos:
${informesEspecialistas}

Instrucciones para el Diagnóstico Unificado (Estructura de respuesta obligatoria):
Responde utilizando exactamente las siguientes secciones estructuradas en Markdown:

# Diagnóstico Unificado y Estrategia Legal

## 1. Resumen Ejecutivo
(Síntesis clara y profesional del caso en lenguaje de alta consultoría).

## 2. Citas de Leyes y Base Legal Aplicable
(Enumera y detalla explícitamente todas las leyes, códigos, decretos, reglamentos o jurisprudencia vinculante del Tribunal Constitucional o la Corte Suprema que sustentan el caso según los aportes de las especialidades correspondientes, ej. Código Civil, NCPP, D.Leg 728, Código Tributario, etc.).

## 3. Plan de Acción y Recomendación
(Resumen detallado de qué acciones concretas paso a paso debe realizar el usuario, indicando los plazos procesales críticos aplicables).

## 4. Análisis y Evaluación de Riesgos
(Detalla de forma explícita todas las contingencias, riesgos de prescripción, caducidad, multas, medidas coactivas o la posibilidad de perder el caso. IMPORTANTE: Si consideras que el caso no tiene ningún riesgo procesal o material viable, indícalo de manera categórica escribiendo: "Sin Riesgo alguno").

## 5. Advertencias de la Realidad Procesal Peruana
* **Vigilancia e Impulso:** Advierte de manera profesional que el abogado debe realizar un seguimiento diario tanto virtual (SINOE) como presencial ante el colapso judicial y retrasos crónicos.
* **Plazos Prácticos vs Teóricos:** Señala que los decretos de mero trámite pueden tardar de 1 a 3 meses en proveerse.

Responde con un tono formal, técnico y altamente riguroso.`;

    const response = await getAi().models.generateContent({
      model: model || MODEL,
      contents: [{ role: 'user', parts: [{ text: promptConsolidacion }] }],
      config: {
        systemInstruction: 'Eres el Consolidador Master de la plataforma LegalPro en el Perú. Consolida de forma unificada, estructurada y resalta las particularidades procesales peruanas.',
        maxOutputTokens: 4096,
        temperature: 0.3,
      }
    });

    // Registrar consumo del consolidador
    const promptTokens = response.usageMetadata?.promptTokenCount || 0;
    const completionTokens = response.usageMetadata?.candidatesTokenCount || 0;
    tokenRepo.registrarConsumo(
      req.user?.sub,
      req.organizationId,
      'panel_expertos_consolidacion',
      model || MODEL,
      promptTokens,
      completionTokens,
      req.headers['x-idempotency-key'] || null
    ).catch(err => {
      req.logger?.error('Error al registrar consumo en consolidación panel de expertos:', err);
    });

    const diagnostico = response.text ?? 'No se pudo generar la consolidación.';

    const payload = {
      especialidades: espSeleccionados,
      especialistas_detalles: resultadosEspecialistas.map(r => ({
        especialista: r.especialista,
        timeout: r.timeout || false,
        desdeCache: r.desdeCache || false,
        analisis: r.analisis
      })),
      diagnostico,
      tokens: response.usageMetadata?.totalTokenCount ?? null
    };

    try {
      await set(cacheKeyConsolidado, payload, 7200);
    } catch (err) {
      req.logger?.error('Error guardando caché consolidado general:', err);
    }

    // Debitar 3 créditos por consolidación de panel de expertos
    try {
      await tokenRepo.debitarCreditos(req.user.sub, orgId, req.body.expediente_id || null, 3, 'Consolidación Panel de Expertos');
    } catch (creditErr) {
      return res.status(402).json({ error: creditErr.message, code: 'INSUFFICIENT_CREDITS' });
    }

    return res.json(payload);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/ai/panel-expertos/stream (SSE) ─────────────────────────────────
router.post('/panel-expertos/stream', iaTransferenciaGuard, quotaMiddleware(), validate(aiConsultaSchema), validarDisclaimerAceptado, async (req, res, _next) => {
  try {
    const { prompt, mensaje, especialistas, model, expediente_id } = req.body;
    const orgId = req.organizationId;

    const creditos = await tokenRepo.verificarCreditos(orgId);
    if (creditos <= 0 || creditos < 3) {
      return res.status(402).json({ error: 'Créditos insuficientes para realizar esta operación.', code: 'INSUFFICIENT_CREDITS' });
    }

    if (!validarPermisoIA(req.user?.rol, 'analisis')) {
      return res.status(403).json({ error: 'Su rol no tiene acceso a esta función IA.' });
    }

    const promptText = prompt || mensaje;
    const { sanitizado: promptSanitizado } = sanitizarPrompt(promptText, 'consulta');
    if (!promptSanitizado.trim()) {
      return res.status(400).json({ error: 'El contenido del prompt contiene elementos no permitidos.' });
    }

    // Configurar cabeceras SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const enviarSSE = (status, payload) => {
      res.write(`data: ${JSON.stringify({ status, ...payload })}\n\n`);
    };

    // 1. Fase de enrutamiento
    let espSeleccionados = [];
    if (especialistas && Array.isArray(especialistas) && especialistas.length > 0) {
      espSeleccionados = especialistas.filter(esp => ESPECIALISTAS_CONFIG[esp]);
      enviarSSE('enrutado', {
        especialidades: espSeleccionados,
        message: `Usando especialistas seleccionados manualmente: ${espSeleccionados.join(', ')}`
      });
    } else {
      enviarSSE('enrutando', { message: 'Analizando la consulta legal para detectar especialidades involucradas...' });
      espSeleccionados = await enrutarConsulta(promptSanitizado, model, req);
      enviarSSE('enrutado', {
        especialidades: espSeleccionados,
        message: `Especialidades autodetectadas: ${espSeleccionados.join(', ')}`
      });
    }

    if (espSeleccionados.length === 0) {
      espSeleccionados = ['civil'];
      enviarSSE('enrutado', {
        especialidades: espSeleccionados,
        message: 'No se detectó ninguna especialidad clara. Usando Civil por defecto.'
      });
    }

    // Obtener texto OCR si existe expediente_id
    let textoOcr = null;
    if (expediente_id) {
      try {
        const { rows: [exp] } = await db.query(
          'SELECT texto_ocr FROM expedientes WHERE id=$1 AND organization_id=$2',
          [expediente_id, orgId]
        );
        if (exp && exp.texto_ocr) {
          textoOcr = exp.texto_ocr;
        }
      } catch (dbErr) {
        req.logger?.error('Error al obtener texto_ocr en panel-expertos stream:', dbErr);
      }
    }

    // 2. Ejecución paralela
    enviarSSE('analizando', { message: 'Iniciando el análisis paralelo del panel de expertos (límite 3.5s por agente)...' });

    const promesas = espSeleccionados.map(async (espId) => {
      enviarSSE('analizando_especialista', {
        especialista: espId,
        message: `Especialista en ${ESPECIALISTAS_CONFIG[espId].nombre} analizando el caso...`
      });
      
      const resultado = await ejecutarEspecialista(espId, promptSanitizado, model, req, textoOcr);

      enviarSSE('especialista_completado', {
        especialista: espId,
        timeout: resultado.timeout || false,
        desdeCache: resultado.desdeCache || false,
        message: resultado.timeout
          ? `Especialista en ${ESPECIALISTAS_CONFIG[espId].nombre} excedió el tiempo límite (3.5s). Usando análisis básico predefinido.`
          : `Especialista en ${ESPECIALISTAS_CONFIG[espId].nombre} completó su análisis ${resultado.desdeCache ? 'desde caché' : 'exitosamente'}.`
      });

      return resultado;
    });

    const resultadosEspecialistas = await Promise.all(promesas);

    enviarSSE('analistas_completados', {
      resultados: resultadosEspecialistas.map(r => ({
        especialista: r.especialista,
        timeout: r.timeout || false,
        desdeCache: r.desdeCache || false
      })),
      message: 'Todos los especialistas han terminado sus informes.'
    });

    // 3. Consolidación Master
    enviarSSE('consolidando', { message: 'El Consolidador Master está unificando los informes y evaluando la estrategia...' });

    const informesEspecialistas = resultadosEspecialistas.map(r => {
      const config = ESPECIALISTAS_CONFIG[r.especialista];
      const statusStr = r.timeout ? 'TIMEOUT (FALLBACK USADO)' : (r.desdeCache ? 'DESDE CACHE' : 'EXITOSO');
      return `--- ESPECIALIDAD: ${config.nombre} [Estado: ${statusStr}] ---\n${r.analisis}\n`;
    }).join('\n');

    const promptConsolidacion = `Actúa como el Consolidador Master de LegalPro, un abogado senior especialista en la unificación de estrategias multidisciplinarias y consultoría jurídica de alta complejidad en el Perú.
Tu objetivo es unificar las opiniones y análisis preliminares de los especialistas del panel de expertos legales y responder al usuario estructurando tu diagnóstico de forma clara y rigurosa.

Consulta Original del Abogado/Cliente:
"${promptSanitizado}"

Informes individuales del Panel de Expertos:
${informesEspecialistas}

Instrucciones para el Diagnóstico Unificado (Estructura de respuesta obligatoria):
Responde utilizando exactamente las siguientes secciones estructuradas en Markdown:

# Diagnóstico Unificado y Estrategia Legal

## 1. Resumen Ejecutivo
(Síntesis clara y profesional del caso en lenguaje de alta consultoría).

## 2. Citas de Leyes y Base Legal Aplicable
(Enumera y detalla explícitamente todas las leyes, códigos, decretos, reglamentos o jurisprudencia vinculante del Tribunal Constitucional o la Corte Suprema que sustentan el caso según los aportes de las especialidades correspondientes, ej. Código Civil, NCPP, D.Leg 728, Código Tributario, etc.).

## 3. Plan de Acción y Recomendación
(Resumen detallado de qué acciones concretas paso a paso debe realizar el usuario, indicando los plazos procesales críticos aplicables).

## 4. Análisis y Evaluación de Riesgos
(Detalla de forma explícita todas las contingencias, riesgos de prescripción, caducidad, multas, medidas coactivas o la posibilidad de perder el caso. IMPORTANTE: Si consideras que el caso no tiene ningún riesgo procesal o material viable, indícalo de manera categórica escribiendo: "Sin Riesgo alguno").

## 5. Advertencias de la Realidad Procesal Peruana
* **Vigilancia e Impulso:** Advierte de manera profesional que el abogado debe realizar un seguimiento diario tanto virtual (SINOE) como presencial ante el colapso judicial y retrasos crónicos.
* **Plazos Prácticos vs Teóricos:** Señala que los decretos de mero trámite pueden tardar de 1 a 3 meses en proveerse.

Responde con un tono formal, técnico y altamente riguroso.`;

    const stream = await getAi().models.generateContentStream({
      model: model || MODEL,
      contents: [{ role: 'user', parts: [{ text: promptConsolidacion }] }],
      config: {
        systemInstruction: 'Eres el Consolidador Master de la plataforma LegalPro en el Perú. Consolida de forma unificada, estructurada y resalta las particularidades procesales peruanas.',
        maxOutputTokens: 4096,
        temperature: 0.3,
      }
    });

    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;

    for await (const chunk of stream) {
      const text = chunk.text ?? '';
      if (chunk.usageMetadata) {
        promptTokens = chunk.usageMetadata.promptTokenCount || promptTokens;
        completionTokens = chunk.usageMetadata.candidatesTokenCount || completionTokens;
        totalTokens = chunk.usageMetadata.totalTokenCount || totalTokens;
      }
      enviarSSE('chunk', { chunk: text });
    }

    // Registrar consumo de consolidación
    if (totalTokens > 0) {
      tokenRepo.registrarConsumo(
        req.user?.sub,
        req.organizationId,
        'panel_expertos_consolidacion',
        model || MODEL,
        promptTokens,
        completionTokens,
        req.headers['x-idempotency-key'] || null
      ).catch(err => {
        req.logger?.error('Error al registrar consumo en consolidación panel de expertos:', err);
      });

      // Debitar 3 créditos por consolidación de panel de expertos
      try {
        await tokenRepo.debitarCreditos(req.user.sub, orgId, req.body.expediente_id || null, 3, 'Consolidación Panel de Expertos (Streaming)');
      } catch (creditErr) {
        req.logger?.error('Error debitando créditos en panel de expertos stream:', creditErr);
      }
    }

    enviarSSE('done', { tokens: totalTokens });
    res.end();
  } catch (err) {
    req.logger?.error('Error en endpoint stream panel de expertos:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write('data: ' + JSON.stringify({ status: 'error', error: err.message }) + '\n\n');
      res.end();
    }
  }
});

export default router;

