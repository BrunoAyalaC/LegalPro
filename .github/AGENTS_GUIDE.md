# LegalPro — Guía de Agentes y Skills

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

---

## 14 Agentes Especializados

| #   | Agente            | Comando          | Especialidad                                       |
| --- | ----------------- | ---------------- | -------------------------------------------------- |
| 1   | **Arquitecto**    | `@Arquitecto`    | Diseño de sistema, ADRs, evaluación técnica        |
| 2   | **Planner**       | `@Planner`       | Planificación, desglose de tareas, roadmaps        |
| 3   | **Frontend**      | `@Frontend`      | React prototipos web (NO la app principal)         |
| 4   | **BackendNode**   | `@BackendNode`   | Express 5, Supabase Client, Railway                |
| 5   | **BackendDotNet** | `@BackendDotNet` | ASP.NET Core 8, CQRS, MediatR, Railway             |
| 6   | **Android**       | `@Android`       | **App principal**: Kotlin, Compose, Hilt, Retrofit |
| 7   | **IALegal**       | `@IALegal`       | Gemini SDK `@google/genai`, Function Calling       |
| 8   | **Debug**         | `@Debug`         | Depuración multi-stack (Android+Railway+Supabase)  |
| 9   | **Database**      | `@Database`      | Supabase PostgreSQL, RLS, Auth, Storage, Realtime  |
| 10  | **Seguridad**     | `@Seguridad`     | OWASP, RLS, JWT, auditoría                         |
| 11  | **DevOps**        | `@DevOps`        | Railway deploy, Docker, CI/CD, env vars            |
| 12  | **Testing**       | `@Testing`       | Vitest, xUnit, Compose Testing, mocks              |
| 13  | **DominioLegal**  | `@DominioLegal`  | Derecho peruano, normativa, herramientas por rol   |
| 14  | **Contador**      | `@Contador`      | Contabilidad peruana, liquidaciones, pericias      |

---

## 8 Skills Especializados

| #   | Skill                     | Cuándo usar                                             |
| --- | ------------------------- | ------------------------------------------------------- |
| 1   | **crear-endpoint**        | Nuevo endpoint REST (Express o .NET) con Supabase       |
| 2   | **crear-pagina**          | Nueva pantalla Android (Compose + MVVM + Hilt)          |
| 3   | **generar-escrito-legal** | Escribir demandas, apelaciones, resoluciones con Gemini |
| 4   | **configurar-gemini**     | Setup/debug del SDK `@google/genai`, function calling   |
| 5   | **deploy-backend**        | Desplegar a Railway (Node o .NET)                       |
| 6   | **migrar-base-datos**     | Crear tablas, RLS policies en Supabase PostgreSQL       |
| 7   | **simulacion-juicio**     | Simulador interactivo de juicios con Gemini IA          |
| 8   | **analizar-expediente**   | Análisis de expedientes judiciales con IA               |

---

## 3 Instructions (Auto-aplicados)

| Archivo                           | Se aplica a                      | Reglas                               |
| --------------------------------- | -------------------------------- | ------------------------------------ |
| `android-compose.instructions.md` | `LegalProAndroid/**/*.kt`        | MVVM, Hilt, Compose, Sealed classes  |
| `dotnet-cqrs.instructions.md`     | `LegalProBackend_Net/**/*.cs`    | Clean Architecture, CQRS, PostgreSQL |
| `legal-prompts.instructions.md`   | `**/services/gemini*.{js,ts,cs}` | SDK `@google/genai`, prompts legales |

---

## Herramientas por Rol de Usuario

### ABOGADO (13 herramientas)

Gestión expedientes, Redactor escritos IA, Buscador jurisprudencia, Simulador juicios, Predictor judicial, Alegatos de clausura, Interrogatorio NCPP, Objeciones en vivo, Monitor SINOE, Plazos procesales, Bóveda evidencia, Resumen ejecutivo, Chat IA legal

### FISCAL (10 herramientas)

Dashboard fiscalía, Casos penales, Requerimientos fiscales IA, Análisis expedientes, Acusación fiscal, Interrogatorio NCPP, Predictor sentencias, Jurisprudencia penal, Monitor SINOE, Simulador juzgamiento

### JUEZ (8 herramientas)

Dashboard judicial, Análisis resolución, Comparador precedentes, Redacción resoluciones, Predictor tendencias, Jurisprudencia vinculante, Plazos/prescripción, Conciliación

### CONTADOR (5 herramientas)

Liquidaciones laborales, Informes periciales, Estados financieros, Intereses legales, Herramientas multidisciplinarias

---

## Flujo de Trabajo Recomendado

```
¿Necesitas planificar?     → @Planner
¿Decisión arquitectónica?  → @Arquitecto
¿Pantalla Android?         → @Android (skill: crear-pagina)
¿Endpoint API?             → @BackendNode o @BackendDotNet (skill: crear-endpoint)
¿Integrar Gemini IA?       → @IALegal (skill: configurar-gemini)
¿Base de datos?            → @Database (skill: migrar-base-datos)
¿Deploy a producción?      → @DevOps (skill: deploy-backend)
¿Bug o error?              → @Debug
¿Seguridad?                → @Seguridad
¿Tests?                    → @Testing
¿Consulta legal?           → @DominioLegal
¿Cálculos contables?       → @Contador
¿Prototipo web?            → @Frontend
```

---

## Gemini Function Calling (Búsqueda en Tiempo Real)

| Función                 | Qué busca                | Dónde busca                            |
| ----------------------- | ------------------------ | -------------------------------------- |
| `buscar_jurisprudencia` | Sentencias y precedentes | Supabase: `jurisprudencia`             |
| `analizar_expediente`   | Datos del caso           | Supabase: `expedientes` + `documentos` |
| `redactar_escrito`      | Genera documentos        | Gemini generativo                      |
| `calcular_plazos`       | Plazos procesales        | Reglas CPC/NCPP hardcoded              |
| `predecir_resultado`    | Probabilidad de éxito    | Supabase: precedentes similares        |
| `generar_estrategia`    | Plan de acción legal     | Gemini + contexto del caso             |
| `consultar_norma`       | Artículos legales        | Supabase: `base_legal_vectorial`       |

**Flujo**: Gemini decide función → Backend Railway ejecuta → Query Supabase → Resultado vuelve a Gemini → Respuesta contextualizada al usuario

---

## Estructura de Archivos

```
.github/
├── copilot-instructions.md          → Instrucciones globales del proyecto
├── AGENTS_GUIDE.md                  → Esta guía
├── agents/
│   ├── arquitecto.agent.md
│   ├── planner.agent.md
│   ├── frontend.agent.md
│   ├── backend-node.agent.md
│   ├── backend-dotnet.agent.md
│   ├── android.agent.md            → APP PRINCIPAL
│   ├── ia-legal.agent.md
│   ├── debug.agent.md
│   ├── database.agent.md
│   ├── seguridad.agent.md
│   ├── devops.agent.md
│   ├── testing.agent.md
│   ├── dominio-legal.agent.md
│   └── contador.agent.md
├── skills/
│   ├── crear-endpoint/SKILL.md
│   ├── crear-pagina/SKILL.md       → Pantallas Android (no React)
│   ├── generar-escrito-legal/SKILL.md
│   ├── configurar-gemini/SKILL.md
│   ├── deploy-backend/SKILL.md
│   ├── migrar-base-datos/SKILL.md
│   ├── simulacion-juicio/SKILL.md
│   └── analizar-expediente/SKILL.md
└── instructions/
    ├── android-compose.instructions.md
    ├── dotnet-cqrs.instructions.md
    └── legal-prompts.instructions.md
```
