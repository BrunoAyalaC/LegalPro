/**
 * TESTS DE INTEGRACIÓN — PANEL DE EXPERTOS Y CONSOLIDADOR MASTER (FASE 6)
 * Valida los endpoints POST /api/ai/panel-expertos y POST /api/ai/panel-expertos/stream.
 * Mocks de Base de Datos, Redis Cache y MiniMaxAI.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Definir JWT_SECRET con longitud adecuada para evitar errores de validación de 32 bytes
process.env.JWT_SECRET = 'test-secret-key-12345-very-long-secret-key-for-test-32-chars';

// ── Mock db (pg Pool)
vi.mock('../db.js', () => {
  const queryMock = vi.fn().mockImplementation((text, params) => {
    if (typeof text === 'string') {
      if (text.includes('information_schema.tables')) {
        return Promise.resolve({ rows: [{ n: '1' }], rowCount: 1 });
      }
      if (text.includes('creditos_disponibles') && text.includes('organizaciones')) {
        return Promise.resolve({ rows: [{ creditos_disponibles: 100 }], rowCount: 1 });
      }
      if (text.includes('plan') && text.includes('organizaciones')) {
        return Promise.resolve({ rows: [{ plan: 'pro' }], rowCount: 1 });
      }
      if (text.includes('consumo_tokens_ia')) {
        return Promise.resolve({ rows: [{ costo_total_usd: '0.00000000' }], rowCount: 1 });
      }
      // requireTransferenciaInternacional consulta la tabla usuarios para
      // verificar consentimiento LPDP Art. 21. Devolvemos flag_a=true para
      // que el guard deje pasar la request.
      if (text.includes('FROM usuarios') && text.includes('acepta_transferencia_internacional')) {
        return Promise.resolve({
          rows: [{ flag_a: true, flag_b: true }],
          rowCount: 1,
        });
      }
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
  
  const clientMock = {
    query: queryMock,
    release: vi.fn(),
  };
  const connectMock = vi.fn().mockResolvedValue(clientMock);

  return {
    default: {
      query: queryMock,
      connect: connectMock,
      on: vi.fn(),
    },
    // FIX R-01: las rutas usan `tenantQuery` además de `db.query`,
    // apuntamos tenantQuery al mismo queryMock para que los tests existentes
    // sigan mockeando via mockImplementation.
    tenantQuery: queryMock,
    tenantContext: { getStore: () => undefined, run: (_ctx, fn) => fn() },
  };
});

// ── Mock cache.js
vi.mock('../cache.js', () => {
  const store = new Map();
  return {
    hashKey: vi.fn((prefix, ...parts) => `${prefix}:${parts.join('::').slice(0, 16)}`),
    get: vi.fn(async (key) => store.get(key) || null),
    set: vi.fn(async (key, value) => {
      store.set(key, value);
    }),
    del: vi.fn(async (key) => {
      store.delete(key);
    }),
    isAvailable: vi.fn(() => true),
  };
});

// ── Mock MiniMaxAI
const generateContentMock = vi.fn();
const generateContentStreamMock = vi.fn();

vi.mock('../utils/minimaxClient.js', () => {
  return {
    MiniMaxAI: vi.fn().mockImplementation(function () {
      return {
        models: {
          generateContent: generateContentMock,
          generateContentStream: generateContentStreamMock,
        },
      };
    }),
    FunctionCallingConfigMode: {
      ANY: 'ANY',
      AUTO: 'AUTO',
      NONE: 'NONE',
    },
  };
});

let app;
let token;

beforeAll(async () => {
  // Importar la app de Express después de definir los mocks
  const mod = await import('../../server/index.js');
  app = mod.default;
});

beforeEach(() => {
  vi.clearAllMocks();

  // Generar un JWT válido de ABOGADO para las peticiones de test
  token = jwt.sign(
    { sub: 'user-123', email: 'abogado@legalpro.pe', rol: 'ABOGADO', organization_id: 'org-abc' },
    process.env.JWT_SECRET,
    { issuer: 'LegalProAPI', audience: 'LegalProClients', expiresIn: '1h' }
  );
});

describe('POST /api/ai/panel-expertos (Híbrido - Autodetectado)', () => {
  it('debe denegar acceso si no se acepta el disclaimer de IA', async () => {
    const res = await request(app)
      .post('/api/ai/panel-expertos')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'Consulta sobre despido arbitrario y daños' });
    
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('disclaimer');
  });

  it('debe procesar exitosamente detectando especialidades de forma híbrida', async () => {
    // 1. Mock de Enrutamiento (primera llamada)
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({ especialidades: ['laboral', 'civil'] }),
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 }
    });

    // 2. Mocks de Especialista Laboral, Especialista Civil y Consolidador
    generateContentMock
      .mockResolvedValueOnce({
        text: 'Análisis laboral detallado sobre el despido arbitrario.',
        usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 }
      })
      .mockResolvedValueOnce({
        text: 'Análisis civil sobre daños y perjuicios derivados.',
        usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 }
      })
      .mockResolvedValueOnce({
        text: '# Diagnóstico Unificado de Expertos\n\n1. Resumen...',
        usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 30, totalTokenCount: 80 }
      });

    const res = await request(app)
      .post('/api/ai/panel-expertos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt: 'Consulta sobre despido arbitrario y daños',
        disclaimerAceptado: true
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('especialidades');
    expect(res.body.especialidades).toContain('laboral');
    expect(res.body.especialidades).toContain('civil');
    expect(res.body).toHaveProperty('diagnostico');
    expect(res.body.diagnostico).toContain('Diagnóstico Unificado');
    expect(res.body.especialistas_detalles).toHaveLength(2);
  });

  it('debe usar especialidades manuales si vienen en el body', async () => {
    // Cuando vienen manuales, no se llama a enrutarConsulta.
    // Solo se llama para los dos especialistas (penal) y el consolidador
    generateContentMock
      .mockResolvedValueOnce({
        text: 'Análisis penal sobre estafa.',
        usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 }
      })
      .mockResolvedValueOnce({
        text: '# Diagnóstico Unificado Penal...',
        usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 30, totalTokenCount: 80 }
      });

    const res = await request(app)
      .post('/api/ai/panel-expertos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt: 'Denuncia por estafa contra gerente',
        especialistas: ['penal'],
        disclaimerAceptado: true
      });

    expect(res.status).toBe(200);
    expect(res.body.especialidades).toEqual(['penal']);
    expect(res.body.especialistas_detalles[0].especialista).toBe('penal');
  });

  it('debe hacer fallback de especialista si este excede los 3.5 segundos de timeout', async () => {
    // Mock de enrutamiento
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({ especialidades: ['penal'] }),
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 }
    });

    // Simulamos un retraso de 4 segundos para el especialista penal
    generateContentMock.mockImplementationOnce(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            text: 'Respuesta lenta de Penal.',
            usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 }
          });
        }, 4000);
      });
    });

    // Mock de consolidación (recibe el fallback)
    generateContentMock.mockResolvedValueOnce({
      text: '# Consolidación con Fallback',
      usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 20, totalTokenCount: 60 }
    });

    const res = await request(app)
      .post('/api/ai/panel-expertos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt: 'Caso penal complejo',
        disclaimerAceptado: true
      });

    expect(res.status).toBe(200);
    expect(res.body.especialidades).toContain('penal');
    expect(res.body.especialistas_detalles[0].timeout).toBe(true);
    expect(res.body.especialistas_detalles[0].analisis).toContain('Análisis Penal Preliminar');
    expect(res.body.diagnostico).toContain('Consolidación con Fallback');
  });
});

describe('POST /api/ai/panel-expertos/stream (SSE)', () => {
  it('debe transmitir estados y contenido mediante SSE', async () => {
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({ especialidades: ['laboral'] }),
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 }
    });

    generateContentMock.mockResolvedValueOnce({
      text: 'Análisis laboral de prueba.',
      usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 }
    });

    // Mock del streaming de consolidación
    const dummyChunks = [
      { text: '# Diagnóstico ', usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 2 } },
      { text: 'Unificado Streaming', usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 5, totalTokenCount: 35 } }
    ];

    generateContentStreamMock.mockResolvedValue(dummyChunks);

    const res = await request(app)
      .post('/api/ai/panel-expertos/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt: 'Consulta de despido',
        disclaimerAceptado: true
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    
    // Validar formato del cuerpo SSE
    const bodyText = res.text;
    expect(bodyText).toContain('enrutando');
    expect(bodyText).toContain('enrutado');
    expect(bodyText).toContain('analizando');
    expect(bodyText).toContain('analizando_especialista');
    expect(bodyText).toContain('especialista_completado');
    expect(bodyText).toContain('analistas_completados');
    expect(bodyText).toContain('consolidando');
    expect(bodyText).toContain('chunk');
    expect(bodyText).toContain('done');
  });
});
