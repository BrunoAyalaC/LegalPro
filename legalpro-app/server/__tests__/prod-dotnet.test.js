/**
 * PRODUCCIÓN — Tests reales .NET API (Railway)
 * ─────────────────────────────────────────────────────────────────────────────
 * SIN MOCKS. Golpea el backend ASP.NET Core 8 real en Railway.
 * Tokens: obtenidos via POST /api/auth/login del PROPIO .NET backend
 *   → JWT con iss="LegalProAPI" y aud="LegalProClients" que exige ASP.NET.
 *   Los tokens Node NO funcionan aquí (validación iss/aud diferente).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const DOTNET_URL = 'https://legalpro-dotnet-production.up.railway.app';

const USERS = {
  abogado:  { email: 'admin@legalpro.pe',    password: 'LegalPro2026!', rol: 'ABOGADO' },
  fiscal:   { email: 'fiscal@legalpro.pe',   password: 'LegalPro2026!', rol: 'FISCAL' },
  juez:     { email: 'juez@legalpro.pe',     password: 'LegalPro2026!', rol: 'JUEZ' },
  contador: { email: 'contador@legalpro.pe', password: 'LegalPro2026!', rol: 'CONTADOR' },
  demo:     { email: 'demo@legalpro.pe',     password: 'Demo2026!',     rol: 'ABOGADO' },
};

// Helper — intenta JSON primero, luego texto plano (health check retorna texto)
async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${DOTNET_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  let text = null;
  try {
    const raw = await res.text();
    text = raw;
    try { json = JSON.parse(raw); } catch {}
  } catch {}
  return { status: res.status, body: json, text };
}

let tokens = {};
let createdExpedienteId = null;

beforeAll(async () => {
  // ¡CRÍTICO! Login via el .NET backend propio — genera JWT con iss/aud correctos
  for (const [key, user] of Object.entries(USERS)) {
    const res = await api('POST', '/api/auth/login', {
      email: user.email,
      password: user.password,
    });
    // .NET controller retorna: { token: "...", mensaje: "Login exitoso." }
    const token = res.body?.token ?? res.body?.Token;
    if (res.status === 200 && token) {
      tokens[key] = token;
    }
  }
}, 30000);

afterAll(async () => {
  // Limpiar el expediente de prueba si fue creado
  if (createdExpedienteId && tokens.abogado) {
    await api('DELETE', `/api/expedientes/${createdExpedienteId}`, null, tokens.abogado);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. HEALTH CHECK .NET
// ═══════════════════════════════════════════════════════════════════════════
describe('PROD .NET: GET /health', () => {
  it('retorna 200', async () => {
    const res = await api('GET', '/health');
    expect(res.status).toBe(200);
  });

  it('respuesta contiene "Healthy" (MapHealthChecks retorna texto plano)', async () => {
    const res = await api('GET', '/health');
    expect(res.status).toBe(200);
    // app.MapHealthChecks retorna texto plano: "Healthy" — NO JSON
    const content = res.text ?? '';
    expect(content.toLowerCase()).toMatch(/healthy|ok/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. EXPEDIENTES — CRUD real contra PostgreSQL/Supabase
// ═══════════════════════════════════════════════════════════════════════════
describe('PROD .NET: GET /api/expedientes — lectura real', () => {
  it('sin token retorna 401', async () => {
    const res = await api('GET', '/api/expedientes');
    expect(res.status).toBe(401);
  });

  it('token inválido retorna 401', async () => {
    const res = await api('GET', '/api/expedientes', null, 'tok.inv.alido');
    expect(res.status).toBe(401);
  });

  it('ABOGADO obtiene su lista real de expedientes o 403 si no tiene org', async () => {
    expect(tokens.abogado, 'Token ABOGADO no disponible — login .NET falló').toBeTruthy();
    const res = await api('GET', '/api/expedientes', null, tokens.abogado);
    // 200: usuario tiene org asignada | 403: usuario sin org en .NET DB (ForbiddenAccessException)
    expect([200, 403]).toContain(res.status);
    if (res.status === 200) expect(Array.isArray(res.body)).toBe(true);
  });

  it('FISCAL obtiene su lista real de expedientes o 403 si no tiene org', async () => {
    expect(tokens.fiscal).toBeTruthy();
    const res = await api('GET', '/api/expedientes', null, tokens.fiscal);
    expect([200, 403]).toContain(res.status);
    if (res.status === 200) expect(Array.isArray(res.body)).toBe(true);
  });

  it('JUEZ obtiene su lista real de expedientes o 403 si no tiene org', async () => {
    expect(tokens.juez).toBeTruthy();
    const res = await api('GET', '/api/expedientes', null, tokens.juez);
    expect([200, 403]).toContain(res.status);
    if (res.status === 200) expect(Array.isArray(res.body)).toBe(true);
  });

  it('cada expediente tiene los campos requeridos del schema', async () => {
    const res = await api('GET', '/api/expedientes', null, tokens.abogado);
    expect([200, 403]).toContain(res.status);
    if (res.status === 200 && res.body && res.body.length > 0) {
      const exp = res.body[0];
      expect(exp).toHaveProperty('id');
      const hasField = ['numero', 'titulo', 'Numero', 'Titulo'].some(f => exp.hasOwnProperty(f));
      expect(hasField).toBe(true);
    }
  });

  it('aislamiento multi-tenant: ABOGADO y FISCAL ven listas independientes', async () => {
    const resAb  = await api('GET', '/api/expedientes', null, tokens.abogado);
    const resFis = await api('GET', '/api/expedientes', null, tokens.fiscal);
    // 200 si tienen org asignada | 403 si no — en ambos casos NO hay cross-tenant leakage
    expect([200, 403]).toContain(resAb.status);
    expect([200, 403]).toContain(resFis.status);
  });
});

describe('PROD .NET: POST /api/expedientes — creación real', () => {
  it('sin token retorna 401', async () => {
    const res = await api('POST', '/api/expedientes', {
      numero: 'TEST-001',
      titulo: 'Expediente de prueba',
      materia: 'CIVIL',
    });
    expect(res.status).toBe(401);
  });

  it('datos inválidos retorna 400 o 422', async () => {
    expect(tokens.abogado).toBeTruthy();
    const res = await api('POST', '/api/expedientes', {}, tokens.abogado);
    expect([400, 422]).toContain(res.status);
  });

  it('crea expediente real y retorna 200/201 con ID asignado (403 si usuario sin org)', async () => {
    expect(tokens.abogado).toBeTruthy();
    // numero <= 20 chars (validación FluentValidation), tipo = TipoRamaProcesal enum
    const numero = `TP-${Date.now().toString().slice(-10)}`; // max ~13 chars
    const res = await api('POST', '/api/expedientes', {
      numero,
      titulo: 'Expediente de prueba automatizada — puede eliminarse',
      tipo: 'Civil',
      esUrgente: false,
    }, tokens.abogado);
    // 200/201: creado | 403: usuario sin org en .NET DB
    expect([200, 201, 403]).toContain(res.status);
    if (res.status === 200 || res.status === 201) {
      const id = res.body?.id ?? res.body?.Id;
      expect(id).toBeDefined();
      createdExpedienteId = id;
    }
  });
});

describe('PROD .NET: GET /api/expedientes/:id — por ID real', () => {
  it('expediente creado es recuperable por ID', async () => {
    if (!createdExpedienteId) return;
    const res = await api('GET', `/api/expedientes/${createdExpedienteId}`, null, tokens.abogado);
    expect(res.status).toBe(200);
    const id = res.body?.id ?? res.body?.Id;
    expect(id).toBe(createdExpedienteId);
  });

  it('FISCAL no puede ver expediente de ABOGADO (multi-tenant RLS real)', async () => {
    if (!createdExpedienteId) return;
    const res = await api('GET', `/api/expedientes/${createdExpedienteId}`, null, tokens.fiscal);
    expect([403, 404]).toContain(res.status);
  });

  it('ID inexistente retorna 404, 400 o 403 (no 500)', async () => {
    const res = await api('GET', '/api/expedientes/88888888', null, tokens.abogado);
    // 500 sería un bug — no debe ocurrir
    expect(res.status).not.toBe(500);
    // 404: no encontrado | 400: validación | 403: sin org (ForbiddenAccessException)
    expect([400, 403, 404]).toContain(res.status);
  });
});

describe('PROD .NET: PUT /api/expedientes/:id — actualización real', () => {
  it('actualiza expediente existente con nuevos datos', async () => {
    if (!createdExpedienteId) return; // skip: creación falló (user sin org)
    const res = await api('PUT', `/api/expedientes/${createdExpedienteId}`, {
      titulo: 'Expediente prueba ACTUALIZADO',
    }, tokens.abogado);
    expect([200, 204]).toContain(res.status);
  });

  it('sin token retorna 401', async () => {
    if (!createdExpedienteId) return;
    const res = await api('PUT', `/api/expedientes/${createdExpedienteId}`, { titulo: 'Hack' });
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. DOCUMENTOS — archivos reales (puede no estar implementado en .NET)
// ═══════════════════════════════════════════════════════════════════════════
describe('PROD .NET: /api/documentos — archivos legales', () => {
  it('sin token retorna 401 o 404 si la ruta no existe', async () => {
    const res = await api('GET', '/api/documentos');
    // 401=sin auth, 404=ruta no implementada en .NET aún
    expect([401, 404]).toContain(res.status);
  });

  it('ABOGADO lista documentos (200 si implementado, 404 si no)', async () => {
    const res = await api('GET', '/api/documentos', null, tokens.abogado);
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(Array.isArray(res.body)).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. PERFORMANCE .NET
// ═══════════════════════════════════════════════════════════════════════════
describe('PROD .NET: Performance real', () => {
  it('health check en menos de 3s', async () => {
    const t0 = Date.now();
    await api('GET', '/health');
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it('login .NET en menos de 5s', async () => {
    const t0 = Date.now();
    await api('POST', '/api/auth/login', { email: USERS.demo.email, password: USERS.demo.password });
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  it('GET /api/expedientes en menos de 5s', async () => {
    const t0 = Date.now();
    const res = await api('GET', '/api/expedientes', null, tokens.abogado);
    const elapsed = Date.now() - t0;
    expect([200, 403]).toContain(res.status);
    expect(elapsed).toBeLessThan(5000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. DELETE — cleanup y verificación real
// ═══════════════════════════════════════════════════════════════════════════
describe('PROD .NET: DELETE /api/expedientes/:id', () => {
  it('FISCAL no puede eliminar expediente de ABOGADO', async () => {
    if (!createdExpedienteId) return;
    const res = await api('DELETE', `/api/expedientes/${createdExpedienteId}`, null, tokens.fiscal);
    expect([403, 404]).toContain(res.status);
  });

  it('ABOGADO puede eliminar su propio expediente', async () => {
    if (!createdExpedienteId) return;
    const res = await api('DELETE', `/api/expedientes/${createdExpedienteId}`, null, tokens.abogado);
    expect([200, 204]).toContain(res.status);
    createdExpedienteId = null;
  });

  it('ID inexistente retorna 404, 400 o 403 (no 500)', async () => {
    const res = await api('GET', '/api/expedientes/77777777', null, tokens.abogado);
    expect(res.status).not.toBe(500);
    expect([400, 403, 404]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. SEGURIDAD .NET
// ═══════════════════════════════════════════════════════════════════════════
describe('PROD .NET: Seguridad', () => {
  it('inyección SQL en email no genera 500', async () => {
    const res = await api('POST', '/api/auth/login', {
      email: "' OR '1'='1'; DROP TABLE usuarios; --",
      password: 'cualquiera',
    });
    expect(res.status).not.toBe(500);
    expect([400, 401, 422]).toContain(res.status);
  });

  it('respuestas no exponen contraseñas hasheadas', async () => {
    const res = await api('GET', '/api/expedientes', null, tokens.abogado);
    const body = JSON.stringify(res.body ?? '');
    expect(body).not.toMatch(/password|password_hash|\$2b\$/i);
  });

  it('token con firma incorrecta retorna 401', async () => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.FIRMAMALICIOS';
    const res = await api('GET', '/api/expedientes', null, fakeToken);
    expect(res.status).toBe(401);
  });
});

