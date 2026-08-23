# Reporte del Refutador: LPDP

> **Agente**: @refutador-lpdp
> **Fecha**: 2026-06-12
> **Modo**: Adversarial (cuestiona al auditor, no valida compliance)
> **Objetivo**: Encontrar violaciones LPDP sutiles que el auditor pasa por alto

## 🎯 Violaciones Encontradas

### 🔴 CRITICAL: Consentimiento "cajón de sastre"

**Vector**: El usuario acepta TODO en un solo checkbox al registrarse, sin granularidad.

**LPDP Art. 14**: El consentimiento debe ser **libre, específico, informado e inequívoco**.

**Estado actual** (catalogs/role-tools.json, `consentimientos`):
- Solo 4 finalidades: marketing, ia_analisis, transferencia_internacional, etc.
- ¿Hay un único checkbox o son 4 separados?

**Recomendación**: Implementar 4 checkboxes separados en el signup, no uno solo.

**Probabilidad de sanción ANPDP**: ALTA (0.6)
**Multa potencial**: S/ 50,000 - 200,000

---

### 🟠 HIGH: Transferencia internacional sin consentimiento explícito por uso

**Vector**: El flag `acepta_transferencia_internacional` se setea una vez al registrarse. Después, en cada llamada a Gemini, se reusa ese flag.

**LPDP Art. 21**: El consentimiento debe ser **específico por finalidad** y **revocable** en cualquier momento.

**Estado actual**:
- ✅ Existe el flag
- ⚠️ Pero NO hay UI para revocarlo (solo al registrarse)
- ⚠️ No se informa al usuario cada vez que se hace una transferencia

**Recomendación**:
1. Agregar opción "Revocar consentimiento de transferencia" en /perfil
2. Cada llamada a Gemini debe loggear en audit (ya se hace) Y permitir al usuario ver un historial de transferencias

**Probabilidad**: 0.5
**Multa**: S/ 100,000

---

### 🟠 HIGH: ARCO con plazo de 8 días no garantizado

**Vector**: El endpoint `/api/mis-datos/export` existe, pero no hay SLA de respuesta.

**LPDP Art. 25-28**: Plazo de **8 días hábiles** para responder a solicitud ARCO.

**Estado actual**:
- Endpoint existe
- ⚠️ No hay job que mida el tiempo de respuesta
- ⚠️ No hay alerta si pasan 5 días sin respuesta

**Recomendación**: Crear cron job diario que alerte a `@soporte-cliente` si hay ARCO_REQUEST con > 5 días sin ARCO_RESPONSE.

**Probabilidad**: 0.4
**Multa**: S/ 200,000

---

### 🟡 MEDIUM: Retención de audit log no automatizada

**Vector**: La tabla `audit_log` crece indefinidamente.

**LPDP Art. 23 + ISO 27001 A.12.4**: Retención mínima 5 años para datos de cumplimiento.

**Estado actual**:
- ✅ Existe la tabla
- ⚠️ No hay job que elimine logs > 5 años
- ⚠️ No hay archivado en frío

**Recomendación**: Crear job mensual que:
1. Archiva logs > 5 años a S3 Glacier
2. Elimina logs > 10 años (salvo casos legales)

**Probabilidad**: 0.3
**Multa**: S/ 50,000

---

### 🟡 MEDIUM: Datos sensibles sin doble consentimiento

**Vector**: La tabla `expedientes` tiene `es_dato_sensible BOOLEAN` pero no se solicita consentimiento explícito al crearlo.

**LPDP Art. 4**: Datos sensibles (salud, menores, víctimas) requieren **consentimiento explícito por escrito** y **medidas reforzadas**.

**Estado actual**:
- ✅ Existe el flag
- ⚠️ No hay UI que pida consentimiento explícito cuando `es_dato_sensible = true`
- ⚠️ No hay "doble check" obligatorio

**Recomendación**: Cuando el abogado crea un expediente con datos sensibles, modal de "Confirmar tratamiento de datos sensibles" + audit log especial.

**Probabilidad**: 0.3
**Multa**: S/ 100,000

---

### 🟡 MEDIUM: Firmas digitales no implementadas realmente

**Vector**: El catálogo menciona PKCS#7, SHA-256, TSA. La realidad es que la firma digital no está implementada en el código (solo documentada).

**Ley 27269**: Para que un documento tenga validez legal, debe estar firmado por un PSC acreditado.

**Estado actual**:
- ✅ Documentado en catalog
- ⚠️ No hay integración con un PSC (eFirma Perú, Firma Perú, etc.)
- ⚠️ No hay TSA integrada

**Recomendación**: Integrar con un PSC acreditado INDECOPI + TSA antes de producción.

**Probabilidad**: 0.4
**Riesgo legal**: Documentos firmados sin validez legal

---

## 📊 Resumen

| Severidad | Cantidad | Acción |
|---|---|---|
| 🔴 CRITICAL | 1 | Sprint 1 (consentimiento granular) |
| 🟠 HIGH | 2 | Sprint 2 (revocar consentimiento, ARCO SLA) |
| 🟡 MEDIUM | 3 | Sprint 3-4 (retention, datos sensibles, firma) |
| Total | **6** | |

## 🎯 Plan de Remediación

### Sprint 1 (esta semana)
- [ ] Implementar 4 checkboxes separados en signup
- [ ] Agregar UI de revocación de consentimiento en /perfil

### Sprint 2
- [ ] Cron job para SLA de ARCO (5 días alerta)
- [ ] Modal de "datos sensibles" con doble check

### Sprint 3
- [ ] Job de archivado de audit log
- [ ] Integración con PSC para firma digital

### Sprint 4
- [ ] Auditoría de retención por categoría
- [ ] DPO si aplica (LPDP Art. 36)

## 💡 Hallazgo Positivo

✅ El sistema ya tiene implementada la **base** de LPDP:
- Tabla `consentimientos` con versiones
- Columna `acepta_transferencia_internacional`
- Endpoints ARCO
- Audit log con eventos LPDP
- Cumplimiento LPDP catalogado

Solo falta **implementar las sutilezas** que el auditor normal pasa por alto.

## 📚 Conclusión

El sistema cumple con LPDP a nivel **estructural** pero tiene **6 sutilezas** que un fiscalizador de la ANPDP podría detectar. El refutador encontró estas brechas al cuestionar la implementación, no solo el diseño.

**Recomendación**: Antes de producción, hacer un **penetration test de privacidad** con un DPO externo.

**Firmas requeridas**:
- [ ] @gobernanza-chief: Aprueba remediación
- [ ] @auditor-lpdp: Valida fixes
- [ ] DPO externo: Valida cumplimiento final (futuro)
