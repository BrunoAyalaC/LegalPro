# ⚙️ BACKEND - Arquitectura Completa y Métodos (Explicación General)

## 📊 Arquitectura Cloud-Native

```
┌─────────────────┐        ┌──────────────────────┐        ┌──────────────────┐
│  Landing Page   │───────▶│  Backend Express 5   │───────▶│  Supabase Cloud  │
│ GitHub Pages    │        │  (Railway) PORT:3000 │        │  PostgreSQL      │
│ React + Vite    │        │  + Gemini SDK        │        │  + Auth + RLS    │
└─────────────────┘        └──────────────────────┘        └──────────────────┘
                                     │
                                     ▼
                          ┌──────────────────┐
                          │  Google Gemini   │
                          │  SDK @google/genai│
                          │  gemini-2.5-flash│
                          └──────────────────┘

┌─────────────────┐        ┌──────────────────────┐
│  App Android    │───────▶│  Backend C# .NET 9   │
│  Kotlin+Compose │        │  (Railway) PORT:8080 │
│  APK            │        │  Clean Architecture  │
└─────────────────┘        │  + PostgreSQL        │
                           └──────────────────────┘
```

---

## 🔷 Backend Express (Node.js)

**Ubicación:** `legalpro-app/server/`  
**Responsable:** Usuario (exposición general)

### 1. **Servidor Express**
**Archivo:** `server/index.js`

```js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(cors());

// Verificación de salud (health check)
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server en puerto ${PORT}`);
});
```

**Métodos:**
- `express()`: Crea instancia de servidor
- `app.use()`: Registra middlewares
- `app.listen()`: Inicia servidor en puerto especificado

---

### 2. **Rutas de Expedientes**
**Archivo:** `server/routes/expedientes.js`

```js
import express from 'express';
import { supabase } from '../services/supabaseClient.js';

const router = express.Router();

// GET /api/expedientes (listar todos del usuario)
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id; // De JWT middleware
    const { data, error } = await supabase
      .from('expedientes')
      .select('*')
      .eq('usuario_id', userId);
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/expedientes (crear nuevo)
router.post('/', async (req, res) => {
  try {
    const { titulo, materia, descripcion } = req.body;
    const userId = req.user.id;
    
    const { data, error } = await supabase
      .from('expedientes')
      .insert([{ titulo, materia, descripcion, usuario_id: userId }])
      .select();
    
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/expedientes/:id (actualizar)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cambios = req.body;
    
    const { data, error } = await supabase
      .from('expedientes')
      .update(cambios)
      .eq('id', id)
      .select();
    
    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/expedientes/:id (eliminar)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('expedientes')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    res.json({ message: 'Eliminado' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
```

**Métodos CRUD:**
- `.select()`: Lee datos
- `.insert()`: Crea registro
- `.update()`: Modifica registro
- `.delete()`: Elimina registro
- `.eq()`: Filtra por igualdad

---

### 3. **Rutas de IA (Gemini)**
**Archivo:** `server/routes/gemini.js`

```js
import express from 'express';
import { GoogleGenAI, FunctionCallingConfigMode } from '@google/genai';

const router = express.Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// POST /api/gemini/analizar-expediente
router.post('/analizar-expediente', async (req, res) => {
  try {
    const { contenido } = req.body;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analiza este expediente legal peruano:\n${contenido}\n\nProporciona: 1) Resumen, 2) Fortalezas, 3) Debilidades`,
      config: {
        systemInstruction: 'Eres un abogado peruano experto en litigación.',
      }
    });
    
    res.json({ analisis: response.text() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/gemini/redactar
router.post('/redactar', async (req, res) => {
  try {
    const { tipo, hechos, pretension } = req.body;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Redacta una ${tipo} judicial con los siguientes elementos:\nHechos: ${hechos}\nPretensión: ${pretension}`,
    });
    
    res.json({ escrito: response.text() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/gemini/predicción
router.post('/prediccion', async (req, res) => {
  try {
    const { hechos, jurisprudencia } = req.body;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Predice el resultado de este caso peruano basándote en jurisprudencia:\n${hechos}\n\nJurisprudencia: ${jurisprudencia}`,
    });
    
    res.json({ prediccion: response.text() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

**Métodos:**
- `ai.models.generateContent()`: Llama a Gemini
- `model: 'gemini-2.5-flash'`: Modelo rápido y accesible
- `systemInstruction`: Define el rol de la IA

---

### 4. **Autenticación JWT**
**Archivo:** `server/middleware/authMiddleware.js`

```js
import jwt from 'jsonwebtoken';

export function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Sin token' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Token inválido' });
  }
}

// Uso en rutas:
app.get('/api/expedientes', authMiddleware, async (req, res) => {
  // Solo usuarios autenticados pueden acceder
});
```

**Métodos:**
- `jwt.verify()`: Valida el token
- `jwt.sign()`: Crea nuevo token en login

---

## 🔶 Backend .NET Core (C#)

**Ubicación:** `LegalProBackend_Net/`  
**Responsable:** Usuario (exposición general)

### 1. **Arquitectura Clean Architecture**

```
LegalPro.Api/              → Capa de Presentación (Controllers)
LegalPro.Application/      → Lógica de aplicación (MediatR Commands/Queries)
LegalPro.Domain/           → Entidades de negocio (Models)
LegalPro.Infrastructure/   → Acceso a datos (Supabase, DB)
```

---

### 2. **Entity (Modelo de Dominio)**
**Archivo:** `LegalPro.Domain/Entities/Expediente.cs`

```csharp
public class Expediente
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Titulo { get; set; }
    public string Materia { get; set; } // penal, civil, laboral...
    public string Descripcion { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string Estado { get; set; } = "activo"; // activo, cerrado, archivo
}
```

**Métodos (Propiedades):**
- `get; set;`: Getters y Setters automáticos (C#)
- `DateTime.UtcNow`: Fecha servidor en UTC

---

### 3. **Queries con MediatR**
**Archivo:** `LegalPro.Application/Features/Expedientes/Queries/GetExpedientesQuery.cs`

```csharp
public class GetExpedientesQuery : IRequest<List<ExpedienteDto>>
{
    public Guid UserId { get; set; }
}

public class GetExpedientesQueryHandler : IRequestHandler<GetExpedientesQuery, List<ExpedienteDto>>
{
    private readonly IExpedienteRepository _repository;
    
    public GetExpedientesQueryHandler(IExpedienteRepository repository)
    {
        _repository = repository;
    }
    
    public async Task<List<ExpedienteDto>> Handle(GetExpedientesQuery request, CancellationToken cancellationToken)
    {
        var expedientes = await _repository.GetByUserIdAsync(request.UserId);
        return expedientes.Select(e => new ExpedienteDto
        {
            Id = e.Id,
            Titulo = e.Titulo,
            Materia = e.Materia
        }).ToList();
    }
}
```

**Patrón CQRS:**
- **Query**: Lectura (GET)
- **Command**: Escritura (POST/PUT/DELETE)
- **Handler**: Lógica ejecutable

**Métodos:**
- `IRequest<T>`: Define qué retorna la query
- `IRequestHandler`: Implementa la lógica
- `Handle()`: Método que ejecuta la lógica

---

### 4. **Commands para Crear/Actualizar**
**Archivo:** `LegalPro.Application/Features/Expedientes/Commands/CreateExpedienteCommand.cs`

```csharp
public class CreateExpedienteCommand : IRequest<Guid>
{
    public Guid UserId { get; set; }
    public string Titulo { get; set; }
    public string Materia { get; set; }
    public string Descripcion { get; set; }
}

public class CreateExpedienteCommandHandler : IRequestHandler<CreateExpedienteCommand, Guid>
{
    private readonly IExpedienteRepository _repository;
    
    public async Task<Guid> Handle(CreateExpedienteCommand request, CancellationToken cancellationToken)
    {
        var expediente = new Expediente
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            Titulo = request.Titulo,
            Materia = request.Materia,
            Descripcion = request.Descripcion
        };
        
        await _repository.AddAsync(expediente);
        await _repository.SaveChangesAsync();
        
        return expediente.Id;
    }
}
```

**Métodos:**
- `Guid.NewGuid()`: Genera ID único
- `AddAsync()`: Agrega a la base de datos
- `SaveChangesAsync()`: Persiste cambios

---

### 5. **Controller (API Endpoint)**
**Archivo:** `LegalPro.Api/Controllers/ExpedientesController.cs`

```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize] // Requiere JWT
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
        var userId = Guid.Parse(User.FindFirst("sub")?.Value);
        var query = new GetExpedientesQuery { UserId = userId };
        var result = await _mediator.Send(query);
        return Ok(result);
    }
    
    [HttpPost]
    public async Task<ActionResult> CreateExpediente(CreateExpedienteCommand command)
    {
        command.UserId = Guid.Parse(User.FindFirst("sub")?.Value);
        var id = await _mediator.Send(command);
        return CreatedAtAction(nameof(GetExpedientes), new { id });
    }
}
```

**Atributos:**
- `[ApiController]`: Indica que es un API REST
- `[Route]`: Define la ruta (GET /api/expedientes)
- `[HttpGet]`, `[HttpPost]`: Verbo HTTP
- `[Authorize]`: Requiere autenticación JWT

**Métodos:**
- `User.FindFirst("sub")`: Obtiene ID del usuario del JWT
- `_mediator.Send()`: Envía command/query a MediatR
- `Ok()`, `CreatedAtAction()`: Respuestas HTTP

---

### 6. **Servicio de Gemini en .NET**
**Archivo:** `LegalPro.Infrastructure/Services/GeminiService.cs`

```csharp
public class GeminiService : IGeminiService
{
    private readonly GoogleGenAI _ai;
    
    public GeminiService(string apiKey)
    {
        _ai = new GoogleGenAI(new() { ApiKey = apiKey });
    }
    
    public async Task<string> AnalizarExpediente(string contenido)
    {
        var response = await _ai.Models.GenerateContent(
            new CreateContentRequest
            {
                Model = "gemini-2.5-flash",
                Contents = new[]
                {
                    new Content
                    {
                        Parts = new[]
                        {
                            new Part { Text = $"Analiza este expediente:\n{contenido}" }
                        }
                    }
                }
            });
        
        return response.Candidates[0].Content.Parts[0].Text;
    }
}
```

**Métodos:**
- `GenerateContent()`: Llama a Gemini API
- `Candidates[0]`: Obtiene la primera respuesta
- `Parts[0].Text`: Extrae el texto de respuesta

---

## 🗄️ Base de Datos (Supabase PostgreSQL)

### Tablas Principales

```sql
-- Expedientes
CREATE TABLE expedientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES auth.users(id),
    titulo VARCHAR(255) NOT NULL,
    materia VARCHAR(50) NOT NULL,
    descripcion TEXT,
    estado VARCHAR(20) DEFAULT 'activo',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Documentos (evidencia)
CREATE TABLE documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID REFERENCES expedientes(id) ON DELETE CASCADE,
    nombre VARCHAR(255),
    url TEXT,
    tipo VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Jurisprudencia
CREATE TABLE jurisprudencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(255),
    contenido TEXT,
    materia VARCHAR(50),
    año INT,
    fuente VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Row Level Security (RLS)
```sql
-- Usuarios solo ven sus expedientes
ALTER TABLE expedientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_ven_propios_expedientes"
ON expedientes FOR SELECT
USING (auth.uid() = usuario_id);

CREATE POLICY "usuarios_crean_propios_expedientes"
ON expedientes FOR INSERT
WITH CHECK (auth.uid() = usuario_id);
```

**Métodos RLS:**
- `auth.uid()`: Obtiene ID del usuario autenticado
- `USING`: Condición para SELECT/DELETE
- `WITH CHECK`: Condición para INSERT/UPDATE

---

## 🔐 Flujo de Autenticación

```
1. Usuario login (email + password)
           ↓
2. Supabase Auth verifica credenciales
           ↓
3. Retorna JWT token + refresh_token
           ↓
4. Frontend guarda token en localStorage
           ↓
5. Cada request incluye: Authorization: Bearer <JWT>
           ↓
6. Backend valida JWT con JWT_SECRET
           ↓
7. Si válido → Procesa request
   Si no → 401 Unauthorized
```

---

## 📈 Flujo de Datos (Completo)

```
┌─────────────────┐
│  App Frontend   │
│  (React)        │
└────────┬────────┘
         │ HTTP Request (JSON)
         │ Authorization: Bearer JWT
         ↓
┌─────────────────────┐
│  Backend Express    │
│  /api/expedientes   │
└────────┬────────────┘
         │ 
         ├─ JWT validation ✓
         │
         └─ Call Supabase
              ↓
┌─────────────────────┐
│  Supabase Cloud     │
│  PostgreSQL + RLS   │
└────────┬────────────┘
         │ JSON Response
         ↓
┌─────────────────────┐
│ Response to Client  │
│ 200 OK + Data       │
└─────────────────────┘
```

---

## 🚀 Variables de Entorno Necesarias

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Gemini IA
GEMINI_API_KEY=AIza...

# JWT
JWT_SECRET=super-secret-key-256-bits-min

# Server
PORT=3000
NODE_ENV=production

# .NET
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__DefaultConnection=Host=db.supabase.co;...
```

---

## 🔄 Métodos Reutilizables (Patrón Repository)

```js
// repository.js
export class BaseRepository {
  constructor(tableName) {
    this.table = tableName;
  }
  
  async getAll() { return supabase.from(this.table).select(); }
  async getById(id) { return supabase.from(this.table).select().eq('id', id); }
  async create(data) { return supabase.from(this.table).insert([data]); }
  async update(id, data) { return supabase.from(this.table).update(data).eq('id', id); }
  async delete(id) { return supabase.from(this.table).delete().eq('id', id); }
}

// expedienteRepository.js
export class ExpedienteRepository extends BaseRepository {
  constructor() { super('expedientes'); }
}
```

Esto evita repetir código y mantiene consistencia.

---

## ✅ Checklist de Deployment

- [ ] Variables de entorno configuradas en Railway
- [ ] PostgreSQL en Supabase ligado
- [ ] Gemini API Key activa
- [ ] JWT_SECRET definido (256 bits)
- [ ] CORS configurado correctamente
- [ ] HTTPS habilitado
- [ ] Rate limiting implementado
- [ ] Logging en producción
- [ ] Health checks activos
- [ ] Monitoreo de errores configurado

