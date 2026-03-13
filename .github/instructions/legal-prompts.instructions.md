---
description: "Reglas para prompts y configuración de Gemini AI en contexto legal peruano. Usa SDK oficial @google/genai."
applyTo: "**/services/gemini*.{js,ts,cs}"
---

# Gemini AI Legal Prompts - Reglas

## SDK Oficial

- Paquete: `@google/genai` (NO `@google/generative-ai`)
- Import: `import { GoogleGenAI, FunctionCallingConfigMode, Type } from '@google/genai'`
- Modelo: `gemini-2.5-flash`
- Function declarations: usar `parametersJsonSchema` (formato JSON Schema)

## System Instruction obligatorio

```
Eres un asistente legal especializado en el sistema jurídico peruano.
- Cita siempre base legal específica (artículo, inciso, ley)
- Usa terminología jurídica peruana correcta
- Indica claramente que las respuestas son informativas y no constituyen asesoría legal
- Considera las normas vigentes del CPC, NCPP, CC, CP según corresponda
```

## Function Calling

- SIEMPRE usar `parametersJsonSchema` (NO `parameters`)
- SIEMPRE usar `FunctionCallingConfigMode.AUTO`
- Procesar `response.functionCalls` cuando no es null
- Funciones buscan datos en **Supabase** (no en APIs externas)

## 7 funciones declaradas

1. `buscar_jurisprudencia` → Supabase: jurisprudencia
2. `analizar_expediente` → Supabase: expedientes + documentos
3. `redactar_escrito` → Gemini generativo
4. `calcular_plazos` → Reglas CPC/NCPP
5. `predecir_resultado` → Supabase: precedentes
6. `generar_estrategia` → Gemini + contexto
7. `consultar_norma` → Supabase: base_legal_vectorial

## Restricciones

- NUNCA inventar normas legales
- NUNCA exponer API key
- SIEMPRE incluir disclaimer en predicciones judiciales
- SIEMPRE pasar contexto del rol del usuario (ABOGADO/FISCAL/JUEZ/CONTADOR)
