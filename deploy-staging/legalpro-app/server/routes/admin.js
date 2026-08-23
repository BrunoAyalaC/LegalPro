// legalpro-app/server/routes/admin.js
// LegalPro — Rutas administrativas internas
//
// Protegidas con authMiddleware + requireRole(['OWNER', 'ADMIN'])
// Endpoints para operaciones de administración del sistema:
//   POST /api/admin/update-catalogos    — Ejecuta actualización de catálogos
//   GET  /api/admin/catalogos/status    — Estado actual de los catálogos
//
// Uso (Railway CRON):
//   Configurar en Railway → CRON Jobs:
//     Ruta: POST /api/admin/update-catalogos
//     Horario: "0 6 * * *" (06:00 UTC = 01:00 Perú)
//     Headers: { Authorization: "Bearer <ADMIN_API_KEY>" }

import { Router } from 'express';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import logger from '../logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ruta absoluta al script actualizador de catálogos
// tools/ está en la raíz del proyecto, 2 niveles arriba desde server/routes/
const UPDATER_PATH = resolve(__dirname, '..', '..', '..', 'tools', 'legal-catalog-updater.mjs');

const router = Router();

// ── ADMIN API KEY para Railway CRON ───────────────────────────────────────────
// Railway no puede enviar JWT en sus CRON jobs, por lo que habilitamos
// autenticación alternativa via ADMIN_API_KEY en header Authorization.
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

function adminAuth(req, res, next) {
  // Intentar autenticación vía JWT primero (usuarios humanos)
  const authHeader = req.headers.authorization;

  // Si trae ADMIN_API_KEY como Bearer token
  if (authHeader?.startsWith('Bearer ') && ADMIN_API_KEY) {
    const token = authHeader.slice(7);
    if (token === ADMIN_API_KEY) {
      req.isAdminCron = true;
      return next();
    }
  }

  // Fallback a JWT normal (usuario autenticado con rol OWNER/ADMIN)
  authMiddleware(req, res, (err) => {
    if (err) return next(err);
    requireRole(['OWNER', 'ADMIN'])(req, res, next);
  });
}

// ─── POST /api/admin/update-catalogos ─────────────────────────────────────────
// Ejecuta la actualización/validación de todos los catálogos legales.
// Accesible por:
//   - Usuarios con rol OWNER o ADMIN (JWT)
//   - Railway CRON (ADMIN_API_KEY)
router.post('/update-catalogos', adminAuth, async (req, res, next) => {
  const start = Date.now();
  logger.info('admin.update_catalogos.inicio', {
    triggeredBy: req.isAdminCron ? 'cron' : req.user?.sub,
  });

  try {
    // Import dinámico del updater
    const updater = await import(UPDATER_PATH);

    if (typeof updater.main !== 'function') {
      return res.status(500).json({
        error: 'El actualizador de catálogos no exporta una función main()',
      });
    }

    const result = await updater.main();

    const duration = Date.now() - start;
    logger.info('admin.update_catalogos.fin', {
      duration,
      ok: result.ok,
      passed: result.passed,
      failed: result.failed,
      errors: result.totalErrors,
      warnings: result.totalWarnings,
    });

    // Construir respuesta
    const response = {
      ok: result.ok,
      mensaje: result.ok
        ? 'Catálogos actualizados y validados exitosamente'
        : 'Catálogos validados con errores — revisar logs',
      timestamp: result.timestamp,
      duracion_ms: duration,
      resumen: {
        total: result.total,
        passed: result.passed,
        failed: result.failed,
        errores: result.totalErrors,
        advertencias: result.totalWarnings,
      },
      // Solo incluir detalle si es admin humano (no CRON)
      catalogs: req.isAdminCron ? undefined : result.catalogs,
    };

    const statusCode = result.ok ? 200 : 207; // 207 Multi-Status si hay errores
    res.status(statusCode).json(response);
  } catch (err) {
    const duration = Date.now() - start;
    logger.error('admin.update_catalogos.error', {
      duration,
      error: err.message,
    });

    res.status(500).json({
      ok: false,
      error: 'Error ejecutando actualización de catálogos',
      detalle: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
});

// ─── GET /api/admin/catalogos/status ──────────────────────────────────────────
// Retorna el estado actual de los catálogos (última validación, versiones).
router.get('/catalogos/status', authMiddleware, requireRole(['OWNER', 'ADMIN']), async (req, res, next) => {
  try {
    const updater = await import(UPDATER_PATH);

    // Ejecutar validación en modo lectura
    const result = await updater.validateCatalogs();

    res.json({
      ok: result.ok,
      timestamp: result.timestamp,
      duracion_ms: result.duration,
      resumen: {
        total: result.total,
        passed: result.passed,
        failed: result.failed,
      },
      catalogs: result.catalogs.map(c => ({
        id: c.id,
        name: c.name,
        version: c.version,
        status: c.status,
        severity: c.severity,
        errors: c.errors.length,
        warnings: c.warnings.length,
      })),
    });
  } catch (err) {
    logger.error('admin.catalogos_status.error', { error: err.message });
    next(err);
  }
});

// ─── GET /api/admin/health ───────────────────────────────────────────────────
// Health check extendido para administradores.
router.get('/health', authMiddleware, requireRole(['OWNER', 'ADMIN']), async (_req, res) => {
  res.json({
    status: 'ok',
    servicio: 'LegalPro Admin API',
    version: process.env.npm_package_version || '1.0.0',
    ts: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
