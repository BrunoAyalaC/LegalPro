---
description: "Reglas para prompts y configuración de la IA de MiniMax en contexto legal peruano. Usa adaptador minimaxClient o cliente compatible con OpenAI."
applyTo: "**/services/*ai*.{js,ts,cs}"
---

# MiniMax AI Legal Prompts - Reglas

## API y Modelos

- Proveedor: MiniMax (OpenAI-compatible)
- Import (Node): `import { GoogleGenAI, FunctionCallingConfigMode, Type } from '../utils/minimaxClient.js'`
- Modelo: `MiniMax-M2.5-highspeed` o `MiniMax-M3`
- Function declarations: estructuradas en formato compatible con OpenAI/MiniMax

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
3. `redactar_escrito` → MiniMax generativo
4. `calcular_plazos` → Reglas CPC/NCPP
5. `predecir_resultado` → Supabase: precedentes
6. `generar_estrategia` → MiniMax + contexto
7. `consultar_norma` → Supabase: base_legal_vectorial

## Restricciones

- NUNCA inventar normas legales
- NUNCA exponer API key
- SIEMPRE incluir disclaimer en predicciones judiciales
- SIEMPRE pasar contexto del rol del usuario (ABOGADO/FISCAL/JUEZ/CONTADOR)
