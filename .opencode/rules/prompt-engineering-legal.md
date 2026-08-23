---
description: Reglas de prompt engineering para casos legales
globs:
  - "**/prompts/**/*"
  - "**/*MiniMax*.{js,cs}"
---

# Reglas de Prompt Engineering Legal

Aplicar estas reglas al diseñar prompts para MiniMax M3 en contextos legales.

## Principios

- **Determinismo**: temperatura 0.0-0.3 para legal
- **Few-shot**: 2-3 ejemplos para tareas complejas
- **Chain-of-thought**: para razonamiento jurídico
- **Negative prompting**: "NUNCA sustituyas la asesoría de un abogado"

## Estructura del prompt

1. **System instruction**: rol + base legal + restricciones
2. **Contexto del catálogo**: cita verificada de `catalogs/codigos-leyes.json`
3. **Pregunta del usuario**: con sanitización previa
4. **Output schema**: JSON estructurado
5. **Disclaimers**: 4 obligatorios

## Técnicas

- **Function Calling forzado** con `FunctionCallingConfigMode.ANY` para tareas críticas
- **Grounding con web_search (MiniMax server tool)** para jurisprudencia
- **Token optimization**: comprimir contexto sin perder precisión
- **Calibration**: ajustar temperatura según caso

## Validación post-MiniMax

- Validar cada cita contra catálogo
- Eliminar alucinaciones
- Insertar disclaimers
- Calcular score de confianza

## Métricas

- Eval-set con 50+ casos
- Latencia p95 < 3s
- Costo por request < $0.10
- Tasa de alucinación < 5%
