# Skill: Configurar Google Gemini SDK

## Cuándo usar

Cuando necesites configurar, depurar o actualizar la integración con Google Gemini en LegalPro.

## SDK Oficial: `@google/genai`

```bash
npm install @google/genai
```

> **IMPORTANTE**: El paquete correcto es `@google/genai`, NO `@google/generative-ai` ni `@google-ai/generativelanguage`.

## Configuración Básica

```javascript
import { GoogleGenAI, FunctionCallingConfigMode, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Generación simple
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Pregunta legal...",
});
console.log(response.text);
```

## Function Calling

```javascript
// Declaración de función con parametersJsonSchema
const functionDecl = {
  name: "buscar_jurisprudencia",
  description: "Busca jurisprudencia peruana",
  parametersJsonSchema: {
    type: "object",
    properties: {
      materia: { type: "string", enum: ["penal", "civil", "laboral"] },
      keyword: { type: "string" },
    },
    required: ["keyword"],
  },
};

// Llamada con tools
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: userMessage,
  config: {
    tools: [{ functionDeclarations: [functionDecl] }],
    toolConfig: {
      functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
    },
  },
});

// Procesar function calls
if (response.functionCalls) {
  for (const call of response.functionCalls) {
    console.log(call.name, call.args);
    const result = await executeFunction(call.name, call.args);
    // Enviar resultado de vuelta como FunctionResponse
  }
}
```

## Modos de Function Calling

| Modo   | Comportamiento                                             |
| ------ | ---------------------------------------------------------- |
| `AUTO` | Gemini decide si llamar funciones o responder directamente |
| `ANY`  | Gemini SIEMPRE llama una función                           |
| `NONE` | Gemini NUNCA llama funciones                               |

## Variables de Entorno

```env
# En Railway (backend)
GEMINI_API_KEY=AIza...
```

## Troubleshooting

| Error           | Solución                                      |
| --------------- | --------------------------------------------- |
| 403 Forbidden   | Verificar API key válida y habilitada         |
| 429 Rate Limit  | Implementar backoff exponencial               |
| Schema mismatch | Usar `parametersJsonSchema` (NO `parameters`) |
| Import error    | Verificar que es `@google/genai`              |
| Token limit     | Reducir contexto o usar streaming             |

## 7 Function Declarations de LegalPro

1. `buscar_jurisprudencia` → Supabase: jurisprudencia
2. `analizar_expediente` → Supabase: expedientes + documentos
3. `redactar_escrito` → Gemini generativo
4. `calcular_plazos` → Reglas CPC/NCPP
5. `predecir_resultado` → Supabase: precedentes
6. `generar_estrategia` → Gemini + contexto
7. `consultar_norma` → Supabase: base_legal_vectorial

## Archivo Principal

`legalpro-app/server/services/geminiService.js`
