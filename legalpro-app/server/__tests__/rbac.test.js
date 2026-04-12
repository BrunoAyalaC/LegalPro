/**
 * Tests unitarios para middleware RBAC (Role-Based Access Control).
 * Verifica authMiddleware, tenantMiddleware y requireRole.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { authMiddleware, tenantMiddleware, requireRole, requireTenant } from '../middleware/authMiddleware.js';

const JWT_SECRET = process.env.JWT_SECRET;

// Helper: crea un JWT válido con claims
function createToken(claims = {}, expiresIn = '1h') {
  return jwt.sign(claims, JWT_SECRET, {
    issuer: 'LegalProAPI',
    audience: 'LegalProClients',
    expiresIn,
  });
}

// Helper: mock req/res/next
function mockReqResNext(overrides = {}) {
  const req = { headers: {}, user: null, ...overrides };
  const res = {
    status: vi.fn(function () { return this; }),
    json: vi.fn(function () { return this; }),
    set: vi.fn(),
  };
  const next = vi.fn();
  return { req, res, next };
}

// ═══════════════════════════════════════════
// authMiddleware
// ═══════════════════════════════════════════
describe('authMiddleware', () => {
  it('devuelve 401 si no hay header Authorization', () => {
    const { req, res, next } = mockReqResNext();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    expect(next).not.toHaveBeenCalled();
  });

  it('devuelve 401 si el header no empieza con "Bearer "', () => {
    const { req, res, next } = mockReqResNext({
      headers: { authorization: 'Basic abc123' },
    });
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('devuelve 401 si el token es inválido', () => {
    const { req, res, next } = mockReqResNext({
      headers: { authorization: 'Bearer invalid.token.here' },
    });
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('devuelve 403 si el token está expirado', () => {
    const token = jwt.sign(
      { sub: '1', email: 'test@test.com' },
      JWT_SECRET,
      { issuer: 'LegalProAPI', audience: 'LegalProClients', expiresIn: '-1s' }
    );
    const { req, res, next } = mockReqResNext({
      headers: { authorization: `Bearer ${token}` },
    });
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('llama a next() y agrega req.user con token válido', () => {
    const payload = { sub: '42', email: 'abogado@legalpro.pe', rol: 'ABOGADO' };
    const token = createToken(payload);
    const { req, res, next } = mockReqResNext({
      headers: { authorization: `Bearer ${token}` },
    });
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeDefined();
    expect(req.user.sub).toBe('42');
    expect(req.user.email).toBe('abogado@legalpro.pe');
  });
});

// ═══════════════════════════════════════════
// tenantMiddleware
// ═══════════════════════════════════════════
describe('tenantMiddleware', () => {
  it('devuelve 403 si req.user no tiene organization_id', () => {
    const { req, res, next } = mockReqResNext();
    req.user = { sub: '1', email: 'test@test.com' };
    tenantMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('agrega req.organizationId y llama next() si tiene organization_id', () => {
    const { req, res, next } = mockReqResNext();
    req.user = { sub: '1', email: 'test@test.com', organization_id: 'org-123' };
    tenantMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.organizationId).toBe('org-123');
  });
});

// ═══════════════════════════════════════════
// requireRole
// ═══════════════════════════════════════════
describe('requireRole', () => {
  it('devuelve 403 si el usuario no tiene rol', () => {
    const middleware = requireRole(['ADMIN', 'OWNER']);
    const { req, res, next } = mockReqResNext();
    req.user = { sub: '1' };
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining('rol'),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('devuelve 403 si el rol no está en la lista allowed', () => {
    const middleware = requireRole(['ADMIN', 'OWNER']);
    const { req, res, next } = mockReqResNext();
    req.user = { sub: '1', rol_org: 'VIEWER' };
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining('insuficientes'),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('llama next() si el rol está permitido (case insensitive)', () => {
    const middleware = requireRole(['ADMIN', 'OWNER']);
    const { req, res, next } = mockReqResNext();
    req.user = { sub: '1', rol_org: 'admin' };
    middleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('llama next() con OWNER', () => {
    const middleware = requireRole(['OWNER']);
    const { req, res, next } = mockReqResNext();
    req.user = { sub: '1', rol_org: 'OWNER' };
    middleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('MEMBER no puede acceder a rutas de ADMIN/OWNER', () => {
    const middleware = requireRole(['ADMIN', 'OWNER']);
    const { req, res, next } = mockReqResNext();
    req.user = { sub: '1', rol_org: 'MEMBER' };
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════
// requireTenant (combo)
// ═══════════════════════════════════════════
describe('requireTenant', () => {
  it('es un array de 2 middlewares [authMiddleware, tenantMiddleware]', () => {
    expect(requireTenant).toBeInstanceOf(Array);
    expect(requireTenant).toHaveLength(2);
    expect(requireTenant[0]).toBe(authMiddleware);
    expect(requireTenant[1]).toBe(tenantMiddleware);
  });
});
