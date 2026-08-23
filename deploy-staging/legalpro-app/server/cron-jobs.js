// legalpro-app/server/cron-jobs.js
// LegalPro — CRON jobs programados
//
// Ejecuta tareas programadas del sistema:
//   - Actualización de catálogos legales (01:00 AM hora Perú)
//   - Limpieza de logs viejos
//
// Railway CRON nativo (preferido):
//   Configurar en Railway → CRON Jobs → POST /api/admin/update-catalogos
//   Horario: "0 6 * * *" (06:00 UTC = 01:00 Perú)
//
// node-cron (fallback para self-hosted):
//   Importar e inicializar en server/index.js
//
// Uso:
//   import { initCronJobs } from './cron-jobs.js'
//   initCronJobs()  // arranca todos los jobs programados

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Logger inline (sin logger externo para bootstrap seguro) ──────────────────

function cronLog(level, msg, meta = {}) {
  const entry = {
    level,
    msg,
    ts: new Date().toISOString(),
    component: 'cron-jobs',
    ...meta,
  };
  if (process.env.NODE_ENV === 'production') {
    process.stdout.write(JSON.stringify(entry) + '\n');
  } else {
    const prefix = `[CRON][${level.toUpperCase()}]`;
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    console.log(`${prefix} ${msg}${metaStr}`);
  }
}

// ── Constantes ────────────────────────────────────────────────────────────────

const TOOLS_DIR = resolve(__dirname, '..', '..', 'tools');
const UPDATER_SCRIPT = resolve(TOOLS_DIR, 'legal-catalog-updater.mjs');

// ── Actualizador de catálogos (vía import dinámico) ───────────────────────────

export async function ejecutarActualizacionCatalogos() {
  const start = Date.now();
  cronLog('info', 'Iniciando actualización de catálogos legales...');

  try {
    if (!existsSync(UPDATER_SCRIPT)) {
      throw new Error(`Updater no encontrado en: ${UPDATER_SCRIPT}`);
    }

    // Importar dinámico del módulo ESM
    const updater = await import(UPDATER_SCRIPT);

    if (typeof updater.main !== 'function') {
      throw new Error('El updater no exporta una función main()');
    }

    const result = await updater.main();

    const duration = Date.now() - start;
    const status = result.ok ? 'completada' : 'con errores';
    cronLog('info', `Actualización de catálogos ${status}`, {
      duration,
      passed: result.passed,
      failed: result.failed,
      errors: result.totalErrors,
      warnings: result.totalWarnings,
    });

    return result;
  } catch (err) {
    const duration = Date.now() - start;
    cronLog('error', 'Error en actualización de catálogos', {
      duration,
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 3).join(' | '),
    });
    throw err;
  }
}

// ── Tarea de limpieza (placeholder) ────────────────────────────────────────────

export async function ejecutarLimpiezaLogs() {
  const start = Date.now();
  cronLog('info', 'Iniciando limpieza de logs antiguos...');
  // TODO: Implementar limpieza de logs de auditoría > 90 días
  cronLog('info', 'Limpieza de logs completada (no implementada)', { duration: Date.now() - start });
}

// ── Inicializador de CRON con node-cron (fallback) ────────────────────────────

let cronJobsInitialized = false;

export async function initCronJobs() {
  if (cronJobsInitialized) {
    cronLog('warn', 'CRON jobs ya están inicializados — omitiendo');
    return;
  }

  // Verificar si node-cron está disponible (ESM-safe: import dinámico en vez de require)
  let cron;
  try {
    const cronModule = await import('node-cron');
    cron = cronModule.default || cronModule;
  } catch {
    cronLog('warn', 'node-cron no está instalado. Usa Railway CRON nativo o instala: npm install node-cron');
    cronLog('info', 'Disponible vía endpoint: POST /api/admin/update-catalogos');
    return;
  }

  // ── Job 1: Actualización de catálogos — 01:00 AM hora Perú (UTC-5) ──────
  // En UTC: 06:00 (invierno) / 05:00 (verano) → usamos 06:00 UTC fijo
  // Formato cron: minuto hora día-del-mes mes día-de-semana
  cron.schedule('0 6 * * *', async () => {
    cronLog('info', 'CRON disparado: actualización de catálogos (06:00 UTC = 01:00 Perú)');
    try {
      await ejecutarActualizacionCatalogos();
    } catch (err) {
      cronLog('error', 'CRON job falló', { error: err.message });
    }
  });

  // ── Job 2: Limpieza de logs — todos los domingos 03:00 AM Perú ─────────
  cron.schedule('0 8 * * 0', async () => {
    cronLog('info', 'CRON disparado: limpieza de logs');
    try {
      await ejecutarLimpiezaLogs();
    } catch (err) {
      cronLog('error', 'Limpieza de logs falló', { error: err.message });
    }
  });

  cronJobsInitialized = true;
  cronLog('info', 'CRON jobs inicializados correctamente');
  cronLog('info', '  - Catálogos:   01:00 AM hora Perú (06:00 UTC)');
  cronLog('info', '  - Limpieza:    Domingos 03:00 AM hora Perú (08:00 UTC)');
  cronLog('info', '  - Endpoint:    POST /api/admin/update-catalogos');
}

// ── Ejecución directa (para debug/testing) ─────────────────────────────────────
// node server/cron-jobs.js
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  const command = process.argv[2] || 'catalogos';
  cronLog('info', `Ejecución directa: ${command}`);

  switch (command) {
    case 'catalogos':
      ejecutarActualizacionCatalogos()
        .then(r => {
          process.exit(r.ok ? 0 : 1);
        })
        .catch(() => process.exit(1));
      break;
    case 'limpieza':
      ejecutarLimpiezaLogs().then(() => process.exit(0));
      break;
    default:
      cronLog('error', `Comando desconocido: ${command}. Usar: catalogos | limpieza`);
      process.exit(1);
  }
}
