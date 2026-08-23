# REPORTE OLEADA 3 — Migración OPENCODE-FIRST (Limpieza Final)

> **Fecha:** 1 de agosto de 2026
> **Estado:** ✅ MIGRACIÓN COMPLETA — Gemini eliminado del código activo

---

## 🎯 Resumen de la Oleada 3

La tercera oleada completó la **limpieza total del frontend**, la **eliminación del alias `/api/gemini`**, la **centralización de proveedores IA** y el **plan de self-hosting MiMo V2.5**.

---

## 📦 Implementado en esta Oleada

### 1. Frontend migrado (14 archivos → 0 menciones Gemini visibles)

| Archivo | Reemplazo clave |
|---------|-----------------|
| `ChatIA.jsx` | "Asistente legal · Gemini" → "DeepSeek V4 Flash" |
| `Herramientas.jsx` | "potenciada por Gemini AI" → "DeepSeek V4 Flash con Function Calling" |
| `PredictorJudicial.jsx` | "Analizando con Gemini" → "Analizando con DeepSeek V4 Flash" |
| `AsistenteObjeciones.jsx` | "Análisis Gemini" → "Análisis IA" |
| `BuscadorJurisprudencia.jsx` | "Análisis Gemini" → "Análisis IA" |
| `ComparadorPrecedentes.jsx` | "Comparar con Gemini" → "Comparar con IA" |
| `EstrategiaInterrogatorio.jsx` | "Analizando con Gemini" → "DeepSeek V4 Flash" |
| `GeneradorAlegatos.jsx` | "IA Gemini" → "IA DeepSeek V4 Flash" |
| `ResumenEjecutivo.jsx` | badge "Gemini" → "DeepSeek V4 Flash" |
| `SimuladorJuicios.jsx` | "Análisis IA Gemini" → "DeepSeek V4 Flash" |
| `AnalistaExpedientes.jsx` | badge "Gemini 2.0" → "DeepSeek V4 Flash" |
| `OnboardingTour.jsx` | "con Google Gemini" → "con DeepSeek V4 Flash" |
| `Perfil.jsx` | "Transferencia Internacional (Gemini)" → "(IA)" |
| `SignupPage.jsx` | Consentimiento: "transferencia a Google Gemini" → "a proveedores de IA (DeepSeek vía OpenCode Go)" |

**✅ Build exitoso (3020 módulos, 10.87s)**
**✅ Consentimiento LPDP Art. 21 actualizado (falsa declaración evitada)**

### 2. Alias `/api/gemini` ELIMINADO

- `server/index.js`: eliminado `app.use('/api/gemini', ...)`
- **10 archivos de test/e2e actualizados** (`panel-expertos`, `organizaciones-journey`, `prod-node`, `exhaustive-journey`, `auth-journey`, `smoke`, `expedientes-journey`, `resilience.spec`, `journey-completo.spec`, `herramientas-ia.spec`)
- **79 referencias migradas** `/api/gemini` → `/api/ai`
- **✅ Verificado: 0 referencias al alias en tests/e2e/smoke**

### 3. Librería centralizada IA providers

- **`src/lib/iaProviders.js`** (creado) — single source of truth:
  - `opencode` → DeepSeek V4 Flash (principal)
  - `opencode-vision` → MiMo V2.5
  - `minimax` → fallback
  - `gemini` → **legacy: true** (deprecated, para trazabilidad)
  - `self_hosted` → IA local
- **`src/components/legal/ProviderBadge.jsx`** (creado) — badge reutilizable
- **6 archivos refactorizados** para usar la librería (AIAssistantPanel, ChatIA, AnalistaExpedientes, GeneradorAlegatos, ResumenEjecutivo, RedactorEscritos)
- **✅ Build exitoso (3020 módulos, 12.38s)**

### 4. Plan Self-Hosting MiMo V2.5

- **`docs/PLAN_SELFHOST_MIMO.md`** (creado) — 3 fases, hardware, vLLM/Ollama, costos, break-even
- **`visionClient.js`** actualizado: soporta `MIMO_VISION_SELF_HOSTED=true` → `provider: self_hosted`
- **`disclaimers-ia.json`**: agregado `self_hosted` como proveedor sin transferencia internacional
- **✅ Beneficio LPDP: self-hosting elimina transferencia internacional para visión**

---

## ✅ Verificación Final

| Check | Resultado |
|-------|-----------|
| Menciones "Gemini" visibles en 14 páginas migradas | ✅ 0 |
| Alias `/api/gemini` en server/ | ✅ 0 (solo comentario legacy en routes/ai.js) |
| Referencias `/api/gemini` en tests/e2e | ✅ 0 |
| Build frontend | ✅ Exitosa |
| Mapeo Gemini | ✅ Solo `legacy: true` en iaProviders.js (trazabilidad) |

---

## 🎯 Estado Final Completo (3 oleadas)

| Componente | Estado |
|-----------|:---:|
| Cliente DeepSeek V4 Flash | ✅ |
| Cliente MiMo V2.5 (visión) | ✅ |
| Provider Router | ✅ |
| Alias `/api/gemini` eliminado | ✅ |
| 14 archivos frontend migrados | ✅ |
| Librería centralizada IA | ✅ |
| Tests OPENCODE (14) | ✅ 100% PASS |
| Verificador (19 checks) | ✅ 19/19 |
| Catálogos limpiados | ✅ 0 rastros |
| Imágenes Docker v1.0.1-opencode | ✅ Publicadas |
| Plan self-host MiMo | ✅ |

**Gemini ELIMINADO del código activo.** Solo queda como `legacy: true` en el mapeo centralizado (para compatibilidad/trazabilidad) y en comentarios de documentación.

---

## ⚠️ Pendientes menores (opcionales)

1. `GestionMultidoc.jsx` (OCR) — verificar si muestra "Gemini" (fuera del alcance de 14 archivos)
2. `RedactorEscritos.jsx` — decide si debe mostrar `opencode` en vez de `minimax`
3. Emoji corrupto en `SignupPage.jsx:175` (preexistente, accesibilidad)
4. Ejecutar Fase 1 del self-host MiMo (POC con vLLM)

---

**Generado por:** `lexia-orchestrator` + 4 subagentes especializados en paralelo (Oleada 3)
**Fecha:** 1 de agosto de 2026
**Total subagentes en la migración OPENCODE:** 16 (3 oleadas)

> **Disclaimer IA:** La migración está completa. Requiere obtener API key de OpenCode Go y configurarla en Railway para activar DeepSeek V4 Flash en producción. El self-hosting de MiMo V2.5 es opcional pero recomendado para eliminar la transferencia internacional de visión.