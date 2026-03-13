# 👤 PERSONA 5 - Backend Completo & Métodos

**Para:** Explicación integral del backend (Express + .NET), base de datos, arquitectura y despliegue.

---

## Arquitectura Cloud-Native

```
┌─────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│  React Frontend │────▶│  Backend (Railway)    │────▶│  Supabase Cloud  │
│  SPA + Vite     │     │  Express 5 + .NET 9   │     │  PostgreSQL      │
│  GitHub Pages   │     │  + Gemini SDK         │     │  Auth + Storage  │
└─────────────────┘     └──────────────────────┘     └──────────────────┘
       ↑                         ↓
       └─────── Realtime ────────┘
       (WebSockets - Supabase)
```

---

## Backend Node.js + Express 5

**Ubicación:** `legalpro-app/`

### 1. Estructura de Carpetas

```
legalpro-app/
├── package.json              ← Dependencias
├── vite.config.js
├── .env.local                ← Variables (Supabase, Gemini)
├── server/
│   ├── index.js              ← Puerto 3000
│   ├── routes/
│   │   ├── auth.js           ← Login, signup
│   │   ├── expedientes.js    ← CRUD expedientes
│   │   └── gemini.js         ← IA endpoints
│   ├── middleware/
│   │   └── auth.js           ← JWT validation
│   └── services/
│       ├── supabaseService.js
│       └── geminiService.js
└── src/                      ← Frontend React

```

---

### 2. Configuración Express

**Ubicación:** `server/index.js`

```js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rutas
import authRoutes from './routes/auth.js';
import expedientesRoutes from './routes/expedientes.js';
import geminiRoutes from './routes/gemini.js';

app.use('/api/auth', authRoutes);
app.use('/api/expedientes', expedientesRoutes);
app.use('/api/gemini', geminiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`✅ Backend corriendo en puerto ${PORT}`);
});
```

---

### 3. Autenticación con JWT

**Ubicación:** `server/routes/auth.js`

```js
import express from 'express';
import { supabase } from '../services/supabaseService.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// 🔐 Signup
router.post('/signup', async (req, res) => {
  const { email, password, nombre } = req.body;
  
  try {
    // Crear usuario en Supabase Auth
    const { data, error } = await supabase.auth.signUpWithPassword({
      email,
      password,
    });
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    // Guardar perfil en tabla usuarios
    await supabase.from('usuarios').insert({
      id: data.user.id,
      email,
      nombre,
      rol: 'abogado',
    });
    
    // Generar JWT
    const token = jwt.sign(
      { userId: data.user.id, email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ token, user: data.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔑 Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    const token = jwt.sign(
      { userId: data.user.id, email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ token, user: data.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

---

### 4. CRUD de Expedientes

**Ubicación:** `server/routes/expedientes.js`

```js
import express from 'express';
import { supabase } from '../services/supabaseService.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// 📖 GET - Obtener expedientes del usuario
router.get('/', authMiddleware, async (req, res) => {
  const { userId } = req.user;
  
  try {
    const { data, error } = await supabase
      .from('expedientes')
      .select('*')
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📖 GET - Obtener expediente por ID
router.get('/:id', authMiddleware, async (req, res) => {
  const { userId } = req.user;
  const { id } = req.params;
  
  try {
    const { data, error } = await supabase
      .from('expedientes')
      .select('*')
      .eq('id', id)
      .eq('usuario_id', userId)
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✍️ POST - Crear expediente
router.post('/', authMiddleware, async (req, res) => {
  const { userId } = req.user;
  const expediente = req.body;
  
  try {
    const { data, error } = await supabase
      .from('expedientes')
      .insert({
        ...expediente,
        usuario_id: userId,
      })
      .select();
    
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔄 PUT - Actualizar expediente
router.put('/:id', authMiddleware, async (req, res) => {
  const { userId } = req.user;
  const { id } = req.params;
  
  try {
    const { data, error } = await supabase
      .from('expedientes')
      .update(req.body)
      .eq('id', id)
      .eq('usuario_id', userId)
      .select();
    
    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🗑️ DELETE - Eliminar expediente
router.delete('/:id', authMiddleware, async (req, res) => {
  const { userId } = req.user;
  const { id } = req.params;
  
  try {
    await supabase
      .from('expedientes')
      .delete()
      .eq('id', id)
      .eq('usuario_id', userId);
    
    res.json({ message: 'Expediente eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

---

### 5. Integración Gemini IA

**Ubicación:** `server/routes/gemini.js`

```js
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 🤖 Analizar expediente
router.post('/analizar', authMiddleware, async (req, res) => {
  const { expediente } = req.body;
  
  const prompt = `
    Eres un abogado peruano experto. Analiza este expediente:
    
    Número: ${expediente.numero}
    Tipo: ${expediente.tipo}
    Descripción: ${expediente.descripcion}
    
    Proporciona:
    1. Resumen legal
    2. Riesgos identificados
    3. Recomendaciones de estrategia
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800,
      },
    });
    
    const analisis = response.response.text();
    res.json({ analisis });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📝 Generar demanda
router.post('/generar-demanda', authMiddleware, async (req, res) => {
  const { datosExpediente } = req.body;
  
  const prompt = `
    Genera una demanda legal en formato profesional basado en:
    Demandante: ${datosExpediente.demandante}
    Demandado: ${datosExpediente.demandado}
    Hechos: ${datosExpediente.hechos}
    Pretensión: ${datosExpediente.pretension}
    
    Incluye fundamentos legales del CPC peruano.
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    const demanda = response.response.text();
    res.json({ demanda });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

---

### 6. Middleware de Autenticación

**Ubicación:** `server/middleware/auth.js`

```js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
}
```

---

## Backend .NET 9 + Clean Architecture

**Ubicación:** `LegalProBackend_Net/`

### 1. Estructura de Proyectos

```
LegalProBackend_Net/
├── LegalPro.Api/              ← Controllers + Program.cs
├── LegalPro.Application/      ← CQRS (Commands, Queries, Handlers)
├── LegalPro.Domain/           ← Entities, Interfaces
├── LegalPro.Infrastructure/   ← DB context, Repositories
├── LegalPro.UnitTests/
└── LegalPro.IntegrationTests/
```

**Patrón:** Clean Architecture con CQRS + MediatR

---

### 2. Program.cs - Configuración

**Ubicación:** `LegalPro.Api/Program.cs`

```csharp
using LegalPro.Application;
using LegalPro.Infrastructure;
using LegalPro.Infrastructure.Database;

var builder = WebApplicationBuilder.CreateBuilder(args);

// Servicios
builder.Services.AddControllers();
builder.Services.AddCors(options => options.AddPolicy("AllowFrontend", b =>
    b.WithOrigins("http://localhost:5173", "https://production-url.com")
     .AllowAnyMethod()
     .AllowAnyHeader()
));

// Supabase
builder.Services.AddScoped<ISupabaseService, SupabaseService>();

// MediatR para CQRS
builder.Services.AddMediatR(cfg => 
    cfg.RegisterServicesFromAssembly(typeof(CreateExpedienteCommand).Assembly)
);

// Entity Framework
builder.Services.AddDbContext<LegalProContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"))
);

var app = builder.Build();

app.UseRouting();
app.UseCors("AllowFrontend");
app.MapControllers();

app.Run();
```

---

### 3. Entidades de Dominio

**Ubicación:** `LegalPro.Domain/Entities/Expediente.cs`

```csharp
using System;

namespace LegalPro.Domain.Entities;

public class Expediente
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UsuarioId { get; set; }
    public string Numero { get; set; }
    public string Titulo { get; set; }
    public string Tipo { get; set; } // Penal, Civil, Laboral
    public string Descripcion { get; set; }
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    public DateTime? FechaActualizacion { get; set; }
    
    // Relaciones
    public virtual Usuario Usuario { get; set; }
}
```

---

### 4. CQRS - Commands (Escritura)

**Ubicación:** `LegalPro.Application/Features/Expedientes/CreateExpedienteCommand.cs`

```csharp
using MediatR;
using LegalPro.Domain.Entities;
using LegalPro.Infrastructure.Database;

namespace LegalPro.Application.Features.Expedientes;

public record CreateExpedienteCommand(
    string UsuarioId,
    string Numero,
    string Titulo,
    string Tipo,
    string Descripcion
) : IRequest<ExpedienteDto>;

public class CreateExpedienteHandler : IRequestHandler<CreateExpedienteCommand, ExpedienteDto>
{
    private readonly LegalProContext _context;
    
    public CreateExpedienteHandler(LegalProContext context)
    {
        _context = context;
    }
    
    public async Task<ExpedienteDto> Handle(
        CreateExpedienteCommand request, 
        CancellationToken cancellationToken)
    {
        // Validar
        var expediente = new Expediente
        {
            UsuarioId = request.UsuarioId,
            Numero = request.Numero,
            Titulo = request.Titulo,
            Tipo = request.Tipo,
            Descripcion = request.Descripcion,
        };
        
        _context.Expedientes.Add(expediente);
        await _context.SaveChangesAsync(cancellationToken);
        
        return new ExpedienteDto(
            expediente.Id,
            expediente.Titulo,
            expediente.Tipo,
            expediente.Descripcion
        );
    }
}

public record ExpedienteDto(
    string Id,
    string Titulo,
    string Tipo,
    string Descripcion
);
```

---

### 5. CQRS - Queries (Lectura)

**Ubicación:** `LegalPro.Application/Features/Expedientes/GetExpedientesQuery.cs`

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using LegalPro.Infrastructure.Database;

namespace LegalPro.Application.Features.Expedientes;

public record GetExpedientesQuery(string UsuarioId) : IRequest<List<ExpedienteDto>>;

public class GetExpedientesHandler : IRequestHandler<GetExpedientesQuery, List<ExpedienteDto>>
{
    private readonly LegalProContext _context;
    
    public GetExpedientesHandler(LegalProContext context)
    {
        _context = context;
    }
    
    public async Task<List<ExpedienteDto>> Handle(
        GetExpedientesQuery request,
        CancellationToken cancellationToken)
    {
        var expedientes = await _context.Expedientes
            .Where(e => e.UsuarioId == request.UsuarioId)
            .OrderByDescending(e => e.FechaCreacion)
            .Select(e => new ExpedienteDto(
                e.Id,
                e.Titulo,
                e.Tipo,
                e.Descripcion
            ))
            .ToListAsync(cancellationToken);
        
        return expedientes;
    }
}
```

---

### 6. Controller - Orquesta CQRS

**Ubicación:** `LegalPro.Api/Controllers/ExpedientesController.cs`

```csharp
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using LegalPro.Application.Features.Expedientes;

namespace LegalPro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ExpedientesController : ControllerBase
{
    private readonly IMediator _mediator;
    
    public ExpedientesController(IMediator mediator)
    {
        _mediator = mediator;
    }
    
    [HttpGet]
    public async Task<ActionResult<List<ExpedienteDto>>> GetExpedientes()
    {
        var userId = User.FindFirst("sub")?.Value;
        var query = new GetExpedientesQuery(userId);
        var result = await _mediator.Send(query);
        
        return Ok(result);
    }
    
    [HttpPost]
    public async Task<ActionResult<ExpedienteDto>> CreateExpediente(
        CreateExpedienteCommand command)
    {
        var result = await _mediator.Send(command);
        return CreatedAtAction(nameof(GetExpedientes), new { id = result.Id }, result);
    }
}
```

---

## Base de Datos PostgreSQL

**Ubicación:** `LegalProBackend_Net/Infrastructure/Database/LegalProContext.cs`

### Schema en Supabase

```sql
-- Tabla Usuarios
CREATE TABLE usuarios (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email varchar(255) NOT NULL UNIQUE,
  nombre varchar(255) NOT NULL,
  rol varchar(50) NOT NULL, -- abogado, juez, fiscal, contador
  created_at timestamp DEFAULT now()
);

-- Tabla Expedientes
CREATE TABLE expedientes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id),
  numero varchar(50) NOT NULL,
  titulo varchar(255) NOT NULL,
  tipo varchar(50) NOT NULL, -- penal, civil, laboral
  descripcion text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Row Level Security (RLS)
ALTER TABLE expedientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY expedientes_isolation ON expedientes
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- Índices
CREATE INDEX idx_expedientes_usuario_id ON expedientes(usuario_id);
CREATE INDEX idx_expedientes_tipo ON expedientes(tipo);
```

---

## Despliegue en Railway

### 1. Variables de Entorno

**Railway Dashboard → Variables**

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...
GEMINI_API_KEY=AIza...
JWT_SECRET=super-secret-key-256-bits
DATABASE_URL=postgresql://user:pass@host:5432/db
```

### 2. Dockerfile para .NET

**Ubicación:** `LegalProBackend_Net/Dockerfile`

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /app

COPY . .
RUN dotnet publish -c Release -o out

FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=build /app/out .

EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000
ENTRYPOINT ["dotnet", "LegalPro.Api.dll"]
```

### 3. Despliegue

```bash
# Express a Railway
railway link
railway up --environment production

# .NET a Railway
# Desde GitHub: conectar repo, Railway detecta .NET automáticamente
```

---

## Flujo Completo: Frontend → Backend → BD

```
1. Usuario hace click en "Guardar Expediente"
   ↓
2. Frontend (React) envía POST /api/expedientes
   { titulo: "...", tipo: "...", descripcion: "..." }
   ↓
3. Express (Node.js):
   - Valida middleware JWT
   - Inserta en Supabase via SDK
   ↓
4. Supabase (PostgreSQL):
   - RLS verifica usuario_id = auth.uid()
   - Guarda en tabla expedientes
   ↓
5. Response: 201 Created
   { id: "...", titulo: "...", ... }
   ↓
6. Frontend actualiza estado local
   setExpedientes([...expedientes, nuevo])
   ↓
7. UI re-renderiza lista con nuevo expediente
```

---

## Resumen de Métodos

| Captura | Método | Ubicación |
|---------|--------|-----------|
| **Auth** | `signUpWithPassword()` | Express auth.js |
| **Auth** | `signInWithPassword()` | Express auth.js |
| **Auth** | `authMiddleware()` | Express middleware |
| **CRUD** | `.select()` | Supabase queries |
| **CRUD** | `.insert()` | Supabase create |
| **CRUD** | `.update()` | Supabase update |
| **CRUD** | `.delete()` | Supabase delete |
| **IA** | `generateContent()` | Gemini API |
| **CQRS** | `IRequest<T>` | MediatR commands |
| **CQRS** | `IRequestHandler<T>` | MediatR handlers |
| **DB** | `DbContext.SaveChangesAsync()` | Entity Framework |
| **RLS** | `auth.uid()` | Supabase policies |

---

## ¿Cómo Explicar en Presentación?

1. **Arquitectura Cloud**: Frontend React → Express/NET → Supabase PostgreSQL
2. **Autenticación**: Supabase Auth + JWT tokens
3. **CRUD**: Operaciones básicas en expedientes
4. **IA Gemini**: Análisis y generación de documentos
5. **CQRS**: Separación Commands (escritura) vs Queries (lectura)
6. **MediatR**: Patrón mediador para desacoplar lógica
7. **RLS**: Seguridad a nivel de fila en BD
8. **Railway**: Despliegue en cloud sin dedicar servidores
9. **Flujo Completo**: Usuario click → Frontend → Backend → BD → Response → UI actualiza
10. **Validación**: Validar datos antes de guardar en BD
