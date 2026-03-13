# Skill: Analizar Expediente con IA

## Cuándo usar

Cuando necesites implementar o mejorar el análisis de expedientes judiciales con Gemini IA y datos de Supabase.

## Flujo

```
1. Usuario selecciona expediente en app Android
2. App envía request → Backend Railway
3. Backend obtiene expediente + documentos de Supabase
4. Backend envía a Gemini con Function Calling
5. Gemini analiza y puede llamar funciones adicionales:
   - buscar_jurisprudencia → precedentes relevantes
   - consultar_norma → artículos aplicables
   - predecir_resultado → probabilidad de éxito
6. Backend retorna análisis completo
7. App muestra resumen ejecutivo
```

## Function Declaration

```javascript
const analizarExpedienteDecl = {
  name: "analizar_expediente",
  description:
    "Obtiene y analiza un expediente judicial completo desde Supabase",
  parametersJsonSchema: {
    type: "object",
    properties: {
      expediente_id: {
        type: "string",
        description: "UUID del expediente en Supabase",
      },
      tipo_analisis: {
        type: "string",
        enum: [
          "completo",
          "fortalezas_debilidades",
          "riesgos",
          "estrategia",
          "resumen",
        ],
        description: "Tipo de análisis solicitado",
      },
    },
    required: ["expediente_id"],
  },
};
```

## Handler de Función

```javascript
async function handleAnalizarExpediente({
  expediente_id,
  tipo_analisis = "completo",
}) {
  // Query a Supabase
  const { data: expediente } = await supabase
    .from("expedientes")
    .select("*, documentos(*)")
    .eq("id", expediente_id)
    .single();

  if (!expediente) return { error: "Expediente no encontrado" };

  return {
    expediente: {
      numero: expediente.numero_expediente,
      materia: expediente.materia,
      estado: expediente.estado,
      partes: expediente.partes,
      hechos: expediente.hechos,
      documentos: expediente.documentos.map((d) => ({
        nombre: d.nombre,
        tipo: d.tipo_documento,
      })),
    },
  };
}
```

## Análisis por Rol

| Rol     | Tipo de análisis                                                        |
| ------- | ----------------------------------------------------------------------- |
| ABOGADO | Fortalezas/debilidades, estrategia de defensa, jurisprudencia favorable |
| FISCAL  | Tipicidad, elementos del delito, pruebas para acusación                 |
| JUEZ    | Puntos controvertidos, precedentes vinculantes, opciones de resolución  |

## Datos en Supabase

```sql
-- El expediente con sus documentos
SELECT e.*,
       json_agg(d.*) as documentos
FROM expedientes e
LEFT JOIN documentos d ON d.expediente_id = e.id
WHERE e.id = $1 AND e.usuario_id = auth.uid()
GROUP BY e.id;
```

## Checklist

- [ ] Query a Supabase con RLS (usuario solo ve sus expedientes)
- [ ] Function declaration con `parametersJsonSchema`
- [ ] Análisis diferenciado por rol
- [ ] Incluye jurisprudencia relevante vía `buscar_jurisprudencia`
- [ ] Genera resumen ejecutivo accionable
- [ ] Almacena resultado del análisis en Supabase
