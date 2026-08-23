/**
 * RAG Middleware para LegalPro
 *
 * Inyecta contexto de la base legal peruana actualizada en las respuestas IA.
 * Controlado por feature flag ENABLE_RAG.
 *
 * Comportamiento:
 * - Si ENABLE_RAG=false (default), es no-op (no afecta performance).
 * - Solo aplica a /api/ai/* y /api/legal/* (otros paths pasan transparente).
 * - Si la consulta es muy corta (<5 chars) o falta, hace skip.
 * - Si RAG falla por timeout/error de DB, NO bloquea la request — degrada con req.ragContext=null.
 * - Emite audit event 'RAG_CONTEXT_INJECTED' para trazabilidad LPDP.
 *
 * Handlers IA que quieran exponer citaciones deben llamar `withRagContext(payload, req)`
 * (exportado aquí) o revisar `req.ragContext` directamente.
 *
 * Variables de entorno:
 * - ENABLE_RAG: 'true' para activar (default: 'false')
 * - RAG_TOP_K: número de chunks a recuperar (default: 5)
 * - RAG_THRESHOLD: similitud mínima coseno (default: 0.70)
 *
 * @version 1.0.0
 */

import { consultarBaseLegal } from '../../../tools/rag/junior-rag-wrapper.mjs';
import logger from '../logger.js';

const FEATURE_FLAG = process.env.ENABLE_RAG === 'true';
const RAG_TOP_K = parseInt(process.env.RAG_TOP_K || '5', 10);
const RAG_THRESHOLD = parseFloat(process.env.RAG_THRESHOLD || '0.70');
const MIN_QUERY_LENGTH = 5;

const MATERIAS_VALIDAS = new Set([
  'civil', 'penal', 'laboral', 'tributario', 'constitucional',
  'familia', 'comercial', 'ambiental', 'administrativo', 'arbitraje',
  'consumidor', 'penal_economico', 'procesal_penal', 'concursal',
  'propiedad_intelectual', 'compliance', 'migratorio', 'mineria',
  'sanitario', 'seguridad_social', 'notarial', 'educativo'
]);

const RAG_PATH_PREFIXES = ['/api/ai/', '/api/legal/'];

/**
 * Middleware que inyecta contexto RAG al request.
 * Idempotente y no-bloqueante: si ENABLE_RAG=false o RAG falla, sigue adelante.
 */
export async function ragMiddleware(req, res, next) {
  // 1. Feature flag: si está desactivado, skip total (cero overhead).
  if (!FEATURE_FLAG) {
    return next();
  }

  // 2. Filtrar solo endpoints IA. Usamos req.path que es la ruta completa
  //    porque este middleware se monta globalmente en app.use(ragMiddleware).
  const path = req.path || '';
  const esEndpointIA = RAG_PATH_PREFIXES.some(prefix => path.startsWith(prefix));
  if (!esEndpointIA) {
    return next();
  }

  try {
    const materia = inferirMateria(path, req.body);
    const consulta = req.body?.prompt || req.body?.consulta || req.body?.mensaje || '';
    const contexto = req.body?.expediente_id
      ? `Expediente ID: ${req.body.expediente_id}`
      : '';

    // 3. Si la consulta es muy corta o no existe, skip — no gastamos embedding
    //    en queries que claramente no se beneficiarán del RAG.
    if (!consulta || typeof consulta !== 'string' || consulta.trim().length < MIN_QUERY_LENGTH) {
      return next();
    }

    logger.debug?.({ path, materia, topK: RAG_TOP_K }, '[rag-middleware] consultando base legal');

    const baseLegal = await consultarBaseLegal({
      materia,
      consulta,
      contexto,
      // FIX P0-F4 (2026-08-21): pasar el threshold REAL configurado. Antes el
      // wrapper hardcodeaba 0.70 y este audit log registraba un valor que
      // nunca se aplicó (trazabilidad falsa).
      threshold: RAG_THRESHOLD
    });

    // 4. Inyectar en request para uso del handler IA downstream.
    req.ragContext = baseLegal;

    // 4b. FIX P0-F4 (2026-08-21): instrumentación rag_audit_log (best-effort).
    // Antes la tabla existía pero jamás se escribía → imposible detectar
    // alucinaciones masivas o degradación del corpus en producción.
    try {
      const { pool } = await import('../db.js');
      const crypto = await import('node:crypto');
      const queryHash = crypto.createHash('sha256').update(consulta).digest('hex');
      await pool.query(
        `SELECT fn_log_rag_query($1, $2, $3, $4, $5, $6, $7)`,
        [
          req.organizationId ?? null,
          req.user?.sub ?? null,
          queryHash,
          baseLegal.chunks_usados ?? 0,
          JSON.stringify((baseLegal.citaciones || []).slice(0, 5).map((c) => ({ fuente: c.fuente, similitud: c.similitud }))),
          baseLegal.threshold_aplicado ?? RAG_THRESHOLD,
          baseLegal.degraded ?? false
        ]
      ).catch(() => {}); // la función puede no existir aún si migración RAG no se aplicó
    } catch { /* best-effort: nunca bloquear el flujo IA por telemetría */ }

    // 5. Audit event fire-and-forget (no bloquea si la tabla audit_log no existe).
    const { logAudit } = await import('../utils/audit.js');
    logAudit('RAG_CONTEXT_INJECTED', {
      path,
      materia,
      chunks_usados: baseLegal.chunks_usados ?? 0,
      similitud_promedio: baseLegal.audit_metadata?.similitud_promedio ?? null,
      usuario_id: req.user?.sub,
      organizacion_id: req.organizationId,
      ip: req.ip,
      rag_top_k: RAG_TOP_K,
      rag_threshold: baseLegal.threshold_aplicado ?? RAG_THRESHOLD, // FIX P0-F4: umbral REAL
      rag_degraded: baseLegal.degraded ?? false // FIX P0-F2
    }).catch(() => {});

    next();
  } catch (err) {
    // 6. Fail-open: si RAG falla (timeout, DB caída, embedding provider caído),
    //    NO bloquear la respuesta IA. Marcar null y seguir.
    logger.error({ err: err.message, path: req.path }, '[rag-middleware] error no-bloqueante');
    req.ragContext = null;
    next();
  }
}

/**
 * Infiere la materia legal del path o del body.
 * Precedencia: body.materia > path > 'general'.
 */
function inferirMateria(path, body) {
  // 1. Si el body especifica materia válida, usar esa.
  if (body?.materia && typeof body.materia === 'string') {
    const m = body.materia.toLowerCase();
    if (MATERIAS_VALIDAS.has(m)) return m;
  }

  // 2. Inferir del path (heurística para /api/ai/<materia>/... o /api/legal/<materia>).
  if (path.includes('/penal')) return 'penal';
  if (path.includes('/civil')) return 'civil';
  if (path.includes('/laboral')) return 'laboral';
  if (path.includes('/tributario')) return 'tributario';
  if (path.includes('/familia')) return 'familia';
  if (path.includes('/comercial')) return 'comercial';
  if (path.includes('/amparo')) return 'constitucional';
  if (path.includes('/constitucional')) return 'constitucional';
  if (path.includes('/administrativo')) return 'administrativo';
  if (path.includes('/consumidor')) return 'consumidor';
  if (path.includes('/arbitraje')) return 'arbitraje';

  // 3. Default: materia general (sin filtro en el retriever).
  return 'general';
}

/**
 * Helper para inyectar citaciones y metadata RAG en una respuesta IA.
 *
 * Uso en handlers:
 *   const payload = withProvider({ respuesta: '...' }, req, model);
 *   return res.json(withRagContext(payload, req));
 *
 * Si no hay RAG context o chunks_usados === 0, retorna el payload sin modificar.
 */
export function withRagContext(payload, req) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  if (!req?.ragContext) return payload;

  const rag = req.ragContext;
  const chunksUsados = rag.chunks_usados ?? 0;

  // Solo inyectar si hubo resultados reales (no cuando el RAG degradó a "sin resultados").
  if (chunksUsados <= 0) return payload;

  return {
    ...payload,
    citaciones: rag.citaciones ?? [],
    fuentes_consultadas: rag.fuentes ?? [],
    rag_usado: true,
    rag_chunks: chunksUsados,
    rag_similitud_promedio: rag.audit_metadata?.similitud_promedio ?? null,
    rag_fecha_consulta: rag.fecha_consulta ?? new Date().toISOString(),
  };
}

/**
 * Helper para formatear citaciones en respuestas IA como texto Markdown.
 * Útil cuando el handler quiere incrustar las citaciones dentro del texto IA.
 */
export function formatCitaciones(citaciones) {
  if (!citaciones || citaciones.length === 0) return '';
  return citaciones
    .map(c => `[${c.numero}] ${c.fuente}${c.metadata?.articulo ? ` - ${c.metadata.articulo}` : ''} (similitud: ${(c.similitud * 100).toFixed(0)}%)`)
    .join('\n');
}

/**
 * Helper para inyectar los 4 disclaimers IA obligatorios al final de un contenido.
 *
 * Cumplimiento: LPDP Art. 21 (transparencia activa) + catálogo de disclaimers IA.
 */
export function inyectarDisclaimers(contenido) {
  const disclaimers = [
    '\n\n---\n',
    '⚠️ Esta respuesta es generada por IA y NO constituye asesoría legal.',
    '⚠️ Siempre consulta con un abogado colegiado antes de tomar decisiones legales.',
    '⚠️ La información proviene de fuentes oficiales pero puede estar sujeta a cambios.',
    '⚠️ Verifica las citas consultando directamente las fuentes oficiales.'
  ];
  return contenido + disclaimers.join('\n');
}

export default ragMiddleware;