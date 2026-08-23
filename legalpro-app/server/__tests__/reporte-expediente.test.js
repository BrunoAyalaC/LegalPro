/**
 * TESTS DE INTEGRACIÓN — REPORTE CONSOLIDADO DEL EXPEDIENTE
 * (GET /api/expedientes/:id/reporte?formato=json|pdf|docx)
 *
 * Feature RICE @auditor-performance: exportación consolidada del caso
 * (JSON/PDF/DOCX) para que el abogado lo entregue a cliente/socio.
 *
 * Valida:
 *   - Autenticación y RBAC (VIEWER no puede exportar PII)
 *   - formato inválido → 400
 *   - Shape del reporte JSON { expediente, documentos, evidencia,
 *     notificaciones, historialIA, plazos, generadoEn }
 *   - Exportación PDF/DOCX con Content-Type / Content-Disposition
 *   - 404 del handler si construirReporte devuelve null (caso inexistente)
 *   - Manejo de error Puppeteer (PDF_SERVICE_UNAVAILABLE)
 *
 * Mocks: db (tenantQuery + query para tenant-validator), cache, logger,
 *        documentoExportador (evita Puppeteer/docx en tests).
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ── Configuración de entorno ──────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-secret-key-12345-very-long-secret-key-for-test-32-chars';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const EXP_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID = '22222222-2222-2222-2222-222222222222';

const EXPEDIENTE_FIXTURE = {
  id: EXP_ID,
  numero: '00001-2026',
  numero_expediente: '00001-2026',
  titulo: 'Demanda de desalojo por ocupación precaria',
  tipo: 'civil',
  materia: 'civil',
  estado: 'activo',
  juzgado: '1er Juzgado Civil de Lima',
  tipo_proceso: 'sumarísimo',
  partes: { demandante: 'Juan Pérez', demandado: 'Empresa Inmobiliaria SAC' },
  hechos: 'El demandante es propietario del inmueble...',
  teoria_caso: 'Ocupación precaria sin título que justifique la posesión.',
  es_urgente: false,
  es_dato_sensible: false,
  created_at: '2026-01-10T00:00:00Z',
  updated_at: null,
};

// ── Mocks (vi.hoisted para poder restaurar implementaciones en beforeEach) ────
const mocks = vi.hoisted(() => ({
  dbQuery: vi.fn(),
  tenantQuery: vi.fn(),
}));

// db.query — usado por requireTenantAccess('expedientes') y logAudit
function setupDbQueryDefault() {
  mocks.dbQuery.mockImplementation((text) => {
    const sql = typeof text === 'string' ? text : '';
    // requireTenantAccess: valida pertenencia del caso al tenant
    if (sql.includes('SELECT id, organization_id FROM expedientes')) {
      return Promise.resolve({ rows: [{ id: EXP_ID, organization_id: ORG_ID }] });
    }
    // audit_log insert (logAudit) — fallback silencioso
    if (sql.includes('INSERT INTO audit_log')) {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
    // initDb / información del schema
    if (sql.includes('information_schema.tables')) {
      return Promise.resolve({ rows: [{ n: '1' }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
}

// tenantQuery — usado por reporteExpediente.js
function setupTenantDefault() {
  mocks.tenantQuery.mockImplementation((text) => {
    const sql = typeof text === 'string' ? text : '';
    if (sql.includes('FROM expedientes')) {
      return Promise.resolve({ rows: [EXPEDIENTE_FIXTURE] });
    }
    if (sql.includes('FROM documentos')) {
      return Promise.resolve({
        rows: [{
          id: 'a'.repeat(36), nombre: 'Escrito de demanda.pdf',
          tipo_documento: 'escrito', descripcion: null, archivo_nombre: 'demanda.pdf',
          archivo_tipo: 'application/pdf', archivo_tamano: 1024,
          hash_sha256: 'abc123hash', fecha_documento: '2026-01-12', creado_en: '2026-01-12T00:00:00Z',
        }],
      });
    }
    if (sql.includes('FROM evidencia_digital')) {
      return Promise.resolve({
        rows: [{
          id: 'b'.repeat(36), nombre_original: 'video-camara.jpg', tipo_archivo: 'image/jpeg',
          tamano_bytes: 2048, hash_sha256: 'def456hash', storage_path: '/uploads/def456hash.jpg',
          descripcion: null, etiqueta: 'prueba', cadena_custodia: [{ accion: 'registro' }],
          creado_en: '2026-01-13T00:00:00Z',
        }],
      });
    }
    if (sql.includes('FROM notificaciones_sinoe')) {
      return Promise.resolve({
        rows: [{
          id: 'c'.repeat(36), tipo_notificacion: 'auto', titulo: 'Auto admisorio',
          contenido: 'Se admite a trámite la demanda', fecha_notificacion: '2026-01-15T00:00:00Z',
          leida: false, urgencia: 'media', analisis_ia: null, creado_en: '2026-01-15T00:00:00Z',
        }],
      });
    }
    if (sql.includes('FROM mensajes_chat')) {
      return Promise.resolve({
        rows: [{
          id: 'd'.repeat(36), rol: 'user', contenido: '¿Qué plazo tengo para contestar?',
          created_at: '2026-01-16T00:00:00Z', total: '2',
        }],
      });
    }
    if (sql.includes('FROM organizaciones')) {
      return Promise.resolve({ rows: [{ nombre: 'Estudio Jurídico Test', plan: 'pro', slug: 'test' }] });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
}

vi.mock('../db.js', () => ({
  default: { query: mocks.dbQuery, connect: vi.fn(), on: vi.fn() },
  tenantQuery: mocks.tenantQuery,
  tenantContext: { getStore: () => undefined, run: (_ctx, fn) => fn() },
}));

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
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  httpLogger: (_req, _res, next) => next(),
}));

// ── Mock del servicio de exportación (evita Puppeteer/docx en tests) ──────────
const mockGenerarDocx = vi.fn();
const mockGenerarPdf = vi.fn();
const mockGenerarNombreArchivo = vi.fn();

vi.mock('../services/documentoExportador.js', () => ({
  generarDocx: mockGenerarDocx,
  generarPdf: mockGenerarPdf,
  generarNombreArchivo: mockGenerarNombreArchivo,
}));

let app;
let tokenAbogado;
let tokenViewer;

beforeAll(async () => {
  const mod = await import('../../server/index.js');
  app = mod.default;
});

beforeEach(() => {
  vi.clearAllMocks();
  setupDbQueryDefault();
  setupTenantDefault();

  tokenAbogado = jwt.sign(
    {
      sub: 'user-123',
      email: 'abogado@legalpro.pe',
      rol: 'ABOGADO',
      rol_org: 'MEMBER',
      organization_id: ORG_ID,
      nombre_completo: 'Dr. Carlos López',
    },
    process.env.JWT_SECRET,
    { issuer: 'LegalProAPI', audience: 'LegalProClients', expiresIn: '1h' }
  );

  tokenViewer = jwt.sign(
    {
      sub: 'user-456',
      email: 'viewer@legalpro.pe',
      rol: 'ABOGADO',
      rol_org: 'VIEWER',
      organization_id: ORG_ID,
      nombre_completo: 'Sr. Vista',
    },
    process.env.JWT_SECRET,
    { issuer: 'LegalProAPI', audience: 'LegalProClients', expiresIn: '1h' }
  );

  mockGenerarNombreArchivo.mockImplementation((_params, formato) => `LEXIA_resumen_00001-2026_juan_perez.${formato}`);
  mockGenerarDocx.mockResolvedValue(Buffer.from('mock-docx-reporte'));
  mockGenerarPdf.mockResolvedValue(Buffer.from('%PDF-1.4 mock reporte'));
});

// ── Auth & RBAC ───────────────────────────────────────────────────────────────

describe('GET /api/expedientes/:id/reporte — Auth & RBAC', () => {
  it('401 sin token', async () => {
    const res = await request(app).get(`/api/expedientes/${EXP_ID}/reporte`);
    expect(res.status).toBe(401);
  });

  it('401 token inválido', async () => {
    const res = await request(app)
      .get(`/api/expedientes/${EXP_ID}/reporte`)
      .set('Authorization', 'Bearer token-invalido');
    expect(res.status).toBe(401);
  });

  it('403 si el JWT no tiene organization_id (tenant)', async () => {
    const tokenSinOrg = jwt.sign(
      { sub: 'user-123', email: 'x@x.com', rol: 'ABOGADO' },
      process.env.JWT_SECRET,
      { issuer: 'LegalProAPI', audience: 'LegalProClients', expiresIn: '1h' }
    );
    const res = await request(app)
      .get(`/api/expedientes/${EXP_ID}/reporte`)
      .set('Authorization', `Bearer ${tokenSinOrg}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('organización');
  });

  it('403 VIEWER no puede exportar el reporte (PII)', async () => {
    const res = await request(app)
      .get(`/api/expedientes/${EXP_ID}/reporte`)
      .set('Authorization', `Bearer ${tokenViewer}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Permisos insuficientes');
  });
});

// ── Validación de formato ─────────────────────────────────────────────────────

describe('GET /api/expedientes/:id/reporte — validación de formato', () => {
  it('400 si formato no es json|pdf|docx', async () => {
    const res = await request(app)
      .get(`/api/expedientes/${EXP_ID}/reporte?formato=html`)
      .set('Authorization', `Bearer ${tokenAbogado}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Formato inválido');
  });
});

// ── Reporte JSON ──────────────────────────────────────────────────────────────

describe('GET /api/expedientes/:id/reporte — JSON', () => {
  it('200 con el shape consolidado', async () => {
    const res = await request(app)
      .get(`/api/expedientes/${EXP_ID}/reporte`)
      .set('Authorization', `Bearer ${tokenAbogado}`);

    expect(res.status).toBe(200);
    expect(res.body.expediente).toMatchObject({
      id: EXP_ID,
      numero: '00001-2026',
      titulo: expect.any(String),
    });
    expect(Array.isArray(res.body.documentos)).toBe(true);
    expect(res.body.documentos[0].hash_sha256).toBe('abc123hash');
    expect(Array.isArray(res.body.evidencia)).toBe(true);
    expect(res.body.evidencia[0].cadena_custodia).toBeDefined();
    expect(Array.isArray(res.body.notificaciones)).toBe(true);
    expect(res.body.historialIA.total).toBe(2);
    expect(Array.isArray(res.body.historialIA.ultimasConsultas)).toBe(true);
    expect(Array.isArray(res.body.plazos)).toBe(true);
    expect(res.body.generadoEn).toBeDefined();
    expect(res.body.membrete.organizacion).toBe('Estudio Jurídico Test');
  });

  it('404 si el expediente no existe (construirReporte devuelve null)', async () => {
    mocks.tenantQuery.mockImplementation((text) => {
      const sql = typeof text === 'string' ? text : '';
      if (sql.includes('FROM expedientes')) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .get(`/api/expedientes/${EXP_ID}/reporte`)
      .set('Authorization', `Bearer ${tokenAbogado}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('no encontrado');
  });
});

// ── Exportación PDF / DOCX ────────────────────────────────────────────────────

describe('GET /api/expedientes/:id/reporte — PDF y DOCX', () => {
  it('pdf → genera con generarPdf y sirve application/pdf', async () => {
    const mockBuffer = Buffer.from('%PDF-1.4 mock reporte');
    mockGenerarPdf.mockResolvedValue(mockBuffer);
    mockGenerarNombreArchivo.mockReturnValue('LEXIA_resumen_00001-2026_juan_perez.pdf');

    const res = await request(app)
      .get(`/api/expedientes/${EXP_ID}/reporte?formato=pdf`)
      .set('Authorization', `Bearer ${tokenAbogado}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('.pdf');
    expect(res.headers['content-length']).toBe(String(mockBuffer.length));
    expect(res.headers['cache-control']).toContain('no-cache');
    expect(mockGenerarPdf).toHaveBeenCalledTimes(1);
    expect(mockGenerarDocx).not.toHaveBeenCalled();
  });

  it('pdf → pasar params con membrete del abogado/org a generarPdf', async () => {
    mockGenerarPdf.mockResolvedValue(Buffer.from('%PDF-1.4'));

    await request(app)
      .get(`/api/expedientes/${EXP_ID}/reporte?formato=pdf`)
      .set('Authorization', `Bearer ${tokenAbogado}`);

    expect(mockGenerarPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'resumen',
        numeroExpediente: '00001-2026',
        abogado: 'Dr. Carlos López',
        organizacion: 'Estudio Jurídico Test',
        recurrente: expect.stringContaining('Juan Pérez'),
        contenido: expect.stringContaining('REPORTE CONSOLIDADO'),
      })
    );
  });

  it('docx → genera con generarDocx y sirve wordprocessingml', async () => {
    const mockBuffer = Buffer.from('docx-reporte-mock');
    mockGenerarDocx.mockResolvedValue(mockBuffer);
    mockGenerarNombreArchivo.mockReturnValue('LEXIA_resumen_00001-2026_juan_perez.docx');

    const res = await request(app)
      .get(`/api/expedientes/${EXP_ID}/reporte?formato=docx`)
      .set('Authorization', `Bearer ${tokenAbogado}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(res.headers['content-disposition']).toContain('.docx');
    expect(res.headers['content-length']).toBe(String(mockBuffer.length));
    expect(mockGenerarDocx).toHaveBeenCalledTimes(1);
    expect(mockGenerarPdf).not.toHaveBeenCalled();
  });

  it('500 + PDF_SERVICE_UNAVAILABLE si Chromium no está disponible', async () => {
    mockGenerarPdf.mockRejectedValue(new Error('Could not find Chromium (rv. 120.0.0)'));

    const res = await request(app)
      .get(`/api/expedientes/${EXP_ID}/reporte?formato=pdf`)
      .set('Authorization', `Bearer ${tokenAbogado}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('servicio de generación de PDF');
    expect(res.body.code).toBe('PDF_SERVICE_UNAVAILABLE');
  });
});
