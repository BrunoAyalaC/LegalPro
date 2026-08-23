using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LegalPro.Infrastructure.Migrations
{
    /// <inheritdoc />
    /// FIX P2 perf 2026-08-21: Búsqueda case-insensitive performante para GetExpedientesQuery.
    /// - CREATE EXTENSION IF NOT EXISTS pg_trgm (trigram matching para ILIKE)
    /// - GIN trigram indexes en expedientes(titulo) y expedientes(numero) con gin_trgm_ops
    ///   → Soporta EF.Functions.ILike(e.Titulo, "%term%") con Bitmap Index Scan en vez de Seq Scan + LOWER().
    /// - LEFT join-safe: IF NOT EXISTS para idempotencia en Railway shared DB.
    public partial class AddPgTrgmAndExpedientesSearchIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // pg_trgm es necesario para gin_trgm_ops; requiere privilegio CREATE EXTENSION o ser superuser
            // En Supabase/Railway Postgres está habilitado; IF NOT EXISTS evita fallar si ya existe.
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

            // GIN trigram index en titulo — acelera ILIKE '%term%' (case-insensitive) sin LOWER()
            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS ix_expedientes_titulo_trgm
                ON expedientes USING gin (titulo gin_trgm_ops);
            ");

            // GIN trigram index en numero — mismo patrón
            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS ix_expedientes_numero_trgm
                ON expedientes USING gin (numero gin_trgm_ops);
            ");

            // Opcional composite para queries OR con ambas columnas (bitmap OR combina ambos índices;
            // índice combinado puede usarse en algunos planes). Idempotente.
            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS ix_expedientes_titulo_numero_trgm
                ON expedientes USING gin ((titulo || ' ' || numero) gin_trgm_ops);
            ");

            // FIX P2 perf: índices para HasQueryFilter por OrganizationId (evitar Seq Scan en queries multi-tenant)
            // Estas tablas implementan ITenantEntity y tienen HasQueryFilter(_tenantProvider.TenantId).
            // Sin índice en organization_id, Postgres hace Seq Scan filtrando tenant.
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_expedientes_organization_id ON expedientes (organization_id);");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_expedientes_usuario_id ON expedientes (usuario_id);");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_documentos_org ON documentos (organization_id);");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_documentos_expediente_org ON documentos (expediente_id, organization_id);");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_simulaciones_organization_id ON simulaciones (organization_id);");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_usuarios_organization_id ON usuarios (organization_id);");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_mensajes_chat_organization_id ON mensajes_chat (organization_id);");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_predicciones_organization_id ON predicciones_judiciales (organization_id);");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_invitaciones_organizacion_org_id ON invitaciones_organizacion (organizacion_id);");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_miembros_organizacion_org ON miembros_organizacion (organizacion_id);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_miembros_organizacion_org;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_invitaciones_organizacion_org_id;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_predicciones_organization_id;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_mensajes_chat_organization_id;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_usuarios_organization_id;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_simulaciones_organization_id;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_documentos_expediente_org;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_documentos_org;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_expedientes_usuario_id;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_expedientes_organization_id;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_expedientes_titulo_numero_trgm;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_expedientes_numero_trgm;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_expedientes_titulo_trgm;");
            // No se elimina la extensión pg_trgm en Down para no romper otras features que la usen
            // migrationBuilder.Sql("DROP EXTENSION IF EXISTS pg_trgm;");
        }
    }
}
