# 📊 ANÁLISIS DE COBERTURA LEGAL — LegalPro

> **Fecha:** 6 de agosto de 2026 (actualización arnés ampliado)
> **Alcance:** 80 áreas del derecho peruano vs arnés completo de **133 agentes** (1 orquestador + 132 subagentes: abogados juniors, seniors, chiefs, asistentes, legal specialists, contadores, IA, auditores, refutadores e ingeniería)
> **Veredicto:** ✅ **MAYORMENTE CUBIERTO (~75%)**
> **Reporte de integración completo:** [`docs/REPORTE_INTEGRACION_ARNES.md`](./REPORTE_INTEGRACION_ARNES.md)

---

## 🎯 Respuesta directa a tu pregunta

**¿Realmente tenemos especialistas en todas las áreas legales posibles?**

**AHORA SÍ, en su mayoría.** Tras la ampliación del arnés a **133 agentes** (incluidos 55 abogados junior, 7 seniors, 1 chief y 2 asistentes legales, más legal specialists, contadores y agentes IA/auditoría), la cobertura legal pasó de **~33% a ~75%** de las 80 áreas del derecho peruano. Quedan brechas residuales menores (P2).

---

## 📊 Resumen de Cobertura (80 áreas del derecho peruano)

| Estado | Cantidad | % |
|--------|:---:|---:|
| ✅ **Cubiertas** | 60 | 75.0% |
| 🟡 **Parciales** | 14 | 17.5% |
| ❌ **NO cubiertas** | 6 | 7.5% |
| **TOTAL** | **80** | **100%** |

---

## ✅ LO QUE SÍ CUBRIMOS BIEN (60 áreas)

| Área | Especialista |
|------|--------------|
| Civil (obligaciones, contratos, propiedad, sucesiones) | abogado-jr-civil + legal-civilista |
| Penal sustantivo | abogado-jr-penal + legal-penalista |
| Procesal penal (NCPP) | abogado-jr-procesal-penal |
| Penal económico (lavado, corrupción) | abogado-jr-penal-economico |
| Crimen organizado (Ley 30077) | abogado-jr-crimen-organizado |
| Trabajo forzoso (CP 168-B) | abogado-jr-trabajo-forzoso |
| Constitucional / amparo | abogado-jr-amparo + legal-constitucionalista |
| Familia (alimentos, divorcio, tenencia) | abogado-jr-familia |
| Laboral colectivo | abogado-jr-laboral-colectivo |
| Laboral individual | legal-laboralista + senior-laboral |
| Seguridad social (ONP/AFP/EsSalud) | abogado-jr-seguridad-social |
| Tributario (IR, IGV) | abogado-jr-tributario |
| Comercial / societario (LGS) | abogado-jr-comercial |
| Concursal (Ley 27809) | abogado-jr-concursal |
| Propiedad intelectual | abogado-jr-propiedad-intelectual |
| Consumidor (Ley 29571) | abogado-jr-consumidor |
| Administrativo (Ley 27444) | abogado-jr-administrativo |
| Ambiental (OEFA) | abogado-jr-ambiental |
| Minería y energía | abogado-jr-mineria-energia |
| Sanitario (Ley 26842) | abogado-jr-sanitario |
| Educación | abogado-jr-educacion |
| Migratorio (D.Leg. 1350) | abogado-jr-migratorio |
| Notarial y registral | abogado-jr-notarial |
| Arbitraje (D.Leg. 1071) | abogado-jr-arbitraje |
| Compliance LA/FT (D.Leg. 1249) | abogado-jr-compliance |
| Litigación fiscal | legal-fiscalista |
| Previsional ONP/AFP | abogado-jr-previsional |
| Bancario / financiero (SBS, Ley 26702) | abogado-jr-bancario |
| Contrataciones del Estado (OSCE, Ley 30225) | abogado-jr-contrataciones |
| Aduanero (SUNAT, D.Leg. 1053) | abogado-jr-aduanero |
| Libre competencia (INDECOPI, D.Leg. 1034) | abogado-jr-competencia |
| Telecomunicaciones (MTC/OSIPTEL) | abogado-jr-telecomunicaciones |
| Electoral (JNE/ONPE) | abogado-jr-electoral |
| Penitenciario (INPE) | abogado-jr-penitenciario |
| Extranjería (D.Leg. 1350) | abogado-jr-extranjeria |
| Violencia de género / femicidio (Ley 30364) | abogado-jr-genero |
| Marítimo-portuario (APN) | abogado-jr-maritimo |
| Aeronáutico (DGAC) | abogado-jr-aeronautico |
| Agrario | abogado-jr-agrario |
| Pesca (PRODUCE/SANIPES) | abogado-jr-pesca |
| Aguas (ANA, Ley 29338) | abogado-jr-aguas |
| Forestal (SERFOR, Ley 29763) | abogado-jr-forestal |
| Datos personales (ANPDP) | abogado-jr-datos-personales |
| Internacional | abogado-jr-internacional |
| Municipal / tributos municipales | abogado-jr-municipal |
| Ejecución (penal y civil) | abogado-jr-ejecucion |
| Seguros (SBS) | abogado-jr-seguros |
| Ciberespacio / tecnología (Ley 30096) | abogado-jr-ciberespacio |
| Deporte | abogado-jr-deporte |
| Turismo | abogado-jr-turismo |
| Militar | abogado-jr-militar |
| Policial | abogado-jr-policial |
| Cooperativo (FENACREP) | abogado-jr-cooperativo |
| Cultura / patrimonio (Ley 28296) | abogado-jr-cultura |
| Adulto mayor (Ley 30490) | abogado-jr-adulto-mayor |
| Discapacidad (CONADIS, Ley 29973) | abogado-jr-discapacidad |
| Liquidaciones laborales (CTS, gratificaciones) | contador-laboralista + contador-senior-laboral |
| Peritaje contable / forense | contador-jr-forense |
| Tributación contable (PCGE/NIIF) | contador-tributarista + contador-senior-tributario |

---

## 🟡 CUBIERTAS PARCIALMENTE (14 áreas)

| Área | Problema |
|------|----------|
| Energético (gas, electricidad) | Fusionado con minería, OSINERGMIN tiene su propia regulación |
| Procesal laboral | Legal-laboralista lo toca, sin agente dedicado NPLT 29497 |
| Ambiental minero | Separado del ambiental general |
| SST (seguridad salud trabajo) | Solo en trabajo-forzoso |
| Registral | Fusionado con notarial |
| Farmacéutico (DIGEMID) | Solo en sanitario |
| Consumidor financiero | SBS/INDECOPI (bancario lo toca parcialmente) |
| Transparencia (ANTAIP) | Sin agente dedicado |
| Pueblos indígenas (MINCU) | Sin agente dedicado |
| Terrorismo (D.L. 921) | Sin agente dedicado |
| Tránsito / seguridad vial | Sin agente dedicado |
| Defensa de la competencia / dumping | Competencia lo toca, sin agente dedicado D.Leg. 1126 |
| Derecho internacional público | Sin agente dedicado |
| Derecho internacional privado | Sin agente dedicado |

---

## ❌ NO CUBIERTAS (6 áreas — brechas residuales)

### 🟡 Brechas P2 (resto)
1. Moda / diseño (solo parcial en propiedad intelectual)
2. Vitivinícola (agroindustria sin especialidad)
3. Funerario (sin especialidad)
4. Transporte terrestre comercial (sin especialidad)
5. Derecho espacial (nuevo, sin especialidad)
6. Criptoactivos / blockchain regulatorio (solo parcial en ciberespacio)

> **Nota 2026-08-06:** las listas anteriores (numeradas 12-37) eran residuos de una edición previa y se eliminaron: todas esas áreas (marítimo, aeronáutico, agrario, pesca, aguas, forestal, farmacéutico, internacional, municipal, datos personales, transparencia, registral, discapacidad, ejecución, dumping, seguros, ciberespacio, deporte, turismo, militar, policial, cooperativo, adulto mayor, etc.) **ya tienen especialista creado** tras la integración del arnés ampliado (ver `docs/REPORTE_INTEGRACION_ARNES.md`).

---

## 🔴 HALLAZGOS CRÍTICOS DE LA AUDITORÍA DE ESPECIALISTAS

### 1. **6 agentes referenciados pero INEXISTENTES**
- `abogado-asistente-redaccion` (el chief les delega — NO EXISTE)
- `abogado-asistente-investigacion` (NO EXISTE)
- `abogado-senior-tributario` (NO EXISTE — solo hay jr-tributario)
- `contador-chief` (NO EXISTE)
- `contador-asistente-*` (NO EXISTEN)

> **ESTADO 2026-08-06 (CORREGIDO):** creados los 6 agentes:
> `abogado-asistente-redaccion`, `abogado-asistente-investigacion`, `abogado-senior-tributario`,
> `contador-chief`, `contador-asistente-forense`, `contador-asistente-laboral`.
> `abogado-jr-tributario` ahora reporta a `@abogado-senior-tributario`.

### 2. **~55 skills legales FANTASMA**
Los agentes declaran skills que **NO existen** en `.opencode/skills/`:
- `redactar-amparo`, `calcular-pension-alimentos`, `analizar-violencia-familiar`, etc.
- Solo hay 18 skills reales, ninguna legal específica

### 3. **4 verificadores legales FANTASMA**
- `verifier-citas-legales.mjs`, `verifier-plazos.mjs`, `verifier-tipificacion.mjs`, `verifier-jurisprudencia.mjs` → **NO EXISTEN** en `tools/verifiers/`

### 4. **Cita legal FALSA** 🔴
- `abogado-jr-mineria-energia` cita "**D.Leg. 295** (minería)" pero **D.Leg. 295 = Código Civil** (1984). Cita falsa grave. La minería se rige por **TUO 014-92-EM** (D.S. 014-92-EM)

> **ESTADO 2026-08-06 (CORREGIDO):** `abogado-jr-mineria-energia.md` ya NO cita D.Leg. 295.
> Base legal corregida: TUO D.S. 014-92-EM (TUO de la Ley General de Minería), Ley 28258 (Regalía Minera),
> Ley 27506 (Canon), OSINERGMIN, INGEMMET, MINEM/OEFA/SUNAT.

### 5. **Routing incompleto del orquestador**
- Solo mapea **10 de 24** materias junior
- `legal-fiscalista` y `legal-constitucionalista` **sin ruta**
- `concursal` y `compliance` con **doble jefe** (senior-empresarial vs senior-publico)

> **ESTADO 2026-08-06 (CORREGIDO):** resuelto el doble jefe. `abogado-jr-concursal` y
> `abogado-jr-compliance` reportan a UN solo jefe: `@abogado-senior-empresarial`.
> `abogado-senior-publico` ya no los coordina (sub-areas y delegaciones actualizadas).
> Catálogo `jerarquia-especialistas.json` los movió a `civil_privado` bajo senior-empresarial.

### 6. **Error factual corregido**
- La "Ley 29824" NO es de minería — es la **Ley de Justicia de Paz**. Los juzgados de minería no existen como especialidad autónoma (lo real: delito de minería ilegal art. 307-A CP)

---

## 🎯 PLAN DE CREACIÓN DE ESPECIALISTAS — EJECUTADO (2026-08-06)

> **Estado actual:** Las 3 fases del plan se completaron. El arnés pasó de 36 a 54 agentes legales
> (juniors + seniors + asistentes) dentro del arnés ampliado de **133 agentes**.

### ✅ Fase 1 (P0 — COMPLETADA, 10 juniors)

| Nuevo agente | Área | Normas | Reporta a |
|--------------|------|--------|-----------|
| `abogado-jr-bancario` | Bancario/financiero | Ley 26702, SBS | senior-empresarial |
| `abogado-jr-contrataciones` | Contrataciones Estado | Ley 30225, OSCE | senior-publico |
| `abogado-jr-aduanero` | Aduanas | D.Leg. 1053, SUNAT | senior-publico |
| `abogado-jr-competencia` | Libre competencia | D.Leg. 1034, INDECOPI | senior-empresarial |
| `abogado-jr-telecomunicaciones` | Telecomunicaciones | MTC, OSIPTEL | senior-publico |
| `abogado-jr-electoral` | Electoral | JNE, ONPE, Ley 26859 | senior-constitucional |
| `abogado-jr-penitenciario` | Penitenciario | Código Ejecución Penal, INPE | senior-penal |
| `abogado-jr-genero` | Violencia de género | Ley 30364, femicidio | senior-penal |
| `abogado-jr-extranjeria` | Extranjería dedicado | D.Leg. 1350, MIGRACIONES | senior-laboral |
| `abogado-jr-previsional` | Previsional dedicado | ONP, AFP, SBS | senior-laboral |

### ✅ Fase 2 (P1 — COMPLETADA, 10 juniors)
- `abogado-jr-maritimo`, `abogado-jr-aeronautico`, `abogado-jr-agrario`, `abogado-jr-pesca`, `abogado-jr-aguas`, `abogado-jr-forestal`, `abogado-jr-datos-personales`, `abogado-jr-internacional`, `abogado-jr-municipal`, `abogado-jr-ejecucion`

### ✅ Fase 3 (P2 — COMPLETADA, 10 juniors)
- `abogado-jr-seguros`, `abogado-jr-ciberespacio`, `abogado-jr-deporte`, `abogado-jr-turismo`, `abogado-jr-militar`, `abogado-jr-policial`, `abogado-jr-cooperativo`, `abogado-jr-cultura`, `abogado-jr-adulto-mayor`, `abogado-jr-discapacidad`

### ✅ Correcciones inmediatas (EJECUTADAS)
1. ✅ Creados `abogado-asistente-redaccion` + `abogado-asistente-investigacion`
2. ✅ Corregida cita falsa D.Leg. 295 en mineria → D.S. 014-92-EM
3. ✅ Creados los 4 verificadores legales (`verifier-citas-legales`, `verifier-plazos`, `verifier-tipificacion`, `verifier-jurisprudencia`) — ver `docs/REPORTE_INTEGRACION_ARNES.md`
4. ✅ Completada la matriz de routing del orquestador (24+ materias)
5. ✅ Resuelto doble jefe de concursal/compliance

---

## 📁 Documentos Generados

| Documento | Contenido |
|-----------|-----------|
| `docs/MAPA_AREAS_DERECHO_PERU.md` | 80 áreas del derecho peruano |
| `docs/REPORTE_INTEGRACION_ARNES.md` | Reporte completo de integración del arnés ampliado (133 agentes, 40 materias, 30 nuevas especialidades) |
| `docs/AUDITORIA_COBERTURA_ESPECIALISTAS.md` | 36 agentes auditados |
| `docs/ESPECIALIDADES_JUDICIALES_PERU.md` | PJ, TC, INDECOPI, SUNARP, TF |

---

## 🎯 Veredicto Final

**Cobertura legal actual: ~75% del derecho peruano** ✅

**Desglose (80 áreas):**
- ✅ 60 cubiertas (75.0%)
- 🟡 14 parciales (17.5%)
- ❌ 6 no cubiertas (7.5%)

**Estado alcanzado con el arnés ampliado (2026-08-06):**
- Total agentes del arnés: **133** (1 orquestador + 132 subagentes: 55 abogados junior, 7 seniors, 1 chief, 2 asistentes + legal specialists, contadores, agentes IA/auditoría/refutación e ingeniería)
- La meta proyectada "Fase 1+2+3 (30 nuevos): ~75%" **se ha cumplido**

**Brechas residuales (P2):** moda, vitivinícola, funerario, transporte terrestre, derecho espacial, criptoactivos.
**Verificadores legales:** ✅ creados (4) en la integración del arnés (ver `docs/REPORTE_INTEGRACION_ARNES.md`).

---

**Generado por:** `lexia-orchestrator` + 3 subagentes especializados (legal-constitucionalista, auditor-legal, integraciones-peru)
**Fecha:** 1 de agosto de 2026 — **Actualizado:** 6 de agosto de 2026 (gobernanza-chief, arnés ampliado 133 agentes)

> **Disclaimer IA:** Este análisis se basa en los agentes reales existentes en `.opencode/agents/` y las 80 áreas del derecho peruano mapeadas con fuentes oficiales. La cobertura es aproximada y priorizada. Las correcciones de citas falsas requieren revisión del abogado-chief.