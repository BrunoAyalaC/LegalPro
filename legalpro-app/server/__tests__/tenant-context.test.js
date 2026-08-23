/**
 * FIX P0-C — Test de contexto tenant (AsyncLocalStorage).
 *
 * Verifica que una request autenticada a una ruta protegida con el
 * tenantMiddleware REAL (middleware/tenantMiddleware.js) ejecuta el handler
 * DENTRO de tenantContext.run(...), es decir:
 *   - tenantContext.getStore() != null dentro del handler
 *   - el store contiene org_id / user_id / user_rol del JWT
 *   - req.organizationId queda seteado
 *
 * Mock mínimo: solo se mockea db.js (se inyecta un AsyncLocalStorage REAL
 * como tenantContext para poder inspeccionar el store). authMiddleware y
 * tenantMiddleware son los reales — se prueba el cableado completo
 * authMiddleware → tenantMiddleware → handler.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ── Mock mínimo de db.js ─────────────────────────────────────────────────────
// Se crea un AsyncLocalStorage REAL dentro de la factory (vitest hoist-safe)
// y se expone vía __getTenantContext para que el test inspeccione el store
// que el middleware real propaga.
vi.mock('../db.js', async () => {
  const { AsyncLocalStorage } = await import('node:async_hooks');
  const als = new AsyncLocalStorage();
  return {
    default: { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
    tenantQuery: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    tenantContext: als,
    __getTenantContext: () => als,
  };
});

// FIX TEST-REGRESSION (2026-08-22): setear secreto ANTES de los dynamic imports
// (authMiddleware lo lee lazy por invocación, pero makeToken lo necesita ya).
process.env.JWT_SECRET ??= 'test-jwt-secret-para-vitest-32-chars-minimo!!';

// Imports REALES (después del mock de db.js)
const { authMiddleware } = await import('../middleware/authMiddleware.js');
const { tenantMiddleware } = await import('../middleware/tenantMiddleware.js');
const dbModule = await import('../db.js');

const JWT_SECRET = process.env.JWT_SECRET;
const tenantContext = dbModule.__getTenantContext();

function makeToken(claims = {}) {
  return jwt.sign(
    {
      sub: '42',
      id: 42,
      email: 'abogado@legalpro.pe',
      rol: 'ABOGADO',
      organization_id: 'org-abc-123',
      ...claims,
    },
    JWT_SECRET,
    { issuer: 'LegalProAPI', audience: 'LegalProClients', expiresIn: '1h' }
  );
}

// ── App mínima ───────────────────────────────────────────────────────────────
let app;
let captured;

beforeAll(() => {
  app = express();
  captured = {};

  // Ruta protegida con la cadena completa: auth → tenant REAL → handler
  app.get('/tenant-protegido', authMiddleware, tenantMiddleware, (req, res) => {
    captured.store = tenantContext.getStore();
    res.json({ ok: true, organizationId: req.organizationId });
  });

  // Control negativo: ruta autenticada SIN tenantMiddleware → no debe haber store
  app.get('/sin-tenant-mw', authMiddleware, (req, res) => {
    captured.storeSinTenant = tenantContext.getStore();
    res.json({ ok: true });
  });

  // JWT sin organization_id → tenantMiddleware debe rechazar con 403
  app.get('/org-faltante', authMiddleware, tenantMiddleware, (req, res) => {
    res.json({ ok: true });
  });
});

describe('P0-C — tenantMiddleware propaga tenantContext (AsyncLocalStorage)', () => {
  it('request autenticada a ruta protegida tiene tenantContext.getStore() != null dentro del handler', async () => {
    const res = await request(app)
      .get('/tenant-protegido')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // El handler corrió DENTRO de tenantContext.run(...)
    expect(captured.store).not.toBeNull();
    expect(captured.store).toBeDefined();

    // Claims propagados al store (ver tenantMiddleware.js ctx)
    expect(captured.store.org_id).toBe('org-abc-123');
    expect(String(captured.store.user_id)).toBe('42');
    expect(captured.store.user_rol).toBe('ABOGADO');

    // req.organizationId también queda disponible para las rutas
    expect(res.body.organizationId).toBe('org-abc-123');
  });

  it('control negativo: ruta con solo authMiddleware NO tiene store (el contexto lo crea tenantMiddleware)', async () => {
    const res = await request(app)
      .get('/sin-tenant-mw')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(captured.storeSinTenant ?? null).toBeNull();
  });

  it('JWT sin organization_id → 403 y no se crea contexto tenant', async () => {
    const tokenSinOrg = makeToken({ organization_id: undefined });
    const res = await request(app)
      .get('/org-faltante')
      .set('Authorization', `Bearer ${tokenSinOrg}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/organización/i);
  });

  it('la versión lite (requireOrganizationLite) sigue existiendo en authMiddleware pero NO exporta tenantMiddleware', async () => {
    const mod = await import('../middleware/authMiddleware.js');
    expect(typeof mod.requireOrganizationLite).toBe('function');
    expect(mod.tenantMiddleware).toBeUndefined();
  });

  it('requireTenant canónico usa el middleware REAL [authMiddleware, tenantMiddleware]', async () => {
    const { requireTenant } = await import('../middleware/tenantMiddleware.js');
    expect(requireTenant).toBeInstanceOf(Array);
    expect(requireTenant).toHaveLength(2);
    expect(requireTenant[0]).toBe(authMiddleware);
    expect(requireTenant[1]).toBe(tenantMiddleware);
  });
});
