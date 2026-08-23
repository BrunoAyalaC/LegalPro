# Registro de Tratamiento de Datos Personales (LPDP)

**Documento:** Registro de Tratamiento — LegalPro  
**Denominación del tratamiento:** Plataforma LegalPro — Gestión de Expedientes y Asistencia Legal con IA  
**Fecha de emisión:** 04 de mayo de 2026  
**Marco legal aplicable:** Ley N° 29733 — Ley de Protección de Datos Personales (LPDP) y su Reglamento D.S. N° 016-2024-JUS (que sustituye al D.S. 003-2013-JUS), Art. 24 — Registro de actividades de tratamiento

---

## 1. Información general del responsable

| Campo | Información |
|-------|-------------|
| **Data Protection Officer (DPO)** | Nombre: [A COMPLETAR POR EL EQUIPO]; Email: dpo@legalpro.app; Teléfono: [A COMPLETAR] |
| **Razón social del responsable** | [Por definir — Empresa operadora de LegalPro S.A.C. o similar] |
| **RUC** | [Por definir] |
| **Domicilio legal** | [Por definir — Lima, Perú] |
| **Actividad principal** | Desarrollo de software legal-tech (SaaS) |
| **Encargado de Protección de Datos (EPD)** | [Nombre por definir] |
| **Email del EPD** | privacidad@legalpro.pe |
| **Teléfono del EPD** | [Por definir] |

---

## 2. Descripción del tratamiento

### 2.1 Denominación
Plataforma LegalPro — Gestión de Expedientes y Asistencia Legal con Inteligencia Artificial

### 2.2 Finalidades del tratamiento

| N° | Finalidad | Descripción | Base legal |
|----|-----------|-------------|------------|
| 1 | Gestión de cuentas de usuario y autenticación | Crear y mantener cuentas de usuario, autenticación JWT, control de sesiones | Art. 7 LPDP — Ejecución de contrato |
| 2 | Procesamiento y almacenamiento de expedientes judiciales | Almacenar, organizar y gestionar expedientes, documentos y evidencia digital | Art. 6 LPDP — Consentimiento del titular |
| 3 | Generación de borradores legales mediante IA | Enviar prompts a MiniMax AI para generar escritos, alegatos, análisis y predicciones | Art. 6 LPDP — Consentimiento del titular + Art. 21 LPDP — Transferencia internacional |
| 4 | Comunicaciones con el usuario | Envío de notificaciones, alertas SINOE, invitaciones a organizaciones | Art. 6 LPDP — Consentimiento del titular |
| 5 | Facturación y gestión de suscripciones | Gestión de pagos, emisión de comprobantes de pago, control de planes | Art. 7 LPDP — Ejecución de contrato |
| 6 | Mejora del servicio y análisis de uso | Métricas de uso, rendimiento de IA, detección de errores | Art. 6 LPDP — Consentimiento del titular |

### 2.3 Registro de actividades de tratamiento por sistema (D.S. N° 016-2024-JUS, Art. 24)

Inventario mínimo de actividades de tratamiento mapeadas a los endpoints principales de la plataforma.

#### A. Endpoints principales

| Actividad | Endpoints | Finalidad | Datos tratados | Base legal | Transferencia internacional | Plazo de retención | Categoría de interesado |
|-----------|-----------|-----------|----------------|------------|----------------------------|--------------------|------------------------|
| Autenticación y cuentas | `POST /api/auth/login`, `/api/auth/registro`, refresh y MFA (`server/routes/auth.js`, `auth-login-mfa.js`) | Crear/mantener cuentas, sesiones JWT, verificación MFA | Email, hash de contraseña, nombre, DNI, rol, IP de sesión | Ejecución de contrato (Art. 7 LPDP) + consentimiento en registro | NO como destino final — encargados Railway/Supabase (EE.UU.), ver sección 5 | Vida de la cuenta + 2 años | Usuarios registrados |
| Gestión de expedientes | `/api/expedientes/*`, `/api/documentos/*` (`expedientes.js`, `documentos.js`) | Almacenar, organizar y gestionar expedientes judiciales y evidencia | Contenido de expedientes, documentos, partes procesales (puede incluir PII aportada por el usuario) | Consentimiento del titular (Art. 6 LPDP) | NO como destino final — encargados Railway/Supabase (EE.UU.), ver sección 5 | Relación contractual + 2 años | Usuarios autenticados (ABOGADO/FISCAL/JUEZ/CONTADOR) |
| Asistencia legal IA | `POST /api/ai/chat` y `/api/ai/*` (`ai.js`) | Generación de borradores, análisis, predicciones vía LLM | Prompts, contenido legal, historial de chat | Consentimiento expreso e informado (Art. 6 LPDP) + transferencia internacional (Art. 21 LPDP) | **SÍ** — OpenCode Go / DeepSeek V4 Flash (China continental, proveedor principal); Xiaomi MiMo V2.5 visión (China o self-hosted sin transferencia); fallback MiniMax M3 (China/Singapur). Detalle: `docs/TRANSFERENCIA_INTERNACIONAL.md` v3.0 | Historial de chat: 1 año | Usuarios autenticados |

#### B. Herramientas determinísticas sin IA — `/api/herramientas/*` (`server/routes/herramientas.js`)

| Campo | Valor común a los 6 endpoints |
|-------|-------------------------------|
| **Finalidad** | Cálculos legales referenciales (interés moratorio, plazos hábiles, prescripción penal, conversión UIT, consulta de catálogos y tasas oficiales) |
| **Datos tratados** | Montos financieros, fechas, pena del delito, términos de búsqueda — **NO identificativos** (sin nombres, DNI ni datos sensibles) |
| **Base legal** | Consentimiento tácito por uso + interés legítimo del responsable (datos no identificativos) |
| **Transferencia internacional** | **NO** — cálculo local en servidor. Única excepción: `tasas-bcrp` consulta la API pública gubernamental del BCRP (bcrp.gob.pe) server-side, **sin envío de PII** ni parámetros de usuario |
| **Plazo de retención** | **No persiste datos** — procesamiento en memoria durante el request; sin escritura a base de datos ni logs con payload |
| **Categoría de interesado** | Usuarios autenticados (cualquier rol) |

| # | Endpoint | Función |
|---|----------|---------|
| 1 | `GET /api/herramientas/uit` | Valores UIT/RMV vigentes para conversiones referenciales |
| 2 | `POST /api/herramientas/interes-legal` | Interés moratorio simple sobre capital (día calendario) |
| 3 | `POST /api/herramientas/plazos-habiles` | Suma de días hábiles peruanos (CPC Art. 144, feriados del catálogo) |
| 4 | `GET /api/herramientas/delitos?q=` | Búsqueda case-insensitive en catálogos de tipos penales y delitos económicos |
| 5 | `POST /api/herramientas/prescripcion` | Cómputo de prescripción de la acción penal (CP Arts. 85 y 88) |
| 6 | `GET /api/herramientas/tasas-bcrp` | Tasa moratoria BCRP (serie PD04-20) con fallback marcado `stale: true` |

> **Nota:** el endpoint `POST /api/plazos/calcular` (backend .NET, consumido por CalculadoraPlazos) tiene naturaleza equivalente: cálculo determinístico local, datos no identificativos, sin persistencia. Queda cubierto por esta misma fila de tratamiento.

---

## 3. Datos personales tratados

### 3.1 Datos personales (no sensibles)

| Categoría | Campos | Fuente |
|-----------|--------|--------|
| Identificación | Nombre completo, DNI, email | Proporcionados por el usuario en registro |
| Contacto | Teléfono, dirección | Proporcionados por el usuario (opcional) |
| Profesionales | Especialidad legal, rol (abogado/juez/fiscal), número de colegiatura | Proporcionados por el usuario |
| Organización | Nombre de estudio/fiscalía/juzgado, plan de suscripción | Proporcionados por el usuario/administrador |
| Contenido legal | Contenido de expedientes, hechos, teoría del caso, documentos jurídicos | Proporcionados por el usuario en el uso de la plataforma |
| Uso del servicio | Historial de chat, consultas IA, predicciones realizadas | Generados por el uso de la plataforma |

### 3.2 Datos sensibles (solo si el usuario los incluye)

| Categoría | Ejemplos | Base legal especial |
|-----------|----------|---------------------|
| Datos de salud | Enfermedades mencionadas en casos médicos, diagnósticos, historias clínicas judiciales | Art. 4 inc. 7 LPDP — Consentimiento expreso y escrito |
| Ideología política | Afiliación partidaria mencionada en casos administrativos o penales | Art. 4 inc. 7 LPDP — Consentimiento expreso y escrito |
| Origen racial o étnico | Menciones en casos de discriminación o derecho indígena | Art. 4 inc. 7 LPDP — Consentimiento expreso y escrito |
| Filiación sindical | Menciones en casos laborales | Art. 4 inc. 7 LPDP — Consentimiento expreso y escrito |
| Datos biométricos | Huellas dactilares, reconocimiento facial (si se adjuntan como evidencia) | Art. 4 inc. 7 LPDP — Consentimiento expreso y escrito |
| Orientación sexual | Menciones en casos de derechos fundamentales | Art. 4 inc. 7 LPDP — Consentimiento expreso y escrito |
| Creencias religiosas | Menciones en casos de libertad religiosa | Art. 4 inc. 7 LPDP — Consentimiento expreso y escrito |

> **Nota importante:** LegalPro NO solicita activamente datos sensibles. Estos solo aparecen si el usuario los incluye en el contenido de expedientes o documentos. La plataforma implementa detección automática de datos sensibles y alerta al usuario.

---

## 4. Base legal del tratamiento

| Base legal | Artículo | Aplicación |
|------------|----------|------------|
| **Consentimiento del titular** | Art. 6 LPDP | Registro, uso de IA, comunicaciones, mejora del servicio |
| **Ejecución de contrato** | Art. 7 LPDP | Gestión de suscripción, facturación, autenticación |
| **Transferencia internacional** | Art. 21 LPDP | Envío de datos a MiniMax AI en China / Internacional |

---

## 5. Transferencias internacionales

| Subencargado | País | Finalidad | Documento de referencia |
|--------------|------|-----------|------------------------|
| MiniMax AI | China / Singapur | Procesamiento de IA | `docs/TRANSFERENCIA_INTERNACIONAL.md` |
| Railway (hosting) | Estados Unidos | Infraestructura de despliegue | Acuerdo de procesamiento de datos (DPA) |
| Supabase (base de datos PostgreSQL) | Estados Unidos | Almacenamiento de datos | Acuerdo de procesamiento de datos (DPA) |

---

## 6. Medidas de seguridad

| Categoría | Medida | Implementación |
|-----------|--------|----------------|
| **Cifrado** | TLS 1.3 en tránsito | Todas las comunicaciones cliente-servidor y servidor-IA |
| **Cifrado** | Cifrado de columnas sensibles en reposo | Extensión `pgcrypto` en PostgreSQL |
| **Control de acceso** | RBAC (Role-Based Access Control) | Roles: SUPERADMIN, ADMIN, ABOGADO, FISCAL, JUEZ, VIEWER |
| **Control de acceso** | Multi-tenancy por organización | Aislamiento de datos entre organizaciones |
| **Autenticación** | JWT con expiración configurable | Tokens firmados con secreto rotado periódicamente |
| **Backups** | Backups diarios cifrados | Política de retención: 30 días |
| **Auditoría** | Tabla `audit_log` inmutable | Registro de INSERT, UPDATE, DELETE con datos anteriores/nuevos |
| **Detección** | Función `detectar_datos_sensibles` | Alerta automática cuando se detectan datos sensibles en contenido |
| **Logs** | Enmascaramiento de datos en logs | Nombres y DNI parcialmente enmascarados en logs de producción |

---

## 7. Tiempo de conservación de los datos

| Tipo de dato | Tiempo de conservación | Justificación |
|--------------|------------------------|---------------|
| Datos de cuenta de usuario | Durante la relación contractual + 2 años | Cumplimiento legal y resolución de disputas |
| Expedientes y documentos | Durante la relación contractual + 2 años | Cumplimiento legal y obligaciones procesales |
| Historial de chat con IA | 1 año | Optimización del servicio y trazabilidad |
| Logs de auditoría (`audit_log`) | 3 años | Requerimiento del DS 003-2013-JUS Art. 23 |
| Backups | 30 días | Recuperación ante desastres |
| Datos de facturación | 7 años (SUNAT) | Cumplimiento tributario peruano |

---

## 8. Subencargados del tratamiento

| Subencargado | Servicio | País | Contacto DPO |
|--------------|----------|------|--------------|
| Railway | Hosting y despliegue | EE.UU. | support@railway.app |
| Supabase | Base de datos PostgreSQL | EE.UU. | support@supabase.com |
| MiniMax AI | Inteligencia Artificial (MiniMax M3) | China / Singapur | support@minimaxi.com |

---

## 9. Mecanismos para ejercer derechos ARCO

El titular de los datos puede ejercer sus derechos de **Acceso, Rectificación, Cancelación y Oposición** mediante:

### 9.1 Módulo "Mis Datos" (próximamente disponible en Fase 1)
- Descarga completa de datos personales (derecho de acceso)
- Edición de información de perfil (derecho de rectificación)
- Eliminación de cuenta y datos asociados (derecho de cancelación / derecho al olvido)
- Opción de no recibir comunicaciones (derecho de oposición)

### 9.2 Email del Encargado de Protección de Datos
- **Email:** privacidad@legalpro.pe
- **Asunto requerido:** Ejercicio de derecho ARCO — [Nombre del titular]
- **Información requerida:** Nombre completo, DNI, descripción del derecho a ejercer, datos de contacto
- **Plazo de respuesta:** 10 días hábiles conforme al DS 003-2013-JUS

### 9.3 Derecho al olvido (Cancelación completa)
El usuario puede solicitar la eliminación completa de su cuenta y todos sus datos personales. LegalPro implementa:
- Soft-delete inicial (marcado como inactivo)
- Purge programado después de 30 días (eliminación física de registros)
- Notificación a subencargados para eliminar datos en la medida de lo posible

---

## 10. Registro de versiones

| Versión | Fecha | Autor | Cambios |
|---------|-------|-------|---------|
| 1.0 | 2026-05-04 | LegalPro Legal/Tech | Creación inicial del registro conforme a DS 003-2013-JUS Art. 23 |
| 1.1 | 2026-07-16 | LegalPro Legal/Tech | Migración de Google Gemini a MiniMax AI (China). Actualización de transferencia internacional |
| 1.2 | 2026-08-22 | LegalPro Gobernanza/Frontend | Alta de sección 2.3 — Registro de actividades de tratamiento por endpoint (D.S. 016-2024-JUS Art. 24): auth, expedientes, ai/chat (OpenCode Go/DeepSeek China) y 6 herramientas determinísticas `/api/herramientas/*` sin persistencia ni PII |

---

## 11. Declaración de veracidad

El responsable del tratamiento declara que la información contenida en este registro es veraz y actualizada, y se compromete a mantenerlo actualizado conforme a las modificaciones que se produzcan en el tratamiento de datos personales.

---

*Este documento cumple con el Artículo 23 del Decreto Supremo N° 003-2013-JUS, Reglamento de la Ley N° 29733 — Ley de Protección de Datos Personales del Perú. El incumplimiento de la obligación de inscribir y mantener actualizado el Registro de Tratamiento puede dar lugar a sanciones por parte de la ANPDP.*
