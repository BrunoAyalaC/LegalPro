import { Router } from 'express';
import { FunctionCallingConfigMode } from '../utils/minimaxClient.js';
import { createAiAdapter, isOpenCodeActive, IA_PROVIDER_LABEL, esTextoMayormenteIngles } from '../utils/providerRouter.js';
import { withLegalBase } from '../utils/systemPromptBase.js';
import db from '../db.js';
// FIX P0-C: tenantMiddleware REAL (tenantContext.run + AsyncLocalStorage → RLS),
// no la versión lite de authMiddleware.js (solo req.organizationId, sin ALS).
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
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
import { withRagContext } from '../middleware/ragMiddleware.js';
// Router de intenciones del chat: FASE 0 (regex determinista) + FASE 1 (LLM con
// tools AUTO) + FASE 2 (tool executor real). Fail-open: si falla, se degrada a
// la llamada directa normal del chat (nunca 500). Skill: enrutamiento-intenciones-chat.
import { enrutarMensaje, tipoRespuestaDeIntent, getDisclaimer } from '../utils/intentRouter.js';
import { detectarIntencionFase0 } from '../utils/intentFase0.js';
// RAG — fuente primaria OBLIGATORIA de jurisprudencia (fix P0 2026-08-07).
// `retrieve` (retrieve.mjs) es la capa que el wrapper envuelve y es la ÚNICA
// que soporta filtro por `tipo`; `hybridScore` replica el re-ranking del wrapper.
import { retrieve } from '../../../tools/rag/retrieve.mjs';
// FIX LDDE-GAP1 (2026-08-22): pipeline avanzado multi-query + RRF + reranking
import { buscarAvanzado } from '../../../tools/rag/rag-advanced.mjs';
import { hybridScore } from '../../../tools/rag/junior-rag-wrapper.mjs';
// Audit event JURISPRUDENCE_RETRIEVED (trazabilidad LPDP / LOPJ).
import { logAudit } from '../utils/audit.js';

const router = Router();
const tokenRepo = new TokenRepository(db);
router.use(authMiddleware, tenantMiddleware);
router.use(middlewareDeteccionSensibles(['prompt', 'mensaje', 'hechos', 'contenido']));

/** Rutas que invocan al proveedor IA activo (LPDP Art. 21) */
const iaTransferenciaGuard = requireTransferenciaInternacional();

// ─── DEPRECATED: endpoints /api/gemini/* ─────────────────────────────────────
// Los endpoints legacy /api/gemini/* se mantienen SOLO como alias de montaje
// (ver server/index.js: app.use('/api/gemini', ...)) por compatibilidad con
// clientes antiguos. NO usan Gemini: el proveedor IA es OpenCode Go
// (DeepSeek V4 Flash) con MiniMax como fallback, igual que /api/ai/*.
// - GEMINI FUE ELIMINADO COMO PROVEEDOR — nunca más se debe usar.
// - Plan: eliminar el alias /api/gemini cuando los clientes migren a /api/ai/*.
// ─────────────────────────────────────────────────────────────────────────────

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

// Inicialización perezosa del adaptador IA vía providerRouter:
// OpenCode Go (DeepSeek V4 Flash) si OPENCODE_API_KEY está configurada,
// MiniMax como fallback. Un proveedor ausente NO debe tumbar el arranque de
// toda la API. El error se emite por-petición (503).
let _ai = null;
function getAi() {
  if (!_ai) _ai = createAiAdapter();
  return _ai;
}
// Modelo por defecto según el proveedor activo (OpenCode > MiniMax)
// FIX 2026-08-07: el modelo OpenCode correcto es 'deepseek-v4-flash-free'
// (sin prefijo 'deepseek/' ni sufijo '-0731'). Endpoint: /zen/v1/chat/completions
const MODEL = isOpenCodeActive()
  ? (process.env.OPENCODE_MODEL || 'deepseek-v4-flash-free')
  : (process.env.MINIMAX_MODEL_DEFAULT || 'MiniMax-M3');

// ─── Etiquetado consistente de proveedor IA (FIX LPDP-2, Art. 21 LPDP) ───────
// Cada respuesta JSON que devuelva contenido IA debe incluir el campo
// `provider` ("opencode" | "minimax") y `model` para garantizar trazabilidad y
// transparencia activa. Ver docs/TRANSFERENCIA_INTERNACIONAL.md sección 8.
// GEMINI FUE ELIMINADO COMO PROVEEDOR — nunca más se debe usar.
// IA_PROVIDER_LABEL se importa de providerRouter.js (opencode/minimax/gemini-deprecated).
const IA_PROVIDER_DEFAULT = isOpenCodeActive() ? 'opencode' : 'minimax';

/**
 * Resuelve el proveedor IA activo para una petición.
 * Orden de preferencia: OPENCODE (DeepSeek V4 Flash) si está configurado → MINIMAX fallback.
 * @deprecated El flag `?provider=gemini` (endpoints legacy /api/gemini/*) ya no
 * está soportado: Gemini fue eliminado como proveedor y nunca será restaurado.
 * El valor 'gemini' se conserva ÚNICAMENTE para trazabilidad de peticiones antiguas.
 * Para forzar el fallback explícito, el cliente debe usar `provider=minimax`.
 */
function resolveProvider(req) {
  const fromQuery = (req.query?.provider || req.body?.provider || '').toString().toLowerCase();
  // DEPRECATED: Gemini eliminado (nunca más) — se mantiene solo por trazabilidad.
  if (fromQuery === 'gemini') return 'gemini';
  // Forzar fallback MiniMax explícito.
  if (fromQuery === 'minimax') return 'minimax';
  return IA_PROVIDER_DEFAULT;
}

/**
 * Enriquece un payload de respuesta con metadatos del proveedor IA activo.
 * FIX LPDP-2: garantizar que TODA respuesta de IA exponga `provider` y `model`.
 * FIX RAG-1: además inyecta citaciones y metadata del RAG si ENABLE_RAG=true
 * y el middleware ragMiddleware pobló `req.ragContext`.
 */
function withProvider(payload, req, modelUsed) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const provider = resolveProvider(req);
    const base = {
      ...payload,
      provider,
      provider_label: IA_PROVIDER_LABEL[provider] || provider,
      model: modelUsed || MODEL,
    };
    // Inyectar contexto RAG (citaciones, fuentes, chunks) si está disponible
    return withRagContext(base, req);
  }
  return payload;
}

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
// PII masking (LPDP): nombre_completo y organizacion se pseudonimizan antes de enviar a MiniMax
// para no transferir datos personales sin necesidad. Solo se envía rol/especialidad verificados.
function sanitizeForPrompt(value) {
  if (!value || typeof value !== 'string') return String(value ?? '');
  // Anonimiza emails, DNI, telefono y trunca nombres a iniciales
  return value.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]')
    .replace(/\b\d{8}\b/g, '[DNI]')
    .replace(/\b9\d{8}\b/g, '[TEL]')
    .replace(/\b(10|20)\d{9}\b/g, '[RUC]');
}
function buildSystemPrompt(user) {
  const nombreMasked = user.nombre_completo ? sanitizeForPrompt(user.nombre_completo).split(' ').map(p => p[0] ? p[0] + '***' : p).join(' ') : 'Usuario';
  const orgMasked = user.organization_name ? sanitizeForPrompt(user.organization_name) : 'Sin organización';
  return `Eres LexIA, asistente legal IA especializada en derecho peruano para la plataforma LegalPro.
Contexto del usuario:
- Nombre (pseudonimizado): ${nombreMasked}
- Rol: ${user.rol ?? 'ABOGADO'}
- Especialidad: ${user.especialidad ?? 'GENERAL'}
- Organización (pseudonimizada): ${orgMasked}

Marco legal aplicable: Código Procesal Civil (CPC), Nuevo Código Procesal Penal (NCPP), Código Civil, Código Penal, legislación laboral y constitucional peruana.
Sistemas de referencia: SINOE, CEJ, INDECOPI, SUNARP, El Peruano.

REGLA DE IDIOMA (OBLIGATORIA):
- Respondes EXCLUSIVAMENTE en español (Perú). NUNCA en inglés, francés u otro idioma.
- Si el usuario escribe en otro idioma, igual respondes en español.
- No uses palabras en inglés salvo términos jurídicos técnicos reconocidos (ej. "dumping", "holding").

Formato de respuesta:
- Respuesta directa y profesional, con citas de artículos o normas cuando corresponda.
- Estructura clara: idea principal primero, luego detalles.
- Si hay varios puntos, usa viñetas o listas numeradas.
- NO muestres tu razonamiento interno ni pasos de pensamiento.
- NO des consejos médicos, financieros ni fuera del ámbito legal peruano.
- NUNCA inventes jurisprudencia o normas — si no tienes certeza, dilo claramente.`;
}

// ─── Disclaimer IA canónico para respuestas de chat SIN tool (LPDP Art. 21) ──
// Fuente única: catalogs/disclaimers-ia.json (vía getDisclaimer en intentRouter.js).
// Las tools (calcular_plazo, redactar_documento, analizar_expediente,
// buscar_jurisprudencia, predecir_resultado) YA inyectan su disclaimer canónico
// en intentRouter.js; este helper aplica el disclaimer GENERAL solo a respuestas
// que NO provienen de una tool (fase1-texto y llamada directa/fallback).
const DISCLAIMER_CHAT_DIRECTO = getDisclaimer('disclaimer_general');

function aplicarDisclaimerChatDirecto(respuesta) {
  if (!DISCLAIMER_CHAT_DIRECTO || !respuesta || typeof respuesta !== 'string') return respuesta;
  if (respuesta.includes(DISCLAIMER_CHAT_DIRECTO)) return respuesta;
  return `${respuesta}\n\n${DISCLAIMER_CHAT_DIRECTO}`;
}

// ─── POST /api/ai/chat ────────────────────────────────────────────────────────
// Versión del formato cacheado en /chat. Al cambiar la estructura de la respuesta
// (tipo_respuesta, intencion, fase_enrutamiento, data) se hace BUMP para NO servir
// respuestas cacheadas viejas con el formato anterior.
// v3 (2026-08-07): respuestas enrutadas y directas ahora incluyen `data`
// estructurada (shape por tool) para tarjetas del frontend sin parsear markdown.
const CHAT_CACHE_VERSION = 'v3';

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
    // FIX P0-REC-5 (2026-08-08): necesitamos el `updated_at` del expediente
    // (que el trigger fn_set_updated_at refresca en cada UPDATE de texto_ocr)
    // para invalidar el cache del chat cuando se sube un nuevo documento al
    // mismo expediente. Sin esto, un OCR nuevo NO invalidaba respuestas
    // cacheadas de prompts anteriores (mismo expediente_id + mismo mensaje =
    // cache hit obsoleto).
    let ocrUpdatedAt = 'sin-ocr';
    if (expediente_id) {
      const { rows: [exp] } = await db.query(
        'SELECT numero, titulo, tipo, estado, texto_ocr, updated_at FROM expedientes WHERE id=$1 AND organization_id=$2',
        [expediente_id, orgId]
      );
      if (exp) {
        contextoExpediente = `\n\nExpediente en contexto: ${exp.numero} — ${exp.titulo} (${exp.tipo}, ${exp.estado})`;
        // Solo marcamos la version del OCR si el expediente tiene texto_ocr;
        // si no tiene, usamos 'sin-ocr' para distinguir "nunca subido" de
        // "subido y refrescado". Esto evita colisiones entre expedientes
        // vacíos distintos.
        ocrUpdatedAt = exp.texto_ocr
          ? (exp.updated_at ? new Date(exp.updated_at).toISOString() : 'ocr-sin-timestamp')
          : 'sin-ocr';
      }
    }

    const recentHistory = (historial ?? []).slice(-20);

    // ─── Router de intenciones ────────────────────────────────────────────────
    // FASE 0 (regex, costo ~0) se evalúa ANTES del cacheKey para que la clave
    // incluya la intención detectada y no se sirvan respuestas cruzadas
    // (p. ej. un "plazo" cacheado no debe responder a una "redacción").
    const intentFase0 = detectarIntencionFase0(mensajeSanitizado)?.intent ?? null;

    const hashChatBase = [
      `org:${req.organizationId}`,
      `user:${req.user?.sub}`,
      'chat',
      CHAT_CACHE_VERSION,
      expediente_id ?? 'sin-expediente',
      // FIX P0-REC-5: incluir la versión del OCR del expediente en la clave
      // de cache. Cuando el usuario sube un nuevo documento al mismo
      // expediente, `updated_at` cambia y el cache se invalida
      // automáticamente sin necesidad de purgado manual.
      `ocr_updated_at:${ocrUpdatedAt}`,
      mensajeSanitizado,
      model || MODEL,
    ];
    const cacheKey = hashKey(...hashChatBase, intentFase0 ?? 'sin-intencion');
    const cached = await get(cacheKey);
    if (cached) {
      // Compat v1: el cache guardaba el string plano; v2 guarda el objeto
      // { respuesta, tipo_respuesta, intencion, fase_enrutamiento }; v3 añade
      // `data` (shape estructurado por tool). `data` puede ser null.
      const c = (typeof cached === 'string')
        ? { respuesta: cached, tipo_respuesta: 'respuesta', intencion: null, fase_enrutamiento: 'cache-v1', data: null }
        : cached;
      // P0 LPDP Art. 21: las respuestas cacheadas que NO provienen de una tool
      // (fase1-texto / directo / cache-v1 legacy) pueden carecer del disclaimer
      // general canónico si se generaron antes de este fix. Las de tool (fase0 /
      // fase2) ya lo inyectan en intentRouter.js → no se tocan (sin duplicados).
      const esRespuestaDeTool = ['fase0', 'fase2'].includes(c.fase_enrutamiento);
      const respuestaCacheada = esRespuestaDeTool
        ? c.respuesta
        : aplicarDisclaimerChatDirecto(c.respuesta);
      if (respuestaCacheada !== c.respuesta) {
        // Sanear el cache viejo para que las próximas lecturas ya traigan disclaimer.
        set(cacheKey, { ...c, respuesta: respuestaCacheada }, 7200).catch(() => {});
      }
      return res.json(withProvider({
        respuesta: respuestaCacheada,
        tipo_respuesta: c.tipo_respuesta || 'respuesta',
        intencion: c.intencion || null,
        fase_enrutamiento: c.fase_enrutamiento || null,
        data: c.data ?? null,
        desdeCache: true,
        tokens: null,
      }, req, model || MODEL));
    }

    // FASE 0 → FASE 1 → FASE 2 con tool executor real. Fail-open: si el router
    // falla (o no detecta intención) devuelve null y se cae a la llamada directa.
    let enrutado = null;
    let intentDetectado = null;
    try {
      enrutado = await enrutarMensaje({
        mensaje: mensajeSanitizado,
        historial: recentHistory,
        expediente_id,
        model: model || MODEL,
        req,
      });
      intentDetectado = enrutado?.intent ?? null;
    } catch (err) {
      req.logger?.warn('[INTENT-ROUTER] Error en enrutamiento, degradando a llamada directa:', err?.message);
      enrutado = null;
    }

    // El router resolvió y ejecutó una herramienta real (o respondió texto limpio).
    if (enrutado) {
      let respuestaEnrutada = enrutado.respuesta || 'No se pudo obtener respuesta.';
      // P0 LPDP Art. 21: cuando el router respondió con texto del LLM SIN tool
      // (fase1-texto) la respuesta NO lleva disclaimer (las tools fase0/fase2 ya
      // lo inyectan en intentRouter.js). Se concatena el general canónico ANTES
      // de cachear y persistir para que todo el flujo use la versión completa.
      if (enrutado.fase === 'fase1-texto') {
        respuestaEnrutada = aplicarDisclaimerChatDirecto(respuestaEnrutada);
      }
      // Contrato de respuesta enrutada para la UI: tipo_respuesta + intencion +
      // fase_enrutamiento + data (shape estructurado por tool; null si es texto directo).
      const payloadEnrutado = {
        respuesta: respuestaEnrutada,
        tipo_respuesta: tipoRespuestaDeIntent(intentDetectado),
        intencion: intentDetectado || null,
        fase_enrutamiento: enrutado.fase || null,
        data: enrutado.data ?? null,
      };
      set(cacheKey, payloadEnrutado, 7200);

      // Si la intención la detectó el LLM (FASE 1) y difiere de la FASE 0,
      // guardar también bajo la clave con la intención real (anti cruzadas).
      if (intentDetectado && intentDetectado !== intentFase0) {
        set(hashKey(...hashChatBase, intentDetectado), payloadEnrutado, 7200).catch(() => {});
      }

      mensajeRepo.guardarParMensajes(req.user.sub, orgId, expediente_id ?? null, mensaje, respuestaEnrutada).catch(() => {});

      // Registrar consumo (los tokens provienen del ejecutor; estimar si es null).
      const tokensEnrutado = enrutado.tokens ?? null;
      const promptTokensEst = tokensEnrutado
        ? Math.max(0, Math.round(tokensEnrutado / 3))
        : Math.round(mensajeSanitizado.length / 4);
      tokenRepo.registrarConsumo(
        req.user.sub,
        orgId,
        intentDetectado ? `chat_${intentDetectado}` : 'chat',
        model || MODEL,
        promptTokensEst,
        tokensEnrutado ? Math.max(0, tokensEnrutado - promptTokensEst) : 0,
        req.headers['x-idempotency-key'] || null
      ).catch(err => {
        req.logger?.error('Error al registrar consumo en chat enrutado:', err);
      });

      // Debitar 1 crédito por consulta de chat (no bloquear respuesta si falla).
      try {
        await tokenRepo.debitarCreditos(req.user.sub, orgId, expediente_id || null, 1, `Chat con herramienta: ${intentDetectado || 'router'}`);
      } catch (creditErr) {
        const msg = String(creditErr.message || '');
        if (msg.includes('insuficientes') || msg.includes('Insuficiente')) {
          return res.status(402).json({ error: msg, code: 'INSUFFICIENT_CREDITS' });
        }
        req.logger?.error('debitarCreditos chat enrutado:', creditErr);
      }

      return res.json(withProvider({
        ...payloadEnrutado,
        tokens: tokensEnrutado,
      }, req, model || MODEL));
    }

    // ─── Llamada directa (fallback) — flujo original intacto ──────────────────
    const contents = [
      ...recentHistory.map(h => ({
        role: (h.role === 'model' || h.role === 'assistant') ? 'model' : 'user',
        parts: [{ text: h.text ?? h.content ?? '' }],
      })),
      {
        role: 'user',
        parts: [{ text: `[Responder SIEMPRE en español, de forma profesional y estructurada, sin mostrar razonamiento interno]\n\n${mensajeSanitizado}${contextoExpediente}` }],
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

    let respuesta = response.text ?? 'No se pudo obtener respuesta.';

    // FIX 2026-08-07: el modelo free a veces ignora el system y responde en
    // inglés. Detectamos y reintentamos con instrucción de traducción explícita.
    if (esTextoMayormenteIngles(respuesta)) {
      try {
        const retry = await getAi().models.generateContent({
          model: model || MODEL,
          contents: [
            {
              role: 'user',
              parts: [{
                text: `Traduce AL ESPAÑOL (Perú) la siguiente respuesta legal. Mantén las citas de artículos y normas tal cual, y el mismo formato:\n\n${respuesta}`,
              }],
            },
          ],
          config: {
            systemInstruction: 'Eres un traductor jurídico español-peruano profesional. Traduce AL ESPAÑOL, conservando citas legales y formato.',
            maxOutputTokens: 2048,
            temperature: 0.2,
          },
        });
        const traducida = retry.text ?? '';
        if (traducida.trim() && !esTextoMayormenteIngles(traducida)) {
          respuesta = traducida;
        }
      } catch (e) {
        req.logger?.warn('[IDIOMA] Reintento de traducción falló:', e?.message);
      }
    }

    // P0 LPDP Art. 21: la llamada directa (fallback) NO pasó por ninguna tool,
    // por lo que el LLM no incluyó el disclaimer general canónico. Se concatena
    // el disclaimer ANTES de cachear, persistir y responder (fuente única:
    // catalogs/disclaimers-ia.json vía getDisclaimer('disclaimer_general')).
    respuesta = aplicarDisclaimerChatDirecto(respuesta);

    set(cacheKey, { respuesta, tipo_respuesta: 'respuesta', intencion: null, fase_enrutamiento: 'directo', data: null }, 7200);

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

    return res.json(withProvider({
      respuesta,
      tipo_respuesta: 'respuesta',
      intencion: null,
      fase_enrutamiento: 'directo',
      data: null,
      tokens: response.usageMetadata?.totalTokenCount ?? null,
    }, req, model || MODEL));
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

    const cacheKey = hashKey(
      `org:${req.organizationId}`,
      `user:${req.user?.sub}`,
      'consulta',
      promptSanitizado,
      tipo,
      model || MODEL
    );
    const cached = await get(cacheKey);
    if (cached) {
      return res.json(withProvider(cached, req, model || MODEL));
    }

    const systemPrompts = {
      analisis: withLegalBase('Eres un analista jurídico experto. Analiza el expediente o documento proporcionado identificando: hechos relevantes, pretensiones, fundamentos jurídicos, pruebas clave, riesgos procesales y estrategia recomendada.'),
      redaccion: withLegalBase('Eres un redactor jurídico experto en escritos legales peruanos. Redacta con estructura formal: sumilla, hechos, fundamentos de derecho, petitorio y firma. Cita artículos específicos del CPC o NCPP según corresponda.'),
      jurisprudencia: withLegalBase('Eres un investigador jurídico especializado en jurisprudencia peruana. Cita precedentes del TC, Corte Suprema e INDECOPI relevantes. Indica el número de expediente o casación cuando sea posible.'),
      predictor: withLegalBase('Eres un analista predictivo judicial. Basándote en la información del caso, evalúa la probabilidad de éxito (porcentaje), factores favorables y desfavorables, casos similares y recomendaciones estratégicas.'),
      alegatos: withLegalBase('Eres un especialista en litigación oral. Redacta alegatos de clausura persuasivos, estructurados en: síntesis de hechos probados, argumentos jurídicos, refutación de la contraparte y petitorio final.'),
      interrogatorio: withLegalBase('Eres un estratega de interrogatorio conforme al NCPP. Diseña preguntas para examen directo y contraexamen, anticipando respuestas y objetivos probatorios.'),
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

      const payload = withProvider({ resultado, tipo, tokens: response.usageMetadata?.totalTokenCount ?? null }, req, model || MODEL);
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

    const payload = withProvider({ resultado: response.text ?? 'Sin respuesta.', tipo, tokens: response.usageMetadata?.totalTokenCount ?? null }, req, model || MODEL);
    set(cacheKey, payload, 7200);
    return res.json(payload);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/ai/consulta/stream (SSE) ───────────────────────────────────────
router.post('/consulta/stream', iaTransferenciaGuard, quotaMiddleware(), validate(aiConsultaSchema), validarDisclaimerAceptado, async (req, res, next) => {
  try {
    const { mensaje, prompt, tipo = 'redaccion', model } = req.body;
    const orgId = req.organizationId;
    // Aceptar "mensaje" o "prompt" (consistencia con /chat y /consulta)
    const promptFinal = mensaje || prompt;

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

    const { sanitizado: promptSanitizado } = sanitizarPrompt(promptFinal, tipo === 'redaccion' ? 'escrito' : 'consulta');
    if (!promptSanitizado.trim()) {
      return res.status(400).json({ error: 'El contenido del prompt contiene elementos no permitidos.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const systemPrompts = {
      redaccion: withLegalBase('Eres un redactor jurídico experto en escritos legales peruanos. Redacta con estructura formal: sumilla, hechos, fundamentos de derecho, petitorio y firma.'),
      alegatos: withLegalBase('Eres un especialista en litigación oral. Redacta alegatos de clausura persuasivos.'),
      interrogatorio: withLegalBase('Eres un estratega de interrogatorio conforme al NCPP. Diseña preguntas para examen directo y contraexamen.'),
      chat: withLegalBase('Eres LexIA, asistente legal IA especializada en derecho peruano.'),
      general: withLegalBase('Eres LexIA, asistente legal IA especializada en derecho peruano.'),
    };

    const systemInstruction = systemPrompts[tipo] ?? buildSystemPrompt(req.user);

    // FIX LPDP-2: Etiquetar el stream con el proveedor IA activo desde el primer chunk
    const streamProvider = resolveProvider(req);
    const streamProviderLabel = IA_PROVIDER_LABEL[streamProvider] || streamProvider;
    const streamModelUsed = model || MODEL;
    res.write(`data: ${JSON.stringify({ status: 'start', provider: streamProvider, provider_label: streamProviderLabel, model: streamModelUsed }) }\n\n`);
    // FIX 2026-08-08 (perf): forzar envío inmediato del primer chunk de control
    // (`status: start`) para que el frontend vea TTFB bajo. Sin res.flush(),
    // Node puede agrupar writes pequeños en un único paquete TCP.
    if (typeof res.flush === 'function') res.flush();

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
    let isFirstContentChunk = true;
    for await (const chunk of stream) {
      const text = chunk.text ?? '';
      if (chunk.usageMetadata) {
        promptTokens = chunk.usageMetadata.promptTokenCount || promptTokens;
        completionTokens = chunk.usageMetadata.candidatesTokenCount || completionTokens;
        totalTokens = chunk.usageMetadata.totalTokenCount || totalTokens;
      }
      res.write(`data: ${JSON.stringify({ chunk: text, provider: streamProvider, model: streamModelUsed }) }\n\n`);
      // FIX 2026-08-08 (perf): flush tras el PRIMER chunk de contenido real
      // (no el 'status: start' que ya hicimos arriba). Esto minimiza el
      // TTFB percibido por el usuario cuando el LLM empieza a responder.
      if (isFirstContentChunk && text) {
        if (typeof res.flush === 'function') res.flush();
        isFirstContentChunk = false;
      }
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

    res.write(`data: ${JSON.stringify(withRagContext({ done: true, tokens: totalTokens, provider: streamProvider, provider_label: streamProviderLabel, model: streamModelUsed }, req)) }\n\n`);
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
// FIX P0 (2026-08-07): ANCLADO AL RAG — jurisprudencia SOLO desde chunks REALES
// indexados en rag_vectors_v2 (filter tipo='jurisprudencia'). NUNCA se llama al
// LLM para generar números de casación. Fail-closed: si el RAG no devuelve
// resultados con score suficiente, responde { resultados: [], aviso }.
const JURISPRUDENCIA_CACHE_VERSION = 'v2';
const JURISPRUDENCIA_RAG_TOP_K = 10;
// Umbrales en modo degradado (embeddings placeholder/hash): con vectores hash
// la similitud coseno es baja, así que se usan umbrales más permisivos que
// permitan el retrieval híbrido full-text+keywords. Cuando se restaure un
// proveedor de embeddings real, subir a 0.70/0.55 vía env.
const JURISPRUDENCIA_RAG_RETRIEVE_THRESHOLD = parseFloat(process.env.JURIS_RAG_RETRIEVE_THRESHOLD || '0.15');
const JURISPRUDENCIA_RAG_SCORE_THRESHOLD = parseFloat(process.env.JURIS_RAG_SCORE_THRESHOLD || '0.20');

// Mapeo determinístico source → tribunal. Deriva del catálogo real indexado,
// NO es inventado por el LLM.
const TRIBUNAL_POR_FUENTE = {
  'casaciones-pj-2026.json': 'Corte Suprema de la República',
  'sentencias-tc-completas-2026.json': 'Tribunal Constitucional',
  'jurisprudencia-tc-2026.json': 'Tribunal Constitucional',
  'resoluciones-indecopi-2026.json': 'INDECOPI',
  'resoluciones-tribunal-fiscal-2026.json': 'Tribunal Fiscal',
  'resoluciones-anpd-2026.json': 'ANPDP',
  'directivas-sunarp-2026.json': 'SUNARP',
};

function extraerNumeroDeContenido(content) {
  const m = String(content || '').match(/Número:\s*(Casación\s*N\.?°?\s*[\d-]+|Expediente\s*N\.?°?\s*[\d-]+|[\d-]+\s*-\s*\d{4})/i);
  return m ? m[1].trim() : null;
}

function extraerAnioDeContenido(content) {
  const m = String(content || '').match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : null;
}

/**
 * Convierte un chunk RAG REAL (jurisprudencia indexada) al shape que consume
 * BuscadorJurisprudencia.jsx: { tribunal, numero, año, resumen, relevancia,
 * url_referencia } + extras de compatibilidad (tipo, sala, titulo, fuente,
 * similitud). Los números/casaciones provienen SOLO del metadata del chunk.
 */
function chunkAResultadoJurisprudencia(chunk) {
  const meta = chunk?.metadata ?? {};
  const content = String(chunk?.content || '');
  const fuente = meta.source || chunk.source || '';
  const tribunal = meta.sala || meta.tribunal || TRIBUNAL_POR_FUENTE[fuente] || null;
  const numero = meta.numero || extraerNumeroDeContenido(content);
  const anio = (meta.fecha && String(meta.fecha).match(/\b(19|20)\d{2}\b/)?.[0]) || extraerAnioDeContenido(content);
  return {
    tribunal,
    numero,
    año: anio,
    resumen: content.slice(0, 700),
    relevancia: (meta.relevancia || 'MEDIA').toLowerCase(),
    url_referencia: meta.url || null,
    // Extras compatibles con el frontend (no rompen el contrato previo).
    tipo: meta.tipo || 'jurisprudencia',
    sala: meta.sala || tribunal,
    titulo: meta.nombre || meta.titulo || tribunal || (numero ? `Casación ${numero}` : 'Jurisprudencia'),
    fuente,
    similitud: typeof chunk.similarity === 'number' ? Number((chunk.similarity * 100).toFixed(1)) : null,
  };
}

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

    // Cache v2: prefix con versión para invalidar respuestas alucinadas cacheadas.
    const cacheKeyJuris = hashKey(
      `jurisprudencia-${JURISPRUDENCIA_CACHE_VERSION}`,
      `org:${req.organizationId}`,
      qSanitizado,
      rama,
      limit,
      model || MODEL
    );
    const cachedJuris = await get(cacheKeyJuris);
    if (cachedJuris) {
      return res.json(withProvider(cachedJuris, req, model || MODEL));
    }

    const topK = Math.min(parseInt(limit, 10) || 5, JURISPRUDENCIA_RAG_TOP_K);

    // ── Fuente primaria OBLIGATORIA: RAG (fail-closed, NUNCA inventar) ──
    const queryRag = `${qSanitizado} | jurisprudencia Perú 2026`;
    let chunks = [];
    let ragDegradado = false; // FIX P0-F2 (2026-08-21): flag degradación RAG
    try {
      // FIX LDDE-GAP1 (2026-08-22): path principal = buscarAvanzado (multi-query
      // + RRF + reranking). Fallback a retrieve() básico + hybridScore si falla.
      let raw;
      try {
        raw = await buscarAvanzado(queryRag, {
          topK,
          filter: { tipo: 'jurisprudencia' },
          threshold: JURISPRUDENCIA_RAG_RETRIEVE_THRESHOLD,
        });
      } catch (advErr) {
        req.logger?.warn('[RAG] buscarAvanzado falló, fallback básico:', advErr?.message);
        raw = await retrieve(queryRag, {
          topK,
          threshold: JURISPRUDENCIA_RAG_RETRIEVE_THRESHOLD,
          filter: { tipo: 'jurisprudencia' },
        });
        raw = hybridScore(Array.isArray(raw) ? raw : [], qSanitizado);
      }
      // FIX 2026-08-22 (HIGH): hybridScore ya NO sobrescribe `similarity` con el
      // score combinado (señal pura en similarity, boost léxico en
      // combined_score). El umbral se evalúa sobre combined_score cuando existe.
      chunks = (Array.isArray(raw) ? raw : []).filter(c => typeof c.similarity === 'number' && (c.combined_score ?? c.similarity) >= JURISPRUDENCIA_RAG_SCORE_THRESHOLD);
      // FIX P0-F2 (2026-08-21): propagar flag degraded del retrieval
      // (hash-fallback = similitudes cross-space potencialmente inválidas).
      ragDegradado = chunks.some(c => c.degraded === true);
    } catch (ragErr) {
      // Fail-closed: RAG no disponible (DATABASE_URL ausente, embedding caído, etc.).
      req.logger?.warn('[RAG] /jurisprudencia no disponible (fail-closed, sin inventar):', ragErr?.message);
      chunks = [];
    }

    // Audit event para trazabilidad (LOPJ art. 290 / LPDP Art. 21).
    logAudit('JURISPRUDENCE_RETRIEVED', {
      userId: req.user?.sub,
      organizationId: req.organizationId,
      query: qSanitizado,
      chunkCount: chunks.length,
      degraded: ragDegradado, // FIX P0-F2
    }).catch(() => {});

    // 0 resultados con score suficiente → fail-closed, NUNCA llamar al LLM.
    if (chunks.length === 0) {
      const vacio = withProvider(
        {
          resultados: [],
          aviso: 'No se encontró jurisprudencia indexada verificable para su consulta.',
          query: qSanitizado,
          rama,
          rag_verificado: true,
        },
        req,
        model || MODEL
      );
      set(cacheKeyJuris, vacio, 7200);
      return res.json(vacio);
    }

    // FIX P0-F2 (2026-08-21): si el retrieval corrió degradado (embedding hash
    // vs corpus embo-01), las similitudes NO son verificables → el payload
    // NUNCA puede afirmar rag_verificado:true. Flag explícito para el frontend
    // (disclaimer rojo #DC2626) y para auditoría forense posterior.
    const resultados = chunks.slice(0, topK).map(chunkAResultadoJurisprudencia);
    const jurisPayload = withProvider(
      {
        resultados,
        query: qSanitizado,
        rama,
        rag_verificado: !ragDegradado,
        rag_degradado: ragDegradado,
        ...(ragDegradado ? { aviso_degradacion: 'Resultados recuperados en modo degradado (embeddings placeholder). Verificar fuentes manualmente en SPIJ antes de citar.' } : {}),
      },
      req,
      model || MODEL
    );
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

    const raw = response.text?.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '') ?? '{"especialidades":[]}';
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

  const cacheKey = hashKey(
    `org:${req.organizationId}`,
    `user:${req.user?.sub}`,
    'panel_especialista',
    espId,
    promptConContexto,
    model || MODEL
  );
  try {
    const cachedResult = await get(cacheKey);
    if (cachedResult) {
      return { especialista: espId, analisis: cachedResult, desdeCache: true };
    }
  } catch (err) {
    req.logger?.error(`Error leyendo caché de Redis para especialista ${espId}:`, err);
  }

  const llamadaIA = async () => {
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
        systemInstruction: withLegalBase(config.systemInstruction),
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

  return Promise.race([llamadaIA(), timeoutPromise]);
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
    const cacheKeyConsolidado = hashKey(
      `org:${req.organizationId}`,
      `user:${req.user?.sub}`,
      'panel_consolidado',
      expediente_id ?? 'sin-expediente',
      promptSanitizado,
      espSeleccionados.join(','),
      model || MODEL
    );
    try {
      const cachedConsolidado = await get(cacheKeyConsolidado);
      if (cachedConsolidado) {
        return res.json(withProvider({ ...cachedConsolidado, desdeCacheGlobal: true }, req, model || MODEL));
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
        systemInstruction: withLegalBase('Eres el Consolidador Master de la plataforma LegalPro en el Perú. Consolida de forma unificada, estructurada y resalta las particularidades procesales peruanas.'),
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

    const payload = withProvider({
      especialidades: espSeleccionados,
      especialistas_detalles: resultadosEspecialistas.map(r => ({
        especialista: r.especialista,
        timeout: r.timeout || false,
        desdeCache: r.desdeCache || false,
        analisis: r.analisis
      })),
      diagnostico,
      tokens: response.usageMetadata?.totalTokenCount ?? null
    }, req, model || MODEL);

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
      // FIX 2026-08-08 (perf): flush tras el primer mensaje SSE del stream
      // para minimizar TTFB percibido por el cliente. Solo flusheamos
      // ocasionalmente para no penalizar el throughput del stream masivo
      // (cada flush fuerza envío de paquete TCP).
      if (typeof res.flush === 'function' && (status === 'start' || status === 'enrutando' || status === 'enrutado' || status === 'analizando')) {
        res.flush();
      }
    };

    // FIX LPDP-2: Etiquetar el stream de panel-expertos con el proveedor IA activo
    const panelStreamProvider = resolveProvider(req);
    const panelStreamProviderLabel = IA_PROVIDER_LABEL[panelStreamProvider] || panelStreamProvider;
    const panelStreamModelUsed = model || MODEL;
    enviarSSE('start', {
      provider: panelStreamProvider,
      provider_label: panelStreamProviderLabel,
      model: panelStreamModelUsed,
      message: `Proveedor IA activo: ${panelStreamProviderLabel}`
    });

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
        systemInstruction: withLegalBase('Eres el Consolidador Master de la plataforma LegalPro en el Perú. Consolida de forma unificada, estructurada y resalta las particularidades procesales peruanas.'),
        maxOutputTokens: 4096,
        temperature: 0.3,
      }
    });

    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let isFirstContentChunk = true;

    for await (const chunk of stream) {
      const text = chunk.text ?? '';
      if (chunk.usageMetadata) {
        promptTokens = chunk.usageMetadata.promptTokenCount || promptTokens;
        completionTokens = chunk.usageMetadata.candidatesTokenCount || completionTokens;
        totalTokens = chunk.usageMetadata.totalTokenCount || totalTokens;
      }
      enviarSSE('chunk', { chunk: text });
      // FIX 2026-08-08 (perf): flush tras el primer chunk de contenido real.
      // El consolidador puede tardar 1-3s antes del primer chunk; este flush
      // garantiza que el primer byte llegue al cliente apenas esté disponible.
      if (isFirstContentChunk && text) {
        if (typeof res.flush === 'function') res.flush();
        isFirstContentChunk = false;
      }
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

    enviarSSE('done', withRagContext({ tokens: totalTokens, provider: panelStreamProvider, provider_label: panelStreamProviderLabel, model: panelStreamModelUsed }, req));
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

