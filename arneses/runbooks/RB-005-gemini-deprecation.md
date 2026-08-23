# RB-005: Gemini Model Deprecation

## Metadata
- **Severidad**: P2
- **Owner**: @PromptEngineer + @SRE
- **Última actualización**: 2026-06-12

## Síntomas
- Alerta: `GEMINI_MODEL_DEPRECATION_WARNING`
- Google anuncia deprecation de un modelo usado

## Pasos
1. Identificar el modelo deprecado (ver `verifier-deprecation-modelos.mjs`)
2. Buscar todas las referencias en código
3. Migrar a la versión recomendada
4. Ejecutar eval-set para validar calidad
5. Deploy canary
6. Monitorear latencia y costo
7. Deprecar el modelo anterior después de 1 mes de gracia

## Compliance
- LPDP: no afecta
- ISO 27001: cambio documentado

## Comunicación
- Slack: #ops
- Email: stakeholders
