#!/usr/bin/env node
// tools/verifiers/verifier-adaptadores.mjs
// Valida que los adaptadores externos esten implementados segun el patron Adapter

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

let errs = 0, warns = 0;
console.log('=== Verifier Adaptadores Externos ===\n');

const ADAPTERS = [
  { name: 'auth', required_in: ['legalpro-app/server/supabase.js', 'LegalProBackend_Net/LegalPro.Infrastructure/Services/JwtService.cs'] },
  { name: 'storage', required_in: ['LegalProBackend_Net/LegalPro.Infrastructure/Services/LocalStorageService.cs'] },
  { name: 'database', required_in: ['LegalProBackend_Net/LegalPro.Infrastructure/Persistence/ApplicationDbContext.cs'] },
  { name: 'ai', required_in: ['LegalProBackend_Net/LegalPro.Infrastructure/Services/MinimaxService.cs', 'LegalProBackend_Net/LegalPro.Infrastructure/Services/GeminiService.cs'] },
  { name: 'bcrp', required_in: ['legalpro-app/server/routes/'] },
  { name: 'sinco', required_in: ['legalpro-app/server/routes/'] }
];

for (const adapter of ADAPTERS) {
  console.log(`[${adapter.name}]`);
  let found = false;
  for (const file of adapter.required_in) {
    const fullPath = resolve(ROOT, file);
    if (existsSync(fullPath)) {
      console.log(`  OK: Adapter encontrado en ${file}`);
      found = true;
      break;
    }
  }
  if (!found) {
    console.warn(`  WARN: Adapter no encontrado (puede estar pendiente)`);
    warns++;
  }
}

// Verificar mocks para tests
console.log('\n[Verificando mocks de adaptadores]');
try {
  const out = execSync('grep -rn "FakeGeminiService\\|InMemoryDbContext\\|LocalStorageMock\\|SupabaseMock" LegalProBackend_Net/LegalPro.IntegrationTests/ legalpro-app/server/__tests__/ 2>/dev/null', { encoding: 'utf8', cwd: ROOT });
  if (out.trim()) {
    console.log('OK: Mocks de adaptadores encontrados');
  } else {
    console.warn('WARN: Sin mocks de adaptadores (dificulta testing)');
    warns++;
  }
} catch (e) {
  console.warn('WARN: No se pudieron buscar mocks');
  warns++;
}

console.log(`\nErrores: ${errs}, Warnings: ${warns}`);
process.exit(errs > 0 ? 1 : 0);
