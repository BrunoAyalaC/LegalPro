/**
 * TESTS DE INTEGRACIÓN — EXPORTACIÓN DE DOCUMENTOS LEGALES (POST /api/documentos/exportar)
 *
 * Valida el endpoint POST /api/documentos/exportar:
 *   - Autenticación y autorización (RBAC multi-tenant)
 *   - Validación Zod de entrada
 *   - Generación de DOCX y PDF
 *   - Headers de respuesta (Content-Type, Content-Disposition, Cache-Control)
 *
 * Mocks: db (para startup), cache, logger, servicio de exportación.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ── Configuración de entorno ──────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-secret-key-12345-very-long-secret-key-for-test-32-chars';
process.env.MINIMAX_API_KEY = 'fake-minimax-key-for-test';

// ── Mock db (pg Pool) — necesaria para init del servidor ──────────────────────
vi.mock('../db.js', () => {
  const queryMock = vi.fn().mockImplementation((text) => {
    if (typeof text === 'string' && text.includes('information_schema.tables')) {
      return Promise.resolve({ rows: [{ n: '1' }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });

  return {
    default: {
      query: queryMock,
      connect: vi.fn().mockResolvedValue({ query: queryMock, release: vi.fn() }),
      on: vi.fn(),
    },
    // FIX R-01: las rutas usan `tenantQuery` además de `db.query`,
    // apuntamos tenantQuery al mismo queryMock para que los tests existentes
    // sigan mockeando via mockImplementation.
    tenantQuery: queryMock,
    tenantContext: { getStore: () => undefined, run: (_ctx, fn) => fn() },
  };
});

// ── Mock cache.js ─────────────────────────────────────────────────────────────
vi.mock('../cache.js', () => {
  const store = new Map();
  return {
    hashKey: vi.fn((prefix, ...parts) => `${prefix}:${parts.join('::').slice(0, 16)}`),
    get: vi.fn(async (key) => store.get(key) || null),
    set: vi.fn(async (key, value) => { store.set(key, value); }),
    del: vi.fn(async (key) => { store.delete(key); }),
    isAvailable: vi.fn(() => true),
  };
});

// ── Mock logger ───────────────────────────────────────────────────────────────
vi.mock('../logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  httpLogger: (_req, _res, next) => next(),
}));

// ── Mock del servicio de exportación ──────────────────────────────────────────
// Así evitamos depender de Puppeteer y docx en los tests.
const mockGenerarDocx = vi.fn();
const mockGenerarPdf = vi.fn();
const mockGenerarNombreArchivo = vi.fn();

vi.mock('../services/documentoExportador.js', () => ({
  generarDocx: mockGenerarDocx,
  generarPdf: mockGenerarPdf,
  generarNombreArchivo: mockGenerarNombreArchivo,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DOCUMENTO_VALIDO = {
  tipo: 'demanda',
  juzgado: 'Juzgado Civil de Lima',
  numeroExpediente: '12345-2026',
  sumilla: 'Solicito indemnización por despido arbitrario',
  contenido: 'El recurrente ha laborado para la empresa demandada por espacio de 10 años, siendo despedido de manera arbitraria el día 15 de enero de 2026, sin mediar causa justa establecida en el artículo 22 de la LPCL.\n\nDurante la relación laboral, el demandante cumplió con sus obligaciones de manera eficiente y puntual, no registrando llamada de atención ni sanción disciplinaria alguna.\n\nEn consecuencia, la demandada debe ser condenada al pago de la indemnización por despido arbitrario establecida en el artículo 38 de la LPCL, equivalente a 1.5 remuneraciones por año de servicios.',
  recurrente: 'Juan Pérez',
  abogado: 'Dr. Carlos López',
  formato: 'docx',
};

const DOCUMENTO_PDF = {
  ...DOCUMENTO_VALIDO,
  formato: 'pdf',
};

let app;
let tokenAbogado;
let tokenViewer;

beforeAll(async () => {
  const mod = await import('../../server/index.js');
  app = mod.default;
});

beforeEach(() => {
  vi.clearAllMocks();

  // Token para usuario con rol MEMBER (puede exportar)
  tokenAbogado = jwt.sign(
    {
      sub: 'user-123',
      email: 'abogado@legalpro.pe',
      rol: 'ABOGADO',
      rol_org: 'MEMBER',
      organization_id: 'org-abc',
    },
    process.env.JWT_SECRET,
    { issuer: 'LegalProAPI', audience: 'LegalProClients', expiresIn: '1h' }
  );

  // Token para usuario VIEWER (no puede exportar)
  tokenViewer = jwt.sign(
    {
      sub: 'user-456',
      email: 'viewer@legalpro.pe',
      rol: 'ABOGADO',
      rol_org: 'VIEWER',
      organization_id: 'org-abc',
    },
    process.env.JWT_SECRET,
    { issuer: 'LegalProAPI', audience: 'LegalProClients', expiresIn: '1h' }
  );

  // Mock por defecto: generarNombreArchivo devuelve un nombre simbólico
  mockGenerarNombreArchivo.mockImplementation((_params, formato) => `LEXIA_demanda_12345-2026_juan_perez.${formato}`);

  // Mock por defecto: generarDocx devuelve un buffer mínimo
  mockGenerarDocx.mockResolvedValue(Buffer.from('mock-docx-content'));
  // Mock por defecto: generarPdf devuelve un buffer mínimo
  mockGenerarPdf.mockResolvedValue(Buffer.from('%PDF-1.4 mock pdf content'));
});

// ── Tests de Autenticación y Autorización ────────────────────────────────────

describe('POST /api/documentos/exportar — Auth & RBAC', () => {
  it('debe retornar 401 si no se envía token de autenticación', async () => {
    const res = await request(app)
      .post('/api/documentos/exportar')
      .send(DOCUMENTO_VALIDO);

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Token');
  });

  it('debe retornar 401 si el token es inválido', async () => {
    const res = await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', 'Bearer token-invalido')
      .send(DOCUMENTO_VALIDO);

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('inválido');
  });

  it('debe retornar 403 si el JWT no tiene organization_id (tenant)', async () => {
    const tokenSinOrg = jwt.sign(
      { sub: 'user-123', email: 'test@test.com', rol: 'ABOGADO' },
      process.env.JWT_SECRET,
      { issuer: 'LegalProAPI', audience: 'LegalProClients', expiresIn: '1h' }
    );

    const res = await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenSinOrg}`)
      .send(DOCUMENTO_VALIDO);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('organización');
  });

  it('debe retornar 403 si el rol de organización es VIEWER (insuficiente)', async () => {
    const res = await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenViewer}`)
      .send(DOCUMENTO_VALIDO);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Permisos insuficientes');
  });

  it('debe permitir la exportación a usuarios con rol MEMBER', async () => {
    mockGenerarDocx.mockResolvedValue(Buffer.from('docx-legal-content'));

    const res = await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenAbogado}`)
      .send(DOCUMENTO_VALIDO);

    expect(res.status).toBe(200);
  });

  it('debe permitir la exportación a usuarios con rol ADMIN', async () => {
    const tokenAdmin = jwt.sign(
      { sub: 'user-789', email: 'admin@legalpro.pe', rol: 'ADMIN', rol_org: 'ADMIN', organization_id: 'org-abc' },
      process.env.JWT_SECRET,
      { issuer: 'LegalProAPI', audience: 'LegalProClients', expiresIn: '1h' }
    );
    mockGenerarDocx.mockResolvedValue(Buffer.from('docx-admin-content'));

    const res = await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(DOCUMENTO_VALIDO);

    expect(res.status).toBe(200);
  });

  it('debe permitir la exportación a usuarios con rol OWNER', async () => {
    const tokenOwner = jwt.sign(
      { sub: 'user-000', email: 'owner@legalpro.pe', rol: 'OWNER', rol_org: 'OWNER', organization_id: 'org-abc' },
      process.env.JWT_SECRET,
      { issuer: 'LegalProAPI', audience: 'LegalProClients', expiresIn: '1h' }
    );
    mockGenerarDocx.mockResolvedValue(Buffer.from('docx-owner-content'));

    const res = await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send(DOCUMENTO_VALIDO);

    expect(res.status).toBe(200);
  });
});

// ── Tests de Validación de Entrada ────────────────────────────────────────────

describe('POST /api/documentos/exportar — Validación Zod', () => {
  it('debe retornar 400 si falta el campo "tipo"', async () => {
    const { tipo, ...sinTipo } = DOCUMENTO_VALIDO;
    const res = await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenAbogado}`)
      .send(sinTipo);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('inválidos');
  });

  it('debe retornar 400 si "tipo" no es un valor válido', async () => {
    const res = await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenAbogado}`)
      .send({ ...DOCUMENTO_VALIDO, tipo: 'tipo_inventado' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('inválidos');
  });

  it('debe retornar 400 si "juzgado" es muy corto', async () => {
    const res = await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenAbogado}`)
      .send({ ...DOCUMENTO_VALIDO, juzgado: 'Jz' });

    expect(res.status).toBe(400);
  });

  it('debe retornar 400 si falta la "sumilla"', async () => {
    const { sumilla, ...sinSumilla } = DOCUMENTO_VALIDO;
    const res = await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenAbogado}`)
      .send(sinSumilla);

    expect(res.status).toBe(400);
  });

  it('debe retornar 400 si "contenido" es muy corto', async () => {
    const res = await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenAbogado}`)
      .send({ ...DOCUMENTO_VALIDO, contenido: 'corto' });

    expect(res.status).toBe(400);
  });

  it('debe retornar 400 si "formato" no es docx o pdf', async () => {
    const res = await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenAbogado}`)
      .send({ ...DOCUMENTO_VALIDO, formato: 'html' });

    expect(res.status).toBe(400);
  });

  it('debe retornar 400 si se envían campos extra no permitidos (strict)', async () => {
    const res = await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenAbogado}`)
      .send({ ...DOCUMENTO_VALIDO, campoExtra: 'no-permitido' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('inválidos');
  });

  it('debe aceptar campos opcionales colegiatura y organizacion', async () => {
    mockGenerarDocx.mockResolvedValue(Buffer.from('docx-with-optional-fields'));

    const res = await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenAbogado}`)
      .send({
        ...DOCUMENTO_VALIDO,
        colegiatura: '12345',
        organizacion: 'Estudio Jurídico Pérez & Asociados',
      });

    expect(res.status).toBe(200);
  });
});

// ── Tests de Exportación DOCX ─────────────────────────────────────────────────

describe('POST /api/documentos/exportar — Exportación DOCX', () => {
  it('debe generar un archivo DOCX con Content-Type correcto', async () => {
    const mockBuffer = Buffer.from('docx-legal-content');
    mockGenerarDocx.mockResolvedValue(mockBuffer);
    mockGenerarNombreArchivo.mockReturnValue('LEXIA_demanda_12345-2026_juan_perez.docx');

    const res = await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenAbogado}`)
      .send(DOCUMENTO_VALIDO);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('.docx');
    expect(res.headers['content-length']).toBe(String(mockBuffer.length));
    expect(res.headers['cache-control']).toContain('no-cache');
  });

  it('debe retornar el contenido binario del DOCX', async () => {
    const mockBuffer = Buffer.from('contenido-word-binario');
    mockGenerarDocx.mockResolvedValue(mockBuffer);

    const res = await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenAbogado}`)
      .send(DOCUMENTO_VALIDO);

    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    // El body debe tener la longitud del buffer
    expect(res.text.length).toBe(mockBuffer.length);
  });

  it('debe llamar a generarDocx con los parámetros correctos', async () => {
    mockGenerarDocx.mockResolvedValue(Buffer.from('test'));

    await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenAbogado}`)
      .send(DOCUMENTO_VALIDO);

    expect(mockGenerarDocx).toHaveBeenCalledTimes(1);
    expect(mockGenerarDocx).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'demanda',
        juzgado: 'Juzgado Civil de Lima',
        numeroExpediente: '12345-2026',
        recurrente: 'Juan Pérez',
        abogado: 'Dr. Carlos López',
      })
    );
  });

  it('debe llamar a generarNombreArchivo con los parámetros correctos', async () => {
    mockGenerarDocx.mockResolvedValue(Buffer.from('test'));

    await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenAbogado}`)
      .send(DOCUMENTO_VALIDO);

    expect(mockGenerarNombreArchivo).toHaveBeenCalledTimes(1);
    expect(mockGenerarNombreArchivo).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'demanda', numeroExpediente: '12345-2026', recurrente: 'Juan Pérez' }),
      'docx'
    );
  });
});

// ── Tests de Exportación PDF ──────────────────────────────────────────────────

describe('POST /api/documentos/exportar — Exportación PDF', () => {
  it('debe generar un archivo PDF con Content-Type correcto', async () => {
    const mockBuffer = Buffer.from('%PDF-1.4 mock pdf content');
    mockGenerarPdf.mockResolvedValue(mockBuffer);
    mockGenerarNombreArchivo.mockReturnValue('LEXIA_demanda_12345-2026_juan_perez.pdf');

    const res = await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenAbogado}`)
      .send(DOCUMENTO_PDF);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('.pdf');
    expect(res.headers['content-length']).toBe(String(mockBuffer.length));
  });

  it('debe llamar a generarPdf cuando el formato es pdf', async () => {
    mockGenerarPdf.mockResolvedValue(Buffer.from('pdf-content'));

    await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenAbogado}`)
      .send(DOCUMENTO_PDF);

    expect(mockGenerarPdf).toHaveBeenCalledTimes(1);
    expect(mockGenerarDocx).not.toHaveBeenCalled();
  });
});

// ── Tests de Manejo de Errores ────────────────────────────────────────────────

describe('POST /api/documentos/exportar — Manejo de errores', () => {
  it('debe retornar 500 si el servicio de generación falla', async () => {
    mockGenerarDocx.mockRejectedValue(new Error('Error interno en el servicio de generación'));

    const res = await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenAbogado}`)
      .send(DOCUMENTO_VALIDO);

    expect(res.status).toBe(500);
  });

  it('debe retornar 500 si Chromium no está disponible (Puppeteer)', async () => {
    mockGenerarPdf.mockRejectedValue(new Error('Could not find Chromium (rv. 120.0.0)'));

    const res = await request(app)
      .post('/api/documentos/exportar')
      .set('Authorization', `Bearer ${tokenAbogado}`)
      .send(DOCUMENTO_PDF);

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('servicio de generación de PDF');
    expect(res.body.code).toBe('PDF_SERVICE_UNAVAILABLE');
  });
});

// ── Tests de Integración Real del Servicio (opcionales) ──────────────────────
// Estos tests se ejecutan solo si INTEGRATION_TEST=true, ya que requieren
// las dependencias reales (docx, puppeteer) y no los mocks.

describe('documentoExportador — generarDocx (integración real)', () => {
  it('debe generar un buffer DOCX válido con formato legal peruano', async () => {
    // Skip a menos que se ejecute explícitamente con INTEGRATION_TEST=true
    if (!process.env.INTEGRATION_TEST) {
      return;
    }

    // Obtener la implementación real ignorando el mock
    const docxModule = await vi.importActual('../services/documentoExportador.js');

    const buffer = await docxModule.generarDocx({
      tipo: 'demanda',
      juzgado: 'Juzgado Civil de Lima',
      numeroExpediente: 'TEST-001-2026',
      sumilla: 'Prueba de integración del generador DOCX',
      contenido: 'Contenido de prueba para verificar el formato del documento.',
      recurrente: 'Test Recurrente',
      abogado: 'Dr. Test Abogado',
      colegiatura: '99999',
      organizacion: 'Estudio Jurídico Test',
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000); // DOCX mínimo > 1KB

    // Verificar signature PK (ZIP header — los DOCX son ZIP)
    expect(buffer.toString('utf-8', 0, 2)).toBe('PK');
  });
});

describe('documentoExportador — generarNombreArchivo (real)', () => {
  it('debe generar nombres de archivo consistentes', async () => {
    // Obtener la implementación real ignorando el mock
    const docxModule = await vi.importActual('../services/documentoExportador.js');

    const params = {
      tipo: 'demanda',
      numeroExpediente: '12345-2026',
      recurrente: 'Juan Pérez López',
    };

    const nombreDocx = docxModule.generarNombreArchivo(params, 'docx');
    const nombrePdf = docxModule.generarNombreArchivo(params, 'pdf');

    expect(nombreDocx).toMatch(/\.docx$/);
    expect(nombrePdf).toMatch(/\.pdf$/);
    expect(nombreDocx).toContain('LEXIA');
    expect(nombrePdf).toContain('LEXIA');
    expect(nombreDocx).toContain('demanda');
    expect(nombrePdf).toContain('demanda');
  });
});
