# Skill: Generar Escrito Legal con IA

## Cuándo usar

Cuando necesites implementar o mejorar la generación de escritos legales usando Google Gemini SDK (`@google/genai`) con Function Calling.

## Tipos de Escritos

| Tipo                 | Quién lo usa | Función Gemini                        |
| -------------------- | ------------ | ------------------------------------- |
| Demanda              | ABOGADO      | `redactar_escrito` tipo=demanda       |
| Contestación         | ABOGADO      | `redactar_escrito` tipo=contestacion  |
| Apelación            | ABOGADO      | `redactar_escrito` tipo=apelacion     |
| Recurso de casación  | ABOGADO      | `redactar_escrito` tipo=casacion      |
| Alegato de clausura  | ABOGADO      | `redactar_escrito` tipo=alegatos      |
| Requerimiento fiscal | FISCAL       | `redactar_escrito` tipo=requerimiento |
| Acusación fiscal     | FISCAL       | `redactar_escrito` tipo=acusacion     |
| Resolución judicial  | JUEZ         | `redactar_escrito` tipo=resolucion    |
| Informe pericial     | CONTADOR     | `redactar_escrito` tipo=pericial      |

## Implementación con Gemini SDK

```javascript
import { GoogleGenAI, FunctionCallingConfigMode } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const redactarEscritoDecl = {
  name: "redactar_escrito",
  description: "Genera un escrito legal para el sistema judicial peruano",
  parametersJsonSchema: {
    type: "object",
    properties: {
      tipo: {
        type: "string",
        enum: [
          "demanda",
          "contestacion",
          "apelacion",
          "casacion",
          "alegatos",
          "requerimiento",
          "acusacion",
          "resolucion",
          "pericial",
        ],
        description: "Tipo de escrito legal",
      },
      materia: {
        type: "string",
        enum: [
          "penal",
          "civil",
          "laboral",
          "constitucional",
          "familia",
          "administrativo",
        ],
      },
      hechos: { type: "string", description: "Hechos del caso" },
      pretension: { type: "string", description: "Pretensión o solicitud" },
      base_legal: { type: "string", description: "Artículos aplicables" },
      expediente_id: {
        type: "string",
        description: "ID del expediente en Supabase",
      },
    },
    required: ["tipo", "materia", "hechos"],
  },
};

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: `Redacta una ${tipo} para el caso: ${hechos}`,
  config: {
    systemInstruction:
      "Eres un abogado peruano experto. Redacta escritos formales siguiendo el formato del Poder Judicial del Perú.",
    tools: [{ functionDeclarations: [redactarEscritoDecl] }],
    toolConfig: {
      functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
    },
  },
});
```

## Flujo Completo

1. Usuario selecciona tipo de escrito en app Android
2. App envía request → Backend Railway
3. Backend llama Gemini con Function Calling
4. Gemini analiza y genera el escrito
5. Backend guarda en Supabase Storage
6. App muestra preview y permite editar/descargar

## Checklist

- [ ] Function declaration con `parametersJsonSchema`
- [ ] System instruction con contexto legal peruano
- [ ] Formato oficial del Poder Judicial
- [ ] Guardado en Supabase Storage
- [ ] Preview y edición en app Android
