/**
 * UNIT TESTS — Helpers nuevos en src/api/client.ts
 * Cubre: api.consulta, api.register, api.createDocumento, api.analizar,
 *        api.createOrg, api.acceptInvitation, api.getReporte
 *
 * Estrategia: mockear axios ANTES de importar el módulo. Capturar las llamadas
 * a nodeClient.post / dotnetClient.post y verificar rutas + payloads.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks de los clientes axios ────────────────────────────────────────────
const nodePost   = vi.fn();
const nodeGet    = vi.fn();
const dotnetPost = vi.fn();
const dotnetGet  = vi.fn();

vi.mock('axios', () => {
  // axios.create devuelve instancias con post/get. Cada instancia recuerda su
  // propio backend (NODE=3001 / DOTNET=5000), así nodeClient.post SIEMPRE va a
  // nodePost y dotnetClient.post SIEMPRE a dotnetPost (necesario para probar el
  // fallback precedentes/comparador que encadena dotnet → node).
  const makeInstance = (base) => ({
    post: (...args) => (base === 'DOTNET' ? dotnetPost(...args) : nodePost(...args)),
    get: (...args) => (base === 'DOTNET' ? dotnetGet(...args) : nodeGet(...args)),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    defaults: { headers: { common: {} } },
  });
  return {
    default: {
      create: (config) => {
        // Heurística de backend: la URL del cliente contiene 'dotnet' (Railway)
        // o el puerto local 5000 → DOTNET; todo lo demás (node, localhost:3001) → NODE.
        const url = (config?.baseURL || '').toLowerCase();
        const base = (url.includes('dotnet') || url.includes('5000')) ? 'DOTNET' : 'NODE';
        return makeInstance(base);
      },
      post: vi.fn(),
    },
  };
});

// Importar DESPUÉS de los mocks
let api;
let nodeClient, dotnetClient;
let CONSULTA_ROUTES;

beforeEach(async () => {
  nodePost.mockReset();
  nodeGet.mockReset();
  dotnetPost.mockReset();
  dotnetGet.mockReset();
  globalThis.__lastBase = 'NODE';

  // Reset module cache para re-evaluar el módulo y reconstruir clientes
  vi.resetModules();
  const mod = await import('../client.ts');
  api = mod.api;
  nodeClient = mod.nodeClient;
  dotnetClient = mod.dotnetClient;
  // Re-leer CONSULTA_ROUTES accediendo via api.consulta.toString() es frágil,
  // así que importamos la función y verificamos por sus efectos (spy sobre dotnetPost).
});

// ────────────────────────────────────────────────────────────────────────────
// CONSULTA_ROUTES — Cubre el routing interno del helper consulta()
// ────────────────────────────────────────────────────────────────────────────
describe('api.consulta — routing por tipo', () => {
  // Tipos con gemelo Node POST /api/ai/consulta (server/routes/ai.js).
  // Node acepta { prompt, tipo, disclaimerAceptado } y devuelve `resultado`.
  const NODE_CONSULTA_EXPECTATIONS = {
    redaccion:      'redaccion',
    predictor:      'predictor',
    alegato:        'alegatos',   // alias singular → tipo canónico Node
    alegatos:       'alegatos',
    interrogatorio: 'interrogatorio',
    analisis:       'analisis',
  };

  for (const [tipo, tipoNode] of Object.entries(NODE_CONSULTA_EXPECTATIONS)) {
    it(`tipo "${tipo}" → POST /api/ai/consulta en nodeClient (prompt + tipo + disclaimer)`, async () => {
      globalThis.__lastBase = 'NODE';
      nodePost.mockResolvedValueOnce({ data: { ok: true, tipo } });
      await api.consulta('prompt de prueba', tipo, { extra: 'dato' });

      expect(nodePost).toHaveBeenCalledTimes(1);
      const [url, payload, config] = nodePost.mock.calls[0];
      expect(url).toBe('/api/ai/consulta');
      expect(payload).toMatchObject({
        prompt: 'prompt de prueba',
        tipo: tipoNode,
        extra: 'dato',
        disclaimerAceptado: true,
      });
      expect(dotnetPost).not.toHaveBeenCalled();
      // IA puede tardar 40-80s; timeout extendido vs los 10s del cliente base
      expect(config?.timeout ?? 0).toBeGreaterThanOrEqual(60000);
    });
  }

  it('tipo "jurisprudencia" → GET /api/ai/jurisprudencia con params { q }', async () => {
    globalThis.__lastBase = 'NODE';
    nodeGet.mockResolvedValueOnce({ data: { resultados: [{ tribunal: 'TC', numero: '1234-2020' }] } });
    const result = await api.consulta('desalojo', 'jurisprudencia');

    expect(nodeGet).toHaveBeenCalledTimes(1);
    const [url, config] = nodeGet.mock.calls[0];
    expect(url).toBe('/api/ai/jurisprudencia');
    expect(config.params).toMatchObject({ q: 'desalojo' });
    expect(config?.timeout ?? 0).toBeGreaterThanOrEqual(60000);
    expect(dotnetPost).not.toHaveBeenCalled();
    expect(result.resultados).toHaveLength(1);
  });

  // Tipos SIN gemelo Node → dotnetClient (contrato CQRS, verificado en controllers)
  const DOTNET_EXPECTATIONS = {
    objecion:         '/api/objeciones/sugerir',
    simulacion:       '/api/simulacion/iniciar',
    precedentes:      '/api/juez/precedentes/comparar',
    comparador:       '/api/juez/precedentes/comparar',
  };

  for (const [tipo, expectedRoute] of Object.entries(DOTNET_EXPECTATIONS)) {
    it(`tipo "${tipo}" → POST ${expectedRoute} en dotnetClient`, async () => {
      globalThis.__lastBase = 'DOTNET';
      dotnetPost.mockResolvedValueOnce({ data: { ok: true, tipo } });
      await api.consulta('prompt de prueba', tipo, { extra: 'dato' });

      expect(dotnetPost).toHaveBeenCalledTimes(1);
      const [url, payload] = dotnetPost.mock.calls[0];
      expect(url).toBe(expectedRoute);
      expect(payload).toMatchObject({
        prompt: 'prompt de prueba',
        tipo,
        extra: 'dato',
      });
    });
  }

  it('tipo "comparador": si el .NET rechaza (400) degrada a Node /consulta tipo general', async () => {
    globalThis.__lastBase = 'DOTNET';
    dotnetPost.mockRejectedValueOnce(new Error('Request failed with status code 400'));
    nodePost.mockResolvedValueOnce({ data: { resultado: 'análisis de respaldo', tipo: 'general' } });

    const result = await api.consulta('Comparar casación A con B', 'comparador');

    expect(dotnetPost).toHaveBeenCalledTimes(1);
    expect(nodePost).toHaveBeenCalledTimes(1);
    const [url, payload, config] = nodePost.mock.calls[0];
    expect(url).toBe('/api/ai/consulta');
    expect(payload).toMatchObject({ prompt: 'Comparar casación A con B', tipo: 'general', disclaimerAceptado: true });
    expect(config?.timeout ?? 0).toBeGreaterThanOrEqual(60000);
    expect(result.resultado).toBe('análisis de respaldo');
  });

  // Tipos IA generales → Node POST /api/ai/chat (mensaje + disclaimerAceptado)
  const NODE_CHAT_TYPES = ['casos_criticos', 'general', 'chat', 'default'];

  for (const tipo of NODE_CHAT_TYPES) {
    it(`tipo "${tipo}" → POST /api/ai/chat en nodeClient (mensaje + disclaimer)`, async () => {
      globalThis.__lastBase = 'NODE';
      nodePost.mockResolvedValueOnce({ data: { ok: true, tipo } });
      await api.consulta('prompt de prueba', tipo, { extra: 'dato' });

      expect(nodePost).toHaveBeenCalledTimes(1);
      const [url, payload, config] = nodePost.mock.calls[0];
      expect(url).toBe('/api/ai/chat');
      expect(payload).toMatchObject({
        mensaje: 'prompt de prueba',
        extra: 'dato',
        disclaimerAceptado: true,
      });
      expect(payload.tipo).toBeDefined();
      // IA puede tardar 40-80s; timeout extendido vs los 10s del cliente base
      expect(config?.timeout ?? 0).toBeGreaterThanOrEqual(60000);
    });
  }

  it('alias casos-criticos (guion) mapea al mismo destino que casos_criticos', async () => {
    globalThis.__lastBase = 'NODE';
    nodePost.mockResolvedValueOnce({ data: { ok: true } });
    await api.consulta('hola', 'casos-criticos');

    expect(nodePost).toHaveBeenCalledTimes(1);
    expect(nodePost.mock.calls[0][0]).toBe('/api/ai/chat');
    expect(nodePost.mock.calls[0][1].mensaje).toBe('hola');
    expect(dotnetPost).not.toHaveBeenCalled();
  });

  it('tipo desconocido cae al fallback Node /api/ai/chat (NO a dotnetClient)', async () => {
    globalThis.__lastBase = 'NODE';
    nodePost.mockResolvedValueOnce({ data: { ok: true } });
    await api.consulta('hola', 'tipo_totalmente_inventado');

    expect(nodePost).toHaveBeenCalledTimes(1);
    expect(nodePost.mock.calls[0][0]).toBe('/api/ai/chat');
    expect(dotnetPost).not.toHaveBeenCalled();
  });

  it('mezcla prompt + tipo + extra en el payload .NET (extra puede sobrescribir prompt)', async () => {
    globalThis.__lastBase = 'DOTNET';
    dotnetPost.mockResolvedValueOnce({ data: {} });
    await api.consulta('ORIGINAL', 'objecion', { prompt: 'SOBRESCRITO', foo: 'bar' });

    const payload = dotnetPost.mock.calls[0][1];
    // extra va después, así que gana si redefine prompt
    expect(payload.prompt).toBe('SOBRESCRITO');
    expect(payload.foo).toBe('bar');
    expect(payload.tipo).toBe('objecion');
  });

  it('extra es opcional — default {} funciona en node chat', async () => {
    globalThis.__lastBase = 'NODE';
    nodePost.mockResolvedValueOnce({ data: {} });
    await api.consulta('hola', 'chat');
    expect(nodePost.mock.calls[0][1]).toMatchObject({
      mensaje: 'hola',
      disclaimerAceptado: true,
    });
  });

  it('devuelve la propiedad .data de la respuesta de axios', async () => {
    globalThis.__lastBase = 'NODE';
    nodePost.mockResolvedValueOnce({ data: { success: true, data: { foo: 1 } } });
    const result = await api.consulta('p', 'chat');
    expect(result).toEqual({ success: true, data: { foo: 1 } });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// register → /api/auth/register (Node)
// ────────────────────────────────────────────────────────────────────────────
describe('api.register', () => {
  it('envía POST /api/auth/register con el payload completo', async () => {
    nodePost.mockResolvedValueOnce({ data: { success: true, token: 'abc' } });
    const payload = {
      email: 'abogado@legalpro.pe',
      password: 'Secure123!',
      nombreCompleto: 'Dr. Test',
      rol: 'ABOGADO',
      aceptaTerminos: true,
    };
    await api.register(payload);

    expect(nodePost).toHaveBeenCalledTimes(1);
    expect(nodePost.mock.calls[0][0]).toBe('/api/auth/register');
    expect(nodePost.mock.calls[0][1]).toEqual(payload);
  });

  it('propaga errores del backend (reject)', async () => {
    nodePost.mockRejectedValueOnce(new Error('Email duplicado'));
    await expect(api.register({ email: 'dup@x.pe', password: 'X', nombreCompleto: 'X' }))
      .rejects.toThrow('Email duplicado');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// createDocumento → POST /api/documentos/upload con FormData (Node)
// ────────────────────────────────────────────────────────────────────────────
describe('api.createDocumento', () => {
  it('envía FormData vía POST /api/documentos/upload', async () => {
    nodePost.mockResolvedValueOnce({ data: { success: true, id: 'doc-123' } });
    const fd = new FormData();
    fd.append('file', new Blob(['x']), 'test.pdf');
    fd.append('expediente_id', 'exp-1');

    await api.createDocumento(fd);

    expect(nodePost).toHaveBeenCalledTimes(1);
    expect(nodePost.mock.calls[0][0]).toBe('/api/documentos/upload');
    // El segundo argumento debe ser la instancia de FormData
    expect(nodePost.mock.calls[0][1]).toBeInstanceOf(FormData);
  });

  it('no agrega headers extras — axios detecta FormData automáticamente', async () => {
    // El helper NO setea Content-Type manualmente; axios lo hace.
    // Verificamos que NO pasamos un 3er argumento (config con headers).
    nodePost.mockResolvedValueOnce({ data: {} });
    const fd = new FormData();
    await api.createDocumento(fd);

    // Llamada: post(url, formData) — sin 3er argumento
    expect(nodePost.mock.calls[0].length).toBe(2);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// analizar → POST /api/analista/analizar (dotnet)
// ────────────────────────────────────────────────────────────────────────────
describe('api.analizar', () => {
  it('envía POST /api/analista/analizar con { expedienteId }', async () => {
    globalThis.__lastBase = 'DOTNET';
    dotnetPost.mockResolvedValueOnce({ data: { success: true, analisis: 'ok' } });
    await api.analizar('exp-99');

    expect(dotnetPost).toHaveBeenCalledTimes(1);
    expect(dotnetPost.mock.calls[0][0]).toBe('/api/analista/analizar');
    expect(dotnetPost.mock.calls[0][1]).toEqual({ expedienteId: 'exp-99' });
  });

  it('pasa el id tal cual, sin transformar', async () => {
    globalThis.__lastBase = 'DOTNET';
    dotnetPost.mockResolvedValueOnce({ data: {} });
    const weirdId = 'UUID-COM-DASHES-Y-NUMS-12345';
    await api.analizar(weirdId);
    expect(dotnetPost.mock.calls[0][1].expedienteId).toBe(weirdId);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// createOrg → POST /api/organizaciones (Node)
// ────────────────────────────────────────────────────────────────────────────
describe('api.createOrg', () => {
  it('envía POST /api/organizaciones con { nombre, slug, plan, ... }', async () => {
    nodePost.mockResolvedValueOnce({ data: { success: true, id: 'org-1' } });
    await api.createOrg({
      nombre: 'Estudio Prueba',
      slug: 'estudio-prueba',
      plan: 'pro',
      max_usuarios: 10,
    });

    expect(nodePost).toHaveBeenCalledTimes(1);
    expect(nodePost.mock.calls[0][0]).toBe('/api/organizaciones');
    expect(nodePost.mock.calls[0][1]).toMatchObject({
      nombre: 'Estudio Prueba',
      slug: 'estudio-prueba',
      plan: 'pro',
      max_usuarios: 10,
    });
  });

  it('campos extra se preservan (no descarta claves desconocidas)', async () => {
    nodePost.mockResolvedValueOnce({ data: {} });
    await api.createOrg({
      nombre: 'X',
      slug: 'x',
      plan: 'free',
      metadata: { foo: 1 },
      custom_field: 'valor',
    });
    expect(nodePost.mock.calls[0][1].custom_field).toBe('valor');
    expect(nodePost.mock.calls[0][1].metadata).toEqual({ foo: 1 });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// acceptInvitation → POST /api/organizaciones/aceptar-invitacion (Node)
// ────────────────────────────────────────────────────────────────────────────
describe('api.acceptInvitation', () => {
  it('envía POST /api/organizaciones/aceptar-invitacion con { token }', async () => {
    nodePost.mockResolvedValueOnce({ data: { success: true, organizacion: { id: 'org-1' } } });
    await api.acceptInvitation('token-invitacion-abc');

    expect(nodePost).toHaveBeenCalledTimes(1);
    expect(nodePost.mock.calls[0][0]).toBe('/api/organizaciones/aceptar-invitacion');
    expect(nodePost.mock.calls[0][1]).toEqual({ token: 'token-invitacion-abc' });
  });

  it('token vacío todavía se envía (la validación es server-side)', async () => {
    nodePost.mockResolvedValueOnce({ data: { success: false } });
    await api.acceptInvitation('');
    expect(nodePost.mock.calls[0][1]).toEqual({ token: '' });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// getReporte → GET /api/expedientes/:id/reporte (JSON y blob para pdf/docx)
// ────────────────────────────────────────────────────────────────────────────
describe('api.getReporte', () => {
  it('sin expedienteId devuelve el fallback legacy (no hace HTTP)', async () => {
    // ReporteRetroalimentacion.jsx llama api.getReporte?.() sin argumento.
    const result = await api.getReporte('');

    expect(nodeGet).not.toHaveBeenCalled();
    expect(result).toEqual({ mensaje: 'Funcionalidad en desarrollo', data: [] });
  });

  it('formato json → GET /api/expedientes/:id/reporte con params { formato }', async () => {
    const dataFake = { expediente: { id: 'exp-1' }, generadoEn: '2026-08-07T00:00:00Z' };
    nodeGet.mockResolvedValueOnce({ data: dataFake });

    const result = await api.getReporte('exp-1', 'json');

    expect(nodeGet).toHaveBeenCalledTimes(1);
    const [url, config] = nodeGet.mock.calls[0];
    expect(url).toBe('/api/expedientes/exp-1/reporte');
    expect(config.params).toEqual({ formato: 'json' });
    expect(config.responseType).toBeUndefined();
    expect(result).toEqual(dataFake);
  });

  it('formato pdf → GET con responseType blob (para descarga)', async () => {
    const blobFake = new Blob(['%PDF-1.4 mock']);
    nodeGet.mockResolvedValueOnce({ data: blobFake });

    const result = await api.getReporte('exp-2', 'pdf');

    expect(nodeGet).toHaveBeenCalledTimes(1);
    const [url, config] = nodeGet.mock.calls[0];
    expect(url).toBe('/api/expedientes/exp-2/reporte');
    expect(config.params).toEqual({ formato: 'pdf' });
    expect(config.responseType).toBe('blob');
    expect(result).toBe(blobFake);
  });

  it('formato docx → GET con responseType blob', async () => {
    const blobFake = new Blob(['docx-mock']);
    nodeGet.mockResolvedValueOnce({ data: blobFake });

    await api.getReporte('exp-3', 'docx');

    const [url, config] = nodeGet.mock.calls[0];
    expect(url).toBe('/api/expedientes/exp-3/reporte');
    expect(config.params).toEqual({ formato: 'docx' });
    expect(config.responseType).toBe('blob');
  });

  it('formato por defecto es json', async () => {
    nodeGet.mockResolvedValueOnce({ data: {} });

    await api.getReporte('exp-4');

    const [, config] = nodeGet.mock.calls[0];
    expect(config.params).toEqual({ formato: 'json' });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Sanity: el objeto api expone todos los helpers esperados
// ────────────────────────────────────────────────────────────────────────────
describe('api — shape', () => {
  it('expone los 7 helpers nuevos en el objeto api', () => {
    expect(typeof api.consulta).toBe('function');
    expect(typeof api.register).toBe('function');
    expect(typeof api.createDocumento).toBe('function');
    expect(typeof api.analizar).toBe('function');
    expect(typeof api.createOrg).toBe('function');
    expect(typeof api.acceptInvitation).toBe('function');
    expect(typeof api.getReporte).toBe('function');
  });

  it('también expone nodeClient y dotnetClient', () => {
    expect(api.nodeClient).toBeDefined();
    expect(api.dotnetClient).toBeDefined();
    expect(typeof api.nodeClient.post).toBe('function');
    expect(typeof api.dotnetClient.post).toBe('function');
  });
});