import 'dotenv/config';
import { initSentry } from './sentry.js';

// Inicializar Sentry antes que cualquier otro módulo (monitoreo de errores)
initSentry();

// ═══ Manejadores globales de errores (evitan que el proceso muera) ═══
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message, err.stack?.split('\n').slice(0, 5).join('\n'));
  // En producción, loguear y dejar que el proceso continúe (Railway reinicia si es necesario)
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason instanceof Error ? reason.message : reason);
  // No matar el proceso — las promesas rechazadas no deberían tumbar el servidor
});

// ═══ Watchdog de salud del proceso (autocuración) ═══
const WATCHDOG_INTERVAL = 5 * 60 * 1000; // cada 5 minutos
const MEMORY_THRESHOLD_MB = 500; // alerta si el proceso usa más de 500MB

function checkProcessHealth() {
  const usage = process.memoryUsage();
  const heapMB = Math.round(usage.heapUsed / 1024 / 1024);
  const rssMB = Math.round(usage.rss / 1024 / 1024);

  if (heapMB > MEMORY_THRESHOLD_MB) {
    console.warn(`[watchdog] MEMORIA ALTA: heap=${heapMB}MB, rss=${rssMB}MB`);
  }

  return { heapMB, rssMB, uptime: process.uptime() };
}

// Ejecutar watchdog periódicamente
const watchdogTimer = setInterval(() => {
  const health = checkProcessHealth();
  if (health.heapMB > MEMORY_THRESHOLD_MB) {
    console.warn(`[watchdog] ALERTA: memoria elevada (${health.heapMB}MB)`, health);
  }
}, WATCHDOG_INTERVAL);

// No impedir que Node termine si el timer es lo único vivo
watchdogTimer.unref();

import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import authLoginMfaRoutes from './routes/auth-login-mfa.js';
import organizacionesRoutes from './routes/organizaciones.js';
import datosPersonalesRoutes from './routes/datos-personales.js';
import aiRoutes from './routes/ai.js';
import documentosRoutes from './routes/documentos.js';
import legalRoutes from './routes/legal-multigent-routes.js';
import interpretacionRoutes from './routes/interpretacion-legal.js';
import expedientesRoutes from './routes/expedientes.js';
import notificacionesRoutes from './routes/notificaciones.js';
import creditosRoutes from './routes/creditos.js';
import adminRoutes from './routes/admin.js';
import stripeWebhookHandler from './webhooks/stripe-handler.js';
import { initDb } from './initDb.js';
import logger, { httpLogger } from './logger.js';
import { logAudit } from './utils/audit.js';
import { initCronJobs } from './cron-jobs.js';
import Sentry from './sentry.js';

const app = express();
app.set('trust proxy', 1);

// ── COMPRESSION GZIP (performance) ──────────────────────────────────────────
// Comprime respuestas HTTP con gzip — reduce payload en ~70% para texto
app.use(compression());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.use(cookieParser());

app.use(httpLogger);

// Inyectar logger en req para rutas que lo usan
app.use((req, _res, next) => {
  req.logger = logger;
  next();
});

// ── SECURITY HEADERS (Helmet) — OWASP A05 Security Misconfiguration ──────────
// Helmet configura automáticamente: CSP, HSTS, X-Frame-Options,
// X-Content-Type-Options, Referrer-Policy, Permissions-Policy, etc.
app.use(helmet({
  // CSP estricta para API REST — no sirve assets de frontend
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'none'"],
      baseUri: ["'none'"],
    },
  },
  // HSTS: 1 año con preload — solo en producción (no en dev con HTTP)
  hsts: isProd
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
  // Ocultar header X-Powered-By (information disclosure)
  hidePoweredBy: true,
  // No permitir iframe embeds (clickjacking)
  frameguard: { action: 'deny' },
  // Prevenir MIME sniffing
  noSniff: true,
  // XSS filter (legacy browsers)
  xssFilter: true,
  // No exponer información de referrer a terceros
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // Deshabilitar APIs sensibles del navegador
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
}));

// ── CORS ─────────────────────────────────────────────────────────────────────
// CORS DEBE ir antes que cualquier Rate Limiter o Middleware de bloqueo
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(s => {
    let trimmed = s.trim();
    // Normalizar: quitar slash final y agregar https:// si no tiene protocolo
    trimmed = trimmed.replace(/\/$/, '');
    if (trimmed && !trimmed.startsWith('http')) return `https://${trimmed}`;
    return trimmed;
  })
  .filter(Boolean);

// Siempre incluir localhost para desarrollo
const devOrigins = ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4173'];

app.use(cors({
  origin: (origin, cb) => {
    // Sin origin (curl, Postman, mobile app nativa) → permitir
    if (!origin) return cb(null, true);
    // Dev: permitir localhost siempre
    if (!isProd || devOrigins.includes(origin)) return cb(null, true);
    // Prod: REQUIERE ALLOWED_ORIGINS configurado — sin lista = bloquear
    if (allowedOrigins.length === 0) {
      logger.warn('CORS bloqueado — ALLOWED_ORIGINS no configurado', { origin });
      return cb(new Error(`CORS: No hay orígenes permitidos configurados. Define ALLOWED_ORIGINS.`));
    }
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin '${origin}' no permitido`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // Incluir variantes en minúsculas: el preflight del navegador envía
  // access-control-request-headers en lowercase (p. ej. x-correlation-id).
  allowedHeaders: [
    'Content-Type', 'Authorization',
    'X-Correlation-Id', 'x-correlation-id',
    'Idempotency-Key', 'idempotency-key',
  ],
  exposedHeaders: ['Retry-After', 'X-Correlation-Id']
}));

// En tests (NODE_ENV=test) se omiten los rate limiters para que no interfieran
const isTest = process.env.NODE_ENV === 'test';

// ── RATE LIMITING GLOBAL — req/min por IP (configurable) ─────────────────────
// El valor por defecto (600/min) contempla que varios usuarios de un mismo
// estudio jurídico suelen compartir una IP pública (NAT). Configurable vía
// RATE_LIMIT_GLOBAL_MAX para staging/E2E o despliegues con tráfico distinto.
const GLOBAL_LIMIT = Number(process.env.RATE_LIMIT_GLOBAL_MAX) || 600;
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: GLOBAL_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Saltar en entorno de test para no bloquear suites de test
  skip: () => isTest,
  handler: (_req, res) => res.status(429).json({
    error: 'Demasiadas solicitudes. Intente nuevamente en 1 minuto.',
  }),
});
app.use(globalLimiter);

// ── RATE LIMITING ESTRICTO EN AUTH — anti-brute force ────────────────────────
// OWASP A07:2021 — Identification and Authentication Failures
//
// IMPORTANTE: solo se aplica a endpoints que RECIBEN credenciales (login,
// register, recuperación/cambio de contraseña). Endpoints de sesión como
// /me, /refresh o /logout devuelven 401 de forma legítima cuando no hay
// sesión y NO deben contar como intentos de fuerza bruta (de lo contrario
// el simple chequeo de sesión del frontend agotaría el límite y bloquearía
// el login real de un usuario legítimo).
const AUTH_SENSITIVE_PATHS = /\/api\/auth\/(login|register|forgot-password|reset-password|change-password|mfa)/;
const AUTH_LIMIT = Number(process.env.AUTH_RATE_LIMIT_MAX) || 10;
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  limit: AUTH_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,  // solo cuenta intentos fallidos
  // Solo limita endpoints sensibles; salta en test y en chequeos de sesión.
  skip: (req) => isTest || !AUTH_SENSITIVE_PATHS.test(req.originalUrl),
  handler: (req, res) => {
    const retryAfter = Math.ceil(15 * 60);
    res.set('Retry-After', retryAfter);
    res.status(429).json({
      error: 'Demasiados intentos de autenticación. Espere 15 minutos antes de reintentar.',
      retryAfter,
    });
    // BF-04 / BF-05: Audit event de bloqueo por brute force (fire-and-forget)
    logAudit('BRUTE_FORCE_BLOCK', {
      severity: 'WARNING',
      ip: req.ip,
      path: req.originalUrl,
      method: req.method,
      reason: 'auth_rate_limit_exceeded',
    }).catch(() => {});
  },
});

// ── RATE LIMITING GEMINI — 10 req/min por IP (costo en tokens) ───────────────
export const geminiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  handler: (_req, res) => res.status(429).json({
    error: 'Límite de solicitudes IA alcanzado. Intente nuevamente en 1 minuto.',
  }),
});

// ── STRIPE WEBHOOK (DEBE ir ANTES de express.json() para preservar raw body) ──
// Stripe necesita el payload raw para verificar HMAC; express.json() consumiria el stream.
app.use('/webhooks', stripeWebhookHandler);

// Limitar tamaño de request body — previene DoS por payload gigante
app.use(express.json({ limit: '1mb' }));

// ── HEALTH CHECKS ────────────────────────────────────────────────────────────
async function checkDb() {
  try {
    const { rows } = await (await import('./db.js')).default.query('SELECT 1 AS ok');
    return rows[0]?.ok === 1;
  } catch { return false; }
}

async function checkGemini() {
  return !!process.env.GEMINI_API_KEY;
}

async function checkRedis() {
  try {
    const cache = await import('./cache.js');
    const client = await cache.getClient();
    if (!client) {
      // Redis no configurado — no es crítico (fallback a memoria)
      return { available: false, configured: false };
    }
    // Intentar ping para verificar conectividad real
    const pong = await client.ping();
    return { available: pong === 'PONG', configured: true };
  } catch {
    return { available: false, configured: true };
  }
}

// ── Liveness: el servidor está vivo ──────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Liveness: endpoint separado para Kubernetes/Railway ──────────────────────
app.get('/health/live', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Health/Process: estado de la memoria del proceso ─────────────────────---
app.get('/health/process', (_req, res) => {
  const health = checkProcessHealth();
  res.json({
    status: health.heapMB > MEMORY_THRESHOLD_MB ? 'warning' : 'ok',
    memory: { heapMB: health.heapMB, rssMB: health.rssMB },
    uptime: Math.round(health.uptime),
    node: process.version,
    env: process.env.NODE_ENV || 'development',
    ts: new Date().toISOString(),
  });
});

// ── Deep health: estado detallado de todas las dependencias ──────────────────
app.get('/health/deep', async (_req, res) => {
  const [dbOk, geminiOk, redisStatus, culqiStatus] = await Promise.all([
    checkDb(),
    checkGemini(),
    checkRedis(),
    (async () => {
      try {
        const { getCulqiStatus } = await import('./adapters/CulqiAdapter.js');
        return getCulqiStatus();
      } catch { return { service: 'Culqi', healthy: true, circuitOpen: false }; }
    })(),
  ]);
  const allOk = dbOk && geminiOk && (!redisStatus.configured || redisStatus.available);
  res.json({
    status: allOk ? 'ok' : dbOk ? 'degradado' : 'error',
    db: dbOk ? 'ok' : 'error',
    gemini: geminiOk ? 'configurado' : 'sin_api_key',
    redis: redisStatus.configured
      ? (redisStatus.available ? 'ok' : 'error')
      : 'no_configurado',
    circuitBreakers: {
      culqi: culqiStatus.healthy ? 'ok' : 'circuit_open',
      gemini: 'integrado_en_adapter', // se verifica internamente
    },
    ts: new Date().toISOString(),
  });
});

// ── Readiness: el servidor está listo para recibir tráfico ───────────────────
// DB es obligatoria. Gemini es obligatorio para features IA.
// Redis tiene fallback a memoria, por lo que no bloquea readiness.
app.get('/health/readiness', async (_req, res) => {
  const [dbOk, geminiOk] = await Promise.all([checkDb(), checkGemini()]);
  if (!dbOk) {
    return res.status(503).json({
      status: 'db_down',
      message: 'Base de datos no disponible',
      ts: new Date().toISOString(),
    });
  }
  if (!geminiOk) {
    return res.status(503).json({
      status: 'gemini_unconfigured',
      message: 'API Key de Gemini no configurada — funciones IA no disponibles',
      ts: new Date().toISOString(),
    });
  }
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── CACHE-CONTROL para GETs de API (performance) ────────────────────────────
// OWASP A05: datos sensibles solo cache privado, nunca en proxies públicos
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'private, max-age=60');
  }
  next();
});

// ── RUTAS ─────────────────────────────────────────────────────────────────────
// Servir páginas de términos y privacidad bajo la Ley 29733 (Perú)
app.get('/terminos', (_req, res) => {
  res.setHeader('Content-Security-Policy', "default-src 'self' https://cdn.tailwindcss.com https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; img-src 'self' data:;");
  res.sendFile(path.join(__dirname, '../public/terminos.html'));
});

app.get('/privacidad', (_req, res) => {
  res.setHeader('Content-Security-Policy', "default-src 'self' https://cdn.tailwindcss.com https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; img-src 'self' data:;");
  res.sendFile(path.join(__dirname, '../public/privacidad.html'));
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/auth', authLimiter, authLoginMfaRoutes);
app.use('/api/organizaciones', organizacionesRoutes);
app.use('/api/creditos', creditosRoutes);
app.use('/api/mis-datos', datosPersonalesRoutes);
app.use('/api/documentos', documentosRoutes);
app.use('/api/gemini', geminiLimiter, aiRoutes);
app.use('/api/ai', geminiLimiter, aiRoutes);

// ── EXPEDIENTES ────────────────────────────────────────────────────────────────
app.use('/api/expedientes', expedientesRoutes);
app.use('/api/notificaciones', notificacionesRoutes);

// ── LEGAL MULTI-AGENT ─────────────────────────────────────────────────────────
app.use('/api/legal', geminiLimiter, legalRoutes);

// ── INTERPRETACIÓN LEGAL POR ROL ───────────────────────────────────────────────
// POST /api/legal/interpret — interpretación desde perspectiva de abogado, fiscal, juez o completo
// Middleware: auth → idempotency → quota → validate
app.use('/api/legal', geminiLimiter, interpretacionRoutes);

// ── ADMIN ROUTES ───────────────────────────────────────────────────────────────
// Rutas administrativas protegidas con authMiddleware + requireRole(['OWNER', 'ADMIN'])
// Incluye: POST /api/admin/update-catalogos, GET /api/admin/catalogos/status
app.use('/api/admin', adminRoutes);

// ── SENTRY ERROR HANDLER ───────────────────────────────────────────────────────
// Debe ir después de las rutas pero antes del error handler global
Sentry.setupExpressErrorHandler(app);

// ── ERROR HANDLER GLOBAL ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  const status = err.status ?? err.statusCode ?? 500;
  const message = isProd ? (status >= 500 ? 'Error interno del servidor' : err.message) : err.message;
  if (status >= 500) logger.error(err.message, { error: err.name, stack: err.stack?.split('\n')[1] });
  res.status(status).json({ error: message });
});

app.listen(PORT, async () => {
  logger.info('server_started', { port: PORT, env: process.env.NODE_ENV ?? 'development' });
  await initDb();

  // Inicializar CRON jobs (solo si node-cron está instalado)
  // Railway CRON nativo: configurar en Railway Dashboard → CRON Jobs
  // Endpoint: POST /api/admin/update-catalogos con ADMIN_API_KEY
  await initCronJobs();
});

export default app;

