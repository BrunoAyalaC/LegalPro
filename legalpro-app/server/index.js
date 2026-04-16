import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import organizacionesRoutes from './routes/organizaciones.js';
import geminiRoutes from './routes/gemini.js';
import { initDb } from './initDb.js';

const app = express();
// Confiar en el reverse proxy de Railway para identificar IPs reales
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// ── LOGGING DE AUDITORÍA HTTP ────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms - IP: ${ip}`);
  });
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
      console.warn(`[CORS] BLOQUEADO origin '${origin}' — ALLOWED_ORIGINS no configurado en producción`);
      return cb(new Error(`CORS: No hay orígenes permitidos configurados. Define ALLOWED_ORIGINS.`));
    }
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin '${origin}' no permitido`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Retry-After']
}));

// En tests (NODE_ENV=test) se omiten los rate limiters para que no interfieran
const isTest = process.env.NODE_ENV === 'test';

// ── RATE LIMITING GLOBAL — 100 req/min por IP ────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Saltar en entorno de test para no bloquear suites de test
  skip: () => isTest,
  handler: (_req, res) => res.status(429).json({
    error: 'Demasiadas solicitudes. Intente nuevamente en 1 minuto.',
  }),
});
app.use(globalLimiter);

// ── RATE LIMITING ESTRICTO EN AUTH — 10 req/15min por IP (anti-brute force) ──
// OWASP A07:2021 — Identification and Authentication Failures
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,  // solo cuenta intentos fallidos
  // Saltar en test: las suites lanzan muchas peticiones fallidas consecutivas
  skip: () => isTest,
  handler: (_req, res) => {
    const retryAfter = Math.ceil(15 * 60);
    res.set('Retry-After', retryAfter);
    res.status(429).json({
      error: 'Demasiados intentos de autenticación. Espere 15 minutos antes de reintentar.',
      retryAfter,
    });
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



// Limitar tamaño de request body — previene DoS por payload gigante
app.use(express.json({ limit: '1mb' }));

// ── HEALTH CHECK (Railway lo usa para readiness) ──────────────────────────────
// Excluido de rate limiting global
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── RUTAS ─────────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/organizaciones', organizacionesRoutes);
// /api/expedientes → BACKEND C# (LegalProBackend_Net) — no Node.js
app.use('/api/gemini', geminiLimiter, geminiRoutes);

// ── ERROR HANDLER GLOBAL ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  const status = err.status ?? err.statusCode ?? 500;
  const message = isProd ? (status >= 500 ? 'Error interno del servidor' : err.message) : err.message;
  if (status >= 500) console.error('[ERROR]', err.name, err.message, err.stack?.split('\n')[1]);
  res.status(status).json({ error: message });
});

app.listen(PORT, async () => {
  console.log(`[LegalPro API] escuchando en puerto ${PORT} (${process.env.NODE_ENV ?? 'development'})`);
  // Inicializar schema de DB si las tablas no existen (Railway fresh deploy)
  await initDb();
});

export default app;

