/**
 * ExpedienteCard — Tarjeta de expediente para listas y grids.
 * Features: glassmorphism, hover expand, acciones rápidas, badge de estado.
 * Sintaxis moderna: motion/react layout animations
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, Calendar, User, MoreVertical,
  Eye, Pencil, Sparkles, Archive, Trash2,
  Clock, AlertTriangle,
} from 'lucide-react';
import Badge from '../ui/Badge';
import Avatar from '../ui/Avatar';

/* ── Helpers ────────────────────────────────────────────── */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 60)  return `hace ${mins}m`;
  if (hours < 24)  return `hace ${hours}h`;
  if (days  < 30)  return `hace ${days}d`;
  return new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

const MATERIA_COLORS = {
  Penal:          'bg-red-500/15 text-red-400 border-red-500/30',
  Civil:          'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Laboral:        'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Constitucional: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  Familia:        'bg-pink-500/15 text-pink-400 border-pink-500/30',
  Administrativo: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
};

/**
 * @param {object} props
 * @param {object}   props.expediente   — { id, numero, materia, estado, actor, demandado, juzgado, ultimaActividad, proxFecha, urgente }
 * @param {boolean}  [props.selected]
 * @param {function} [props.onClick]
 * @param {function} [props.onView]
 * @param {function} [props.onEdit]
 * @param {function} [props.onAI]
 * @param {function} [props.onArchive]
 * @param {function} [props.onDelete]
 * @param {string}   [props.className]
 */
export default function ExpedienteCard({
  expediente = {},
  selected = false,
  onClick,
  onView,
  onEdit,
  onAI,
  onArchive,
  onDelete,
  className = '',
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  const {
    numero = '---',
    materia = 'Civil',
    estado = 'activo',
    actor = 'Sin actor',
    demandado = 'Sin demandado',
    juzgado = '',
    ultimaActividad,
    proxFecha,
    urgente = false,
  } = expediente;

  const materiaClass = MATERIA_COLORS[materia] ?? MATERIA_COLORS.Civil;

  return (
    <motion.article
      layout
      onClick={() => onClick?.(expediente)}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ scale: 1.008 }}
      whileTap={{ scale: 0.995 }}
      transition={{ duration: 0.18 }}
      className={`
        relative backdrop-blur-xl bg-white/5 border rounded-2xl p-4 cursor-pointer
        transition-all duration-200 group
        ${selected
          ? 'border-blue-500/60 bg-blue-500/8 shadow-lg shadow-blue-500/10'
          : 'border-white/10 hover:border-white/20 hover:bg-white/7'}
        ${urgente ? 'border-l-4 border-l-red-500/80' : ''}
        ${className}
      `}
      aria-selected={selected}
      role="option"
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-lg flex-shrink-0 ${selected ? 'bg-blue-500/20' : 'bg-white/8'}`}>
            <FolderOpen className={`w-4 h-4 ${selected ? 'text-blue-400' : 'text-slate-400'}`} />
          </div>
          <span className="text-xs font-mono font-bold text-slate-200 truncate">
            {numero}
          </span>
          {urgente && (
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            </motion.span>
          )}
        </div>

        {/* Badges + menu */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${materiaClass}`}>
            {materia}
          </span>
          <Badge variant={estado} className="text-[10px]" />

          {/* Menú contextual */}
          <div className="relative">
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
              aria-label="Acciones del expediente"
              aria-expanded={menuOpen}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/10
                opacity-0 group-hover:opacity-100 transition-all duration-150"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -4 }}
                  transition={{ duration: 0.15 }}
                  onMouseLeave={() => setMenuOpen(false)}
                  className="absolute right-0 top-full mt-1 z-30 w-44
                    backdrop-blur-2xl bg-slate-900/98 border border-white/12
                    rounded-xl shadow-xl shadow-black/40 overflow-hidden"
                >
                  {[
                    { icon: Eye,     label: 'Ver detalle',   fn: onView,    color: '' },
                    { icon: Pencil,  label: 'Editar',        fn: onEdit,    color: '' },
                    { icon: Sparkles,label: 'Analizar con IA', fn: onAI,   color: 'text-violet-400' },
                    { icon: Archive, label: 'Archivar',      fn: onArchive, color: 'text-amber-400' },
                    { icon: Trash2,  label: 'Eliminar',      fn: onDelete,  color: 'text-red-400' },
                  ].map(({ icon: Icon, label, fn, color }) => (
                    <button
                      key={label}
                      onClick={e => { e.stopPropagation(); setMenuOpen(false); fn?.(expediente); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm
                        hover:bg-white/5 transition-colors text-left
                        ${color || 'text-slate-300'}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Partes ── */}
      <div className="space-y-1 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
          <User className="w-3 h-3 flex-shrink-0 text-blue-400" />
          <span className="truncate font-medium text-slate-300">{actor}</span>
          <span className="text-slate-600">vs.</span>
          <span className="truncate text-slate-400">{demandado}</span>
        </div>
        {juzgado && (
          <p className="text-[11px] text-slate-600 truncate pl-4">{juzgado}</p>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {timeAgo(ultimaActividad)}
        </div>
        {proxFecha && (
          <motion.div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-medium
              ${urgente ? 'bg-red-500/15 text-red-400 border border-red-500/30' : 'bg-white/5 text-slate-400'}`}
            animate={urgente ? { opacity: [1, 0.7, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Calendar className="w-3 h-3" />
            {new Date(proxFecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
          </motion.div>
        )}
      </div>

      {/* ── Hover actions strip ── */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-white/8 flex items-center gap-2">
              {[
                { icon: Eye,      label: 'Ver',    fn: onView,       cls: 'text-slate-300 hover:text-white hover:bg-white/10' },
                { icon: Pencil,   label: 'Editar', fn: onEdit,       cls: 'text-slate-300 hover:text-white hover:bg-white/10' },
                { icon: Sparkles, label: 'IA',     fn: onAI,         cls: 'text-violet-400 hover:text-violet-200 hover:bg-violet-500/15' },
              ].map(({ icon: Icon, label, fn, cls }) => (
                <button
                  key={label}
                  onClick={e => { e.stopPropagation(); fn?.(expediente); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs
                    font-medium transition-all duration-150 ${cls}`}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
