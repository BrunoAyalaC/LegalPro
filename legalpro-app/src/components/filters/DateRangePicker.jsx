/**
 * DateRangePicker — Selector de rango de fechas con presets.
 * Lightweight: sin dependencias externas, usa date-fns si está disponible.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronDown, X } from 'lucide-react';

const PRESETS = [
  { label: 'Hoy',           days: 0 },
  { label: 'Esta semana',   days: 7 },
  { label: 'Este mes',      days: 30 },
  { label: 'Últimos 3 meses', days: 90 },
  { label: 'Este año',      days: 365 },
];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function DateRangePicker({
  value = { from: '', to: '' },
  onChange,
  label = 'Rango de fecha',
  placeholder = 'Seleccionar período',
}) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(value);

  const hasValue = local.from || local.to;

  const applyPreset = (days) => {
    const next = days === 0
      ? { from: today(), to: today() }
      : { from: daysAgo(days), to: today() };
    setLocal(next);
    onChange?.(next);
    setOpen(false);
  };

  const applyCustom = () => {
    onChange?.(local);
    setOpen(false);
  };

  const clear = (e) => {
    e.stopPropagation();
    const empty = { from: '', to: '' };
    setLocal(empty);
    onChange?.(empty);
  };

  const displayText = hasValue
    ? `${formatDate(local.from)}${local.to && local.from !== local.to ? ' → ' + formatDate(local.to) : ''}`
    : placeholder;

  return (
    <div className="relative">
      {label && <p className="text-xs font-semibold uppercase text-slate-500 tracking-widest mb-2">{label}</p>}

      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`
          w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm
          border transition-all duration-150
          ${open ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/15 bg-white/5 hover:border-white/25'}
          ${hasValue ? 'text-slate-200' : 'text-slate-500'}
        `}
      >
        <span className="flex items-center gap-2">
          <Calendar size={14} className={hasValue ? 'text-blue-400' : 'text-slate-500'} />
          <span className="truncate">{displayText}</span>
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {hasValue && (
            <span onClick={clear} className="p-0.5 rounded hover:bg-white/10 text-slate-500 hover:text-slate-300">
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 z-50
              backdrop-blur-2xl bg-slate-900/95 border border-white/15 rounded-2xl
              shadow-2xl shadow-black/50 overflow-hidden"
          >
            {/* Presets */}
            <div className="p-3 border-b border-white/8">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">Períodos rápidos</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p.days)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium border
                      border-white/10 bg-white/5 text-slate-300
                      hover:bg-blue-500/15 hover:text-blue-400 hover:border-blue-500/30
                      transition-all duration-150"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom range */}
            <div className="p-3 space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Rango personalizado</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500">Desde</span>
                  <input
                    type="date"
                    value={local.from}
                    max={local.to || today()}
                    onChange={e => setLocal(l => ({ ...l, from: e.target.value }))}
                    className="h-9 bg-white/5 border border-white/15 rounded-xl px-3 text-sm text-slate-200
                      focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                      transition-all [color-scheme:dark]"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500">Hasta</span>
                  <input
                    type="date"
                    value={local.to}
                    min={local.from}
                    max={today()}
                    onChange={e => setLocal(l => ({ ...l, to: e.target.value }))}
                    className="h-9 bg-white/5 border border-white/15 rounded-xl px-3 text-sm text-slate-200
                      focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                      transition-all [color-scheme:dark]"
                  />
                </label>
              </div>
              <button
                onClick={applyCustom}
                disabled={!local.from && !local.to}
                className="w-full h-9 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold
                  transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Aplicar rango
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
