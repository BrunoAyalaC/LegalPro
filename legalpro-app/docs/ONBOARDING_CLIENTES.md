# Onboarding para Clientes — LegalPro

> **Bienvenido a LegalPro**, una plataforma SaaS legal para profesionales del Perú, asistida por IA.

---

## 🚀 Inicio Rápido (5 minutos)

### Paso 1: Crear cuenta
1. Ir a https://legalpro.app/signup
2. Ingresar email profesional
3. Crear contraseña (mínimo 8 caracteres, incluir mayúscula y número)
4. Aceptar Términos y Política de Privacidad

### Paso 2: Configurar tu organización
1. Nombre del estudio / despacho / fiscalía
2. RUC (si aplica)
3. Especialidad principal (penal, civil, laboral, etc.)
4. Tamaño del equipo (1, 2-5, 6-20, 20+)

### Paso 3: Invitar a tu equipo
1. Ir a "Mi Organización" → "Invitar miembros"
2. Ingresar email del colega
3. Asignar rol (OWNER, ADMIN, MEMBER)
4. Ellos recibirán email de invitación

### Paso 4: Activar MFA (obligatorio para plan PRO)
1. Ir a "Perfil" → "Seguridad"
2. Escanear QR con Google Authenticator o Authy
3. Ingresar código de 6 dígitos
4. Guardar códigos de respaldo en lugar seguro

---

## 💼 Funcionalidades Principales

### 📁 Gestión de Expedientes
- Crear expediente con número, materia, partes, fecha
- Adjuntar documentos (PDF, Word, imágenes)
- Visualizar timeline de actuaciones
- Compartir con miembros del equipo
- Búsqueda full-text

### 🤖 Asistentes IA (consume créditos)
| Función | Créditos | Descripción |
|---|:-:|---|
| Analista de Expedientes | 5 | Análisis completo con base legal |
| Redactor de Escritos | 10 | Borradores de demandas, contestaciones |
| Buscador de Jurisprudencia | 3 | 5 fuentes oficiales (PJ, TC, etc.) |
| Predictor Judicial | 8 | Predicción con disclaimers |
| Simulador de Juicios | 15 | IA como contraparte |
| Panel de Expertos | 20 | Multi-agente en cascada |
| Generador de Alegatos | 7 | Alegatos de clausura |
| Plan de Interrogatorio | 6 | NCPP art. 375 |
| Sugerir Objeciones | 4 | En tiempo real |

### 💰 Planes y Precios

| Plan | Créditos/mes | Usuarios | Expedientes | Precio |
|---|:-:|:-:|:-:|:-:|
| **FREE** | 50 | 1 | 5 | S/ 0 |
| **PRO** | 500 | 5 | 50 | S/ 99/mes |
| **ENTERPRISE** | Ilimitado | 20+ | Ilimitado | S/ 499/mes |

### 💳 Métodos de Pago
- Stripe (tarjeta internacional)
- Culqi (Yape, Plin, tarjetas Perú)
- Factura electrónica (peruana)

---

## 🔒 Seguridad y Privacidad

### Tus datos están protegidos por:
- 🔐 **MFA TOTP** obligatorio en plan PRO
- 🔐 **Cifrado AES-256** en reposo y tránsito
- 🔐 **Aislamiento multi-tenant** verificado con PostgreSQL RLS
- 🔐 **Backups cifrados** cada 24 horas
- 🔐 **Auditoría completa** de todos los accesos
- 🔐 **Compliance LPDP** (Ley 29733 Perú) verificado

### Tus derechos ARCO (Ley 29733):
- **A**cceso: Ver todos tus datos (`GET /api/mis-datos`)
- **R**ectificación: Corregir datos incorrectos (`PUT /api/mis-datos`)
- **C**ancelación: Eliminar tu cuenta (`POST /api/mis-datos/cancelar`)
- **O**posición: Oponerte a tratamientos (`POST /api/mis-datos/oposicion`)
- **Exportación**: Descargar todos tus datos (`GET /api/mis-datos/export`)

Contactar DPO: dpo@legalpro.app

---

## 📱 Apps Móviles

- **Android**: Descarga APK desde la sección "Descargar" en la web
- **iOS**: Próximamente (Q4 2026)

---

## 🆘 Soporte

### Canales:
- **Email**: soporte@legalpro.app
- **Chat in-app**: disponible 9:00-18:00 PET
- **Documentación**: https://docs.legalpro.app
- **Status page**: https://status.legalpro.app

### SLA:
- **Plan FREE**: Respuesta en 48h
- **Plan PRO**: Respuesta en 8h
- **Plan ENTERPRISE**: Respuesta en 2h + Account Manager dedicado

---

## 🎓 Recursos de Aprendizaje

- Video tutoriales: https://legalpro.app/tutoriales
- Webinars mensuales: primer miércoles de cada mes
- Blog legal: https://blog.legalpro.app
- Glosario jurídico: en la app

---

**Última actualización:** 1 de agosto de 2026
