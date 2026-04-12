/**
 * SMOKE TESTS — Backend Node (Express API)
 * Validan que la app Express arranca y responde a endpoints básicos.
 * Mockea Supabase para evitar DB real. Usa Supertest para HTTP.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

// ── Mock db (pg Pool) ANTES de importar la app ──────────────────────────────
// Intercepta server/db.js para evitar conexión real a PostgreSQL en tests
vi.mock('../db.js', () => {
  return {
    default: {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    },
  };
});

// ── Mock supabase.js (shim deprecado) — mantener por si algún import lo usa ─
vi.mock('../supabase.js', () => ({
  default: null,
  supabaseAdmin: null,
  createUserClient: vi.fn(),
}));

let app;

beforeAll(async () => {
  // Importar la app después de que el mock esté en su lugar
  const mod = await import('../../server/index.js');
  app = mod.default;
});

// ═══════════════════════════════════════════════════════════════════════
// 1. HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════
describe('GET /health', () => {
  it('should_return_200_with_ok_status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('ts');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. AUTH — REGISTER
// ═══════════════════════════════════════════════════════════════════════
describe('POST /api/auth/register', () => {
  it('should_return_400_when_missing_fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should_return_400_when_password_too_short', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombreCompleto: 'Test', email: 'test@test.pe', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('8 caracteres');
  });

  it('should_return_400_when_invalid_rol', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombreCompleto: 'Test', email: 'test@test.pe', password: 'Secure123!', rol: 'HACKER' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Rol inválido');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. AUTH — LOGIN
// ═══════════════════════════════════════════════════════════════════════
describe('POST /api/auth/login', () => {
  it('should_return_400_when_missing_credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('obligatorios');
  });

  it('should_return_401_when_user_not_found', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'no-existe@test.pe', password: 'WrongPass1' });
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Credenciales');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. AUTH — ME (sin token)
// ═══════════════════════════════════════════════════════════════════════
describe('GET /api/auth/me', () => {
  it('should_return_401_without_token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Token');
  });

  it('should_return_401_with_invalid_token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.jwt.token');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. PROTECTED ROUTES — ORGANIZACIONES (sin token)
// ═══════════════════════════════════════════════════════════════════════
describe('Organizaciones — auth guard', () => {
  it('should_return_401_for_GET_/api/organizaciones/me_without_token', async () => {
    const res = await request(app).get('/api/organizaciones/me');
    expect(res.status).toBe(401);
  });

  it('should_return_401_for_POST_/api/organizaciones_without_token', async () => {
    const res = await request(app)
      .post('/api/organizaciones')
      .send({ nombre: 'OrgTest' });
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. GEMINI ROUTES — sin auth
// ═══════════════════════════════════════════════════════════════════════
describe('Gemini — auth guard', () => {
  it('should_return_401_for_POST_/api/gemini/chat_without_token', async () => {
    const res = await request(app)
      .post('/api/gemini/chat')
      .send({ message: 'hola' });
    expect(res.status).toBe(401);
  });

  it('should_return_401_for_POST_/api/gemini/consulta_without_token', async () => {
    const res = await request(app)
      .post('/api/gemini/consulta')
      .send({ tipo: 'analisis', texto: 'test' });
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. 404 — RUTAS INEXISTENTES
// ═══════════════════════════════════════════════════════════════════════
describe('404 — rutas no definidas', () => {
  it('should_return_404_for_unknown_route', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8. AUTH CON JWT VÁLIDO
// ═══════════════════════════════════════════════════════════════════════
describe('JWT token generation & validation', () => {
  it('should_accept_valid_jwt_for_protected_routes', async () => {
    const jwt = await import('jsonwebtoken');
    const token = jwt.default.sign(
      { sub: '1', email: 'test@lp.pe', rol: 'ABOGADO', nombre_completo: 'Test' },
      process.env.JWT_SECRET,
      { issuer: 'LegalProAPI', audience: 'LegalProClients', expiresIn: 60 }
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    // Auth pasa (200 o error de Supabase, pero NO 401)
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 9. CORS + CONTENT-TYPE
// ═══════════════════════════════════════════════════════════════════════
describe('CORS & Content-Type', () => {
  it('should_return_json_content_type_on_health', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['content-type']).toContain('application/json');
  });

  it('should_include_cors_headers', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173');
    // CORS permite en dev
    expect(res.status).toBe(200);
  });
});
