// legalpro-app/server/routes/auth-mfa-routes.js
// Generado por @auditor-seguridad + @backend-node
// FIX CRITICAL: Implementa MFA TOTP para roles sensibles (ABOGADO, FISCAL, JUEZ, ADMIN)
// Cumple con recomendacion del refitador-redteam (cadena de ataque "robo masivo de expedientes")

import { Router } from 'express';
import { authenticator } from 'otplib';
import crypto from 'node:crypto';
import db from '../db.js';
import { logAudit } from '../utils/audit.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

const MFA_REQUIRED_ROLES = new Set(['ABOGADO', 'FISCAL', 'JUEZ', 'ADMIN', 'OWNER']);

// 1. Setup MFA - Genera secret + QR + backup codes
router.post('/mfa/setup', authMiddleware, async (req, res) => {
  try {
    const { userId, email, rol } = req.user;
    if (!MFA_REQUIRED_ROLES.has(rol)) {
      return res.status(403).json({ success: false, error: 'MFA not required for this role' });
    }

    // Generar secret
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(email, 'LegalPro', secret);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(otpauth)}&size=300x300`;

    // Generar 8 backup codes
    const backupCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // Guardar temporal (NO habilitado hasta verificar primer TOTP)
    await db.query(
      `UPDATE usuarios SET mfa_secret_temp = $1, mfa_backup_codes_temp = $2, mfa_setup_at = NOW()
       WHERE id = $3`,
      [secret, backupCodes, userId]
    );

    await logAudit('MFA_SETUP_INITIATED', {
      severity: 'INFO',
      userId,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        secret,
        otpauth,
        qrCodeUrl,
        backupCodes,
        instructions: 'Escanea el QR con Google Authenticator o Authy, luego verifica con /mfa/verify-enable'
      }
    });
  } catch (e) {
    console.error('[mfa.setup]', e);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// 2. Verificar y habilitar MFA (confirma que el usuario configuro bien su TOTP)
router.post('/mfa/verify-enable', authMiddleware, async (req, res) => {
  try {
    const { userId, ip } = req.user;
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, error: 'Token required' });

    const { rows: users } = await db.query(
      `SELECT mfa_secret_temp, mfa_backup_codes_temp FROM usuarios WHERE id = $1`,
      [userId]
    );
    if (users.length === 0 || !users[0].mfa_secret_temp) {
      return res.status(400).json({ success: false, error: 'MFA setup not initiated' });
    }

    const isValid = authenticator.verify({
      token: String(token).replace(/\s/g, ''),
      secret: users[0].mfa_secret_temp
    });

    if (!isValid) {
      await logAudit('MFA_SETUP_FAILED', { severity: 'WARNING', userId, ip });
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    // Mover de temp a activo
    await db.query(
      `UPDATE usuarios SET
        mfa_secret = mfa_secret_temp,
        mfa_backup_codes = mfa_backup_codes_temp,
        mfa_secret_temp = NULL,
        mfa_backup_codes_temp = NULL,
        mfa_enabled = true,
        mfa_enabled_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    await logAudit('MFA_ENABLED', {
      severity: 'INFO',
      userId,
      ip
    });

    res.json({ success: true, message: 'MFA enabled successfully' });
  } catch (e) {
    console.error('[mfa.verify-enable]', e);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// 3. Verificar MFA en login
router.post('/mfa/verify', async (req, res) => {
  try {
    const { userId, token, type } = req.body;
    if (!userId || !token) {
      return res.status(400).json({ success: false, error: 'userId and token required' });
    }

    const { rows: users } = await db.query(
      `SELECT mfa_secret, mfa_backup_codes, mfa_enabled FROM usuarios WHERE id = $1`,
      [userId]
    );
    if (users.length === 0 || !users[0].mfa_enabled) {
      return res.status(400).json({ success: false, error: 'MFA not enabled' });
    }

    let isValid = false;
    let usedBackupCode = false;

    if (type === 'totp') {
      isValid = authenticator.verify({
        token: String(token).replace(/\s/g, ''),
        secret: users[0].mfa_secret
      });
    } else if (type === 'backup') {
      const codes = users[0].mfa_backup_codes || [];
      const normalized = String(token).toUpperCase().replace(/\s/g, '');
      const idx = codes.indexOf(normalized);
      if (idx >= 0) {
        isValid = true;
        usedBackupCode = true;
        codes.splice(idx, 1);
        await db.query(
          `UPDATE usuarios SET mfa_backup_codes = $1 WHERE id = $2`,
          [JSON.stringify(codes), userId]
        );
      }
    } else {
      return res.status(400).json({ success: false, error: 'type must be totp or backup' });
    }

    if (!isValid) {
      await logAudit('MFA_VERIFY_FAILED', {
        severity: 'WARNING',
        userId,
        ip: req.ip,
        type
      });
      return res.status(401).json({ success: false, error: 'Invalid MFA token' });
    }

    await logAudit('MFA_VERIFY_SUCCESS', {
      severity: 'INFO',
      userId,
      ip: req.ip,
      type,
      usedBackupCode
    });

    res.json({
      success: true,
      data: { verified: true, type, usedBackupCode }
    });
  } catch (e) {
    console.error('[mfa.verify]', e);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// 4. Deshabilitar MFA (requiere password actual)
router.post('/mfa/disable', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { password, token } = req.body;
    if (!password || !token) {
      return res.status(400).json({ success: false, error: 'Password and TOTP token are required in body' });
    }
    const { rows: users } = await db.query(
      `SELECT password_hash, mfa_secret, mfa_enabled FROM usuarios WHERE id = $1`,
      [userId]
    );
    if (users.length === 0) return res.status(404).json({ success: false });

    // Verificar password
    const bcrypt = await import('bcryptjs');
    const passwordOk = await bcrypt.compare(password, users[0].password_hash);
    if (!passwordOk) {
      await logAudit('MFA_DISABLE_FAILED', { severity: 'WARNING', userId, ip: req.ip, reason: 'bad_password' });
      return res.status(401).json({ success: false, error: 'Invalid password' });
    }

    // Verificar TOTP
    const isValid = authenticator.verify({
      token: String(token).replace(/\s/g, ''),
      secret: users[0].mfa_secret
    });
    if (!isValid) {
      await logAudit('MFA_DISABLE_FAILED', { severity: 'WARNING', userId, ip: req.ip, reason: 'bad_totp' });
      return res.status(401).json({ success: false, error: 'Invalid TOTP' });
    }

    await db.query(
      `UPDATE usuarios SET mfa_enabled = false, mfa_secret = NULL, mfa_backup_codes = NULL
       WHERE id = $1`,
      [userId]
    );

    await logAudit('MFA_DISABLED', { severity: 'HIGH', userId, ip: req.ip });
    res.json({ success: true, message: 'MFA disabled' });
  } catch (e) {
    console.error('[mfa.disable]', e);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export default router;
