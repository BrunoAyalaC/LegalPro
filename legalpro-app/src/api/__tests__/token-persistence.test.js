/**
 * UNIT TESTS — Persistencia de tokens (SECURITY P0 FIX 2026-08-21)
 *
 * El cliente migró a httpOnly cookies (SameSite=Lax, Secure, path=/api):
 *   - setTokens()            → SOLO memoria. NUNCA localStorage/sessionStorage.
 *   - restoreTokenFromStorage() → no-op (no restaura nada del storage).
 *   - getSessionFromCookie() → rehidrata vía GET /api/auth/me (cookie viaja
 *     con withCredentials:true).
 *
 * Estrategia: mockear axios ANTES de importar client.ts (igual que
 * client.helpers.test.js). localStorage/sessionStorage se stubean con un fake
 * que SOBREVIVE al reset de módulos (simula el navegador entre F5).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Fake storage compartido (persiste entre resets de módulo = navegador) ──
class FakeStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
  clear() { this.store.clear(); }
}

const ACCESS_KEY = 'legalpro_access_token';
const fakeLocalStorage = new FakeStorage();
const fakeSessionStorage = new FakeStorage();

vi.stubGlobal('localStorage', fakeLocalStorage);
vi.stubGlobal('sessionStorage', fakeSessionStorage);

// ── Mocks de axios (mismo patrón que client.helpers.test.js) ───────────────
const nodePost = vi.fn();
const nodeGet = vi.fn();
const dotnetPost = vi.fn();
const dotnetGet = vi.fn();

vi.mock('axios', () => {
  const makeInstance = (base) => ({
    post: (...args) => (base === 'DOTNET' ? dotnetPost(...args) : nodePost(...args)),
    get: (...args) => (base === 'DOTNET' ? dotnetGet(...args) : nodeGet(...args)),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    defaults: { headers: { common: {} } },
  });
  return {
    default: {
      create: (config) => {
        const url = (config?.baseURL || '').toLowerCase();
        const base = (url.includes('dotnet') || url.includes('5000')) ? 'DOTNET' : 'NODE';
        return makeInstance(base);
      },
      post: vi.fn(),
    },
  };
});

let api;
let mod;

const JWT_FAKE = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJzdWIiOiIxIiwiZW1haWwiOiJhYm9nYWRvQGxlZ2FscHJvLnBlIiwicm9sIjoiQUJPR0FETyIsIm5vbWJyZV9jb21wbGV0byI6IkRyLiBQcnVlYmEiLCJvcmdhbml6YXRpb25faWQiOiJvcmctMSIsImV4cCI6MTk5OTk5OTk5OX0',
  'signature-fake',
].join('.');

const LOGIN_RESPONSE = {
  token: JWT_FAKE,
  usuario: { id: 1, email: 'abogado@legalpro.pe', nombreCompleto: 'Dr. Prueba', rol: 'ABOGADO' },
  organizacion: { id: 'org-1', nombre: 'Estudio Prueba', slug: 'estudio-prueba', plan: 'pro', rolMiembro: 'ADMIN' },
};

const ME_RESPONSE = {
  token: JWT_FAKE,
  id: 1,
  email: 'abogado@legalpro.pe',
  nombreCompleto: 'Dr. Prueba',
  rol: 'ABOGADO',
  organizacion: { id: 'org-1', nombre: 'Estudio Prueba', slug: 'estudio-prueba', plan: 'pro', rolMiembro: 'ADMIN' },
};

beforeEach(async () => {
  nodePost.mockReset();
  nodeGet.mockReset();
  dotnetPost.mockReset();
  dotnetGet.mockReset();
  fakeLocalStorage.clear();
  fakeSessionStorage.clear();
  // Reset del módulo: borra la memoria de ACCESS_TOKEN/REFRESH_TOKEN (simula F5)
  vi.resetModules();
  mod = await import('../client.ts');
  api = mod.api;
});

describe('setTokens NO persiste en storage (httpOnly cookie)', () => {
  it('setTokens deja el token solo en memoria — storages vacíos', () => {
    mod.setTokens(JWT_FAKE, 'refresh-secreto-abc');

    expect(mod.getToken()).toBe(JWT_FAKE); // memoria sí
    expect(fakeLocalStorage.store.size).toBe(0); // storage NO
    expect(fakeSessionStorage.store.size).toBe(0);
    expect(localStorage.getItem(ACCESS_KEY)).toBeNull();
    expect(sessionStorage.getItem(ACCESS_KEY)).toBeNull();
  });

  it('login (remember=true, firma legacy) no escribe nada en ningún storage', async () => {
    nodePost.mockResolvedValueOnce({ data: LOGIN_RESPONSE });

    await api.login({ email: 'abogado@legalpro.pe', password: 'Secure123!', remember: true });

    expect(mod.getToken()).toBe(JWT_FAKE);
    expect(fakeLocalStorage.store.size).toBe(0);
    expect(fakeSessionStorage.store.size).toBe(0);
  });

  it('el refresh token NUNCA aparece en storage tras login', async () => {
    nodePost.mockResolvedValueOnce({
      data: { ...LOGIN_RESPONSE, refreshToken: 'refresh-secreto-abc' },
    });

    await api.login({ email: 'a@legalpro.pe', password: 'Secure123!', remember: true });

    const storageValues = [
      ...fakeLocalStorage.store.values(),
      ...fakeSessionStorage.store.values(),
    ];
    expect(storageValues.join('|')).not.toContain('refresh-secreto-abc');
    expect(storageValues.join('|')).not.toContain(JWT_FAKE);
  });
});

describe('restoreTokenFromStorage es no-op', () => {
  it('tras F5 no restaura nada aunque queden restos legacy en storage', async () => {
    // Simular restos legacy de la era pre-cookie en el navegador
    fakeLocalStorage.setItem(ACCESS_KEY, JWT_FAKE);
    fakeSessionStorage.setItem(ACCESS_KEY, JWT_FAKE);

    // F5: recargar el módulo (memoria limpia, storage intacto)
    vi.resetModules();
    mod = await import('../client.ts');
    api = mod.api;
    expect(mod.getToken()).toBeNull(); // memoria vacía tras F5

    // No-op: ni lee ni restaura del storage
    expect(api.restoreTokenFromStorage()).toBeNull();
    expect(mod.getToken()).toBeNull(); // memoria sigue vacía
  });

  it('devuelve null con storages limpios y no lanza', () => {
    expect(() => api.restoreTokenFromStorage()).not.toThrow();
    expect(api.restoreTokenFromStorage()).toBeNull();
  });
});

describe('getSessionFromCookie rehidrata vía /api/auth/me', () => {
  it('llama GET /api/auth/me y setea el token solo en memoria', async () => {
    nodeGet.mockResolvedValueOnce({ data: ME_RESPONSE });

    const session = await api.getSessionFromCookie();

    expect(nodeGet).toHaveBeenCalledTimes(1);
    expect(nodeGet).toHaveBeenCalledWith('/api/auth/me');
    expect(session?.token).toBe(JWT_FAKE);
    expect(session?.rol).toBe('ABOGADO');
    expect(session?.organizacion?.slug).toBe('estudio-prueba');
    expect(mod.getToken()).toBe(JWT_FAKE); // rehidratado en memoria
    // La sesión vive en la cookie httpOnly, jamás en storage
    expect(fakeLocalStorage.store.size).toBe(0);
    expect(fakeSessionStorage.store.size).toBe(0);
  });

  it('soporta shape dual { success, data: {...} } del backend', async () => {
    nodeGet.mockResolvedValueOnce({ data: { success: true, data: ME_RESPONSE } });

    const session = await api.getSessionFromCookie();

    expect(nodeGet).toHaveBeenCalledWith('/api/auth/me');
    expect(session?.token).toBe(JWT_FAKE);
    expect(mod.getToken()).toBe(JWT_FAKE);
  });

  it('devuelve null si /api/auth/me falla (cookie inválida/expirada)', async () => {
    nodeGet.mockRejectedValueOnce(new Error('Unauthorized'));

    const session = await api.getSessionFromCookie();

    expect(session).toBeNull();
    expect(mod.getToken()).toBeNull(); // sin token huérfano en memoria
  });
});
