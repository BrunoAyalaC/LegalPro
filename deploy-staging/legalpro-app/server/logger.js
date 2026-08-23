const isProd = process.env.NODE_ENV === 'production';

// ── MASKING DE PII (MASK-02) ──────────────────────────────────────────────
// Patrones de datos sensibles peruanos: DNI (8 dígitos), email, teléfono
const PII_PATTERNS = [
  // DNI: exactamente 8 dígitos (word boundary o no pegado a otros dígitos)
  { regex: /(?<!\d)\d{8}(?!\d)/g, replacement: (m) => `${m.slice(0, 4)}****` },
  // Email: user@domain → u***@domain (preserva primer carácter + dominio)
  { regex: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    replacement: (_, user, domain) => `${user[0]}***@${domain}` },
  // Teléfono: números de 9 dígitos (Perú) o con código de país +51
  { regex: /(?:\+?\d{1,3}[ -]?)?\d{3}[ -]?\d{3}[ -]?\d{3}(?!\d)/g,
    replacement: (m) => m.length > 6 ? `${m.slice(0, -6)}***${m.slice(-3)}` : '******' },
];

function maskPII(data) {
  if (typeof data === 'string') {
    let masked = data;
    for (const { regex, replacement } of PII_PATTERNS) {
      masked = masked.replace(regex, replacement);
    }
    return masked;
  }
  if (data && typeof data === 'object') {
    const cloned = Array.isArray(data) ? [...data] : { ...data };
    for (const key of Object.keys(cloned)) {
      if (typeof cloned[key] === 'string') {
        let masked = cloned[key];
        for (const { regex, replacement } of PII_PATTERNS) {
          masked = masked.replace(regex, replacement);
        }
        cloned[key] = masked;
      } else if (cloned[key] && typeof cloned[key] === 'object') {
        cloned[key] = maskPII(cloned[key]);
      }
    }
    return cloned;
  }
  return data;
}

function safe(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const safeKeys = ['method', 'url', 'status', 'duration', 'ip', 'userId', 'orgId', 'error', 'path'];
  const result = {};
  for (const k of safeKeys) {
    if (k in obj) result[k] = obj[k];
  }
  return result;
}

function write(level, message, meta) {
  const safeMeta = safe(meta);
  const maskedMeta = maskPII(safeMeta);
  const entry = {
    level,
    msg: message,
    ts: new Date().toISOString(),
    pid: process.pid,
    ...maskedMeta,
  };
  if (isProd) {
    process.stdout.write(JSON.stringify(entry) + '\n');
  } else {
    const prefix = `[${level.toUpperCase()}]`;
    const metaStr = Object.keys(maskedMeta).length ? ` ${JSON.stringify(maskedMeta)}` : '';
    console.log(`${prefix} ${message}${metaStr}`);
  }
}

export const logger = {
  info: (msg, meta) => write('info', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  error: (msg, meta) => write('error', msg, meta),
  debug: (msg, meta) => write('debug', msg, meta),
};

export function httpLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userId: req.user?.sub,
      orgId: req.organizationId,
    });
  });
  next();
}

export default logger;
