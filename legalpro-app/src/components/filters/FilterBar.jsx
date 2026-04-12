import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter, X, ChevronDown, SlidersHorizontal, Search,
  ArrowUpDown, Check
} from 'lucide-react';

/* ─── Tipos de filtro disponibles ─── */
const SORT_OPTIONS = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'oldest', label: 'Más antiguos' },
  { value: 'alpha', label: 'A → Z' },
  { value: 'urgent', label: 'Urgentes primero' },
];

/**
 * FilterBar — Barra de filtros horizontal sticky.
 *
 * Props:
 *  filters       → array de { id, label, value } chips activos
 *  onRemoveFilter → fn(id)
 *  onClearAll    → fn()
 *  onOpenPanel   → fn() — abre el drawer de filtros avanzados
 *  resultCount   → number | null
 *  sort          → string (valor actual de sort)
 *  onSortChange  → fn(value)
 *  searchQuery   → string
 *  onSearchChange → fn(string)
 *  placeholder   → string
 *  className     → string extra
 */
export default function FilterBar({
  filters = [],
  onRemoveFilter,
  onClearAll,
  onOpenPanel,
  resultCount = null,
  sort = 'recent',
  onSortChange,
  searchQuery = '',
  onSearchChange,
  placeholder = 'Buscar...',
  className = '',
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef(null);

  /* Cerrar dropdown al click fuera */
  useEffect(() => {
    function handler(e) {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setSortOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentSort = SORT_OPTIONS.find(o => o.value === sort) || SORT_OPTIONS[0];

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* ── Fila 1: Buscador + Acciones ── */}
      <div className="flex items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange?.(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10
              text-slate-200 placeholder-slate-500 text-sm focus:outline-none
              focus:border-blue-500/40 focus:bg-white/7 transition-all duration-200"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange?.('')}
              aria-label="Limpiar filtros"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setSortOpen(v => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10
              text-slate-400 hover:text-slate-200 hover:bg-white/8 text-sm font-medium
              transition-all duration-200 whitespace-nowrap"
          >
            <ArrowUpDown size={14} />
            <span className="hidden sm:inline">{currentSort.label}</span>
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 ${sortOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {sortOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute right-0 top-full mt-1 w-48 z-30 rounded-xl
                  bg-[#1e293b] border border-white/10 shadow-2xl shadow-black/40 overflow-hidden"
              >
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { onSortChange?.(opt.value); setSortOpen(false); }}
                    className={`flex items-center gap-2 w-full px-4 py-2.5 text-sm text-left
                      transition-colors duration-150
                      ${opt.value === sort
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-slate-300 hover:bg-white/5'
                      }`}
                  >
                    {opt.value === sort && <Check size={13} className="text-blue-400" />}
                    <span className={opt.value === sort ? 'ml-0' : 'ml-[21px]'}>{opt.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Botón filtros avanzados */}
        <button
          onClick={onOpenPanel}
          className={`relative flex items-center gap-2 px-3 py-2 rounded-xl border text-sm
            font-medium transition-all duration-200 whitespace-nowrap
            ${filters.length > 0
              ? 'bg-blue-500/15 border-blue-500/30 text-blue-400 hover:bg-blue-500/25'
              : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/8'
            }`}
        >
          <SlidersHorizontal size={14} />
          <span className="hidden sm:inline">Filtrar</span>
          {filters.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center
              rounded-full bg-blue-500 text-[10px] font-bold text-white">
              {filters.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Fila 2: Chips activos + count ── */}
      <AnimatePresence>
        {(filters.length > 0 || resultCount !== null) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="filter-bar">
              {/* Result count */}
              {resultCount !== null && (
                <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap flex-shrink-0">
                  {resultCount} resultado{resultCount !== 1 ? 's' : ''}
                </span>
              )}

              {/* Active filter chips */}
              <AnimatePresence mode="popLayout">
                {filters.map(f => (
                  <motion.span
                    key={f.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    className="filter-chip"
                  >
                    <Filter size={10} className="opacity-60" />
                    {f.label}
                    {f.value && (
                      <span className="opacity-60">: {f.value}</span>
                    )}
                    <button
                      onClick={() => onRemoveFilter?.(f.id)}
                      className="filter-chip-remove ml-0.5 hover:text-white"
                    >
                      <X size={11} />
                    </button>
                  </motion.span>
                ))}
              </AnimatePresence>

              {/* Limpiar todo */}
              {filters.length > 1 && (
                <motion.button
                  layout
                  onClick={onClearAll}
                  className="text-[11px] font-semibold text-slate-500 hover:text-red-400
                    transition-colors whitespace-nowrap flex-shrink-0 ml-1"
                >
                  Limpiar todo
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
