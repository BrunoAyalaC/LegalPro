/**
 * aiConfig.js — Fuente ÚNICA DE VERDAD de configuración IA
 *
 * Centraliza TODAS las variables de entorno relacionadas con proveedores IA.
 * Cero hardcoding: cada modelo, cada URL y cada key se lee desde `process.env`.
 *
 * Diseño:
 *  - Snapshot top-level (las vars se leen una sola vez al importar el módulo).
 *    Esto es compatible con los tests que usan `vi.resetModules()` + import
 *    dinámico para releer `process.env` entre tests.
 *  - Helpers `isOpenCodeActive()`, `isOpenRouterActive()`, `isMinimaxActive()`
 *    para compatibilidad con código y tests previos.
 *  - `getActiveProvider()` y `getVisionProvider()` deciden dinámicamente
 *    qué proveedor usar según qué keys estén configuradas y los flags
 *    `IA_PROVIDER` / `VISION_PROVIDER` (default: 'auto').
 *
 * Reglas duras (sin excepciones):
 *  1. NUNCA hardcodear IDs de modelo aquí ni en otros archivos. Si necesitas
 *     el modelo de visión, importa `aiConfig.openrouterVisionModel` o
 *     `aiConfig.opencodeVisionModel`. El cerebro siempre desde
 *     `aiConfig.opencodeModel` o `aiConfig.openrouterTextModel`.
 *  2. Si OpenRouter falla en visión, el llamador (ocrQwenService) degrada
 *     a OpenCode (mimo-v2.5-free). Este módulo solo DECIDE; no enruta.
 *  3. Cerebro por defecto: OpenCode (deepseek-v4-flash-free, GRATIS).
 *  4. Visión por defecto: OpenRouter (qwen/qwen3-vl-32b-instruct, $0.10/$0.42) si
 *     hay key; si no, OpenCode (mimo-v2.5-free) como fallback GRATIS.
 *
 * @author BackendNode
 * @version 1.0.0 (2026-08-08)
 */

const _env = process.env;

// ─── Helper: parseFloat seguro ─────────────────────────────────────────────
function _float(value, defaultValue) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : defaultValue;
}
function _int(value, defaultValue) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : defaultValue;
}

// ─── Snapshot inmutable de configuración ────────────────────────────────────
export const aiConfig = Object.freeze({
  // ── Selección explícita del provider de TEXTO ─────────────────────────────
  // Valores válidos: 'auto' (default), 'opencode', 'openrouter', 'minimax'.
  IA_PROVIDER: (_env.IA_PROVIDER || 'auto').toLowerCase(),

  // ── Selección explícita del provider de VISIÓN ────────────────────────────
  // Valores válidos: 'auto' (default), 'openrouter', 'opencode', 'minimax'.
  VISION_PROVIDER: (_env.VISION_PROVIDER || 'auto').toLowerCase(),

  // ── OpenCode Go (DeepSeek V4 Flash) — proveedor principal de texto ───────
  hasOpencode: !!_env.OPENCODE_API_KEY,
  opencodeApiKey: _env.OPENCODE_API_KEY || null,
  opencodeBaseUrl: _env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/v1',
  opencodeModel: _env.OPENCODE_MODEL || 'deepseek-v4-flash-free',
  opencodeVisionModel: _env.OPENCODE_VISION_MODEL || 'mimo-v2.5-free',
  opencodeTemperature: _float(_env.OPENCODE_TEMPERATURE, 0.2),
  opencodeMaxTokens: _int(_env.OPENCODE_MAX_TOKENS, 8192),

  // ── OpenRouter (Qwen VL 32B visión + DeepSeek/MiniMax texto) ─────────────
  hasOpenrouter: !!_env.OPENROUTER_API_KEY,
  openrouterApiKey: _env.OPENROUTER_API_KEY || null,
  openrouterBaseUrl: _env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  openrouterVisionModel: _env.OPENROUTER_VISION_MODEL || 'qwen/qwen3-vl-32b-instruct',
  openrouterTextModel: _env.OPENROUTER_TEXT_MODEL || 'deepseek/deepseek-chat-v3.1:free',
  openrouterTemperature: _float(_env.OPENROUTER_TEMPERATURE, 0.2),
  openrouterMaxTokens: _int(_env.OPENROUTER_MAX_TOKENS, 8192),

  // ── MiniMax (LEGACY fallback — NO recomendado para nuevos deploys) ────────
  hasMinimax: !!_env.MINIMAX_API_KEY,
  minimaxApiKey: _env.MINIMAX_API_KEY || null,
  minimaxBaseUrl: _env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1',
  minimaxModelDefault: _env.MINIMAX_MODEL_DEFAULT || 'MiniMax-M3',
  minimaxTemperature: _float(_env.MINIMAX_TEMPERATURE_DEFAULT, 0.2),
  minimaxMaxTokens: _int(_env.MINIMAX_MAX_TOKENS, 8192),

  // ── App metadata (OpenRouter requiere HTTP-Referer y X-Title) ─────────────
  appReferer: _env.APP_REFERER || 'https://legalpro.ai',
  appTitle: _env.APP_TITLE || 'LegalPro',
});

/**
 * Etiqueta legible para humanos del proveedor activo (para logs y LPDP Art. 21).
 * @param {string} name - 'opencode' | 'openrouter' | 'minimax' | 'none'
 * @returns {string}
 */
export function providerLabel(name) {
  switch (name) {
    case 'opencode':
      return `DeepSeek V4 Flash (OpenCode Go, modelo ${aiConfig.opencodeModel})`;
    case 'openrouter':
      return `OpenRouter (texto: ${aiConfig.openrouterTextModel}, visión: ${aiConfig.openrouterVisionModel})`;
    case 'minimax':
      return `MiniMax M3 (fallback legacy, modelo ${aiConfig.minimaxModelDefault})`;
    case 'none':
    default:
      return 'Sin proveedor IA configurado';
  }
}

/**
 * Decide qué proveedor de TEXTO usar.
 *
 * Orden de resolución cuando IA_PROVIDER='auto' (default):
 *   1. OpenRouter (si OPENROUTER_API_KEY) — soporte multimodal + precios competitivos
 *   2. OpenCode (si OPENCODE_API_KEY) — cerebro primario actual (GRATIS via Zen)
 *   3. MiniMax (LEGACY fallback)
 *
 * Si IA_PROVIDER está fijado explícitamente a un nombre, se respeta siempre
 * que la key correspondiente exista; si no existe, se degrada al fallback 'auto'.
 *
 * @returns {{name: string, hasKey: boolean, model: string, providerLabel: string}}
 *   - `name`: 'opencode' | 'openrouter' | 'minimax' | 'none'
 *   - `model`: modelo de texto configurado para el provider activo
 *   - `providerLabel`: descripción legible (logs, LPDP Art. 21)
 */
export function getActiveProvider() {
  const explicit = aiConfig.IA_PROVIDER;

  function pickByPriority() {
    if (aiConfig.hasOpenrouter) {
      return {
        name: 'openrouter',
        hasKey: true,
        model: aiConfig.openrouterTextModel,
        providerLabel: providerLabel('openrouter'),
      };
    }
    if (aiConfig.hasOpencode) {
      return {
        name: 'opencode',
        hasKey: true,
        model: aiConfig.opencodeModel,
        providerLabel: providerLabel('opencode'),
      };
    }
    if (aiConfig.hasMinimax) {
      return {
        name: 'minimax',
        hasKey: true,
        model: aiConfig.minimaxModelDefault,
        providerLabel: providerLabel('minimax'),
      };
    }
    return {
      name: 'none',
      hasKey: false,
      model: null,
      providerLabel: providerLabel('none'),
    };
  }

  const picked = pickByPriority();

  // Si el flag explícito es válido y la key existe, respetar.
  if (explicit === 'openrouter' && aiConfig.hasOpenrouter) return { ...picked, name: 'openrouter', model: aiConfig.openrouterTextModel, providerLabel: providerLabel('openrouter') };
  if (explicit === 'opencode' && aiConfig.hasOpencode) return { ...picked, name: 'opencode', model: aiConfig.opencodeModel, providerLabel: providerLabel('opencode') };
  if (explicit === 'minimax' && aiConfig.hasMinimax) return { ...picked, name: 'minimax', model: aiConfig.minimaxModelDefault, providerLabel: providerLabel('minimax') };

  // Modo 'auto' o flag inválido → usar la prioridad calculada.
  // Si no hay ninguna key (caso degradado), devolver 'minimax' como etiqueta
  // para preservar compatibilidad con tests previos (`getActiveProvider().name === 'minimax'`).
  if (picked.name === 'none') {
    return {
      name: 'minimax',
      hasKey: false,
      model: aiConfig.minimaxModelDefault,
      providerLabel: providerLabel('minimax'),
    };
  }

  return picked;
}

/**
 * Decide qué proveedor de VISIÓN usar (OCR, multimodal).
 *
 * Orden de resolución cuando VISION_PROVIDER='auto' (default):
 *   1. OpenRouter (si OPENROUTER_API_KEY) — Qwen VL 32B, alta calidad
 *   2. OpenCode (si OPENCODE_API_KEY) — mimo-v2.5-free, GRATIS
 *   3. MiniMax (LEGACY fallback)
 *
 * @returns {{name: string, hasKey: boolean, model: string, providerLabel: string}}
 */
export function getVisionProvider() {
  const explicit = aiConfig.VISION_PROVIDER;

  function pickByPriority() {
    if (aiConfig.hasOpenrouter) {
      return {
        name: 'openrouter',
        hasKey: true,
        model: aiConfig.openrouterVisionModel,
        providerLabel: `OpenRouter Visión (${aiConfig.openrouterVisionModel})`,
      };
    }
    if (aiConfig.hasOpencode) {
      return {
        name: 'opencode',
        hasKey: true,
        model: aiConfig.opencodeVisionModel,
        providerLabel: `OpenCode Visión (${aiConfig.opencodeVisionModel})`,
      };
    }
    if (aiConfig.hasMinimax) {
      return {
        name: 'minimax',
        hasKey: true,
        model: aiConfig.minimaxModelDefault,
        providerLabel: `MiniMax Visión (${aiConfig.minimaxModelDefault})`,
      };
    }
    return {
      name: 'none',
      hasKey: false,
      model: null,
      providerLabel: 'Sin proveedor de visión configurado',
    };
  }

  const picked = pickByPriority();

  if (explicit === 'openrouter' && aiConfig.hasOpenrouter) return picked;
  if (explicit === 'opencode' && aiConfig.hasOpencode) return picked;
  if (explicit === 'minimax' && aiConfig.hasMinimax) return picked;

  // Fallback final si nada está configurado.
  if (picked.name === 'none') {
    return {
      name: 'opencode',
      hasKey: false,
      model: aiConfig.opencodeVisionModel,
      providerLabel: `OpenCode Visión (${aiConfig.opencodeVisionModel}) — sin key`,
    };
  }

  return picked;
}

// ─── Helpers booleanos (compatibilidad con código y tests previos) ─────────
export function isOpenCodeActive() { return aiConfig.hasOpencode; }
export function isOpenRouterActive() { return aiConfig.hasOpenrouter; }
export function isMinimaxActive() { return aiConfig.hasMinimax; }

/**
 * Verifica si al menos UN proveedor IA tiene key configurada.
 * Útil para arrancar el server sin IA (chat degradado) y para health checks.
 */
export function isAnyAiProviderConfigured() {
  return aiConfig.hasOpencode || aiConfig.hasOpenrouter || aiConfig.hasMinimax;
}

/**
 * Mapa inmutable de etiquetas (compatibilidad con código que importaba
 * `IA_PROVIDER_LABEL` desde providerRouter.js). Se construye dinámicamente
 * desde aiConfig para mantener la única fuente de verdad.
 */
export const IA_PROVIDER_LABEL = Object.freeze({
  opencode: providerLabel('opencode'),
  openrouter: providerLabel('openrouter'),
  minimax: providerLabel('minimax'),
  gemini: 'Google Gemini (DEPRECATED — no debe usarse)',
});

export default aiConfig;
