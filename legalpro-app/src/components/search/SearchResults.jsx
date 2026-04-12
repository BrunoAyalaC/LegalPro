/**
 * SearchResults — Dropdown de resultados de búsqueda con categorías,
 * highlight de texto y keyboard navigation.
 * Sintaxis moderna: motion/react
 */
import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, FileText, BookOpen, Zap, Settings2,
  ArrowRight, Clock,
} from 'lucide-react';

/* ── Configuración de categorías ─────────────────────────── */
const CATEGORY_META = {
  expedientes:    { icon: FolderOpen, label: 'Expedientes',    color: 'text-blue-400' },
  escritos:       { icon: FileText,   label: 'Escritos',       color: 'text-violet-400' },
  jurisprudencia: { icon: BookOpen,   label: 'Jurisprudencia', color: 'text-amber-400' },
  acciones:       { icon: Zap,        label: 'Acciones',       color: 'text-emerald-400' },
  configuracion:  { icon: Settings2,  label: 'Configuración',  color: 'text-slate-400' },
  recientes:      { icon: Clock,      label: 'Recientes',      color: 'text-slate-400' },
};

/** Resalta las ocurrencias de `query` dentro de `text` */
function Highlight({ text = '', query = '' }) {
  if (!query.trim()) return <span>{text}</span>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part)
          ? <mark key={i} className="bg-blue-500/30 text-blue-200 rounded px-0.5">{part}</mark>
          : part
      )}
    </span>
  );
}

/**
 * @param {object} props
 * @param {boolean}  props.open
 * @param {string}   props.query
 * @param {object[]} props.results   — [{ id, category, title, subtitle, action }]
 * @param {number}   props.activeIdx
 * @param {function} props.onSelect
 * @param {boolean}  [props.isLoading]
 */
export default function SearchResults({
  open = false,
  query = '',
  results = [],
  activeIdx = -1,
  onSelect,
  isLoading = false,
}) {
  /* Agrupar resultados por categoría */
  const grouped = results.reduce((acc, item) => {
    const cat = item.category ?? 'acciones';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const handleSelect = useCallback((item) => {
    onSelect?.(item);
  }, [onSelect]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="search-results"
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0,  scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
          role="listbox"
          aria-label="Resultados de búsqueda"
          className="absolute top-full left-0 right-0 mt-2 z-50
            backdrop-blur-2xl bg-slate-900/98 border border-white/12
            rounded-2xl shadow-2xl shadow-black/50 overflow-hidden
            max-h-[420px] overflow-y-auto"
        >
          {/* Estado loading */}
          {isLoading && (
            <div className="flex items-center gap-3 px-4 py-5 text-slate-400 text-sm">
              <span className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 bg-blue-400 rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                    transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }}
                  />
                ))}
              </span>
              Buscando...
            </div>
          )}

          {/* Sin resultados */}
          {!isLoading && results.length === 0 && query.trim() && (
            <div className="px-4 py-8 text-center">
              <p className="text-slate-400 text-sm">Sin resultados para</p>
              <p className="text-slate-200 font-semibold mt-1">"{query}"</p>
              <p className="text-slate-500 text-xs mt-2">Intenta con otros términos</p>
            </div>
          )}

          {/* Resultados agrupados */}
          {!isLoading && Object.entries(grouped).map(([cat, items]) => {
            const meta = CATEGORY_META[cat] ?? CATEGORY_META.acciones;
            const CatIcon = meta.icon;

            return (
              <div key={cat}>
                {/* Cabecera de categoría */}
                <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
                  <CatIcon className={`w-3.5 h-3.5 ${meta.color}`} />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    {meta.label}
                  </span>
                </div>

                {/* Items */}
                {items.map((item, itemIdx) => {
                  const globalIdx = results.indexOf(item);
                  const isActive = globalIdx === activeIdx;
                  return (
                    <motion.button
                      key={item.id ?? itemIdx}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelect(item)}
                      whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left
                        transition-colors cursor-pointer
                        ${isActive ? 'bg-blue-500/10 border-l-2 border-blue-500' : 'border-l-2 border-transparent'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate font-medium">
                          <Highlight text={item.title} query={query} />
                        </p>
                        {item.subtitle && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            <Highlight text={item.subtitle} query={query} />
                          </p>
                        )}
                      </div>
                      {item.badge && (
                        <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium
                          bg-white/8 text-slate-400 border border-white/10">
                          {item.badge}
                        </span>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                    </motion.button>
                  );
                })}
              </div>
            );
          })}

          {/* Footer - shortcut hint */}
          {results.length > 0 && (
            <div className="px-4 py-2.5 border-t border-white/5 flex items-center gap-3 text-xs text-slate-600">
              <span><kbd className="font-mono bg-white/8 px-1.5 py-0.5 rounded border border-white/10">↑↓</kbd> navegar</span>
              <span><kbd className="font-mono bg-white/8 px-1.5 py-0.5 rounded border border-white/10">↵</kbd> abrir</span>
              <span><kbd className="font-mono bg-white/8 px-1.5 py-0.5 rounded border border-white/10">Esc</kbd> cerrar</span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
