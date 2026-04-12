/**
 * TimelineEvent — Evento en la línea de tiempo de un expediente.
 * Soporta expand/collapse con layout animation de framer-motion.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FilePlus, FileText, CalendarCheck, Gavel,
  Bell, Paperclip, ChevronDown, ExternalLink,
} from 'lucide-react';

/* ── Metadatos por tipo de evento ───────────────────────── */
const EVENT_TYPES = {
  creacion:      { icon: FilePlus,      color: 'text-blue-400',    bg: 'bg-blue-500/15',    border: 'border-blue-500/40',    label: 'Creación'       },
  escrito:       { icon: FileText,      color: 'text-violet-400',  bg: 'bg-violet-500/15',  border: 'border-violet-500/40',  label: 'Escrito'        },
  audiencia:     { icon: CalendarCheck, color: 'text-amber-400',   bg: 'bg-amber-500/15',   border: 'border-amber-500/40',   label: 'Audiencia'      },
  resolucion:    { icon: Gavel,         color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', label: 'Resolución'     },
  notificacion:  { icon: Bell,          color: 'text-red-400',     bg: 'bg-red-500/15',     border: 'border-red-500/40',     label: 'Notificación'   },
  documento:     { icon: Paperclip,     color: 'text-cyan-400',    bg: 'bg-cyan-500/15',    border: 'border-cyan-500/40',    label: 'Documento'      },
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * @param {object} props
 * @param {object}   props.event   — { id, tipo, titulo, descripcion, fecha, autor, adjuntos[], link }
 * @param {boolean}  [props.isLast]
 * @param {boolean}  [props.defaultExpanded]
 */
export default function TimelineEvent({ event = {}, isLast = false, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const {
    tipo = 'escrito',
    titulo = 'Evento',
    descripcion = '',
    fecha,
    autor = '',
    adjuntos = [],
    link,
  } = event;

  const meta = EVENT_TYPES[tipo] ?? EVENT_TYPES.escrito;
  const EventIcon = meta.icon;

  return (
    <motion.div
      layout
      className="relative flex gap-4"
    >
      {/* ── Línea vertical conectora ── */}
      {!isLast && (
        <div className="absolute left-[19px] top-10 bottom-0 w-px bg-white/8" />
      )}

      {/* ── Dot / Icono ── */}
      <div className="relative flex-shrink-0 z-10">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center
          ${meta.bg} border ${meta.border}`}>
          <EventIcon className={`w-4 h-4 ${meta.color}`} />
        </div>
      </div>

      {/* ── Contenido ── */}
      <motion.div layout className="flex-1 pb-6">
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full text-left group"
          aria-expanded={expanded}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${meta.color}`}>
                  {meta.label}
                </span>
                <h4 className="text-sm font-semibold text-slate-200 leading-tight">
                  {titulo}
                </h4>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {formatDate(fecha)}
                {autor && <span className="ml-2 text-slate-400">· {autor}</span>}
              </p>
            </div>
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 mt-1 text-slate-500 group-hover:text-slate-300 transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </motion.span>
          </div>
        </button>

        {/* Detalle expandible */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="overflow-hidden"
            >
              <div className="mt-3 backdrop-blur-sm bg-white/3 border border-white/8
                rounded-xl p-3 space-y-2">
                {descripcion && (
                  <p className="text-sm text-slate-300 leading-relaxed">{descripcion}</p>
                )}

                {/* Adjuntos */}
                {adjuntos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {adjuntos.map((adj, i) => (
                      <span key={i}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs
                          bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200
                          hover:bg-white/10 transition-colors cursor-pointer">
                        <Paperclip className="w-3 h-3" />
                        {adj}
                      </span>
                    ))}
                  </div>
                )}

                {/* Link externo */}
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-xs text-blue-400
                      hover:text-blue-300 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Ver en sistema
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
