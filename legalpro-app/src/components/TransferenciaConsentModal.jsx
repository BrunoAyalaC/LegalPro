import { useState, useEffect, useRef } from 'react';
import AppIcon from './AppIcon';

/**
 * TransferenciaConsentModal — LPDP Art. 15 / Art. 21
 * Modal bloqueante parametrizable por provider cloud que procesa datos fuera de Perú.
 * No dismissible por overlay ni Escape. Requiere checkbox explícito + confirmación.
 *
 * @param {boolean} isOpen
 * @param {() => void} onConfirm - callback al aceptar
 * @param {() => void} onCancel - callback al cancelar/rechazar
 * @param {string} provider - "opencode" | "minimax" | "self_hosted" | "opencode-vision"
 * @param {string} paisDestino - texto libre ej: "China" | "Estados Unidos" | "China / EE.UU."
 * @param {string} finalidad - texto parametrizable ej: "procesamiento de IA"
 */
const PROVIDER_CFG = {
  opencode: { label: 'OpenCode AI', paisDefault: 'China / EE.UU.', color: '#06B6D4' },
  minimax: { label: 'MiniMax', paisDefault: 'China', color: '#DC2626' },
  self_hosted: { label: 'Servidor Propio', paisDefault: 'Perú', color: '#10B981' },
  'opencode-vision': { label: 'OpenCode Vision', paisDefault: 'China / EE.UU.', color: '#7C3AED' },
};

export default function TransferenciaConsentModal({
  isOpen,
  onConfirm,
  onCancel,
  provider = 'opencode',
  paisDestino,
  finalidad = 'procesamiento de IA',
  textoCustom,
}) {
  const [checked, setChecked] = useState(false);
  const [checked2, setChecked2] = useState(false);
  const closeBtnRef = useRef(null);
  const confirmBtnRef = useRef(null);

  const cfg = PROVIDER_CFG[provider] ?? PROVIDER_CFG.opencode;
  const paisFinal = paisDestino ?? cfg.paisDefault;

  useEffect(() => {
    if (isOpen) {
      setChecked(false);
      setChecked2(false);
      setTimeout(() => closeBtnRef.current?.focus(), 100);
      document.body.style.overflow = 'hidden';
      const onKey = (e) => {
        if (e.key === 'Escape') {
          // Bloqueante: Escape no cierra, solo enfoca cancelar
          e.preventDefault();
          closeBtnRef.current?.focus();
        }
        if (e.key === 'Tab') {
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
  }, [isOpen]);

  if (!isOpen) return null;

  const canConfirm = checked && checked2;
  const color = cfg.color;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transferencia-title"
      data-testid="transferencia-modal"
      data-provider={provider}
      // Bloqueante: click en overlay NO cierra
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="bg-[#0F172A] border rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-auto"
        style={{ borderColor: color }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}20` }}>
            <AppIcon name="shield" size={24} style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="transferencia-title" className="text-base font-bold text-white leading-tight">
              Transferencia Internacional de Datos
            </h3>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">
              LPDP Ley 29733 · Art. 15 / Art. 21 · {cfg.label} → {paisFinal}
            </p>
          </div>
        </div>

        <div className="rounded-lg p-3.5 text-xs leading-relaxed border bg-amber-500/10 border-amber-500/20" style={{ borderLeftColor: '#F59E0B', borderLeftWidth: '3px' }}>
          <p className="font-semibold mb-1.5 text-amber-400">⚠️ Consentimiento para transferencia internacional</p>
          {textoCustom ? (
            <p className="text-slate-200/90 whitespace-pre-wrap">{textoCustom}</p>
          ) : (
            <>
              <p className="text-slate-200/90">
                Tus datos y consultas serán enviados a servidores de <strong>{cfg.label}</strong> ubicados en <strong>{paisFinal}</strong> para el <strong>{finalidad}</strong>.
                Este tratamiento implica una <strong>transferencia internacional de datos personales</strong> conforme a la Ley 29733 (LPDP) y su Reglamento D.S. 003-2013-JUS.
              </p>
              <p className="text-slate-200/90 mt-2">
                El proveedor se compromete a proteger tus datos según estándares internacionales. Puedes revocar este consentimiento en cualquier momento desde tu perfil.
              </p>
            </>
          )}
          <div className="flex flex-wrap gap-1.5 mt-3">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border" style={{ borderColor: color, color, backgroundColor: `${color}15` }}>
              <AppIcon name="smart_toy" size={12} aria-hidden="true" />
              {cfg.label} · {provider}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-white/5 text-slate-300 border border-white/10">
              Destino: {paisFinal}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
              Bloqueante
            </span>
          </div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-white/5 transition-colors">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-white focus:ring-2 focus:ring-offset-0 cursor-pointer"
            style={{ accentColor: color }}
            aria-label="Acepto transferencia internacional"
            data-testid="transferencia-checkbox-1"
          />
          <span className="text-xs text-slate-300 leading-relaxed group-hover:text-slate-200 transition-colors">
            <strong>Autorizo expresamente</strong> la transferencia internacional de mis datos personales a <strong>{cfg.label} ({paisFinal})</strong> para la finalidad de <strong>{finalidad}</strong>, conforme a la Política de Privacidad.
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-white/5 transition-colors">
          <input
            type="checkbox"
            checked={checked2}
            onChange={(e) => setChecked2(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-white focus:ring-2 focus:ring-offset-0 cursor-pointer"
            style={{ accentColor: color }}
            aria-label="Comprendo revocabilidad"
            data-testid="transferencia-checkbox-2"
          />
          <span className="text-xs text-slate-300 leading-relaxed group-hover:text-slate-200 transition-colors">
            Comprendo que puedo <strong>revocar este consentimiento</strong> en cualquier momento desde Perfil → Privacidad, y que la revocatoria no afecta tratamientos previos ya ejecutados.
          </span>
        </label>

        <div className="rounded-lg bg-white/5 border border-white/10 p-2.5 flex items-start gap-2">
          <AppIcon name="info" size={14} className="text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Sin este consentimiento no podrás usar funciones de IA que requieren envío a proveedor externo. Las funciones locales seguirán disponibles.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            ref={closeBtnRef}
            onClick={() => {
              setChecked(false);
              setChecked2(false);
              onCancel?.();
            }}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs border border-white/10 transition-colors"
            data-testid="transferencia-cancel"
          >
            Rechazar
          </button>
          <button
            ref={confirmBtnRef}
            onClick={() => {
              if (!canConfirm) return;
              setChecked(false);
              setChecked2(false);
              onConfirm?.();
            }}
            disabled={!canConfirm}
            className="flex-1 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white"
            style={{ backgroundColor: canConfirm ? color : '#334155' }}
            data-testid="transferencia-confirm"
          >
            <AppIcon name="check_circle" size={16} />
            Aceptar y Continuar
          </button>
        </div>
      </div>
    </div>
  );
}

export { PROVIDER_CFG };
