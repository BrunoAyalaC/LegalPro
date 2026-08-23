import { useState } from 'react';
import AppIcon from './AppIcon';

/**
 * Banner de disclaimer de IA para mostrar en la parte superior de outputs generados por IA.
 * 
 * @param {Object} props
 * @param {string} props.className - Clases adicionales de Tailwind
 * @param {boolean} props.compact - Versión compacta para espacios reducidos
 */
export default function IADisclaimerBanner({ className = '', compact = false, onDismiss }) {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed) {
    return (
      <button
        onClick={() => setDismissed(false)}
        className={`flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 underline ${className}`}
        aria-label="Mostrar advertencia de IA"
      >
        <AppIcon name="warning" size={14} />
        Ver advertencia
      </button>
    );
  }

  return (
    <div
      className={`
        relative flex items-start gap-2 
        bg-amber-500/10 border border-amber-500/30 
        rounded-lg p-3 text-amber-100
        ${compact ? 'text-[10px] py-2 px-2' : 'text-xs'}
        ${className}
      `}
      role="alert"
      aria-live="polite"
    >
      <AppIcon name="warning" size={compact ? 16 : 20} className="shrink-0 mt-0.5 text-amber-400" />
      <div className="flex-1">
        <p className="font-semibold text-amber-200 mb-0.5">
          {compact ? 'Contenido generado por IA' : 'Contenido generado por inteligencia artificial'}
        </p>
        <p className="text-amber-100/80 leading-relaxed">
          Este contenido fue generado por inteligencia artificial como <strong>borrador</strong>. 
          Requiere revisión profesional y <strong>no reemplaza el juicio de un abogado</strong>.
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 text-amber-400 hover:text-amber-200 transition-colors"
        aria-label="Ocultar advertencia"
        title="Ocultar"
      >
        <AppIcon name="close" size={16} />
      </button>
    </div>
  );
}
