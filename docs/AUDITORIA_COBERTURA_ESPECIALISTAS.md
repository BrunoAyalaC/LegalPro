# Auditoria de Cobertura de Especialistas - LegalPro

**Fecha:** 2026-08-06
**Auditor:** AuditorLegal (agente auditor-legal)
**Alcance:** 36 agentes legales (24 jr + 6 senior + chief + 5 legal) + orquestador
**Fuentes:** .opencode/agents/, opencode.json, jerarquia-especialistas.json, .opencode/skills/, tools/verifiers/, tools/rag/

---

## 0. Resumen Ejecutivo

| Metrica | Valor |
|---|---|---|
| Agentes legales existentes en disco | **36** |
| Agentes legales declarados (objetivo del encargo) | 34 (24 jr + 5 senior + 5 legal) |
| Diferencia | +1 senior real extra (hay 6 seniors + chief) |
| Agentes junior con archivo | 24 / 24 |
| Agentes senior con archivo | 6 / 6 (+1 chief) |
| Legal specialists con archivo | 5 / 5 |
| Agentes con consulta RAG obligatoria | 24 juniors / 12 superiores NO tienen bloque RAG |
| Skills declaradas por agentes legales | ~55 unicas |
| Skills existentes en .opencode/skills/ | **18** |
| Skills legales especificas que existen | **0** (ninguna declarada por jr/senior/legal existe) |
| Verificadores legales declarados | 4 (citas-legales, plazos, tipificacion, jurisprudencia) pero **NO existen** |
| Agentes referenciados que NO existen | 6 (asistentes, senior-tributario, contador-chief, asistentes contables) |
| Juniors con base legal dudosa/erronea | 3 (mineria-energia, civil, notarial) |
| Juniors sin ruta explicita en orquestador | 12 de 24 |

**Veredicto global:** PARCIALMENTE CUBIERTO con deuda tecnica alta. Los 36 agentes existen y estan registrados, pero la capa de conocimiento (skills y verificadores legales) que los agentes dicen consumir **no existe en disco**. El sistema funciona como prompts autocontenidos (con RAG en juniors), pero las referencias a skills/verificadores son mayoritariamente ficticias.

---

## 1. Inventario Real de Agentes Legales

### 1.1 Abogados Junior (24)

| # | Agente | Area declarada | Reporta a | RAG | Estado |
|---|---|---|---|---|---|
| 1 | abogado-jr-administrativo | TUO Ley 27444, procedimiento administrativo | senior-publico | Si | OK |
| 2 | abogado-jr-ambiental | OEFA, MINAM, delitos ambientales, EIA | senior-publico | Si | OK |
| 3 | abogado-jr-amparo | TC, amparo, habeas corpus, habeas data | senior-constitucional | Si | OK |
| 4 | abogado-jr-arbitraje | D.Leg. 1071, laudos, anulacion | senior-civil | Si | OK |
| 5 | abogado-jr-civil | CC/CPC, obligaciones, contratos | senior-civil | Si | OK - cita LGS como civil |
| 6 | abogado-jr-comercial | LGS, contratos mercantiles, titulos valores | senior-empresarial | Si | OK |
| 7 | abogado-jr-compliance | LA/FT D.Leg. 1249, UIF, SBS, OFAC | senior-empresarial | Si | OK |
| 8 | abogado-jr-concursal | Ley 27809, INDECOPI concursal | senior-empresarial | Si | OK |
| 9 | abogado-jr-consumidor | Ley 29571, INDECOPI, publicidad | senior-civil | Si | OK |
| 10 | abogado-jr-crimen-organizado | Ley 30077, narcotrafico, trata | senior-penal | Si | OK |
| 11 | abogado-jr-educacion | Ley 28044, MINEDU, SUNEDU | senior-publico | Si | OK |
| 12 | abogado-jr-familia | Alimentos, divorcio, tenencia, violencia | senior-civil | Si | OK |
| 13 | abogado-jr-laboral-colectivo | Negociacion colectiva, huelga | senior-laboral | Si | OK |
| 14 | abogado-jr-migratorio | D.Leg. 1350, MIGRACIONES, visas | senior-laboral | Si | OK |
| 15 | abogado-jr-mineria-energia | TUO 014-92-EM, OSINERGMIN | senior-publico | Si | OK - cita D.Leg. 295 = Codigo Civil |
| 16 | abogado-jr-notarial | D.Leg. 1049, SUNARP | senior-civil | Si | OK - Decisiones CAN dudosas |
| 17 | abogado-jr-penal | CP sustantivo, tipicidad | senior-penal | Si | OK |
| 18 | abogado-jr-penal-economico | Lavado, corrupcion, peculado, mineria ilegal | senior-penal | Si | OK |
| 19 | abogado-jr-procesal-penal | NCPP, investigacion, acusacion | senior-penal | Si | OK |
| 20 | abogado-jr-propiedad-intelectual | Derechos de autor, marcas, patentes | senior-civil | Si | OK |
| 21 | abogado-jr-sanitario | Ley 26842, SUSALUD, MINSA | senior-publico | Si | OK |
| 22 | abogado-jr-seguridad-social | ONP, AFP, EsSalud, SCTR | senior-laboral | Si | OK |
| 23 | abogado-jr-trabajo-forzoso | CP 168-B, trata, explotacion laboral | senior-laboral | Si | OK |
| 24 | abogado-jr-tributario | IGV, IR, SUNAT, Tribunal Fiscal | senior-publico | Si | OK |

### 1.2 Abogados Senior (6) + Chief (1)

| # | Agente | Area declarada | Coordina | RAG | Estado |
|---|---|---|---|---|---|
| 25 | abogado-chief | Estratega +15 anos, cross-rama, veto | Todos los seniors | No | OK |
| 26 | abogado-senior-civil | Civil, familia, comercial, PI, notarial, consumidor, arbitraje | 7 juniors | No | OK |
| 27 | abogado-senior-constitucional | TC, amparo, HC, HD, control convencional | 4 juniors (solo 1 existe) | No | OK |
| 28 | abogado-senior-empresarial | Societario, concursal, titulos valores, compliance | 3 juniors | No | OK |
| 29 | abogado-senior-laboral | Laboral individual/colectivo, seg. social | 3 juniors | No | OK |
| 30 | abogado-senior-penal | Penal sustantivo, procesal, economico, crimen org. | 5 juniors | No | OK |
| 31 | abogado-senior-publico | Admin, tributario, ambiental, sanitario, educacion, mineria | 8 juniors (reclama concursal/compliance) | No | OK |

### 1.3 Legal Specialists (5)

| # | Agente | Area declarada | Roles | RAG | Estado |
|---|---|---|---|---|---|
| 32 | legal-civilista | CC, CPC, civil | ABOGADO, JUEZ | No | OK |
| 33 | legal-constitucionalista | Const. 1993, TC, procesos constitucionales | ABOGADO, JUEZ | No | OK |
| 34 | legal-fiscalista | Penal desde MP/Fiscalia | FISCAL | No | OK |
| 35 | legal-laboralista | LPCL, CPCL, CTS, gratificaciones | ABOGADO, JUEZ | No | OK |
| 36 | legal-penalista | CP, NCPP, delitos | ABOGADO, FISCAL, JUEZ | No | OK |

**Nota de inventario:** el encargo indica "24 jr + 5 senior + 5 legal" (=34) pero en disco hay 6 senior + 1 chief (7 archivos), total real = 36.

---

## 2. Cobertura por Area

| Mega-area | Areas cubiertas | Agentes | Estado |
|---|---|---|---|
| civil_privado | Civil, familia, comercial, PI, notarial, consumidor, arbitraje | jr-civil, jr-familia, jr-comercial, jr-PI, jr-notarial, jr-consumidor, jr-arbitraje; senior-civil; legal-civilista | Cobertura completa |
| penal_constitucional | Penal sustantivo, procesal, economico, crimen org., trabajo forzoso, amparo, TC | jr-penal, jr-procesal-penal, jr-penal-economico, jr-crimen-organizado, jr-trabajo-forzoso, jr-amparo; senior-penal, senior-constitucional; legal-penalista, legal-fiscalista, legal-constitucionalista | Cobertura completa |
| publico_regulatorio | Administrativo, tributario, ambiental, educacion, sanitario, mineria | jr-administrativo, jr-tributario, jr-ambiental, jr-educacion, jr-sanitario, jr-mineria-energia; senior-publico | Cobertura completa (concursal/compliance ambiguos) |
| trabajo_social | Laboral colectivo, migratorio, seguridad social | jr-laboral-colectivo, jr-migratorio, jr-seguridad-social; senior-laboral; legal-laboralista | Cobertura completa |
| empresarial/concursal/compliance | Comercial, concursal, compliance | jr-comercial, jr-concursal, jr-compliance; senior-empresarial | Existe (jerarquia duplicada) |

**Areas declaradas por seniors que NO tienen junior dedicado:**
- senior-constitucional dice coordinar 4 juniors (amparo, habeas corpus, habeas data, control convencional) pero solo existe abogado-jr-amparo.

---

## 3. Problemas Encontrados

### 3.1 Agentes inexistentes (referenciados pero sin archivo)

| Referencia | Donde se referencia | Impacto |
|---|---|---|
| @abogado-asistente-redaccion | abogado-chief, abogado-jr-familia, jerarquia-especialistas.json | ALTA: chief delega redaccion a agente inexistente |
| @abogado-asistente-investigacion | abogado-chief, jerarquia-especialistas.json | ALTA: chief delega investigacion a agente inexistente |
| abogado-senior-tributario | jerarquia-especialistas.json (publico_regulatorio.seniors) | MEDIA: catalogo lista senior inexistente |
| contador-chief | jerarquia-especialistas.json (contable_auditoria) | MEDIA |
| contador-asistente-liquidaciones | jerarquia-especialistas.json | MEDIA |
| contador-asistente-peritaje | jerarquia-especialistas.json | MEDIA |

> **ESTADO 2026-08-06 (CORREGIDO):** Los 6 agentes inexistentes fueron creados:
> `abogado-asistente-redaccion`, `abogado-asistente-investigacion`, `abogado-senior-tributario`,
> `contador-chief`, `contador-asistente-forense`, `contador-asistente-laboral`.
> El catalogo `jerarquia-especialistas.json` fue actualizado para reflejar la nueva jerarquia
> (senior-tributario en publico_regulatorio; contador-chief y asistentes contables en contable_auditoria).

### 3.2 Skills declaradas pero inexistentes

Las 18 skills reales en .opencode/skills/: adaptadores-externos, analisis-riesgos-procesales, analizar-expediente, auditar-lpdp, auditar-seguridad, buscar-jurisprudencia, configurar-minimax, crear-endpoint, crear-pagina, decoradores-patterns, deploy-backend, liquidacion-laboral, objetivos-y-metas, observadores-eventos, optimizadores-rendimiento, protocolos-pipeline, rag-busqueda-semantica, redactar-escrito-legal.

**Skills legales declaradas por agentes que NO existen (muestra):**
- redactar-denuncia-ambiental, redactar-recurso-oeefa, validar-eia (ambiental)
- calcular-pension-alimentos, redactar-demanda-alimentos, redactar-divorcio, denunciar-violencia-familiar (familia)
- evaluar-tipicidad-economica, redactar-acusacion-economica, coordinar-peritaje-contable (penal-economico)
- buscar-marca-disponible, redactar-oposicion-marca, redactar-contrato-licencia (PI)
- estrategia-caso-complejo, analisis-cross-rama, adr-creator, comite-de-errores (chief)
- redactar-amparo, redactar-habeas-corpus, control-convencional (senior-constitucional)
- redactar-constitucion-empresa, redactar-titulo-valor, compliance-program-corporativo (senior-empresarial)
- liquidar-laboral, calcular-cts, denunciar-sunafil (senior-laboral) - solo liquidacion-laboral existe con otro nombre
- liquidar-tributario, redactar-recurso-impugnacion, defensa-indecopi (senior-publico)
- probar-pretension, redactar-contestacion (legal-civilista)
- evaluar-tipicidad, redactar-acusacion, redactar-alegato-clausura (legal-fiscalista/penalista)
- detectar-nulidades (legal-penalista)
- Tambien se referencian skills de codigo inexistentes: legal-orchestrator.processLegalQuery, legal-router.detectSpecialties, cache-redis, promptSanitizer (senior-civil, senior-penal).

**Impacto:** CRITICO. Ningun agente legal consume una skill legal que exista. La unica skill real con solape parcial es liquidacion-laboral (usada por orquestador y contadores).

### 3.3 Verificadores legales inexistentes

Declarados por 5 agentes (abogado-chief, auditor-legal, ia-analista-expedientes, ia-buscador-jurisprudencia, refutador-legal) pero NO existen en tools/verifiers/:
- verifier-citas-legales.mjs
- verifier-plazos.mjs
- verifier-tipificacion.mjs
- verifier-jurisprudencia.mjs

Existen 29 verifiers en tools/verifiers/ (seguridad, LPDP, multi-tenant, etc.) pero ninguno de validacion legal. Impacto: CRITICO para la funcion de auditoria legal automatizada.

### 3.4 RAG: cobertura desigual

- tools/rag/junior-rag-wrapper.mjs SI existe y los 24 juniors lo invocan.
- Los 6 seniors, chief y 5 legal specialists NO tienen bloque RAG.
- crimen-organizado y trabajo-forzoso usan materia=penal (generico).

### 3.5 Solapamientos y jerarquia duplicada

1. Concursal/Compliance con doble jefe: reportan a senior-empresarial en su archivo,
   pero senior-publico y jerarquia-especialistas.json los ponen bajo publico_regulatorio.
   > **ESTADO 2026-08-06 (CORREGIDO):** senior-publico ya no coordina concursal/compliance;
   > el catalogo los mueve a civil_privado bajo abogado-senior-empresarial. Cada junior tiene UN solo jefe.
2. Legal specialists solapan con juniors: civilista~jr-civil, penalista~jr-penal,
   laboralista~senior-laboral, constitucionalista~jr-amparo, fiscalista~jr-penal.
   No hay regla de uso: los seniors los ignoran; solo el orquestador los usa como apoyo.
3. Senior-constitucional declara coordinar 4 juniors pero solo existe 1 (amparo).

### 3.6 Areas declaradas con base legal erronea o dudosa

| Agente | Cita | Problema |
|---|---|---|
| abogado-jr-mineria-energia | D.Leg. 295 (Sistema de Inversion Minera) | CRITICO: D.Leg. 295 es el Codigo Civil. La norma minera correcta es TUO D.S. 014-92-EM + D.Leg. 708. |

> **ESTADO 2026-08-06 (CORREGIDO):** `abogado-jr-mineria-energia.md` ya no cita D.Leg. 295.
> La base legal corregida es: TUO D.S. 014-92-EM (Texto Único Ordenado de la Ley General de Minería),
> Ley 28258 (Regalía Minera), Ley 27506 (Canon), OSINERGMIN, INGEMMET.
| abogado-jr-civil | Ley 26887 (LGS) como base civil | LGS es societario/comercial, no civil. Error de area. |
| abogado-jr-notarial | Decisiones 593, 816 CAN | Decisiones CAN son de propiedad industrial, no notarial. Dudosa. |
| abogado-jr-familia | Ley 27379 trata y Ley 29944 magisterial | Normas ajenas a familia. Mezcla. |
| abogado-jr-penal-economico | D.S. 057-2019-EF: UIF-Peru | El reglamento UIF del D.Leg. 1249 es D.S. 020-2017-JUS. Verificar. |
| abogado-jr-seguridad-social | Ley 29636 (SCTR) | SCTR se rige por D.Leg. 892 + D.S. 003-98-SA. Dudosa. |
| abogado-jr-tributario | Ley del Procedimiento Tributario | No existe como tal; es TUO Codigo Tributario (ya citado). Duplicado confuso. |
| abogado-jr-arbitraje | Reglamento del Centro de Arbitraje CCL | Es reglamento privado, no norma. Aceptable como practica. |
| abogado-jr-familia | Ley 26260 (derogada) | Correcto: aclara derogacion y cita Ley 30364. Bien. |

### 3.7 Problemas de routing del orquestador

Verificado en lexia-orchestrator.md + opencode.json:
1. Permisos: el orquestador (mode primary) y TODOS los subagentes tienen task: {"*": "allow"} en opencode.json. El chief tambien. SI puede delegar a todos los juniors.
2. Inconsistencia de conteo: el orquestador dice "96 subagents" (linea 50) y "95 subagents" (linea 52); en disco hay 97 archivos .md.
3. Matriz de routing incompleta: la tabla "Analisis juridico" solo mapea 10 materias
   (penal sustantivo/procesal/economico, civil, laboral, familia, constitucional, tributario, comercial, ambiental).
   Faltan 12 juniors sin ruta explicita: administrativo, arbitraje, compliance, concursal,
   consumidor, crimen-organizado, educacion, migratorio, mineria-energia, notarial,
   propiedad-intelectual, sanitario, seguridad-social, trabajo-forzoso.
4. Legal specialists ausentes de la matriz: solo legal-penalista, legal-civilista, legal-laboralista
   aparecen como secundarios. legal-fiscalista y legal-constitucionalista NO tienen ruta.
5. Seniors no aparecen como destino directo: la matriz usa juniors/IA como primarios;
   los seniors solo se escalan via regla generica. Los 6 seniors no tienen fila propia.

---

## 4. Veredicto

### 4.1 Cobertura real vs declarada

| Dimension | Declarado | Real | Estado |
|---|---|---|---|
| Agentes junior | 24 | 24 | OK |
| Agentes senior | 5-6 | 6 + chief | OK (sobra 1 vs encargo) |
| Legal specialists | 5 | 5 | OK |
| Skills legales | ~55 | 0 | FALLIDO |
| Verificadores legales | 4 | 0 | FALLIDO |
| RAG en juniors | migrado | 24/24 | OK |
| RAG en seniors/chief/legal | - | 0/12 | INCOMPLETO |
| Routing orquestador | 96 | 97 archivos, matriz 10/24 materias | INCOMPLETO |
| Bases legales citadas | - | 3 con error grave/dudoso | CORREGIR |
| Agentes fantasma referenciados | - | 6 | CORREGIR |

### 4.2 Conclusion tecnica

La capa de especialistas legales esta bien inventariada como prompts (36 agentes,
jerarquia definida, RAG operativo en juniors), pero la infraestructura de conocimiento
que declaran consumir (skills y verificadores legales) NO existe en disco.
Cualquier ejecucion que intente cargar redactar-amparo, verifier-citas-legales.mjs,
etc. fallara o se degradara a prompt sin skill. Deuda tecnica critica porque:
1. Viola las reglas duras del propio perfil auditor-legal (4 verificadores inexistentes).
2. El chief delega a 2 asistentes inexistentes.
3. El orquestador no puede enrutar 12 de 24 materias junior.

---

## 5. Recomendaciones

### 5.1 Criticas (P0)
1. Crear los 4 verificadores legales: verifier-citas-legales.mjs, verifier-plazos.mjs,
   verifier-tipificacion.mjs, verifier-jurisprudencia.mjs.
2. Decidir destino de skills legales: (a) crear las ~20 skills de mayor uso o
   (b) eliminar las secciones Skills que consumo de los agentes. Recomendado:
   crear el subconjunto critico y borrar el resto.
3. Crear o eliminar asistentes fantasma: abogado-asistente-redaccion y
   abogado-asistente-investigacion (referenciados por chief) o re-mapear a
   ia-redactor-escritos / ia-buscador-jurisprudencia.
4. Corregir base legal erronea en abogado-jr-mineria-energia (D.Leg. 295 = Codigo Civil;
   reemplazar por D.Leg. 708 / TUO correcto).

### 5.2 Altas (P1)

5. Completar la matriz de routing del orquestador con los 12-14 juniors faltantes,
   los legal specialists ausentes (legal-fiscalista, legal-constitucionalista) y los 6 seniors.
6. Unificar jerarquia de concursal/compliance: decidir si reportan a senior-empresarial
   o senior-publico y alinear archivos + jerarquia-especialistas.json.
7. Extender RAG a seniors, chief y legal specialists.
8. Actualizar jerarquia-especialistas.json: marcar como creados los 24 juniors,
   corregir seniors fantasma (abogado-senior-tributario, contador-chief, asistentes).
9. Corregir materia del RAG en crimen-organizado y trabajo-forzoso (usar materia propia).

### 5.3 Medias (P2)

10. Limpiar bases legales dudosas: jr-civil (quitar LGS), jr-notarial (Decisiones CAN),
    jr-familia (Ley 27379/29944), jr-penal-economico (D.S. 057-2019-EF),
    jr-seguridad-social (Ley 29636), jr-tributario (eliminar ley duplicada).
11. Definir regla de uso legal-* vs abogado-*: doctrinales (legal-*) vs operativos (jr-*).
12. Crear juniors dedicados o corregir declaracion de senior-constitucional (4 juniors, 1 existe).
13. Corregir conteo del orquestador (95/96/97) para reflejar inventario real.

---

## 6. Fuentes consultadas

- .opencode/agents/*.md (36 agentes legales + orquestador)
- opencode.json (registro de agentes y permisos task)
- catalogs/jerarquia-especialistas.json
- .opencode/skills/ (18 skills reales)
- .github/skills/ (8 skills legacy)
- tools/verifiers/ (29 verificadores, ninguno legal)
- tools/rag/junior-rag-wrapper.mjs (wrapper RAG existente)
- catalogs/codigos-leyes.json (verificacion D.Leg. 295 = Codigo Civil)

---
*Auditoria generada por @auditor-legal. Severidad global: ALTA (skills/verificadores legales inexistentes).*
