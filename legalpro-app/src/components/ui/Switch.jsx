/**
 * Switch — Toggle on/off con spring animation.
 */
import { motion } from 'framer-motion';

export default function Switch({
  checked = false,
  onChange,
  disabled = false,
  label,
  description,
  size = 'md',
  colorOn = 'blue',
  className = '',
}) {
  const configs = {
    sm: { track: 'w-8 h-4',   thumb: 'w-3 h-3',   translateOn: 16 },
    md: { track: 'w-11 h-6',  thumb: 'w-5 h-5',   translateOn: 20 },
    lg: { track: 'w-14 h-7',  thumb: 'w-6 h-6',   translateOn: 28 },
  };
  const colors = {
    blue:   'bg-blue-600',
    green:  'bg-emerald-500',
    gold:   'bg-amber-500',
    violet: 'bg-violet-600',
  };

  const c = configs[size] ?? configs.md;
  const onColor = colors[colorOn] ?? colors.blue;

  return (
    <label className={`flex items-center gap-3 cursor-pointer group ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      {/* Track */}
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange?.(!checked)}
        className={`
          relative inline-flex flex-shrink-0 items-center rounded-full p-0.5
          ${c.track}
          ${checked ? onColor : 'bg-slate-600 group-hover:bg-slate-500'}
          transition-colors duration-200 focus:outline-none focus-visible:ring-2
          focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
        `}
      >
        <motion.span
          className={`${c.thumb} bg-white rounded-full shadow-md flex-shrink-0`}
          animate={{ x: checked ? c.translateOn - 4 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>

      {/* Label */}
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-sm font-medium text-slate-200">{label}</span>}
          {description && <span className="text-xs text-slate-400">{description}</span>}
        </div>
      )}
    </label>
  );
}
