# Skill: Crear Endpoint API

## Cuándo usar

Cuando necesites crear un nuevo endpoint REST en Express 5 (Node) o ASP.NET Core 8 (.NET), desplegado en Railway con Supabase como base de datos.

## Flujo de Trabajo

### 1. Definir el endpoint

- Método HTTP (GET, POST, PUT, DELETE)
- Ruta (`/api/v1/recurso`)
- Parámetros (path, query, body)
- Respuesta esperada

### 2. Backend Node (Express en Railway)

```javascript
// server/routes/nuevo-recurso.js
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

// GET /api/v1/recurso
router.get("/", authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from("tabla")
    .select("*")
    .eq("usuario_id", req.user.id);

  if (error)
    return res.status(500).json({ success: false, message: error.message });
  res.json({ success: true, data });
});

// POST /api/v1/recurso
router.post("/", authMiddleware, async (req, res) => {
  const { campo1, campo2 } = req.body;
  // Validar input
  if (!campo1)
    return res
      .status(400)
      .json({ success: false, message: "campo1 requerido" });

  const { data, error } = await supabase
    .from("tabla")
    .insert({ campo1, campo2, usuario_id: req.user.id })
    .select()
    .single();

  if (error)
    return res.status(500).json({ success: false, message: error.message });
  res.status(201).json({ success: true, data });
});

export default router;
```

### 3. Registrar ruta en server/index.js

```javascript
import nuevoRecursoRoutes from "./routes/nuevo-recurso.js";
app.use("/api/v1/nuevo-recurso", nuevoRecursoRoutes);
```

### 4. Backend .NET (ASP.NET Core en Railway)

```
LegalPro.Application/NuevoRecurso/
├── Commands/
│   └── CreateNuevoRecurso/
│       ├── CreateNuevoRecursoCommand.cs
│       ├── CreateNuevoRecursoHandler.cs
│       └── CreateNuevoRecursoValidator.cs
└── Queries/
    └── GetNuevoRecurso/
        ├── GetNuevoRecursoQuery.cs
        └── GetNuevoRecursoHandler.cs
```

### 5. Checklist

- [ ] Endpoint creado con Supabase queries (NO SQLite)
- [ ] Auth middleware aplicado
- [ ] Input validation
- [ ] Respuesta formato `{ success, data, message }`
- [ ] RLS policy en Supabase para la tabla
- [ ] Variables de entorno en Railway configuradas
