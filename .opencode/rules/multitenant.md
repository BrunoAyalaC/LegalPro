---
description: Reglas de multi-tenancy
globs:
  - "**/*.cs"
  - "**/server/**/*.js"
  - "**/*.sql"
---

# Reglas de Multi-Tenancy

Aplicar estas reglas en todo código que toca datos por organización.

## Principios

- TODA tabla multi-tenant DEBE tener `organization_id`
- TODA query DEBE filtrar por `organization_id`
- NUNCA `IgnoreQueryFilters()` en producción
- NUNCA leer datos sin `organization_id` en JWT

## Backend .NET

```csharp
// Query con ITenantRequest
public class GetExpedientesQuery : IRequest<List<ExpedienteDto>>, ITenantRequest
{
  // ...
}

// Handler
public async Task<List<ExpedienteDto>> Handle(GetExpedientesQuery request, CancellationToken ct)
{
  // TenantValidationBehavior se ejecuta automáticamente
  return await _context.Expedientes
    .Where(e => e.OrganizationId == _currentUser.OrganizationId)
    .ToListAsync(ct);
}
```

## Backend Node

```javascript
// Middleware de tenant
router.get('/api/expedientes', tenantMiddleware, async (req, res) => {
  const orgId = req.tenantId; // De JWT
  const result = await db.query(
    'SELECT * FROM expedientes WHERE organization_id = $1',
    [orgId]
  );
  res.json({ success: true, data: result.rows });
});
```

## SQL

```sql
ALTER TABLE expedientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON expedientes
  USING (organization_id = current_setting('app.organization_id')::UUID);
```

## Tests cross-tenant

- Crear 2 organizaciones A y B
- Token de A intenta leer datos de B → debe fallar
- Token de A intenta escribir en B → debe fallar
- Test debe estar en suite de integración

## Audit

- TODA violación multi-tenant DEBE emitir `TENANT_VIOLATION`
- Severidad: ERROR
- Alerta: Slack #security + email CTO
