import { Router } from 'express';
import { GoogleGenAI, FunctionCallingConfigMode, Type } from '@google/genai';
import db from '../db.js';
import { authMiddleware, tenantMiddleware } from '../middleware/authMiddleware.js';
import { sanitizarPrompt, validarPermisoIA, envolverContenidoUsuario } from '../middleware/promptSanitizer.js';

const router = Router();

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY no está configurada. Agrégala en Railway.');
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = 'gemini-3-flash-preview';

// Todos los endpoints requieren auth + tenant
router.use(authMiddleware, tenantMiddleware);

// ─── Function declarations para structured outputs legales ───────────────────
// Context7: parametersJsonSchema es la forma declarativa recomendada (@google/genai)
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

// ─── POST /api/gemini/chat ────────────────────────────────────────────────────
// Chat conversacional con historial. Opcionalmente adjunta contexto de expediente.
router.post('/chat', async (req, res, next) => {
  try {
    const { mensaje, historial = [], expediente_id } = req.body;
    const orgId = req.organizationId;

    if (!mensaje?.trim()) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
    }

    // Validar permiso de IA por rol (OWASP API01 - BFLA)
    if (!validarPermisoIA(req.user?.rol, 'chat')) {
      return res.status(403).json({ error: 'Su rol no tiene acceso al chat IA.' });
    }

    // Saneamiento anti-prompt injection (OWASP LLM01)
    const { sanitizado: mensajeSanitizado, advertencias } = sanitizarPrompt(mensaje, 'consulta');
    if (advertencias.some(a => a.includes('[SECURITY]'))) {
      console.warn('[SECURITY] Posible prompt injection en /chat', {
        userId: req.user?.sub, orgId, advertencias,
      });
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

    // Construir historial para Gemini (máx 20 turnos para evitar tokens excesivos)
    // El frontend envía { role: 'user'|'model', text: string }
    const recentHistory = (historial ?? []).slice(-20);
    const contents = [
      ...recentHistory.map(h => ({
        role: (h.role === 'model' || h.role === 'assistant') ? 'model' : 'user',
        parts: [{ text: h.text ?? h.content ?? '' }],
      })),
      {
        role: 'user',
        parts: [{ text: mensaje + contextoExpediente }],
      },
    ];

    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: buildSystemPrompt(req.user),
        maxOutputTokens: 2048,
        temperature: 0.4,
      },
    });

    const respuesta = response.text ?? 'No se pudo obtener respuesta.';

    // Guardar en historial de chat (fire & forget — no bloquea la respuesta)
    db.query(
      `INSERT INTO mensajes_chat (usuario_id, organization_id, expediente_id, contenido, rol)
       VALUES ($1,$2,$3,$4,'user'),($1,$2,$3,$5,'assistant')`,
      [req.user.sub, orgId, expediente_id ?? null, mensaje, respuesta]
    ).catch(() => {});

    return res.json({ respuesta, tokens: response.usageMetadata?.totalTokenCount ?? null });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/gemini/consulta ────────────────────────────────────────────────
// Consulta especializada por tipo (analisis, redaccion, jurisprudencia, predictor).
router.post('/consulta', async (req, res, next) => {
  try {
    const { prompt, tipo = 'general' } = req.body;

    if (!prompt?.trim()) {
      return res.status(400).json({ error: 'El prompt no puede estar vacío.' });
    }

    const tiposValidos = ['general', 'analisis', 'redaccion', 'jurisprudencia', 'predictor', 'alegatos', 'interrogatorio'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ error: `Tipo inválido. Valores: ${tiposValidos.join(', ')}.` });
    }

    // RBAC: validar que el rol del usuario puede acceder a la feature (OWASP API01)
    const featureMap = {
      predictor: 'predictor', analisis: 'analisis', redaccion: 'redactor',
      jurisprudencia: 'jurisprudencia', alegatos: 'alegato',
      interrogatorio: 'interrogatorio', general: 'chat',
    };
    const feature = featureMap[tipo] ?? 'chat';
    if (!validarPermisoIA(req.user?.rol, feature)) {
      return res.status(403).json({ error: 'Su rol no tiene acceso a esta función IA.' });
    }

    // Saneamiento anti-prompt injection (OWASP LLM01)
    const tipoSanitizacion = ['escrito', 'alegato'].includes(tipo) ? tipo
      : tipo === 'analisis' ? 'expediente'
      : 'consulta';
    const { sanitizado: promptSanitizado, advertencias } = sanitizarPrompt(prompt, tipoSanitizacion);
    if (advertencias.some(a => a.includes('[SECURITY]'))) {
      console.warn('[SECURITY] Posible prompt injection en /consulta', {
        userId: req.user?.sub, tipo, advertencias,
      });
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

    // Context7 (@google/genai): para tipos estructurados usar function calling
    // → garantiza JSON válido con esquema declarado (FunctionCallingConfigMode.ANY).
    // Para tipos de texto libre (redaccion, alegatos, interrogatorio) → texto plano.
    const tiposEstructurados = { predictor: predictorDeclaration, analisis: analisisDeclaration };
    const declaration = tiposEstructurados[tipo];

    if (declaration) {
      // Function calling forzado: el modelo DEBE invocar la función declarada.
      const response = await ai.models.generateContent({
        model: MODEL,
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

    // Tipos de texto libre (redaccion, alegatos, interrogatorio, jurisprudencia, general)
    const response = await ai.models.generateContent({
      model: MODEL,
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

// ─── GET /api/gemini/historial ────────────────────────────────────────────────
// Historial de conversaciones del usuario en el tenant actual.
router.get('/historial', async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const usuarioId = req.user.sub;
    const { limit = 50, expediente_id } = req.query;

    const params = [usuarioId, orgId];
    let sql = `SELECT id, contenido AS mensaje_usuario, rol, created_at, expediente_id
               FROM mensajes_chat
               WHERE usuario_id=$1 AND organization_id=$2`;
    if (expediente_id) {
      sql += ` AND expediente_id=$${params.length + 1}`;
      params.push(expediente_id);
    }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(Math.min(200, parseInt(limit)));

    const { rows: historial } = await db.query(sql, params);

    return res.json({ historial });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/gemini/notificaciones ──────────────────────────────────────────
// Notificaciones SINOE simuladas con contexto del tenant.
router.get('/notificaciones', async (req, res, next) => {
  try {
    // En producción: integrar con la API oficial del PJ / SINOE
    // Por ahora retorna datos estructurados del tenant
    const orgId = req.organizationId;

    const { rows: urgentes } = await db.query(
      `SELECT id, numero, titulo, tipo FROM expedientes
       WHERE organization_id=$1 AND es_urgente=TRUE AND estado='activo'
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

// ─── GET /api/gemini/jurisprudencia ──────────────────────────────────────────
// Búsqueda de jurisprudencia usando Gemini con RAG sobre base legal.
router.get('/jurisprudencia', async (req, res, next) => {
  try {
    const { q, rama = 'general', limit = 5 } = req.query;

    if (!q?.trim()) {
      return res.status(400).json({ error: 'El parámetro de búsqueda "q" es requerido.' });
    }

    // RBAC: solo roles con acceso a jurisprudencia (OWASP API01)
    if (!validarPermisoIA(req.user?.rol, 'jurisprudencia')) {
      return res.status(403).json({ error: 'Su rol no tiene acceso a la búsqueda de jurisprudencia.' });
    }

    // Saneamiento de la query de búsqueda (OWASP LLM01)
    const { sanitizado: qSanitizado, advertencias } = sanitizarPrompt(q, 'default');
    if (advertencias.some(a => a.includes('[SECURITY]'))) {
      console.warn('[SECURITY] Posible prompt injection en /jurisprudencia', {
        userId: req.user?.sub, advertencias,
      });
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
      model: MODEL,
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
