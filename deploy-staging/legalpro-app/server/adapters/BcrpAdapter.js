// legalpro-app/server/adapters/BcrpAdapter.js
// Generado por @backend-node (Sprint 1 - Tarea 8)
// Adapter de BCRP (tasa de interes legal y tipo de cambio)

export class BcrpAdapter {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || process.env.BCRP_API_URL || 'https://estadisticas.bcrp.gob.pe/estadisticas/series/api';
    this.timeout = options.timeout || 5000;
    this.cache = new Map();
    this.cacheTtl = (options.cacheTtl || 86400) * 1000;
  }

  async getTasaInteresLegal(fecha = new Date()) {
    const cacheKey = `tasa-${fecha.toISOString().split('T')[0]}`;
    if (this._isValidCache(cacheKey)) return this.cache.get(cacheKey).value;

    try {
      const res = await fetch(`${this.apiUrl}/PD04645PD/json/2020/2026`, {
        signal: AbortSignal.timeout(this.timeout)
      });
      if (!res.ok) throw new Error(`BCRP ${res.status}`);
      const data = await res.json();
      const tasa = data?.config?.length > 0 ? parseFloat(data.periods?.[0]?.values?.[0]) : null;
      const result = { tasa, fechaVigencia: new Date().toISOString().split('T')[0] };
      this.cache.set(cacheKey, { value: result, ts: Date.now() });
      return result;
    } catch (e) {
      return this._fallbackTasa(fecha);
    }
  }

  async getTipoCambio(fecha = new Date()) {
    const cacheKey = `tc-${fecha.toISOString().split('T')[0]}`;
    if (this._isValidCache(cacheKey)) return this.cache.get(cacheKey).value;

    try {
      const res = await fetch(`${this.apiUrl}/PD04655PD/json/2020/2026`, {
        signal: AbortSignal.timeout(this.timeout)
      });
      if (!res.ok) throw new Error(`BCRP ${res.status}`);
      const data = await res.json();
      const tc = data?.periods?.[0]?.values?.[0];
      const result = {
        compra: parseFloat(tc?.[0]) || 0,
        venta: parseFloat(tc?.[1]) || 0,
        fecha: new Date().toISOString().split('T')[0]
      };
      this.cache.set(cacheKey, { value: result, ts: Date.now() });
      return result;
    } catch (e) {
      return { compra: 0, venta: 0, fecha: new Date().toISOString().split('T')[0], error: 'BCRP unavailable' };
    }
  }

  _isValidCache(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() - entry.ts < this.cacheTtl;
  }

  _fallbackTasa(fecha) {
    return { tasa: 0.06, fechaVigencia: fecha.toISOString().split('T')[0], fallback: true };
  }
}
