// legalpro-app/server/repositories/ExpedienteRepository.js
// Generado por @backend-node (Sprint 1 - Tarea 6)
// Repositorio de Expedientes con multi-tenant y soft-delete

import { BaseRepository } from './BaseRepository.js';

export class ExpedienteRepository extends BaseRepository {
  constructor(db) {
    super(db, 'expedientes');
  }

  async findByOrganization(organizationId, options = {}) {
    const { limit = 50, offset = 0, estado = null, materia = null, search = null } = options;
    const params = [organizationId];
    let where = 'organization_id = $1 AND deleted_at IS NULL';
    let paramIdx = 2;

    if (estado) {
      where += ` AND estado = $${paramIdx++}`;
      params.push(estado);
    }
    if (materia) {
      where += ` AND materia = $${paramIdx++}`;
      params.push(materia);
    }
    if (search) {
      where += ` AND (titulo ILIKE $${paramIdx} OR numero ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    params.push(limit, offset);
    const { rows } = await this.query(
      `SELECT * FROM ${this.table}
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      params
    );
    return rows;
  }

  async findByIdAndOrg(id, organizationId) {
    const { rows } = await this.query(
      `SELECT * FROM ${this.table}
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [id, organizationId]
    );
    return rows[0] || null;
  }

  async findByNumero(numero) {
    const { rows } = await this.query(
      `SELECT * FROM ${this.table}
       WHERE numero = $1 AND deleted_at IS NULL`,
      [numero]
    );
    return rows[0] || null;
  }

  async getStatsByOrganization(organizationId) {
    const { rows } = await this.query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE estado = 'activo') as activos,
         COUNT(*) FILTER (WHERE estado = 'archivado') as archivados,
         COUNT(*) FILTER (WHERE estado = 'cerrado') as cerrados,
         COUNT(*) FILTER (WHERE es_urgente = true) as urgentes,
         COUNT(*) FILTER (WHERE es_dato_sensible = true) as datos_sensibles
       FROM ${this.table}
       WHERE organization_id = $1 AND deleted_at IS NULL`,
      [organizationId]
    );
    return rows[0];
  }

  async findUrgentByOrganization(organizationId) {
    const { rows } = await this.query(
      `SELECT * FROM ${this.table}
       WHERE organization_id = $1 AND es_urgente = true AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [organizationId]
    );
    return rows;
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
