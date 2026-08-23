// legalpro-app/server/adapters/SmsAdapter.js
// Adapter de SMS (Twilio) - mock-first, solo para LPDP breach notification

export class SmsAdapter {
  constructor(options = {}) {
    this.provider = options.provider || 'twilio';
    this.from = options.from || '+51100000000';
    this.mode = options.mode || 'mock';
    this.sentLog = [];
  }

  async send({ to, message }) {
    if (this.mode === 'mock') return this._mockSend({ to, message });
    throw new Error('SMS real mode not implemented.');
  }

  async sendLpdpBreachAlert({ to, message }) {
    return this.send({ to, message: `[LPDP BREACH] ${message}` });
  }

  _mockSend({ to, message }) {
    const id = `sms-mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.sentLog.push({ id, to, message: message.slice(0, 50), ts: new Date().toISOString() });
    console.log(`[SmsAdapter MOCK] To: ${to}, Message: ${message.slice(0, 50)}`);
    return { success: true, messageId: id, mock: true };
  }

  getSentLog() {
    return this.sentLog;
  }
}
