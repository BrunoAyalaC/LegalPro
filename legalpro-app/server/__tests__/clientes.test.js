/**
 * INTEGRATION TESTS — /api/clientes (CRUD)
 * Cubre: GET lista, GET por id, POST crea, PUT actualiza, DELETE soft-delete
 * Mockea db.js para evitar conexión real a PostgreSQL.
 * Verifica que SIEMPRE se filtra por organization_id del JWT.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ── Mock db (pg Pool) ──────────────────────────────────────────────────────
// FIX: la refactorización R-01 hace que las rutas importen `tenantQuery` desde
// db.js, por lo que el mock debe exportarlo también. Apuntamos `tenantQuery`
// al mismo vi.fn() que `default.query` para no romper las aserciones existentes.
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
const CLIENTE_ID = 'cli-1234-uuid';

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
describe('/api/clientes — Auth & tenant', () => {
  it('GET /api/clientes sin token → 401', async () => {
    const res = await request(app).get('/api/clientes');
    expect(res.status).toBe(401);
  });

  it('GET /api/clientes con token pero sin organization_id → 403', async () => {
    const t = jwt.sign({
      sub: '1', email: 'x@x.pe', rol: 'ABOGADO', nombre_completo: 'X'
    }, JWT_SECRET, { issuer: 'LegalProAPI', audience: 'LegalProClients', expiresIn: '1h' });
    const res = await request(app).get('/api/clientes').set('Authorization', `Bearer ${t}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/clientes con token + org válido → ejecuta query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app).get('/api/clientes').set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GET / → Lista con aislamiento por organización
// ═══════════════════════════════════════════════════════════════════════
describe('GET /api/clientes — listado', () => {
  it('filtra SIEMPRE por organization_id del JWT', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await request(app).get('/api/clientes').set('Authorization', `Bearer ${token(ORG_A)}`);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/FROM clientes WHERE/i);
    expect(sql).toMatch(/organization_id = \$1/i);
    expect(sql).toMatch(/eliminado_en IS NULL/i);
    expect(params[0]).toBe(ORG_A);  // ← prueba clave de aislamiento
  });

  it('NO mezcla clientes de dos organizaciones distintas', async () => {
    // Simula que ORG_A pide y ORG_B también — deben llegar queries distintas
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'a1' }], rowCount: 1 });
    await request(app).get('/api/clientes').set('Authorization', `Bearer ${token(ORG_A)}`);
    expect(mockQuery.mock.calls[0][1][0]).toBe(ORG_A);

    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'b1' }], rowCount: 1 });
    await request(app).get('/api/clientes').set('Authorization', `Bearer ${token(ORG_B)}`);
    expect(mockQuery.mock.calls[1][1][0]).toBe(ORG_B);
  });

  it('devuelve { success: true, data: [...] }', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'c1', nombre_completo: 'Juan' }],
      rowCount: 1,
    });
    const res = await request(app).get('/api/clientes').set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([{ id: 'c1', nombre_completo: 'Juan' }]);
  });

  it('con search agrega ILIKE sobre nombre/razon_social/dni/ruc', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await request(app)
      .get('/api/clientes?search=juan')
      .set('Authorization', `Bearer ${token()}`);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/ILIKE \$2/);
    expect(sql).toMatch(/dni = \$2/);
    expect(params).toContain('%juan%');
    // Nota: el fix C-01 usa un solo parámetro $2 con ILIKE
    // (no requiere 'juan' separado para comparación exacta de dni/ruc)
  });

  it('con tipo filtra por tipo_persona', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await request(app)
      .get('/api/clientes?tipo=juridica')
      .set('Authorization', `Bearer ${token()}`);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/tipo_persona = \$/);
    expect(params).toContain('juridica');
  });

  it('pasa limit y offset como integers', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await request(app)
      .get('/api/clientes?limit=10&offset=20')
      .set('Authorization', `Bearer ${token()}`);

    const [, params] = mockQuery.mock.calls[0];
    expect(params[1]).toBe(10);
    expect(params[2]).toBe(20);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GET /:id
// ═══════════════════════════════════════════════════════════════════════
describe('GET /api/clientes/:id', () => {
  it('filtra por id + organization_id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await request(app)
      .get(`/api/clientes/${CLIENTE_ID}`)
      .set('Authorization', `Bearer ${token(ORG_A)}`);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND organization_id = \$2/i);
    expect(sql).toMatch(/eliminado_en IS NULL/);
    expect(params).toEqual([CLIENTE_ID, ORG_A]);
  });

  it('devuelve 404 si no encuentra', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app)
      .get(`/api/clientes/${CLIENTE_ID}`)
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no encontrad/i);
  });

  it('devuelve el cliente si existe', async () => {
    const cliente = { id: CLIENTE_ID, nombre_completo: 'Maria', organization_id: ORG_A };
    mockQuery.mockResolvedValueOnce({ rows: [cliente], rowCount: 1 });
    const res = await request(app)
      .get(`/api/clientes/${CLIENTE_ID}`)
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(cliente);
  });

  it('NO devuelve cliente de otra organización', async () => {
    // Simula que la query (con filtro WHERE) devuelve vacío — esto es a nivel app,
    // porque el filtro organization_id está en el SQL. La RLS de DB es la 2da línea.
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app)
      .get(`/api/clientes/${CLIENTE_ID}`)
      .set('Authorization', `Bearer ${token(ORG_B)}`);
    expect(res.status).toBe(404);
    // El parámetro enviado a DB es ORG_B, no ORG_A
    expect(mockQuery.mock.calls[0][1][1]).toBe(ORG_B);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// POST / → Crear
// ═══════════════════════════════════════════════════════════════════════
describe('POST /api/clientes', () => {
  it('inserta con organization_id del JWT', async () => {
    const nuevo = { id: 'new-1', nombre_completo: 'Pedro', dni: '12345678' };
    mockQuery.mockResolvedValueOnce({ rows: [nuevo], rowCount: 1 });

    const res = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token(ORG_A)}`)
      .send({
        tipo_persona: 'natural',
        nombre_completo: 'Pedro',
        dni: '12345678',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO clientes/i);
    expect(sql).toMatch(/organization_id/i);
    expect(params[0]).toBe(ORG_A);  // ← aislamiento
    expect(params[1]).toBe('natural');
    expect(params[2]).toBe('Pedro');
    expect(params[3]).toBe('12345678');
  });

  it('default tipo_persona = "natural" si no se especifica', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'x' }], rowCount: 1 });
    await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token()}`)
      .send({ nombre_completo: 'Sin tipo' });

    // tipo_persona es el segundo parámetro (índice 1)
    expect(mockQuery.mock.calls[0][1][1]).toBe('natural');
  });

  it('acepta campos de persona jurídica (razon_social, ruc)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'pj-1' }], rowCount: 1 });
    await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        tipo_persona: 'juridica',
        razon_social: 'Empresa SA',
        ruc: '20123456789',
      });

    const [, params] = mockQuery.mock.calls[0];
    expect(params[1]).toBe('juridica');
    expect(params).toContain('Empresa SA');
    expect(params).toContain('20123456789');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PUT /:id
// ═══════════════════════════════════════════════════════════════════════
describe('PUT /api/clientes/:id', () => {
  it('construye UPDATE dinámico con solo los campos enviados', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: CLIENTE_ID, telefono: '999888777' }],
      rowCount: 1,
    });
    await request(app)
      .put(`/api/clientes/${CLIENTE_ID}`)
      .set('Authorization', `Bearer ${token(ORG_A)}`)
      .send({ telefono: '999888777' });

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/UPDATE clientes SET/i);
    expect(sql).toMatch(/telefono = \$1/i);
    expect(sql).toMatch(/updated_at = NOW\(\)/i);
    expect(sql).toMatch(/WHERE id = \$2 AND organization_id = \$3/);
    expect(params).toEqual(['999888777', CLIENTE_ID, ORG_A]);
  });

  it('devuelve 400 si el body está vacío (nada que actualizar)', async () => {
    const res = await request(app)
      .put(`/api/clientes/${CLIENTE_ID}`)
      .set('Authorization', `Bearer ${token()}`)
      .send({});
    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('devuelve 404 si no encuentra el cliente en su organización', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app)
      .put(`/api/clientes/${CLIENTE_ID}`)
      .set('Authorization', `Bearer ${token(ORG_B)}`)
      .send({ telefono: '111' });

    expect(res.status).toBe(404);
    // Verifica que ORG_B se usó como filtro
    expect(mockQuery.mock.calls[0][1].slice(-1)[0]).toBe(ORG_B);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// DELETE /:id → Soft delete
// ═══════════════════════════════════════════════════════════════════════
describe('DELETE /api/clientes/:id', () => {
  it('soft-delete: setea eliminado_en = NOW() y filtra por org', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: CLIENTE_ID }], rowCount: 1 });
    const res = await request(app)
      .delete(`/api/clientes/${CLIENTE_ID}`)
      .set('Authorization', `Bearer ${token(ORG_A)}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/eliminad/i);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/UPDATE clientes SET eliminado_en = NOW\(\)/i);
    expect(sql).toMatch(/WHERE id = \$1 AND organization_id = \$2 AND eliminado_en IS NULL/i);
    expect(params).toEqual([CLIENTE_ID, ORG_A]);
  });

  it('devuelve 404 si el cliente ya está eliminado o no pertenece a la org', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app)
      .delete(`/api/clientes/${CLIENTE_ID}`)
      .set('Authorization', `Bearer ${token(ORG_B)}`);
    expect(res.status).toBe(404);
  });

  it('NO hace DELETE físico (búsqueda no contiene "DELETE FROM")', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: CLIENTE_ID }], rowCount: 1 });
    await request(app)
      .delete(`/api/clientes/${CLIENTE_ID}`)
      .set('Authorization', `Bearer ${token()}`);

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).not.toMatch(/DELETE FROM clientes/i);
  });
});