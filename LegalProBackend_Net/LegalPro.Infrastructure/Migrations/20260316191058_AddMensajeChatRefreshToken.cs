using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LegalPro.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMensajeChatRefreshToken : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "EsAdminOrganizacion",
                table: "usuarios",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizacionId",
                table: "usuarios",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "usuarios",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "simulaciones",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizacionId",
                table: "expedientes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "expedientes",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "mensajes_chat",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UsuarioId = table.Column<int>(type: "integer", nullable: false),
                    OrganizationId = table.Column<Guid>(type: "uuid", nullable: true),
                    Rol = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Contenido = table.Column<string>(type: "text", nullable: false),
                    SesionId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mensajes_chat", x => x.Id);
                    table.ForeignKey(
                        name: "FK_mensajes_chat_usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "organizaciones",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Plan = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MaxUsuarios = table.Column<int>(type: "integer", nullable: false),
                    MaxExpedientes = table.Column<int>(type: "integer", nullable: false),
                    StorageGbLimit = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    Activo = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    Config = table.Column<string>(type: "jsonb", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_organizaciones", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "refresh_tokens",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UsuarioId = table.Column<int>(type: "integer", nullable: false),
                    Token = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsRevoked = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    RevokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReplacedByToken = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refresh_tokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_refresh_tokens_usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "invitaciones_organizacion",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizacionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Token = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Rol = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    FechaExpiracion = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EsAceptada = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_invitaciones_organizacion", x => x.Id);
                    table.ForeignKey(
                        name: "FK_invitaciones_organizacion_organizaciones_OrganizacionId",
                        column: x => x.OrganizacionId,
                        principalTable: "organizaciones",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "miembros_organizacion",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizacionId = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<int>(type: "integer", nullable: false),
                    Rol = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    InvitadoPorId = table.Column<int>(type: "integer", nullable: true),
                    InvitadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UnidoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Activo = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_miembros_organizacion", x => x.Id);
                    table.ForeignKey(
                        name: "FK_miembros_organizacion_organizaciones_OrganizacionId",
                        column: x => x.OrganizacionId,
                        principalTable: "organizaciones",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_miembros_organizacion_usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_usuarios_OrganizacionId",
                table: "usuarios",
                column: "OrganizacionId");

            migrationBuilder.CreateIndex(
                name: "IX_expedientes_OrganizacionId",
                table: "expedientes",
                column: "OrganizacionId");

            migrationBuilder.CreateIndex(
                name: "IX_invitaciones_organizacion_OrganizacionId",
                table: "invitaciones_organizacion",
                column: "OrganizacionId");

            migrationBuilder.CreateIndex(
                name: "IX_invitaciones_organizacion_Token",
                table: "invitaciones_organizacion",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_mensajes_chat_org_sesion",
                table: "mensajes_chat",
                columns: new[] { "OrganizationId", "SesionId" });

            migrationBuilder.CreateIndex(
                name: "ix_mensajes_chat_usuario_sesion",
                table: "mensajes_chat",
                columns: new[] { "UsuarioId", "SesionId" });

            migrationBuilder.CreateIndex(
                name: "IX_miembros_organizacion_OrganizacionId_UsuarioId",
                table: "miembros_organizacion",
                columns: new[] { "OrganizacionId", "UsuarioId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_miembros_organizacion_UsuarioId",
                table: "miembros_organizacion",
                column: "UsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_organizaciones_Slug",
                table: "organizaciones",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_refresh_tokens_token",
                table: "refresh_tokens",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_refresh_tokens_usuario",
                table: "refresh_tokens",
                column: "UsuarioId");

            migrationBuilder.AddForeignKey(
                name: "FK_expedientes_organizaciones_OrganizacionId",
                table: "expedientes",
                column: "OrganizacionId",
                principalTable: "organizaciones",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_usuarios_organizaciones_OrganizacionId",
                table: "usuarios",
                column: "OrganizacionId",
                principalTable: "organizaciones",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_expedientes_organizaciones_OrganizacionId",
                table: "expedientes");

            migrationBuilder.DropForeignKey(
                name: "FK_usuarios_organizaciones_OrganizacionId",
                table: "usuarios");

            migrationBuilder.DropTable(
                name: "invitaciones_organizacion");

            migrationBuilder.DropTable(
                name: "mensajes_chat");

            migrationBuilder.DropTable(
                name: "miembros_organizacion");

            migrationBuilder.DropTable(
                name: "refresh_tokens");

            migrationBuilder.DropTable(
                name: "organizaciones");

            migrationBuilder.DropIndex(
                name: "IX_usuarios_OrganizacionId",
                table: "usuarios");

            migrationBuilder.DropIndex(
                name: "IX_expedientes_OrganizacionId",
                table: "expedientes");

            migrationBuilder.DropColumn(
                name: "EsAdminOrganizacion",
                table: "usuarios");

            migrationBuilder.DropColumn(
                name: "OrganizacionId",
                table: "usuarios");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "usuarios");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "simulaciones");

            migrationBuilder.DropColumn(
                name: "OrganizacionId",
                table: "expedientes");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "expedientes");
        }
    }
}
