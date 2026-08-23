// legalpro-app/server/adapters/SunatAdapter.js
// Adapter de SUNAT (mock-first)

export class SunatAdapter {
  constructor(options = {}) {
    this.mode = options.mode || 'mock';
    this.timeout = options.timeout || 10000;
    this.cache = new Map();
    this.cacheTtl = (options.cacheTtl || 86400) * 1000;
  }

  async getRucInfo(ruc) {
    if (this.mode === 'mock') return this._mockRuc(ruc);
    throw new Error('SUNAT real mode not implemented.');
  }

  async getTipoCambio(fecha = new Date()) {
    if (this.mode === 'mock') {
      return { compra: 3.72, venta: 3.74, fecha: fecha.toISOString().split('T')[0], fuente: 'MOCK' };
    }
    throw new Error('SUNAT real mode not implemented.');
  }

  _mockRuc(ruc) {
    if (!ruc || ruc.length !== 11) {
      return { success: false, error: 'RUC debe tener 11 digitos' };
    }
    return {
      success: true,
      data: {
        ruc,
        razon_social: `EMPRESA MOCK ${ruc} SAC`,
        estado: 'ACTIVO',
        condicion: 'HABIDO',
        direccion: 'AV. MOCK 123, LIMA, LIMA',
        ubigeo: '150101',
        tipo: 'SOCIEDAD ANONIMA CERRADA'
      }
    };
  }
}
