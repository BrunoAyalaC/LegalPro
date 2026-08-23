/**
 * Provider Router Tests - Selección de proveedor IA
 *
 * Valida el enrutamiento OPENCODE-FIRST de providerRouter.js:
 *  - isOpenCodeActive() refleja OPENCODE_API_KEY
 *  - getActiveProvider() prioriza OpenCode y cae a MiniMax
 *
 * SKILL: vitest-test-writer
 * @author BackendNode
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

describe('providerRouter', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.OPENCODE_API_KEY;
  });

  test('isOpenCodeActive() false sin OPENCODE_API_KEY', async () => {
    const { isOpenCodeActive } = await import('../utils/providerRouter.js');
    expect(isOpenCodeActive()).toBe(false);
  });

  test('isOpenCodeActive() true con OPENCODE_API_KEY', async () => {
    process.env.OPENCODE_API_KEY = 'sk-test-123';
    const { isOpenCodeActive } = await import('../utils/providerRouter.js');
    expect(isOpenCodeActive()).toBe(true);
  });

  test('getActiveProvider() devuelve opencode cuando está configurado', async () => {
    process.env.OPENCODE_API_KEY = 'sk-test-123';
    const { getActiveProvider } = await import('../utils/providerRouter.js');
    const provider = getActiveProvider();
    expect(provider.name).toBe('opencode');
    expect(provider.providerLabel).toContain('DeepSeek');
  });

  test('getActiveProvider() devuelve minimax como fallback', async () => {
    const { getActiveProvider } = await import('../utils/providerRouter.js');
    const provider = getActiveProvider();
    expect(provider.name).toBe('minimax');
    expect(provider.providerLabel).toContain('MiniMax');
  });
});
