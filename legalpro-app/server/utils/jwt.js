// legalpro-app/server/utils/jwt.js
// Generado por @backend-node
// Utilidades de JWT: generación de access + refresh tokens con rotación

import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import db from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET;

// FIX P1-4: validación fail-fast del secreto JWT.
// Sin un secreto válido, jwt.sign() lanza en cada request. Es preferible fallar
// al arrancar con un mensaje claro. Se omite en tests (usan mocks de db/jwt).
if (process.env.NODE_ENV !== 'test') {
  if (!JWT_SECRET) {
    throw new Error('[jwt] FATAL: JWT_SECRET no está definida. Configúrela en el entorno (Railway variables set JWT_SECRET=...).');
  }
  if (JWT_SECRET.length < 32) {
    console.warn('[jwt] ADVERTENCIA: JWT_SECRET demasiado corta (<32 caracteres). Use un secreto criptográficamente fuerte.');
  }
}
const JWT_ISSUER = 'LegalProAPI';
const JWT_AUDIENCE = 'LegalProClients';
const JWT_EXPIRY = process.env.JWT_EXPIRY_SECONDS ? parseInt(process.env.JWT_EXPIRY_SECONDS) : 3600;
const REFRESH_EXPIRY_DAYS = 30;

/**
 * Genera un access token JWT con los claims del usuario.
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: JWT_EXPIRY,
  });
}

/**
 * Genera un refresh token criptográficamente seguro (opaco).
 */
function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

/**
 * Genera un par access + refresh token para un usuario.
 */
export async function generateTokenPair(userData) {
  const payload = {
    sub: userData.userId ?? userData.id,
    email: userData.email,
    rol: userData.rol,
    nombre_completo: userData.nombre_completo ?? '',
    organization_id: userData.organizationId ?? userData.organization_id ?? null,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken();

  return { accessToken, refreshToken };
}

/**
 * Valida un refresh token contra la BD y opcionalmente lo rota.
 * Si rotation=true, invalida el token viejo y genera uno nuevo.
 * Retorna: { valid, userData, newRefreshToken, accessToken }
 */
export async function validateAndRotateRefreshToken(token, options = {}) {
  const { ip, userAgent, rotation = true } = options;

  // Buscar token en BD que no esté revocado ni expirado
  const { rows: tokens } = await db.query(
    `SELECT rt.id, rt.usuario_id, u.email, u.rol, u.nombre_completo,
            u.organization_id
     FROM refresh_tokens rt
     JOIN usuarios u ON u.id = rt.usuario_id
     WHERE rt.token = $1
       AND rt.revocado = FALSE
       AND rt.expires_at > NOW()
       AND u.esta_activo = TRUE
       AND u.eliminado_en IS NULL`,
    [token]
  );

  if (tokens.length === 0) {
    return { valid: false };
  }

  const userData = tokens[0];

  // Rotación: invalidar token viejo, generar nuevo par
  if (rotation) {
    await db.query(
      `UPDATE refresh_tokens SET revocado = TRUE, updated_at = NOW()
       WHERE id = $1`,
      [userData.id]
    );

    const { accessToken, refreshToken: newRefreshToken } = await generateTokenPair({
      userId: userData.usuario_id,
      email: userData.email,
      rol: userData.rol,
      nombre_completo: userData.nombre_completo,
      organization_id: userData.organization_id,
    });

    // Almacenar nuevo refresh token
    await db.query(
      `INSERT INTO refresh_tokens (id, token, usuario_id, expires_at, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, NOW() + INTERVAL '30 days', NOW(), NOW())`,
      [newRefreshToken, userData.usuario_id]
    );

    return {
      valid: true,
      userData,
      accessToken,
      newRefreshToken,
    };
  }

  // Sin rotación: solo devolver datos
  return { valid: true, userData };
}
