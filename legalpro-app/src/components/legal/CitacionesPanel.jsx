/**
 * CitacionesPanel — Panel colapsable de citaciones RAG.
 *
 * Muestra las fuentes verificables que el sistema RAG consultó para
 * generar una respuesta IA. Cada citación expone:
 *   - Identificador numérico estable (1, 2, 3…) para enlazarse con el texto IA.
 *   - Nombre de la fuente y, si está disponible, enlace a la URL oficial.
 *   - Metadata adicional (artículo, norma) cuando el backend la provee.
 *   - Porcentaje de similitud semántica, coloreado según umbral.
 *
 * Reglas duras aplicadas:
 *   - Solo se renderizan URLs http(s):// válidas (mitigación XSS / tab-nabbing).
 *   - `prefers-reduced-motion` desactiva las animaciones de expansión.
 *   - Botón accesible con `aria-expanded` / `aria-controls`.
 *   - Textos en es-PE.
 *
 * El componente es presentacional: si no hay RAG o no hay citaciones,
 * retorna `null` y el llamador debe ocultarlo sin afectar el layout.
 *
 * @param {object}   props
 * @param {Array}    props.citaciones       Array de citaciones devueltas por el backend.
 * @param {string[]} [props.fuentes]        Lista agregada de fuentes consultadas.
 * @param {boolean}  [props.ragUsado]       Flag `rag_usado` del payload.
 * @param {number}   [props.similitudPromedio] 0..1, promedio de similitud semántica.
 * @param {string}   [props.idPrefix]       Prefijo único para `id` ARIA cuando se
 *                                          renderizan varios paneles en la misma página.
 */
import { useId, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, ExternalLink, FileText, ShieldAlert } from 'lucide-react';

const SIMILITUD_COLOR = [
  { min: 0.8, cls: 'text-emerald-400' },
  { min: 0.6, cls: 'text-amber-400'   },
  { min: 0,   cls: 'text-orange-400'  },
];

function colorPorSimilitud(s) {
  return (SIMILITUD_COLOR.find(c => s >= c.min) || SIMILITUD_COLOR.at(-1)).cls;
}

/**
 * Filtra URLs inseguras. Solo aceptamos http(s) para evitar `javascript:`,
 * `data:` y `vbscript:` que podrían usarse para XSS si la fuente RAG
 * estuviera comprometida. `mailto:` se excluye a propósito: una citación
 * legal debe apuntar a un documento público.
 */
function sanitizarUrl(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
    return null;
  } catch {
    return null;
  }
}

function CitacionItem({ citacion, numero }) {
  const url = sanitizarUrl(citacion?.metadata?.url ?? citacion?.url);
  const similitud = Number.isFinite(citacion?.similitud) ? citacion.similitud : 0;
  const similitudPct = similitud * 100;
  const similitudColor = colorPorSimilitud(similitud);

  return (
    <li className="flex items-start gap-2 text-xs bg-black/30 rounded p-2 border border-cyan-500/10">
      <span
        className="font-mono text-cyan-400 mt-0.5 select-none"
        aria-hidden="true"
      >
        [{numero}]
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-cyan-100 truncate"
            title={citacion?.fuente || 'Fuente sin nombre'}
          >
            {citacion?.fuente || 'Fuente sin nombre'}
          </span>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-cyan-400 hover:text-cyan-300 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 rounded"
              title="Ver fuente oficial"
              aria-label={`Ver fuente oficial (${citacion?.fuente || 'sin nombre'}) en una pestaña nueva`}
            >
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          )}
        </div>
        {citacion?.metadata?.articulo && (
          <div className="text-cyan-500/60 text-[10px] mt-0.5 truncate">
            {citacion.metadata.articulo}
          </div>
        )}
        <div className={`text-[10px] mt-0.5 ${similitudColor}`}>
          Similitud: {similitudPct.toFixed(0)}%
        </div>
      </div>
    </li>
  );
}

export default function CitacionesPanel({
  citaciones,
  fuentes,
  ragUsado,
  similitudPromedio,
  idPrefix = 'cit-panel',
}) {
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();
  const reactId = useId();
  const panelId = `${idPrefix}-${reactId}`;
  const headerId = `${panelId}-header`;

  const similitud = Number.isFinite(similitudPromedio) ? similitudPromedio : null;
  const count = citaciones?.length ?? 0;
  const fuentesList = useMemo(
    () => (Array.isArray(fuentes) ? fuentes.filter(f => typeof f === 'string' && f.trim()) : []),
    [fuentes],
  );

  if (!ragUsado || count === 0) return null;

  const motionProps = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { height: 0, opacity: 0 }, animate: { height: 'auto', opacity: 1 }, exit: { height: 0, opacity: 0 } };

  return (
    <section
      aria-labelledby={headerId}
      className="mt-3 border-t border-cyan-500/20 pt-3"
    >
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        aria-controls={panelId}
        id={headerId}
        className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 rounded"
      >
        <FileText className="w-3 h-3" aria-hidden="true" />
        <span className="font-medium">
          {count} {count === 1 ? 'fuente citada' : 'fuentes citadas'}
        </span>
        {similitud !== null && (
          <span className="text-cyan-500/60">
            · {similitud.toFixed(0)}% similitud
          </span>
        )}
        <ChevronDown
          className={`w-3 h-3 ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            id={panelId}
            role="region"
            aria-labelledby={headerId}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            {...motionProps}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1.5">
              <ul className="space-y-1.5 list-none p-0 m-0">
                {citaciones.map((cit, idx) => (
                  <CitacionItem
                    key={cit?.id ?? cit?.numero ?? `${reactId}-cit-${idx}`}
                    citacion={cit}
                    numero={cit?.numero ?? idx + 1}
                  />
                ))}
              </ul>

              {fuentesList.length > 0 && (
                <p className="text-[10px] text-cyan-500/40 mt-2 italic">
                  Fuentes: {fuentesList.join(', ')}
                </p>
              )}

              <p className="flex items-start gap-1.5 text-[10px] text-amber-300/80 mt-2 leading-relaxed">
                <ShieldAlert className="w-3 h-3 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>
                  Verifica cada cita en la fuente oficial antes de usarla.
                  Esta respuesta es un borrador y no constituye asesoría legal.
                </span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
