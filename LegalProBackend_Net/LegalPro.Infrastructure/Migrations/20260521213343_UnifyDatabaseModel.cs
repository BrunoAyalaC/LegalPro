using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LegalPro.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UnifyDatabaseModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_expedientes_organizaciones_organizacion_id",
                table: "expedientes");

            migrationBuilder.DropForeignKey(
                name: "fk_usuarios_organizaciones_organizacion_id",
                table: "usuarios");

            migrationBuilder.DropIndex(
                name: "ix_usuarios_organizacion_id",
                table: "usuarios");

            migrationBuilder.DropIndex(
                name: "ix_expedientes_organizacion_id",
                table: "expedientes");

            migrationBuilder.DropPrimaryKey(
                name: "pk_audit_logs",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "organizacion_id",
                table: "usuarios");

            migrationBuilder.DropColumn(
                name: "organizacion_id",
                table: "expedientes");

            migrationBuilder.RenameTable(
                name: "audit_logs",
                newName: "audit_log");

            migrationBuilder.RenameIndex(
                name: "ix_audit_logs_user_id",
                table: "audit_log",
                newName: "ix_audit_log_user_id");

            migrationBuilder.RenameIndex(
                name: "ix_audit_logs_timestamp",
                table: "audit_log",
                newName: "ix_audit_log_timestamp");

            migrationBuilder.RenameIndex(
                name: "ix_audit_logs_severity",
                table: "audit_log",
                newName: "ix_audit_log_severity");

            migrationBuilder.RenameIndex(
                name: "ix_audit_logs_event_type",
                table: "audit_log",
                newName: "ix_audit_log_event_type");

            migrationBuilder.AlterColumn<Guid>(
                name: "id",
                table: "usuarios",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer")
                .OldAnnotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AlterColumn<Guid>(
                name: "usuario_id",
                table: "simulaciones",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<Guid>(
                name: "id",
                table: "simulaciones",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer")
                .OldAnnotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AlterColumn<Guid>(
                name: "usuario_id",
                table: "refresh_tokens",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<Guid>(
                name: "id",
                table: "refresh_tokens",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer")
                .OldAnnotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AlterColumn<Guid>(
                name: "usuario_id",
                table: "miembros_organizacion",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<Guid>(
                name: "invitado_por_id",
                table: "miembros_organizacion",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "usuario_id",
                table: "mensajes_chat",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<Guid>(
                name: "id",
                table: "mensajes_chat",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer")
                .OldAnnotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AlterColumn<Guid>(
                name: "usuario_id",
                table: "expedientes",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<Guid>(
                name: "id",
                table: "expedientes",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer")
                .OldAnnotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AlterColumn<Guid>(
                name: "simulacion_id",
                table: "eventos_simulacion",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<Guid>(
                name: "id",
                table: "eventos_simulacion",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer")
                .OldAnnotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AlterColumn<Guid>(
                name: "id",
                table: "base_legal_vectorial",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer")
                .OldAnnotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AddPrimaryKey(
                name: "pk_audit_log",
                table: "audit_log",
                column: "id");

            migrationBuilder.CreateTable(
                name: "documentos",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    titulo = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    contenido = table.Column<string>(type: "text", nullable: true),
                    url = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    tipo = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    expediente_id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_documentos", x => x.id);
                    table.ForeignKey(
                        name: "fk_documentos_expedientes_expediente_id",
                        column: x => x.expediente_id,
                        principalTable: "expedientes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_documentos_organizaciones_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizaciones",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "predicciones_judiciales",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    probabilidad_exito = table.Column<decimal>(type: "numeric", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_predicciones_judiciales", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_usuarios_organization_id",
                table: "usuarios",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_expedientes_organization_id",
                table: "expedientes",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_documentos_expediente_org",
                table: "documentos",
                columns: new[] { "expediente_id", "organization_id" });

            migrationBuilder.CreateIndex(
                name: "ix_documentos_org",
                table: "documentos",
                column: "organization_id");

            migrationBuilder.AddForeignKey(
                name: "fk_expedientes_organizaciones_organization_id",
                table: "expedientes",
                column: "organization_id",
                principalTable: "organizaciones",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_usuarios_organizaciones_organization_id",
                table: "usuarios",
                column: "organization_id",
                principalTable: "organizaciones",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_expedientes_organizaciones_organization_id",
                table: "expedientes");

            migrationBuilder.DropForeignKey(
                name: "fk_usuarios_organizaciones_organization_id",
                table: "usuarios");

            migrationBuilder.DropTable(
                name: "documentos");

            migrationBuilder.DropTable(
                name: "predicciones_judiciales");

            migrationBuilder.DropIndex(
                name: "ix_usuarios_organization_id",
                table: "usuarios");

            migrationBuilder.DropIndex(
                name: "ix_expedientes_organization_id",
                table: "expedientes");

            migrationBuilder.DropPrimaryKey(
                name: "pk_audit_log",
                table: "audit_log");

            migrationBuilder.RenameTable(
                name: "audit_log",
                newName: "audit_logs");

            migrationBuilder.RenameIndex(
                name: "ix_audit_log_user_id",
                table: "audit_logs",
                newName: "ix_audit_logs_user_id");

            migrationBuilder.RenameIndex(
                name: "ix_audit_log_timestamp",
                table: "audit_logs",
                newName: "ix_audit_logs_timestamp");

            migrationBuilder.RenameIndex(
                name: "ix_audit_log_severity",
                table: "audit_logs",
                newName: "ix_audit_logs_severity");

            migrationBuilder.RenameIndex(
                name: "ix_audit_log_event_type",
                table: "audit_logs",
                newName: "ix_audit_logs_event_type");

            migrationBuilder.AlterColumn<int>(
                name: "id",
                table: "usuarios",
                type: "integer",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid")
                .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AddColumn<Guid>(
                name: "organizacion_id",
                table: "usuarios",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "usuario_id",
                table: "simulaciones",
                type: "integer",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AlterColumn<int>(
                name: "id",
                table: "simulaciones",
                type: "integer",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid")
                .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AlterColumn<int>(
                name: "usuario_id",
                table: "refresh_tokens",
                type: "integer",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AlterColumn<int>(
                name: "id",
                table: "refresh_tokens",
                type: "integer",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid")
                .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AlterColumn<int>(
                name: "usuario_id",
                table: "miembros_organizacion",
                type: "integer",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AlterColumn<int>(
                name: "invitado_por_id",
                table: "miembros_organizacion",
                type: "integer",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "usuario_id",
                table: "mensajes_chat",
                type: "integer",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AlterColumn<int>(
                name: "id",
                table: "mensajes_chat",
                type: "integer",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid")
                .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AlterColumn<int>(
                name: "usuario_id",
                table: "expedientes",
                type: "integer",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AlterColumn<int>(
                name: "id",
                table: "expedientes",
                type: "integer",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid")
                .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AddColumn<Guid>(
                name: "organizacion_id",
                table: "expedientes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "simulacion_id",
                table: "eventos_simulacion",
                type: "integer",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AlterColumn<int>(
                name: "id",
                table: "eventos_simulacion",
                type: "integer",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid")
                .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AlterColumn<int>(
                name: "id",
                table: "base_legal_vectorial",
                type: "integer",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid")
                .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AddPrimaryKey(
                name: "pk_audit_logs",
                table: "audit_logs",
                column: "id");

            migrationBuilder.CreateIndex(
                name: "ix_usuarios_organizacion_id",
                table: "usuarios",
                column: "organizacion_id");

            migrationBuilder.CreateIndex(
                name: "ix_expedientes_organizacion_id",
                table: "expedientes",
                column: "organizacion_id");

            migrationBuilder.AddForeignKey(
                name: "fk_expedientes_organizaciones_organizacion_id",
                table: "expedientes",
                column: "organizacion_id",
                principalTable: "organizaciones",
                principalColumn: "id");

            migrationBuilder.AddForeignKey(
                name: "fk_usuarios_organizaciones_organizacion_id",
                table: "usuarios",
                column: "organizacion_id",
                principalTable: "organizaciones",
                principalColumn: "id");
        }
    }
}
