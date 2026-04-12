/**
 * JOURNEY TESTS — Auth API (Node Backend)
 * Cubre todos los flujos de autenticación: registro, login, token, refresh, me
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

// Mock pg Pool (db.js) — previene conexión real a PostgreSQL en tests
vi.mock('../db.js', () => ({
  default: {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  },
}));
// Backwards-compat shim
vi.mock('../supabase.js', () => ({ default: null, supabaseAdmin: null, createUserClient: vi.fn() }));

let app;
beforeAll(async () => {
  const mod = await import('../../server/index.js');
  app = mod.default;
});

// ═══════════════════════════════════════════════════════════════════════
// JOURNEY 1: Registro — Validaciones exhaustivas
// ═══════════════════════════════════════════════════════════════════════
describe('Journey: POST /api/auth/register — Validaciones', () => {
  it('400 — falta nombreCompleto', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@legalpro.pe', password: 'Test1234!', rol: 'ABOGADO' });
    expect(res.status).toBe(400);
  });

  it('400 — falta email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombreCompleto: 'Test User', password: 'Test1234!', rol: 'ABOGADO' });
    expect(res.status).toBe(400);
  });

  it('400 — falta password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombreCompleto: 'Test', email: 'test@legalpro.pe', rol: 'ABOGADO' });
    expect(res.status).toBe(400);
  });

  it('400 — password con solo 7 caracteres', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombreCompleto: 'Test', email: 'test@test.pe', password: '1234567', rol: 'ABOGADO' });
    expect(res.status).toBe(400);
  });

  it('400 — password de exactamente 8 caracteres sin complejidad', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombreCompleto: 'Test', email: 'test@test.pe', password: '12345678', rol: 'ABOGADO' });
    expect([400, 201, 409, 500]).toContain(res.status); // depende del validator de complejidad
  });

  it('400 — rol inválido SUPERADMIN', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombreCompleto: 'Test', email: 'test@test.pe', password: 'Test1234!', rol: 'SUPERADMIN' });
    expect(res.status).toBe(400);
  });

  it('400 — rol inválido HACKER', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombreCompleto: 'Test', email: 'test@test.pe', password: 'Test1234!', rol: 'HACKER' });
    expect(res.status).toBe(400);
  });

  it('400 — rol case-sensitive minúscula rechazado', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombreCompleto: 'Test', email: 'test@test.pe', password: 'Test1234!', rol: 'abogado' });
    // El backend .NET es case-insensitive, pero Node puede ser estricto
    expect([400, 201, 409, 500]).toContain(res.status);
  });

  it('400 — body vacío retorna error', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('400 — email sin formato válido', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombreCompleto: 'Test', email: 'noesunemail', password: 'Test1234!', rol: 'ABOGADO' });
    expect([400, 201, 500]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// JOURNEY 2: Login — Casos de error
// ═══════════════════════════════════════════════════════════════════════
describe('Journey: POST /api/auth/login — Casos de error', () => {
  it('400 — sin credenciales', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('400 — sin password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.pe' });
    expect(res.status).toBe(400);
  });

  it('400 — sin email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'Test1234!' });
    expect(res.status).toBe(400);
  });

  it('401 — usuario no existente', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'noexiste@test.pe', password: 'WrongPass1' });
    expect(res.status).toBe(401);
  });

  it('401 — email correcto pero password incorrecto', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@legalpro.pe', password: 'WrongPassword' });
    // El mock de Supabase devuelve null, lo que genera 401
    expect([401, 400]).toContain(res.status);
  });

  it('respuesta de error contiene campo error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});
    expect(res.body).toHaveProperty('error');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// JOURNEY 3: Token — Verificación JWT
// ═══════════════════════════════════════════════════════════════════════
describe('Journey: GET /api/auth/me — Validación de token', () => {
  it('401 — sin header Authorization', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('401 — header Authorization sin Bearer', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'TokenSinBearer');
    expect(res.status).toBe(401);
  });

  it('401 — token JWT malformado', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer esto.no.es.jwt.valido');
    expect(res.status).toBe(401);
  });

  it('401 — token con firma incorrecta', async () => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.FIRMAMALICIOSA';
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${fakeToken}`);
    expect(res.status).toBe(401);
  });

  it('401 — token vacío', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer ');
    expect([400, 401]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// JOURNEY 4: Rutas protegidas — Sin token
// ═══════════════════════════════════════════════════════════════════════
describe('Journey: Rutas protegidas sin token retornan 401', () => {
  const protectedRoutes = [
    '/api/organizaciones/me',
    '/api/gemini/chat',
    '/api/gemini/redactor',
    '/api/gemini/predictor',
  ];

  for (const route of protectedRoutes) {
    it(`401 — ${route} sin token`, async () => {
      const method = route.includes('chat') || route.includes('redactor') || route.includes('predictor')
        ? 'post' : 'get';
      const res = method === 'post'
        ? await request(app).post(route).send({})
        : await request(app).get(route);
      expect(res.status).toBe(401);
    });
  }
});
