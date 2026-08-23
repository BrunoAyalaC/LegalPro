// legalpro-app/server/adapters/SinoeAdapter.js
// Generado por @backend-node (Sprint 1 - Tarea 8)
// Adapter de SINOE (Sistema de Notificaciones Electronicas del PJ) - MOCK-FIRST

export class SinoeAdapter {
  constructor(options = {}) {
    this.mode = options.mode || 'mock';
    this.pollInterval = options.pollInterval || 15 * 60 * 1000;
    this.cache = new Map();
  }

  async getNotificaciones(expedienteId, options = {}) {
    if (this.mode === 'mock') {
      return this._mockNotificaciones(expedienteId, options);
    }
    throw new Error('Sinoe real mode not implemented. Use mock-first.');
  }

  async pollNew(usuarioId) {
    if (this.mode === 'mock') {
      return this._mockNotificaciones(usuarioId, { unread: true });
    }
    throw new Error('Sinoe real mode not implemented.');
  }

  _mockNotificaciones(filter, options = {}) {
    const seed = this._hashToSeed(String(filter));
    const count = (seed % 5) + 1;
    const items = [];
    for (let i = 0; i < count; i++) {
      const id = `notif-mock-${seed}-${i}`;
      items.push({
        id,
        expediente: `000${(seed % 100) + i}-2026`,
        tipo: ['CEDULA', 'RESOLUCION', 'AUDIENCIA', 'SENTENCIA'][i % 4],
        fecha: new Date(Date.now() - i * 86400000).toISOString(),
        leida: options.unread ? false : i % 2 === 0,
        resumen: `Notificacion mock #${i} para ${filter}`,
        url_pdf: `https://sinoe.pj.gob.pe/mock/${id}.pdf`,
        plazo_dias: [3, 5, 10, 15][i % 4],
        fecha_vencimiento: new Date(Date.now() + (5 - i) * 86400000).toISOString()
      });
    }
    return items;
  }

  _hashToSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i);
    return Math.abs(h);
  }
}
