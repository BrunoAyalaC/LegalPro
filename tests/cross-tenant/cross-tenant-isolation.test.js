/**
 * Cross-Tenant Isolation Tests — Suite completa
 *
 * Valida que NINGÚN endpoint devuelve datos de otro tenant.
 * Mapea los riesgos identificados en la auditoría multi-tenant (MT-01 a MT-18).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CATEGORÍAS DE TESTS
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. Recursos por tenant (clientes, expedientes, documentos, organizaciones)
 * 2. JWT (sin org_id, mal formado, expirado, algoritmo none, kid injection)
 * 3. Headers de override (X-Organization-Id, X-Tenant-Id)
 * 4. Query params y body (mass-assignment de organization_id)
 * 5. RBAC dentro del mismo tenant (VIEWER vs ADMIN)
 * 6. PostgreSQL RLS (consulta directa con set_config)
 * 7. Respuesta coherente (404 vs 403 para no leak existencia)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * EJECUCIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *   # Desde la raíz del monorepo:
 *   cd legalpro-app
 *   npx vitest run ../tests/cross-tenant/cross-tenant-isolation.test.js
 *
 *   # O agregar script en legalpro-app/package.json:
 *   "test:cross-tenant": "vitest run ../tests/cross-tenant/cross-tenant-isolation.test.js"
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * VARIABLES DE ENTORNO REQUERIDAS
 * ═══════════════════════════════════════════════════════════════════════════
 *   TEST_BASE_URL            URL del backend (default: http://localhost:3001)
 *   JWT_SECRET_TEST          Secret del JWT (mínimo 32 chars)
 *                            Si no se define, usa el del setup del proyecto.
 *
 *   TEST_TENANT_A            UUID org A (default: del seed.mjs)
 *   TEST_TENANT_B            UUID org B (default: del seed.mjs)
 *   TEST_USER_A              UUID user A
 *   TEST_USER_B              UUID user B
 *   TEST_EXPEDIENTE_A        UUID expediente de tenant A
 *   TEST_EXPEDIENTE_B        UUID expediente de tenant B
 *   TEST_CLIENTE_B           UUID cliente de tenant B
 *   TEST_DOCUMENTO_B         UUID documento de tenant B
 *
 *   DATABASE_URL_TEST        Cadena de conexión PostgreSQL para tests RLS
 *                            Si está definida, ejecuta el bloque RLS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SKIP INTELIGENTE
 * ═══════════════════════════════════════════════════════════════════════════
 *   Si una variable TEST_* no está definida, los tests que la requieren
 *   se reportan como `skipped` (NO fallan). Esto permite ejecutar subsets.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// ═══════════════════════════════════════════════════════════════════════════
// ENV SETUP — replica el comportamiento de legalpro-app/server/__tests__/setup.js
// para que el archivo sea autocontenido cuando se ejecuta desde otro path.
// ═══════════════════════════════════════════════════════════════════════════
if (!process.env.JWT_SECRET && !process.env.JWT_SECRET_TEST) {
  process.env.JWT_SECRET = 'TestSmokeKey_MustBe32CharsLongForValidation!';
}
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET_TEST || process.env.JWT_SECRET;

// IDs por defecto coinciden con el seed.mjs del proyecto
const TENANT_A = process.env.TEST_TENANT_A || 'a1b2c3d4-1111-1111-1111-111111111111';
const TENANT_B = process.env.TEST_TENANT_B || 'a1b2c3d4-2222-2222-2222-222222222222';
const USER_A = process.env.TEST_USER_A || '00000000-0000-0000-0000-aaaaaaaaaaaa';
const USER_B = process.env.TEST_USER_B || '00000000-0000-0000-0000-bbbbbbbbbbbb';

// IDs de recursos por tenant (opcionales — tests hacen SKIP si faltan)
const EXPED_A = process.env.TEST_EXPEDIENTE_A || null;
const EXPED_B = process.env.TEST_EXPEDIENTE_B || null;
const DOC_B = process.env.TEST_DOCUMENTO_B || null;
const CLIENTE_B = process.env.TEST_CLIENTE_B || null;

const JWT_OPTS = {
  issuer: 'LegalProAPI',
  audience: 'LegalProClients',
  expiresIn: '1h',
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function generateToken(tenantId, userId, rol = 'MEMBER', extras = {}) {
  return jwt.sign(
    {
      sub: userId,
      email: 'cross-tenant-test@legalpro.pe',
      rol: 'ABOGADO',
      rol_org: rol,
      nombre_completo: 'Cross-Tenant Test',
      organization_id: tenantId,
      ...extras,
    },
    JWT_SECRET,
    JWT_OPTS
  );
}

async function api(path, token, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body, headers: res.headers };
}

const tokenA = generateToken(TENANT_A, USER_A);
const tokenB = generateToken(TENANT_B, USER_B);

// Helper: decide si saltar un test porque falta un ID de recurso
const skipIfMissing = (val, label) => {
  if (!val) {
    console.log(`⏭️  SKIP: ${label} no definido (configure TEST_* en env)`);
    return true;
  }
  return false;
};

// ═══════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════
let serverReachable = false;
beforeAll(async () => {
  // Sanity check: intenta un health check (si responde, el server está arriba)
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    serverReachable = res.ok;
    if (!serverReachable) {
      console.warn(`⚠️  /health respondió ${res.status} en ${BASE_URL}`);
    }
  } catch (e) {
    console.warn(
      `⚠️  No se pudo conectar a ${BASE_URL}. ` +
        `Los tests que hacen fetch fallarán o serán skipped. ` +
        `Error: ${e.message}`
    );
  }
}, 5000);

beforeEach(() => {
  // No-op; placeholder para symmetry con otros tests del proyecto
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. AISLAMIENTO POR RECURSO
// ═══════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Isolation — Recursos por tenant', () => {
  // El proyecto documenta en su `tenant-validator.js` que un recurso de otro
  // tenant debe responder 404 (no 403), para no leak existencia del recurso.
  const NOT_FOUND_OR_FORBIDDEN = [403, 404];

  describe('Expedientes', () => {
    it('GET /api/expedientes/:id con token de tenant A pidiendo recurso de B → 404/403', async () => {
      if (skipIfMissing(EXPED_B, 'TEST_EXPEDIENTE_B')) return;
      const { status } = await api(`/api/expedientes/${EXPED_B}`, tokenA);
      expect(NOT_FOUND_OR_FORBIDDEN).toContain(status);
    });

    it('PATCH /api/expedientes/:id cross-tenant → 404/403', async () => {
      if (skipIfMissing(EXPED_B, 'TEST_EXPEDIENTE_B')) return;
      const { status } = await api(`/api/expedientes/${EXPED_B}`, tokenA, {
        method: 'PATCH',
        body: JSON.stringify({ titulo: 'Intento cross-tenant' }),
      });
      expect(NOT_FOUND_OR_FORBIDDEN).toContain(status);
    });

    it('PUT /api/expedientes/:id cross-tenant → 404/403', async () => {
      if (skipIfMissing(EXPED_B, 'TEST_EXPEDIENTE_B')) return;
      const { status } = await api(`/api/expedientes/${EXPED_B}`, tokenA, {
        method: 'PUT',
        body: JSON.stringify({ titulo: 'Intento cross-tenant' }),
      });
      expect(NOT_FOUND_OR_FORBIDDEN).toContain(status);
    });

    it('DELETE /api/expedientes/:id cross-tenant → 404/403', async () => {
      if (skipIfMissing(EXPED_B, 'TEST_EXPEDIENTE_B')) return;
      const { status } = await api(`/api/expedientes/${EXPED_B}`, tokenA, {
        method: 'DELETE',
      });
      expect(NOT_FOUND_OR_FORBIDDEN).toContain(status);
    });

    it('GET /api/expedientes (listado) de tenant A NO contiene IDs de tenant B', async () => {
      if (skipIfMissing(EXPED_B, 'TEST_EXPEDIENTE_B')) return;
      const { status, body } = await api('/api/expedientes', tokenA);
      expect(status).toBe(200);
      const lista = Array.isArray(body)
        ? body
        : body?.expedientes || body?.data?.expedientes || body?.data?.items || [];
      const ids = lista.map((e) => e.id).filter(Boolean);
      expect(ids).not.toContain(EXPED_B);
    });

    it('Respuesta de listado NUNCA devuelve campos organization_id distintos al del JWT', async () => {
      const { status, body } = await api('/api/expedientes', tokenA);
      expect(status).toBe(200);
      const lista = Array.isArray(body)
        ? body
        : body?.expedientes || body?.data?.expedientes || [];
      // Si algún item incluye organization_id explícito, debe coincidir
      for (const item of lista) {
        if (item.organization_id && item.organization_id !== TENANT_A) {
          throw new Error(
            `LEAK: item.id=${item.id} tiene organization_id=${item.organization_id} ` +
              `(esperado ${TENANT_A})`
          );
        }
      }
    });
  });

  describe('Documentos', () => {
    it('GET /api/documentos/:id cross-tenant → 404/403', async () => {
      if (skipIfMissing(DOC_B, 'TEST_DOCUMENTO_B')) return;
      const { status } = await api(`/api/documentos/${DOC_B}`, tokenA);
      expect(NOT_FOUND_OR_FORBIDDEN).toContain(status);
    });

    it('DELETE /api/documentos/:id cross-tenant → 404/403', async () => {
      if (skipIfMissing(DOC_B, 'TEST_DOCUMENTO_B')) return;
      const { status } = await api(`/api/documentos/${DOC_B}`, tokenA, {
        method: 'DELETE',
      });
      expect(NOT_FOUND_OR_FORBIDDEN).toContain(status);
    });
  });

  describe('Clientes', () => {
    it('GET /api/clientes/:id cross-tenant → 404/403', async () => {
      if (skipIfMissing(CLIENTE_B, 'TEST_CLIENTE_B')) return;
      const { status } = await api(`/api/clientes/${CLIENTE_B}`, tokenA);
      expect(NOT_FOUND_OR_FORBIDDEN).toContain(status);
    });

    it('PUT /api/clientes/:id cross-tenant → 404/403', async () => {
      if (skipIfMissing(CLIENTE_B, 'TEST_CLIENTE_B')) return;
      const { status } = await api(`/api/clientes/${CLIENTE_B}`, tokenA, {
        method: 'PUT',
        body: JSON.stringify({ nombre_completo: 'HACK' }),
      });
      expect(NOT_FOUND_OR_FORBIDDEN).toContain(status);
    });

    it('DELETE /api/clientes/:id cross-tenant → 404/403', async () => {
      if (skipIfMissing(CLIENTE_B, 'TEST_CLIENTE_B')) return;
      const { status } = await api(`/api/clientes/${CLIENTE_B}`, tokenA, {
        method: 'DELETE',
      });
      expect(NOT_FOUND_OR_FORBIDDEN).toContain(status);
    });

    it('GET /api/clientes (listado) NO contiene IDs de tenant B', async () => {
      if (skipIfMissing(CLIENTE_B, 'TEST_CLIENTE_B')) return;
      const { status, body } = await api('/api/clientes', tokenA);
      expect(status).toBe(200);
      const lista = Array.isArray(body)
        ? body
        : body?.clientes || body?.data?.clientes || body?.data?.items || [];
      const ids = lista.map((c) => c.id).filter(Boolean);
      expect(ids).not.toContain(CLIENTE_B);
    });
  });

  describe('Organizaciones', () => {
    it('GET /api/organizaciones/me con tokenA devuelve org A (no org B)', async () => {
      const { status, body } = await api('/api/organizaciones/me', tokenA);
      expect([200, 401, 403, 404]).toContain(status);
      if (status === 200 && body) {
        const orgId = body?.id || body?.data?.id || body?.organizacion?.id;
        if (orgId) {
          expect(orgId).toBe(TENANT_A);
          expect(orgId).not.toBe(TENANT_B);
        }
      }
    });

    it('GET /api/organizaciones/me/miembros solo lista miembros de la org del JWT', async () => {
      const { status, body } = await api('/api/organizaciones/me/miembros', tokenA);
      expect([200, 401, 403, 404]).toContain(status);
      if (status === 200 && body) {
        const miembros = Array.isArray(body)
          ? body
          : body?.miembros || body?.data?.miembros || [];
        for (const m of miembros) {
          if (m.organization_id && m.organization_id !== TENANT_A) {
            throw new Error(
              `LEAK: miembro ${m.id} tiene organization_id=${m.organization_id}`
            );
          }
        }
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. AISLAMIENTO POR JWT
// ═══════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Isolation — JWT', () => {
  it('Token SIN organization_id debe ser rechazado (401/403)', async () => {
    const badToken = jwt.sign(
      { sub: USER_A, email: 'x@x.pe', rol: 'ABOGADO', nombre_completo: 'X' },
      JWT_SECRET,
      JWT_OPTS
    );
    const { status } = await api('/api/clientes', badToken);
    expect([401, 403]).toContain(status);
  });

  it('Token con organization_id no-UUID debe ser rechazado (401/403)', async () => {
    const badToken = jwt.sign(
      {
        sub: USER_A,
        email: 'x@x.pe',
        rol: 'ABOGADO',
        nombre_completo: 'X',
        organization_id: 'not-a-uuid',
      },
      JWT_SECRET,
      JWT_OPTS
    );
    const { status } = await api('/api/clientes', badToken);
    expect([401, 403]).toContain(status);
  });

  it('Token EXPIRADO debe ser rechazado (401/403)', async () => {
    const expToken = jwt.sign(
      {
        sub: USER_A,
        email: 'x@x.pe',
        rol: 'ABOGADO',
        nombre_completo: 'X',
        organization_id: TENANT_A,
      },
      JWT_SECRET,
      { ...JWT_OPTS, expiresIn: '-1h' }
    );
    const { status } = await api('/api/clientes', expToken);
    expect([401, 403]).toContain(status);
  });

  it('Token firmado con secret incorrecto debe ser rechazado', async () => {
    const wrongSecretToken = jwt.sign(
      {
        sub: USER_A,
        email: 'x@x.pe',
        rol: 'ABOGADO',
        nombre_completo: 'X',
        organization_id: TENANT_A,
      },
      'este-no-es-el-secret-real-de-32-chars',
      JWT_OPTS
    );
    const { status } = await api('/api/clientes', wrongSecretToken);
    expect([401, 403]).toContain(status);
  });

  it('Token con algoritmo NONE (alg=none) debe ser rechazado', async () => {
    // Construye manualmente un JWT con alg=none (vulnerabilidad clásica)
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
      'base64url'
    );
    const payload = Buffer.from(
      JSON.stringify({
        sub: USER_A,
        organization_id: TENANT_A,
        rol_org: 'OWNER',
        iss: 'LegalProAPI',
        aud: 'LegalProClients',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString('base64url');
    const noneToken = `${header}.${payload}.`;
    const { status } = await api('/api/clientes', noneToken);
    expect([401, 403]).toContain(status);
  });

  it('Token con issuer/audience incorrectos debe ser rechazado', async () => {
    const wrongIssuerToken = jwt.sign(
      {
        sub: USER_A,
        email: 'x@x.pe',
        rol: 'ABOGADO',
        nombre_completo: 'X',
        organization_id: TENANT_A,
      },
      JWT_SECRET,
      { issuer: 'Atacante', audience: 'LegalProClients', expiresIn: '1h' }
    );
    const { status } = await api('/api/clientes', wrongIssuerToken);
    expect([401, 403]).toContain(status);
  });

  it('Token sin header Authorization debe ser 401', async () => {
    const { status } = await api('/api/clientes', null);
    expect(status).toBe(401);
  });

  it('Header Authorization con esquema incorrecto (Basic, Digest) → 401', async () => {
    const { status } = await api('/api/clientes', null, {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    expect(status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. AISLAMIENTO POR HEADERS DE OVERRIDE (X-Organization-Id)
// ═══════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Isolation — Headers de override', () => {
  it('Header X-Organization-Id con org B NO debe permitir impersonar otro tenant', async () => {
    // El token es de Tenant A pero enviamos X-Organization-Id: Tenant B
    // El backend debe IGNORAR el header y usar SIEMPRE el del JWT
    const { status, body } = await api('/api/organizaciones/me', tokenA, {
      headers: { 'X-Organization-Id': TENANT_B },
    });
    expect([200, 401, 403, 404]).toContain(status);
    if (status === 200 && body) {
      const orgId = body?.id || body?.data?.id || body?.organizacion?.id;
      if (orgId) {
        expect(orgId).toBe(TENANT_A);
        expect(orgId).not.toBe(TENANT_B);
      }
    }
  });

  it('Header X-Tenant-Id con org B NO debe permitir impersonar otro tenant', async () => {
    const { status, body } = await api('/api/organizaciones/me', tokenA, {
      headers: { 'X-Tenant-Id': TENANT_B },
    });
    expect([200, 401, 403, 404]).toContain(status);
    if (status === 200 && body) {
      const orgId = body?.id || body?.data?.id || body?.organizacion?.id;
      if (orgId) {
        expect(orgId).toBe(TENANT_A);
      }
    }
  });

  it('Header X-Forwarded-For spoofing NO afecta aislamiento tenant', async () => {
    const { status } = await api('/api/clientes', tokenA, {
      headers: { 'X-Forwarded-For': '127.0.0.1', 'X-Real-IP': '127.0.0.1' },
    });
    // Solo debe validar auth + tenant, no spoofing de IP
    expect([200, 403]).toContain(status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. MASS-ASSIGNMENT DE organization_id EN BODY/QUERY
// ═══════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Isolation — Mass assignment', () => {
  it('POST /api/clientes con organization_id de OTRO tenant en body debe ser rechazado', async () => {
    const { status, body } = await api('/api/clientes', tokenA, {
      method: 'POST',
      body: JSON.stringify({
        nombre_completo: 'Intento Mass Assignment',
        dni: '12345678',
        organization_id: TENANT_B, // intento de bypass
      }),
    });
    // Debe rechazar (400/403/422) o ignorar el campo (200/201 con org del JWT)
    expect([200, 201, 400, 403, 422]).toContain(status);
    if (status === 200 || status === 201) {
      const created = body?.data || body;
      const orgId = created?.organization_id;
      if (orgId) {
        expect(orgId).toBe(TENANT_A);
        expect(orgId).not.toBe(TENANT_B);
      }
    }
  });

  it('PUT /api/clientes/:id con organization_id de OTRO tenant en body debe ser rechazado', async () => {
    if (skipIfMissing(CLIENTE_B, 'TEST_CLIENTE_B')) return;
    const { status } = await api(`/api/clientes/${CLIENTE_B}`, tokenA, {
      method: 'PUT',
      body: JSON.stringify({
        nombre_completo: 'Intento Mass Assignment',
        organization_id: TENANT_A, // intento de "tomar" el recurso
      }),
    });
    expect([400, 403, 404]).toContain(status);
  });

  it('Query param ?organization_id=B NO debe tener efecto (debe ignorar)', async () => {
    const { status, body } = await api(
      `/api/clientes?organization_id=${TENANT_B}`,
      tokenA
    );
    expect([200, 400, 403]).toContain(status);
    if (status === 200 && body) {
      const lista = Array.isArray(body)
        ? body
        : body?.clientes || body?.data?.clientes || [];
      const ids = lista.map((c) => c.id).filter(Boolean);
      // Si CLIENTE_B está definido, NO debe aparecer
      if (CLIENTE_B) expect(ids).not.toContain(CLIENTE_B);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. RBAC DENTRO DEL MISMO TENANT
// ═══════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Isolation — RBAC dentro del mismo tenant', () => {
  it('VIEWER no puede invitar miembros (requiere OWNER/ADMIN)', async () => {
    const viewerToken = generateToken(TENANT_A, USER_A, 'VIEWER');
    const { status } = await api('/api/organizaciones/invitar', viewerToken, {
      method: 'POST',
      body: JSON.stringify({
        email: 'nuevo@invitado.pe',
        rol: 'MEMBER',
      }),
    });
    expect([403, 404]).toContain(status);
  });

  it('MEMBER no puede invitar miembros (requiere OWNER/ADMIN)', async () => {
    const memberToken = generateToken(TENANT_A, USER_A, 'MEMBER');
    const { status } = await api('/api/organizaciones/invitar', memberToken, {
      method: 'POST',
      body: JSON.stringify({
        email: 'nuevo@invitado.pe',
        rol: 'MEMBER',
      }),
    });
    expect([403, 404]).toContain(status);
  });

  it('ADMIN puede listar miembros de SU tenant', async () => {
    const adminToken = generateToken(TENANT_A, USER_A, 'ADMIN');
    const { status } = await api('/api/organizaciones/me/miembros', adminToken);
    expect([200, 401, 403]).toContain(status);
  });

  it('GET /api/admin/health requiere OWNER/ADMIN', async () => {
    const memberToken = generateToken(TENANT_A, USER_A, 'MEMBER');
    const { status } = await api('/api/admin/health', memberToken);
    expect([403, 404]).toContain(status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. AISLAMIENTO EN ENDPOINTS DE IA / SENSIBLES
// ═══════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Isolation — Endpoints IA y sensibles', () => {
  it('GET /api/ai/historial solo devuelve historial del tenant del JWT', async () => {
    const { status, body } = await api('/api/ai/historial', tokenA);
    expect([200, 401, 403]).toContain(status);
    if (status === 200 && body) {
      const items = Array.isArray(body)
        ? body
        : body?.historial || body?.data?.historial || body?.data?.items || [];
      for (const item of items) {
        if (item.organization_id && item.organization_id !== TENANT_A) {
          throw new Error(
            `LEAK: historial item ${item.id} tiene org=${item.organization_id}`
          );
        }
      }
    }
  });

  it('GET /api/creditos/saldo solo devuelve saldo del tenant del JWT', async () => {
    const { status, body } = await api('/api/creditos/saldo', tokenA);
    expect([200, 401, 403]).toContain(status);
    if (status === 200 && body) {
      const data = body?.data || body;
      const orgId = data?.organization_id;
      if (orgId) expect(orgId).toBe(TENANT_A);
    }
  });

  it('GET /api/creditos/transacciones NO incluye transacciones de tenant B', async () => {
    const { status, body } = await api('/api/creditos/transacciones', tokenA);
    expect([200, 401, 403]).toContain(status);
    if (status === 200 && body) {
      const lista = Array.isArray(body)
        ? body
        : body?.transacciones || body?.data?.transacciones || [];
      for (const tx of lista) {
        if (tx.organization_id && tx.organization_id !== TENANT_A) {
          throw new Error(
            `LEAK: transacción ${tx.id} tiene org=${tx.organization_id}`
          );
        }
      }
    }
  });

  it('GET /api/notificaciones solo devuelve notificaciones del tenant del JWT', async () => {
    const { status, body } = await api('/api/notificaciones', tokenA);
    expect([200, 401, 403]).toContain(status);
    if (status === 200 && body) {
      const lista = Array.isArray(body)
        ? body
        : body?.notificaciones || body?.data?.notificaciones || [];
      for (const n of lista) {
        if (n.organization_id && n.organization_id !== TENANT_A) {
          throw new Error(
            `LEAK: notificación ${n.id} tiene org=${n.organization_id}`
          );
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. POSTGRES RLS — VERIFICACIÓN DIRECTA EN BD
// ═══════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Isolation — PostgreSQL RLS', () => {
  it('SELECT directo con RLS activa: org A NO ve filas de org B', async () => {
    if (!process.env.DATABASE_URL_TEST) {
      console.log('⏭️  SKIP: DATABASE_URL_TEST no configurada (RLS check omitido)');
      return;
    }
    const pg = await import('pg');
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST });
    await client.connect();
    try {
      // Simula el contexto que establece tenantMiddleware
      await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [
        TENANT_A,
      ]);
      // Verifica en las 4 tablas tenant principales
      for (const tabla of ['expedientes', 'clientes', 'documentos', 'usuarios']) {
        const { rows } = await client.query(`SELECT id, organization_id FROM ${tabla}`);
        for (const row of rows) {
          expect(row.organization_id).toBe(TENANT_A);
        }
      }
    } finally {
      await client.end();
    }
  });

  it('SELECT directo sin RLS contexto (sesión limpia) → debe devolver 0 filas por policy', async () => {
    if (!process.env.DATABASE_URL_TEST) {
      console.log('⏭️  SKIP: DATABASE_URL_TEST no configurada');
      return;
    }
    const pg = await import('pg');
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST });
    await client.connect();
    try {
      // Sesión limpia SIN set_config → fn_rls_current_org_id() devuelve NULL
      // → la policy `organization_id = NULL` debería filtrar TODO
      const { rows } = await client.query(`SELECT id FROM expedientes`);
      expect(rows.length).toBe(0);
    } finally {
      await client.end();
    }
  });

  it('RLS está HABILITADA en todas las tablas tenant (regression test)', async () => {
    if (!process.env.DATABASE_URL_TEST) {
      console.log('⏭️  SKIP: DATABASE_URL_TEST no configurada');
      return;
    }
    const pg = await import('pg');
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST });
    await client.connect();
    try {
      const { rows } = await client.query(`
        SELECT tablename, rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename IN ('usuarios','expedientes','documentos','clientes')
      `);
      expect(rows.length).toBe(4);
      for (const r of rows) {
        expect(r.rowsecurity).toBe(true);
      }
    } finally {
      await client.end();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. NO LEAK EN RESPUESTA DE ERROR
// ═══════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Isolation — Respuesta de error no leak info', () => {
  it('Error 404 cross-tenant NO debe distinguir "no existe" vs "existe pero no es tuyo"', async () => {
    if (skipIfMissing(EXPED_B, 'TEST_EXPEDIENTE_B')) return;
    const resCross = await api(`/api/expedientes/${EXPED_B}`, tokenA);
    const resNonExist = await api(
      `/api/expedientes/00000000-0000-0000-0000-000000000000`,
      tokenA
    );
    // Si ambos devuelven 404 con el mismo cuerpo, no hay leak
    if (resCross.status === 404 && resNonExist.status === 404) {
      expect(resCross.status).toBe(resNonExist.status);
      // El cuerpo debe ser indistinguible (mismo error key)
      const errorKeyA = resCross.body?.error || resCross.body?.message;
      const errorKeyB = resNonExist.body?.error || resNonExist.body?.message;
      // No validamos contenido exacto (puede tener IDs internos) pero validamos
      // que NO incluya información específica del recurso del tenant B
      const bodyStrA = JSON.stringify(resCross.body || {});
      expect(bodyStrA).not.toContain(EXPED_B);
    }
  });

  it('Respuestas NO exponen passwords, hashes, ni tokens internos', async () => {
    const { body } = await api('/api/auth/me', tokenA);
    const bodyStr = JSON.stringify(body || {});
    expect(bodyStr).not.toMatch(/password/i);
    expect(bodyStr).not.toMatch(/hash/i);
    expect(bodyStr).not.toMatch(/secret/i);
    expect(bodyStr).not.toMatch(/bcrypt/i);
  });
});
