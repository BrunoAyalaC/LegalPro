# Especialidades Judiciales Reales del Perú vs LegalPro

> **Investigación a cargo de**: @integraciones-peru
> **Fecha de consulta**: 2026-08-06
> **Fuentes oficiales consultadas**:
> - CEJ (Consulta de Expedientes Judiciales) del PJ — https://cej.pj.gob.pe/cej/ (verificado en vivo, versión 2.5.0)
> - TC — https://www.tc.gob.pe/institucional/acerca/ (verificado)
> - INDECOPI — https://www.gob.pe/institucion/indecopi/institucional (verificado)
> - SUNARP — https://www.gob.pe/institucion/sunarp/institucional + catálogo interno `catalogs/directivas-sunarp-2026.json`
> - Tribunal Fiscal — catálogo interno `catalogs/resoluciones-tribunal-fiscal-2026.json` (fuente: mef.gob.pe/es/tribunal-fiscal)
> - SPIJ — https://spij.minjus.gob.pe (base legal)
>
> **Nota de honestidad**: La web directa `www.pj.gob.pe` devolvió errores de transporte en la sesión; la fuente primaria de especialidades usada es el **CEJ real** (sistema oficial de consulta del PJ, verificado navegando el formulario) complementada con la Ley Orgánica del Poder Judicial (D.S. 017-93-JUS) y normas especiales. Toda especialidad sin soporte verificado se marca como tal.

---

## 0. Método y fuentes de LegalPro

La comparación usa el arnés de agentes definido en `catalogs/jerarquia-especialistas.json` y los agentes registrados en el proyecto (AGENTS.md raíz). "Cobertura" significa que existe un especialista cuyo alcance expreso corresponde a la materia del juzgado. La cobertura parcial significa que el especialista toca la materia de forma transversal, no dedicada.

---

## 1. Poder Judicial

### 1.1 Especialidades verificadas en el CEJ (consulta real, 06/08/2026)

El CEJ lista estas especialidades para los órganos jurisdiccionales (Juzgado Especializado, Juzgado Mixto, Juzgado de Paz Letrado, Sala Superior) en distritos judiciales LIMA, HUAURA, AMAZONAS, entre otros:

| Especialidad CEJ | Órganos donde aparece | ¿LegalPro cubre? | Especialista LegalPro |
|---|---|---|---|
| CIVIL | Juzgado Especializado, Mixto, Paz Letrado, Sala Superior | ✅ Sí | @abogado-jr-civil → @abogado-senior-civil |
| COMERCIAL | Juzgado Especializado, Mixto, Paz Letrado, Sala Superior | ✅ Sí | @abogado-jr-comercial → @abogado-senior-empresarial |
| CONTENCIOSO ADMINISTRATIVO | Juzgado Especializado, Mixto, Sala Superior | ✅ Sí | @abogado-jr-administrativo → @abogado-senior-publico |
| DERECHO CONSTITUCIONAL | Juzgado Especializado, Mixto, Sala Superior | ✅ Sí | @abogado-jr-amparo → @abogado-senior-constitucional |
| FAMILIA CIVIL | Todos los órganos | ✅ Sí | @abogado-jr-familia → @abogado-senior-civil |
| FAMILIA TUTELAR | Todos los órganos | ✅ Sí | @abogado-jr-familia → @abogado-senior-civil |
| LABORAL | Todos los órganos | ✅ Sí | @abogado-jr-laboral-colectivo, @abogado-jr-seguridad-social → @abogado-senior-laboral |

**Nota CEJ**: la especialidad PENAL no aparece en el selector del CEJ de búsqueda por filtros (los expedientes penales usan codificación propia y módulos/consulta aparte), pero los juzgados penales son una especialidad real de la LOPJ (ver 1.2).

### 1.2 Especialidades de la Ley Orgánica del Poder Judicial (D.S. 017-93-JUS) y normas especiales

| Especialidad | Juzgados / Órganos reales | ¿LegalPro cubre? | Especialista LegalPro |
|---|---|---|---|
| **Juzgados civiles** | Juzgados especializados y mixtos en lo civil; competencia en obligaciones, contratos, propiedad, prescripción, sucesiones | ✅ Sí | @abogado-jr-civil → @abogado-senior-civil |
| **Juzgados penales** | Juzgados de investigación preparatoria, unipersonales y colegiados (NCPP, D.L. 957); juzgados penales especializados | ✅ Sí | @abogado-jr-penal, @abogado-jr-procesal-penal → @abogado-senior-penal |
| **Juzgados laborales / de trabajo** | Juzgados de trabajo (NLPT, Ley 29497); antes "juzgados de trabajo" de la LOPJ | ✅ Sí | @abogado-jr-laboral-colectivo, @abogado-jr-seguridad-social → @abogado-senior-laboral |
| **Juzgados de familia** | Juzgados de familia civil y tutelar (alimentos, divorcio, tenencia, adopción, medidas de protección) | ✅ Sí | @abogado-jr-familia → @abogado-senior-civil |
| **Juzgados constitucionales** | Juzgados mixtos y especializados en lo constitucional (procesos constitucionales en primera instancia) | ✅ Sí | @abogado-jr-amparo → @abogado-senior-constitucional |
| **Juzgados contencioso-administrativo** | Juzgados especializados en lo contencioso-administrativo (Ley 27584); demandas contra el Estado | ✅ Sí | @abogado-jr-administrativo → @abogado-senior-publico |
| **Juzgados de paz letrado** | Juzgados de paz letrado (cuantía menor, procesos sumarísimos) | ⚠️ Parcial | @abogado-jr-civil (cubre materia civil de menor cuantía, no es un especialista dedicado a la especialidad de paz letrado) |
| **Juzgados comerciales** | Juzgados especializados en lo comercial (títulos valores, sociedades, obligaciones mercantiles) | ✅ Sí | @abogado-jr-comercial → @abogado-senior-empresarial |
| **Juzgados de ejecución** | Juzgados de ejecución penal (D.L. 1307, Ley 30076 reforma ejecución penal) y en algunas cortes juzgados de ejecución en lo civil | ⚠️ **BRECHA** | No hay especialista dedicado a fase de ejecución penal ni ejecución forzosa civil (¿) — parcialmente @abogado-jr-procesal-penal y @abogado-jr-civil |
| **Juzgados especializados en violencia contra la mujer** | Juzgados de familia especializados en violencia (Ley 30364) y juzgados penales especializados en femicidio/violencia de género; medidas de protección | ⚠️ Parcial | @abogado-jr-familia cubre medidas de protección; **no existe especialista dedicado a violencia de género/femicidio** |
| **Juzgados de tránsito / seguridad vial** | Juzgados especializados en tránsito y seguridad vial (Lima y algunas cortes; también fiscalías de tránsito) | ❌ **BRECHA** | No hay especialista |
| **Juzgados agrarios** | Juzgados agrarios (competencia en tierras, aguas, actividad agropecuaria; Ley 27322 y normas de tierras) | ⚠️ Parcial | @abogado-jr-ambiental toca recursos naturales; **no hay especialista agrario dedicado** |
| **Juzgados de minería** | **Aclaración**: NO existe una especialidad "juzgado de minería" como tal. La Ley 29824 es la **Ley de Justicia de Paz**, no de minería. Lo que existe: (i) juzgados penales especializados en **minería ilegal** (delito del art. 307-A CP) en cortes de Madre de Dios, Puno, Arequipa, Cusco; (ii) competencia administrativa minera (INGEMMET, OEFA, MINEM) que llega al contencioso-administrativo | ⚠️ Parcial | @abogado-jr-mineria-energia (minería legal/administrativa); @abogado-jr-penal-economico (delitos conexos). **No hay especialista en delito de minería ilegal dedicado** |
| **Juzgados de agua** | Juzgados agrarios asumen controversias de aguas; Autoridad Nacional del Agua (ANA) resuelve administrativamente; jurisdicción contencioso-administrativa | ❌ **BRECHA** | No hay especialista en derecho de aguas/recursos hídricos (Ley 29338) |
| **Juzgados anticorrupción** | Juzgados y salas anticorrupción (delitos de corrupción de funcionarios: colusión, peculado, cohecho, enriquecimiento ilícito) | ✅ Sí | @abogado-jr-penal-economico → @abogado-senior-penal |
| **Juzgados de terrorismo** | Juzgados penales especializados en terrorismo (D.L. 921; Sala Penal Nacional con competencia en terrorismo y crimen organizado) | ❌ **BRECHA** | No hay especialista dedicado en terrorismo/seguridad nacional |
| **Juzgados de crimen organizado** | Juzgados especializados en criminalidad organizada (Ley 30077, D.L. 1307; Sala Penal Nacional) | ✅ Sí | @abogado-jr-crimen-organizado → @abogado-senior-penal |

### 1.3 Otras competencias reales del PJ (no jurisdiccional ordinaria pero relevante)

| Especialidad | Realidad | ¿LegalPro cubre? | Especialista LegalPro |
|---|---|---|---|
| **Casación / Corte Suprema** | Salas supremas: Civil, Penal, Constitucional y Social, Laboral, Contencioso-Administrativo, Transitorias | ✅ Sí (parcial) | @abogado-jr-civil, @abogado-jr-penal, @abogado-jr-procesal-penal etc. → seniors. Catálogo `casaciones-pj-2026.json` cubre principalmente casaciones penales |
| **Justicia de paz no letrada** | Jueces de paz (comunidades) — Ley 29824 | ❌ **BRECHA** | No hay especialista (rural/comunal) |

---

## 2. Tribunal Constitucional

Según el Código Procesal Constitucional (Ley 31307, que sustituyó la Ley 28237) y la página oficial del TC (art. 202 de la Constitución), existen **7 procesos constitucionales**:

| Proceso constitucional | Instancia | ¿LegalPro cubre? | Especialista LegalPro |
|---|---|---|---|
| **Hábeas corpus** | Primera instancia: juzgados penales/mixtos; última instancia: TC | ✅ Sí | @abogado-jr-amparo (ámbito constitucional) → @abogado-senior-constitucional; parcial @abogado-jr-procesal-penal |
| **Amparo** | Primera instancia: juzgados constitucionales/mixtos; última instancia: TC | ✅ Sí | @abogado-jr-amparo → @abogado-senior-constitucional |
| **Hábeas data** | Primera instancia; última instancia: TC | ✅ Sí | @abogado-jr-amparo → @abogado-senior-constitucional; sinergia con @abogado-jr-compliance (datos personales) y @auditor-lpdp |
| **Proceso de cumplimiento** | Primera instancia; última instancia: TC | ✅ Sí | @abogado-jr-amparo → @abogado-senior-constitucional |
| **Acción de inconstitucionalidad** | Instancia única: TC | ✅ Sí | @abogado-senior-constitucional |
| **Acción popular** | Primera instancia: Sala Constitucional y Social de la Corte Suprema | ✅ Sí | @abogado-senior-constitucional |
| **Conflicto de competencias (proceso competencial)** | Instancia única: TC | ✅ Sí | @abogado-senior-constitucional |

**Hallazgo**: LegalPro ya tiene catálogo `jurisprudencia-tc-2026.json` y `sentencias-tc-completas-2026.json` con casos reales de HC, amparo e inconstitucionalidad. La cobertura procesal constitucional es **sólida**.

---

## 3. INDECOPI

Competencias reales del INDECOPI (D.L. 25868 + normas especiales; confirmado en su página institucional oficial):

| Competencia INDECOPI | Órgano/sala real | ¿LegalPro cubre? | Especialista LegalPro |
|---|---|---|---|
| **Defensa de la competencia** | Comisión de Defensa de la Libre Competencia; prácticas anticompetitivas (cárteles, abuso de posición de dominio) | ⚠️ **BRECHA** | No hay especialista en libre competencia/antitrust (parcial @abogado-jr-comercial y @abogado-jr-compliance) |
| **Competencia desleal / publicidad comercial** | Comisión de Fiscalización de la Competencia Desleal (D.L. 1044); publicidad engañosa, actos de competencia desleal | ❌ **BRECHA** | No hay especialista dedicado en publicidad comercial / competencia desleal |
| **Protección al consumidor** | Comisión de Protección al Consumidor (Ley 29571 Código de Protección y Defensa del Consumidor) | ✅ Sí | @abogado-jr-consumidor → @abogado-senior-civil |
| **Propiedad intelectual – marcas** | Dirección de Signos Distintivos; Sala de Propiedad Intelectual | ✅ Sí | @abogado-jr-propiedad-intelectual → @abogado-senior-civil |
| **Propiedad intelectual – patentes** | Dirección de Invenciones y Nuevas Tecnologías | ✅ Sí | @abogado-jr-propiedad-intelectual → @abogado-senior-civil |
| **Propiedad intelectual – derechos de autor** | Dirección de Derecho de Autor | ✅ Sí | @abogado-jr-propiedad-intelectual → @abogado-senior-civil |
| **Procedimientos concursales** | Comisión de Procedimientos Concursales (Ley 27809); reestructuración y disolución/liquidación | ✅ Sí | @abogado-jr-concursal → @abogado-senior-empresarial |
| **Eliminación de barreras burocráticas** | Comisión de Eliminación de Barreras Burocráticas (D.L. 1256) | ⚠️ **BRECHA** | No hay especialista dedicado (parcial @abogado-jr-administrativo) |
| **Dumping y subvenciones** | Comisión de Dumping, Subsidios y Eliminación de Barreras Comerciales No Arancelarias | ❌ **BRECHA** | No hay especialista en comercio exterior / medidas de defensa comercial |
| **Acreditación de firmas digitales** | Acreditación de prestadores de servicios de certificación (firma digital, Ley 27269) | ⚠️ Parcial | @abogado-jr-compliance + @ia-boveda-evidencia (firma digital); no es su foco principal |

**Hallazgo**: El catálogo `resoluciones-indecopi-2026.json` de LegalPro contiene mayormente resoluciones administrativas internas del INDECOPI (TUPA, designaciones, presupuesto); **NO contiene precedentes sustantivos** de las comisiones (consumidor, competencia, PI, concursal) que son lo que un abogado necesita. Brecha de contenido real.

---

## 4. SUNARP – Tribunal Registral

| Especialidad | Realidad | ¿LegalPro cubre? | Especialista LegalPro |
|---|---|---|---|
| **Precedentes registrales** | El Tribunal Registral emite precedentes de observancia obligatoria para todas las zonas registrales (resoluciones del Tribunal Registral); catálogo interno ya registra su URL oficial (`resolucionestribunal.sunarp.gob.pe/sir-tribunal-publico`) | ⚠️ Parcial | @abogado-jr-notarial → @abogado-senior-civil; **el catálogo no contiene aún precedentes del Tribunal Registral descargados** (solo directivas/resoluciones de gestión) |
| **Primera instancia registral** | Registradores públicos de las 14 zonas registrales (calificación registral) | ⚠️ Parcial | @abogado-jr-notarial (actividad notarial/registral) |
| **Segunda instancia registral** | Tribunales registrales (Sala 1 y Sala 2) resuelven apelaciones contra la calificación registral | ⚠️ Parcial | @abogado-jr-notarial |
| **Registros públicos** | Registro de Predios, Personas Naturales, Personas Jurídicas, Bienes Muebles, Garantías Mobiliarias, Propiedad Inmueble | ✅ Sí (parcial) | @abogado-jr-notarial → @abogado-senior-civil |

**Brecha SUNARP**: existe catálogo de directivas (`directivas-sunarp-2026.json`) pero **falta integración del SIR-Tribunal-Publico** (precedentes reales del Tribunal Registral), que es la fuente de mayor valor jurídico.

---

## 5. Tribunal Fiscal

Tribunal Fiscal (órgano resolutivo del MEF, última instancia administrativa tributaria). Materias reales según boletines de jurisprudencia 2026 (catálogo interno):

| Materia | Ámbito real | ¿LegalPro cubre? | Especialista LegalPro |
|---|---|---|---|
| **Impuesto a la Renta (IR)** | 1ra a 5ta categoría, no domiciliados, Renta empresarial | ✅ Sí | @abogado-jr-tributario → @contador-senior-tributario |
| **IGV** | IGV, reintegros, crédito fiscal, exportaciones | ✅ Sí | @abogado-jr-tributario → @contador-senior-tributario |
| **Aduanas** | Valoración aduanera, sanciones aduaneras, comercio exterior | ⚠️ **BRECHA** | No hay especialista en derecho aduanero (parcial @abogado-jr-tributario / @contador-tributarista) |
| **Tributos municipales** | Predial, alcabala, impuestos municipales | ⚠️ **BRECHA** | No hay especialista en tributación municipal (parcial @abogado-jr-tributario) |
| **Arbitrios** | Arbitrios municipales (limpieza pública, parques y jardines, serenazgo) | ⚠️ **BRECHA** | No hay especialista dedicado (casuística contencioso-administrativa y municipal) |
| **Procedimiento tributario** | Código Tributario: notificaciones, medios probatorios, fiscalización, prescripción, cobranza coactiva, infracciones | ✅ Sí | @abogado-jr-tributario → @contador-senior-tributario |
| **Resoluciones de observancia obligatoria** | Acuerdos de Sala Plena del TF (jurisprudencia de observancia obligatoria) | ✅ Sí (catálogo) | Catálogo `resoluciones-tribunal-fiscal-2026.json` registra boletines; falta descarga profunda de RTF individuales |

---

## 6. Brechas Prioritarias

Ranking por: (1) volumen real de litigio en Perú, (2) ausencia total vs parcial, (3) valor para el abogado usuario.

### 🟥 Críticas (no cubiertas — especialistas dedicados ausentes)

| # | Especialidad real | Por qué importa | Acción recomendada |
|---|---|---|---|
| 1 | **Violencia contra la mujer / femicidio (Ley 30364)** | Área de litigio masivo (medidas de protección, procesos por violencia), con normativa propia y juzgados especializados reales | Crear `@abogado-jr-violencia-genero` → @abogado-senior-civil/penal; catálogo de plazos de medidas de protección (Ley 30364) |
| 2 | **Juzgados de tránsito / seguridad vial** | Litigio de altísimo volumen (accidentes de tránsito, penal de tránsito, indemnizaciones) | Crear especialista en tránsito/accidentes; integración con SUNARP (vehículos) y peritos |
| 3 | **Juzgados de ejecución penal y civil** | Fase de ejecución es donde muere el 90% de los procesos; redacción de escritos de ejecución, extinción de dominio conexo | Crear `@abogado-jr-ejecucion` (penal + civil) |
| 4 | **Tribunal Fiscal – aduanas** | Comercio exterior creciente; sanciones aduaneras y valoración son litigio especializado | Crear `@abogado-jr-aduanero` → @abogado-senior-tributario |
| 5 | **Juzgados de terrorismo** | Seguridad nacional; competencia especial (Sala Penal Nacional, D.L. 921) sin ningún especialista | Crear especialista en terrorismo/crimen organizado ampliado |
| 6 | **Derecho de aguas (Ley 29338)** | Conflictos hídricos, ANA, juzgados agrarios de aguas; sector estratégico | Crear `@abogado-jr-aguas` → @abogado-senior-publico |

### 🟧 Altas (parciales — existe cobertura transversal pero no dedicada)

| # | Especialidad real | Estado actual LegalPro | Acción recomendada |
|---|---|---|---|
| 7 | **Defensa de la competencia (antitrust)** | Solo parcial @abogado-jr-comercial/compliance | Crear `@abogado-jr-libre-competencia`; alimentar con precedentes de la Comisión |
| 8 | **Barreras burocráticas (D.L. 1256)** | Parcial @abogado-jr-administrativo | Especialista en barreras burocráticas y arbitraje de barreras |
| 9 | **Publicidad comercial / competencia desleal** | Sin especialista | Crear `@abogado-jr-publicidad`; normativa D.L. 1044 |
| 10 | **Dumping / defensa comercial** | Sin especialista | Crear `@abogado-jr-comercio-exterior` |
| 11 | **Tributos municipales y arbitrios** | Parcial @abogado-jr-tributario | Especialista municipal (predial/alcabala/arbitrios) |
| 12 | **Minería ilegal (delito)** | Parcial @abogado-jr-penal-economico y @abogado-jr-mineria-energia | Especialista en delitos ambientales/minería ilegal |
| 13 | **Juzgados agrarios** | Parcial @abogado-jr-ambiental | Especialista en tierras (leyes 27322, 26845) y comunidades |
| 14 | **Justicia de paz no letrada** | Sin especialista | Especialista en justicia comunal (Ley 29824) |
| 15 | **Tribunal Registral (precedentes)** | Catálogo de directivas existe; faltan precedentes SIR-Tribunal | Integrar API/extracción de precedentes del Tribunal Registral |
| 16 | **Paz letrado** | Cubierto transversal por civil | No urgente, documentar mapeo materia→juzgado |

### 🟩 Fortalezas confirmadas (cubiertas)

- Civil (obligaciones, contratos, propiedad, sucesiones) ✅
- Penal (sustantivo + procesal, NCPP) ✅
- Laboral (individual/colectivo + seguridad social) ✅
- Familia (civil y tutelar) ✅
- Constitucional (los 7 procesos del TC) ✅
- Contencioso-administrativo ✅
- Comercial / societario ✅
- Consumidor (INDECOPI) ✅
- Propiedad intelectual (marcas, patentes, derechos de autor) ✅
- Concursal ✅
- Anticorrupción ✅
- Crimen organizado ✅
- Tributario (IR, IGV, procedimiento, TF) ✅

---

## 7. Recomendación técnica (integraciones)

1. **CEJ**: implementar mock-first del buscador de expedientes con las 7 especialidades verificadas (CIVIL, COMERCIAL, CONTENCIOSO ADMINISTRATIVO, DERECHO CONSTITUCIONAL, FAMILIA CIVIL, FAMILIA TUTELAR, LABORAL) + campos distrito judicial (33), órgano jurisdiccional (4 tipos) y años 1977-2026.
2. **SIR-Tribunal-Publico (SUNARP)**: nueva integración para precedentes del Tribunal Registral — alto valor jurídico, hoy no integrado.
3. **Tribunal Fiscal**: profundizar descarga de RTF individuales (hoy solo boletines mensuales en catálogo).
4. **INDECOPI**: agregar precedentes sustantivos de comisiones (consumidor, competencia, PI, concursal) — hoy el catálogo tiene resoluciones administrativas internas de bajo valor.
5. **PJ - violencia de género**: monitorear normativa Ley 30364 para nuevo especialista (brecha crítica).
6. **Aclaración Ley 29824**: es la Ley de Justicia de Paz (no de minería); no crear catálogo "juzgados de minería" basado en ese número — usar art. 307-A CP (minería ilegal) y competencia ANA/INGEMMET según corresponda.

---

*Generado por @integraciones-peru. Este documento es un inventario de especialidades judiciales reales; no constituye asesoría legal.*
