using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LegalPro.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SnakeCaseColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_eventos_simulacion_simulaciones_SimulacionId",
                table: "eventos_simulacion");

            migrationBuilder.DropForeignKey(
                name: "FK_expedientes_organizaciones_OrganizacionId",
                table: "expedientes");

            migrationBuilder.DropForeignKey(
                name: "FK_expedientes_usuarios_UsuarioId",
                table: "expedientes");

            migrationBuilder.DropForeignKey(
                name: "FK_invitaciones_organizacion_organizaciones_OrganizacionId",
                table: "invitaciones_organizacion");

            migrationBuilder.DropForeignKey(
                name: "FK_mensajes_chat_usuarios_UsuarioId",
                table: "mensajes_chat");

            migrationBuilder.DropForeignKey(
                name: "FK_miembros_organizacion_organizaciones_OrganizacionId",
                table: "miembros_organizacion");

            migrationBuilder.DropForeignKey(
                name: "FK_miembros_organizacion_usuarios_UsuarioId",
                table: "miembros_organizacion");

            migrationBuilder.DropForeignKey(
                name: "FK_refresh_tokens_usuarios_UsuarioId",
                table: "refresh_tokens");

            migrationBuilder.DropForeignKey(
                name: "FK_simulaciones_usuarios_UsuarioId",
                table: "simulaciones");

            migrationBuilder.DropForeignKey(
                name: "FK_usuarios_organizaciones_OrganizacionId",
                table: "usuarios");

            migrationBuilder.DropPrimaryKey(
                name: "PK_usuarios",
                table: "usuarios");

            migrationBuilder.DropPrimaryKey(
                name: "PK_simulaciones",
                table: "simulaciones");

            migrationBuilder.DropPrimaryKey(
                name: "PK_refresh_tokens",
                table: "refresh_tokens");

            migrationBuilder.DropPrimaryKey(
                name: "PK_organizaciones",
                table: "organizaciones");

            migrationBuilder.DropPrimaryKey(
                name: "PK_miembros_organizacion",
                table: "miembros_organizacion");

            migrationBuilder.DropPrimaryKey(
                name: "PK_mensajes_chat",
                table: "mensajes_chat");

            migrationBuilder.DropPrimaryKey(
                name: "PK_invitaciones_organizacion",
                table: "invitaciones_organizacion");

            migrationBuilder.DropPrimaryKey(
                name: "PK_expedientes",
                table: "expedientes");

            migrationBuilder.DropPrimaryKey(
                name: "PK_eventos_simulacion",
                table: "eventos_simulacion");

            migrationBuilder.DropPrimaryKey(
                name: "PK_base_legal_vectorial",
                table: "base_legal_vectorial");

            migrationBuilder.RenameColumn(
                name: "Rol",
                table: "usuarios",
                newName: "rol");

            migrationBuilder.RenameColumn(
                name: "Especialidad",
                table: "usuarios",
                newName: "especialidad");

            migrationBuilder.RenameColumn(
                name: "Email",
                table: "usuarios",
                newName: "email");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "usuarios",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "usuarios",
                newName: "updated_at");

            migrationBuilder.RenameColumn(
                name: "PasswordHash",
                table: "usuarios",
                newName: "password_hash");

            migrationBuilder.RenameColumn(
                name: "OrganizationId",
                table: "usuarios",
                newName: "organization_id");

            migrationBuilder.RenameColumn(
                name: "OrganizacionId",
                table: "usuarios",
                newName: "organizacion_id");

            migrationBuilder.RenameColumn(
                name: "NombreCompleto",
                table: "usuarios",
                newName: "nombre_completo");

            migrationBuilder.RenameColumn(
                name: "EstaActivo",
                table: "usuarios",
                newName: "esta_activo");

            migrationBuilder.RenameColumn(
                name: "EsAdminOrganizacion",
                table: "usuarios",
                newName: "es_admin_organizacion");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "usuarios",
                newName: "created_at");

            migrationBuilder.RenameIndex(
                name: "IX_usuarios_Email",
                table: "usuarios",
                newName: "ix_usuarios_email");

            migrationBuilder.RenameIndex(
                name: "IX_usuarios_OrganizacionId",
                table: "usuarios",
                newName: "ix_usuarios_organizacion_id");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "simulaciones",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "UsuarioId",
                table: "simulaciones",
                newName: "usuario_id");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "simulaciones",
                newName: "updated_at");

            migrationBuilder.RenameColumn(
                name: "RolUsuario",
                table: "simulaciones",
                newName: "rol_usuario");

            migrationBuilder.RenameColumn(
                name: "RamaDerecho",
                table: "simulaciones",
                newName: "rama_derecho");

            migrationBuilder.RenameColumn(
                name: "PuntajeActual",
                table: "simulaciones",
                newName: "puntaje_actual");

            migrationBuilder.RenameColumn(
                name: "OrganizationId",
                table: "simulaciones",
                newName: "organization_id");

            migrationBuilder.RenameColumn(
                name: "EstaFinalizada",
                table: "simulaciones",
                newName: "esta_finalizada");

            migrationBuilder.RenameColumn(
                name: "DificultadModificador",
                table: "simulaciones",
                newName: "dificultad_modificador");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "simulaciones",
                newName: "created_at");

            migrationBuilder.RenameColumn(
                name: "ContextoSintetico",
                table: "simulaciones",
                newName: "contexto_sintetico");

            migrationBuilder.RenameIndex(
                name: "IX_simulaciones_UsuarioId",
                table: "simulaciones",
                newName: "ix_simulaciones_usuario_id");

            migrationBuilder.RenameColumn(
                name: "Token",
                table: "refresh_tokens",
                newName: "token");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "refresh_tokens",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "UsuarioId",
                table: "refresh_tokens",
                newName: "usuario_id");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "refresh_tokens",
                newName: "updated_at");

            migrationBuilder.RenameColumn(
                name: "RevokedAt",
                table: "refresh_tokens",
                newName: "revoked_at");

            migrationBuilder.RenameColumn(
                name: "ReplacedByToken",
                table: "refresh_tokens",
                newName: "replaced_by_token");

            migrationBuilder.RenameColumn(
                name: "IsRevoked",
                table: "refresh_tokens",
                newName: "is_revoked");

            migrationBuilder.RenameColumn(
                name: "ExpiresAt",
                table: "refresh_tokens",
                newName: "expires_at");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "refresh_tokens",
                newName: "created_at");

            migrationBuilder.RenameColumn(
                name: "Slug",
                table: "organizaciones",
                newName: "slug");

            migrationBuilder.RenameColumn(
                name: "Plan",
                table: "organizaciones",
                newName: "plan");

            migrationBuilder.RenameColumn(
                name: "Nombre",
                table: "organizaciones",
                newName: "nombre");

            migrationBuilder.RenameColumn(
                name: "Config",
                table: "organizaciones",
                newName: "config");

            migrationBuilder.RenameColumn(
                name: "Activo",
                table: "organizaciones",
                newName: "activo");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "organizaciones",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "organizaciones",
                newName: "updated_at");

            migrationBuilder.RenameColumn(
                name: "StorageGbLimit",
                table: "organizaciones",
                newName: "storage_gb_limit");

            migrationBuilder.RenameColumn(
                name: "MaxUsuarios",
                table: "organizaciones",
                newName: "max_usuarios");

            migrationBuilder.RenameColumn(
                name: "MaxExpedientes",
                table: "organizaciones",
                newName: "max_expedientes");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "organizaciones",
                newName: "created_at");

            migrationBuilder.RenameIndex(
                name: "IX_organizaciones_Slug",
                table: "organizaciones",
                newName: "ix_organizaciones_slug");

            migrationBuilder.RenameColumn(
                name: "Rol",
                table: "miembros_organizacion",
                newName: "rol");

            migrationBuilder.RenameColumn(
                name: "Activo",
                table: "miembros_organizacion",
                newName: "activo");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "miembros_organizacion",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "UsuarioId",
                table: "miembros_organizacion",
                newName: "usuario_id");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "miembros_organizacion",
                newName: "updated_at");

            migrationBuilder.RenameColumn(
                name: "UnidoEn",
                table: "miembros_organizacion",
                newName: "unido_en");

            migrationBuilder.RenameColumn(
                name: "OrganizacionId",
                table: "miembros_organizacion",
                newName: "organizacion_id");

            migrationBuilder.RenameColumn(
                name: "InvitadoPorId",
                table: "miembros_organizacion",
                newName: "invitado_por_id");

            migrationBuilder.RenameColumn(
                name: "InvitadoEn",
                table: "miembros_organizacion",
                newName: "invitado_en");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "miembros_organizacion",
                newName: "created_at");

            migrationBuilder.RenameIndex(
                name: "IX_miembros_organizacion_UsuarioId",
                table: "miembros_organizacion",
                newName: "ix_miembros_organizacion_usuario_id");

            migrationBuilder.RenameIndex(
                name: "IX_miembros_organizacion_OrganizacionId_UsuarioId",
                table: "miembros_organizacion",
                newName: "ix_miembros_organizacion_organizacion_id_usuario_id");

            migrationBuilder.RenameColumn(
                name: "Rol",
                table: "mensajes_chat",
                newName: "rol");

            migrationBuilder.RenameColumn(
                name: "Contenido",
                table: "mensajes_chat",
                newName: "contenido");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "mensajes_chat",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "UsuarioId",
                table: "mensajes_chat",
                newName: "usuario_id");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "mensajes_chat",
                newName: "updated_at");

            migrationBuilder.RenameColumn(
                name: "SesionId",
                table: "mensajes_chat",
                newName: "sesion_id");

            migrationBuilder.RenameColumn(
                name: "OrganizationId",
                table: "mensajes_chat",
                newName: "organization_id");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "mensajes_chat",
                newName: "created_at");

            migrationBuilder.RenameColumn(
                name: "Token",
                table: "invitaciones_organizacion",
                newName: "token");

            migrationBuilder.RenameColumn(
                name: "Rol",
                table: "invitaciones_organizacion",
                newName: "rol");

            migrationBuilder.RenameColumn(
                name: "Email",
                table: "invitaciones_organizacion",
                newName: "email");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "invitaciones_organizacion",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "invitaciones_organizacion",
                newName: "updated_at");

            migrationBuilder.RenameColumn(
                name: "OrganizacionId",
                table: "invitaciones_organizacion",
                newName: "organizacion_id");

            migrationBuilder.RenameColumn(
                name: "FechaExpiracion",
                table: "invitaciones_organizacion",
                newName: "fecha_expiracion");

            migrationBuilder.RenameColumn(
                name: "EsAceptada",
                table: "invitaciones_organizacion",
                newName: "es_aceptada");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "invitaciones_organizacion",
                newName: "created_at");

            migrationBuilder.RenameIndex(
                name: "IX_invitaciones_organizacion_Token",
                table: "invitaciones_organizacion",
                newName: "ix_invitaciones_organizacion_token");

            migrationBuilder.RenameIndex(
                name: "IX_invitaciones_organizacion_OrganizacionId",
                table: "invitaciones_organizacion",
                newName: "ix_invitaciones_organizacion_organizacion_id");

            migrationBuilder.RenameColumn(
                name: "Titulo",
                table: "expedientes",
                newName: "titulo");

            migrationBuilder.RenameColumn(
                name: "Tipo",
                table: "expedientes",
                newName: "tipo");

            migrationBuilder.RenameColumn(
                name: "Numero",
                table: "expedientes",
                newName: "numero");

            migrationBuilder.RenameColumn(
                name: "Estado",
                table: "expedientes",
                newName: "estado");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "expedientes",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "UsuarioId",
                table: "expedientes",
                newName: "usuario_id");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "expedientes",
                newName: "updated_at");

            migrationBuilder.RenameColumn(
                name: "OrganizationId",
                table: "expedientes",
                newName: "organization_id");

            migrationBuilder.RenameColumn(
                name: "OrganizacionId",
                table: "expedientes",
                newName: "organizacion_id");

            migrationBuilder.RenameColumn(
                name: "EsUrgente",
                table: "expedientes",
                newName: "es_urgente");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "expedientes",
                newName: "created_at");

            migrationBuilder.RenameIndex(
                name: "IX_expedientes_Numero",
                table: "expedientes",
                newName: "ix_expedientes_numero");

            migrationBuilder.RenameIndex(
                name: "IX_expedientes_UsuarioId",
                table: "expedientes",
                newName: "ix_expedientes_usuario_id");

            migrationBuilder.RenameIndex(
                name: "IX_expedientes_OrganizacionId",
                table: "expedientes",
                newName: "ix_expedientes_organizacion_id");

            migrationBuilder.RenameColumn(
                name: "Turno",
                table: "eventos_simulacion",
                newName: "turno");

            migrationBuilder.RenameColumn(
                name: "Mensaje",
                table: "eventos_simulacion",
                newName: "mensaje");

            migrationBuilder.RenameColumn(
                name: "Emisor",
                table: "eventos_simulacion",
                newName: "emisor");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "eventos_simulacion",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "eventos_simulacion",
                newName: "updated_at");

            migrationBuilder.RenameColumn(
                name: "SimulacionId",
                table: "eventos_simulacion",
                newName: "simulacion_id");

            migrationBuilder.RenameColumn(
                name: "LeyesInvocadas",
                table: "eventos_simulacion",
                newName: "leyes_invocadas");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "eventos_simulacion",
                newName: "created_at");

            migrationBuilder.RenameIndex(
                name: "IX_eventos_simulacion_SimulacionId",
                table: "eventos_simulacion",
                newName: "ix_eventos_simulacion_simulacion_id");

            migrationBuilder.RenameColumn(
                name: "Articulo",
                table: "base_legal_vectorial",
                newName: "articulo");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "base_legal_vectorial",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "base_legal_vectorial",
                newName: "updated_at");

            migrationBuilder.RenameColumn(
                name: "TextoLiteral",
                table: "base_legal_vectorial",
                newName: "texto_literal");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "base_legal_vectorial",
                newName: "created_at");

            migrationBuilder.RenameColumn(
                name: "CodigoNormativa",
                table: "base_legal_vectorial",
                newName: "codigo_normativa");

            migrationBuilder.AddPrimaryKey(
                name: "pk_usuarios",
                table: "usuarios",
                column: "id");

            migrationBuilder.AddPrimaryKey(
                name: "pk_simulaciones",
                table: "simulaciones",
                column: "id");

            migrationBuilder.AddPrimaryKey(
                name: "pk_refresh_tokens",
                table: "refresh_tokens",
                column: "id");

            migrationBuilder.AddPrimaryKey(
                name: "pk_organizaciones",
                table: "organizaciones",
                column: "id");

            migrationBuilder.AddPrimaryKey(
                name: "pk_miembros_organizacion",
                table: "miembros_organizacion",
                column: "id");

            migrationBuilder.AddPrimaryKey(
                name: "pk_mensajes_chat",
                table: "mensajes_chat",
                column: "id");

            migrationBuilder.AddPrimaryKey(
                name: "pk_invitaciones_organizacion",
                table: "invitaciones_organizacion",
                column: "id");

            migrationBuilder.AddPrimaryKey(
                name: "pk_expedientes",
                table: "expedientes",
                column: "id");

            migrationBuilder.AddPrimaryKey(
                name: "pk_eventos_simulacion",
                table: "eventos_simulacion",
                column: "id");

            migrationBuilder.AddPrimaryKey(
                name: "pk_base_legal_vectorial",
                table: "base_legal_vectorial",
                column: "id");

            migrationBuilder.AddForeignKey(
                name: "fk_eventos_simulacion_simulaciones_simulacion_id",
                table: "eventos_simulacion",
                column: "simulacion_id",
                principalTable: "simulaciones",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_expedientes_organizaciones_organizacion_id",
                table: "expedientes",
                column: "organizacion_id",
                principalTable: "organizaciones",
                principalColumn: "id");

            migrationBuilder.AddForeignKey(
                name: "fk_expedientes_usuarios_usuario_id",
                table: "expedientes",
                column: "usuario_id",
                principalTable: "usuarios",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_invitaciones_organizacion_organizaciones_organizacion_id",
                table: "invitaciones_organizacion",
                column: "organizacion_id",
                principalTable: "organizaciones",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_mensajes_chat_usuarios_usuario_id",
                table: "mensajes_chat",
                column: "usuario_id",
                principalTable: "usuarios",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_miembros_organizacion_organizaciones_organizacion_id",
                table: "miembros_organizacion",
                column: "organizacion_id",
                principalTable: "organizaciones",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_miembros_organizacion_usuarios_usuario_id",
                table: "miembros_organizacion",
                column: "usuario_id",
                principalTable: "usuarios",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_refresh_tokens_usuarios_usuario_id",
                table: "refresh_tokens",
                column: "usuario_id",
                principalTable: "usuarios",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_simulaciones_usuarios_usuario_id",
                table: "simulaciones",
                column: "usuario_id",
                principalTable: "usuarios",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_usuarios_organizaciones_organizacion_id",
                table: "usuarios",
                column: "organizacion_id",
                principalTable: "organizaciones",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_eventos_simulacion_simulaciones_simulacion_id",
                table: "eventos_simulacion");

            migrationBuilder.DropForeignKey(
                name: "fk_expedientes_organizaciones_organizacion_id",
                table: "expedientes");

            migrationBuilder.DropForeignKey(
                name: "fk_expedientes_usuarios_usuario_id",
                table: "expedientes");

            migrationBuilder.DropForeignKey(
                name: "fk_invitaciones_organizacion_organizaciones_organizacion_id",
                table: "invitaciones_organizacion");

            migrationBuilder.DropForeignKey(
                name: "fk_mensajes_chat_usuarios_usuario_id",
                table: "mensajes_chat");

            migrationBuilder.DropForeignKey(
                name: "fk_miembros_organizacion_organizaciones_organizacion_id",
                table: "miembros_organizacion");

            migrationBuilder.DropForeignKey(
                name: "fk_miembros_organizacion_usuarios_usuario_id",
                table: "miembros_organizacion");

            migrationBuilder.DropForeignKey(
                name: "fk_refresh_tokens_usuarios_usuario_id",
                table: "refresh_tokens");

            migrationBuilder.DropForeignKey(
                name: "fk_simulaciones_usuarios_usuario_id",
                table: "simulaciones");

            migrationBuilder.DropForeignKey(
                name: "fk_usuarios_organizaciones_organizacion_id",
                table: "usuarios");

            migrationBuilder.DropPrimaryKey(
                name: "pk_usuarios",
                table: "usuarios");

            migrationBuilder.DropPrimaryKey(
                name: "pk_simulaciones",
                table: "simulaciones");

            migrationBuilder.DropPrimaryKey(
                name: "pk_refresh_tokens",
                table: "refresh_tokens");

            migrationBuilder.DropPrimaryKey(
                name: "pk_organizaciones",
                table: "organizaciones");

            migrationBuilder.DropPrimaryKey(
                name: "pk_miembros_organizacion",
                table: "miembros_organizacion");

            migrationBuilder.DropPrimaryKey(
                name: "pk_mensajes_chat",
                table: "mensajes_chat");

            migrationBuilder.DropPrimaryKey(
                name: "pk_invitaciones_organizacion",
                table: "invitaciones_organizacion");

            migrationBuilder.DropPrimaryKey(
                name: "pk_expedientes",
                table: "expedientes");

            migrationBuilder.DropPrimaryKey(
                name: "pk_eventos_simulacion",
                table: "eventos_simulacion");

            migrationBuilder.DropPrimaryKey(
                name: "pk_base_legal_vectorial",
                table: "base_legal_vectorial");

            migrationBuilder.RenameColumn(
                name: "rol",
                table: "usuarios",
                newName: "Rol");

            migrationBuilder.RenameColumn(
                name: "especialidad",
                table: "usuarios",
                newName: "Especialidad");

            migrationBuilder.RenameColumn(
                name: "email",
                table: "usuarios",
                newName: "Email");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "usuarios",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "updated_at",
                table: "usuarios",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "password_hash",
                table: "usuarios",
                newName: "PasswordHash");

            migrationBuilder.RenameColumn(
                name: "organization_id",
                table: "usuarios",
                newName: "OrganizationId");

            migrationBuilder.RenameColumn(
                name: "organizacion_id",
                table: "usuarios",
                newName: "OrganizacionId");

            migrationBuilder.RenameColumn(
                name: "nombre_completo",
                table: "usuarios",
                newName: "NombreCompleto");

            migrationBuilder.RenameColumn(
                name: "esta_activo",
                table: "usuarios",
                newName: "EstaActivo");

            migrationBuilder.RenameColumn(
                name: "es_admin_organizacion",
                table: "usuarios",
                newName: "EsAdminOrganizacion");

            migrationBuilder.RenameColumn(
                name: "created_at",
                table: "usuarios",
                newName: "CreatedAt");

            migrationBuilder.RenameIndex(
                name: "ix_usuarios_email",
                table: "usuarios",
                newName: "IX_usuarios_Email");

            migrationBuilder.RenameIndex(
                name: "ix_usuarios_organizacion_id",
                table: "usuarios",
                newName: "IX_usuarios_OrganizacionId");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "simulaciones",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "usuario_id",
                table: "simulaciones",
                newName: "UsuarioId");

            migrationBuilder.RenameColumn(
                name: "updated_at",
                table: "simulaciones",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "rol_usuario",
                table: "simulaciones",
                newName: "RolUsuario");

            migrationBuilder.RenameColumn(
                name: "rama_derecho",
                table: "simulaciones",
                newName: "RamaDerecho");

            migrationBuilder.RenameColumn(
                name: "puntaje_actual",
                table: "simulaciones",
                newName: "PuntajeActual");

            migrationBuilder.RenameColumn(
                name: "organization_id",
                table: "simulaciones",
                newName: "OrganizationId");

            migrationBuilder.RenameColumn(
                name: "esta_finalizada",
                table: "simulaciones",
                newName: "EstaFinalizada");

            migrationBuilder.RenameColumn(
                name: "dificultad_modificador",
                table: "simulaciones",
                newName: "DificultadModificador");

            migrationBuilder.RenameColumn(
                name: "created_at",
                table: "simulaciones",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "contexto_sintetico",
                table: "simulaciones",
                newName: "ContextoSintetico");

            migrationBuilder.RenameIndex(
                name: "ix_simulaciones_usuario_id",
                table: "simulaciones",
                newName: "IX_simulaciones_UsuarioId");

            migrationBuilder.RenameColumn(
                name: "token",
                table: "refresh_tokens",
                newName: "Token");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "refresh_tokens",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "usuario_id",
                table: "refresh_tokens",
                newName: "UsuarioId");

            migrationBuilder.RenameColumn(
                name: "updated_at",
                table: "refresh_tokens",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "revoked_at",
                table: "refresh_tokens",
                newName: "RevokedAt");

            migrationBuilder.RenameColumn(
                name: "replaced_by_token",
                table: "refresh_tokens",
                newName: "ReplacedByToken");

            migrationBuilder.RenameColumn(
                name: "is_revoked",
                table: "refresh_tokens",
                newName: "IsRevoked");

            migrationBuilder.RenameColumn(
                name: "expires_at",
                table: "refresh_tokens",
                newName: "ExpiresAt");

            migrationBuilder.RenameColumn(
                name: "created_at",
                table: "refresh_tokens",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "slug",
                table: "organizaciones",
                newName: "Slug");

            migrationBuilder.RenameColumn(
                name: "plan",
                table: "organizaciones",
                newName: "Plan");

            migrationBuilder.RenameColumn(
                name: "nombre",
                table: "organizaciones",
                newName: "Nombre");

            migrationBuilder.RenameColumn(
                name: "config",
                table: "organizaciones",
                newName: "Config");

            migrationBuilder.RenameColumn(
                name: "activo",
                table: "organizaciones",
                newName: "Activo");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "organizaciones",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "updated_at",
                table: "organizaciones",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "storage_gb_limit",
                table: "organizaciones",
                newName: "StorageGbLimit");

            migrationBuilder.RenameColumn(
                name: "max_usuarios",
                table: "organizaciones",
                newName: "MaxUsuarios");

            migrationBuilder.RenameColumn(
                name: "max_expedientes",
                table: "organizaciones",
                newName: "MaxExpedientes");

            migrationBuilder.RenameColumn(
                name: "created_at",
                table: "organizaciones",
                newName: "CreatedAt");

            migrationBuilder.RenameIndex(
                name: "ix_organizaciones_slug",
                table: "organizaciones",
                newName: "IX_organizaciones_Slug");

            migrationBuilder.RenameColumn(
                name: "rol",
                table: "miembros_organizacion",
                newName: "Rol");

            migrationBuilder.RenameColumn(
                name: "activo",
                table: "miembros_organizacion",
                newName: "Activo");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "miembros_organizacion",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "usuario_id",
                table: "miembros_organizacion",
                newName: "UsuarioId");

            migrationBuilder.RenameColumn(
                name: "updated_at",
                table: "miembros_organizacion",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "unido_en",
                table: "miembros_organizacion",
                newName: "UnidoEn");

            migrationBuilder.RenameColumn(
                name: "organizacion_id",
                table: "miembros_organizacion",
                newName: "OrganizacionId");

            migrationBuilder.RenameColumn(
                name: "invitado_por_id",
                table: "miembros_organizacion",
                newName: "InvitadoPorId");

            migrationBuilder.RenameColumn(
                name: "invitado_en",
                table: "miembros_organizacion",
                newName: "InvitadoEn");

            migrationBuilder.RenameColumn(
                name: "created_at",
                table: "miembros_organizacion",
                newName: "CreatedAt");

            migrationBuilder.RenameIndex(
                name: "ix_miembros_organizacion_usuario_id",
                table: "miembros_organizacion",
                newName: "IX_miembros_organizacion_UsuarioId");

            migrationBuilder.RenameIndex(
                name: "ix_miembros_organizacion_organizacion_id_usuario_id",
                table: "miembros_organizacion",
                newName: "IX_miembros_organizacion_OrganizacionId_UsuarioId");

            migrationBuilder.RenameColumn(
                name: "rol",
                table: "mensajes_chat",
                newName: "Rol");

            migrationBuilder.RenameColumn(
                name: "contenido",
                table: "mensajes_chat",
                newName: "Contenido");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "mensajes_chat",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "usuario_id",
                table: "mensajes_chat",
                newName: "UsuarioId");

            migrationBuilder.RenameColumn(
                name: "updated_at",
                table: "mensajes_chat",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "sesion_id",
                table: "mensajes_chat",
                newName: "SesionId");

            migrationBuilder.RenameColumn(
                name: "organization_id",
                table: "mensajes_chat",
                newName: "OrganizationId");

            migrationBuilder.RenameColumn(
                name: "created_at",
                table: "mensajes_chat",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "token",
                table: "invitaciones_organizacion",
                newName: "Token");

            migrationBuilder.RenameColumn(
                name: "rol",
                table: "invitaciones_organizacion",
                newName: "Rol");

            migrationBuilder.RenameColumn(
                name: "email",
                table: "invitaciones_organizacion",
                newName: "Email");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "invitaciones_organizacion",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "updated_at",
                table: "invitaciones_organizacion",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "organizacion_id",
                table: "invitaciones_organizacion",
                newName: "OrganizacionId");

            migrationBuilder.RenameColumn(
                name: "fecha_expiracion",
                table: "invitaciones_organizacion",
                newName: "FechaExpiracion");

            migrationBuilder.RenameColumn(
                name: "es_aceptada",
                table: "invitaciones_organizacion",
                newName: "EsAceptada");

            migrationBuilder.RenameColumn(
                name: "created_at",
                table: "invitaciones_organizacion",
                newName: "CreatedAt");

            migrationBuilder.RenameIndex(
                name: "ix_invitaciones_organizacion_token",
                table: "invitaciones_organizacion",
                newName: "IX_invitaciones_organizacion_Token");

            migrationBuilder.RenameIndex(
                name: "ix_invitaciones_organizacion_organizacion_id",
                table: "invitaciones_organizacion",
                newName: "IX_invitaciones_organizacion_OrganizacionId");

            migrationBuilder.RenameColumn(
                name: "titulo",
                table: "expedientes",
                newName: "Titulo");

            migrationBuilder.RenameColumn(
                name: "tipo",
                table: "expedientes",
                newName: "Tipo");

            migrationBuilder.RenameColumn(
                name: "numero",
                table: "expedientes",
                newName: "Numero");

            migrationBuilder.RenameColumn(
                name: "estado",
                table: "expedientes",
                newName: "Estado");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "expedientes",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "usuario_id",
                table: "expedientes",
                newName: "UsuarioId");

            migrationBuilder.RenameColumn(
                name: "updated_at",
                table: "expedientes",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "organization_id",
                table: "expedientes",
                newName: "OrganizationId");

            migrationBuilder.RenameColumn(
                name: "organizacion_id",
                table: "expedientes",
                newName: "OrganizacionId");

            migrationBuilder.RenameColumn(
                name: "es_urgente",
                table: "expedientes",
                newName: "EsUrgente");

            migrationBuilder.RenameColumn(
                name: "created_at",
                table: "expedientes",
                newName: "CreatedAt");

            migrationBuilder.RenameIndex(
                name: "ix_expedientes_numero",
                table: "expedientes",
                newName: "IX_expedientes_Numero");

            migrationBuilder.RenameIndex(
                name: "ix_expedientes_usuario_id",
                table: "expedientes",
                newName: "IX_expedientes_UsuarioId");

            migrationBuilder.RenameIndex(
                name: "ix_expedientes_organizacion_id",
                table: "expedientes",
                newName: "IX_expedientes_OrganizacionId");

            migrationBuilder.RenameColumn(
                name: "turno",
                table: "eventos_simulacion",
                newName: "Turno");

            migrationBuilder.RenameColumn(
                name: "mensaje",
                table: "eventos_simulacion",
                newName: "Mensaje");

            migrationBuilder.RenameColumn(
                name: "emisor",
                table: "eventos_simulacion",
                newName: "Emisor");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "eventos_simulacion",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "updated_at",
                table: "eventos_simulacion",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "simulacion_id",
                table: "eventos_simulacion",
                newName: "SimulacionId");

            migrationBuilder.RenameColumn(
                name: "leyes_invocadas",
                table: "eventos_simulacion",
                newName: "LeyesInvocadas");

            migrationBuilder.RenameColumn(
                name: "created_at",
                table: "eventos_simulacion",
                newName: "CreatedAt");

            migrationBuilder.RenameIndex(
                name: "ix_eventos_simulacion_simulacion_id",
                table: "eventos_simulacion",
                newName: "IX_eventos_simulacion_SimulacionId");

            migrationBuilder.RenameColumn(
                name: "articulo",
                table: "base_legal_vectorial",
                newName: "Articulo");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "base_legal_vectorial",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "updated_at",
                table: "base_legal_vectorial",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "texto_literal",
                table: "base_legal_vectorial",
                newName: "TextoLiteral");

            migrationBuilder.RenameColumn(
                name: "created_at",
                table: "base_legal_vectorial",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "codigo_normativa",
                table: "base_legal_vectorial",
                newName: "CodigoNormativa");

            migrationBuilder.AddPrimaryKey(
                name: "PK_usuarios",
                table: "usuarios",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_simulaciones",
                table: "simulaciones",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_refresh_tokens",
                table: "refresh_tokens",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_organizaciones",
                table: "organizaciones",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_miembros_organizacion",
                table: "miembros_organizacion",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_mensajes_chat",
                table: "mensajes_chat",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_invitaciones_organizacion",
                table: "invitaciones_organizacion",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_expedientes",
                table: "expedientes",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_eventos_simulacion",
                table: "eventos_simulacion",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_base_legal_vectorial",
                table: "base_legal_vectorial",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_eventos_simulacion_simulaciones_SimulacionId",
                table: "eventos_simulacion",
                column: "SimulacionId",
                principalTable: "simulaciones",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_expedientes_organizaciones_OrganizacionId",
                table: "expedientes",
                column: "OrganizacionId",
                principalTable: "organizaciones",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_expedientes_usuarios_UsuarioId",
                table: "expedientes",
                column: "UsuarioId",
                principalTable: "usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_invitaciones_organizacion_organizaciones_OrganizacionId",
                table: "invitaciones_organizacion",
                column: "OrganizacionId",
                principalTable: "organizaciones",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_mensajes_chat_usuarios_UsuarioId",
                table: "mensajes_chat",
                column: "UsuarioId",
                principalTable: "usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_miembros_organizacion_organizaciones_OrganizacionId",
                table: "miembros_organizacion",
                column: "OrganizacionId",
                principalTable: "organizaciones",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_miembros_organizacion_usuarios_UsuarioId",
                table: "miembros_organizacion",
                column: "UsuarioId",
                principalTable: "usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_refresh_tokens_usuarios_UsuarioId",
                table: "refresh_tokens",
                column: "UsuarioId",
                principalTable: "usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_simulaciones_usuarios_UsuarioId",
                table: "simulaciones",
                column: "UsuarioId",
                principalTable: "usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_usuarios_organizaciones_OrganizacionId",
                table: "usuarios",
                column: "OrganizacionId",
                principalTable: "organizaciones",
                principalColumn: "Id");
        }
    }
}
