/** Tag — Etiqueta removible para filtros y categorías. */
import { X } from 'lucide-react';

const variants = {
  default: 'bg-white/8 text-slate-300 border-white/12 hover:border-white/20',
  blue:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  gold:    'bg-amber-500/15 text-amber-400 border-amber-500/30',
  green:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  red:     'bg-red-500/15 text-red-400 border-red-500/30',
  violet:  'bg-violet-500/15 text-violet-400 border-violet-500/30',
};

export default function Tag({ children, variant = 'default', onRemove, onClick, className = '' }) {
  return (
    <span
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick(e) : undefined}
      className={`
        inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border
        transition-all duration-150 select-none
        ${variants[variant] ?? variants.default}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label="Eliminar"
          className="ml-0.5 -mr-0.5 rounded p-0.5 hover:bg-white/10 transition-colors"
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}
