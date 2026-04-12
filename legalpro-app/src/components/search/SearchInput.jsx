/**
 * SearchInput — Input de búsqueda con debounce, icono y clear.
 * Composable: se usa en listas de expedientes, jurisprudencia, etc.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import Spinner from './Spinner';

export default function SearchInput({
  placeholder = 'Buscar...',
  onSearch,
  debounce = 350,
  loading = false,
  defaultValue = '',
  autoFocus = false,
  size = 'md',
  className = '',
}) {
  const [value, setValue] = useState(defaultValue);
  const timerRef = useRef(null);

  const sizes = {
    sm: 'h-8  text-xs px-3 pl-8',
    md: 'h-10 text-sm px-4 pl-9',
    lg: 'h-12 text-base px-4 pl-10',
  };
  const iconSizes = { sm: 14, md: 16, lg: 18 };

  const handleChange = useCallback((e) => {
    const v = e.target.value;
    setValue(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSearch?.(v), debounce);
  }, [onSearch, debounce]);

  const clear = useCallback(() => {
    setValue('');
    clearTimeout(timerRef.current);
    onSearch?.('');
  }, [onSearch]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const iconSize = iconSizes[size] ?? 16;

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Left icon */}
      <span className="absolute left-3 text-slate-500 pointer-events-none">
        {loading
          ? <Spinner size="sm" color="blue" />
          : <Search size={iconSize} />}
      </span>

      <input
        type="search"
        role="searchbox"
        aria-label={placeholder}
        autoFocus={autoFocus}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`
          w-full ${sizes[size] ?? sizes.md}
          bg-white/5 border border-white/12 rounded-xl
          text-slate-200 placeholder:text-slate-500
          focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50
          transition-all duration-200
          ${value ? 'pr-9' : ''}
        `}
      />

      {/* Clear button */}
      {value && (
        <button
          onClick={clear}
          aria-label="Limpiar búsqueda"
          className="absolute right-3 p-0.5 rounded-lg text-slate-500
            hover:text-slate-300 hover:bg-white/10 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
