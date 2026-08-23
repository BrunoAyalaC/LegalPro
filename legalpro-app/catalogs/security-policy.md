# Política de Seguridad

## Versiones soportadas

| Versión | Soporte | Notas |
|---|---|---|
| Producción actual | ✅ Soporte completo | Recibe parches de seguridad |
| Anterior (-1) | ⚠️ Solo fixes críticos | Sin nuevas features |
| Anteriores (<-1) | ❌ End-of-life | Sin soporte |

## Cómo reportar una vulnerabilidad

**IMPORTANTE**: NO abras un issue público con detalles de seguridad.

### Canal preferido (coordinación 90 días)

1. Email a `security@legalpro.pe` (cifrado PGP preferido, key en `/security/pgp.asc`)
2. Asunto: `[SECURITY] <título breve>`
3. Detalles:
   - Tipo de vulnerabilidad (OWASP)
   - Componente afectado
   - Pasos de reproducción (sin PII)
   - Impacto estimado
   - Sugerencia de remediación (opcional)

### Tiempo de respuesta

- **P0 (CRITICAL)**: confirmación en 24h
- **P1 (HIGH)**: confirmación en 3 días
- **P2 (MEDIUM)**: confirmación en 7 días
- **P3 (LOW)**: confirmación en 14 días

### Proceso de disclosure coordinado

1. Reporte inicial
2. Confirmación por LegalPro
3. Trabajo conjunto en fix (90 días máx)
4. CVE asignado (si aplica)
5. Disclosure público + parche + advisory

## Alcance

### En alcance

- Código de los 4 stacks: .NET, Node, Android, React
- APIs REST en producción (legalpro-node, legalpro-dotnet)
- App Android (APK)
- Web app
- Landing LexIA
- Documentación de catálogos
- Workflows de CI/CD
- Datos de usuarios en producción (con aviso legal)

### Fuera de alcance

- Spam y phishing no relacionados
- Ataques físicos
- Ingeniería social contra empleados
- Tests automatizados propios (siempre seguro)
- Bugs en versiones EOL
- Denegación de servicio (DoS) puro
- Comportamiento auto-inflingido (auto-DoS)

## Hallazgos no elegibles

- Reportes que requieren usuario malicioso con cuenta
- Falta de best-practices sin vulnerabilidad concreta
- Escaneos automatizados sin PoC

## Reconocimiento

- Aceptamos reportes de investigadores
- Hallamos críticos son elegibles para bounty (futuro)
- Hallazgos válidos se reconocen en `SECURITY_HALL_OF_FAME.md`

## Compliance

- LPDP 29733 (Perú)
- ISO 27001 (en roadmap)
- SOC 2 (en roadmap)
- GDPR (en la medida que aplique por extraterritorialidad)
