// legalpro-app/src/pages/__tests__/ChatIA.tdz.test.jsx
// Test de regresión P0: ChatIA lanzaba
//   ReferenceError: Cannot access 'materiaContexto' before initialization
// (TDZ) porque el useCallback handleMensajeDownload (deps: [messages,
// materiaContexto, numeroExpediente, ...]) se evaluaba ANTES de la
// declaración `const materiaContexto = ...` en el cuerpo del componente.
//
// El TDZ se introdujo al extraer Mensaje.jsx + handleMensajeDownload como
// useCallback (v6.12.15) y rompía el chunk ChatIA-*.js en producción
// ("Cannot access 'le' before initialization").
//
// Este test renderiza ChatIA con react-dom/server (no requiere DOM):
// ANTES del fix lanza ReferenceError, DESPUÉS renderiza sin error.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';

// ── Mocks de dependencias externas (aislan el TDZ del componente padre) ──

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams('')],
  Link: ({ to, children }) => `<a href="${to}">${children}</a>`,
}));

vi.mock('dompurify', () => ({
  default: { sanitize: (html) => String(html) },
}));

vi.mock('../../api/client', () => ({
  api: { chat: vi.fn(async () => ({ respuesta: 'ok', tipo_respuesta: 'respuesta' })) },
  nodeClient: { get: vi.fn(async () => ({ data: { data: [] } })) },
  detectarDocumento: vi.fn(async () => ({ data: { tipo: 'escrito_simple' } })),
  redactarDocumento: vi.fn(async () => ({ data: new Blob(), headers: {} })),
}));

vi.mock('../../hooks/useSeo', () => ({
  useSeo: () => {},
}));

vi.mock('../../lib/iaProviders.js', () => ({
  getProviderLabel: () => 'DeepSeek V4 Flash',
}));

vi.mock('../../components/chat/Mensaje', () => ({
  default: () => '<div data-testid="mensaje" />',
}));

vi.mock('../../components/chat/TarjetaRespuesta', () => ({
  default: () => '<div data-testid="tarjeta" />',
}));

vi.mock('../../components/IADisclaimerBanner', () => ({
  default: () => '<div data-testid="disclaimer" />',
}));

vi.mock('../../components/AppIcon', () => ({
  default: () => '<span data-testid="appicon" />',
}));

vi.mock('../../components/ui/SpriteIcon', () => ({
  default: () => '<span data-testid="spriteicon" />',
}));

vi.mock('../../assets/avatar/avatar_ia.jpeg', () => ({ default: '/avatar_ia.jpeg' }));
vi.mock('../../assets/empty-states/chat_ia_vacio.png', () => ({ default: '/chat_ia_vacio.png' }));

// Stubs de globals usados en el render SSR
const originalGlobals = {};
beforeEach(() => {
  originalGlobals.localStorage = globalThis.localStorage;
  originalGlobals.sessionStorage = globalThis.sessionStorage;
  originalGlobals.window = globalThis.window;
  globalThis.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  globalThis.sessionStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
  };
  globalThis.window = { confirm: () => true };
});

afterEach(() => {
  globalThis.localStorage = originalGlobals.localStorage;
  globalThis.sessionStorage = originalGlobals.sessionStorage;
  globalThis.window = originalGlobals.window;
});

describe('ChatIA TDZ regression (P0 chat roto)', () => {
  it('renderiza sin ReferenceError (materiaContexto declarada antes del useCallback)', async () => {
    const { default: ChatIA } = await import('../ChatIA');
    let html = '';
    let error = null;
    try {
      html = renderToString(React.createElement(ChatIA));
    } catch (e) {
      error = e;
    }
    expect(error).toBeNull();
    expect(html).toContain('chat-shell');
  });
});
