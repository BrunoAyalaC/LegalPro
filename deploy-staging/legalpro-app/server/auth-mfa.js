// legalpro-app/server/auth-mfa.js
// Generado por @auditor-seguridad + @backend-node (Sprint 2 - MFA TOTP)
// Multi-Factor Authentication con TOTP (RFC 6238)

import crypto from 'node:crypto';
import { authenticator } from 'otplib';

const BACKUP_CODES_COUNT = 8;
const BACKUP_CODE_BYTES = 4;

const otplibOptions = {
  window: 1,  // +-30 segundos de tolerancia
  step: 30
};
authenticator.options = otplibOptions;

export class MfaService {
  static generateSecret(userEmail) {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(userEmail, 'LegalPro', secret);
    const backupCodes = Array.from({ length: BACKUP_CODES_COUNT }, () =>
      crypto.randomBytes(BACKUP_CODE_BYTES).toString('hex').toUpperCase()
    );
    return { secret, otpauth, backupCodes };
  }

  static verifyToken(token, secret) {
    try {
      return authenticator.verify({ token, secret });
    } catch (e) {
      return false;
    }
  }

  static async setupMfaForUser(userId, userEmail) {
    const setup = this.generateSecret(userEmail);
    return {
      qrCodeUrl: setup.otpauth,
      manualKey: setup.secret,
      backupCodes: setup.backupCodes
    };
  }

  static async verifyMfaChallenge(userId, token, secret, usedBackupCodes = []) {
    if (usedBackupCodes.includes(token.toUpperCase())) {
      return { valid: true, type: 'backup' };
    }
    const isValid = this.verifyToken(token, secret);
    return { valid: isValid, type: 'totp' };
  }
}

export default MfaService;
