---
description: Reglas para el owner dashboard
globs:
  - "legalpro-owner-dashboard/**/*.js"
  - "legalpro-owner-dashboard/server.js"
---

# Reglas para el Owner Dashboard

Aplicar estas reglas al editar `legalpro-owner-dashboard/`.

## Autenticación

- Owner via `Authorization: Bearer <OWNER_SECRET_KEY>`
- OWNER_SECRET_KEY >= 32 chars desde variable de entorno
- NUNCA hardcodear el secret
- Frase de descifrado E2EE NUNCA se transmite

## Cifrado E2EE

- SIEMPRE PBKDF2 con 100,000 iteraciones SHA-256
- SIEMPRE AES-256-GCM con IV aleatorio de 12 bytes
- SIEMPRE salt aleatorio de 16 bytes
- Web Crypto API en frontend

## KPIs

- SIEMPRE datos agregados (NO PII)
- SIEMPRE moneda configurable USD/PEN
- SIEMPRE IGV 18% (Perú) cuando aplica
- SIEMPRE tipo de cambio BCRP

## Acciones del Owner

| Acción | Severidad | Requiere 2FA |
|---|---|---|
| Suspender tenant | HIGH | Sí |
| Eliminar tenant | CRITICAL | Sí |
| Cambiar plan | MEDIUM | No |
| Refund | HIGH | Si > S/ 100 |
| Ver PII | CRITICAL | Sí + aprobación legal |

## Compliance

- LPDP: owner NO procesa ARCO
- Audit log obligatorio para TODA acción
- 7 días de preaviso para suspensiones
- Retención: 90 días post-suspensión
