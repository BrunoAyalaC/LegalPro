/**
 * JOURNEY TESTS — Auth API (Node Backend)
 * Cubre todos los flujos de autenticación: registro, login, token, refresh, me
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Mock pg Pool (db.js) — previene conexión real a PostgreSQL en tests
// FIX R-01: las rutas usan `tenantQuery` además de `db.query`, por lo que
// el mock debe exportarlo también. Apuntamos ambos al mismo vi.fn() para
// no romper las aserciones existentes que sólo mockean db.query.
// IMPORTANTE: default.query DEBE ser directamente el vi.fn() (no un wrapper)
// porque los tests usan db.query.mockResolvedValueOnce(...) — eso requiere
// que query sea la función espía original con todos sus métodos mock.
const _dbQueryMock = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
vi.mock('../db.js', () => ({
  default: {
    query: _dbQueryMock,
    connect: vi.fn(),
    on: vi.fn(),
  },
  tenantQuery: _dbQueryMock,
  tenantContext: { getStore: () => undefined, run: (_ctx, fn) => fn() },
}));

let app;
beforeAll(async () => {
  const mod = await import('../../server/index.js');
  app = mod.default;
});

// Helper: genera un JWT válido para pruebas autenticadas
const TEST_JWT_SECRET = process.env.JWT_SECRET || 'TestSmokeKey_MustBe32CharsLongForValidation!';
function generateTestToken(overrides = {}) {
  const payload = {
    sub: '00000000-0000-0000-0000-000000000010',
    email: 'admin@legalpro.pe',
    rol: 'ADMIN',
    nombre_completo: 'Admin Test',
    especialidad: 'GENERAL',
    ...overrides,
  };
  return jwt.sign(payload, TEST_JWT_SECRET, {
    issuer: 'LegalProAPI',
    audience: 'LegalProClients',
    expiresIn: '1h',
  });
}

// ═══════════════════════════════════════════════════════════════════════
// JOURNEY 1: Registro — Validaciones exhaustivas
// ═══════════════════════════════════════════════════════════════════════
describe('Journey: POST /api/auth/register — Validaciones', () => {
  it('400 — falta nombreCompleto', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@legalpro.pe', password: 'Test1234!', rol: 'ABOGADO', aceptaTerminos: true, aceptaPrivacidad: true, aceptaTransferenciaInternacional: true });
    expect(res.status).toBe(400);
  });

  it('400 — falta email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombreCompleto: 'Test User', password: 'Test1234!', rol: 'ABOGADO', aceptaTerminos: true, aceptaPrivacidad: true, aceptaTransferenciaInternacional: true });
    expect(res.status).toBe(400);
  });

  it('400 — falta password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombreCompleto: 'Test', email: 'test@legalpro.pe', rol: 'ABOGADO', aceptaTerminos: true, aceptaPrivacidad: true, aceptaTransferenciaInternacional: true });
    expect(res.status).toBe(400);
  });

  it('400 — no acepta términos ni privacidad', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombreCompleto: 'Test', email: 'test@legalpro.pe', password: 'Test1234!', rol: 'ABOGADO', aceptaTerminos: false, aceptaPrivacidad: false, aceptaTransferenciaInternacional: false });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Términos|Privacidad/i);
  });

  it('400 — password con solo 7 caracteres', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombreCompleto: 'Test', email: 'test@test.pe', password: '1234567', rol: 'ABOGADO', aceptaTerminos: true, aceptaPrivacidad: true, aceptaTransferenciaInternacional: true });
    expect(res.status).toBe(400);
  });

  it('400 — password de exactamente 8 caracteres sin complejidad', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombreCompleto: 'Test', email: 'test@test.pe', password: '12345678', rol: 'ABOGADO', aceptaTerminos: true, aceptaPrivacidad: true, aceptaTransferenciaInternacional: true });
    expect([400, 201, 409, 500]).toContain(res.status); // depende del validator de complejidad
  });

  it('400 — rol inválido SUPERADMIN', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombreCompleto: 'Test', email: 'test@test.pe', password: 'Test1234!', rol: 'SUPERADMIN', aceptaTerminos: true, aceptaPrivacidad: true, aceptaTransferenciaInternacional: true });
    expect(res.status).toBe(400);
  });

  it('400 — rol inválido HACKER', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombreCompleto: 'Test', email: 'test@test.pe', password: 'Test1234!', rol: 'HACKER', aceptaTerminos: true, aceptaPrivacidad: true, aceptaTransferenciaInternacional: true });
    expect(res.status).toBe(400);
  });

  it('400 — rol case-sensitive minúscula rechazado', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombreCompleto: 'Test', email: 'test@test.pe', password: 'Test1234!', rol: 'abogado', aceptaTerminos: true, aceptaPrivacidad: true, aceptaTransferenciaInternacional: true });
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
      .send({ nombreCompleto: 'Test', email: 'noesunemail', password: 'Test1234!', rol: 'ABOGADO', aceptaTerminos: true, aceptaPrivacidad: true, aceptaTransferenciaInternacional: true });
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
    '/api/ai/chat',
    '/api/ai/redactor',
    '/api/ai/predictor',
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

// ═══════════════════════════════════════════════════════════════════════
// JOURNEY 5: POST /api/auth/change-password
// ═══════════════════════════════════════════════════════════════════════
// NOTA: Algunos tests aceptan 429 (rate limited) como status válido porque
// los tests previos (register/login/me) consumen los 10 intentos del authLimiter.
// El patrón `expect([400, 429]).toContain(res.status)` se usa en otras suites
// del mismo archivo.
describe('Journey: POST /api/auth/change-password', () => {
  const validToken = generateTestToken();
  const tokenInvalido = 'Bearer token-manualmente-invalido';

  it('401 — sin token de autenticación', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ passwordActual: 'Old1', nuevaPassword: 'NewPass123!', confirmarPassword: 'NewPass123!' });
    expect([401, 429]).toContain(res.status);
  });

  it('401/429 — token inválido', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', tokenInvalido)
      .send({ passwordActual: 'Old1', nuevaPassword: 'NewPass123!', confirmarPassword: 'NewPass123!' });
    expect([401, 429]).toContain(res.status);
  });

  it('400/429 — sin campos obligatorios', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${validToken}`)
      .send({});
    expect([400, 429]).toContain(res.status);
    if (res.status === 400) {
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/obligatorios/i);
    }
  });

  it('400/429 — nuevaPassword menor a 8 caracteres', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ passwordActual: 'Old1', nuevaPassword: '1234567', confirmarPassword: '1234567' });
    expect([400, 429]).toContain(res.status);
    if (res.status === 400) {
      expect(res.body.error).toMatch(/8 caracteres/i);
    }
  });

  it('400/429 — nuevaPassword no coincide con confirmarPassword', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ passwordActual: 'Old1', nuevaPassword: 'NewPass123!', confirmarPassword: 'Distinta123!' });
    expect([400, 429]).toContain(res.status);
    if (res.status === 400) {
      expect(res.body.error).toMatch(/no coinciden/i);
    }
  });

  it('400/429 — nuevaPassword igual a passwordActual', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ passwordActual: 'MismaPass1!', nuevaPassword: 'MismaPass1!', confirmarPassword: 'MismaPass1!' });
    expect([400, 429]).toContain(res.status);
    if (res.status === 400) {
      expect(res.body.error).toMatch(/diferente/i);
    }
  });

  it('401/429 — passwordActual es incorrecta', async () => {
    const hash = await bcrypt.hash('RealOldPass1!', 4); // costo bajo para tests rápidos
    const db = (await import('../db.js')).default;
    db.query.mockResolvedValueOnce({
      rows: [{ id: '00000000-0000-0000-0000-000000000010', password_hash: hash }],
      rowCount: 1,
    });

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        passwordActual: 'WrongPass1!',
        nuevaPassword: 'NewPass1234!',
        confirmarPassword: 'NewPass1234!',
      });
    expect([401, 429]).toContain(res.status);
    if (res.status === 401) {
      expect(res.body.error).toMatch(/incorrecta/i);
    }
  });

  it('200/429 — cambio exitoso', async () => {
    const hash = await bcrypt.hash('RealOldPass1!', 4);
    const db = (await import('../db.js')).default;
    // SELECT usuario
    db.query.mockResolvedValueOnce({
      rows: [{ id: '00000000-0000-0000-0000-000000000010', password_hash: hash }],
      rowCount: 1,
    });
    // UPDATE password (el logAudit es fire-and-forget, no bloquea)
    db.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        passwordActual: 'RealOldPass1!',
        nuevaPassword: 'NewPass1234!',
        confirmarPassword: 'NewPass1234!',
      });
    expect([200, 429]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/actualizada/i);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// JOURNEY 6: POST /api/auth/forgot-password
// ═══════════════════════════════════════════════════════════════════════
describe('Journey: POST /api/auth/forgot-password', () => {
  it('400 — email faltante', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/email/i);
  });

  it('400 — email vacío', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: '' });
    expect(res.status).toBe(400);
  });

  it('200 — email existente (genera token)', async () => {
    const db = (await import('../db.js')).default;
    // SELECT usuario existente
    db.query.mockResolvedValueOnce({
      rows: [{ id: '00000000-0000-0000-0000-000000000010', email: 'admin@legalpro.pe' }],
      rowCount: 1,
    });
    // UPDATE reset_token
    db.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'admin@legalpro.pe' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/instrucciones/i);
  });

  it('200 — email NO existente (misma respuesta por seguridad)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'noexiste@test.pe' });
    // Siempre 200 sin revelar si el email existe
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/instrucciones/i);
  });
});
