# Clasificación de Datos

## Niveles

### Nivel 0: Público

- Marketing
- Landing pages
- Documentación pública
- Precios públicos
- Términos y condiciones

**Tratamiento**: Sin restricciones

### Nivel 1: Interno

- Métricas agregadas
- Planes de producto
- Arquitectura general
- ADRs

**Tratamiento**: Solo empleados

### Nivel 2: Confidencial

- Código fuente
- Esquemas de BD
- API keys no productivas
- Configuración de infra

**Tratamiento**: Empleados + NDA + necesidad de conocer

### Nivel 3: PII (Datos Personales)

- Email
- Nombre, apellido
- DNI
- RUC
- Teléfono
- Dirección
- Datos de contacto

**Base legal**: LPDP 29733
**Tratamiento**:
- Consentimiento explícito por finalidad
- Registro de tratamiento
- Retención documentada
- Derecho ARCO
- Cifrado en tránsito (HTTPS) y en reposo (pgcrypto)
- Auditoría de acceso
- Posibilidad de exportación/eliminación

### Nivel 4: PII Sensible

- Datos de salud
- Origen étnico
- Opiniones políticas
- Convicciones religiosas
- Datos biométricos
- Datos de menores de 14 años
- Antecedentes penales
- Datos de víctimas de violencia

**Base legal**: LPDP 29733 Art. 4
**Tratamiento**:
- Consentimiento explícito (no se presume)
- Medidas de seguridad reforzadas
- DPO si aplica
- Retención mínima indispensable
- Cifrado obligatorio en reposo
- No transferir internacionalmente sin consentimiento explícito

### Nivel 5: Secretos / Credenciales

- JWT_SECRET
- API keys (Gemini, Supabase, Stripe, etc.)
- Passwords (hash con bcrypt)
- Certificados digitales
- Tokens de servicio

**Tratamiento**:
- NUNCA en código
- Solo en variables de entorno o vault
- Rotación periódica (90 días)
- Auditoría de acceso
- Generación aleatoria criptográfica

## Matriz de controles

| Nivel | Cifrado en tránsito | Cifrado en reposo | Audit log | Consentimiento | ARCO | Retención | Transferencia Intl |
|---|---|---|---|---|---|---|---|
| 0 | No | No | No | No | No | Indefinido | Permitido |
| 1 | HTTPS | No | No | No | No | Indefinido | Permitido |
| 2 | HTTPS | Sí | Sí (lectura) | No | No | Indefinido | Permitido |
| 3 | HTTPS | Sí (pgcrypto) | Sí (todo) | Sí (por finalidad) | Sí (Art. 25-28) | Documentado | Solo con consentimiento explícito |
| 4 | HTTPS | Sí (AES-256) | Sí (todo) | Sí (explícito) | Sí (Art. 25-28) | Mínimo indispensable | Prohibido sin consentimiento explícito |
| 5 | HTTPS | N/A (no se almacena) | Sí (acceso) | N/A | N/A | N/A | N/A |

## Aplicación al proyecto

- **LPDP Nivel 3-4**: usuarios, expedientes, documentos, mensajes_chat
- **LPDP Nivel 5**: secrets en env vars
- **Nivel 2**: código, schemas
- **Nivel 0-1**: landing, docs

Ver `catalogs/audit-events.json` para eventos de auditoría.
