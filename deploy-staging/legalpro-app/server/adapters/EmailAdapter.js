// legalpro-app/server/adapters/EmailAdapter.js
// Adapter de Email (Resend / SendGrid) - mock-first

export class EmailAdapter {
  constructor(options = {}) {
    this.provider = options.provider || 'resend';
    this.apiKey = options.apiKey;
    this.from = options.from || 'noreply@legalpro.pe';
    this.mode = options.mode || 'mock';
    this.sentLog = [];
  }

  async send({ to, subject, html, text }) {
    if (this.mode === 'mock') return this._mockSend({ to, subject, html, text });
    throw new Error('Email real mode not implemented.');
  }

  async sendTemplate(templateId, variables, to) {
    if (this.mode === 'mock') return this._mockSendTemplate(templateId, variables, to);
    throw new Error('Email real mode not implemented.');
  }

  _mockSend({ to, subject, html, text }) {
    const id = `email-mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.sentLog.push({ id, to, subject, ts: new Date().toISOString() });
    console.log(`[EmailAdapter MOCK] To: ${to}, Subject: ${subject}`);
    return { success: true, messageId: id, mock: true };
  }

  _mockSendTemplate(templateId, variables, to) {
    const subjects = {
      'consentimiento-otorgado': 'Bienvenido a LegalPro',
      'lanzamiento-proxima-cuenta': 'Tu cuenta se vence en 7 dias',
      'lpdp-breach-notification': 'Aviso importante sobre tus datos',
      'plan-cambio': 'Tu plan ha sido actualizado',
      'suspension-7dias': 'Aviso de suspension en 7 dias'
    };
    const subject = subjects[templateId] || `Template: ${templateId}`;
    return this._mockSend({ to, subject, html: `<p>Template ${templateId} rendered with variables</p>`, text: '' });
  }

  getSentLog() {
    return this.sentLog;
  }
}
