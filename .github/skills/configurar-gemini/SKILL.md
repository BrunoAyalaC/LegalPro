# Skill: Configurar MiniMax AI

## Cuándo usar

Cuando necesites configurar, depurar o actualizar la integración con MiniMax AI en LegalPro.

## SDK: `minimaxClient.js` (OpenAI-compatible)

```javascript
import { GoogleGenAI, FunctionCallingConfigMode, Type } from '../utils/minimaxClient.js';

const ai = new GoogleGenAI({ apiKey: process.env.MINIMAX_API_KEY });

// Generación simple
const response = await ai.models.generateContent({
  model: "MiniMax-M3",
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
  model: "MiniMax-M3",
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
| `AUTO` | MiniMax decide si llamar funciones o responder directamente |
| `ANY`  | MiniMax SIEMPRE llama una función                           |
| `NONE` | MiniMax NUNCA llama funciones                               |

## Variables de Entorno

```env
# En Railway (backend)
MINIMAX_API_KEY=mk-...
```

## Troubleshooting

| Error           | Solución                                      |
| --------------- | --------------------------------------------- |
| 403 Forbidden   | Verificar API key válida y habilitada         |
| 429 Rate Limit  | Implementar backoff exponencial               |
| Schema mismatch | Usar `parametersJsonSchema` (NO `parameters`) |
| Import error    | Verificar que es `minimaxClient.js`              |
| Token limit     | Reducir contexto o usar streaming             |

## 7 Function Declarations de LegalPro

1. `buscar_jurisprudencia` → Supabase: jurisprudencia
2. `analizar_expediente` → Supabase: expedientes + documentos
3. `redactar_escrito` → MiniMax generativo
4. `calcular_plazos` → Reglas CPC/NCPP
5. `predecir_resultado` → Supabase: precedentes
6. `generar_estrategia` → MiniMax + contexto
7. `consultar_norma` → Supabase: base_legal_vectorial

## Archivo Principal

`legalpro-app/server/services/minimaxService.js`
