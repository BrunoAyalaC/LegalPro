# Mapa de Áreas del Derecho Peruano

> **Versión:** 1.1.0
> **Fecha:** 6 de agosto de 2026
> **Actualización 2026-08-06 (arnés ampliado):** los estados `NO` → `SÍ` de este mapa fueron actualizados para reflejar los **30 especialistas creados** (3 fases) en la integración del arnés ampliado de **133 agentes**. Las áreas marcadas `SÍ` tienen un agente `.md` real en `.opencode/agents/`. Ver `docs/REPORTE_INTEGRACION_ARNES.md`.
> **Propósito:** Inventario exhaustivo de TODAS las áreas del derecho peruano, mapeadas contra la cobertura de especialistas de LegalPro (abogados junior, senior, legal specialists).
> **Fuentes verificadas:** SPIJ (MINJUSDH), gob.pe (estructura del Estado peruano), catálogos del proyecto (`catalogs/codigos-leyes.json`, `catalogs/reguladores-peru.json`, `catalogs/jerarquia-especialistas.json`), doctrina y normativa vigente peruana.
> **Metodología:** Clasificación por rama (público/privado/social/mixto/internacional/emergente) → normas principales → organismo regulador → cobertura LegalPro (SÍ / NO / PARCIAL) → especialista responsable.

---

## Cómo leer este documento

- **¿LegalPro?** refleja si existe un agente especializado (junior, senior o legal specialist) que cubra razonablemente el área.
  - `SÍ` → hay agente dedicado (`.md` real en `.opencode/agents/`, creado o ampliado al 2026-08-06).
  - `PARCIAL` → hay agente que la cubre de forma tangencial o fusionada (p. ej. `abogado-jr-mineria-energia` cubre energía y minería juntas).
  - `NO` → **brecha real**: no existe especialista.
- **Especialista** indica el agente o agentes actuales que atienden el área.
- Las **brechas** están priorizadas al final (P0 / P1 / P2) según demanda de mercado legal peruano, litigiosidad y oportunidad de negocio para LegalPro.
- **Nota de consistencia:** los conteos del resumen (filas individuales de las 80 áreas) pueden diferir de los de `docs/ANALISIS_COBERTURA_LEGAL.md` (60 cubiertas / 14 parciales / 6 sin cubrir), porque el análisis consolida sub-áreas en filas agregadas (p. ej. una fila "Internacional" agrupa internacional público + privado).

---

# 1. Derecho Público

## 1.1 Derecho Constitucional
- **Normas:** Constitución Política del Perú 1993, Ley 28237 (Código Procesal Constitucional), Ley 26435 (Orgánica del TC), jurisprudencia y precedentes vinculantes del TC.
- **Regulador:** Tribunal Constitucional (TC), MINJUSDH (SPIJ).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-senior-constitucional`, `legal-constitucionalista`, `abogado-jr-amparo`, `abogado-chief`.

## 1.2 Derecho Procesal Constitucional (amparo, habeas corpus, habeas data, acción popular, acción de inconstitucionalidad)
- **Normas:** Ley 28237, Constitución art. 200 incs. 1–6.
- **Regulador:** TC, Poder Judicial (procesos de amparo en primera instancia).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-amparo`, `legal-constitucionalista`, `abogado-senior-constitucional`.

## 1.3 Derecho Administrativo General
- **Normas:** TUO de la Ley 27444 (D.S. 004-2019-JUS), Ley 27584 (proceso contencioso-administrativo), Ley 27806 (transparencia y acceso a la información).
- **Regulador:** PCM (SERVIR, CEPLAN), entidades de la Administración Pública, Poder Judicial (contencioso).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-administrativo`, `abogado-senior-publico`.

## 1.4 Derecho Procesal Administrativo / Contencioso-Administrativo
- **Normas:** Ley 27584 y TUO (D.S. 011-2021-JUS), Código Procesal Civil (supletorio).
- **Regulador:** Poder Judicial (juzgados y salas contencioso-administrativas).
- **¿LegalPro?** PARCIAL
- **Especialista:** `abogado-jr-administrativo`, `abogado-senior-publico` (cubren la vía procesal sin agente dedicado al contencioso puro).

## 1.5 Derecho Tributario (nacional)
- **Normas:** TUO Código Tributario (D.S. 133-2013-EF), TUO Ley del IGV (D.S. 055-99-EF), TUO Ley del IR (D.S. 179-2004-EF), TUO Ley del Impuesto Predial, Ley 28194 (bancarización), D.S. 085-2007-EF.
- **Regulador:** SUNAT, Tribunal Fiscal, MEF.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-tributario`, `legal-fiscalista`, `contador-senior-tributario`, `contador-tributarista`, `abogado-senior-publico`.

## 1.6 Derecho Tributario Municipal
- **Normas:** TUO de la Ley de Tributación Municipal (D.L. 776), Impuesto Predial, Alcabala, Arbitrios, Impuesto al Patrimonio Vehicular, Ley 27444 (procedimiento).
- **Regulador:** Municipalidades, SAT (Lima), Tribunal Fiscal (apelaciones).
- **¿LegalPro?** PARCIAL
- **Especialista:** `abogado-jr-tributario`, `abogado-jr-administrativo` (sin agente dedicado a tributos locales).

## 1.7 Derecho Aduanero
- **Normas:** Ley General de Aduanas (D.L. 1053) y TUO (D.S. 149-2016-EF), Ley 29171 (contrabando y defraudación de rentas de aduana), Decisión 571 CAN (valor aduanero), OMC.
- **Regulador:** SUNAT (Intendencia Nacional de Aduanas), Tribunal Fiscal.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-aduanero` (creado 2026-08-06, Fase 1).

## 1.8 Derecho Penal Sustantivo
- **Normas:** Código Penal (D.L. 635, TUO D.S. 011-2024-JUS).
- **Regulador:** Poder Judicial, Ministerio Público (Fiscalía).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-penal`, `legal-penalista`, `abogado-senior-penal`, `legal-fiscalista` (perspectiva fiscal).

## 1.9 Derecho Procesal Penal
- **Normas:** Nuevo Código Procesal Penal (D.L. 957), Ley 30076, Ley 30364 (parte procesal penal).
- **Regulador:** Ministerio Público, Poder Judicial (juzgados de investigación preparatoria, juzgamiento), INPE.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-procesal-penal`, `abogado-senior-penal`, `legal-fiscalista`, `legal-penalista`.

## 1.10 Derecho Penal Económico
- **Normas:** D.L. 1249 (lavado de activos), delitos de corrupción (CP arts. 382–401), D.L. 1106 (colusión, corrupción funcionarios), Ley 30424 (responsabilidad penal de personas jurídicas).
- **Regulador:** Ministerio Público, Poder Judicial, UIF-Perú, SBS.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-penal-economico`, `abogado-jr-crimen-organizado`, `abogado-jr-compliance`.

## 1.11 Derecho Penal de Crimen Organizado
- **Normas:** Ley 30077 (crimen organizado), Ley 27378 (cooperación eficaz), D.L. 957 (proceso especial).
- **Regulador:** Ministerio Público, Poder Judicial, PNP.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-crimen-organizado`, `abogado-jr-procesal-penal`.

## 1.12 Derecho Electoral
- **Normas:** Ley 26859 (Ley Orgánica de Elecciones), Ley 26487 (ONPE), Ley 26486 (JNE), Ley 28094 (organizaciones políticas), Ley 26864 (elecciones municipales).
- **Regulador:** JNE, ONPE, RENIEC.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-electoral` (creado 2026-08-06, Fase 1).

## 1.13 Derecho Municipal / Local
- **Normas:** Ley 27972 (Ley Orgánica de Municipalidades), Ley 27958, normas de gestión local, licencias, ordenanzas.
- **Regulador:** Municipalidades provinciales y distritales, SAT.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-municipal` (creado 2026-08-06, Fase 2), `abogado-jr-administrativo`.

## 1.14 Derecho de Contrataciones del Estado
- **Normas:** Ley 30225 (Ley de Contrataciones del Estado) y TUO (D.S. 082-2019-EF), reglamento D.S. 344-2018-EF, Ley 30669.
- **Regulador:** OSCE, Tribunal de Contrataciones del Estado, PERÚ COMPRAS.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-contrataciones` (creado 2026-08-06, Fase 1).

## 1.15 Derecho de la Competencia (libre competencia)
- **Normas:** D.L. 1034 (Ley de Represión de Conductas Anticompetitivas), D.L. 1044 (publicidad), D.L. 1045 (dumping y subsidios), D.L. 1046 (normas técnicas).
- **Regulador:** INDECOPI (Comisión de Defensa de la Libre Competencia, Sala).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-competencia` (creado 2026-08-06, Fase 1).

## 1.16 Derecho de Telecomunicaciones
- **Normas:** TUO de la Ley de Telecomunicaciones (D.S. 020-2007-MTC), Ley 27332 (OSIPTEL), Ley 29904 (banda ancha), Ley 30083 (portabilidad).
- **Regulador:** MTC (Dirección General de Telecomunicaciones), OSIPTEL.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-telecomunicaciones` (creado 2026-08-06, Fase 1).

## 1.17 Derecho Energético (eléctrico y gas)
- **Normas:** Ley 25844 (Ley de Concesiones Eléctricas), Ley 26876 (mercado eléctrico), Ley 28832 (generación eficiente), Ley 27133 (promoción del gas natural), Reglamento del Mercado Mayorista (D.S. 026-2016-EM).
- **Regulador:** MINEM (DGH, DGE), OSINERGMIN, COES.
- **¿LegalPro?** PARCIAL
- **Especialista:** `abogado-jr-mineria-energia` (fusiona minería y energía; debería separarse el foco eléctrico/gas).

## 1.18 Derecho Minero
- **Normas:** TUO de la Ley General de Minería (D.S. 014-92-EM), D.L. 708 (promoción inversión minera), Ley 28258 (regalía minera), D.S. 024-2016-EM (seguridad minera).
- **Regulador:** MINEM (DGM), INGEMMET, OEFA (fiscalización ambiental).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-mineria-energia`, `abogado-senior-publico`.

## 1.19 Derecho Ambiental (general)
- **Normas:** Ley 28611 (Ley General del Ambiente), Ley 27446 (SEIA), Ley 29325 (OEFA), D.S. 004-2017-MINAM (LMP), Ley 30230.
- **Regulador:** MINAM, OEFA, SENACE, SERNANP.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-ambiental`, `abogado-senior-publico`.

## 1.20 Derecho Ambiental Minero / Pasivos Ambientales
- **Normas:** Ley 28611, Ley 27446 (SEIA), D.S. 040-2014-EM (pasivos mineros), D.S. 010-2017-EM (cierre de minas), Ley 28271.
- **Regulador:** MINEM, OEFA, SENACE.
- **¿LegalPro?** PARCIAL
- **Especialista:** `abogado-jr-ambiental` + `abogado-jr-mineria-energia` (cubren en conjunto, sin agente único especializado).

## 1.21 Derecho de Aguas / Recursos Hídricos
- **Normas:** Ley 29338 (Ley de Recursos Hídricos), Reglamento (D.S. 001-2010-AG), Ley 30640 (fondo de agua).
- **Regulador:** ANA, Administraciones Locales de Agua (ALA), SUNASS (saneamiento).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-aguas` (creado 2026-08-06, Fase 2).

## 1.22 Derecho Forestal y de Fauna Silvestre
- **Normas:** Ley 29763 (Ley Forestal y de Fauna Silvestre), Reglamentos (D.S. 018-2015-MINAGRI y ss.), Ley 27308 (derogada parcialmente).
- **Regulador:** SERFOR, OSINFOR, SERNANP.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-forestal` (creado 2026-08-06, Fase 2).

## 1.23 Derecho Pesquero y Acuícola
- **Normas:** D.L. 25977 (Ley General de Pesca), D.L. 1195 (Ley de Acuicultura), reglamento D.S. 012-2001-PE, Ley 26920 (fiscalización pesquera).
- **Regulador:** PRODUCE, IMARPE, SANIPES, FONDEPES.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-pesca` (creado 2026-08-06, Fase 2).

## 1.24 Derecho Agrario
- **Normas:** Ley 31110 (régimen laboral agrario y de riego), Ley 27360 (agraria anterior), D.L. 25902 (Ley de Organización del sector agrario), Ley 24657 (comunidades nativas).
- **Regulador:** MIDAGRI, SENASA, INIA, Agrorural.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-agrario` (creado 2026-08-06, Fase 2).

## 1.25 Derecho Ganadero / Sanidad Animal
- **Normas:** D.L. 1059 (Ley de Sanidad Agraria), Ley 26828, normas SENASA, TUO de sanidad animal.
- **Regulador:** MIDAGRI, SENASA.
- **¿LegalPro?** NO
- **Especialista:** ninguno.

## 1.26 Derecho de la Seguridad Alimentaria
- **Normas:** Ley 31315 (Ley de Seguridad Alimentaria y Nutricional), Ley 31803 (sistema nacional), Codex Alimentarius.
- **Regulador:** MIDAGRI, MINSA, INDECOPI (certificación).
- **¿LegalPro?** NO
- **Especialista:** ninguno.

## 1.27 Derecho de la Salud Pública
- **Normas:** Ley 26842 (Ley General de Salud), Ley 29344 (Ley Marco de Aseguramiento Universal), D.S. 004-2016-SA (SIS), Ley 29557 (Ley de Donación de Órganos).
- **Regulador:** MINSA, SUSALUD, DIGEMID, INS.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-sanitario`, `abogado-senior-publico`.

## 1.28 Derecho Farmacéutico
- **Normas:** Ley 29459 (Ley de Productos Farmacéuticos, Dispositivos Médicos y Productos Sanitarios), D.S. 016-2011-SA, D.S. 001-2015-SA (registro sanitario), D.S. 004-2020-SA (dispensación).
- **Regulador:** DIGEMID, MINSA.
- **¿LegalPro?** PARCIAL
- **Especialista:** `abogado-jr-sanitario` (cubre salud pública; farmacéutico es subespecialidad sin agente dedicado).

## 1.29 Derecho de la Educación
- **Normas:** Ley 28044 (Ley General de Educación), Ley 30220 (Ley Universitaria), Ley 29504, SUNEDU (licenciamiento).
- **Regulador:** MINEDU, SUNEDU, UGEL/DRE.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-educacion`, `abogado-senior-publico`.

## 1.30 Derecho Migratorio
- **Normas:** D.L. 1350 (Ley de Migraciones), Reglamento D.S. 007-2017-IN, Ley 28302.
- **Regulador:** MIGRACIONES (MININTER).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-migratorio`, `abogado-senior-laboral` (foco laboral migrante).

## 1.31 Derecho de Extranjería (régimen de entrada, permanencia y salida de extranjeros)
- **Normas:** D.L. 1350 (régimen migratorio incluye extranjería), Decreto Ley 21435 (Ley General de Extranjería histórica), Convención sobre el Estatuto de los Refugiados, Ley 27891 (refugio).
- **Regulador:** MIGRACIONES, Comisión Especial para los Refugiados (CEP), MTPE (permisos de trabajo).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-extranjeria` (creado 2026-08-06, Fase 1), `abogado-jr-migratorio`.

## 1.32 Derecho Penitenciario
- **Normas:** Código de Ejecución Penal (D.L. 654), Reglamento (D.S. 015-2003-JUS), Ley 29709 (INPE), Ley 30520.
- **Regulador:** INPE, Poder Judicial (jueces de ejecución), MINJUSDH.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-penitenciario` (creado 2026-08-06, Fase 1).

## 1.33 Derecho Militar (fuero privativo militar)
- **Normas:** Código Penal Militar Policial (D.L. 961), Código de Justicia Militar, Ley 29182 (organización del fuero militar), Constitución art. 173.
- **Regulador:** Fuero Militar Policial (Corte Suprema Militar, Consejo Supremo de Justicia Militar).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-militar` (creado 2026-08-06, Fase 3).

## 1.34 Derecho Policial
- **Normas:** Ley 27238 (Ley de la PNP), régimen disciplinario policial (D.L. 1150 y Reglamento), Ley 30714 (régimen disciplinario PNP), Ley 29334.
- **Regulador:** PNP, Inspectoría General PNP, MINDEF/MININTER.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-policial` (creado 2026-08-06, Fase 3).

## 1.35 Derecho del Deporte
- **Normas:** Ley 28036 (Ley de Promoción y Desarrollo del Deporte), Reglamento D.S. 018-2004-ED, Ley 30476 (creación del... defensa del deportista), normas FIFA/Conmebol (aplicación internacional).
- **Regulador:** IPD, federaciones deportivas, tribunales deportivos.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-deporte` (creado 2026-08-06, Fase 3).

## 1.36 Derecho del Turismo
- **Normas:** Ley 29408 (Ley General de Turismo), D.L. 1433 (promoción turística), Reglamento D.S. 001-2018-MINCETUR, Ley 30654 (turismo comunitario).
- **Regulador:** MINCETUR, PROMPERÚ, CENFOTUR.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-turismo` (creado 2026-08-06, Fase 3).

## 1.37 Derecho Aeronáutico
- **Normas:** Ley 27261 (Ley de Aeronáutica Civil del Perú), Reglamento de la Ley (D.S. 050-2001-MTC), Convenio de Chicago (OACI), Ley 30832 (creación de la DGAC moderna).
- **Regulador:** MTC (DGAC), OSITRAN (aeropuertos), CORPAC.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-aeronautico` (creado 2026-08-06, Fase 2).

## 1.38 Derecho Marítimo y Portuario
- **Normas:** Ley 27943 (Ley del Sistema Portuario Nacional), Ley 28583 (Marina Mercante Nacional), D.L. 1126 (control de combustible), Código de Comercio (marítimo), Convenio SOLAS/MARPOL.
- **Regulador:** APN, DICAPI (Marina de Guerra), MTC (transporte marítimo), OSITRAN.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-maritimo` (creado 2026-08-06, Fase 2).

## 1.39 Derecho de la Propiedad y Registral (registros públicos)
- **Normas:** Ley 26366 (SUNARP), TUO del Reglamento General de los Registros Públicos (D.S. 126-2012-JUS), Ley 29219 (COFOPRI), Ley 27333 (saneamiento físico-legal).
- **Regulador:** SUNARP, COFOPRI, SBN (bienes estatales).
- **¿LegalPro?** PARCIAL
- **Especialista:** `abogado-jr-notarial` (cubre registral por cercanía; sin agente registral puro).

## 1.40 Derecho de Datos Personales
- **Normas:** Ley 29733 (LPDP), Reglamento (D.S. 003-2013-JUS), D.S. 016-2024-JUS, Directivas de la ANPDP, Ley 27269 (firma digital).
- **Regulador:** ANPDP (MINJUSDH).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-datos-personales` (creado 2026-08-06, Fase 2), `auditor-lpdp` (rol técnico-auditor), `gobernanza-chief`.

## 1.41 Derecho de la Transparencia y Acceso a la Información
- **Normas:** Ley 27806 (Ley de Transparencia y Acceso a la Información Pública), TUO (D.S. 021-2019-JUS), Reglamento, jurisprudencia del TC.
- **Regulador:** ANTAIP, TTAIP, Poder Judicial (procesos de amparo/informativo).
- **¿LegalPro?** NO
- **Especialista:** ninguno.

## 1.42 Derecho del Consumidor (defensa del consumidor)
- **Normas:** Ley 29571 (Código de Protección y Defensa del Consumidor), Ley 27311 (Indecopi), reglamento de reclamos.
- **Regulador:** INDECOPI (Comisión y Sala de Protección al Consumidor), organismos sectoriales (SBS, OSIPTEL, OSINERGMIN, SUNASS, SUTRAN).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-consumidor`, `abogado-senior-civil`.

---

# 2. Derecho Privado

## 2.1 Derecho Civil (obligaciones, contratos, propiedad, posesión, responsabilidad civil)
- **Normas:** Código Civil (D.L. 295).
- **Regulador:** Poder Judicial (juzgados civiles), notarías (extrajudicial).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-civil`, `legal-civilista`, `abogado-senior-civil`, `abogado-jr-notarial`.

## 2.2 Derecho de Familia
- **Normas:** Código Civil (libros III y IV: relaciones familiares, sucesiones), Ley 27337 (Código de los Niños y Adolescentes), Ley 30364 (violencia familiar), Ley 26662 (competencia notarial en familia), Ley 27495 (procesos de alimentos).
- **Regulador:** Poder Judicial (juzgados de familia), MIMP, DEMUNA.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-familia`, `abogado-senior-civil`.

## 2.3 Derecho de Sucesiones
- **Normas:** Código Civil (libro IV), Ley 26662 (sucesión notarial).
- **Regulador:** Poder Judicial (juzgados civiles), notarías.
- **¿LegalPro?** PARCIAL
- **Especialista:** `abogado-jr-civil`, `abogado-jr-familia`, `abogado-jr-notarial` (cubren sin agente sucesorio dedicado).

## 2.4 Derecho Comercial / Societario
- **Normas:** Ley 26887 (Ley General de Sociedades), Ley 27287 (títulos valores), D.L. 311 (contabilidad comercial), Ley 26870 (fideicomiso).
- **Regulador:** SUNARP (registro), INDECOPI (libre competencia), SMV (sociedades cotizadas).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-comercial`, `abogado-senior-empresarial`.

## 2.5 Derecho Concursal
- **Normas:** Ley 27809 (Ley General del Sistema Concursal), D.L. 845 (reestructuración patrimonial derogado), Reglamento (D.S. 009-2013-JUS).
- **Regulador:** INDECOPI (Comisión de Procedimientos Concursales), Poder Judicial (apelaciones).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-concursal`, `abogado-senior-empresarial`.

## 2.6 Derecho de la Propiedad Intelectual (derechos de autor e industrial)
- **Normas:** D.L. 822 (derecho de autor), D.L. 1075 (propiedad industrial), Decisión 486 CAN (propiedad industrial), Decisión 351 CAN (derecho de autor), Ley 28096 (denominaciones de origen).
- **Regulador:** INDECOPI (Dirección de Signos Distintivos, Dirección de Invenciones y Nuevas Tecnologías, Dirección de Derecho de Autor).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-propiedad-intelectual`, `abogado-senior-civil`.

## 2.7 Derecho de la Moda (propiedad intelectual aplicada)
- **Normas:** D.L. 1075 (marcas, modelos industriales, diseños), D.L. 822 (derecho de autor sobre diseños), Decisión 486 CAN.
- **Regulador:** INDECOPI.
- **¿LegalPro?** PARCIAL
- **Especialista:** `abogado-jr-propiedad-intelectual` (cubre moda como aplicación de PI; sin agente de industria de la moda).

## 2.8 Derecho Vitivinícola / Agroindustrial Bebidas
- **Normas:** Denominación de Origen "Pisco" (D.S. 001-2011-PRODUCE, R.D. 072-2007), Ley 28096 (DO), normas de INDECOPI, SUNAT (tributación de licores).
- **Regulador:** INDECOPI, PRODUCE, SUNAT.
- **¿LegalPro?** NO
- **Especialista:** ninguno (nicho, pero con fuerte industria exportadora).

## 2.9 Derecho Bancario y Financiero
- **Normas:** Ley 26702 (Ley General del Sistema Financiero y del Sistema de Seguros y Orgánica de la SBS), Ley 28587 (protección del usuario financiero), D.L. 1023 (banca).
- **Regulador:** SBS, BCRP, MEF.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-bancario` (creado 2026-08-06, Fase 1).

## 2.10 Derecho del Consumidor Financiero
- **Normas:** Ley 28587, Reglamento de Gestión de Conducta de Mercado (Circular SBS G-166-2015), Ley 29571 (capítulo financiero).
- **Regulador:** SBS (conducta de mercado), INDECOPI.
- **¿LegalPro?** PARCIAL
- **Especialista:** `abogado-jr-bancario` + `abogado-jr-consumidor` (cubren la conducta de mercado; sin agente dedicado exclusivo al consumidor financiero).

## 2.11 Derecho de Seguros
- **Normas:** Ley 26702 (sistema de seguros), Código de Comercio (contrato de seguro), Ley 29946 (reaseguro), SBS (normas prudenciales).
- **Regulador:** SBS.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-seguros` (creado 2026-08-06, Fase 3).

## 2.12 Derecho de Seguros de Salud
- **Normas:** Ley 26790 (seguros de salud), D.S. 004-2016-SA (SIS), Ley 27056 (EsSalud), Ley 29951 (fondo de salud).
- **Regulador:** SUSALUD, SBS, EsSalud.
- **¿LegalPro?** PARCIAL
- **Especialista:** `abogado-jr-sanitario`, `abogado-jr-seguridad-social` (cubren por aproximación; sin agente de seguros de salud).

## 2.13 Derecho Notarial
- **Normas:** D.L. 1049 (Ley del Notariado), D.L. 1232 (derecho notarial), Reglamento (R.S. 126-2012... actualizado), Ley 26662 (jurisdicción no contenciosa notarial).
- **Regulador:** Colegios de Notarios, SUNARP.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-notarial`, `abogado-senior-civil`.

## 2.14 Derecho de Arbitraje (nacional e internacional)
- **Normas:** D.L. 1071 (Decreto Legislativo de Arbitraje), Convención de Nueva York (1958), Convención de Panamá (1975), Ley de Conciliación (Ley 26872).
- **Regulador:** Centros de arbitraje (AMCHAM, CCL, PUCP), Poder Judicial (anulación de laudos).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-arbitraje`, `abogado-senior-civil`.

## 2.15 Derecho Cooperativo
- **Normas:** Ley 31495 (Ley General de Cooperativas), D.L. 85 (régimen anterior), D.S. 074-90-TR (registro de cooperativas).
- **Regulador:** MINISTERIO DE TRABAJO (registro de cooperativas), SUNARP.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-cooperativo` (creado 2026-08-06, Fase 3).

## 2.16 Derecho Funerario / de Cementerios
- **Normas:** Ley 26298 (Ley de Cementerios y Servicios Funerarios), reglamentos municipales de servicios funerarios.
- **Regulador:** Municipalidades, DIGESA (MINSA) para cremación.
- **¿LegalPro?** NO
- **Especialista:** ninguno (nicho).

## 2.17 Derecho de la Evidencia Digital / Prueba Electrónica
- **Normas:** Ley 27269 (firma digital), D.L. 1412 (gobierno digital), NCPP (cadena de custodia), Código Procesal Civil (prueba electrónica art. 192), Ley 30096 (delitos informáticos).
- **Regulador:** Poder Judicial, INDECOPI (certificados), RENIEC (firma digital).
- **¿LegalPro?** PARCIAL
- **Especialista:** `ia-boveda-evidencia` (rol técnico de evidencia; sin agente legal dedicado a litigio probatorio digital).

---

# 3. Derecho Social

## 3.1 Derecho Laboral Individual
- **Normas:** TUO del D.L. 728 (LPCL, D.S. 003-97-TR), Ley 27735 (gratificaciones), D.L. 650 (CTS), Ley 28015 (PYME), Ley 29783 (SST).
- **Regulador:** MTPE, SUNAFIL, Poder Judicial (juzgados laborales).
- **¿LegalPro?** SÍ
- **Especialista:** `legal-laboralista`, `abogado-senior-laboral`, `abogado-jr-laboral-colectivo`, `contador-laboralista`.

## 3.2 Derecho Laboral Colectivo
- **Normas:** D.L. 25593 (Ley de Relaciones Colectivas de Trabajo), Convenios OIT 87, 98 y 154, D.S. 011-92-TR (reglamento).
- **Regulador:** MTPE (direcciones de trabajo), Poder Judicial, arbitraje laboral.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-laboral-colectivo`, `abogado-senior-laboral`, `legal-laboralista`.

## 3.3 Derecho Procesal Laboral
- **Normas:** Ley 29497 (Nueva Ley Procesal del Trabajo), Ley 26636 (derogada para el nuevo proceso).
- **Regulador:** Poder Judicial (juzgados especializados de trabajo, cortes superiores).
- **¿LegalPro?** PARCIAL
- **Especialista:** `legal-laboralista`, `abogado-senior-laboral` (cubren la parte procesal sin agente procesal-laboral dedicado).

## 3.4 Derecho del Trabajo Forzoso / Explotación Laboral
- **Normas:** CP art. 168-B (trabajo forzoso), Ley 28950 (trata de personas), D.S. 011-2016-MIMP.
- **Regulador:** MTPE, Ministerio Público, PNP, MINCETUR.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-trabajo-forzoso`, `abogado-jr-crimen-organizado`, `abogado-senior-laboral`.

## 3.5 Derecho de la Seguridad Social en Salud
- **Normas:** Ley 27056 (EsSalud), Ley 26790 (Ley de Modernización de la Seguridad Social en Salud), Ley 29344 (aseguramiento universal), SCTR (D.S. 003-98-SA).
- **Regulador:** EsSalud, SUSALUD, MINSA, SBS (SCTR).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-seguridad-social`, `abogado-jr-sanitario`.

## 3.6 Derecho Previsional (pensiones ONP y AFP)
- **Normas:** D.L. 19990 (Sistema Nacional de Pensiones), D.L. 20530 (cédula viva - régimen cerrado), D.L. 25897 y TUO del SPP (D.S. 054-97-EF) (AFP), Ley 28046, Ley 28991.
- **Regulador:** ONP, SBS (supervisión AFP), AFP (Integra, Prima, Profuturo, Habitat).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-previsional` (creado 2026-08-06, Fase 1), `abogado-jr-seguridad-social`, `contador-senior-laboral`.

## 3.7 Derecho del Adulto Mayor
- **Normas:** Ley 30490 (Ley de la Persona Adulta Mayor), D.S. 007-2018-MIMP, Convención Interamericana sobre Derechos de las Personas Mayores.
- **Regulador:** MIMP, municipalidades, MINSA.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-adulto-mayor` (creado 2026-08-06, Fase 3).

## 3.8 Derecho de la Discapacidad
- **Normas:** Ley 29973 (Ley General de la Persona con Discapacidad), Reglamento (D.S. 002-2014-MIMP), Convención ONU sobre Discapacidad.
- **Regulador:** CONADIS (MIMP).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-discapacidad` (creado 2026-08-06, Fase 3).

## 3.9 Derecho de Pueblos Indígenas y Comunidades
- **Normas:** Convenio 169 OIT, Ley 29785 (consulta previa), Ley 24656 (comunidades campesinas), Ley 24657 (comunidades nativas), Ley 27811 (conocimientos colectivos), Declaración ONU sobre Pueblos Indígenas.
- **Regulador:** MINCUL (Viceministerio de Interculturalidad), MIDAGRI, INDECOPI (conocimientos colectivos).
- **¿LegalPro?** NO
- **Especialista:** ninguno. Brecha real (consulta previa en minería, hidrocarburos y energía).

## 3.10 Derecho de Seguridad y Salud en el Trabajo (SST)
- **Normas:** Ley 29783 (Ley de SST), D.S. 005-2012-TR (reglamento), D.S. 024-2016-EM (minería), Ley 30222.
- **Regulador:** SUNAFIL, MINSA (vigilancia), MTPE.
- **¿LegalPro?** PARCIAL
- **Especialista:** `abogado-jr-laboral-colectivo`, `abogado-jr-seguridad-social`, `abogado-senior-laboral` (cubren SST sin agente dedicado).

---

# 4. Derecho Internacional

## 4.1 Derecho Internacional Público
- **Normas:** Convención de Viena sobre el Derecho de los Tratados (1969), Carta de la ONU, tratados bilaterales y multilaterales, Convención de las Naciones Unidas sobre el Derecho del Mar (CONVEMAR).
- **Regulador:** MINISTERIO DE RELACIONES EXTERIORES (RREE), Corte Internacional de Justicia.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-internacional` (creado 2026-08-06, Fase 2).

## 4.2 Derecho Internacional Privado
- **Normas:** Libro X del Código Civil (derecho internacional privado), Convención Interamericana (CIDIP), Convención de La Haya (exhortos, pruebas), Ley 27809 (parte internacional concursal).
- **Regulador:** Poder Judicial (cooperación judicial internacional), RREE.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-internacional` (creado 2026-08-06, Fase 2; cubre DIPr, cooperación judicial, extradición, arbitraje internacional).

## 4.3 Derecho Diplomático
- **Normas:** Convención de Viena sobre Relaciones Diplomáticas (1961), normas del Servicio Diplomático (D.L. 1119 y Reglamento), Ley 28091.
- **Regulador:** RREE (Academia Diplomática del Perú).
- **¿LegalPro?** NO
- **Especialista:** ninguno.

## 4.4 Derecho Consular
- **Normas:** Convención de Viena sobre Relaciones Consulares (1963), reglamento consular del RREE.
- **Regulador:** RREE (direcciones consulares), consulados del Perú en el exterior.
- **¿LegalPro?** NO
- **Especialista:** ninguno.

## 4.5 Derecho de la Integración Regional
- **Normas:** Acuerdo de Cartagena (CAN, Decisión 486 y 351), Protocolo de Quito, Alianza del Pacífico, Tratado de Libre Comercio con EE.UU. y otros (TPP-11, Acuerdos Comerciales con UE, China, etc.).
- **Regulador:** RREE, MINCETUR, CAN (Secretaría General), tribunales andinos (TJCA).
- **¿LegalPro?** NO
- **Especialista:** ninguno. Brecha real (arbitraje de inversión, solución de controversias TLC).

## 4.6 Derecho Internacional de los Derechos Humanos
- **Normas:** Convención Americana sobre DDHH, Pacto Internacional de Derechos Civiles y Políticos, Convención contra la Tortura, jurisprudencia de la Corte IDH.
- **Regulador:** Corte IDH, Comisión IDH, MINJUSDH (Procuraduría ante la Corte IDH).
- **¿LegalPro?** PARCIAL
- **Especialista:** `legal-constitucionalista`, `abogado-senior-constitucional`, `abogado-jr-amparo` (cubren DDHH por vía constitucional; sin agente de litigio internacional de DDHH).

---

# 5. Derecho de Nuevas Tecnologías y Emergentes

## 5.1 Derecho del Ciberespacio / Tecnología
- **Normas:** Ley 30096 (delitos informáticos), D.L. 1412 (gobierno digital), Ley 27269 (firma digital), Ley 31470 (ciberseguridad), normas del EIGD (Entidad de Gobierno Digital).
- **Regulador:** PCM (Secretaría de Gobierno Digital), Poder Judicial, INDECOPI.
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-ciberespacio` (creado 2026-08-06, Fase 3), `ia-boveda-evidencia` (apoyo técnico).

## 5.2 Derecho de la Inteligencia Artificial
- **Normas:** Ley 31814 (Ley que promueve el uso de la IA), Estrategia Nacional de IA (PCM), Reglamento UE IA (referente internacional), proyecto de normativa nacional (2024-2026).
- **Regulador:** PCM, (en formación) autoridad de IA.
- **¿LegalPro?** NO
- **Especialista:** ninguno. Brecha emergente (responsabilidad algorítmica, sesgo, copyright de outputs IA).

## 5.3 Derecho Espacial
- **Normas:** Ley 23400 (CONIDA), tratados ONU sobre espacio ultraterrestre, Ley 32019 (actividades espaciales) si aplica, D.S. 004-2023-...
- **Regulador:** CONIDA (MINDEF).
- **¿LegalPro?** NO
- **Especialista:** ninguno (nicho ultra-emergente).

## 5.4 Derecho de la Biodiversidad y Biotecnología
- **Normas:** Ley 26839 (conservación de diversidad biológica), Ley 27811 (conocimientos colectivos), D.S. 006-2020-MINAM (biodiversidad), Protocolo de Nagoya.
- **Regulador:** MINAM, MINCUL, INDECOPI.
- **¿LegalPro?** NO
- **Especialista:** ninguno (se solapa parcialmente con ambiental).

## 5.5 Derecho Compliance / Anticorrupción Corporativo
- **Normas:** D.L. 1249 (LAFT), Ley 30424 (responsabilidad administrativa de personas jurídicas) y Reglamento, Ley 27785 (Contraloría), D.L. 1352 (Procuraduría), Convención de las Naciones Unidas contra la Corrupción.
- **Regulador:** UIF-SBS, Contraloría, Poder Judicial, INDECOPI (buenas prácticas).
- **¿LegalPro?** SÍ
- **Especialista:** `abogado-jr-compliance`, `abogado-jr-penal-economico`, `abogado-senior-empresarial`.

---

# Resumen de Cobertura

| # | Área | Rama | ¿Cubierta? | Especialista LegalPro |
|---|------|------|------------|------------------------|
| 1 | Constitucional | Público | SÍ | legal-constitucionalista, abogado-senior-constitucional, abogado-jr-amparo |
| 2 | Procesal Constitucional | Público | SÍ | abogado-jr-amparo, legal-constitucionalista |
| 3 | Administrativo General | Público | SÍ | abogado-jr-administrativo, abogado-senior-publico |
| 4 | Procesal Administrativo | Público | PARCIAL | abogado-jr-administrativo |
| 5 | Tributario Nacional | Público | SÍ | abogado-jr-tributario, legal-fiscalista |
| 6 | Tributario Municipal | Público | PARCIAL | abogado-jr-tributario |
| 7 | Aduanero | Público | SÍ | abogado-jr-aduanero |
| 8 | Penal Sustantivo | Público | SÍ | abogado-jr-penal, legal-penalista |
| 9 | Procesal Penal | Público | SÍ | abogado-jr-procesal-penal |
| 10 | Penal Económico | Público | SÍ | abogado-jr-penal-economico |
| 11 | Crimen Organizado | Público | SÍ | abogado-jr-crimen-organizado |
| 12 | Electoral | Público | SÍ | abogado-jr-electoral |
| 13 | Municipal / Local | Público | SÍ | abogado-jr-municipal, abogado-jr-administrativo |
| 14 | Contrataciones del Estado | Público | SÍ | abogado-jr-contrataciones |
| 15 | Libre Competencia | Público | SÍ | abogado-jr-competencia |
| 16 | Telecomunicaciones | Público | SÍ | abogado-jr-telecomunicaciones |
| 17 | Energético (eléctrico y gas) | Público | PARCIAL | abogado-jr-mineria-energia |
| 18 | Minero | Público | SÍ | abogado-jr-mineria-energia |
| 19 | Ambiental General | Público | SÍ | abogado-jr-ambiental |
| 20 | Ambiental Minero | Público | PARCIAL | abogado-jr-ambiental + abogado-jr-mineria-energia |
| 21 | Aguas / Recursos Hídricos | Público | SÍ | abogado-jr-aguas |
| 22 | Forestal y Fauna Silvestre | Público | SÍ | abogado-jr-forestal |
| 23 | Pesca y Acuicultura | Público | SÍ | abogado-jr-pesca |
| 24 | Agrario | Público | SÍ | abogado-jr-agrario |
| 25 | Ganadero / Sanidad Animal | Público | **NO** | — |
| 26 | Seguridad Alimentaria | Público | **NO** | — |
| 27 | Salud Pública | Público | SÍ | abogado-jr-sanitario |
| 28 | Farmacéutico | Público | PARCIAL | abogado-jr-sanitario |
| 29 | Educación | Público | SÍ | abogado-jr-educacion |
| 30 | Migratorio | Público | SÍ | abogado-jr-migratorio |
| 31 | Extranjería / Refugio | Público | SÍ | abogado-jr-extranjeria, abogado-jr-migratorio |
| 32 | Penitenciario | Público | SÍ | abogado-jr-penitenciario |
| 33 | Militar | Público | SÍ | abogado-jr-militar |
| 34 | Policial | Público | SÍ | abogado-jr-policial |
| 35 | Deporte | Público | SÍ | abogado-jr-deporte |
| 36 | Turismo | Público | SÍ | abogado-jr-turismo |
| 37 | Aeronáutico | Público | SÍ | abogado-jr-aeronautico |
| 38 | Marítimo y Portuario | Público | SÍ | abogado-jr-maritimo |
| 39 | Propiedad y Registral | Público/Privado | PARCIAL | abogado-jr-notarial |
| 40 | Datos Personales | Público | SÍ | abogado-jr-datos-personales, auditor-lpdp |
| 41 | Transparencia / Acceso a la Información | Público | **NO** | — |
| 42 | Consumidor | Público/Privado | SÍ | abogado-jr-consumidor |
| 43 | Civil | Privado | SÍ | abogado-jr-civil, legal-civilista |
| 44 | Familia | Privado | SÍ | abogado-jr-familia |
| 45 | Sucesiones | Privado | PARCIAL | abogado-jr-civil, abogado-jr-familia |
| 46 | Comercial / Societario | Privado | SÍ | abogado-jr-comercial, abogado-senior-empresarial |
| 47 | Concursal | Privado | SÍ | abogado-jr-concursal |
| 48 | Propiedad Intelectual | Privado | SÍ | abogado-jr-propiedad-intelectual |
| 49 | Moda (PI aplicada) | Privado | PARCIAL | abogado-jr-propiedad-intelectual |
| 50 | Vitivinícola / Bebidas | Privado | **NO** | — |
| 51 | Bancario y Financiero | Privado | SÍ | abogado-jr-bancario |
| 52 | Consumidor Financiero | Privado | PARCIAL | abogado-jr-bancario, abogado-jr-consumidor |
| 53 | Seguros | Privado | SÍ | abogado-jr-seguros |
| 54 | Seguros de Salud | Privado/Social | PARCIAL | abogado-jr-sanitario, abogado-jr-seguridad-social |
| 55 | Notarial | Privado | SÍ | abogado-jr-notarial |
| 56 | Arbitraje | Privado | SÍ | abogado-jr-arbitraje |
| 57 | Cooperativo | Privado | SÍ | abogado-jr-cooperativo |
| 58 | Funerario / Cementerios | Privado | **NO** | — |
| 59 | Evidencia Digital | Privado/Emergente | PARCIAL | ia-boveda-evidencia (técnico) |
| 60 | Laboral Individual | Social | SÍ | legal-laboralista, abogado-senior-laboral |
| 61 | Laboral Colectivo | Social | SÍ | abogado-jr-laboral-colectivo |
| 62 | Procesal Laboral | Social | PARCIAL | legal-laboralista, abogado-senior-laboral |
| 63 | Trabajo Forzoso | Social | SÍ | abogado-jr-trabajo-forzoso |
| 64 | Seguridad Social en Salud | Social | SÍ | abogado-jr-seguridad-social |
| 65 | Previsional (ONP/AFP) | Social | SÍ | abogado-jr-previsional, abogado-jr-seguridad-social |
| 66 | Adulto Mayor | Social | SÍ | abogado-jr-adulto-mayor |
| 67 | Discapacidad | Social | SÍ | abogado-jr-discapacidad |
| 68 | Pueblos Indígenas | Social | **NO** | — |
| 69 | SST (Seguridad y Salud Laboral) | Social | PARCIAL | abogado-jr-laboral-colectivo |
| 70 | Internacional Público | Internacional | SÍ | abogado-jr-internacional |
| 71 | Internacional Privado | Internacional | SÍ | abogado-jr-internacional |
| 72 | Diplomático | Internacional | **NO** | — |
| 73 | Consular | Internacional | **NO** | — |
| 74 | Integración Regional (CAN, AP) | Internacional | **NO** | — |
| 75 | DDHH Internacional | Internacional | PARCIAL | legal-constitucionalista, abogado-jr-amparo |
| 76 | Ciberespacio / Tecnología | Emergente | SÍ | abogado-jr-ciberespacio |
| 77 | Inteligencia Artificial | Emergente | **NO** | — |
| 78 | Espacial | Emergente | **NO** | — |
| 79 | Biodiversidad y Biotecnología | Emergente | **NO** | — |
| 80 | Compliance / Anticorrupción | Mixto | SÍ | abogado-jr-compliance |

**Total áreas inventariadas:** 80
**Cobertura LegalPro (2026-08-06, arnés ampliado 133 agentes):** 54 SÍ · 14 PARCIAL · **12 NO (brechas)**

> **Nota 2026-08-06:** los estados se actualizaron tras la creación de los **30 especialistas** (Fases 1-3). Las brechas priorizadas más abajo son las **12 áreas NO** cubiertas + 14 áreas **PARCIAL** que hoy se atienden de forma tangencial (fusionadas en otro agente) y que por su volumen de litigio podrían merecer un agente propio (p. ej. energético, procesal laboral, SST, transparencia, registro). Los conteos agregados consolidados (60 cubiertas / 14 parciales / 6 sin cubrir) están en `docs/ANALISIS_COBERTURA_LEGAL.md`.

---

# Brechas Identificadas (priorizadas)

> **ESTADO 2026-08-06 — PLAN EJECUTADO:** las brechas P0 (fases 1), P1 (fase 2) y P2 (fase 3) de abajo **ya fueron cubiertas** con los 30 especialistas creados (ver secciones detalladas y `docs/REPORTE_INTEGRACION_ARNES.md`). Las listas P0/P1/P2 se conservan como **historial de priorización**; las brechas vigentes son las 12 áreas `NO` y 14 `PARCIAL` del resumen.

## 🔴 P0 — Críticas (alta litigiosidad, demanda de mercado, generan ingresos recurrentes)

| # | Área | Regulador | Por qué es prioridad |
|---|------|-----------|----------------------|
| 1 | **Bancario y Financiero** | SBS, BCRP | Fintech, microfinanzas, supervisión; clientes de alto valor. |
| 2 | **Consumidor Financiero** | SBS, INDECOPI | Miles de reclamos/año; procedimiento de conducta de mercado SBS. |
| 3 | **Contrataciones del Estado** | OSCE | Litigio ante OSCE + arbitrajes de contratos públicos = mercado enorme. |
| 4 | **Aduanero** | SUNAT Aduanas | Comercio exterior, valor aduanero, contrabando; especialidad muy demandada. |
| 5 | **Libre Competencia** | INDECOPI | Procedimientos sancionadores, barreras burocráticas, concentraciones. |
| 6 | **Telecomunicaciones** | MTC, OSIPTEL | 5G, portabilidad, regulación; litigio regulatorio creciente. |
| 7 | **Energético separado** (eléctrico/gas) | OSINERGMIN | Hoy fusionado con minería; requiere agente propio (mercado eléctrico, gas natural). |
| 8 | **Electoral** | JNE, ONPE | Ciclo electoral predecible; partidos y candidatos contratan cada ciclo. |
| 9 | **Penitenciario** | INPE | Beneficios penitenciarios, habeas corpus conexo; volumen alto en defensa penal. |
| 10 | **Pensiones Previsional dedicado** (ONP/AFP) | ONP, SBS | El área más litigiosa del país (jubilación, devolución, SPP); hoy solo PARCIAL. |
| 11 | **Extranjería dedicado** | MIGRACIONES | Refugio, visas de inversión, trabajo extranjero; demanda alta y creciente. |

## 🟠 P1 — Altas (áreas de gran volumen o valor estratégico)

| # | Área | Regulador |
|---|------|-----------|
| 12 | **Marítimo y Portuario** | APN, DICAPI, OSITRAN |
| 13 | **Aeronáutico** | MTC-DGAC, OSITRAN |
| 14 | **Agrario** | MIDAGRI, SENASA |
| 15 | **Pesca y Acuicultura** | PRODUCE, SANIPES |
| 16 | **Aguas / Recursos Hídricos** | ANA, SUNASS |
| 17 | **Forestal** | SERFOR, OSINFOR |
| 18 | **Ambiental Minero separado** | OEFA, SENACE |
| 19 | **Farmacéutico** | DIGEMID |
| 20 | **Internacional Privado** | Poder Judicial, RREE |
| 21 | **Internacional Público / Inversiones** | RREE, CIADI |
| 22 | **Municipal / Local dedicado** | Municipalidades, SAT |
| 23 | **Tributario Municipal dedicado** | Municipalidades |
| 24 | **Datos Personales (agente legal)** | ANPDP |
| 25 | **Transparencia y Acceso a la Información** | ANTAIP, TTAIP |
| 26 | **Propiedad / Registral dedicado** | SUNARP, COFOPRI |
| 27 | **Discapacidad** | CONADIS |
| 28 | **Pueblos Indígenas** | MINCUL |
| 29 | **Procesal Laboral dedicado** | Poder Judicial |
| 30 | **SST dedicado** | SUNAFIL |

## 🟡 P2 — Medianas / Nicho (alto potencial diferenciador)

| # | Área | Regulador |
|---|------|-----------|
| 31 | Seguros | SBS |
| 32 | Seguros de Salud dedicado | SUSALUD, SBS |
| 33 | Ciberespacio / Tecnología | PCM, INDECOPI |
| 34 | Inteligencia Artificial | PCM (futura autoridad) |
| 35 | Deporte | IPD |
| 36 | Turismo | MINCETUR |
| 37 | Militar | Fuero Militar Policial |
| 38 | Policial | PNP |
| 39 | Adulto Mayor | MIMP |
| 40 | Cooperativo | MTPE, SUNARP |
| 41 | Ganadero | SENASA |
| 42 | Seguridad Alimentaria | MIDAGRI, MINSA |
| 43 | Biodiversidad y Biotecnología | MINAM, INDECOPI |
| 44 | Moda (PI aplicada dedicada) | INDECOPI |
| 45 | Vitivinícola | INDECOPI, PRODUCE |
| 46 | Funerario | Municipalidades |
| 47 | Evidencia Digital (agente legal) | Poder Judicial |
| 48 | Diplomático | RREE |
| 49 | Consular | RREE |
| 50 | Integración Regional | RREE, CAN |
| 51 | Espacial | CONIDA |

---

# Recomendaciones de Cobertura para LegalPro

> **ESTADO 2026-08-06 — EJECUTADO:** las recomendaciones 1 y 2 (crear agentes junior) se completaron en las Fases 1-3 del arnés ampliado. Las recomendaciones 3 (cobertura transversal) y 4 (actualizar catálogos) también se aplicaron en la integración (routing 40 materias, corpus RAG 30 normas). Se conservan como historial.

1. **Prioridad inmediata (fase 1):** crear 8–10 junior agents nuevos para brechas P0:
   - `abogado-jr-bancario-financiero` (SBS + fintech + consumidor financiero)
   - `abogado-jr-contrataciones-publicas` (OSCE + arbitraje estatal)
   - `abogado-jr-aduanero` (SUNAT aduanas + comercio exterior)
   - `abogado-jr-competencia` (INDECOPI libre competencia)
   - `abogado-jr-telecomunicaciones` (MTC/OSIPTEL)
   - `abogado-jr-energetico` (OSINERGMIN — separado de minería)
   - `abogado-jr-electoral` (JNE/ONPE)
   - `abogado-jr-penitenciario` (INPE)
   - `abogado-jr-previsional` (ONP/AFP dedicado)
   - `abogado-jr-extranjeria` (MIGRACIONES/refugio)

2. **Fase 2 (P1):** marítimo-portuario, aeronáutico, agrario, pesca, aguas, forestal, ambiental-minero, farmacéutico, internacional privado, datos personales (agente legal), discapacidad, pueblos indígenas, transparencia.

3. **Cobertura transversal inmediata sin crear agentes:** reasignar senior/legal specialists existentes para áreas PARCIAL (ej. `legal-civilista` absorbe sucesiones; `legal-fiscalista` absorbe aduanero de forma provisional; `abogado-senior-publico` cubre contrataciones en primera instancia).

4. **Actualizar catálogos:** incorporar nuevas leyes al `catalogs/codigos-leyes.json` (Ley 30225, D.L. 1053, Ley 26702, D.L. 1034, Ley 29338, Ley 29763, D.L. 25977, Ley 29973, Ley 29785, Ley 27943, Ley 27261, Ley 28036, etc.) y nuevos reguladores al `catalogs/reguladores-peru.json` (OSCE, JNE, ONPE, ANA, SERFOR, PRODUCE, APN, DGAC, DIGEMID, CONADIS, ANTAIP, MIGRACIONES, INPE, OSIPTEL, OSINERGMIN, SUSALUD, etc.).

---

## Notas finales

- Este mapa es **exhaustivo pero no cerrado**: el derecho peruano evoluciona constantemente (nuevas leyes, sectores emergentes: criptoactivos, tokenización, derecho de plataformas, derecho climático, economía circular).
- La clasificación por rama es **orientativa**: muchas áreas son híbridas (p. ej. consumidor = público-privado; SST = social-público; competencia = público-económico).
- **Disclaimer IA:** este documento fue generado con asistencia de IA y debe validarse contra fuentes oficiales (SPIJ: https://spij.minjus.gob.pe) y especialistas humanos antes de tomar decisiones legales. Las normas citadas corresponden a la legislación vigente al 6 de agosto de 2026.
