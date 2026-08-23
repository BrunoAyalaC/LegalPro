# Reporte del Refutador: Legal

> **Agente**: @refutador-legal
> **Fecha**: 2026-06-12
> **Modo**: Adversarial (cuestiona respuestas legales)
> **Objetivo**: Encontrar errores jurídicos sutiles en citas, plazos, tipificaciones

## 🎯 Cuestionamientos Encontrados

### 🟠 HIGH: Citas sin verificar contra SPIJ

**Vector**: El sistema cita "CPC art. 367" pero NO verifica contra SPIJ si el artículo está vigente o derogado.

**Estado actual** (catalogs/codigos-leyes.json):
- ✅ Lista los 20 códigos/leyes principales
- ⚠️ Sin campo "vigente" o "derogado"
- ⚠️ Sin "ultima_modificacion"

**Recomendación**:
- Agregar campo `vigente: boolean` y `ultima_modificacion: date` a cada norma
- Validar antes de citar
- Mantener actualizado vía SPIJ (o mock)

**Probabilidad de error**: ALTA (0.6)
**Impacto**: Citar una norma derogada puede invalidar un escrito

---

### 🟠 HIGH: Plazos sin considerar días no hábiles

**Vector**: `calcular_plazos(acto, fecha, tipo)` considera "5 días hábiles" pero el catálogo no incluye los feriados del MINJUS.

**Estado actual** (catalogs/plazos-procesales.json):
- ✅ Lista 17 plazos
- ⚠️ Sin lista de feriados peruanos (Fiestas Patrias, Navidad, etc.)
- ⚠️ Sin validación de "dies a quem" (¿cuándo se cuenta desde?)

**Recomendación**:
- Catálogo `catalogs/feriados-peru.json` con 16+ feriados fijos y móviles
- Lógica: saltar feriados, contar solo lunes a viernes
- UI: "Plazo vence: [fecha]" con feriados resaltados

**Probabilidad de error**: ALTA (0.7) en diciembre y julio

---

### 🟠 HIGH: Tipificación penal sin verificar in dubio pro reo

**Vector**: El sistema dice "Esto es CP art. 124 lesiones graves" sin considerar que podría ser art. 122 lesiones leves (in dubio pro reo).

**Estado actual** (catalogs/tipos-penales-peru.json):
- ✅ 25 tipos penales
- ⚠️ Sin "rango_pena" para evaluar gravedad
- ⚠️ Sin "eximentes" reconocidas
- ⚠️ Sin "atenuantes"

**Recomendación**:
- Catálogo más completo con rango_pena, eximentes, atenuantes
- Lógica: "tipicidad provisional" + disclaimer de verificación

**Probabilidad de error**: MEDIA (0.4) en casos penales

---

### 🟡 MEDIUM: Jurisprudencia sin verificar vinculancia

**Vector**: El sistema cita "Casación 1234-2015" como si fuera vinculante, pero podría ser solo orientadora.

**Estado actual** (arneses/fixtures/jurisprudencia-pin.json):
- ✅ 4 sentencias de ejemplo
- ⚠️ Sin campo "vinculante: bool" en la mayoría
- ⚠️ Sin "derogada_por" o "modificada_por"

**Recomendación**:
- Catálogo más completo con vinculancia
- Lógica: si no es vinculante, disclaimer obligatorio

---

### 🟡 MEDIUM: Estrategia procesal sin ética

**Vector**: El sistema sugiere estrategias agresivas (e.g., "objecionar todo") sin considerar la ética del abogado (CPC art. 132 buena fe procesal).

**Estado actual**:
- ✅ 16 herramientas IA
- ⚠️ Sin validación de ética procesal

**Recomendación**:
- Skill `validar-etica-procesal`
- Regla: "No sugerir tácticas contrarias a la buena fe"

---

### 🟡 MEDIUM: LOPJ art. 290 vs LPDP art. 24 (conflicto de normas)

**Vector**: LOPJ art. 290 obliga a fundamentar, LPDP art. 24 obliga a notificar breach en <=5 días. Si el sistema cita ambos al mismo tiempo, hay conflicto de prelación.

**Recomendación**:
- Skill `resolver-conflicto-normas`
- Aplicar jerarquía: Constitución > Ley > Decreto

---

## 📊 Resumen de Hallazgos

| Severidad | Cantidad | Acción |
|---|---|---|
| 🟠 HIGH | 3 | Sprint 1-2 |
| 🟡 MEDIUM | 3 | Sprint 2-3 |
| Total | **6** | |

## 🎯 Plan de Remediación

### Sprint 1
- [ ] Agregar `vigente: bool` a codigos-leyes.json
- [ ] Agregar catálogo de feriados peruanos
- [ ] Agregar `rango_pena` a tipos-penales-peru.json

### Sprint 2
- [ ] Crear skill `validar-etica-procesal`
- [ ] Mejorar jurisprudencia con vinculancia
- [ ] Crear skill `resolver-conflicto-normas`

### Sprint 3
- [ ] Test adversarial: el refutador-legal ejecuta contra el código
- [ ] Documentar jurisprudencia vinculante vs orientadora

## 💡 Conclusión

El sistema es **técnicamente correcto** pero **jurídicamente mejorable**. Los 6 issues encontrados por el refutador son sutilezas que un abogado junior pasaría por alto pero que un litigante senior detectaría.

**Firmas requeridas**:
- [ ] @abogado-chief: Aprueba remediación
- [ ] @auditor-legal: Valida fixes
- [ ] @abogado-senior-penal: Valida refitador
- [ ] @abogado-senior-civil: Valida refitador
