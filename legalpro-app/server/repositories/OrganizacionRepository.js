import crypto from 'crypto';
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

    // [FIX P0 2026-08-08] RLS multi-tenant (BUG#1 #P0 del auditor-legal).
    //
    // ANTECEDENTE:
    //   La BD de producción tiene RLS habilitado en `organizaciones` y
    //   `miembros_organizacion` con policies `tenant_isolation_*` (creadas
    //   por el backend .NET EF Core, distintas a las `p_*` del init.sql).
    //   Dichas policies exigen:
    //     organizaciones:    id              = current_setting('app.current_org_id', true)
    //     miembros_organiz: organizacion_id = current_setting('app.current_org_id', true)
    //   El rol de BD que usa el backend (`legalpro_app`) NO es superuser ni
    //   tiene BYPASSRLS, por lo que RLS SÍ aplica — a diferencia del rol
    //   `postgres` que sí lo bypasa (lo que hacía que los tests con
    //   connectionString de admin no detectaran el bug).
    //
    // BUG ORIGINAL:
    //   POST /api/organizaciones llama a este método con un usuario recién
    //   registrado que todavía no tiene organización (no hay row en
    //   `miembros_organizacion` para él). Por lo tanto, el contexto tenant
    //   no tiene `app.current_org_id` seteado, y el INSERT fallaba con:
    //     42501 new row violates row-level security policy for table "organizaciones"
    //   Resultado: HTTP 500 — usuarios nuevos no podían crear organizaciones;
    //   solo funcionaba para los usuarios demo pre-sembrados (que ya
    //   tenían un OWNER row y por lo tanto su `app.current_org_id`
    //   entraba al contexto tenant desde el JWT).
    //
    // FIX:
    //   Pre-generamos el UUID en Node y lo seteamos en la misma transacción
    //   con SET LOCAL antes del INSERT. Así la policy RLS ve
    //   `id = current_setting('app.current_org_id')` y coincide (no es un
    //   bypass — seguimos bajo RLS, solo satisfacemos la policy de forma
    //   legítima usando el mismo UUID que vamos a persistir).
    //   No se deshabilita RLS ni se tocan policies: la BD queda intacta.
    const newOrgId = crypto.randomUUID();

    return this.transaction(async (client) => {
      // Activar el contexto RLS para esta transacción.
      // SET LOCAL (tercer argumento `true`) asegura que las variables
      // mueren al COMMIT/ROLLBACK — no contaminan el pool ni otras requests.
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
      await client.query(`SELECT set_config('app.current_org_id',  $1, true)`, [newOrgId]);
      await client.query(`SELECT set_config('app.current_user_rol', 'OWNER', true)`);

      const { rows: orgRows } = await client.query(
        `INSERT INTO organizaciones (id, nombre, slug, plan, max_usuarios, max_expedientes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [newOrgId, nombre.trim(), slug, plan, maxUsuarios, maxExpedientes]
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
