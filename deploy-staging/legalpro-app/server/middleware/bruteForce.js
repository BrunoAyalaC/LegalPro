// legalpro-app/server/middleware/bruteForce.js
// Middleware de protección contra fuerza bruta en login
// Bloquea IP tras N intentos fallidos en una ventana de tiempo

const BRUTE_FORCE = {
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000, // 15 minutos
};

const failedAttempts = new Map();

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || 'unknown';
}

function isIpBlocked(ip) {
  const entry = failedAttempts.get(ip);
  if (!entry) return false;

  if (entry.attempts >= BRUTE_FORCE.maxAttempts) {
    return true;
  }

  if (Date.now() - entry.windowStart > BRUTE_FORCE.windowMs) {
    failedAttempts.delete(ip);
    return false;
  }

  return false;
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const entry = failedAttempts.get(ip);

  if (!entry || (now - entry.windowStart > BRUTE_FORCE.windowMs)) {
    failedAttempts.set(ip, { attempts: 1, windowStart: now });
  } else {
    entry.attempts += 1;
  }
}

export function bruteForceMiddleware(req, res, next) {
  const ip = getClientIp(req);

  if (isIpBlocked(ip)) {
    return res.status(429).json({
      error: 'Demasiados intentos. Cuenta bloqueada temporalmente.',
      retryAfter: Math.ceil(BRUTE_FORCE.windowMs / 1000),
    });
  }

  // Interceptar res.json para detectar fallos de autenticación
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode === 401 || (body && !body.success)) {
      recordFailedAttempt(ip);
    }
    return originalJson(body);
  };

  next();
}

export function resetFailedAttempts(ip) {
  failedAttempts.delete(ip);
}

export default bruteForceMiddleware;
