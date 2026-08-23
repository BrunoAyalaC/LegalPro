/**
 * Checkbox — Checkbox accesible con animación SVG path-draw.
 */
import { motion } from 'framer-motion';

export default function Checkbox({
  checked = false,
  onChange,
  disabled = false,
  label,
  description,
  indeterminate = false,
  className = '',
}) {
  const handleClick = () => !disabled && onChange?.(!checked);

  return (
    <label
      className={`
        flex items-start gap-3 cursor-pointer group
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {/* Box */}
      <button
        role="checkbox"
        aria-checked={indeterminate ? 'mixed' : checked}
        disabled={disabled}
        onClick={handleClick}
        className={`
          w-4.5 h-4.5 mt-0.5 flex-shrink-0 rounded-md border transition-all duration-150
          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
          focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
          ${checked || indeterminate
            ? 'bg-blue-600 border-blue-600'
            : 'bg-white/5 border-white/20 group-hover:border-white/40'}
        `}
        style={{ width: 18, height: 18 }}
      >
        {/* Checkmark SVG */}
        {(checked || indeterminate) && (
          <svg viewBox="0 0 12 12" fill="none" className="w-full h-full p-0.5">
            {indeterminate ? (
              <motion.line
                x1="2" y1="6" x2="10" y2="6"
                stroke="white" strokeWidth="2.5" strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.2 }}
              />
            ) : (
              <motion.polyline
                points="2,6 5,9 10,3"
                stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              />
            )}
          </svg>
        )}
      </button>

      {/* Label */}
      {(label || description) && (
        <div className="flex flex-col min-w-0">
          {label && <span className="text-sm font-medium text-slate-200 leading-tight">{label}</span>}
          {description && <span className="text-xs text-slate-400 mt-0.5 leading-snug">{description}</span>}
        </div>
      )}
    </label>
  );
}
