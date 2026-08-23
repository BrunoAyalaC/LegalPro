import { BaseRepository } from './BaseRepository.js';

export class MensajeRepository extends BaseRepository {
  async guardarMensaje(usuarioId, orgId, expedienteId, contenido, rol) {
    const { rows } = await this.query(
      `INSERT INTO mensajes_chat (usuario_id, organization_id, expediente_id, contenido, rol)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [usuarioId, orgId, expedienteId ?? null, contenido, rol]
    );
    return rows[0];
  }

  async guardarParMensajes(usuarioId, orgId, expedienteId, mensajeUsuario, mensajeAsistente) {
    return this.query(
      `INSERT INTO mensajes_chat (usuario_id, organization_id, expediente_id, contenido, rol)
       VALUES ($1,$2,$3,$4,'user'),($1,$2,$3,$5,'assistant')`,
      [usuarioId, orgId, expedienteId ?? null, mensajeUsuario, mensajeAsistente]
    );
  }

  async obtenerHistorial(usuarioId, orgId, { limit = 50, expedienteId } = {}) {
    const params = [usuarioId, orgId];
    let sql = `SELECT id, contenido AS mensaje_usuario, rol, created_at, expediente_id
               FROM mensajes_chat WHERE usuario_id=$1 AND organization_id=$2`;
    if (expedienteId) {
      sql += ` AND expediente_id=$${params.length + 1}`;
      params.push(expedienteId);
    }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(Math.min(200, parseInt(limit)));

    const { rows } = await this.query(sql, params);
    return rows;
  }

  /**
   * Elimina todo el historial de chat del usuario en la organización,
   * opcionalmente filtrado por expediente_id.
   * Retorna la cantidad de filas eliminadas.
   *
   * @param {string} usuarioId
   * @param {string} orgId
   * @param {object} [opts]
   * @param {string} [opts.expedienteId] — si se provee, solo borra mensajes de ese expediente
   * @returns {Promise<number>}
   */
  async eliminarHistorial(usuarioId, orgId, { expedienteId } = {}) {
    const params = [usuarioId, orgId];
    let sql = `DELETE FROM mensajes_chat WHERE usuario_id=$1 AND organization_id=$2`;
    if (expedienteId) {
      sql += ` AND expediente_id=$${params.length + 1}`;
      params.push(expedienteId);
    }
    sql += ` RETURNING id`;

    const { rows } = await this.query(sql, params);
    return rows.length;
  }
}
