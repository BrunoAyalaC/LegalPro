/**
 * ProviderBadge - Badge reutilizable de proveedor IA
 *
 * Usa el mapeo centralizado de iaProviders.js para mostrar
 * el proveedor activo (DeepSeek V4 Flash, MiMo V2.5, etc.)
 *
 * NOTA Tailwind v4: las clases de color se definen como strings
 * literales completos (BADGE_CLASSES / DOT_CLASSES) porque el scanner
 * de Tailwind NO detecta clases concatenadas en runtime
 * (`bg-${color}-500/10`). Mismo patrón que usaba AIAssistantPanel.
 */

import { providerBadgeInfo } from '../../lib/iaProviders.js';

/* Mapeo estático de clases por color (obligatorio para Tailwind JIT) */
const BADGE_CLASSES = {
  violet: 'bg-violet-500/10 border-violet-400/30 text-violet-300',
  blue:   'bg-blue-500/10 border-blue-400/30 text-blue-300',
  green:  'bg-green-500/10 border-green-400/30 text-green-300',
};

const DOT_CLASSES = {
  violet: 'bg-violet-400',
  blue:   'bg-blue-400',
  green:  'bg-green-400',
};

export default function ProviderBadge({ providerId, model, showVia = true, className = '' }) {
  const info = providerBadgeInfo(providerId);

  if (!info || !providerId) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border ${BADGE_CLASSES[info.color] || BADGE_CLASSES.violet} ${className}`}
      title={info.title}
      aria-label={info.title}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${DOT_CLASSES[info.color] || DOT_CLASSES.violet}`} aria-hidden="true" />
      {info.label}
      {showVia && info.via && (
        <span className="opacity-60 text-[9px]">· vía {info.via}</span>
      )}
      {model && model !== info.label && (
        <span className="font-mono opacity-50">{model}</span>
      )}
    </span>
  );
}
