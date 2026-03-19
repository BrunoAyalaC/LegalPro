using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LegalPro.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EventosSimulacion_Simulaciones_SimulacionId",
                table: "EventosSimulacion");

            migrationBuilder.DropForeignKey(
                name: "FK_Expedientes_Usuarios_UsuarioId",
                table: "Expedientes");

            migrationBuilder.DropForeignKey(
                name: "FK_Simulaciones_Usuarios_UsuarioId",
                table: "Simulaciones");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Usuarios",
                table: "Usuarios");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Simulaciones",
                table: "Simulaciones");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Expedientes",
                table: "Expedientes");

            migrationBuilder.DropPrimaryKey(
                name: "PK_EventosSimulacion",
                table: "EventosSimulacion");

            migrationBuilder.DropPrimaryKey(
                name: "PK_BaseLegalVectorial",
                table: "BaseLegalVectorial");

            migrationBuilder.DropColumn(
                name: "Nombre",
                table: "Usuarios");

            migrationBuilder.RenameTable(
                name: "Usuarios",
                newName: "usuarios");

            migrationBuilder.RenameTable(
                name: "Simulaciones",
                newName: "simulaciones");

            migrationBuilder.RenameTable(
                name: "Expedientes",
                newName: "expedientes");

            migrationBuilder.RenameTable(
                name: "EventosSimulacion",
                newName: "eventos_simulacion");

            migrationBuilder.RenameTable(
                name: "BaseLegalVectorial",
                newName: "base_legal_vectorial");

            migrationBuilder.RenameIndex(
                name: "IX_Usuarios_Email",
                table: "usuarios",
                newName: "IX_usuarios_Email");

            migrationBuilder.RenameIndex(
                name: "IX_Simulaciones_UsuarioId",
                table: "simulaciones",
                newName: "IX_simulaciones_UsuarioId");

            migrationBuilder.RenameIndex(
                name: "IX_Expedientes_UsuarioId",
                table: "expedientes",
                newName: "IX_expedientes_UsuarioId");

            migrationBuilder.RenameIndex(
                name: "IX_Expedientes_Numero",
                table: "expedientes",
                newName: "IX_expedientes_Numero");

            migrationBuilder.RenameIndex(
                name: "IX_EventosSimulacion_SimulacionId",
                table: "eventos_simulacion",
                newName: "IX_eventos_simulacion_SimulacionId");

            migrationBuilder.AlterColumn<string>(
                name: "Rol",
                table: "usuarios",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "PasswordHash",
                table: "usuarios",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "usuarios",
                type: "character varying(256)",
                maxLength: 256,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "Especialidad",
                table: "usuarios",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "EstaActivo",
                table: "usuarios",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "NombreCompleto",
                table: "usuarios",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<string>(
                name: "RolUsuario",
                table: "simulaciones",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "RamaDerecho",
                table: "simulaciones",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "DificultadModificador",
                table: "simulaciones",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Titulo",
                table: "expedientes",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Tipo",
                table: "expedientes",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Numero",
                table: "expedientes",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Estado",
                table: "expedientes",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "LeyesInvocadas",
                table: "eventos_simulacion",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Emisor",
                table: "eventos_simulacion",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "CodigoNormativa",
                table: "base_legal_vectorial",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Articulo",
                table: "base_legal_vectorial",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddPrimaryKey(
                name: "PK_usuarios",
                table: "usuarios",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_simulaciones",
                table: "simulaciones",
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
                name: "FK_expedientes_usuarios_UsuarioId",
                table: "expedientes",
                column: "UsuarioId",
                principalTable: "usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_simulaciones_usuarios_UsuarioId",
                table: "simulaciones",
                column: "UsuarioId",
                principalTable: "usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_eventos_simulacion_simulaciones_SimulacionId",
                table: "eventos_simulacion");

            migrationBuilder.DropForeignKey(
                name: "FK_expedientes_usuarios_UsuarioId",
                table: "expedientes");

            migrationBuilder.DropForeignKey(
                name: "FK_simulaciones_usuarios_UsuarioId",
                table: "simulaciones");

            migrationBuilder.DropPrimaryKey(
                name: "PK_usuarios",
                table: "usuarios");

            migrationBuilder.DropPrimaryKey(
                name: "PK_simulaciones",
                table: "simulaciones");

            migrationBuilder.DropPrimaryKey(
                name: "PK_expedientes",
                table: "expedientes");

            migrationBuilder.DropPrimaryKey(
                name: "PK_eventos_simulacion",
                table: "eventos_simulacion");

            migrationBuilder.DropPrimaryKey(
                name: "PK_base_legal_vectorial",
                table: "base_legal_vectorial");

            migrationBuilder.DropColumn(
                name: "Especialidad",
                table: "usuarios");

            migrationBuilder.DropColumn(
                name: "EstaActivo",
                table: "usuarios");

            migrationBuilder.DropColumn(
                name: "NombreCompleto",
                table: "usuarios");

            migrationBuilder.RenameTable(
                name: "usuarios",
                newName: "Usuarios");

            migrationBuilder.RenameTable(
                name: "simulaciones",
                newName: "Simulaciones");

            migrationBuilder.RenameTable(
                name: "expedientes",
                newName: "Expedientes");

            migrationBuilder.RenameTable(
                name: "eventos_simulacion",
                newName: "EventosSimulacion");

            migrationBuilder.RenameTable(
                name: "base_legal_vectorial",
                newName: "BaseLegalVectorial");

            migrationBuilder.RenameIndex(
                name: "IX_usuarios_Email",
                table: "Usuarios",
                newName: "IX_Usuarios_Email");

            migrationBuilder.RenameIndex(
                name: "IX_simulaciones_UsuarioId",
                table: "Simulaciones",
                newName: "IX_Simulaciones_UsuarioId");

            migrationBuilder.RenameIndex(
                name: "IX_expedientes_UsuarioId",
                table: "Expedientes",
                newName: "IX_Expedientes_UsuarioId");

            migrationBuilder.RenameIndex(
                name: "IX_expedientes_Numero",
                table: "Expedientes",
                newName: "IX_Expedientes_Numero");

            migrationBuilder.RenameIndex(
                name: "IX_eventos_simulacion_SimulacionId",
                table: "EventosSimulacion",
                newName: "IX_EventosSimulacion_SimulacionId");

            migrationBuilder.AlterColumn<string>(
                name: "Rol",
                table: "Usuarios",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<string>(
                name: "PasswordHash",
                table: "Usuarios",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(500)",
                oldMaxLength: 500);

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "Usuarios",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(256)",
                oldMaxLength: 256);

            migrationBuilder.AddColumn<string>(
                name: "Nombre",
                table: "Usuarios",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<string>(
                name: "RolUsuario",
                table: "Simulaciones",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<string>(
                name: "RamaDerecho",
                table: "Simulaciones",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<string>(
                name: "DificultadModificador",
                table: "Simulaciones",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "Titulo",
                table: "Expedientes",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(500)",
                oldMaxLength: 500);

            migrationBuilder.AlterColumn<string>(
                name: "Tipo",
                table: "Expedientes",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<string>(
                name: "Numero",
                table: "Expedientes",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.AlterColumn<string>(
                name: "Estado",
                table: "Expedientes",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<string>(
                name: "LeyesInvocadas",
                table: "EventosSimulacion",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Emisor",
                table: "EventosSimulacion",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<string>(
                name: "CodigoNormativa",
                table: "BaseLegalVectorial",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "Articulo",
                table: "BaseLegalVectorial",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AddPrimaryKey(
                name: "PK_Usuarios",
                table: "Usuarios",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Simulaciones",
                table: "Simulaciones",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Expedientes",
                table: "Expedientes",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_EventosSimulacion",
                table: "EventosSimulacion",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_BaseLegalVectorial",
                table: "BaseLegalVectorial",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_EventosSimulacion_Simulaciones_SimulacionId",
                table: "EventosSimulacion",
                column: "SimulacionId",
                principalTable: "Simulaciones",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Expedientes_Usuarios_UsuarioId",
                table: "Expedientes",
                column: "UsuarioId",
                principalTable: "Usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Simulaciones_Usuarios_UsuarioId",
                table: "Simulaciones",
                column: "UsuarioId",
                principalTable: "Usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
