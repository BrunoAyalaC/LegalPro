/**
 * FilterPanel — Panel lateral de filtros avanzados (Drawer 360px).
 * Secciones colapsables: Fecha | Estado | Materia | Juzgado | Monto
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, ChevronDown, SlidersHorizontal, RotateCcw } from 'lucide-react';
import Checkbox from '../ui/Checkbox';
import DateRangePicker from './DateRangePicker';
import Button from '../ui/Button';

/* ── Datos de opciones ── */
const ESTADOS = [
  { value: 'activo',    label: 'Activo',    count: 45, color: 'text-emerald-400' },
  { value: 'pendiente', label: 'Pendiente', count: 12, color: 'text-amber-400' },
  { value: 'urgente',   label: 'Urgente',   count: 3,  color: 'text-red-400' },
  { value: 'archivado', label: 'Archivado', count: 8,  color: 'text-slate-400' },
];

const MATERIAS = [
  'Penal', 'Civil', 'Laboral', 'Constitucional', 'Familia', 'Administrativo',
];

const INSTANCIAS = [
  'Juzgado de Paz Letrado', 'Juzgado Especializado', 'Sala Superior',
  'Sala Suprema', 'Tribunal Constitucional',
];

/* ── Acordeón de sección ── */
function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/8">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3
          text-sm font-semibold text-slate-300 hover:text-white transition-colors"
      >
        {title}
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''} text-slate-500`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="section"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Componente principal ── */
export default function FilterPanel({
  open = false,
  onClose,
  filters = {},
  onChange,
  resultCount,
}) {
  const [local, setLocal] = useState(filters);

  const update = (key, value) => setLocal(f => ({ ...f, [key]: value }));

  const toggleSet = (key, value) => {
    setLocal(f => {
      const set = new Set(f[key] ?? []);
      set.has(value) ? set.delete(value) : set.add(value);
      return { ...f, [key]: [...set] };
    });
  };

  const apply = () => { onChange?.(local); onClose?.(); };
  const reset = () => { const empty = {}; setLocal(empty); onChange?.(empty); };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="fp-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-[100]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="fp-panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed right-0 top-0 bottom-0 w-[360px] z-[101]
              flex flex-col bg-slate-900/98 backdrop-blur-2xl border-l border-white/10
              shadow-2xl shadow-black/60"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal size={16} className="text-blue-400" />
                <h2 className="text-base font-bold text-white">Filtros avanzados</h2>
                {resultCount !== undefined && (
                  <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30
                    px-2 py-0.5 rounded-full font-semibold">{resultCount}</span>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar filtros"
                className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/8 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Secciones scrolleables */}
            <div className="flex-1 overflow-y-auto">
              {/* Fecha */}
              <Section title="📅 Fecha" defaultOpen>
                <DateRangePicker
                  value={local.fecha ?? { from: '', to: '' }}
                  onChange={v => update('fecha', v)}
                  label=""
                />
              </Section>

              {/* Estado */}
              <Section title="🔄 Estado" defaultOpen>
                {ESTADOS.map(e => (
                  <div key={e.value} className="flex items-center justify-between">
                    <Checkbox
                      checked={(local.estados ?? []).includes(e.value)}
                      onChange={() => toggleSet('estados', e.value)}
                      label={e.label}
                    />
                    <span className={`text-xs font-semibold ${e.color}`}>{e.count}</span>
                  </div>
                ))}
              </Section>

              {/* Materia */}
              <Section title="⚖️ Materia">
                <div className="flex flex-wrap gap-1.5">
                  {MATERIAS.map(m => {
                    const active = (local.materias ?? []).includes(m);
                    return (
                      <button
                        key={m}
                        onClick={() => toggleSet('materias', m)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150
                          ${active
                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                            : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/25 hover:text-slate-200'}`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </Section>

              {/* Instancia */}
              <Section title="🏛️ Instancia / Juzgado">
                <div className="space-y-1.5">
                  {INSTANCIAS.map(inst => (
                    <Checkbox
                      key={inst}
                      checked={(local.instancias ?? []).includes(inst)}
                      onChange={() => toggleSet('instancias', inst)}
                      label={inst}
                    />
                  ))}
                </div>
              </Section>

              {/* Monto */}
              <Section title="💰 Monto pretensionado">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {['montoMin', 'montoMax'].map((key, i) => (
                      <label key={key} className="flex flex-col gap-1">
                        <span className="text-xs text-slate-500">{i === 0 ? 'Mínimo' : 'Máximo'}</span>
                        <input
                          type="number"
                          min="0"
                          value={local[key] ?? ''}
                          onChange={e => update(key, e.target.value)}
                          placeholder="S/ 0"
                          className="h-9 bg-white/5 border border-white/15 rounded-xl px-3 text-sm text-slate-200
                            placeholder:text-slate-500 focus:outline-none focus:ring-2
                            focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </Section>
            </div>

            {/* Footer */}
            <div className="px-4 py-4 border-t border-white/10 flex gap-3">
              <button
                onClick={reset}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-400
                  hover:text-slate-200 hover:bg-white/8 border border-white/10 transition-all"
              >
                <RotateCcw size={14} />
                Limpiar
              </button>
              <Button variant="primary" size="md" className="flex-1" onClick={apply}>
                Aplicar filtros
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
