/**
 * TESTS — /api/herramientas (6 endpoints determinísticos, sin IA = sin costo)
 * ─────────────────────────────────────────────────────────────────────────────
 * Cubre: GET /uit · POST /interes-legal · POST /plazos-habiles ·
 *        GET /delitos · POST /prescripcion · GET /tasas-bcrp + guard 401.
 *
 * Setup:
 *  - Mock de cache.js (isAvailable=false): authMiddleware lo consulta para el
 *    brute-force check; sin Redis cae al Map en memoria (no hay intentos fallidos).
 *  - NO se mockea authMiddleware: se monta el router real en una app Express de
 *    test con JWT válido firmado con process.env.JWT_SECRET (patrón rbac.test.js,
 *    issuer/audience idénticos a los exigidos por jwt.verify).
 *  - No toca DB (cálculo puro) → no hace falta mockear db.js.
 *
 * Notas de verificación legal usadas en las aserciones:
 *  - Interés simple: capital × (tasa/100) × (días/360). 10000×0.076661×59/360
 *    = 125.6388… → round2 = 125.64.
 *  - CPC Art. 144: plazos en días hábiles; feriados de catalogs/feriados-peru.json.
 *  - CP Art. 85: plazo = pena máx + mitad, mín. 2 años. CP Art. 88: cada acto
 *    interruptivo inicia un plazo COMPLETO nuevo → total = plazo × (interruptores+1).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import express from 'express';

// ── Mock cache.js (authMiddleware lo importa para brute-force) ──────────────
vi.mock('../cache.js', () => ({
  getClient: vi.fn(async () => null),
  hashKey: vi.fn((prefix, ...parts) => `${prefix}:${parts.join(':')}`),
  get: vi.fn(async () => null),
  set: vi.fn(async () => undefined),
  del: vi.fn(async () => undefined),
  isAvailable: vi.fn(async () => false),
  isAvailableSync: vi.fn(() => false),
}));

// JWT_SECRET antes de que cualquier it() corra (authMiddleware lo lee lazy por
// invocación, pero fijamos el orden explícito como en rbac.test.js).
process.env.JWT_SECRET ??= 'test-jwt-secret-para-vitest-32-chars-minimo!!';
const JWT_SECRET = process.env.JWT_SECRET;

// Helper: JWT válido con los claims mínimos del estudio
function token() {
  return jwt.sign(
    {
      sub: '00000000-0000-0000-0000-000000000010',
      email: 'abogado@legalpro.pe',
      rol: 'ABOGADO',
      organization_id: '00000000-0000-0000-0000-000000000001',
    },
    JWT_SECRET,
    { issuer: 'LegalProAPI', audience: 'LegalProClients', expiresIn: '1h' }
  );
}

const bearer = () => ['Authorization', `Bearer ${token()}`];

let app;
beforeAll(async () => {
  // Import dinámico DESPUÉS del vi.mock y del env var (higiene de orden)
  const { default: herramientasRouter } = await import('../routes/herramientas.js');
  app = express();
  app.use(express.json());
  app.use('/api/herramientas', herramientasRouter);
});

// ═══════════════════════════════════════════════════════════════════════════
// [1] GET /uit
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /api/herramientas/uit', () => {
  it('devuelve 200 con valor_uit_2026=5350 y verificado:false presente', async () => {
    const res = await request(app)
      .get('/api/herramientas/uit')
      .set(...bearer());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.valor_uit_2026).toBe(5350);
    expect(res.body.data).toHaveProperty('verificado', false);
    expect(typeof res.body.data.fuente).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// [2-4] POST /interes-legal
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /api/herramientas/interes-legal', () => {
  it('[happy path] capital 10000, tasa 7.6661, 2026-01-01→2026-03-01 (59 días) → interes ≈ 125.64', async () => {
    const res = await request(app)
      .post('/api/herramientas/interes-legal')
      .set(...bearer())
      .send({ capital: 10000, tasa_anual_pct: 7.6661, desde: '2026-01-01', hasta: '2026-03-01' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { interes, dias, total } = res.body.data;
    // Estructura requerida
    expect(res.body.data).toEqual(expect.objectContaining({
      interes: expect.any(Number),
      dias: expect.any(Number),
      total: expect.any(Number),
    }));
    // 31 (ene) + 28 (feb 2026 no bisiesto) = 59 días calendario
    expect(dias).toBe(59);
    // 10000 × 0.076661 × 59/360 = 125.6388… → redondeo a 2 decimales
    expect(interes).toBeCloseTo(125.64, 2);
    expect(total).toBeCloseTo(10000 + 125.64, 2);
  });

  it('fecha inexistente "2026-02-30" → 400 VALIDATION_ERROR (nunca 500)', async () => {
    const res = await request(app)
      .post('/api/herramientas/interes-legal')
      .set(...bearer())
      .send({ capital: 10000, tasa_anual_pct: 7.6661, desde: '2026-01-01', hasta: '2026-02-30' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'hasta' })])
    );
  });

  it('capital negativo → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/herramientas/interes-legal')
      .set(...bearer())
      .send({ capital: -5000, tasa_anual_pct: 7.6661, desde: '2026-01-01', hasta: '2026-03-01' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.some((d) => d.path === 'capital')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// [5-7] POST /plazos-habiles (CPC Art. 144)
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /api/herramientas/plazos-habiles', () => {
  it('viernes 2026-01-02 + 5 hábiles → vence viernes 2026-01-09, salta fin de semana (2 días)', async () => {
    const res = await request(app)
      .post('/api/herramientas/plazos-habiles')
      .set(...bearer())
      .send({ fecha_inicio: '2026-01-02', dias_habiles: 5 }); // 2026-01-02 es viernes

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fecha_vencimiento).toBe('2026-01-09'); // viernes siguiente
    expect(res.body.data.dias_saltados).toBe(2); // sáb 03 + dom 04
    expect(res.body.data.feriados_encontrados).toEqual([]);
    expect(res.body.data.base_legal).toContain('CPC Art. 144');
  });

  it('cruza feriado fijo Año Nuevo (2026-01-01) → lo salta y aparece en feriados_encontrados', async () => {
    // Mié 2025-12-31 + 1 hábil: jue 01-01 es Año Nuevo (feriados_fijos "01-01")
    // → vence vie 2026-01-02.
    const res = await request(app)
      .post('/api/herramientas/plazos-habiles')
      .set(...bearer())
      .send({ fecha_inicio: '2025-12-31', dias_habiles: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.fecha_vencimiento).toBe('2026-01-02');
    expect(res.body.data.dias_saltados).toBe(1);
    expect(res.body.data.feriados_encontrados).toContain('2026-01-01');
  });

  it('cruza feriado fijo San Pedro y San Pablo (2026-06-29, lunes) → vence 2026-06-30', async () => {
    // Vie 2026-06-26 + 1 hábil: sáb 27, dom 28 y lun 29 (feriado) saltados.
    const res = await request(app)
      .post('/api/herramientas/plazos-habiles')
      .set(...bearer())
      .send({ fecha_inicio: '2026-06-26', dias_habiles: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.fecha_vencimiento).toBe('2026-06-30');
    expect(res.body.data.dias_saltados).toBe(3); // sáb + dom + feriado
    expect(res.body.data.feriados_encontrados).toEqual(['2026-06-29']);
  });

  it('fecha inexistente "2026-02-30" → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/herramientas/plazos-habiles')
      .set(...bearer())
      .send({ fecha_inicio: '2026-02-30', dias_habiles: 5 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details[0].path).toBe('fecha_inicio');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// [8-9] GET /delitos
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /api/herramientas/delitos', () => {
  it('?q=hurto → resultados con estructura {fuente, articulo, nombre, pena}', async () => {
    const res = await request(app)
      .get('/api/herramientas/delitos')
      .query({ q: 'hurto' })
      .set(...bearer());

    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    for (const d of res.body.data) {
      expect(d).toEqual(expect.objectContaining({
        fuente: expect.any(String),
        articulo: expect.anything(),
        nombre: expect.any(String),
        pena: expect.anything(),
      }));
    }
    // Todos los hits contienen "hurto" (búsqueda case-insensitive sobre nombre)
    const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    expect(res.body.data.every((d) => norm(d.nombre).includes('hurto'))).toBe(true);
  });

  it('?q=colusion SIN tilde encuentra "Colusión" (normalización NFD)', async () => {
    // El catálogo no tiene ningún delito llamado "corrupción" (la palabra solo
    // aparece en campos no indexados), así que la tolerancia a tildes se verifica
    // con Colusión — mismo mecanismo quitarTildes(NFD) del endpoint.
    const res = await request(app)
      .get('/api/herramientas/delitos')
      .query({ q: 'colusion' })
      .set(...bearer());

    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    const nombres = res.body.data.map((d) => d.nombre);
    expect(nombres).toContain('Colusión');
    expect(nombres).toContain('Colusión Agravada');
    // "Colusión" vive en ambos catálogos → la búsqueda debe cubrir ambas fuentes
    const fuentes = new Set(res.body.data.map((d) => d.fuente));
    expect(fuentes.has('tipos-penales')).toBe(true);
    expect(fuentes.has('delitos-economicos')).toBe(true);
  });

  it('sin q → array no vacío con AMBAS fuentes', async () => {
    const res = await request(app)
      .get('/api/herramientas/delitos')
      .set(...bearer());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    const fuentes = new Set(res.body.data.map((d) => d.fuente));
    expect(fuentes.has('tipos-penales')).toBe(true);
    expect(fuentes.has('delitos-economicos')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// [10-12] POST /prescripcion (CP Arts. 85 y 88)
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /api/herramientas/prescripcion', () => {
  it('pena 4 años, hecho 2020-01-15, 0 interruptores → plazo 6 años, vencía 2026-01-15 (prescrito)', async () => {
    const res = await request(app)
      .post('/api/herramientas/prescripcion')
      .set(...bearer())
      .send({ pena_anios: 4, fecha_hecho: '2020-01-15', interruptores: 0 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // CP Art. 85: max(4 × 1.5, 2) = 6 años
    expect(res.body.data.plazo_anios).toBe(6);
    expect(res.body.data.fecha_prescripcion).toBe('2026-01-15');

    // prescrito ⇔ hoy > fecha_prescripcion (se calcula dinámico para no pudrir el test)
    const vencio = Date.now() > new Date('2026-01-15T00:00:00').getTime();
    expect(res.body.data.prescrito).toBe(vencio);
    if (vencio) expect(res.body.data.dias_restantes).toBeLessThanOrEqual(0);
  });

  it('pena 1 año con 2 interruptores → plazo base 2 (mín. Art.85) × 3 plazos completos (Art.88)', async () => {
    const res = await request(app)
      .post('/api/herramientas/prescripcion')
      .set(...bearer())
      .send({ pena_anios: 1, fecha_hecho: '2024-01-15', interruptores: 2 });

    expect(res.status).toBe(200);
    // CP Art. 85: max(1 × 1.5, 2) = 2 años de plazo base
    expect(res.body.data.plazo_anios).toBe(2);
    // CP Art. 88: cada interrupción inicia un plazo COMPLETO nuevo →
    // total = 2 × (1 + 2) = 6 años desde el hecho (72 meses).
    expect(res.body.data.fecha_prescripcion).toBe('2030-01-15');
    expect(res.body.data.prescrito).toBe(false);
    expect(res.body.data.dias_restantes).toBeGreaterThan(0);
  });

  it('pena_anios=200 → 400 (cota .max(100))', async () => {
    const res = await request(app)
      .post('/api/herramientas/prescripcion')
      .set(...bearer())
      .send({ pena_anios: 200, fecha_hecho: '2020-01-15', interruptores: 0 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.some((d) => d.path === 'pena_anios')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// [13] GET /tasas-bcrp — feature flag OFF → fallback stale
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /api/herramientas/tasas-bcrp', () => {
  it('FEATURE_BCRP=false → fallback {tasa_moratoria_pct:7.6661, stale:true}', async () => {
    const prevFeature = process.env.FEATURE_BCRP;
    const prevUrl = process.env.BCRP_API_URL;
    process.env.FEATURE_BCRP = 'false';
    delete process.env.BCRP_API_URL;

    try {
      const res = await request(app)
        .get('/api/herramientas/tasas-bcrp')
        .set(...bearer());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ tasa_moratoria_pct: 7.6661, stale: true });
    } finally {
      // Restaurar env para no contaminar otros tests del worker
      if (prevFeature === undefined) delete process.env.FEATURE_BCRP;
      else process.env.FEATURE_BCRP = prevFeature;
      if (prevUrl !== undefined) process.env.BCRP_API_URL = prevUrl;
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// [14] Auth guard — authMiddleware activo en todas las rutas
// ═══════════════════════════════════════════════════════════════════════════
describe('Auth guard (sin token → 401)', () => {
  it.each([
    ['GET', '/api/herramientas/uit'],
    ['GET', '/api/herramientas/delitos'],
    ['GET', '/api/herramientas/tasas-bcrp'],
    ['POST', '/api/herramientas/interes-legal'],
    ['POST', '/api/herramientas/plazos-habiles'],
    ['POST', '/api/herramientas/prescripcion'],
  ])('%s %s sin Authorization → 401', async (method, url) => {
    const req = request(app)[method.toLowerCase()](url);
    if (method === 'POST') req.send({});
    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });
});
