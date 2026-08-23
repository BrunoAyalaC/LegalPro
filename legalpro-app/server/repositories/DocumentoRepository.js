// legalpro-app/server/repositories/DocumentoRepository.js
// Generado por @backend-node (Sprint 1 - Tarea 6)
// Repositorio de Documentos con multi-tenant estricto

import { BaseRepository } from './BaseRepository.js';

export class DocumentoRepository extends BaseRepository {
  constructor(db) {
    super(db, 'documentos');
  }

  async create(data) {
    return super.create({
      ...data,
      es_inmutable: true,
      ocr_status: 'pending'
    });
  }

  async findByExpediente(expedienteId, organizationId) {
    const { rows } = await this.query(
      `SELECT * FROM ${this.table}
       WHERE expediente_id = $1 AND organization_id = $2 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [expedienteId, organizationId]
    );
    return rows;
  }

  async findByHash(hashSha256) {
    const { rows } = await this.query(
      `SELECT * FROM ${this.table} WHERE hash_sha256 = $1 LIMIT 1`,
      [hashSha256]
    );
    return rows[0] || null;
  }

  async updateOcrStatus(id, status, ocrText) {
    const { rows } = await this.query(
      `UPDATE ${this.table}
       SET ocr_status = $1, texto_ocr = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, ocrText, id]
    );
    return rows[0];
  }

  async attachFirmaDigital(id, firmaId) {
    const { rows } = await this.query(
      `UPDATE ${this.table}
       SET firma_digital_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [firmaId, id]
    );
    return rows[0];
  }

  async softDelete(id, organizationId) {
    const { rows } = await this.query(
      `UPDATE ${this.table}
       SET deleted_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING id`,
      [id, organizationId]
    );
    return rows[0];
  }
}
