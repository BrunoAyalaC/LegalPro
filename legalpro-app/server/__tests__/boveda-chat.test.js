/**
 * INTEGRATION TESTS — /api/boveda (Bóveda desde Chat IA)
 *
 * Cubre:
 *  - Auth guards (401 sin token, 403 sin organization_id)
 *  - POST /guardar-documento: validación Zod, anti-IDOR del expediente,
 *    INSERT en evidencia_digital con organization_id del JWT, hash SHA-256,
 *    cadena de custodia y 409 por hash duplicado.
 *  - GET /por-expediente/:id: listado SIEMPRE filtrado por organization_id.
 *
 * Mockea db.js (tenantQuery → mockQuery) para evitar conexión real a PostgreSQL.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

// ── Mock db (pg Pool) ──────────────────────────────────────────────────────
// El router usa tenantQuery (db.js). Apuntamos tenantQuery y default.query
// al mismo vi.fn() para no romper logAudit (que usa default.query).
const mockQuery = vi.fn();
vi.mock('../db.js', () => ({
  default: {
    query: (...args) => mockQuery(...args),
  },
  tenantQuery: (...args) => mockQuery(...args),
  tenantContext: { getStore: () => undefined, run: (_ctx, fn) => fn() },
}));

// ── Config ─────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'TestSmokeKey_MustBe32CharsLongForValidation!';
const ORG_A = '00000000-0000-0000-0000-000000000001';
const ORG_B = '99999999-9999-9999-9999-999999999999';
// UUIDs v4 reales: Zod 4 valida versión (4) y variante (8/9/a/b)
const EXP_ID = '11111111-1111-4111-8111-111111111111';

function token(orgId = ORG_A, overrides = {}) {
  return jwt.sign({
    sub: '00000000-0000-0000-0000-000000000010',
    email: 'abogado@legalpro.pe',
    rol: 'ABOGADO',
    nombre_completo: 'Test User',
    organization_id: orgId,
    ...overrides,
  }, JWT_SECRET, { issuer: 'LegalProAPI', audience: 'LegalProClients', expiresIn: '1h' });
}

let app;
beforeAll(async () => {
  const mod = await import('../../server/index.js');
  app = mod.default;
});

beforeEach(() => {
  mockQuery.mockReset();
});

// ═══════════════════════════════════════════════════════════════════════
// AUTH GUARDS
// ═══════════════════════════════════════════════════════════════════════
describe('/api/boveda — Auth & tenant', () => {
  it('POST /guardar-documento sin token → 401', async () => {
    const res = await request(app)
      .post('/api/boveda/guardar-documento')
      .send({ expediente_id: EXP_ID, contenido_base64: 'aGVsbG8=' });
    expect(res.status).toBe(401);
  });

  it('POST /guardar-documento con token sin organization_id → 403', async () => {
    const t = jwt.sign({
      sub: '1', email: 'x@x.pe', rol: 'ABOGADO', nombre_completo: 'X',
    }, JWT_SECRET, { issuer: 'LegalProAPI', audience: 'LegalProClients', expiresIn: '1h' });
    const res = await request(app)
      .post('/api/boveda/guardar-documento')
      .set('Authorization', `Bearer ${t}`)
      .send({ expediente_id: EXP_ID, contenido_base64: 'aGVsbG8=' });
    expect(res.status).toBe(403);
  });

  it('GET /por-expediente/:id sin token → 401', async () => {
    const res = await request(app).get(`/api/boveda/por-expediente/${EXP_ID}`);
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// POST /api/boveda/guardar-documento
// ═══════════════════════════════════════════════════════════════════════
describe('POST /api/boveda/guardar-documento', () => {
  const contenido = 'Documento legal generado por IA — prueba de Bóveda.';
  const b64 = Buffer.from(contenido, 'utf8').toString('base64');
  const expectedHash = crypto
    .createHash('sha256')
    .update(Buffer.from(contenido, 'utf8'))
    .digest('hex');

  it('valida input inválido (sin contenido_base64) → 400', async () => {
    const res = await request(app)
      .post('/api/boveda/guardar-documento')
      .set('Authorization', `Bearer ${token()}`)
      .send({ expediente_id: EXP_ID });
    expect(res.status).toBe(400);
    expect(res.body.details?.some((d) => d.path === 'contenido_base64')).toBe(true);
  });

  it('valida expediente_id que no es UUID → 400', async () => {
    const res = await request(app)
      .post('/api/boveda/guardar-documento')
      .set('Authorization', `Bearer ${token()}`)
      .send({ expediente_id: 'no-soy-uuid', contenido_base64: b64 });
    expect(res.status).toBe(400);
    expect(res.body.details?.some((d) => d.path === 'expediente_id')).toBe(true);
  });

  it('expediente no pertenece a la organización → 404 (anti-IDOR)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // expCheck vacío
    const res = await request(app)
      .post('/api/boveda/guardar-documento')
      .set('Authorization', `Bearer ${token(ORG_B)}`)
      .send({ expediente_id: EXP_ID, contenido_base64: b64 });
    expect(res.status).toBe(404);
  });

  it('guarda la evidencia: 201, INSERT en evidencia_digital con org del JWT, hash y cadena de custodia', async () => {
    const evidenciaRow = {
      id: '33333333-3333-4333-8333-333333333333',
      hash_sha256: expectedHash,
      nombre_original: 'Escrito de demanda',
      tipo_archivo: 'application/pdf',
      tamano_bytes: Buffer.from(contenido, 'utf8').length,
      descripcion: null,
      cadena_custodia: JSON.stringify([{ accion: 'GENERACION', hash_sha256: expectedHash }]),
      creado_en: '2026-08-06T00:00:00.000Z',
    };
    mockQuery.mockResolvedValueOnce({ rows: [{ id: EXP_ID }], rowCount: 1 }); // expCheck OK
    mockQuery.mockResolvedValueOnce({ rows: [evidenciaRow], rowCount: 1 });   // INSERT

    const res = await request(app)
      .post('/api/boveda/guardar-documento')
      .set('Authorization', `Bearer ${token(ORG_A)}`)
      .send({
        expediente_id: EXP_ID,
        nombre: 'Escrito de demanda',
        descripcion: '',
        contenido_base64: b64,
        mime_type: 'application/pdf',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.hash_sha256).toBe(expectedHash);
    expect(res.body.data.inmutable).toBe(true); // Ley 27269

    // INSERT: verifica que SIEMPRE usa organization_id del JWT + hash + custodia
    const insertCall = mockQuery.mock.calls.find(([sql]) => /INSERT INTO evidencia_digital/i.test(sql));
    expect(insertCall).toBeDefined();
    const [, params] = insertCall;
    expect(params[1]).toBe(ORG_A);                  // organization_id del JWT
    expect(params[6]).toBe(expectedHash);           // hash sha256
    expect(params[8]).toBeNull();                   // descripcion '' → null
    expect(JSON.parse(params[9])[0].accion).toBe('GENERACION'); // cadena de custodia

    // Anti-IDOR: el check del expediente SIEMPRE filtra por organization_id del JWT
    const expCall = mockQuery.mock.calls.find(([sql]) => /FROM expedientes WHERE/i.test(sql));
    expect(expCall).toBeDefined();
    expect(expCall[1][0]).toBe(EXP_ID);
    expect(expCall[1][1]).toBe(ORG_A);
  });

  it('hash duplicado (unique violation 23505) → 409', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: EXP_ID }], rowCount: 1 });
    mockQuery.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));

    const res = await request(app)
      .post('/api/boveda/guardar-documento')
      .set('Authorization', `Bearer ${token()}`)
      .send({ expediente_id: EXP_ID, contenido_base64: b64 });
    expect(res.status).toBe(409);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GET /api/boveda/por-expediente/:id
// ═══════════════════════════════════════════════════════════════════════
describe('GET /api/boveda/por-expediente/:id', () => {
  it('lista evidencias filtrando SIEMPRE por organization_id del JWT', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app)
      .get(`/api/boveda/por-expediente/${EXP_ID}`)
      .set('Authorization', `Bearer ${token(ORG_A)}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/FROM evidencia_digital\s+WHERE/i);
    expect(sql).toMatch(/organization_id = \$2/i);
    expect(params[0]).toBe(EXP_ID);
    expect(params[1]).toBe(ORG_A); // ← prueba clave de aislamiento
  });

  it('expedienteId no UUID → 400', async () => {
    const res = await request(app)
      .get('/api/boveda/por-expediente/no-uuid')
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(400);
  });
});
