/**
 * FilterChip — Chip de filtro activo con botón de remoción.
 */
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

export default function FilterChip({ label, value, onRemove, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
    gold:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
    green:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    red:    'bg-red-500/15 text-red-400 border-red-500/30',
    violet: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    gray:   'bg-slate-500/15 text-slate-400 border-slate-500/30',
  };

  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.15 }}
      className={`
        inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1
        rounded-full text-xs font-medium border select-none
        ${colors[color] ?? colors.blue}
      `}
    >
      {label && <span className="text-current/60">{label}:</span>}
      <span className="font-semibold">{value}</span>
      <button
        onClick={onRemove}
        aria-label={`Eliminar filtro ${label ?? value}`}
        className="ml-0.5 p-0.5 rounded-full hover:bg-white/15 transition-colors"
      >
        <X size={10} />
      </button>
    </motion.span>
  );
}
