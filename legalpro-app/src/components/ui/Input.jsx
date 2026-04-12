import { forwardRef } from 'react';
import { X } from 'lucide-react';

const Input = forwardRef(function Input({
  label,
  error,
  hint,
  icon: Icon,
  trailing,
  onClear,
  value,
  className = '',
  containerClass = '',
  textarea = false,
  rows = 3,
  ...props
}, ref) {
  const Tag = textarea ? 'textarea' : 'input';

  return (
    <div className={`flex flex-col gap-1.5 ${containerClass}`}>
      {label && (
        <label className="text-sm font-medium text-slate-300">{label}</label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <span className="absolute left-3 text-slate-500 pointer-events-none flex items-center">
            <Icon size={16} />
          </span>
        )}
        <Tag
          ref={ref}
          value={value}
          rows={textarea ? rows : undefined}
          className={`
            w-full bg-white/5 border rounded-xl text-sm text-slate-200
            placeholder:text-slate-500 outline-none
            focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
            transition-all duration-200
            disabled:opacity-40 disabled:cursor-not-allowed
            ${error ? 'border-red-500/50 ring-1 ring-red-500/30' : 'border-white/12 hover:border-white/20'}
            ${Icon ? 'pl-10' : 'px-4'}
            ${(onClear && value) || trailing ? 'pr-10' : 'px-4'}
            ${textarea ? 'py-3 min-h-[80px] resize-y' : 'h-10'}
            ${className}
          `}
          {...props}
        />
        {onClear && value ? (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X size={14} />
          </button>
        ) : trailing ? (
          <span className="absolute right-3 text-slate-500 flex items-center">
            {trailing}
          </span>
        ) : null}
      </div>
      {error && <p className="text-xs text-red-400 flex items-center gap-1">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
});

export default Input;
