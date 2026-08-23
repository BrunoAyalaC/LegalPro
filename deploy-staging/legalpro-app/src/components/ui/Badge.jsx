import { Sparkles } from 'lucide-react';

const presets = {
  activo:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  pendiente: 'bg-amber-500/15  text-amber-400   border-amber-500/30',
  urgente:   'bg-red-500/15    text-red-400     border-red-500/30',
  archivado: 'bg-slate-500/15  text-slate-400   border-slate-500/30',
  nuevo:     'bg-blue-500/15   text-blue-400    border-blue-500/30',
  ia:        'bg-violet-500/15 text-violet-400  border-violet-500/30',
  civil:     'bg-indigo-500/15 text-indigo-400  border-indigo-500/30',
  penal:     'bg-red-500/15    text-red-400     border-red-500/30',
  laboral:   'bg-amber-500/15  text-amber-400   border-amber-500/30',
  familia:   'bg-pink-500/15   text-pink-400    border-pink-500/30',
  info:      'bg-cyan-500/15   text-cyan-400    border-cyan-500/30',
  premium:   'bg-linear-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-400/40',
};

export default function Badge({ variant = 'info', pulse = false, dot = false, children, className = '' }) {
  const styles = presets[variant] ?? presets.info;
  const isUrgente = variant === 'urgente';
  const isIA = variant === 'ia';

  return (
    <span className={`
      inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border
      ${styles}
      ${pulse || isUrgente ? 'animate-pulse' : ''}
      ${className}
    `}>
      {isIA && <Sparkles size={10} />}
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}
