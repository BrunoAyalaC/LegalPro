# Transferencia Internacional de Datos Personales

**Documento:** Transferencia Internacional de Datos — LegalPro  
**Fecha de emisión:** 04 de mayo de 2026 (v1.0) / 16 de julio de 2026 (v2.0 - Migración MiniMax) / 01 de agosto de 2026 (v2.1 - Etiquetado consistente de proveedores IA, FIX LPDP-2) / 06 de agosto de 2026 (v3.0 - Migración a OpenCode Go / DeepSeek V4 Flash + Xiaomi MiMo V2.5, Gemini eliminado)  
**Vigencia:** Hasta nueva versión  
**Marco legal aplicable:** Ley N° 29733 — Ley de Protección de Datos Personales (LPDP), Art. 21 y DS 003-2013-JUS

---

## 1. Identificación de las partes

| Rol | Entidad | Datos de contacto |
|-----|---------|-------------------|
| **Responsable del tratamiento** | LegalPro (Razón social por definir) | legal@legalpro.pe |
| **Encargado del tratamiento (IA Principal — texto)** | DeepSeek AI (Hangzhou DeepSeek Information Technology Co., Ltd.), consumido vía **OpenCode Go** | platform.deepseek.com / soporte OpenCode Go |
| **Encargado del tratamiento (IA Visión)** | Xiaomi **MiMo V2.5** — modelo open source (Apache 2.0). Puede ejecutarse **self-hosted** (sin transferencia internacional) o vía proveedor de inferencia externo. | github.com/XiaomiMiMo |
| **Encargado del tratamiento (IA Fallback/Legacy)** | MiniMax AI (Shanghai MiniMax Information Technology Co., Ltd.) | support@minimaxi.com |
| **Subencargados** | Railway (hosting), Supabase (base de datos) | Ver contratos de servicio respectivos |

> **Nota v3.0 (06-ago-2026):** LegalPro migró su proveedor principal de IA de Google Gemini (eliminado definitivamente el 01-ago-2026) a **OpenCode Go / DeepSeek V4 Flash** para texto y **Xiaomi MiMo V2.5** para visión. El etiquetado explícito del proveedor por solicitud se mantiene conforme al principio de transparencia activa del Art. 21 LPDP (ver sección 9).

---

## 2. Descripción de la transferencia

### 2.1 País destino
- **China (continental)** — Servidores de DeepSeek AI (Hangzhou), consumidos vía OpenCode Go (proveedor principal de texto)
- **China (continental)** — Sede de Xiaomi; aplica solo si MiMo V2.5 se sirve vía proveedor de inferencia externo. **Si MiMo V2.5 se ejecuta self-hosted (open source), NO existe transferencia internacional.**
- **China (continental) / Singapur** — Servidores de MiniMax AI (proveedor fallback/legacy)
- **NOTA:** China no es un país considerado con nivel adecuado de protección por la LPDP ni por la normativa europea. Se requieren garantías adicionales para todos los proveedores con sede en China. Google Gemini (EE.UU.) fue **eliminado definitivamente** el 01-ago-2026 y ya no es destino de datos.

### 2.2 Tipo de datos transferidos
- Prompts de usuario (consultas legales, hechos de casos)
- Contenido de documentos legales (demandas, alegatos, escritos)
- Historial de chat con el asistente IA (Lex-IA)
- Metadata contextual de expedientes (sin datos de identificación directa cuando sea técnicamente posible)

### 2.3 Finalidad de la transferencia
Generación de borradores legales, análisis predictivo judicial, redacción de escritos, alegatos de clausura, estrategias de interrogatorio y asistencia legal automatizada mediante inteligencia artificial, utilizando los siguientes proveedores:

- **Proveedor principal (texto):** DeepSeek V4 Flash (DeepSeek AI), consumido vía **OpenCode Go** — usado por defecto en la mayoría de flujos.
- **Proveedor de visión:** Xiaomi MiMo V2.5 (open source) — usado para procesamiento de imágenes/documentos escaneados. Puede ser self-hosted (sin transferencia) o vía proveedor externo.
- **Proveedor fallback/legacy:** MiniMax M3 (Shanghai MiniMax Information Technology Co., Ltd.) — usado como respaldo en flujos heredados.

La asignación del proveedor por solicitud es registrada en el log de auditoría y devuelta al cliente como metadato `provider` en la respuesta JSON para garantizar trazabilidad (ver sección 9).

### 2.4 Medio de transferencia
- Conexión cifrada TLS 1.3 en tránsito
- Tokens de autenticación temporales (API keys rotadas periódicamente)
- Sin almacenamiento persistente de prompts por parte de LegalPro en servidores propios (salvo historial de chat con consentimiento explícito)

---

## 3. Base legal de la transferencia

Según el **Artículo 21 de la Ley N° 29733 (LPDP)**, la transferencia internacional de datos personales a países que no proporcionen un nivel adecuado de protección requiere:

1. **Consentimiento expreso e informado del titular** ✅  
   El usuario acepta expresamente la transferencia durante el registro en LegalPro mediante checkbox específico:  
   > *"Acepto que mis datos sean transferidos a proveedores de Inteligencia Artificial (DeepSeek V4 Flash con sede en China, consumido vía OpenCode Go; y, en su caso, Xiaomi MiMo V2.5 para visión y MiniMax M3 como respaldo) para el procesamiento de IA, conforme a la Política de Privacidad. China no cuenta con un nivel de protección equivalente al peruano, por lo que otorgo mi consentimiento explícito e informado conforme al Art. 21 de la LPDP. El modelo de visión MiMo V2.5 puede ejecutarse self-hosted, caso en el cual no existe transferencia internacional."*

2. **Cláusulas contractuales tipo** ✅  
   Los proveedores externos operan bajo contratos de procesamiento de datos (DPA) que incluyen cláusulas contractuales tipo:
   - **DeepSeek (vía OpenCode Go):** DPA de OpenCode Go + cláusulas tipo y garantías adicionales por la ubicación en China (en proceso de verificación formal).
   - **Xiaomi MiMo V2.5:** al ser open source, el despliegue self-hosted no requiere DPA de transferencia. Si se usa vía proveedor de inferencia externo, se suscribirá DPA de dicho proveedor.
   - **MiniMax AI:** DPA con cláusulas tipo + garantías adicionales por la ubicación en China.

3. **Certificaciones de nivel de protección** ⚠️  
   - **DeepSeek AI (vía OpenCode Go)** — certificaciones en proceso de verificación formal con OpenCode Go (se exigirá ISO 27001 y evidencias de controles de seguridad de datos en China antes del go-live definitivo).
   - **Xiaomi MiMo V2.5 (self-hosted)** — no aplica certificación de transferencia: los datos nunca salen de la infraestructura de LegalPro (Railway/Supabase). Se aplica hardening del contenedor y cifrado en reposo propio.
   - **MiniMax AI (fallback/legacy)** cuenta con:
     - ISO 27001 (Sistema de Gestión de Seguridad de la Información)
     - Certificaciones de seguridad de datos en China (MLPS - Multi-Level Protection Scheme)
     - **No cuenta** con certificación EU-US Data Privacy Framework ni SOC 2 Type II.
   - **Medida adicional para todos:** Se implementa cifrado extremo a extremo (E2EE) para datos sensibles antes de la transferencia.
   - **Medida adicional para todos:** Política de no retención de prompts después del procesamiento.
   - **Google Cloud (Gemini) fue dado de baja:** certificaciones y DPA de Google ya no aplican (proveedor eliminado el 01-ago-2026).

---

## 4. Medidas de seguridad implementadas

| Medida | Descripción |
|--------|-------------|
| **Cifrado en tránsito** | TLS 1.3 para todas las comunicaciones entre LegalPro ↔ OpenCode Go / proveedores IA |
| **Cifrado en reposo** | Datos almacenados en PostgreSQL (Supabase) con cifrado de columna para datos sensibles usando `pgcrypto` |
| **Tokens temporales** | API keys de OpenCode Go con rotación programada. Sin exposición en frontend. |
| **Sin almacenamiento persistente de prompts** | Los prompts enviados a los proveedores IA NO se almacenan en servidores propios. Solo se guarda historial de chat con consentimiento explícito. |
| **Pseudonimización** | Cuando sea técnicamente posible, los nombres de partes se reemplazan por IDs antes de enviar al proveedor IA. |
| **E2EE para datos sensibles** | Cifrado extremo a extremo (AES-256-GCM) antes de la transferencia a proveedores externos para datos especialmente sensibles. |
| **Self-hosting de visión** | MiMo V2.5 (open source) puede ejecutarse en la infraestructura de LegalPro, eliminando la transferencia internacional para el flujo de visión. |
| **Control de acceso** | RBAC (Role-Based Access Control) en todos los endpoints. Acceso restringido por organización. |
| **Auditoría** | Registro de logs de acceso a datos y uso de IA en `audit_log`. |

---

## 5. Derechos del titular de los datos

Conforme a los derechos ARCO (Acceso, Rectificación, Cancelación, Oposición) establecidos en los Arts. 13-16 de la LPDP, el titular puede:

1. **Acceso:** Solicitar información sobre qué datos personales están siendo transferidos.
2. **Rectificación:** Corregir datos inexactos o desactualizados.
3. **Cancelación:** Solicitar la eliminación de sus datos de los sistemas de LegalPro y, en la medida de lo posible, de los subencargados.
4. **Oposición:** Oponerse al tratamiento de sus datos para fines de procesamiento de IA.

### Mecanismos para ejercer derechos
- **Módulo "Mis Datos"** en la plataforma LegalPro (próximamente disponible en Fase 1)
- **Email del Encargado de Protección de Datos (EPD):** privacidad@legalpro.pe
- **Plazo de respuesta:** 10 días hábiles conforme al DS 003-2013-JUS

---

## 6. Tiempo de conservación de los datos transferidos

| Tipo de dato | Tiempo de conservación en subencargado |
|--------------|----------------------------------------|
| Prompts procesados por DeepSeek V4 Flash (vía OpenCode Go) | No almacenados persistentemente por LegalPro. Se exige política de no retención de prompts a OpenCode Go/DeepSeek; logs de seguridad limitados al mínimo legal. |
| Prompts procesados por Xiaomi MiMo V2.5 (self-hosted) | No aplica transferencia: los datos permanecen en la infraestructura de LegalPro (Railway/Supabase) bajo las políticas propias de retención. |
| Prompts procesados por Xiaomi MiMo V2.5 (vía proveedor externo) | No almacenados persistentemente por LegalPro. Se exige DPA y política de no retención del proveedor de inferencia. |
| Prompts procesados por MiniMax M3 (fallback legacy) | No almacenados persistentemente por LegalPro. MiniMax puede retener logs de seguridad por hasta 18 meses según sus políticas. Se ha solicitado política de no retención contractual. |
| Prompts procesados por Google Gemini | **Dado de baja (01-ago-2026).** Ya no existe procesamiento de datos hacia Google. |
| Historial de chat | 1 año en LegalPro (con consentimiento). El usuario puede eliminarlo en cualquier momento. |
| Documentos generados | Durante la relación contractual + 2 años para cumplimiento legal. |

---

## 7. Contacto y consultas

Para cualquier consulta relacionada con esta transferencia internacional de datos:

- **Encargado de Protección de Datos (EPD):** privacidad@legalpro.pe
- **Dirección física:** [Por definir — Lima, Perú]
- **Teléfono:** [Por definir]

Para consultas sobre el tratamiento de datos por parte de los proveedores de IA:

- **OpenCode Go (DeepSeek V4 Flash):** soporte del servicio OpenCode Go + https://platform.deepseek.com/privacy
- **Xiaomi MiMo V2.5 (open source):** https://github.com/XiaomiMiMo (self-hosted no requiere contacto de transferencia)
- **MiniMax Support:** support@minimaxi.com
- **MiniMax DPO/Privacy:** https://platform.minimaxi.com/privacy
- **Google Cloud Privacy:** ~~https://cloud.google.com/privacy~~ (proveedor eliminado — referencia histórica)

---

## 8. Proveedores de Inteligencia Artificial

LegalPro utiliza los siguientes proveedores de IA para asistir en funciones legales. **Cada respuesta de la aplicación etiqueta explícitamente el proveedor usado**, conforme al principio de transparencia activa (LPDP Art. 21 y principio de información, Arts. 12-13).

### 8.1 DeepSeek V4 Flash vía OpenCode Go (Proveedor Principal — Texto)

- **Empresa:** DeepSeek AI (Hangzhou DeepSeek Information Technology Co., Ltd.) — consumido a través del servicio **OpenCode Go**.
- **Sede:** China (Hangzhou).
- **Propósito:** Generación de texto, análisis de expedientes, redacción de escritos legales, alegatos de clausura, estrategias de interrogatorio, predictor judicial, panel de expertos, embeddings, RAG. (Visión se delega a MiMo V2.5).
- **Datos transferidos:** Prompts del usuario, contexto del expediente (número, título, tipo, estado, OCR), historial de chat reciente (últimos 20 turnos), metadatos de uso.
- **NO se transfiere (sin cifrado):** Datos personales identificables directos (DNI, email, teléfono) cuando es técnicamente posible pseudonimizarlos.
- **Base legal:** Consentimiento expreso del usuario (Art. 21 LPDP).
- **DPA firmado:** Sí (DPA de OpenCode Go + cláusulas contractuales tipo; verificación de certificaciones en curso).
- **Ubicación del DPA:** Confidencial — disponible para la ANPDP bajo requerimiento.
- **Variable de entorno:** `OPENCODE_API_KEY`, `OPENCODE_MODEL_DEFAULT=deepseek-v4-flash` (model ID: `opencode-go/deepseek-v4-flash`).

### 8.2 Xiaomi MiMo V2.5 (Proveedor de Visión)

- **Empresa:** Xiaomi — modelo **open source** (licencia Apache 2.0), publicable/descargable desde el repositorio oficial de Xiaomi.
- **Sede:** China (desarrollo). Despliegue: **self-hosted** (infraestructura de LegalPro) o vía proveedor de inferencia externo.
- **Propósito:** Procesamiento de visión por computadora: OCR de documentos, análisis de imágenes/escaneos, extracción visual de información en expedientes.
- **Datos transferidos:**
  - **Self-hosted:** Ninguna transferencia internacional — los datos permanecen en la infraestructura de LegalPro. No aplica Art. 21 LPDP.
  - **Vía proveedor externo:** Prompts/imágenes enviados al proveedor de inferencia; aplica Art. 21 LPDP y requiere DPA del proveedor.
- **Base legal:** Self-hosted: sin transferencia (Art. 1-2 LPDP, tratamiento propio). Vía externa: consentimiento expreso (Art. 21 LPDP).
- **DPA firmado:** N/A en self-hosted. DPA del proveedor de inferencia si se usa vía externa.
- **Variable de entorno:** `MIMO_VISION_MODE=self_hosted|external`, `MIMO_API_KEY` (solo modo external), `MIMO_MODEL=MiMo-V2.5`.

### 8.3 MiniMax M3 (Proveedor Fallback / Legacy)

- **Empresa:** MiniMax Inc.
- **Sede:** China (Shanghai) / Singapur (redundancia regional)
- **Propósito:** Respaldo de los flujos heredados y contingencia cuando OpenCode Go no está disponible. Ya NO es el proveedor principal.
- **Datos transferidos:** Prompts del usuario, contexto del expediente, metadatos de uso (mismos controles de minimización que el resto).
- **Base legal:** Consentimiento expreso del usuario (Art. 21 LPDP).
- **DPA firmado:** Sí.
- **Ubicación del DPA:** Confidencial — disponible para la ANPDP bajo requerimiento.
- **Variable de entorno:** `MINIMAX_API_KEY`, `MINIMAX_MODEL_DEFAULT=MiniMax-M3`.

### 8.4 Google Gemini (Eliminado)

> **GOOGLE GEMINI FUE ELIMINADO DEFINITIVAMENTE EL 01 DE AGOSTO DE 2026.** No existe ningún flujo activo que envíe datos a Google LLC / Google Cloud Platform. Se eliminan: API key `GOOGLE_GEMINI_API_KEY`, rutas legacy y eventos de auditoría `GEMINI_*` (reemplazados por eventos genéricos `IA_*`). Cualquier reutilización del proveedor requiere un nuevo análisis de impacto regulatorio.

### 8.5 Etiquetado en la Aplicación

Cada respuesta IA identifica claramente el proveedor usado, conforme al FIX LPDP-2 (01-ago-2026) y la migración v3.0 (06-ago-2026):

- **Badge visible en la UI:** "Procesado por [DeepSeek V4 Flash (OpenCode Go) | Xiaomi MiMo V2.5 | MiniMax M3 (legacy)]"
  - El badge se muestra en el header del panel del asistente y en cada mensaje de IA.
- **Metadato en respuesta JSON:** `{ provider: "opencode" | "opencode-vision" | "minimax", model: "deepseek-v4-flash" | "MiMo-V2.5" | "MiniMax-M3", ... }`
- **Log de auditoría:** Cada consulta registra el proveedor en `audit_log` con el evento `TRANSFERENCIA_INTERNACIONAL` (ver `catalogs/audit-events.json`). Para el modo self-hosted de visión se registra `proveedor: "self_hosted"` con indicador de ausencia de transferencia.
- **Consentimiento:** El modal de disclaimer de IA (`IADisclaimerModal`) y el banner (`IADisclaimerBanner`) mencionan explícitamente al proveedor activo al momento de la consulta.

### 8.6 Asignación del proveedor por endpoint

| Endpoint | Proveedor activo | Notas |
|----------|-----------------|-------|
| `POST /api/ai/chat` | `opencode` | Default. MiniMax solo si `?provider=minimax` (fallback) |
| `POST /api/ai/consulta` | `opencode` | Default. MiniMax solo si `?provider=minimax` (fallback) |
| `POST /api/ai/consulta/stream` | `opencode` | Default. MiniMax solo si `?provider=minimax` (fallback) |
| `POST /api/ai/jurisprudencia` | `opencode` | Default. |
| `POST /api/ai/panel-expertos` | `opencode` | Default. |
| `POST /api/ai/panel-expertos/stream` | `opencode` | Default. |
| `POST /api/ai/vision/*` | `opencode-vision` | MiMo V2.5 — self-hosted (sin transferencia) o vía proveedor externo |

> **Migración v3.0 (06-ago-2026):** LegalPro migró todos los endpoints de texto a OpenCode Go / DeepSeek V4 Flash. Los flujos de visión migran a Xiaomi MiMo V2.5. MiniMax M3 permanece únicamente como fallback de contingencia. Los endpoints Gemini fueron eliminados.

### 8.7 Principio de minimización

Para todos los proveedores externos se aplica el principio de minimización de datos (Art. 7 LPDP):

1. **Pseudonimización previa:** Nombres de partes y datos sensibles se reemplazan por tokens antes del envío cuando es factible.
2. **Filtrado de PII:** Se ejecuta el middleware `middlewareDeteccionSensibles` (`utils/datosSensibles.js`) antes de cada llamada.
3. **Sanitización de prompts:** `sanitizarPrompt` elimina inyecciones y datos no necesarios para la tarea.
4. **Sin persistencia:** No se almacenan prompts en servidores propios (salvo historial consentido).
5. **Cifrado en tránsito:** TLS 1.3 en todas las comunicaciones.
6. **Self-hosting preferente para visión:** MiMo V2.5 puede ejecutarse localmente, eliminando la transferencia para datos visuales sensibles.

---

## 9. Versionado y actualizaciones

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 2026-05-04 | Documento inicial conforme a LPDP Art. 21 |
| 2.0 | 2026-07-16 | Migración de Google Gemini (EE.UU.) a MiniMax AI (China/Singapur). Se agregan garantías adicionales por falta de nivel adecuado de protección en China. |
| 2.1 | 2026-08-01 | **FIX LPDP-2:** Etiquetado consistente de proveedores IA. Se documenta explícitamente MiniMax M3 (principal) y Google Gemini (secundario/legacy), con badge en UI, metadato `provider` en respuestas JSON y log de auditoría por proveedor. Se actualiza la base legal del consentimiento para cubrir ambos proveedores. |
| 3.0 | 2026-08-06 | **Migración a OpenCode Go / DeepSeek V4 Flash (principal, texto) + Xiaomi MiMo V2.5 (visión, open source).** Google Gemini es eliminado definitivamente (01-ago-2026). MiniMax M3 pasa a fallback legacy. Se documenta el modo self-hosted de MiMo V2.5 (sin transferencia internacional) y los nuevos destinos China/OpenCode Go. Consentimiento Art. 21 actualizado y eventos de auditoría `GEMINI_*` reemplazados por `IA_*`. |

Este documento será revisado anualmente o cuando ocurran cambios significativos en los subencargados o en la normativa aplicable.

---

*Documento generado para cumplimiento de la Ley N° 29733 — Ley de Protección de Datos Personales del Perú. Este documento es parte integral de la Política de Privacidad de LegalPro.*
