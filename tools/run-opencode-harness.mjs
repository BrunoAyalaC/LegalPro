#!/usr/bin/env node
/**
 * Arnés agentic .opencode — ejecuta todos los verificadores + smoke producción.
 * Equivalente a @auditor-seguridad + @smoke-tester + verificadores/refutadores.
 */
import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const verifiersDir = path.join(root, 'tools', 'verifiers');

const NODE_URL = process.env.SMOKE_NODE_URL || 'https://legalpro-node-production-34ac.up.railway.app';
const DOTNET_URL = process.env.SMOKE_DOTNET_URL || 'https://legalpro-dotnet-production-5a39.up.railway.app';
const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'https://legalpro-frontend-production-a988.up.railway.app';

function run(cmd, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: root,
      env: { ...process.env, ...env },
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout?.on('data', (d) => { out += d; process.stdout.write(d); });
    child.stderr?.on('data', (d) => { out += d; process.stderr.write(d); });
    child.on('close', (code) => resolve({ code: code ?? 1, out }));
  });
}

const verifiers = readdirSync(verifiersDir)
  .filter((f) => f.startsWith('verifier-') && f.endsWith('.mjs'))
  .sort();

console.log(`\n🔒 Arnés .opencode — ${verifiers.length} verificadores\n`);

const results = [];

for (const file of verifiers) {
  const name = file.replace('.mjs', '');
  process.stdout.write(`\n── ${name} ──\n`);
  const { code } = await run('node', [path.join(verifiersDir, file)]);
  results.push({ name, ok: code === 0 });
}

console.log('\n── smoke-production (@smoke-tester) ──\n');
const smoke = await run('node', ['legalpro-app/server/smoke-production.mjs'], {
  SMOKE_NODE_URL: NODE_URL,
  SMOKE_DOTNET_URL: DOTNET_URL,
  SMOKE_OWNER_URL: FRONTEND_URL,
  SMOKE_FRONTEND_URL: FRONTEND_URL,
});
results.push({ name: 'smoke-production', ok: smoke.code === 0 });

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);

console.log('\n══════════════════════════════════════');
console.log(`✅ Pasaron: ${passed}/${results.length}`);
if (failed.length) {
  console.log(`❌ Fallaron: ${failed.map((f) => f.name).join(', ')}`);
  process.exit(1);
}
console.log('══════════════════════════════════════\n');
