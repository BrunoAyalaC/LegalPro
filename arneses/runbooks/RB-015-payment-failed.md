# RB-015: Pago Falló

## Metadata
- **Severidad**: P2
- **Owner**: @OwnerAdmin + @PlataformaFinanzas
- **Última actualización**: 2026-06-12

## Síntomas
- Stripe webhook returns 4xx
- Usuario reporta no puede pagar
- Cuenta downgradeada por falta de pago

## Pasos

1. Verificar logs de Stripe
2. Si es tarjeta vencida: contactar usuario
3. Si es fraude: bloquear tarjeta
4. Si es bug nuestro: fix
5. Reintentar el cargo
6. Si persiste: dar 7 días de gracia
7. Después de 7 días: degradar a FREE
8. Después de 30 días: suspender

## Compliance
- PCI DSS
- LPDP: afecta datos

## Comunicación
- Slack: #ops
- Email: al usuario
