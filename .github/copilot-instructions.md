# LegalPro - Instrucciones del Proyecto

## Contexto del Proyecto

**LegalPro** es una plataforma integral de asistencia legal para abogados, fiscales y jueces peruanos, potenciada por IA (Google Gemini). Es una **aplicación móvil nativa** (Android) con backend en la nube. Incluye gestión de expedientes, simulación de juicios, redacción de escritos legales, predicción de resultados judiciales, búsqueda de jurisprudencia en tiempo real y más.

## Arquitectura Cloud-Native

```
┌─────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│  Android App    │────▶│  Backend (Railway)    │────▶│  Supabase Cloud  │
│  Kotlin/Compose │     │  Express 5 / .NET 8   │     │  PostgreSQL + Auth│
│  (Mobile-first) │     │  + Gemini SDK         │     │  + Storage + RLS │
└─────────────────┘     └──────────────────────┘     └──────────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │ Google Gemini │
                        │ @google/genai │
                        │ Function Call │
                        └──────────────┘
```

## Stack Tecnológico

| Capa              | Tecnología                                                                  |
| ----------------- | --------------------------------------------------------------------------- |
| **Mobile App**    | Kotlin + Jetpack Compose + Hilt DI + Coroutines + Retrofit                  |
| **Backend API**   | Express 5 (Railway) + Supabase Client + JWT                                 |
| **Backend .NET**  | ASP.NET Core 8 (Railway) + Supabase/PostgreSQL + MediatR + FluentValidation |
| **Base de Datos** | PostgreSQL en Supabase Cloud (RLS + Auth + Realtime)                        |
| **IA**            | Google Gemini SDK oficial (`@google/genai`) con Function Calling            |
| **Storage**       | Supabase Storage (documentos, evidencia digital)                            |
| **Auth**          | Supabase Auth (JWT) + bcrypt                                                |
| **Infra**         | Railway (backends) + Supabase (BaaS) — 100% cloud                           |

## Estructura del Proyecto

```
legalpro-app/          → Backend Express API (se despliega en Railway)
LegalProBackend_Net/   → Backend .NET API (se despliega en Railway)
LegalProAndroid/       → App Android nativa (app principal para usuarios)
*.html (26 módulos)    → Prototipos HTML standalone
```

## Reglas de Código

1. **Idioma**: Código en inglés, comentarios y UI en español
2. **Mobile-first**: La app principal es Android nativa con Jetpack Compose
3. **Backend Node**: Express 5 en Railway, Supabase como BD cloud, rutas en `server/routes/`
4. **Backend .NET**: Clean Architecture (Domain → Application → Infrastructure → Api) en Railway
5. **CQRS**: MediatR (Commands escritura, Queries lectura) en .NET
6. **IA**: SDK oficial `@google/genai` con Function Calling declarativo y `gemini-2.5-flash`
7. **Base de datos**: PostgreSQL en Supabase Cloud con Row Level Security (RLS)
8. **Auth**: Supabase Auth para autenticación, JWT para API tokens
9. **Storage**: Supabase Storage para documentos y evidencia digital
10. **Seguridad**: RLS en todas las tablas, JWT validation, bcrypt, nunca exponer API keys
11. **Realtime**: Supabase Realtime para notificaciones push y presencia

## SDK de Google Gemini (Oficial `@google/genai`)

```javascript
import { GoogleGenAI, FunctionCallingConfigMode, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'Analiza este expediente...',
  config: {
    tools: [{ functionDeclarations: [...] }],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.AUTO,
      }
    }
  }
});
```

## Supabase Client

```javascript
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

// Queries con RLS
const { data, error } = await supabase
  .from("expedientes")
  .select("*")
  .eq("usuario_id", userId);
```

## Herramientas por Rol

### ABOGADO (Abogado Litigante)

- Gestión de expedientes (CRUD completo)
- Redacción de escritos legales con IA (demandas, apelaciones, recursos)
- Búsqueda de jurisprudencia en tiempo real
- Simulador de juicios interactivo
- Predictor de resultados judiciales
- Generador de alegatos de clausura
- Estrategia de interrogatorio (NCPP)
- Asistente de objeciones en vivo
- Monitor de notificaciones SINOE
- Cálculo automático de plazos procesales
- Bóveda de evidencia digital segura
- Resumen ejecutivo de caso con IA
- Chat IA legal contextual

### FISCAL (Representante del Ministerio Público)

- Dashboard de fiscalía con métricas
- Gestión de casos penales
- Redacción de requerimientos fiscales con IA
- Análisis de expedientes penales
- Generador de acusación fiscal
- Estrategia de interrogatorio (NCPP)
- Predictor de sentencias penales
- Búsqueda de jurisprudencia penal
- Monitor SINOE para notificaciones
- Simulador de juzgamiento

### JUEZ (Magistrado)

- Dashboard judicial con carga procesal
- Análisis de expedientes para resolución
- Comparador de precedentes vinculantes
- Asistente para redacción de resoluciones
- Predictor de tendencias judiciales
- Búsqueda de jurisprudencia vinculante
- Cálculo de plazos y prescripción
- Herramientas de conciliación

### CONTADOR (Perito Contable)

- Cálculo de liquidaciones laborales
- Generación de informes periciales
- Análisis de estados financieros para casos
- Cálculo de intereses legales
- Herramientas multidisciplinarias

## Contexto Legal Peruano

- Código Procesal Civil (CPC), Nuevo Código Procesal Penal (NCPP)
- SINOE (Sistema de Notificaciones Electrónicas del PJ)
- INDECOPI (Instituto Nacional de Defensa de la Competencia)
- SUNARP (Registros Públicos), CEJ (Consulta de Expedientes Judiciales)
- Roles: ABOGADO, JUEZ, FISCAL, CONTADOR
- Áreas: Penal, Civil, Laboral, Constitucional, Familia, Administrativo

## Comandos de Desarrollo

```bash
# Backend Node (local → deploy en Railway)
cd legalpro-app && npm install && npm run dev

# Backend .NET (local → deploy en Railway)
cd LegalProBackend_Net && dotnet restore && dotnet run --project LegalPro.Api

# Android
cd LegalProAndroid && ./gradlew assembleDebug
```

## Variables de Entorno (Railway + Supabase)

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# Gemini IA
GEMINI_API_KEY=AIza...

# JWT
JWT_SECRET=super-secret-key-256-bits

# Railway
PORT=3000
NODE_ENV=production
```

## Agentes Disponibles

Ver `.github/AGENTS_GUIDE.md` para la guía completa de 13 agentes y 8 skills especializados.

## Herramientas MCP Disponibles

- `#tool:context7` — Documentación actualizada de librerías (Gemini SDK, Supabase, etc.)
- `#tool:fetch` — Peticiones HTTP externas
