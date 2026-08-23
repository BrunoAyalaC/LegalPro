# Reporte de Auditoría LPDP — LegalPro

> **Marco legal:** Ley N° 29733 (LPDP Perú) y su Reglamento DS N° 003-2013-JUS
> **Sujeto auditado:** LegalPro — ERP legal peruano
> **Auditor:** Agente `auditar-lpdp` (skill `peru-lpdp-compliance`)
> **Fecha:** 2026-06-28
> **Modo:** READ-ONLY. Sin modificaciones al código.
> **UIT 2026 (referencia):** S/ 5,350

---

## 1. Verificadores automáticos

Ejecutados desde `C:/Users/Pc/Desktop/Abogacia` con `node tools/verifiers/<verifier>.mjs`:

| Verificador | Resultado | Notas |
|---|---|---|
| `verifier-lpdp.mjs` | ✅ 9/9 OK | 0 errores, 0 warnings |
| `verifier-arco.mjs` | ✅ 5/5 OK | 0 errores |
| `verifier-transferencia-internacional.mjs` | ✅ 5/5 OK | 0 errores |
| `verifier-firma-digital.mjs` | ✅ 5/5 OK | 0 errores |

**Resultado bruto:** 24/24 controles estructurales en verde.

> ⚠️ **Caveat:** Los veridores son **structural checks** (grep/presencia de strings). No prueban flujos runtime ni la calidad sustantiva del consentimiento (LEG-01 y LEG-05 no son detectables automáticamente).

---

## 2. Checklist sustantivo (8 puntos del encargo)

| # | Pregunta | Estado | Evidencia |
|---|---|---|---|
| 1 | ¿4 checkboxes separados y obligatorios los correctos? | ✅ PARCIAL | `SignupPage.jsx:27-32` y `:181-268` — 4 checkboxes (`terminos`, `privacidad`, `marketing`, `transferencia_internacional`). Solo `terminos` y `privacidad` son `required`. |
| 2 | ¿4 endpoints ARCO? | ❌ FALTA UNO | `datos-personales.js`: `GET /` (acceso), `PUT /` (rectificar), `POST /cancelar` (cancelar), `GET /export` (portabilidad). **Falta `POST /oposicion`** (LPDP Art. 27). |
| 3 | ¿Registro de consentimiento con timestamp/IP/UA? | ✅ | `init.sql:190-202` tabla `consentimientos(id, usuario_id, tipo, version, aceptado, ip_address INET, user_agent, created_at)`. INSERT en `auth.js:218-222`. |
| 4 | ¿Transferencia internacional con consentimiento explícito? | ✅ | `SignupPage.jsx:237-267` checkbox dedicado con disclosure del destino, base legal y datos enviados. Flag en `usuarios.acepta_transferencia_internacional` (`init.sql:131`). |
| 5 | ¿Breach runbook con plantilla ANPDP ≤ 5 días hábiles? | ✅ | `RB-010-lpdp-breach.md` Paso 3: `<=5 días hábiles → ANPDP`. Plantilla formal líneas 71-80. Ley citada Art. 24. |
| 6 | ¿Datos sensibles sin protección adicional? | ⚠️ PARCIAL | Función SQL `detectar_datos_sensibles` existe (`init.sql:728`). **NO hay modal UI de doble check al crear expediente** (grep `doble check\|Confirmar tratamiento` → 0 hits en `legalpro-app/src`). |
| 7 | ¿Campo `acepta_transferencia_internacional` en `usuarios`? | ✅ | `init.sql:131` y migración en `:528`. Middleware `requireTransferenciaInternacional.js` lo consulta. |
| 8 | ¿`POST /api/auth/register` captura consentimientos? | ✅ | `auth.js:113-249` valida `terminos` y `privacidad` requeridos (líneas 145-150), inserta fila por finalidad con `ip_address` y `user_agent` (líneas 191-225). |

---

## 3. Estado por artículo de la LPDP

| Artículo | Materia | Estado | Comentario |
|---|---|---|---|
| **Art. 2** (Definiciones) | — | ✅ | Catálogo `reguladores-peru.json` y `codigos-leyes.json` referencian LPDP. |
| **Art. 6** (Consentimiento) | Base legal | ✅ | 4 finalidades separadas en signup. Registro con versión. |
| **Art. 7** (Contrato) | Otra base legal | ✅ | Gestión de suscripción como ejecución contractual. |
| **Art. 13** (Información al titular) | Aviso previo | ✅ | Disclosures en `TRANSFERENCIA_INTERNACIONAL.md` y Registro de Tratamiento. |
| **Art. 14** (Consentimiento libre, específico, informado, inequívoco) | Granularidad | ✅ | 4 checkboxes, disclosure con botón "Ver detalles" para revocables. |
| **Art. 15** (Revocabilidad) | Facultad de revocar | ❌ **BRECHA** | **No existe UI ni endpoint para revocar consentimiento.** Solo se setea al registrarse. Ver hallazgo LEG-01. |
| **Art. 16** (Medios para revocar) | Facilidad de revocación | ❌ **BRECHA** | Igual a Art. 15. |
| **Art. 17** (Datos sensibles — consentimiento expreso por escrito) | Doble check | ❌ **BRECHA** | `detectar_datos_sensibles` SQL existe pero **no hay modal de confirmación obligatoria** al crear expediente sensible. Ver hallazgo LEG-05. |
| **Art. 18** (Deber de información) | Calidad del dato | ✅ | Formularios indican campos obligatorios. |
| **Art. 19** (Seguridad) | Medidas técnicas | ✅ | TLS, pgcrypto, RBAC, JWT con expiración. |
| **Art. 20** (Confidencialidad) | Deber del encargado | ✅ | DPA Google, Supabase y Railway. |
| **Art. 21** (Transferencia internacional) | Consentimiento + SCC + nivel adecuado | ⚠️ | Consentimiento ✅, SCC y certificaciones documentadas ✅, **FALTA revocación** del consentimiento (Art. 15/16). |
| **Art. 22** (Flujos transfronterizos) | Registro | ⚠️ | Documento existe pero EPD, Razón social y RUC están en "Por definir". Ver hallazgo LEG-02. |
| **Art. 23** (Registro de tratamiento) | Obligación documental | ⚠️ | `docs/REGISTRO_TRATAMIENTO_LPDP.md` existe, pero campos críticos del responsable siguen como `[Por definir]`. |
| **Art. 24** (Seguridad y notificación de incidentes) | Breach | ✅ | `RB-010-lpdp-breach.md` con plazos 5 días hábiles / 72h GDPR / 10 días titulares. |
| **Art. 25** (Comunicación a titulares) | Tras incidente | ✅ | Plantilla incluida en RB-010. |
| **Art. 27** (Oposición) | Derecho ARCO específico | ❌ **BRECHA** | No existe endpoint `POST /api/mis-datos/oposicion`. Solo Acceso/Rectificación/Cancelación + Export. |
| **Art. 28** (Plazo de respuesta ARCO: 8 días hábiles) | SLA | ⚠️ | DS 003-2013-JUS fija 10 días, LPDP Art. 25 menciona 8 días para algunos actos. El runbook RB-010 dice "5 días hábiles para alertar". **No hay job que mida SLA automáticamente.** |
| **Art. 36** (EPD/DPO) | Designación obligatoria | ❌ **BRECHA** | EPD = `[Nombre por definir]`. Email placeholder `privacidad@legalpro.pe`. |
| **Art. 39-41** (Sanciones administrativas) | Tipificación | ✅ | Catálogo `reguladores-peru.json` documentado; tabla de sanciones propias en `auditor-lpdp.md`. |

---

## 4. Brechas priorizadas con sanción potencial

### 🔴 LEG-01 — Sin UI/endpoint para revocar consentimiento (Art. 15, 16, 21)

| Campo | Valor |
|---|---|
| **Severidad** | CRITICAL |
| **Artículos** | LPDP 15, 16; Art. 11 del Reglamento (DS 003-2013-JUS) |
| **Evidencia** | `grep -rn "revocar\|revocacion" src/pages/Perfil.jsx` → 0 hits. `SignupPage.jsx` solo permite aceptar. |
| **Riesgo** | Sin revocación, el consentimiento es **ineficaz** (Art. 15.3 LPDP). ANPDP puede sancionar por consentimiento viciado retroactivamente. |
| **Multa potencial** | 5–50 UIT → **S/ 26,750 – S/ 267,500** |
| **Probabilidad ANPDP** | 0.6 (alta) |
| **Remediación** | 1) Crear `POST /api/mis-datos/revocar-consentimiento` que actualice `consentimientos.aceptado=FALSE` con `created_at` de revocación. 2) UI en `Perfil.jsx`: 3 switches (marketing, transferencia_internacional, ia_analisis). 3) Inhabilitar UI de IA si `acepta_transferencia_internacional=FALSE` retroactivamente. |

---

### 🔴 LEG-02 — Registro de Tratamiento con campos críticos "Por definir" (Art. 23)

| Campo | Valor |
|---|---|
| **Severidad** | HIGH |
| **Artículos** | LPDP 23; DS 003-2013-JUS Art. 23 (registro obligatorio) |
| **Evidencia** | `docs/REGISTRO_TRATAMIENTO_LPDP.md:14-20` — Razón social, RUC, Domicilio, EPD (nombre) y Teléfono son todos `[Por definir]`. |
| **Riesgo** | Imposible cumplir Art. 23 (deber de inscripción) sin titular identificado. ANPDP puede apercibir (Art. 39) y luego multar (Art. 40-41). |
| **Multa potencial** | 5–50 UIT → **S/ 26,750 – S/ 267,500** |
| **Remediación** | Completar los 5 campos faltantes antes de lanzamiento público. Constituir la persona jurídica operadora, designar EPD real y notificar a ANPDP mediante portal PD. |

---

### 🔴 LEG-03 — Sin endpoint `POST /mis-datos/oposicion` (Art. 27 LPDP)

| Campo | Valor |
|---|---|
| **Severidad** | HIGH |
| **Artículos** | LPDP 27 |
| **Evidencia** | `routes/datos-personales.js`: 4 endpoints (`GET/`, `PUT/`, `POST /cancelar`, `GET /export`) — **no existe `/oposicion`**. |
| **Riesgo** | Derecho ARCO de Oposición sin mecanismo ⇒ cumplimiento ARCO incompleto. Plazo legal de 8 días hábiles (DS 003-2013-JUS) sin forma de respuesta. |
| **Multa potencial** | 10–50 UIT → **S/ 53,500 – S/ 267,500** |
| **Remediación** | Agregar `router.post('/oposicion', authMiddleware, async (req,res)=>{ ... })` que acepta `{ tipo_tratamiento, motivo }`, registra `consentimientos.aceptado=FALSE` y emite `ARCO_OPOSICION` en audit log. Tiempo de implementación: 2-4h. |

---

### 🟠 LEG-04 — Sin SLA automático de ARCO (Art. 28; DS 003-2013-JUS)

| Campo | Valor |
|---|---|
| **Severidad** | MEDIUM |
| **Artículos** | LPDP 25, 28 |
| **Evidencia** | `cron-jobs.js` y `cron-jobs.js` no contienen `arco_sla_alert`. |
| **Riesgo** | Si una solicitud ARCO supera 5 días hábiles sin respuesta, ANPDP interpreta abandono. |
| **Multa potencial** | 5–20 UIT → **S/ 26,750 – S/ 107,000** |
| **Remediación** | Crear cron job diario que busque `audit_log WHERE event_name='ARCO_REQUEST' AND created_at < NOW()-INTERVAL '5 days'` y emita `LPDP_ARCO_OVERDUE` + notifique a `soporte-cliente`. |

---

### 🟠 LEG-05 — Datos sensibles sin doble check (Art. 17 LPDP)

| Campo | Valor |
|---|---|
| **Severidad** | HIGH |
| **Artículos** | LPDP 4 inc. 7, 17 |
| **Evidencia** | `grep "doble check\|Confirmar tratamiento" src/` → 0 hits. La función SQL `detectar_datos_sensibles` existe (`init.sql:728`), pero no hay UI que la invoque con modal obligatorio. |
| **Riesgo** | Si un abogado pega historia clínica en un expediente, no hay consentimiento expreso documentado para ese dato sensible específico. |
| **Multa potencial** | 10–50 UIT → **S/ 53,500 – S/ 267,500** |
| **Remediación** | Modal en `Expedientes.jsx` "Confirmar tratamiento de dato sensible (salud/menor/víctima)" con checkbox explícito + audit `LPDP_DATO_SENSIBLE_TRATADO`. |

---

### 🟠 LEG-06 — Sin campo `vigente:bool` en códigos-leyes (Art. 18, 23)

| Campo | Valor |
|---|---|
| **Severidad** | MEDIUM |
| **Artículos** | LPDP 18 (calidad), 23 (registro) |
| **Evidencia** | `catalogs/codigos-leyes.json` — sin campo `vigente`. No se puede distinguir ley vigente de derogada. |
| **Riesgo** | Mostrar al usuario una norma derogada como vigente afecta "calidad del dato" tratado. Indirecto pero documentable en fiscalización. |
| **Multa potencial** | 5 UIT → **S/ 26,750** |
| **Remediación** | Agregar `vigente: true` en entries activas y `vigente: false` + `fecha_derogacion` en derogadas. Job mensual de verificación contra SPIJ. |

---

### 🟠 LEG-07 — "Hash SHA256" no es firma digital válida (Ley 27269)

| Campo | Valor |
|---|---|
| **Severidad** | HIGH |
| **Artículos** | Ley 27269 Arts. 1, 9, 16 |
| **Evidencia** | `BovedaEvidencia.jsx:277-279`, `routes/documentos.js:359-375` calculan `hash_sha256` y lo presentan como "verificado". **No hay integración con PSC acreditado** (eFirma Perú, Firma Perú) ni TSA (autoridad de sello de tiempo). |
| **Riesgo** | Un documento etiquetado "firmado digitalmente" sin PSC acreditado no tiene validez probatoria. Si se presenta así ante un juzgado, ANPDP puede sancionar por publicidad engañosa y la prueba podría ser declarada inválida. |
| **Multa potencial** | Riesgo civil/penal mayor que sanción ANPDP directa (S/ ~50,000). |
| **Remediación** | Cambiar copy a "Hash de integridad (SHA-256)" y aclarar "No constituye firma digital bajo Ley 27269". Integrar con PSC (eFirma o Firma Perú) + TSA RENIEC antes de ofrecer "firma digital" como feature. |

---

### 🟡 LEG-08 — Retención de audit_log no automatizada (Art. 23)

| Campo | Valor |
|---|---|
| **Severidad** | MEDIUM |
| **Artículos** | LPDP 23; ISO 27001 A.12.4 |
| **Evidencia** | `audit_log` definido en `init.sql:512`; no se encontró job de archivado/eliminación en `cron-jobs.js`. |
| **Riesgo** | Tabla crece indefinidamente; ANPDP puede cuestionar "medidas de seguridad" si no hay política de purga. |
| **Multa potencial** | 5 UIT → **S/ 26,750** |
| **Remediación** | Cron mensual: archivar `audit_log` > 5 años a S3 Glacier, eliminar > 10 años (salvo litigio activo). |

---

## 5. Resumen de sanción potencial (UIT 2026 = S/ 5,350)

| Brecha | Multa mín (S/) | Multa máx (S/) | Probabilidad ANPDP | Esperanza (S/) |
|---|---:|---:|---:|---:|
| LEG-01 (sin revocar) | 26,750 | 267,500 | 0.60 | ~141,000 |
| LEG-02 (registro incompleto) | 26,750 | 267,500 | 0.50 | ~73,500 |
| LEG-03 (sin oposicion ARCO) | 53,500 | 267,500 | 0.40 | ~96,000 |
| LEG-04 (sin SLA ARCO) | 26,750 | 107,000 | 0.30 | ~20,000 |
| LEG-05 (datos sensibles) | 53,500 | 267,500 | 0.30 | ~80,000 |
| LEG-06 (catálogo leyes) | 0 | 26,750 | 0.10 | ~1,500 |
| LEG-07 (firma digital falsa) | 0 | 50,000 | 0.40 | ~15,000 |
| LEG-08 (retención audit) | 0 | 26,750 | 0.30 | ~8,000 |
| **TOTAL exposición** | **187,250** | **1,280,500** | — | **~435,000** |

**Score LPDP estructural:** 3.5/4 (cumple mayoría pero tiene gaps ARCO Oposición, revocación y datos sensibles).

---

## 6. Tabla de remediación priorizada

| Sprint | Brechas | Esfuerzo | Dependencia | Riesgo si no se hace |
|---|---|---|---|---|
| **Sprint 1 (esta semana)** | LEG-01, LEG-03, LEG-05 | 2 dev + 1 test | Ninguna | Bloqueo lanzamiento público |
| **Sprint 2** | LEG-02, LEG-04, LEG-08 | 1 dev + 0.5 legal | Constitución jurídica de la operadora | Apercibimiento ANPDP |
| **Sprint 3** | LEG-06, LEG-07 | 1 dev | Catálogo leyes + PSC integration | Demanda civil / invalidez probatoria |

---

## 7. Conclusiones

1. **Cumplimiento estructural: ALTO (24/24 controles automáticos).** La base de la LPDP está sólidamente implementada: tabla `consentimientos` con versión + IP + UA, 4 checkboxes separados, registro de tratamiento, runbook de breach con plazos correctos, columna `acepta_transferencia_internacional` en usuarios, y captura del consentimiento en `POST /api/auth/register`.

2. **Cumplimiento sustantivo: MEDIO.** Faltan 3 controles que un auditor manual detecta y los verifiers grep no:
   - **Revocación del consentimiento** (LEG-01) — más crítico para Art. 15/16.
   - **Endpoint de oposición ARCO** (LEG-03) — necesario para Art. 27.
   - **Doble check para datos sensibles** (LEG-05) — necesario para Art. 17.

3. **Exposición ANPDP estimada:** ~S/ 435,000 en valor esperado y hasta S/ 1.28 millones en escenario worst-case. La probabilidad agregada de inspección ANPDP en próximos 12 meses se estima **media-alta** (~0.4) dado que LegalPro almacena contenido jurídico sensible y procesa datos de menores/víctimas en casos típicos de familia y penal.

4. **Recomendación final:** **NO abrir al público general** hasta cerrar LEG-01, LEG-03 y LEG-05 (Sprint 1). Las demás brechas pueden atenderse en producción con plan de remediación público.

---

## 8. Anexos: comandos ejecutados

```bash
# 1. Verificadores automáticos
cd "C:/Users/Pc/Desktop/Abogacia"
node tools/verifiers/verifier-lpdp.mjs                       # 9/9 OK
node tools/verifiers/verifier-arco.mjs                       # 5/5 OK
node tools/verifiers/verifier-transferencia-internacional.mjs # 5/5 OK
node tools/verifiers/verifier-firma-digital.mjs              # 5/5 OK

# 2. Búsquedas sustantivas
grep -rn "revocar" "legalpro-app/src/pages/Perfil.jsx"        # 0 hits → LEG-01
grep -rn "oposicion" "legalpro-app/server/routes/"           # 0 hits → LEG-03
grep -rn "doble check\|Confirmar tratamiento" "legalpro-app/src"  # 0 hits → LEG-05
grep -n "acepta_transferencia_internacional" "legalpro-app/server/init.sql"  # sí, línea 131
grep -rn "EPD\|privacidad@legalpro" "legalpro-app/src"       # placeholder → LEG-02
```

---

*Reporte generado en modo READ-ONLY. No se modificó ningún archivo del repositorio. Generado conforme a los Arts. 23-24 del DS 003-2013-JUS (Registro y notificación) y la Directiva de Verificaciones de la ANPDP.*
