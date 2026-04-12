import { useEffect, useRef, useState, useCallback, startTransition } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowRight, FolderOpen, FileText, BookOpen, Zap, Settings, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../context/UIContext';

const COMMANDS = [
  {
    group: 'Acciones rápidas',
    icon: Zap,
    items: [
      { label: 'Nuevo Expediente',         desc: 'Crear un expediente nuevo',               path: '/expedientes',    shortcut: 'N' },
      { label: 'Redactar Escrito con IA',  desc: 'Redactor legal inteligente',              path: '/redactor',       shortcut: 'R' },
      { label: 'Simular Juicio',           desc: 'Simulador de audiencias NCPP',            path: '/simulador' },
      { label: 'Predecir Resultado',       desc: 'Predictor judicial IA',                   path: '/predictor' },
    ],
  },
  {
    group: 'Expedientes',
    icon: FolderOpen,
    items: [
      { label: 'Mis Expedientes',          desc: 'Ver todos los expedientes',               path: '/expedientes' },
      { label: 'Analista de Expedientes',  desc: 'Análisis IA de expedientes',              path: '/analista' },
      { label: 'Resumen Ejecutivo',        desc: 'Resumen IA del caso',                     path: '/resumen-ejecutivo' },
    ],
  },
  {
    group: 'Herramientas IA',
    icon: FileText,
    items: [
      { label: 'Alegatos de Clausura',     desc: 'Genera alegatos persuasivos',             path: '/alegatos' },
      { label: 'Interrogatorio NCPP',      desc: 'Estrategia de interrogatorio',            path: '/interrogatorio' },
      { label: 'Objeciones en Vivo',       desc: 'Asistente de objeciones',                path: '/objeciones' },
      { label: 'Casos Críticos',           desc: 'Generador de casos críticos',             path: '/casos-criticos' },
    ],
  },
  {
    group: 'Consulta Legal',
    icon: BookOpen,
    items: [
      { label: 'Buscador de Jurisprudencia', desc: 'Búsqueda semántica en tiempo real',    path: '/buscador' },
      { label: 'Comparador de Precedentes',  desc: 'Compara precedentes vinculantes',      path: '/comparador' },
      { label: 'Monitor SINOE',              desc: 'Notificaciones del PJ',                path: '/monitor-sinoe' },
      { label: 'Bóveda de Evidencia',        desc: 'Gestión de evidencia digital',         path: '/boveda' },
    ],
  },
  {
    group: 'Sistema',
    icon: Settings,
    items: [
      { label: 'Mi Perfil',                desc: 'Configuración de cuenta',                path: '/perfil' },
      { label: 'Especialidad Legal',       desc: 'Configurar áreas de práctica',           path: '/config-especialidad' },
      { label: 'Herramientas',             desc: 'Ver todas las herramientas',             path: '/herramientas' },
    ],
  },
];

function highlight(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-blue-500/30 text-blue-200 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function CommandPalette() {
  const { commandOpen, closeCommand } = useUI();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

  /* Filter */
  const filtered = query.trim()
    ? COMMANDS.flatMap(g =>
        g.items
          .filter(i => i.label.toLowerCase().includes(query.toLowerCase()) || i.desc.toLowerCase().includes(query.toLowerCase()))
          .map(i => ({ ...i, group: g.group, GroupIcon: g.icon }))
      )
    : null;

  const flatItems = filtered ?? COMMANDS.flatMap(g => g.items.map(i => ({ ...i, group: g.group, GroupIcon: g.icon })));

  useEffect(() => { startTransition(() => setActiveIdx(0)); }, [query]);

  /* Focus input on open */
  useEffect(() => {
    if (commandOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      startTransition(() => setQuery(''));
    }
  }, [commandOpen]);

  /* Keyboard navigation */
  const handleKey = useCallback((e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flatItems.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && flatItems[activeIdx]) {
      navigate(flatItems[activeIdx].path);
      closeCommand();
    }
    if (e.key === 'Escape') closeCommand();
  }, [activeIdx, flatItems, navigate, closeCommand]);

  /* Global Cmd+K */
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        commandOpen ? closeCommand() : document.dispatchEvent(new CustomEvent('lp:openCommand'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commandOpen, closeCommand]);

  const goTo = (path) => { navigate(path); closeCommand(); };

  /* Render grouped or filtered */
  const renderItems = () => {
    if (filtered !== null) {
      if (filtered.length === 0) return (
        <div className="py-12 text-center text-slate-500">
          <Search size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin resultados para <span className="text-slate-300">"{query}"</span></p>
        </div>
      );
      return filtered.map((item, idx) => (
        <CommandItem key={item.path + item.label} item={item} active={idx === activeIdx} onSelect={() => goTo(item.path)} icon={item.GroupIcon} query={query} />
      ));
    }
    return COMMANDS.map((group) => (
      <div key={group.group}>
        <div className="flex items-center gap-2 px-4 py-2 mt-2">
          <group.icon size={12} className="text-slate-400" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{group.group}</span>
        </div>
        {group.items.map((item) => {
          const globalIdx = flatItems.findIndex(f => f.path === item.path && f.label === item.label);
          return (
            <CommandItem key={item.path + item.label} item={item} active={globalIdx === activeIdx} onSelect={() => goTo(item.path)} icon={group.icon} query={query} />
          );
        })}
      </div>
    ));
  };

  return createPortal(
    <AnimatePresence>
      {commandOpen && (
        <motion.div
          className="fixed inset-0 z-[9998] flex items-start justify-center pt-[10vh] px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeCommand} />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.25, ease: [0.34, 1.2, 0.64, 1] } }}
            exit={{ opacity: 0, scale: 0.96, y: -8, transition: { duration: 0.18 } }}
            className="relative w-full max-w-2xl bg-slate-900/98 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
            onKeyDown={handleKey}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8">
              <Search size={20} className="text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar función, expediente, herramienta..."
                className="flex-1 bg-transparent text-lg text-white placeholder:text-slate-500 outline-none"
                role="combobox"
                aria-expanded={true}
                aria-autocomplete="list"
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Limpiar búsqueda" className="text-slate-500 hover:text-slate-300 transition-colors">
                  <X size={16} />
                </button>
              )}
              <kbd className="hidden sm:flex px-2 py-0.5 text-[11px] font-mono bg-white/8 border border-white/12 rounded text-slate-400">Esc</kbd>
            </div>

            {/* Results */}
            <div className="overflow-y-auto max-h-[60vh] py-2 scrollbar-thin scrollbar-thumb-white/10">
              {renderItems()}
            </div>

            {/* Footer hint */}
            <div className="flex items-center gap-4 px-5 py-2.5 border-t border-white/8 bg-white/2">
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <kbd className="px-1.5 py-0.5 bg-white/8 border border-white/12 rounded font-mono">↑↓</kbd> navegar
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <kbd className="px-1.5 py-0.5 bg-white/8 border border-white/12 rounded font-mono">↵</kbd> abrir
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <kbd className="px-1.5 py-0.5 bg-white/8 border border-white/12 rounded font-mono">Esc</kbd> cerrar
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function CommandItem({ item, active, onSelect, icon: GroupIcon, query }) {
  return (
    <motion.button
      onClick={onSelect}
      whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
      className={`
        w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
        ${active ? 'bg-blue-500/15 border-l-2 border-blue-500' : 'border-l-2 border-transparent'}
      `}
    >
      <div className={`p-1.5 rounded-lg shrink-0 ${active ? 'bg-blue-500/20' : 'bg-white/6'}`}>
        <GroupIcon size={14} className={active ? 'text-blue-400' : 'text-slate-400'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${active ? 'text-white' : 'text-slate-200'}`}>
          {highlight(item.label, query)}
        </p>
        <p className="text-xs text-slate-500 truncate">{item.desc}</p>
      </div>
      {item.shortcut && (
        <kbd className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono bg-white/8 border border-white/12 rounded text-slate-500">
          {item.shortcut}
        </kbd>
      )}
      {active && <ArrowRight size={14} className="text-blue-400 shrink-0" />}
    </motion.button>
  );
}
