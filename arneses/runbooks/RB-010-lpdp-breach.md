# RB-010: Breach de LPDP (Datos Personales)

## Metadata

- **Severidad**: P0
- **Categoría**: compliance, security
- **Owner**: @GobernanzaChief + @AuditorLPDP
- **Última actualización**: 2026-08-01
- **Marco legal**: Ley 29733 Art. 24 (5 días hábiles para notificar a ANPDP)

## Incidente 2026-08-01: exposición local de secretos de producción

- **ID interno**: `INC-2026-08-01-SECRET-EXPOSURE`
- **Severidad**: CRÍTICA / P0
- **Estado**: Remediación en curso
- **Vector**: archivo local `datos.txt` en texto plano, eliminado del working tree y cubierto por `.gitignore`; no existe historial Git para esa ruta al momento de la evaluación
- **Activos afectados**: credenciales de MiniMax, Google Gemini, PostgreSQL Railway y firma JWT
- **Datos personales en el archivo**: no identificados
- **Riesgo LPDP indirecto**: alto hasta descartar mediante logs que las credenciales permitieron acceso no autorizado a datos personales
- **Notificación interna del incidente**: `docs/BREACH_NOTIFICATION_2026-08-01.md`
- **Apoyo para rotación**: `tools/security/rotate-compromised-secrets.mjs` (genera una nueva firma JWT y muestra comandos; no revoca ni actualiza proveedores por sí solo)

### Checklist específico de cierre

- [ ] Revocar y rotar las cuatro credenciales en sus proveedores de origen
- [ ] Actualizar variables en todos los servicios Node y .NET afectados
- [ ] Invalidar sesiones/tokens y exigir reautenticación después de rotar la firma JWT
- [ ] Auditar logs de MiniMax, Google Cloud, Railway, PostgreSQL y aplicación desde la primera posible exposición
- [ ] Determinar y documentar si hubo acceso, extracción, alteración o divulgación de datos personales
- [ ] Si se confirma afectación de datos personales, escalar de inmediato a Gobernanza/DPO y notificar dentro del plazo máximo aplicable de 5 días hábiles
- [ ] Ejecutar `npm run verify:all` y adjuntar resultados al expediente del incidente
- [ ] Crear post-mortem y registrar controles preventivos antes de cerrar el incidente

> La conclusión de que no se requiere notificación externa es provisional hasta completar la auditoría de logs y alcance. No debe cerrarse el incidente únicamente porque el archivo no haya sido versionado.

## Síntomas

- Alerta: `LPDP_BREACH_SUSPECTED` (severity CRITICAL)
- Auditoría detecta cross-tenant leak
- Logs muestran acceso a PII sin autorización
- Hacker reporta el breach (responsible disclosure)
- Usuario reporta exposición de sus datos

## Diagnóstico (PRIORIDAD: contener primero)

### Paso 1: Contener (INMEDIATO, < 1h)

- [ ] Aislar la vulnerabilidad
- [ ] Cerrar endpoint afectado
- [ ] Revocar credenciales comprometidas
- [ ] Activar backup del último estado bueno
- [ ] Bloquear IPs sospechosas (WAF)

### Paso 2: Evaluar alcance (1-24h)

- [ ] ¿Qué datos fueron comprometidos?
- [ ] ¿Cuántos usuarios afectados?
- [ ] ¿Es LPDP Nivel 3, 4 o 5?
- [ ] ¿Se ha transferido internacionalmente?
- [ ] Revisar `audit_log` con `correlation_id`

### Paso 3: Notificar (obligatorio LPDP)

- [ ] **<= 24h**: Notificar a @GobernanzaChief, @CISO
- [ ] **<= 5 días hábiles**: Notificar a ANPDP (`notificaciones@anpd.gob.pe`)
  - Formato: descripción, alcance, medidas, plan de remediación
- [ ] **<= 72h**: Si europeos (GDPR): notificar DPA local
- [ ] **<= 10 días hábiles**: Comunicar a titulares afectados (Art. 25 LPDP)
  - Email, mensaje en app, publicación en landing
- [ ] Si Nivel 5 (credenciales): rotar TODAS las credenciales

## Mitigación

### Contención

```bash
# Bloquear acceso público al endpoint afectado
railway env set ENDPOINT_<X>_DISABLED=true --service legalpro-node
railway env set ENDPOINT_<X>_DISABLED=true --service legalpro-dotnet

# Forzar logout de todos los usuarios
psql -c "UPDATE refresh_tokens SET revoked = true, revoked_reason = 'LPDP_BREACH' WHERE NOT revoked"
```

### Remediación

- [ ] Cerrar la vulnerabilidad (PR con fix)
- [ ] Test que reproduzca
- [ ] Auditoría completa del sistema
- [ ] Pentest externo
- [ ] Reforzar controles (mfa, encryption, etc.)

### Notificación formal a ANPDP

```
A: notificaciones@anpd.gob.pe
Asunto: [BREACH NOTIFICATION] LegalPro - <fecha>

Descripción: <qué pasó>
Alcance: <cuántos usuarios y qué datos>
Causa: <root cause>
Medidas inmediatas: <qué hicimos>
Plan de remediación: <qué vamos a hacer>
Contacto: <email + teléfono del DPO>
```

### Notificación a titulares

```
A: usuarios@legalpro.pe
Asunto: Aviso de seguridad - <fecha>

Estimado/a <nombre>,

Le informamos que hemos detectado un incidente de seguridad que pudo haber
afectado sus datos personales. Detalles:
- Fecha detección: <X>
- Datos afectados: <X>
- Medidas tomadas: <X>

Conforme a la Ley 29733, puede ejercer sus derechos ARCO en cualquier
momento desde la sección "Mis Datos" de la plataforma.

Atentamente,
LegalPro / LexIA
```

## Post-mortem

- [ ] Crear `arneses/post-mortems/PM-XXX-LPDP.md`
- [ ] Publicar resumen en compliance page
- [ ] Actualizar controles de seguridad
- [ ] Sesión de "lessons learned" con todo el equipo
- [ ] Reforzar capacitación LPDP

## Compliance

- **LPDP Art. 24**: notificación <= 5 días hábiles
- **LPDP Art. 25**: comunicación a titulares
- **LPDP Art. 36**: reportar a DPO si aplica
- **CP Art. 207-A**: si negligencia, riesgo penal

## Referencias

- `catalogs/audit-events.json` (eventos LPDP)
- `arneses/governance/COMPLIANCE-MAPPING.md`
- `arneses/governance/DATA-CLASSIFICATION.md`
- `catalogs/role-tools.json` (permisos)
