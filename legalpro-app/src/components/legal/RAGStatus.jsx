/**
 * RAGStatus — Indicador compacto del estado RAG de una respuesta IA.
 *
 * Muestra dos señales complementarias para el usuario:
 *   1. Cuántos chunks legales se usaron y la relevancia promedio.
 *   2. Si la respuesta NO encontró base legal específica, una advertencia
 *      ámbar para que el usuario no la confunda con un análisis fundamentado.
 *
 * Cumple:
 *   - WCAG 2.1 AA: el banner usa `role="status"` para avisos no críticos.
 *   - es-PE: copy en español de Perú.
 *   - prefers-reduced-motion: sin animaciones si el usuario lo solicita.
 *
 * @param {object}   props
 * @param {object}   [props.ragContext] Contexto RAG del payload IA. Si es null/undefined
 *                                     el componente retorna `null`.
 * @param {string}   [props.className] Clases Tailwind adicionales.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, FileText } from 'lucide-react';

function colorPorSimilitud(s) {
  if (s >= 0.8) return 'text-emerald-400';
  if (s >= 0.65) return 'text-amber-400';
  return 'text-orange-400';
}

export default function RAGStatus({ ragContext, className = '' }) {
  const reduceMotion = useReducedMotion();

  if (!ragContext || typeof ragContext !== 'object') return null;

  const chunksUsados = Number.isFinite(ragContext.chunks_usados)
    ? ragContext.chunks_usados
    : 0;
  const similitud = Number.isFinite(ragContext.similitud_promedio)
    ? ragContext.similitud_promedio
    : null;
  const necesitaRevision = Boolean(ragContext.necesita_revision_humana);

  const animProps = reduceMotion
    ? { initial: false, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 } };

  if (chunksUsados === 0) {
    return (
      <motion.div
        role="status"
        transition={{ duration: reduceMotion ? 0 : 0.2 }}
        {...animProps}
        className={`flex items-center gap-2 text-xs text-orange-300 bg-orange-500/10 border border-orange-500/20 rounded px-2 py-1 mt-2 ${className}`}
      >
        <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        <span>
          Sin base legal específica — respuesta general.
          {necesitaRevision && ' Requiere revisión humana.'}
        </span>
      </motion.div>
    );
  }

  const calidadColor = similitud !== null ? colorPorSimilitud(similitud) : 'text-cyan-400';

  return (
    <motion.div
      role="status"
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
      {...animProps}
      className={`flex items-center gap-2 text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded px-2 py-1 mt-2 ${className}`}
    >
      <FileText className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
      <span>
        Respuesta con <strong>{chunksUsados}</strong>{' '}
        {chunksUsados === 1 ? 'fuente legal' : 'fuentes legales'}
        {similitud !== null && (
          <>
            {' · '}
            <span className={calidadColor}>
              {similitud.toFixed(0)}% relevancia
            </span>
          </>
        )}
        {necesitaRevision && (
          <span className="text-amber-300"> · revisión humana</span>
        )}
      </span>
    </motion.div>
  );
}
