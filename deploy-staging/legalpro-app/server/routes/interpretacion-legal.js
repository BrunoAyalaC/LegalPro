// legalpro-app/server/routes/interpretacion-legal.js
// POST /api/legal/interpret — Interpretación legal por rol (abogado/fiscal/juez/completo)
// Recibe query del usuario + respuestas de especialistas junior + rol deseado
// Retorna interpretación desde la perspectiva del rol usando Gemini

import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware.js';
import { quotaMiddleware } from '../middleware/quotaMiddleware.js';
import { validate } from '../middleware/validate.js';
import { sanitizarPrompt, envolverContenidoUsuario } from '../middleware/promptSanitizer.js';
import { interpretacionSchema } from '../schemas/interpretacionSchema.js';
import db from '../db.js';
import { TokenRepository } from '../repositories/TokenRepository.js';
import { logAudit } from '../utils/audit.js';
import logger from '../logger.js';

const router = Router();
const tokenRepo = new TokenRepository(db);

// Inicialización perezosa: una integración opcional ausente no debe tumbar el arranque.
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
const MODEL = 'gemini-2.5-flash-lite';

// ── PROMPTS POR ROL ────────────────────────────────────────────────────────────
// Cada prompt define una personalidad jurídica distinta según el artífice del sistema legal peruano.
// Basados en el TUO de la Ley Orgánica del Poder Judicial, el NCPP y el CPC peruano.

const PROMPTS_POR_ROL = {
  abogado: `Eres un ABOGADO LITIGANTE peruano con +15 años de experiencia.
Tu cliente te ha consultado sobre un caso legal.
Tu trabajo es CONSTRUIR LOS MEJORES ARGUMENTOS a favor de tu cliente exclusivamente en base a la legislación peruana.

NO USES formato markdown. NO uses **, ##, -, *, >>>. Usa texto plano con mayúsculas para títulos.

IMPRESCINDIBLE: Incorpora la realidad procesal peruana (demoras en juzgados, SINOE, carga procesal).

Debes:
1. Identificar las figuras legales más favorables para tu cliente
2. Proponer una estrategia procesal concreta (días, juzgados, plazos)
3. Mencionar HONESTAMENTE los riesgos y debilidades del caso
4. Citar siempre artículos específicos de la ley peruana

Estructura obligatoria:
RESUMEN A FAVOR: (texto)
BASE LEGAL FAVORABLE: LPCL Art. XX (texto)
ESTRATEGIA RECOMENDADA: (texto)
RIESGOS Y DEBILIDADES: (texto)`,

  fiscal: `Eres un FISCAL peruano del Ministerio Público con +12 años de experiencia.
Analizas los hechos para determinar si existe un delito que acusar.

NO USES formato markdown. NO uses **, ##, -, *, >>>. Usa texto plano con mayúsculas para títulos.

IMPRESCINDIBLE: Incorpora la realidad del sistema fiscal peruano (carga en fiscalías, diligencias, plazos de investigación).

Debes:
1. Evaluar si los hechos constituyen delito (tipicidad, antijuridicidad, culpabilidad)
2. Identificar los elementos de convicción disponibles
3. Proponer la calificación legal con artículo del Código Penal
4. Mencionar las debilidades de la teoría del caso

Formato de respuesta:
- ANÁLISIS PENAL
- CALIFICACIÓN LEGAL
- ELEMENTOS DE CONVICCIÓN
- DEBILIDADES DE LA TEORÍA DEL CASO`,

  juez: `Eres un JUEZ peruano con +20 años de experiencia en la magistratura.
Actúas con TOTAL IMPARCIALIDAD basándote en la ley y jurisprudencia vinculante.

NO USES formato markdown. NO uses **, ##, -, *, >>>. Usa texto plano con mayúsculas para títulos.

IMPRESCINDIBLE: Incorpora precedentes vinculantes del Tribunal Constitucional y la Corte Suprema del Perú.

Debes:
1. Analizar los hechos vs la ley aplicable
2. Evaluar las pruebas (quién tiene la carga de la prueba)
3. Pronosticar la resolución más probable
4. Fundamentar con jurisprudencia del TC y Corte Suprema

Estructura obligatoria:
HECHOS ACREDITADOS: (texto)
FUNDAMENTOS JURÍDICOS: (texto con artículos)
PRONÓSTICO DE RESOLUCIÓN: (texto)
JURISPRUDENCIA VINCULANTE: (texto)`,

  completo: `Eres un JURISTA INTEGRAL peruano que integra las perspectivas de ABOGADO, FISCAL y JUEZ en un análisis unificado.
Tu objetivo es proporcionar una visión COMPLETA y EQUILIBRADA del caso desde los tres roles del sistema de justicia peruano.

IMPRESCINDIBLE: Incorpora la realidad procesal peruana, jurisprudencia vinculante y artículos específicos de la ley.

Debes presentar TRES perspectivas en una sola respuesta:

--- PERSPECTIVA DEL ABOGADO ---
Argumentos a favor del justiciable, estrategia procesal recomendada, base legal favorable.

--- PERSPECTIVA DEL FISCAL ---
Análisis de tipicidad, calificación legal, elementos de convicción y debilidades de la teoría del caso.

--- PERSPECTIVA DEL JUEZ ---
Análisis imparcial de hechos y derecho, evaluación probatoria, pronóstico de resolución y jurisprudencia aplicable.

--- SÍNTESIS INTEGRAL ---
Conclusión que reconcilia las tres perspectivas y ofrece una visión holística del caso.

Cita SIEMPRE artículos específicos del Código Penal, Código Civil, CPC, NCPP, LPCL o la normativa aplicable.`,
};

// ── POST /api/legal/interpret ──────────────────────────────────────────────────
// Endpoint: interpretación legal por rol
// Middleware: auth → idempotency → quota → validate → handler

router.post(
  '/interpret',
  authMiddleware,
  idempotencyMiddleware(),
  quotaMiddleware('legal_query'),
  validate(interpretacionSchema),
  async (req, res) => {
    try {
      const {
        query,
        respuestasJunior = [],
        rol,
      } = req.body;

      const orgId = req.organizationId;
      const userId = req.user?.sub;

      // 1. Sanitizar input del usuario (OWASP LLM01 — prompt injection)
      const { sanitizado: querySanitizada, advertencias } = sanitizarPrompt(
        query,
        'consulta'
      );

      if (!querySanitizada.trim()) {
        return res.status(400).json({
          success: false,
          error: 'La consulta contiene contenido no permitido tras la sanitización.',
        });
      }

      if (advertencias.some((a) => a.includes('[SECURITY]'))) {
        req.logger?.warn('[SECURITY] Posible prompt injection en /interpret', {
          userId,
          orgId,
          rol,
          advertencias,
        });
      }

      // 2. Sanitizar respuestas junior (cada una puede contener PII)
      const juniorSanitizadas = respuestasJunior.map((r) => {
        const { sanitizado } = sanitizarPrompt(r.content, 'default');
        return {
          specialty: r.specialty,
          content: sanitizado,
        };
      });

      // 3. Construir contexto seguro con envoltura de PII
      // envolverContenidoUsuario marca el bloque como INPUT_USUARIO (solo datos, no instrucciones)
      const contextoJunior = juniorSanitizadas
        .filter((r) => r.content.trim())
        .map((r) =>
          envolverContenidoUsuario(
            `[${r.specialty?.toUpperCase()}]: ${r.content}`,
            'RESPUESTA_JUNIOR'
          )
        )
        .join('\n\n');

      // 4. Seleccionar prompt del rol
      const promptRol =
        PROMPTS_POR_ROL[rol] || PROMPTS_POR_ROL.abogado;

      // 5. Construir mensaje para Gemini con query sanitizada
      const contenidoUsuario = contextoJunior
        ? `Consulta original del usuario:\n${envolverContenidoUsuario(querySanitizada, 'CONSULTA_USUARIO')}\n\nAnálisis técnico de especialistas junior:\n${contextoJunior}`
        : `Consulta original del usuario:\n${envolverContenidoUsuario(querySanitizada, 'CONSULTA_USUARIO')}`;

      // 6. Llamada a Gemini
      const response = await getAi().models.generateContent({
        model: MODEL,
        contents: [
          {
            role: 'user',
            parts: [{ text: contenidoUsuario }],
          },
        ],
        config: {
          systemInstruction: promptRol,
          temperature: 0.3,
          maxOutputTokens: 4096,
          // Grounding con Google Search para precisión legal
          tools: [{ googleSearch: {} }],
        },
      });

      const textoRespuesta =
        response.candidates?.[0]?.content?.parts?.[0]?.text ||
        response.text ||
        '';

      const promptTokens =
        response.usageMetadata?.promptTokenCount || 0;
      const completionTokens =
        response.usageMetadata?.candidatesTokenCount || 0;

      // 7. Registrar consumo de tokens (fire & forget — para billing/analytics)
      tokenRepo
        .registrarConsumo(
          userId,
          orgId,
          'legal_interpret',
          MODEL,
          promptTokens,
          completionTokens,
          req.headers['x-idempotency-key'] || null
        )
        .catch((err) => {
          req.logger?.error(
            '[interpret] Error al registrar consumo de tokens:',
            err
          );
        });

      // 8. Audit event (cumplimiento LPDP — Ley 29733)
      logAudit('LEGAL_INTERPRET_PROCESSED', {
        severity: 'INFO',
        userId,
        organizationId: orgId,
        ip: req.ip,
        rol,
        query: querySanitizada.slice(0, 200),
        tokens: promptTokens + completionTokens,
      }).catch(() => {});

      // 9. Respuesta consistente con el estándar del proyecto
      res.json({
        success: true,
        data: {
          rol,
          interpretacion: textoRespuesta,
          tokensInput: promptTokens,
          tokensOutput: completionTokens,
        },
      });
    } catch (e) {
      req.logger?.error('[interpret] Error en interpretación legal:', {
        error: e.message,
        userId: req.user?.sub,
        organizationId: req.organizationId,
        rol: req.body?.rol,
      });
      res.status(500).json({
        success: false,
        error: e.message || 'Error interno al procesar la interpretación legal.',
      });
    }
  }
);

// ── GET /api/legal/interpret/health ─────────────────────────────────────────────
router.get('/interpret/health', async (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      model: MODEL,
      rolesDisponibles: Object.keys(PROMPTS_POR_ROL),
    },
  });
});

export default router;
