# RB-004: Gemini Quota Excedida

## Metadata
- **Severidad**: P1
- **Owner**: @SRE + @PlataformaFinanzas
- **Última actualización**: 2026-06-12

## Síntomas
- 429 errors de Gemini
- Alerta: `GEMINI_QUOTA_EXCEEDED`
- Usuarios reportan "Has agotado tus créditos IA"

## Pasos
1. Verificar: `consumo_tokens_ia` y `transacciones_creditos`
2. Identificar: ¿es por tenant específico o sistémico?
3. Si es por tenant: contactar para upgrade
4. Si es sistémico: cambiar a modelo más barato (`gemini-2.5-flash-lite`)
5. Aumentar plan del tenant automáticamente si es FREE → PRO
6. Implementar rate limit por usuario (no solo por plan)

## Compliance
- LPDP: no afecta
- Contractual: PRO tiene hasta S/ 1000/mes

## Comunicación
- Slack: #ops
- Email: al tenant si excede
