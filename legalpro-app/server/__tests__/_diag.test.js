import { describe, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'TestSmokeKey_MustBe32CharsLongForValidation!';

function token(orgId = '00000000-0000-0000-0000-000000000001') {
  return jwt.sign({
    sub: '00000000-0000-0000-0000-000000000010',
    email: 'a@b.pe', rol: 'ABOGADO',
    organization_id: orgId,
  }, JWT_SECRET, { issuer: 'LegalProAPI', audience: 'LegalProClients', expiresIn: '1h' });
}

describe('diag', () => {
  it('GET /api/clientes with valid token', async () => {
    const { default: app } = await import('../index.js');
    app.use((err, req, res, next) => {
      console.error('\n\n=== DIAG_ERROR:', err.message);
      console.error('STACK:', err.stack?.split('\n').slice(0,12).join('\n'));
      if (!res.headersSent) res.status(555).json({ caught: err.message });
    });
    const res = await request(app).get('/api/clientes').set('Authorization', `Bearer ${token()}`);
    console.log('STATUS:', res.status, 'BODY:', JSON.stringify(res.body).slice(0, 300));
  });
});
