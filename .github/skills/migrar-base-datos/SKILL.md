# Skill: Migrar Base de Datos (Supabase PostgreSQL)

## Cuándo usar

Cuando necesites crear tablas, modificar esquemas o gestionar migraciones en Supabase PostgreSQL.

## Opción 1: SQL en Supabase Dashboard

```sql
-- Crear tabla nueva
CREATE TABLE nueva_tabla (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id UUID REFERENCES auth.users(id) NOT NULL,
    titulo TEXT NOT NULL,
    contenido TEXT,
    estado TEXT DEFAULT 'activo',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SIEMPRE crear RLS policy
ALTER TABLE nueva_tabla ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own nueva_tabla" ON nueva_tabla
    FOR ALL USING (auth.uid() = usuario_id);

-- Índices para búsquedas frecuentes
CREATE INDEX idx_nueva_tabla_usuario ON nueva_tabla(usuario_id);
CREATE INDEX idx_nueva_tabla_estado ON nueva_tabla(estado);
```

## Opción 2: Supabase CLI (Migraciones versionadas)

```bash
# Instalar CLI
npm install -g supabase

# Login y vincular proyecto
supabase login
supabase link --project-ref xxx

# Crear migración
supabase migration new crear_nueva_tabla

# Editar archivo generado en supabase/migrations/

# Aplicar migración
supabase db push
```

## Opción 3: Entity Framework Core (.NET)

```bash
# Agregar migración
cd LegalProBackend_Net
dotnet ef migrations add CrearNuevaTabla --project LegalPro.Infrastructure --startup-project LegalPro.Api

# Aplicar migración (apunta a Supabase PostgreSQL)
dotnet ef database update --project LegalPro.Infrastructure --startup-project LegalPro.Api
```

### DbContext

```csharp
// ApplicationDbContext.cs - apunta a Supabase PostgreSQL
protected override void OnConfiguring(DbContextOptionsBuilder options)
    => options.UseNpgsql(connectionString);
```

## Tablas del Sistema

| Tabla                | Descripción            | RLS             |
| -------------------- | ---------------------- | --------------- |
| usuarios             | Perfiles               | auth.uid()      |
| expedientes          | Expedientes judiciales | usuario_id      |
| documentos           | Archivos adjuntos      | via expediente  |
| notificaciones       | SINOE + sistema        | usuario_id      |
| simulaciones         | Simulaciones de juicio | usuario_id      |
| jurisprudencia       | Base de jurisprudencia | Lectura pública |
| base_legal_vectorial | Normas legales         | Lectura pública |
| historial_chat       | Chat IA                | usuario_id      |

## Checklist

- [ ] Tabla creada con UUID como primary key
- [ ] RLS habilitado (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] Policy de RLS creada con `auth.uid()`
- [ ] Índices en campos de búsqueda
- [ ] `created_at` y `updated_at` con defaults
- [ ] Foreign keys donde aplique
- [ ] Migración documentada
