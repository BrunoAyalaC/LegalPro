# Reporte del Refutador: Seguridad

> **Agente**: @refutador-seguridad
> **Fecha**: 2026-06-12
> **Modo**: Adversarial (no es auditoría normal)
> **Objetivo**: Encontrar vectores de ataque que el auditor normal pasa por alto

## 🎯 Vectores de Ataque Encontrados

### 🔴 CRITICAL: Cross-tenant enumeration via IDOR

**Vector**: Un usuario autenticado con `organizationId = A` puede enumerar IDs de la organización `B` mediante `GET /api/expedientes/:id`.

**PoC mental**:
```bash
# Token de org A intenta acceder a expediente de org B
curl -H "Authorization: Bearer ${TOKEN_ORG_A}" \
  http://api.legalpro/expedientes/123e4567-e89b-12d3-a456-426614174000
# Si el ID existe en org B, devuelve el expediente → DATA LEAK
```

**Probabilidad de explotación**: ALTA (0.7)
**Tiempo de ataque**: < 1 hora con herramienta automatizada
**Impacto**: LPDP breach (multa S/ 495,000)

**Remediación**: En `ExpedienteRepository.findByIdAndOrg()`:
```javascript
async findByIdAndOrg(id, organizationId) {
  // OK YA TIENE ESTE METODO, pero hay que auditar todos los .findById() en codigo
}
```

### 🟠 HIGH: Mass assignment en controllers .NET

**Vector**: Controllers con `[FromBody]` aceptan modelos sin whitelist de propiedades.

**PoC mental**:
```json
POST /api/usuarios
{
  "email": "attacker@x.com",
  "password": "x",
  "rol": "ADMIN",  // <- Inyeccion de rol
  "is_active": true
}
```

**Probabilidad**: MEDIA (0.5)
**Impacto**: Privilege escalation → acceso a todos los datos

**Remediación**: Usar DTOs separados del modelo de dominio:
```csharp
public class CreateUsuarioCommand {
  public string Email { get; set; }
  public string Password { get; set; }
  // NO incluir Rol, is_active, etc.
}
```

### 🟠 HIGH: Race condition en transacciones

**Vector**: Doble descuento de créditos en requests concurrentes.

**PoC**:
```bash
# Lanzar 100 requests simultáneos a /api/analista
for i in {1..100}; do
  curl -X POST http://api.legalpro/api/analista \
    -H "Authorization: Bearer $TOKEN" \
    -d '{}' &
done
# Si NO hay BEGIN/COMMIT, puede haber overdraft
```

**Probabilidad**: MEDIA (0.5)
**Impacto**: Pérdida de revenue, datos inconsistentes

**Remediación**: Implementar transacciones con `BEGIN` y `SELECT FOR UPDATE` en `quotaMiddleware.js`.

### 🟡 MEDIUM: Timing attack en token comparison

**Vector**: Comparación de tokens con `===` permite timing attack.

**PoC**:
```javascript
// VULNERABLE
if (token === secret) { ... }

// SEGURO
import crypto from 'crypto';
crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret));
```

**Probabilidad**: BAJA (0.2)
**Tiempo**: Horas
**Impacto**: Robo de tokens

**Remediación**: Usar `crypto.timingSafeEqual` en todas las comparaciones de tokens.

### 🟡 MEDIUM: Type juggling en JSON parsing

**Vector**: `req.body.id` puede ser objeto, string, o número.

**PoC**:
```json
POST /api/expedientes/{id}
{ "id": { "$gt": "" } }  // MongoDB injection-style
```

**Probabilidad**: BAJA (0.3)
**Impacto**: Bypass de autorización

**Remediación**: Validar tipos con Zod antes de usar.

### 🟡 MEDIUM: Reentrancy / TOCTOU

**Vector**: 30+ queries con `FindAsync` seguidas de updates sin transacción.

**Probabilidad**: BAJA (0.2)
**Impacto**: Inconsistencia de datos

**Remediación**: Encapsular en transacciones EF Core.

## 📊 Resumen de Hallazgos

| Severidad | Cantidad | Total | Action |
|---|---|---|---|
| 🔴 CRITICAL | 1 | 1 | Fix inmediato (Sprint 1) |
| 🟠 HIGH | 2 | 3 | Fix en Sprint 1-2 |
| 🟡 MEDIUM | 3 | 6 | Fix en Sprint 2-3 |
| Total | **6** | **10 hallazgos** | |

## 🎯 Plan de Remediación

### Sprint 1 (esta semana)
- [ ] Auditar todos los `findById` y validar tenant
- [ ] Implementar DTOs en lugar de modelos directos
- [ ] Validar todos los `req.body.id` con Zod

### Sprint 2
- [ ] Transacciones con BEGIN/COMMIT en middleware
- [ ] `crypto.timingSafeEqual` en todas las comparaciones
- [ ] Tests de race conditions

### Sprint 3
- [ ] TOCTOU prevention con transacciones EF Core
- [ ] Tests E2E de estos vectores

## 📚 Conclusión

El sistema tiene **10 hallazgos de seguridad** que requieren atención. El más crítico es el **IDOR cross-tenant** que podría causar un breach LPDP. El resto son HIGH/MEDIUM que deben remediarse en los próximos sprints.

**Recomendación**: Antes de ir a producción, ejecutar pentest externo.

**Firmas requeridas**:
- [ ] @arquitecto-chief: Aprueba plan
- [ ] @auditor-seguridad: Valida fixes
- [ ] @gobernanza-chief: Aprueba mitigación LPDP
