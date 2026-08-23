---
description: Reglas para prompts legales a MiniMax M3
globs:
  - "**/services/minimax*.{js,ts,cs}"
  - "**/prompts/**/*.{js,ts,md}"
  - "**/services/MiniMaxService.cs"
---

# Reglas de Prompts Legales a MiniMax M3

Aplicar estas reglas al editar código que interactúa con MiniMax M3 AI.

## SDK correcto

- SIEMPRE `MiniMaxAI` desde `../utils/minimaxClient.js` (NUNCA `@google/genai`)
- SIEMPRE `parametersJsonSchema` (NO `functionDeclarations` legacy)
- Function Calling: `FunctionCallingConfigMode.AUTO/ANY/NONE`

## System Instructions

- Incluir: "Eres un asistente jurídico especializado en el ordenamiento peruano"
- Bases legales: CPC, NCPP, CC, CP, LPCL
- Disclaimer obligatorio en system: "Esto NO constituye asesoría legal"
- Idioma: español Peru (es-PE)

## Pre-procesamiento

- SIEMPRE validar consentimiento de transferencia internacional
- SIEMPRE sanitizar prompts (vía `promptSanitizer.envolverContenidoUsuario`)
- NUNCA enviar PII sin sanitizar
- NUNCA inventar citas: validar contra `catalogs/codigos-leyes.json`

## Post-procesamiento

- Validar cada cita contra catálogo
- Insertar 4+ disclaimers obligatorios
- Emitir audit event `AI_REQUEST`
- Insertar en `consumo_tokens_ia`
- Latencia p95 < 3s

## Modelos

- Preferir `MiniMax-M3` (default)
- Solo `MiniMax-M2.5-highspeed` para requests de baja latencia
- `MiniMax-M3-large-context` para contexto largo (>32K tokens)
- NUNCA usar modelos deprecados (modelos antiguos/legacy)
