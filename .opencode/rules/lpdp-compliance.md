---
description: Reglas de cumplimiento LPDP 29733
globs:
  - "**/usuarios*.{js,ts,cs}"
  - "**/consentimientos*.{js,ts,cs}"
  - "**/datos-personales*.{js,ts,cs}"
---

# Reglas de Cumplimiento LPDP 29733

Aplicar estas reglas al editar código que maneja datos personales.

## Consentimiento

- TODO usuario DEBE aceptar Términos y Privacidad antes de usar el sistema
- SIEMPRE registrar en tabla `consentimientos` con versiones
- SIEMPRE respetar `finalidades` específicas
- NUNCA asumir consentimiento implícito

## Categoría de datos (Nivel LPDP)

- **Nivel 3 (PII)**: email, nombre, DNI, RUC, teléfono
- **Nivel 4 (PII Sensible)**: datos de salud, menores, víctimas
- **Nivel 5 (Secretos)**: passwords, API keys, tokens

## Derechos ARCO

- TODO sistema DEBE tener endpoints para:
  - `GET /api/mis-datos` (Acceso / Exportación)
  - `PUT /api/mis-datos` (Rectificación)
  - `DELETE /api/cuenta` (Cancelación)
  - `POST /api/mis-datos/oposicion` (Oposición)

## Transferencia Internacional (Art. 21)

- TODO envío a MiniMax DEBE verificar flag `acepta_transferencia_internacional = true`
- SIEMPRE mostrar disclaimer específico
- SIEMPRE registrar en `audit_log` con `TRANSFERENCIA_INTERNACIONAL`
- Solo a países con nivel adecuado

## Firma Digital (Ley 27269)

- TODO documento exportable DEBE tener hash SHA-256
- TODO documento firmado DEBE tener timestamp de TSA
- SIEMPRE emitir `FIRMA_DIGITAL_GENERATED` audit event

## Breach Notification (Art. 24)

- TODO breach DEBE notificarse a ANPDP en <= 5 días hábiles
- SIEMPRE activar `RB-010-lpdp-breach.md`
- SIEMPRE comunicar a titulares afectados

## Retención

- Cada tabla DEBE tener plazo de retención documentado
- `audit_log` mínimo 5 años
- `consentimientos` mínimo 10 años
- Datos personales según finalidad
