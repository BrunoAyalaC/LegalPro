# Skill: Simulación de Juicio con IA

## Cuándo usar

Cuando necesites implementar o mejorar el simulador de juicios interactivo con MiniMax AI.

## Concepto

Simulación role-playing donde MiniMax juega roles procesales (juez, fiscal, testigo, etc.) y el usuario practica su intervención. Datos almacenados en Supabase.

## Roles Disponibles

| Simulación  | Rol del usuario  | Roles MiniMax             |
| ----------- | ---------------- | ------------------------ |
| Juicio oral | ABOGADO defensor | Juez, fiscal, testigo    |
| Juicio oral | FISCAL acusador  | Juez, abogado, testigo   |
| Juzgamiento | JUEZ             | Abogado, fiscal, testigo |

## Flujo

```
1. Usuario selecciona tipo de simulación (app Android)
2. Request → Backend Railway
3. Backend genera caso con MiniMax: `generar_estrategia` tipo=caso_simulacion
4. Backend crea simulación en Supabase: tabla `simulaciones`
5. Loop de turnos:
   a. MiniMax presenta situación procesal
   b. Usuario responde (intervención legal)
   c. MiniMax evalúa y puntúa
   d. Se registra turno en Supabase: tabla `eventos_simulacion`
6. Al finalizar: retroalimentación IA + puntuación final
```

## Implementación

### Function Calling para generar caso

```javascript
const generarCasoDecl = {
  name: "generar_estrategia",
  description: "Genera un caso y estrategia para simulación de juicio",
  parametersJsonSchema: {
    type: "object",
    properties: {
      tipo: {
        type: "string",
        enum: ["caso_simulacion", "interrogatorio", "objecion"],
      },
      materia: { type: "string", enum: ["penal", "civil", "laboral"] },
      dificultad: {
        type: "string",
        enum: ["basico", "intermedio", "avanzado"],
      },
    },
    required: ["tipo", "materia"],
  },
};
```

### Tablas en Supabase

```sql
-- simulaciones
CREATE TABLE simulaciones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id UUID REFERENCES auth.users(id),
    tipo TEXT NOT NULL, -- 'juicio_oral', 'juzgamiento'
    materia TEXT NOT NULL,
    caso_generado JSONB NOT NULL,
    puntaje_final NUMERIC,
    estado TEXT DEFAULT 'en_progreso',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- eventos_simulacion (turnos)
CREATE TABLE eventos_simulacion (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    simulacion_id UUID REFERENCES simulaciones(id),
    turno INTEGER NOT NULL,
    rol TEXT NOT NULL, -- 'juez', 'fiscal', 'usuario'
    contenido TEXT NOT NULL,
    puntaje NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Checklist

- [ ] Caso generado con MiniMax Function Calling
- [ ] Datos en Supabase (simulaciones + eventos)
- [ ] Loop de turnos con evaluación IA
- [ ] Puntuación por turno y final
- [ ] Retroalimentación IA al final
- [ ] Pantalla Android con chat-like UI
