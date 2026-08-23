import 'dotenv/config';
import { initSentry } from './sentry.js';

// Inicializar Sentry antes que cualquier otro módulo (monitoreo de errores)
initSentry();

// ═══ Validación de secretos críticos al arranque (OWASP H-01 + H-03) ═══
// Si JWT_SECRET no está definido, es débil o es un valor placeholder conocido,
// el backend no debe arrancar en producción. En desarrollo solo advertimos.
const REQUIRED_SECRETS = {
  JWT_SECRET: { min: 32, description: 'JWT signing secret (mín. 32 chars)' },
  DATABASE_URL: { min: 10, description: 'PostgreSQL connection string' },
};

// FIX H-03 (OWASP): lista de valores placeholder comunes que NO deben usarse en producción
const PLACEHOLDER_SECRETS = [
  'changeme', 'change-me', 'your-secret-here', 'your-secret',
  'replace-me', 'todo-cambiar', 'example', 'placeholder',
  'put-your-secret-here', 'insert-secret-here',
  'xxx', 'yyyy', 'foo', 'bar',
  'legalpro-jwt-secret-production', 'production-secret',
  'genera-un-secreto', 'reemplaza-esto',
  'generate-a-secret', 'change-this',
];

function isPlaceholderValue(val) {
  if (!val) return false;
  const lowerVal = val.toLowerCase();
  return PLACEHOLDER_SECRETS.some(p => lowerVal.includes(p) || lowerVal === p) ||
    // Patrón genérico: palabra-palabra-palabra-año (típico de placeholders obvios)
    /^[a-z]+-[a-z]+-[a-z]+-\d{4}$/i.test(val);
}

if (process.env.NODE_ENV === 'production') {
  const missing = [];
  const weak = [];
  const placeholder = [];
  for (const [name, cfg] of Object.entries(REQUIRED_SECRETS)) {
    const val = process.env[name];
    if (!val) {
      missing.push(name);
    } else if (val.length < cfg.min) {
      weak.push(`${name} (< ${cfg.min} chars)`);
    } else if (isPlaceholderValue(val)) {
      placeholder.push(`${name}: parece ser un valor placeholder, no un secreto real`);
    }
  }
  if (missing.length || weak.length || placeholder.length) {
    console.error('[FATAL] Secretos críticos ausentes, débiles o placeholder en producción:');
    missing.forEach(s => console.error(`  - ${s}: requerido`));
    weak.forEach(s => console.error(`  - ${s}: demasiado débil`));
    placeholder.forEach(s => console.error(`  - ${s}`));
    process.exit(1);
  }
} else {
  // En desarrollo, solo advertir (no bloquear DX local)
  for (const [name, cfg] of Object.entries(REQUIRED_SECRETS)) {
    const val = process.env[name];
    if (!val) {
      console.warn(`[boot] ⚠️  ${name} no definido (usar .env). En producción esto abortaría el arranque.`);
    } else if (val.length < cfg.min) {
      console.warn(`[boot] ⚠️  ${name} demasiado corto (< ${cfg.min} chars). En producción esto abortaría el arranque.`);
    } else if (isPlaceholderValue(val)) {
      console.warn(`[boot] ⚠️  ${name} parece ser un placeholder. En producción esto abortaría el arranque.`);
    }
  }
}

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
import documentoChatRoutes from './routes/documento-chat.js';
import documentosRoutes from './routes/documentos.js';
import bovedaChatRoutes from './routes/boveda-chat.js';
import legalRoutes from './routes/legal-multigent-routes.js';
import interpretacionRoutes from './routes/interpretacion-legal.js';
import expedientesRoutes from './routes/expedientes.js';
import notificacionesRoutes from './routes/notificaciones.js';
import creditosRoutes from './routes/creditos.js';
import creditosUsoRoutes from './routes/creditos-uso.js';
import clientesRoutes from './routes/clientes.js';
import adminRoutes from './routes/admin.js';
import stripeWebhookHandler from './webhooks/stripe-handler.js';
import plazosRoutes from './routes/plazos.js';
// Herramientas legales determinísticas (UIT, interés, plazos, delitos,
// prescripción, BCRP): cálculo puro sin IA = sin costo por consulta.
import herramientasRoutes from './routes/herramientas.js';
import { initDb } from './initDb.js';
import logger, { httpLogger } from './logger.js';
import { logAudit } from './utils/audit.js';
import { initCronJobs } from './cron-jobs.js';
import Sentry from './sentry.js';
// FIX C-02 — Anti-IDOR: valida que el recurso con :id pertenece a la organización del JWT.
// IMPORTANTE: debe ir ANTES de los routers genéricos (`app.use('/api/expedientes', ...)`)
// porque Express matchea las rutas en orden de registro. Las rutas más específicas
// con `:id` deben ir primero; los listados (sin :id) ya filtran por `organization_id`
// en su SQL y NO requieren este middleware.
import { requireTenantAccess } from './middleware/tenant-validator.js';
import { authMiddleware } from './middleware/authMiddleware.js';
import { requireTransferenciaInternacional } from './middleware/requireTransferenciaInternacional.js';
// RAG (Retrieval Augmented Generation): inyecta contexto de la base legal peruana
// a las respuestas IA. Controlado por feature flag ENABLE_RAG (default false).
// Es fail-open: si RAG falla, NO bloquea la respuesta — degrada con req.ragContext=null.
import { ragMiddleware } from './middleware/ragMiddleware.js';

const iaTransferenciaGuard = requireTransferenciaInternacional();

const app = express();
app.set('trust proxy', 1);

// ── COMPRESSION GZIP (performance) ──────────────────────────────────────────
// Comprime respuestas HTTP con gzip — reduce payload en ~70% para texto.
// FIX 2026-08-08 (perf): Excluimos `text/event-stream` (SSE) del listado de
// Content-Types comprimibles. Sin este filtro, compression() por defecto
// intenta comprimir cada chunk del stream, lo que DEGRADA el primer byte
// del streaming (buffering gzip) y empeora la experiencia de
// /consulta/stream y /panel-expertos/stream. SSE ya envía sus propios
// chunks pequeños; comprimirlo aporta poco (~5%) y cuesta latencia.
app.use(compression({
  threshold: 1024, // 1KB (default): respuestas <1KB no se comprimen (overhead > beneficio)
  level: 6, // balance estándar velocidad/ratio
  filter: (req, res) => {
    // SSE (chat streaming, panel-expertos stream): NUNCA comprimir
    const ct = res.getHeader('Content-Type') || '';
    if (typeof ct === 'string' && ct.includes('text/event-stream')) return false;
    // Fallback al filtro por defecto de compression (mira Accept-Encoding + mime)
    return compression.filter(req, res);
  },
}));

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
    // Dev: permitir localhost SOLO fuera de prod (fail-closed en prod)
    if (!isProd && devOrigins.includes(origin)) return cb(null, true);
    // Prod: localhost NUNCA permitido salvo que esté explícitamente en ALLOWED_ORIGINS
    // Prod: REQUIERE ALLOWED_ORIGINS configurado — sin lista = bloquear (403)
    if (allowedOrigins.length === 0) {
      logger.warn('CORS bloqueado — ALLOWED_ORIGINS no configurado', { origin });
      return cb(new Error(`CORS: No hay orígenes permitidos configurados. Define ALLOWED_ORIGINS.`));
    }
    if (allowedOrigins.includes(origin)) return cb(null, true);
    logger.warn('CORS origin bloqueado', { origin });
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
import { createDistributedStore } from './utils/distributedStore.js';

// ── RATE LIMITING GLOBAL — req/min por IP (configurable) ─────────────────────
// Distribuido via Redis (cache.js) con fallback a memoria local.
// El valor por defecto (600/min) contempla que varios usuarios de un mismo
// estudio jurídico suelen compartir una IP pública (NAT). Configurable vía
// RATE_LIMIT_GLOBAL_MAX para staging/E2E o despliegues con tráfico distinto.
const GLOBAL_LIMIT = Number(process.env.RATE_LIMIT_GLOBAL_MAX) || 600;
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: GLOBAL_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createDistributedStore('rl:global', 60 * 1000),
  // Saltar en entorno de test para no bloquear suites de test
  skip: () => isTest,
  handler: (_req, res) => res.status(429).json({
    success: false,
    error: 'Demasiadas solicitudes. Intente nuevamente en 1 minuto.',
    code: 'RATE_LIMIT_GLOBAL',
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
  store: createDistributedStore('rl:auth', 15 * 60 * 1000),
  skipSuccessfulRequests: true,  // solo cuenta intentos fallidos
  // Solo limita endpoints sensibles; salta en test y en chequeos de sesión.
  skip: (req) => isTest || !AUTH_SENSITIVE_PATHS.test(req.originalUrl),
  handler: (req, res) => {
    const retryAfter = Math.ceil(15 * 60);
    res.set('Retry-After', retryAfter);
    res.status(429).json({
      success: false,
      error: 'Demasiados intentos de autenticación. Espere 15 minutos antes de reintentar.',
      code: 'AUTH_RATE_LIMIT',
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

// ── RATE LIMITING IA — 10 req/min por IP (costo en tokens) ───────────────────
// FIX NO-MINIMAX (2026-08-23): renombrado a iaLimiter (proveedor-neutro).
// Se conserva el export minimaxLimiter como alias deprecated para no romper
// imports existentes; remover en próxima major.
// Distribuido via Redis para costo controlado en despliegue multi-instancia
export const iaLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createDistributedStore('rl:ia', 60 * 1000),
  skip: () => isTest,
  handler: (_req, res) => res.status(429).json({
    success: false,
    error: 'Límite de solicitudes IA alcanzado. Intente nuevamente en 1 minuto.',
    code: 'IA_RATE_LIMIT',
  }),
});
/** @deprecated Usar iaLimiter */
export const minimaxLimiter = iaLimiter;

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

// FIX NO-MINIMAX (2026-08-23): healthcheck de IA ahora es proveedor-neutro
// (OpenCode u OpenRouter configurados = IA disponible).
async function checkIA() {
  return !!(process.env.OPENCODE_API_KEY || process.env.OPENROUTER_API_KEY);
}
/** @deprecated Usar checkIA */
const checkMiniMax = checkIA;

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
  const [dbOk, minimaxOk, redisStatus, culqiStatus] = await Promise.all([
    checkDb(),
    checkMiniMax(),
    checkRedis(),
    (async () => {
      try {
        const { getCulqiStatus } = await import('./adapters/CulqiAdapter.js');
        return getCulqiStatus();
      } catch { return { service: 'Culqi', healthy: true, circuitOpen: false }; }
    })(),
  ]);
  const allOk = dbOk && minimaxOk && (!redisStatus.configured || redisStatus.available);
  res.json({
    status: allOk ? 'ok' : dbOk ? 'degradado' : 'error',
    db: dbOk ? 'ok' : 'error',
    minimax: minimaxOk ? 'configurado' : 'sin_api_key',
    redis: redisStatus.configured
      ? (redisStatus.available ? 'ok' : 'error')
      : 'no_configurado',
    circuitBreakers: {
      culqi: culqiStatus.healthy ? 'ok' : 'circuit_open',
      minimax: 'integrado_en_adapter', // se verifica internamente
    },
    ts: new Date().toISOString(),
  });
});

// ── Readiness: el servidor está listo para recibir tráfico ───────────────────
// DB es obligatoria. MiniMax es obligatorio para features IA.
// Redis tiene fallback a memoria, por lo que no bloquea readiness.
app.get('/health/readiness', async (_req, res) => {
  const [dbOk, minimaxOk] = await Promise.all([checkDb(), checkMiniMax()]);
  if (!dbOk) {
    return res.status(503).json({
      status: 'db_down',
      message: 'Base de datos no disponible',
      ts: new Date().toISOString(),
    });
  }
  if (!minimaxOk) {
    return res.status(503).json({
      status: 'minimax_unconfigured',
      message: 'API Key de MiniMax no configurada — funciones IA no disponibles',
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

// ── ANTI-IDOR (FIX C-02) ─────────────────────────────────────────────────────
// Estas rutas con `:id` DEBEN ir ANTES que los routers genéricos de abajo
// (`app.use('/api/expedientes', ...)`). Express matchea por orden; si el router
// genérico se monta primero, capturará la petición antes de que el middleware
// anti-IDOR tenga oportunidad de validar el recurso.
//
// Los listados (GET sin :id) NO requieren este middleware porque ya filtran
// por `organization_id` en su SQL.
app.use('/api/expedientes/:id', requireTenantAccess('expedientes'));
app.use('/api/clientes/:id', requireTenantAccess('clientes'));
app.use('/api/documentos/:id', requireTenantAccess('documentos'));

// ── RAG MIDDLEWARE (Retrieval Augmented Generation) ───────────────────────────
// Inyecta contexto de la base legal peruana actualizada en respuestas IA.
// Feature flag: ENABLE_RAG=true en .env para activar. Default: desactivado.
// Es no-op si ENABLE_RAG=false. Filtra internamente por path (/api/ai/*, /api/legal/*).
// Debe ir DESPUÉS de cualquier auth global y ANTES de los routers IA.
app.use(ragMiddleware);

// ── LOGIN: auth.js maneja /login (DECISIÓN ADR-004: rollout MFA postergado) ──
// @abogado-chief rechazó activar el router MFA como handler de /login en esta
// iteración: la BD de producción NO tiene columnas mfa_* (500 en cada login) y
// el frontend no maneja mfaSetupRequired (rompería el login demo de roles
// sensibles). auth-login-mfa.js se conserva íntegro para la iteración MFA
// dedicada (migración columnas + UI /mfa-verificar + feature flag).
// Ver ADR: arneses/registry/ADRs/ADR-004-rollout-fix-c01-mfa-postergado.md
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/auth', authLimiter, authLoginMfaRoutes);
app.use('/api/organizaciones', organizacionesRoutes);
app.use('/api/creditos', creditosRoutes);
app.use('/api/creditos', creditosUsoRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/mis-datos', datosPersonalesRoutes);
app.use('/api/documentos', documentosRoutes);
// Ruta única /api/ai (Gemini legacy eliminado 2026-08-01)
// Router consolidado: aplica minimaxLimiter UNA SOLA VEZ para todas las rutas IA
// (FIX P1 — evita doble conteo de rate limit si se montara en dos app.use).
// Incluye las rutas IA existentes (/chat, /consulta, ...) y las nuevas de
// generación de documentos desde chat (/detectar-documento, /redactar-documento).
const aiApiRouter = express.Router();
aiApiRouter.use(minimaxLimiter);
aiApiRouter.use('/', aiRoutes);
aiApiRouter.use('/', documentoChatRoutes);
app.use('/api/ai', aiApiRouter);

// ── BÓVEDA DESDE CHAT ────────────────────────────────────────────────────────
// Guarda documentos generados por IA como evidencia inmutable del expediente
// (SHA-256 + cadena de custodia, Ley 27269). La tabla física es evidencia_digital.
app.use('/api/boveda', bovedaChatRoutes);

// ── EXPEDIENTES ────────────────────────────────────────────────────────────────
app.use('/api/expedientes', expedientesRoutes);
app.use('/api/notificaciones', notificacionesRoutes);

// ── LEGAL MULTI-AGENT + INTERPRETACIÓN ────────────────────────────────────────
// Middleware: auth → idempotency → quota → validate
// El minimaxLimiter se monta UNA SOLA VEZ en el router consolidado, evitando
// que cada request ejecute el rate limiter dos veces (FIX P1).
const legalApiRouter = express.Router();
legalApiRouter.use(minimaxLimiter);
// LPDP-4: autenticar antes del guard porque este consulta el consentimiento por req.user.sub.
// Se limita a rutas que invocan IA para no afectar /api/legal/health.
legalApiRouter.use('/query', authMiddleware, iaTransferenciaGuard);
legalApiRouter.use('/interpret', authMiddleware, iaTransferenciaGuard);
legalApiRouter.use('/', legalRoutes);
legalApiRouter.use('/interpret', interpretacionRoutes);
app.use('/api/legal', legalApiRouter);

// ── ADMIN ROUTES ───────────────────────────────────────────────────────────────
// Rutas administrativas protegidas con authMiddleware + requireRole(['OWNER', 'ADMIN'])
// Incluye: POST /api/admin/update-catalogos, GET /api/admin/catalogos/status
app.use('/api/admin', adminRoutes);

// ── PLAZOS PROCESALES ──────────────────────────────────────────────────────────
// Calcula fechas de vencimiento considerando feriados peruanos reales (CPC Art. 144)
// POST /api/plazos/calcular  |  GET /api/plazos/catalogo
app.use('/api/plazos', plazosRoutes);

// ── HERRAMIENTAS LEGALES DETERMINÍSTICAS ──────────────────────────────────────
// Cálculo puro (UIT, interés legal, plazos hábiles, delitos, prescripción, BCRP).
// Requiere login (authMiddleware por ruta dentro del router) pero NO tenant:
// son cálculos públicos sin datos por organización. Sin IA = sin costo.
app.use('/api/herramientas', herramientasRoutes);

// ── SENTRY ERROR HANDLER ───────────────────────────────────────────────────────
// Debe ir después de las rutas pero antes del error handler global
Sentry.setupExpressErrorHandler(app);

// ── ERROR HANDLER GLOBAL ──────────────────────────────────────────────────────
// CORS errors → 403 (no 500) para fail-closed explícito
app.use((err, _req, res, _next) => {
  const isCorsError = err.message?.startsWith('CORS:');
  const status = isCorsError ? 403 : (err.status ?? err.statusCode ?? 500);
  const message = isProd ? (status >= 500 ? 'Error interno del servidor' : err.message) : err.message;
  if (status >= 500) logger.error(err.message, { error: err.name, stack: err.stack?.split('\n')[1] });
  if (isCorsError) return res.status(403).json({ error: message, code: 'CORS_FORBIDDEN' });
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

