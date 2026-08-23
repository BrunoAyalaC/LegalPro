import { useState } from 'react';
import AppIcon from './AppIcon';

/**
 * Modal de confirmación de disclaimer antes de permitir descarga o copia de documentos generados por IA.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Controla si el modal está visible
 * @param {Function} props.onConfirm - Callback cuando el usuario confirma
 * @param {Function} props.onCancel - Callback cuando el usuario cancela
 * @param {string} props.actionLabel - Texto del botón de confirmación (ej: "Descargar PDF", "Copiar")
 */
export default function IADisclaimerModal({ isOpen, onConfirm, onCancel, actionLabel = 'Continuar' }) {
  const [checked, setChecked] = useState(false);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ia-disclaimer-title"
    >
      <div className="bg-surface border border-border-dark rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
            <AppIcon name="warning" size={24} className="text-amber-400" />
          </div>
          <h3 id="ia-disclaimer-title" className="text-base font-bold text-white">
            Confirmación requerida
          </h3>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-100 leading-relaxed">
          <p className="font-semibold text-amber-200 mb-1">⚠️ Documento generado por IA</p>
          <p>
            Este documento fue generado por inteligencia artificial como <strong>borrador</strong>. 
            Requiere revisión profesional y no reemplaza el juicio de un abogado.
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-border-dark bg-surface-dark text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
          />
          <span className="text-xs text-slate-300 leading-relaxed group-hover:text-slate-200 transition-colors">
            Confirmo que he revisado este documento y <strong>asumo la responsabilidad de su uso profesional</strong>.
          </span>
        </label>

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => { setChecked(false); onCancel(); }}
            className="flex-1 btn btn-secondary text-xs py-2.5"
          >
            Cancelar
          </button>
          <button
            onClick={() => { if (checked) { setChecked(false); onConfirm(); } }}
            disabled={!checked}
            className="flex-1 btn btn-primary text-xs py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <AppIcon name="check_circle" size={16} />
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
