// legalpro-app/server/adapters/SpijAdapter.js
// Adapter de SPIJ (Sistema Peruano de Informacion Juridica del MINJUS)
// Mock-first + cache local de catalogs/codigos-leyes.json

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..', '..');
const CATALOG_PATH = resolve(ROOT, 'catalogs/codigos-leyes.json');

export class SpijAdapter {
  constructor(options = {}) {
    this.cache = null;
    this.cacheTtl = (options.cacheTtl || 3600) * 1000;
    this.cacheTs = 0;
    this.mode = options.mode || 'mock';
  }

  async searchNorma(query) {
    if (this.mode === 'mock' || !this.apiUrl) {
      return this._mockSearch(query);
    }
    throw new Error('SPIJ real mode not implemented. Use mock-first.');
  }

  async getNormaById(id) {
    if (this.mode === 'mock' || !this.apiUrl) {
      return this._mockGet(id);
    }
    throw new Error('SPIJ real mode not implemented.');
  }

  async _loadCatalog() {
    if (this.cache && Date.now() - this.cacheTs < this.cacheTtl) return this.cache;
    try {
      const data = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
      this.cache = data.normas || [];
      this.cacheTs = Date.now();
      return this.cache;
    } catch (e) {
      this.cache = [];
      return [];
    }
  }

  async _mockSearch(query) {
    const catalog = await this._loadCatalog();
    const q = (query || '').toLowerCase();
    if (!q) return catalog.slice(0, 20);
    return catalog.filter(n =>
      n.nombre.toLowerCase().includes(q) ||
      n.id.toLowerCase().includes(q) ||
      (n.articulos_mas_citados || []).some(a => a.toLowerCase().includes(q))
    ).slice(0, 20);
  }

  async _mockGet(id) {
    const catalog = await this._loadCatalog();
    return catalog.find(n => n.id === id) || null;
  }
}
