// legalpro-app/server/smoke-production.mjs
// Smoke test contra stacks Railway (Node + .NET + Frontend)
//
// ⚠️  POR DEFECTO apunta a STAGING. Para correr contra PRODUCCIÓN:
//     SMOKE_NODE_URL=https://... SMOKE_DOTNET_URL=https://... SMOKE_FRONTEND_URL=https://...
//     NO usar defaults de producción accidentalmente.

const STACKS = {
  node: process.env.SMOKE_NODE_URL || 'https://legalpro-node-staging.up.railway.app',
  dotnet: process.env.SMOKE_DOTNET_URL || 'https://legalpro-dotnet-staging.up.railway.app',
  frontend: process.env.SMOKE_FRONTEND_URL || process.env.SMOKE_OWNER_URL || 'https://legalpro-frontend-staging.up.railway.app',
};

const IS_PRODUCTION = STACKS.node.includes('production') || STACKS.dotnet.includes('production');
if (IS_PRODUCTION) {
  console.warn('⚠️  ATENCIÓN: corriendo smoke contra PRODUCCIÓN.');
}

const DEMO_EMAIL = process.env.SMOKE_DEMO_EMAIL || 'abogado@legalpro.pe';
const DEMO_PASSWORD = process.env.SMOKE_DEMO_PASSWORD || 'Demo2024!';

const TIMEOUT = 15000;
const results = { passed: 0, failed: 0, tests: [] };

async function test(name, fn) {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    results.passed++;
    results.tests.push({ name, status: 'OK', ms });
    console.log(`  ✅ ${name} (${ms}ms)`);
  } catch (e) {
    const ms = Date.now() - start;
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: e.message, ms });
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchHealth(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = (await res.text()).trim();
    try {
      return JSON.parse(text);
    } catch {
      return { status: text };
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

async function main() {
  console.log('🔥 Smoke Test — LegalPro Producción\n');

  console.log(`📡 Node Backend: ${STACKS.node}`);
  await test('Health check Node', async () => {
    const data = await fetchJson(`${STACKS.node}/health`);
    if (data.status !== 'ok') throw new Error(`Status: ${data.status}`);
  });
  await test('Auth endpoint exists', async () => {
    const res = await fetch(`${STACKS.node}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid@test.com', password: 'x' }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (res.status === 404) throw new Error('Endpoint not found');
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
  });

  console.log(`\n📡 .NET Backend: ${STACKS.dotnet}`);
  await test('Health check .NET', async () => {
    const data = await fetchHealth(`${STACKS.dotnet}/health`);
    const ok = data.status === 'Healthy' || data.status === 'healthy' || data.status === 'ok';
    if (!ok) throw new Error(`Not healthy: ${JSON.stringify(data)}`);
  });
  await test('OpenAPI Swagger (opcional)', async () => {
    const res = await fetch(`${STACKS.dotnet}/swagger/v1/swagger.json`, { signal: AbortSignal.timeout(TIMEOUT) });
    if (res.status === 404) {
      console.log('     (Swagger no expuesto en prod — OK)');
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.openapi) throw new Error('No OpenAPI');
  });

  console.log(`\n📡 Frontend: ${STACKS.frontend}`);
  await test('Frontend responde 200', async () => {
    const res = await fetch(STACKS.frontend, { signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  await test(`Login demo (${DEMO_EMAIL})`, async () => {
    const res = await fetch(`${STACKS.node}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (res.status !== 200) throw new Error(`Login falló: ${res.status}`);
    const data = await res.json();
    if (!data.token) throw new Error('Sin token JWT');
  });

  console.log(`\n📊 Resumen:`);
  console.log(`  Pasados: ${results.passed}`);
  console.log(`  Fallados: ${results.failed}`);
  console.log(`  Total: ${results.tests.length}`);

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
