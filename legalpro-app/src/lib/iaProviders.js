/**
 * iaProviders.js - Mapeo centralizado de proveedores IA (OPENCODE-FIRST)
 *
 * Single source of truth para etiquetar proveedores en el frontend.
 * Refleja la migración OPENCODE-FIRST: DeepSeek V4 Flash (principal),
 * MiMo V2.5 (visión), MiniMax (fallback), Gemini (deprecated).
 */

export const IA_PROVIDERS = {
  opencode: {
    id: 'opencode',
    label: 'DeepSeek V4 Flash',
    via: 'OpenCode Go',
    color: 'violet',
    description: 'Razonamiento, análisis y redacción legal',
    legacy: false,
  },
  'opencode-vision': {
    id: 'opencode-vision',
    label: 'MiMo V2.5',
    via: 'Xiaomi',
    color: 'blue',
    description: 'Visión, OCR y análisis de evidencia',
    legacy: false,
  },
  minimax: {
    id: 'minimax',
    label: 'MiniMax M3',
    via: 'MiniMax',
    color: 'violet',
    description: 'Proveedor fallback legacy',
    legacy: false,
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    via: 'Google',
    color: 'blue',
    description: 'ELIMINADO - no usar (migrado 2026-08-01)',
    legacy: true,
  },
  self_hosted: {
    id: 'self_hosted',
    label: 'IA Local',
    via: 'Infraestructura propia',
    color: 'green',
    description: 'Modelos self-hosted (sin transferencia internacional)',
    legacy: false,
  },
};

export function getProvider(id) {
  return IA_PROVIDERS[id] || IA_PROVIDERS.opencode;
}

export function getProviderLabel(id) {
  return getProvider(id).label;
}

export function getProviderVia(id) {
  return getProvider(id).via;
}

export function isLegacyProvider(id) {
  return getProvider(id).legacy;
}

export function getActiveProviders() {
  return Object.values(IA_PROVIDERS).filter(p => !p.legacy);
}

export function providerBadgeInfo(id) {
  const p = getProvider(id);
  return {
    label: p.label,
    via: p.via,
    color: p.color,
    title: `${p.label} (vía ${p.via}) - ${p.description}`,
  };
}

export default IA_PROVIDERS;
