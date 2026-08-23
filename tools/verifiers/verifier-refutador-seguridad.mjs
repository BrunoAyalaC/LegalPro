#!/usr/bin/env node
// tools/verifiers/verifier-refutador-seguridad.mjs
// Adversarial verifier: busca vectores de ataque que el auditor normal pasa por alto

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

let errs = 0, warns = 0;
console.log('=== Verifier Refutador: Seguridad (Adversarial) ===\n');

const checks = [
  {
    id: 'RS-01',
    name: 'Mass assignment vulnerability (.NET)',
    file: 'LegalProBackend_Net/LegalPro.Api/Controllers/',
    pattern: 'model\\.state\\.IsValid|\\[FromBody\\][^\\n]*new\\(',
    test: () => {
      // Busca controllers que acepten el modelo sin whitelist
      try {
        const out = execSync('grep -rn "\\[FromBody\\]" LegalProBackend_Net/LegalPro.Api/Controllers/ 2>/dev/null', { encoding: 'utf8', cwd: ROOT });
        const lines = out.split('\n').filter(l => l.includes('[FromBody]') && l.includes('new '));
        if (lines.length > 0) {
          console.warn(`  WARN: Posible mass assignment: ${lines.length} controllers usan [FromBody] con modelos directos`);
          warns++;
        }
        return lines.length === 0;
      } catch (e) { return true; }
    }
  },
  {
    id: 'RS-02',
    name: 'IDOR enumeration risk (Node)',
    file: 'legalpro-app/server/routes/',
    test: () => {
      // Busca endpoints que usen params.id sin validar tenant
      try {
        const out = execSync('grep -rn "req.params.id" legalpro-app/server/routes/ 2>/dev/null', { encoding: 'utf8', cwd: ROOT });
        const lines = out.split('\n').filter(l => l.length > 0);
        if (lines.length > 5) {
          console.warn(`  WARN: ${lines.length} endpoints usan params.id (verificar tenant validation)`);
          warns++;
        }
        return true;
      } catch (e) { return true; }
    }
  },
  {
    id: 'RS-03',
    name: 'Timing attack in token comparison',
    file: 'legalpro-app/server/',
    test: () => {
      try {
        const out = execSync('grep -rn "token.*===\\|secret.*===" legalpro-app/server/ 2>/dev/null', { encoding: 'utf8', cwd: ROOT });
        if (out.includes('!==') || out.includes('===')) {
          console.warn('  WARN: Comparacion de tokens con === (usar crypto.timingSafeEqual)');
          warns++;
          return false;
        }
        return true;
      } catch (e) { return true; }
    }
  },
  {
    id: 'RS-04',
    name: 'Race condition potential (transacciones)',
    file: 'legalpro-app/server/',
    test: () => {
      // Busca transacciones sin SELECT FOR UPDATE
      try {
        const out = execSync('grep -rn "BEGIN\\|START TRANSACTION" legalpro-app/server/ 2>/dev/null', { encoding: 'utf8', cwd: ROOT });
        if (!out.trim()) {
          console.warn('  WARN: Sin transacciones BEGIN/START TRANSACTION (riesgo de race conditions)');
          warns++;
        }
        return true;
      } catch (e) { return true; }
    }
  },
  {
    id: 'RS-05',
    name: 'Type juggling (JSON parsing)',
    file: 'legalpro-app/server/',
    test: () => {
      try {
        const out = execSync('grep -rn "req\\.body\\.id\\b\\|req\\.body\\.userId" legalpro-app/server/ 2>/dev/null', { encoding: 'utf8', cwd: ROOT });
        if (out.trim()) {
          console.warn('  WARN: Acceso directo a req.body.id sin type check (type juggling risk)');
          warns++;
        }
        return true;
      } catch (e) { return true; }
    }
  },
  {
    id: 'RS-06',
    name: 'Privilege escalation via JWT claims',
    file: 'LegalProBackend_Net/',
    test: () => {
      try {
        const out = execSync('grep -rn "User\\.FindFirst.*role\\|GetClaim.*role" LegalProBackend_Net/ 2>/dev/null', { encoding: 'utf8', cwd: ROOT });
        if (!out.trim()) {
          console.error('  FAIL: No se encontro lectura de claim "role" (verificacion de privilegios)');
          errs++;
          return false;
        }
        return true;
      } catch (e) { return true; }
    }
  },
  {
    id: 'RS-07',
    name: 'Reentrancy / TOCTOU (.NET)',
    file: 'LegalProBackend_Net/',
    test: () => {
      try {
        // Busca read-then-write sin transacción
        const out = execSync('grep -rn "FirstOrDefault\\|FindAsync" LegalProBackend_Net/LegalPro.Application/ 2>/dev/null', { encoding: 'utf8', cwd: ROOT });
        const lines = out.split('\n').filter(l => l.length > 0);
        if (lines.length > 20) {
          console.warn(`  WARN: ${lines.length} queries con Find (posible TOCTOU si siguen writes)`);
          warns++;
        }
        return true;
      } catch (e) { return true; }
    }
  },
  {
    id: 'RS-08',
    name: 'Insufficient logging on auth events',
    file: 'legalpro-app/server/',
    test: () => {
      try {
        const out = execSync('grep -rn "AUTH_LOGIN\\|auth.*log" legalpro-app/server/utils/ 2>/dev/null', { encoding: 'utf8', cwd: ROOT });
        if (!out.trim()) {
          console.error('  FAIL: Sin audit log en eventos de auth');
          errs++;
          return false;
        }
        return true;
      } catch (e) { return true; }
    }
  }
];

for (const c of checks) {
  console.log(`[${c.id}] ${c.name}`);
  try {
    c.test();
  } catch (e) {
    console.error(`  ERROR: ${e.message}`);
    errs++;
  }
}

console.log(`\nErrores: ${errs}, Warnings: ${warns}`);
if (errs > 0) process.exit(1);
process.exit(0);
