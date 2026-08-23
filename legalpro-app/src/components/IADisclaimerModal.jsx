import { useState, useEffect, useRef } from 'react';
import AppIcon from './AppIcon';
import { getProviderLabel } from '../lib/iaProviders.js';

const VARIANT_MODAL = {
  general: {
    color: '#F59E0B',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    title: 'Aviso Importante',
    texto: 'Este contenido es generado por un sistema de Inteligencia Artificial y NO constituye asesoría legal. Para tomar decisiones legales, consulte con un abogado colegiado.',
    btn: 'bg-amber-500 hover:bg-amber-400 text-black',
  },
  predictor: {
    color: '#DC2626',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    title: 'Limitaciones del Predictor — Confirmación Obligatoria',
    texto: 'La predicción judicial es un análisis PROBABILÍSTICO basado en sentencias previas y NO garantiza el resultado del caso. Cada caso tiene particularidades propias. Esta herramienta NO debe usarse como única base para tomar decisiones procesales o financieras. Requiere validación profesional.',
    btn: 'bg-red-600 hover:bg-red-500 text-white',
  },
  redactor: {
    color: '#DC2626',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    title: 'Verificación Obligatoria Previa Presentación',
    texto: 'Todo escrito generado por IA debe ser REVISADO y VALIDADO por un abogado colegiado antes de su presentación ante cualquier autoridad. Verifique: (1) citas legales exactas, (2) coherencia con la estrategia procesal, (3) cumplimiento de plazos y formalidades.',
    btn: 'bg-red-600 hover:bg-red-500 text-white',
  },
  simulador: {
    color: '#7C3AED',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    title: 'Simulador con Fines de Entrenamiento',
    texto: 'Este simulador es una herramienta de ENTRENAMIENTO. La IA interpreta un rol opuesto (Juez, Fiscal, Testigo, etc.) con fines pedagógicos. NO constituye un ejercicio real de audiencia ni reemplaza la práctica supervisada.',
    btn: 'bg-violet-600 hover:bg-violet-500 text-white',
  },
};

/**
 * Modal bloqueante de disclaimer IA — LPDP Art.21
 * Bloquea acción hasta checkbox de responsabilidad. NO dismissible por overlay.
 * @param variant "general" | "predictor" | "redactor" | "simulador"
 * @param provider "opencode" | "minimax" | "self_hosted"
 * @param persistent - si true, requiere checkbox obligatorio
 */
export default function IADisclaimerModal({
  isOpen,
  onConfirm,
  onCancel,
  actionLabel = 'Continuar',
  variant = 'general',
  provider = 'opencode',
  persistent = true,
  posicion = 'modal + footer',
}) {
  const [checked, setChecked] = useState(false);
  const closeBtnRef = useRef(null);
  const confirmBtnRef = useRef(null);

  const cfg = VARIANT_MODAL[variant] ?? VARIANT_MODAL.general;
  const providerLabel = getProviderLabel(provider);

  useEffect(() => {
    if (isOpen) {
      setChecked(false);
      // Focus trap: enfocar botón cancelar
      setTimeout(() => closeBtnRef.current?.focus(), 100);
      // Bloquear scroll
      document.body.style.overflow = 'hidden';
      const onKey = (e) => {
        if (e.key === 'Escape' && !persistent) onCancel?.();
        if (e.key === 'Tab') {
          // simple focus trap entre dos botones
          const focusable = [closeBtnRef.current, confirmBtnRef.current].filter(Boolean);
          if (!focusable.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };
      window.addEventListener('keydown', onKey);
      return () => {
        window.removeEventListener('keydown', onKey);
        document.body.style.overflow = '';
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, persistent, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ia-disclaimer-title"
      data-variant={variant}
      data-color={cfg.color}
      data-posicion={posicion}
      onClick={(e) => {
        // No cerrar al click en overlay si es persistent
        if (e.target === e.currentTarget && !persistent) onCancel?.();
      }}
    >
      <div
        className="bg-[#0F172A] border rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200"
        style={{ borderColor: cfg.color }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${cfg.color}20` }}>
            <AppIcon name="warning" size={24} style={{ color: cfg.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="ia-disclaimer-title" className="text-base font-bold text-white leading-tight" style={{ color: cfg.color }}>
              {cfg.title}
            </h3>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">Posición canónica: {posicion} · Proveedor: {providerLabel}</p>
          </div>
        </div>

        <div className={`rounded-lg p-3.5 text-xs leading-relaxed border ${cfg.bg} ${cfg.border}`} style={{ borderLeftColor: cfg.color, borderLeftWidth: '3px' }}>
          <p className="font-semibold mb-1.5" style={{ color: cfg.color }}>
            ⚠️ {cfg.title}
          </p>
          <p className="text-slate-200/90">{cfg.texto}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border" style={{ borderColor: cfg.color, color: cfg.color, backgroundColor: `${cfg.color}15` }}>
              <AppIcon name="smart_toy" size={12} aria-hidden="true" />
              {providerLabel}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-white/5 text-slate-300 border border-white/10">
              LPDP Art. 21 · Transferencia internacional
            </span>
            {persistent && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                Obligatorio
              </span>
            )}
          </div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-white/5 transition-colors">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-white focus:ring-2 focus:ring-offset-0 cursor-pointer"
            style={{ accentColor: cfg.color }}
            aria-label="Confirmo responsabilidad profesional"
            data-testid="ia-modal-checkbox"
          />
          <span className="text-xs text-slate-300 leading-relaxed group-hover:text-slate-200 transition-colors">
            Confirmo que he leído este aviso, comprendo que el contenido es un <strong>borrador generado por IA</strong> y <strong>asumo la responsabilidad profesional</strong> de revisar y validar su contenido antes de usarlo.
          </span>
        </label>

        {/* Footer doble: al pie del modal + recordatorio que el banner permanece */}
        <div className="rounded-lg bg-white/5 border border-white/10 p-2.5 flex items-start gap-2">
          <AppIcon name="info" size={14} className="text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Este aviso permanecerá visible como <strong>footer sticky</strong> en la herramienta (<code className="text-[10px] bg-white/10 px-1 py-0.5 rounded">{posicion}</code>) y no es omitible para variantes <code className="text-red-300">predictor</code>/<code className="text-red-300">redactor</code>/<code className="text-violet-300">simulador</code>.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            ref={closeBtnRef}
            onClick={() => {
              setChecked(false);
              onCancel?.();
            }}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs border border-white/10 transition-colors"
            data-testid="ia-modal-cancel"
          >
            Cancelar
          </button>
          <button
            ref={confirmBtnRef}
            onClick={() => {
              if (persistent && !checked) return;
              setChecked(false);
              onConfirm?.();
            }}
            disabled={persistent && !checked}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${cfg.btn}`}
            data-testid="ia-modal-confirm"
            style={{ backgroundColor: persistent && !checked ? undefined : cfg.color }}
          >
            <AppIcon name="check_circle" size={16} />
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export { VARIANT_MODAL };
