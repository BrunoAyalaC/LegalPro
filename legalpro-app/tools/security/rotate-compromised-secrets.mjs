#!/usr/bin/env node
/**
 * Script de rotación de secretos comprometidos
 * Ejecutar: node tools/security/rotate-compromised-secrets.mjs
 * 
 * ANTES de ejecutar:
 * 1. Rotar manualmente cada secreto en su plataforma (MiniMax, Google, Railway)
 * 2. Tener Railway CLI configurado
 * 
 * DESPUÉS de ejecutar:
 * 1. Redesplegar backend Node: railway redeploy
 * 2. Redesplegar backend .NET: railway redeploy
 * 3. Notificar a usuarios para re-login (invalidar tokens)
 */

import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

console.log('🔐 ROTACIÓN DE SECRETOS COMPROMETIDOS');
console.log('Fecha:', new Date().toISOString());
console.log('');

// Generar nuevo JWT_SECRET
const newJwtSecret = crypto.randomBytes(64).toString('hex');
console.log('✅ Nuevo JWT_SECRET generado:', newJwtSecret.slice(0, 16) + '...');

// Aquí se actualizarían las variables en Railway via CLI
console.log('⚠️  ACTUALIZAR MANUALMENTE en Railway:');
console.log('  railway variables --set JWT_SECRET=' + newJwtSecret);
console.log('  railway variables --set MiniMax_API_KEY=<nueva clave MiniMax>');
console.log('  railway variables --set GEMINI_API_KEY=<nueva clave Gemini>');
console.log('  railway variables --set DATABASE_URL=<nueva DATABASE_URL>');
console.log('');
console.log('⚠️  DESPUÉS:');
console.log('  railway redeploy --service legalpro-backend-node');
console.log('  railway redeploy --service legalpro-backend-dotnet');
