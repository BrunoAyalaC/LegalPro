import { useState } from 'react';
import AppIcon from './AppIcon';
import { getProviderLabel } from '../lib/iaProviders.js';

/**
 * IADisclaimerBanner — LPDP Art.21 + catalogs/disclaimers-ia.json
 *
 * Variants canónicas (colores obligatorios):
 *   - general   → #F59E0B ámbar (disclaimer_general)
 *   - predictor → #DC2626 rojo (disclaimer_predictor, pos: modal+footer, NO dismissible)
 *   - redactor  → #DC2626 rojo (disclaimer_redactor, pos: modal+footer, NO dismissible)
 *   - simulador → #7C3AED violeta (disclaimer_simulador, pos: modal+footer, NO dismissible)
 *
 * @param {string} variant - "general" | "predictor" | "redactor" | "simulador"
 * @param {boolean} dismissible - si false, NO muestra botón cerrar (obligatorios persistent:true)
 * @param {string} provider - "opencode" | "minimax" | "self_hosted" | "opencode-vision"
 * @param {boolean} showProviderBadge - muestra badge proveedor
 * @param {boolean} compact - versión compacta
 * @param {string} posicion - "footer" | "modal + footer" (informativo)
 */
const VARIANT_CFG = {
  general: {
    id: 'disclaimer_general',
    titulo: 'Aviso Importante',
    texto: 'Este contenido es generado por un sistema de Inteligencia Artificial y NO constituye asesoría legal. Para tomar decisiones legales, consulte con un abogado colegiado. La IA puede cometer errores; verifique siempre las citas legales.',
    color: '#F59E0B',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-100',
    titleText: 'text-amber-200',
    icon: 'text-amber-400',
    posicion: 'footer',
    dismissibleDefault: true,
    persistent: false,
  },
  predictor: {
    id: 'disclaimer_predictor',
    titulo: 'Limitaciones del Predictor',
    texto: 'La predicción judicial es un análisis PROBABILÍSTICO basado en sentencias previas y NO garantiza el resultado del caso. Cada caso tiene particularidades propias. Esta herramienta NO debe usarse como única base para tomar decisiones procesales o financieras.',
    color: '#DC2626',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-100',
    titleText: 'text-red-200',
    icon: 'text-red-400',
    posicion: 'modal + footer',
    dismissibleDefault: false,
    persistent: true,
  },
  redactor: {
    id: 'disclaimer_redactor',
    titulo: 'Verificación Obligatoria Previa Presentación',
    texto: 'Todo escrito generado por IA debe ser REVISADO y VALIDADO por un abogado colegiado antes de su presentación ante cualquier autoridad. Verifique: (1) citas legales exactas, (2) coherencia con la estrategia procesal, (3) cumplimiento de plazos y formalidades.',
    color: '#DC2626',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-100',
    titleText: 'text-red-200',
    icon: 'text-red-400',
    posicion: 'modal + footer',
    dismissibleDefault: false,
    persistent: true,
  },
  simulador: {
    id: 'disclaimer_simulador',
    titulo: 'Simulador con Fines de Entrenamiento',
    texto: 'Este simulador es una herramienta de ENTRENAMIENTO. La IA interpreta un rol opuesto (Juez, Fiscal, Testigo, etc.) con fines pedagógicos. NO constituye un ejercicio real de audiencia ni reemplaza la práctica supervisada.',
    color: '#7C3AED',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    text: 'text-violet-100',
    titleText: 'text-violet-200',
    icon: 'text-violet-400',
    posicion: 'modal + footer',
    dismissibleDefault: false,
    persistent: true,
  },
};

export default function IADisclaimerBanner({
  className = '',
  compact = false,
  onDismiss,
  variant = 'general',
  dismissible,
  provider = 'opencode',
  showProviderBadge = true,
  posicion,
  title,
  text,
}) {
  const cfg = VARIANT_CFG[variant] ?? VARIANT_CFG.general;
  const isDismissible = dismissible ?? cfg.dismissibleDefault;
  const finalPosicion = posicion ?? cfg.posicion;
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed && isDismissible) {
    return (
      <button
        onClick={() => setDismissed(false)}
        className={`flex items-center gap-1 text-[10px] hover:underline ${className}`}
        style={{ color: cfg.color }}
        aria-label="Mostrar advertencia de IA"
        data-testid="ia-banner-restore"
      >
        <AppIcon name="warning" size={14} />
        Ver advertencia
      </button>
    );
  }

  // Si está dismissed y NO es dismissible, no se debería haber llegado aquí — pero respetar persistent
  if (dismissed && !isDismissible) return null;

  const providerLabel = getProviderLabel(provider);

  return (
    <div
      className={`
        relative flex items-start gap-2.5
        ${cfg.bg} border ${cfg.border}
        rounded-lg p-3 ${cfg.text}
        ${compact ? 'text-[10px] py-2 px-2.5' : 'text-xs'}
        ${cfg.persistent ? 'sticky bottom-0 z-10 backdrop-blur-md' : ''}
        ${className}
      `}
      role="alert"
      aria-live="polite"
      data-variant={variant}
      data-color={cfg.color}
      data-posicion={finalPosicion}
      data-testid={`ia-banner-${variant}`}
      style={{ borderLeftColor: cfg.color, borderLeftWidth: '3px' }}
    >
      <AppIcon name="warning" size={compact ? 16 : 20} className={`shrink-0 mt-0.5 ${cfg.icon}`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className={`font-semibold ${cfg.titleText} mb-0.5 leading-tight`}>
          {title ?? cfg.titulo}
        </p>
        <p className={`${cfg.text}/80 leading-relaxed`}>
          {text ?? cfg.texto}
        </p>
        {/* Footer meta: posición + proveedor badge */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider opacity-60">
            <AppIcon name="info" size={10} aria-hidden="true" />
            {finalPosicion}
          </span>
          {showProviderBadge && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border"
              style={{ borderColor: cfg.color, color: cfg.color, backgroundColor: `${cfg.color}15` }}
              data-testid="ia-provider-badge"
              title={`Proveedor IA: ${providerLabel}`}
            >
              <AppIcon name="smart_toy" size={10} aria-hidden="true" />
              {providerLabel}
              <span className="opacity-60">· {provider}</span>
            </span>
          )}
          {cfg.persistent && (
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-black/20">
              Obligatorio · No omitible
            </span>
          )}
        </div>
      </div>
      {isDismissible && (
        <button
          onClick={handleDismiss}
          className={`shrink-0 ${cfg.icon} hover:opacity-80 transition-colors p-1`}
          aria-label="Ocultar advertencia"
          title="Ocultar"
          data-testid="ia-banner-dismiss"
        >
          <AppIcon name="close" size={16} />
        </button>
      )}
    </div>
  );
}

export { VARIANT_CFG };
