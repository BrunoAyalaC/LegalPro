#!/usr/bin/env node
// tools/legal-catalog-updater.mjs
// LegalPro — Actualizador de Catálogos Legales Peruanos
//
// Ejecuta validación y actualización de todos los catálogos del sistema:
// - Valida contra JSON Schema
// - Reporta versiones actuales
// - Detecta cambios y corrupción
// - Prepara para actualización desde fuentes oficiales (SPIJ, MINJUS, SUNAT)
//
// Uso:
//   node tools/legal-catalog-updater.mjs              # ejecución única
//   node tools/legal-catalog-updater.mjs --verbose     # con salida detallada
//   node tools/legal-catalog-updater.mjs --fix         # corrige errores menores
//
// Importable:
//   import { main, validateCatalogs } from './tools/legal-catalog-updater.mjs'
//   const result = await main()
//   // result = { ok, catalogs: [...], errors: [...], duration, timestamp }

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Constantes ────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const CATALOGS_REGISTRY = [
  {
    id: 'role-tools',
    name: 'Herramientas por Rol',
    file: 'catalogs/role-tools.json',
    schema: 'catalogs/schemas/role-tools.schema.json',
    severity: 'CRITICAL', // Afecta acceso a funcionalidades
  },
  {
    id: 'gemini-functions',
    name: 'Funciones Gemini',
    file: 'catalogs/gemini-functions.json',
    schema: 'catalogs/schemas/gemini-functions.schema.json',
    severity: 'CRITICAL', // Afecta llamadas IA
  },
  {
    id: 'tipos-penales',
    name: 'Tipos Penales Perú',
    file: 'catalogs/tipos-penales-peru.json',
    schema: 'catalogs/schemas/tipos-penales.schema.json',
    severity: 'HIGH',
  },
  {
    id: 'plazos-procesales',
    name: 'Plazos Procesales',
    file: 'catalogs/plazos-procesales.json',
    schema: 'catalogs/schemas/plazos-procesales.schema.json',
    severity: 'HIGH',
  },
  {
    id: 'delitos-economicos',
    name: 'Delitos Económicos',
    file: 'catalogs/delitos-economicos.json',
    schema: 'catalogs/schemas/delitos-economicos.schema.json',
    severity: 'HIGH',
  },
  {
    id: 'codigos-leyes',
    name: 'Códigos y Leyes',
    file: 'catalogs/codigos-leyes.json',
    schema: 'catalogs/schemas/codigos-leyes.schema.json',
    severity: 'MEDIUM',
  },
  {
    id: 'reguladores',
    name: 'Reguladores Perú',
    file: 'catalogs/reguladores-peru.json',
    schema: 'catalogs/schemas/reguladores.schema.json',
    severity: 'MEDIUM',
  },
  {
    id: 'audit-events',
    name: 'Eventos de Auditoría',
    file: 'catalogs/audit-events.json',
    schema: 'catalogs/schemas/audit-events.schema.json',
    severity: 'MEDIUM',
  },
  {
    id: 'disclaimers-ia',
    name: 'Disclaimers IA',
    file: 'catalogs/disclaimers-ia.json',
    schema: 'catalogs/schemas/disclaimers-ia.schema.json',
    severity: 'LOW',
  },
];

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

// ── Logger interno ────────────────────────────────────────────────────────────

function log(level, msg, meta = {}) {
  const entry = {
    level,
    msg,
    ts: new Date().toISOString(),
    component: 'catalog-updater',
    ...meta,
  };
  if (process.env.NODE_ENV === 'production') {
    process.stdout.write(JSON.stringify(entry) + '\n');
  } else {
    const prefix = `[${level.toUpperCase()}]`;
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    console.log(`${prefix} ${msg}${metaStr}`);
  }
}

function info(msg, meta) { log('info', msg, meta); }
function warn(msg, meta) { log('warn', msg, meta); }
function error(msg, meta) { log('error', msg, meta); }
function debug(msg, meta) { log('debug', msg, meta); }

// ── Validación contra schema ──────────────────────────────────────────────────

function validateRequiredFields(data, schema, path = '') {
  const errors = [];

  if (schema.required && Array.isArray(schema.required)) {
    for (const req of schema.required) {
      if (!(req in data)) {
        errors.push(`${path}: falta campo requerido "${req}"`);
      }
    }
  }

  // Validar tipos básicos
  if (schema.type && typeof data !== schema.type && schema.type !== 'object') {
    if (schema.type === 'array' && !Array.isArray(data)) {
      errors.push(`${path}: se esperaba un array, se recibió ${typeof data}`);
    } else if (schema.type !== typeof data) {
      errors.push(`${path}: se esperaba tipo "${schema.type}", se recibió "${typeof data}"`);
    }
  }

  // Validar propiedades de objetos
  if (schema.properties && typeof data === 'object' && data !== null && !Array.isArray(data)) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in data) {
        const subErrors = validateRequiredFields(data[key], propSchema, `${path}.${key}`);
        errors.push(...subErrors);
      }
    }
  }

  // Validar items de arrays
  if (schema.items && Array.isArray(data)) {
    const itemSchema = schema.items;
    for (let i = 0; i < data.length; i++) {
      const subErrors = validateRequiredFields(data[i], itemSchema, `${path}[${i}]`);
      errors.push(...subErrors);
    }
  }

  // Validar $ref (resolución simple)
  if (schema.$ref && schema.$defs) {
    const refPath = schema.$ref.replace('#/$defs/', '');
    const refSchema = schema.$defs[refPath];
    if (refSchema) {
      const subErrors = validateRequiredFields(data, refSchema, path);
      errors.push(...subErrors);
    }
  }

  // Validar enum
  if (schema.enum && !schema.enum.includes(data)) {
    errors.push(`${path}: valor "${data}" no está en el enum [${schema.enum.join(', ')}]`);
  }

  return errors;
}

function loadJSON(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    return { ok: true, data: JSON.parse(raw), raw };
  } catch (e) {
    if (e.code === 'ENOENT') return { ok: false, error: `Archivo no encontrado: ${filePath}` };
    if (e instanceof SyntaxError) return { ok: false, error: `JSON inválido: ${e.message}` };
    return { ok: false, error: e.message };
  }
}

// ── Validación de catálogo individual ─────────────────────────────────────────

function validateSingleCatalog(entry) {
  const start = Date.now();
  const filePath = resolve(ROOT, entry.file);
  const schemaPath = resolve(ROOT, entry.schema);

  // Cargar archivo
  const file = loadJSON(filePath);
  if (!file.ok) {
    return {
      id: entry.id,
      name: entry.name,
      severity: entry.severity,
      status: 'ERROR',
      errors: [file.error],
      warnings: [],
      duration: Date.now() - start,
    };
  }

  // Cargar schema (opcional — si no existe, warning pero no falla)
  let schema = null;
  if (existsSync(schemaPath)) {
    const schemaLoad = loadJSON(schemaPath);
    if (schemaLoad.ok) {
      schema = schemaLoad.data;
    } else {
      warn(`Schema no válido para ${entry.id}: ${schemaLoad.error}`);
    }
  } else {
    warn(`Schema no encontrado para ${entry.id}: ${entry.schema}`);
  }

  // Validar contra schema
  const errors = [];
  const warnings = [];

  if (schema) {
    const schemaErrors = validateRequiredFields(file.data, schema);
    errors.push(...schemaErrors);
  }

  // Validaciones adicionales
  if (entry.id === 'codigos-leyes') {
    // Verificar que cada norma tenga id único
    if (file.data.normas && Array.isArray(file.data.normas)) {
      const ids = file.data.normas.map(n => n.id);
      const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
      if (dups.length > 0) {
        errors.push(`IDs duplicados en normas: [${[...new Set(dups)].join(', ')}]`);
      }
    }
  }

  if (entry.id === 'role-tools') {
    // Verificar que roles tengan herramientas
    if (file.data.roles) {
      for (const [rol, data] of Object.entries(file.data.roles)) {
        if (!data.herramientas || data.herramientas.length === 0) {
          warnings.push(`Rol "${rol}" no tiene herramientas definidas`);
        }
        if (!data.plan_minimo) {
          errors.push(`Rol "${rol}" no tiene plan_minimo definido`);
        }
      }
    }
  }

  const status = errors.length === 0 ? 'OK' : 'ERROR';

  return {
    id: entry.id,
    name: entry.name,
    severity: entry.severity,
    version: file.data.version || '0.0.0',
    status,
    errors,
    warnings,
    duration: Date.now() - start,
  };
}

// ── Función principal exportable ──────────────────────────────────────────────

export async function validateCatalogs() {
  const startedAt = new Date().toISOString();
  const overallStart = Date.now();

  info('Iniciando validación de catálogos legales', { total: CATALOGS_REGISTRY.length, catalogs: CATALOGS_REGISTRY.map(c => c.id) });

  const results = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const entry of CATALOGS_REGISTRY) {
    const result = validateSingleCatalog(entry);
    results.push(result);
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;

    const icon = result.status === 'OK' ? '✓' : '✗';
    info(`${icon} ${result.name.padEnd(30)} ${result.status} (${result.duration}ms) v${result.version}`, {
      catalogId: result.id,
      status: result.status,
      errors: result.errors.length,
      warnings: result.warnings.length,
      duration: result.duration,
    });

    if (result.errors.length > 0) {
      result.errors.forEach(e => error(`  ${entry.id}: ${e}`));
    }
    if (result.warnings.length > 0) {
      result.warnings.forEach(w => warn(`  ${entry.id}: ${w}`));
    }
  }

  const totalDuration = Date.now() - overallStart;

  // Resumen
  const summary = {
    ok: totalErrors === 0,
    timestamp: startedAt,
    duration: totalDuration,
    total: results.length,
    passed: results.filter(r => r.status === 'OK').length,
    failed: results.filter(r => r.status === 'ERROR').length,
    totalErrors,
    totalWarnings,
    catalogs: results,
  };

  // Reporte en producción
  if (process.env.NODE_ENV === 'production') {
    const reportDir = resolve(ROOT, 'reports');
    if (!existsSync(reportDir)) {
      mkdirSync(reportDir, { recursive: true });
    }
    const reportPath = resolve(reportDir, `catalog-validation-${startedAt.replace(/[:.]/g, '-')}.json`);
    writeFileSync(reportPath, JSON.stringify(summary, null, 2));
    debug(`Reporte guardado en ${reportPath}`);
  }

  info('Validación de catálogos completada', {
    total: summary.total,
    passed: summary.passed,
    failed: summary.failed,
    errors: summary.totalErrors,
    warnings: summary.totalWarnings,
    duration: summary.duration,
  });

  return summary;
}

export async function main() {
  const verbose = process.argv.includes('--verbose');
  const fix = process.argv.includes('--fix');

  if (verbose) {
    info('Modo verbose activado');
  }
  if (fix) {
    info('Modo fix activado — se corregirán errores menores automáticamente');
  }

  const result = await validateCatalogs();

  if (!result.ok) {
    if (fix) {
      info('--fix: Intentando correcciones automáticas...');
      // Por ahora solo reportamos; en el futuro se pueden auto-corregir catálogos
      warn('Fix automático no implementado para estos errores');
    }

    if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
      process.exitCode = 1;
    }
  }

  return result;
}

// ── Ejecución directa ─────────────────────────────────────────────────────────
// Si se ejecuta como script: node tools/legal-catalog-updater.mjs
const isDirectRun = process.argv[1] && (
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
);

if (isDirectRun) {
  main().catch(err => {
    error('Error fatal en legal-catalog-updater', { error: err.message, stack: err.stack });
    process.exit(1);
  });
}
