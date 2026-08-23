import { describe, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockQuery = vi.fn();
vi.mock('../db.js', () => ({
  default: { query: (...args) => mockQuery(...args) },
  // FIX R-01: las rutas usan `tenantQuery` además de `db.query`,
  // lo apuntamos al mismo mockQuery para mantener la cobertura del test.
  tenantQuery: (...args) => mockQuery(...args),
  tenantContext: { getStore: () => undefined, run: (_ctx, fn) => fn() },
}));

const JWT_SECRET = 'TestSmokeKey_MustBe32CharsLongForValidation!';

function token(orgId = '00000000-0000-0000-0000-000000000001') {
  return jwt.sign({
    sub: '00000000-0000-0000-0000-000000000010',
    email: 'a@b.pe', rol: 'ABOGADO',
    organization_id: orgId,
  }, JWT_SECRET, { issuer: 'LegalProAPI', audience: 'LegalProClients', expiresIn: '1h' });
}

describe('diag2', () => {
  it('GET /api/clientes listing with valid token', async () => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const { default: app } = await import('../index.js');

    const res = await request(app).get('/api/clientes').set('Authorization', `Bearer ${token()}`);
    console.log('STATUS:', res.status, 'BODY:', JSON.stringify(res.body).slice(0, 300));
    console.log('mockQuery called:', mockQuery.mock.calls.length, 'times');
    if (mockQuery.mock.calls[0]) {
      console.log('first call sql:', String(mockQuery.mock.calls[0][0]).slice(0, 100));
    }
  });
});