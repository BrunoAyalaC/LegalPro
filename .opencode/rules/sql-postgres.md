---
description: Reglas para SQL PostgreSQL/Supabase
globs:
  - "**/*.sql"
  - "legalpro-app/server/init.sql"
  - "LegalProBackend_Net/LegalPro.Infrastructure/Migrations/**/*.cs"
---

# Reglas SQL PostgreSQL / Supabase

Aplicar estas reglas al editar migraciones SQL o definiciones de schema.

## Multi-tenant

- TODA tabla multi-tenant DEBE tener `organization_id UUID NOT NULL REFERENCES organizaciones(id)`
- TODA tabla DEBE tener `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- TODA tabla DEBE tener `updated_at TIMESTAMPTZ`
- TODA tabla DEBE tener `deleted_at TIMESTAMPTZ` (soft-delete)

## Row Level Security (RLS)

- TODA tabla multi-tenant DEBE tener `ENABLE ROW LEVEL SECURITY`
- Policy de aislamiento: `USING (organization_id = current_setting('app.organization_id')::UUID)`
- Policy para SELECT, INSERT, UPDATE, DELETE por separado

## Índices

- Crear índice en toda Foreign Key
- Índices parciales: `CREATE INDEX ... WHERE deleted_at IS NULL`
- Índices GIN para búsqueda full-text (`tsvector`)
- BRIN para datos append-only

## Constraints

- `NOT NULL` cuando aplique
- `CHECK` constraints para enums
- `UNIQUE` constraints con prefijos por tenant cuando sea apropiado

## NUNCA

- NUNCA `ALTER TABLE` ad-hoc en código de aplicación (usar migración versionada)
- NUNCA cambiar el tipo de una columna sin plan de migración
- NUNCA eliminar una tabla en producción sin backup

## SIEMPRE

- SIEMPRE `EXPLAIN ANALYZE` antes de mergear queries pesados
- SIEMPRE `VACUUM ANALYZE` después de inserciones masivas
- SIEMPRE documentar en `catalogs/supabase-schema.md`
