/**
 * TESTS DE INTEGRACIÓN — CARGA Y OCR DE DOCUMENTOS (FASE 6)
 * Valida el endpoint POST /api/documentos/upload.
 * Mocks de Base de Datos y MiniMaxAI.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Definir JWT_SECRET con longitud adecuada para evitar errores de validación de 32 bytes
process.env.JWT_SECRET = 'test-secret-key-12345-very-long-secret-key-for-test-32-chars';

// Variables para controlar créditos disponibles en los tests
let mockCreditosDisponibles = 100;
let mockExpedienteExiste = true;

// ── Mock db (pg Pool)
vi.mock('../db.js', () => {
  const queryMock = vi.fn().mockImplementation((text, params) => {
    if (typeof text === 'string') {
      if (text.includes('information_schema.tables')) {
        return Promise.resolve({ rows: [{ n: '1' }], rowCount: 1 });
      }
      // Simular verificarCreditos (SELECT creditos_disponibles FROM organizaciones)
      if (text.includes('creditos_disponibles') && text.includes('SELECT') && text.includes('organizaciones')) {
        return Promise.resolve({ rows: [{ creditos_disponibles: mockCreditosDisponibles }], rowCount: 1 });
      }
      // Simular verificar expediente
      if (text.includes('FROM expedientes') && text.includes('SELECT')) {
        if (mockExpedienteExiste) {
          return Promise.resolve({ rows: [{ id: params[0] }], rowCount: 1 });
        } else {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
      }
      // Simular UPDATE expedientes SET texto_ocr
      if (text.includes('UPDATE expedientes')) {
        return Promise.resolve({ rows: [], rowCount: 1 });
      }
      // Simular INSERT INTO documentos
      if (text.includes('INSERT INTO documentos')) {
        return Promise.resolve({
          rows: [{
            id: 'doc-456',
            expediente_id: params[0],
            usuario_id: params[1],
            organization_id: params[2],
            nombre: params[3],
            tipo_documento: params[4],
            descripcion: params[5],
            archivo_url: params[6],
            archivo_nombre: params[7],
            archivo_tipo: params[8],
            archivo_tamano: params[9],
            hash_sha256: params[10]
          }],
          rowCount: 1
        });
      }
      // Simular transacciones de créditos e inserción de consumo
      if (text.includes('INSERT INTO transacciones_creditos')) {
        return Promise.resolve({ rows: [], rowCount: 1 });
      }
      if (text.includes('INSERT INTO consumo_tokens_ia')) {
        return Promise.resolve({ rows: [], rowCount: 1 });
      }
      if (text.includes('UPDATE organizaciones')) {
        return Promise.resolve({ rows: [], rowCount: 1 });
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
    // que mockean via mockImplementation / mockResolvedValueOnce sigan funcionando.
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

vi.mock('../utils/minimaxClient.js', () => {
  return {
    MiniMaxAI: vi.fn().mockImplementation(function () {
      return {
        models: {
          generateContent: generateContentMock,
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
  const mod = await import('../../server/index.js');
  app = mod.default;
});

beforeEach(() => {
  vi.clearAllMocks();
  mockCreditosDisponibles = 100;
  mockExpedienteExiste = true;

  token = jwt.sign(
    { sub: 'user-123', email: 'abogado@legalpro.pe', rol: 'ABOGADO', organization_id: 'org-abc' },
    process.env.JWT_SECRET,
    { issuer: 'LegalProAPI', audience: 'LegalProClients', expiresIn: '1h' }
  );
});

describe('POST /api/documentos/upload (OCR Multimodal & Registro)', () => {
  it('debe denegar acceso si no se proporciona token de autorización', async () => {
    const res = await request(app)
      .post('/api/documentos/upload')
      .attach('file', Buffer.from('contenido-pdf-dummy'), 'test.pdf')
      .field('expediente_id', 'exp-123');

    expect(res.status).toBe(401);
  });

  it('debe retornar 402 si la organización no tiene suficientes créditos (< 2)', async () => {
    mockCreditosDisponibles = 1; // Insuficientes créditos para OCR

    const res = await request(app)
      .post('/api/documentos/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('contenido-pdf-dummy'), 'test.pdf')
      .field('expediente_id', 'exp-123');

    expect(res.status).toBe(402);
    expect(res.body.error).toContain('Créditos insuficientes');
    expect(res.body.code).toBe('INSUFFICIENT_CREDITS');
  });

  it('debe retornar 400 si no se adjunta ningún archivo', async () => {
    const res = await request(app)
      .post('/api/documentos/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('expediente_id', 'exp-123');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('El archivo es obligatorio');
  });

  it('debe retornar 400 si no se especifica el expediente_id', async () => {
    const res = await request(app)
      .post('/api/documentos/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('contenido-pdf-dummy'), 'test.pdf');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('expediente_id es obligatorio');
  });

  it('debe retornar 404 si el expediente no existe o no pertenece a la organización', async () => {
    mockExpedienteExiste = false;

    const res = await request(app)
      .post('/api/documentos/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('contenido-pdf-dummy'), 'test.pdf')
      .field('expediente_id', 'exp-non-existent');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Expediente no encontrado');
  });

  it('debe realizar OCR y registrar el documento exitosamente debitando créditos', async () => {
    // Mock de la llamada a MiniMax para realizar OCR
    generateContentMock.mockResolvedValueOnce({
      text: 'Texto extraído mediante OCR del documento legal.',
      usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 10, totalTokenCount: 25 }
    });

    const res = await request(app)
      .post('/api/documentos/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('Contenido del escrito judicial a procesar'), 'escrito_demanda.pdf')
      .field('expediente_id', 'expediente-123')
      .field('descripcion', 'Escrito de demanda civil');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mensaje).toContain('procesado con OCR');
    expect(res.body.textoOcr).toBe('Texto extraído mediante OCR del documento legal.');
    expect(res.body.documento).toBeDefined();
    expect(res.body.documento.nombre).toBe('escrito_demanda.pdf');
    expect(res.body.documento.hash_sha256).toBeDefined();
    expect(res.body.documento.archivo_tamano).toBeGreaterThan(0);
  });
});
