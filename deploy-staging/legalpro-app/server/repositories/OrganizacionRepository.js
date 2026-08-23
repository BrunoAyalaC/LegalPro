import { BaseRepository } from './BaseRepository.js';

export class OrganizacionRepository extends BaseRepository {
  async findById(id) {
    const { rows } = await this.query(
      `SELECT o.*,
              (SELECT COUNT(*) FROM miembros_organizacion WHERE organizacion_id = o.id AND activo = TRUE) AS usuarios_usados,
              (SELECT COUNT(*) FROM expedientes WHERE organization_id = o.id) AS expedientes_usados
       FROM organizaciones o
       WHERE o.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async create(data, userId) {
    const { nombre, slug, plan, maxUsuarios, maxExpedientes } = data;

    return this.transaction(async (client) => {
      const { rows: orgRows } = await client.query(
        `INSERT INTO organizaciones (nombre, slug, plan, max_usuarios, max_expedientes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [nombre.trim(), slug, plan, maxUsuarios, maxExpedientes]
      );
      const org = orgRows[0];

      await client.query(
        `INSERT INTO miembros_organizacion (organizacion_id, usuario_id, rol, activo)
         VALUES ($1, $2, 'OWNER', TRUE)`,
        [org.id, userId]
      );

      return org;
    });
  }

  async findMembers(organizationId) {
    const { rows } = await this.query(
      `SELECT mo.id, mo.rol, mo.activo, mo.created_at,
              u.id AS u_id, u.nombre_completo, u.email, u.rol AS u_rol, u.especialidad
       FROM miembros_organizacion mo
       JOIN usuarios u ON u.id = mo.usuario_id
       WHERE mo.organizacion_id = $1 AND mo.activo = TRUE
       ORDER BY mo.created_at ASC`,
      [organizationId]
    );
    return rows;
  }

  async addMember(organizationId, userId, rol = 'MEMBER') {
    const { rows } = await this.query(
      `INSERT INTO miembros_organizacion (organizacion_id, usuario_id, rol, activo)
       VALUES ($1, $2, $3, TRUE)
       RETURNING *`,
      [organizationId, userId, rol.toUpperCase()]
    );
    return rows[0] || null;
  }

  async removeMember(organizationId, userId) {
    const { rows } = await this.query(
      `UPDATE miembros_organizacion SET activo = FALSE
       WHERE organizacion_id = $1 AND usuario_id = $2
       RETURNING *`,
      [organizationId, userId]
    );
    return rows[0] || null;
  }

  async getMemberRole(organizationId, userId) {
    const { rows } = await this.query(
      `SELECT rol FROM miembros_organizacion
       WHERE organizacion_id = $1 AND usuario_id = $2
       LIMIT 1`,
      [organizationId, userId]
    );
    return rows[0]?.rol || null;
  }

  async countActiveMembers(organizationId) {
    const { rows } = await this.query(
      `SELECT COUNT(*) AS total FROM miembros_organizacion WHERE organizacion_id = $1 AND activo = TRUE`,
      [organizationId]
    );
    return parseInt(rows[0].total, 10);
  }

  async getMaxUsuarios(organizationId) {
    const { rows } = await this.query(
      `SELECT max_usuarios FROM organizaciones WHERE id = $1`,
      [organizationId]
    );
    return rows[0]?.max_usuarios ?? 3;
  }

  async findPendingInvitation(organizationId, email) {
    const { rows } = await this.query(
      `SELECT id FROM invitaciones_organizacion
       WHERE organization_id = $1 AND email = $2 AND esta_aceptada = FALSE`,
      [organizationId, email.toLowerCase().trim()]
    );
    return rows[0] || null;
  }

  async createInvitation(organizationId, email, rol, token, invitadoPor) {
    const { rows } = await this.query(
      `INSERT INTO invitaciones_organizacion
         (organization_id, email, rol, token, expira_at, invitado_por)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days', $5)
       RETURNING *`,
      [organizationId, email.toLowerCase().trim(), rol.toUpperCase(), token, invitadoPor]
    );
    return rows[0] || null;
  }

  async findInvitationByToken(token) {
    const { rows } = await this.query(
      `SELECT inv.*, o.id AS o_id, o.nombre AS o_nombre, o.slug AS o_slug,
              o.plan AS o_plan, o.max_usuarios, o.max_expedientes
       FROM invitaciones_organizacion inv
       JOIN organizaciones o ON o.id = inv.organization_id
       WHERE inv.token = $1 AND inv.esta_aceptada = FALSE
       LIMIT 1`,
      [token]
    );
    return rows[0] || null;
  }

  async isMember(organizationId, userId) {
    const { rows } = await this.query(
      `SELECT id FROM miembros_organizacion
       WHERE organizacion_id = $1 AND usuario_id = $2
       LIMIT 1`,
      [organizationId, userId]
    );
    return rows.length > 0;
  }

  async acceptInvitation(invitationId, userId, organizationId, rol) {
    return this.transaction(async (client) => {
      await client.query(
        `INSERT INTO miembros_organizacion (organizacion_id, usuario_id, rol, activo)
         VALUES ($1, $2, $3, TRUE)`,
        [organizationId, userId, rol.toUpperCase()]
      );

      await client.query(
        `UPDATE invitaciones_organizacion
         SET esta_aceptada = TRUE, aceptada_at = NOW()
         WHERE id = $1`,
        [invitationId]
      );

      return true;
    });
  }
}
