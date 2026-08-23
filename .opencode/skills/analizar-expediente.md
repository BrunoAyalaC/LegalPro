---
name: analizar-expediente
description: Analiza expediente judicial peruano con 5 subtipos: completo, fortalezas_debilidades, riesgos, estrategia, resumen. Base legal verificada contra catalogos canónicos.
when-to-use: "Cuando el usuario pida analizar un expediente, redactar estrategia, o evaluar riesgos procesales"
allowed-tools: Read, Grep, Glob
updated: 2026-07-31
materia: [penal, civil, laboral, familia, constitucional, comercial, tributario, administrativo]
---

# analizar-expediente (v3.0 RAG-optimized)

Análisis integral de expedientes judiciales peruanos con 5 subtipos especializados. **Citas validadas contra catálogos canónicos y SPIJ (julio 2026)**.

## Inputs

```yaml
expediente_id: UUID
tipo_analisis: completo | fortalezas_debilidades | riesgos | estrategia | resumen
rol_usuario: ABOGADO | FISCAL | JUEZ | CONTADOR
materia: penal | civil | laboral | familia | constitucional | comercial | tributario | administrativo
documentos_adjuntos: [opcional]
contexto_adicional:
  instancia: primera_instancia | segunda_instancia | casacion | amparo
  urgencia: baja | media | alta | critica
```

## Output schema (versionado)

```json
{
  "version": "3.0",
  "expediente_id": "uuid",
  "tipo_analisis": "string",
  "rol_usuario": "string",
  "materia": "string",
  "hechos_relevantes": ["..."],
  "pretensiones": "string",
  "partes_procesales": {
    "demandante": "...",
    "demandado": "...",
    "terceros": ["..."]
  },
  "pruebas_ofrecidas": ["..."],
  "base_legal": [
    {
      "articulo": "string",
      "codigo": "string",
      "url_spij": "https://spij.minjus.gob.pe/...",
      "vigente": true,
      "ultima_modificacion": "fecha"
    }
  ],
  "fortalezas": ["..."],
  "debilidades": ["..."],
  "riesgos": [
    {
      "tipo": "procesal | probatorio | temporal | economico",
      "probabilidad": "ALTA | MEDIA | BAJA",
      "impacto": "ALTO | MEDIO | BAJO",
      "mitigacion": "string"
    }
  ],
  "estrategia_recomendada": "string",
  "plazos_procesales_aplicables": [
    {
      "acto": "string",
      "dias": "int",
      "tipo": "habiles | calendario",
      "base_legal": "CPC art. NN",
      "vencimiento_estimado": "iso8601"
    }
  ],
  "precedentes_relevantes": [
    {
      "expediente": "string",
      "tribunal": "TC | CSJ | INDECOPI | SUNAT",
      "ratio": "string",
      "aplicabilidad": "ALTA | MEDIA | BAJA",
      "url": "string"
    }
  ],
  "recomendaciones": ["..."],
  "disclaimers_aplicados": ["disclaimer_general", "disclaimer_lopj_290", "..."]
}
```

## Pasos (protocolo RAG)

1. **Carga del expediente** desde BD multi-tenant (filtro por `organization_id`).
2. **Identificación de materia** (penal/civil/laboral/etc.) y selección de catálogo aplicable.
3. **Extracción de hechos relevantes** y construcción narrativa cronológica.
4. **Identificación de partes procesales** y pretensiones (principio de congruencia CPC art. VII).
5. **Catálogo de pruebas ofrecidas** con valoración probatoria (CPC art. 188-197, NCPP art. 156-158).
6. **Búsqueda de base legal**:
   - Cargar catálogo de leyes aplicables a la materia
   - Validar cada cita contra `catalogs/codigos-leyes.json`
   - Verificar URL SPIJ vigente
   - Confirmar que el artículo NO esté derogado
7. **Análisis según subtipo**:
   - **completo**: integra hechos + base legal + estrategia
   - **fortalezas_debilidades**: análisis FODA jurídico
   - **riesgos**: matriz probabilidad × impacto
   - **estrategia**: plan procesal con plazos
   - **resumen**: 1 página ejecutiva
8. **Cálculo de plazos procesales** desde `catalogs/plazos-procesales.json`.
9. **Búsqueda de precedentes vinculantes** (cuando aplique):
   - TC: https://jurisprudencia.sedetc.gob.pe/
   - Casación CSJ: si materia civil/penal
   - INDECOPI: si consumidor/comercial
10. **Aplicar 4+ disclaimers IA obligatorios** (LOPJ art. 290, CPC art. 132, CP art. 12, LPDP).

## Quality gates

- [ ] 100% de citas legales validadas contra `catalogs/codigos-leyes.json`
- [ ] 100% de plazos verificados en `catalogs/plazos-procesales.json`
- [ ] Tipificación penal validada contra `catalogs/tipos-penales-peru.json` (si penal)
- [ ] 4 disclaimers IA aplicados (footer + body cuando aplique)
- [ ] Disclaimer de transferencia internacional (LPDP art. 21)
- [ ] PII sanitizada antes de enviar a MiniMax
- [ ] Audit event emitido
- [ ] Si materia constitucional: validación con precedentes TC 2026

## Audit log

Emitir `EXPEDIENTE_ANALYZED` con payload: `expediente_id, tipo_analisis, minimax_tokens, costo_usd, citas_validadas, citas_hallucinated_removidas, precedentes_encontrados`.

## Referencias verificadas (julio 2026)

- `catalogs/codigos-leyes.json` (20 leyes peruanas)
- `catalogs/plazos-procesales.json` (17 plazos procesales)
- `catalogs/tipos-penales-peru.json` (25 tipos penales)
- `catalogs/delitos-economicos.json` (16 delitos)
- `catalogs/disclaimers-ia.json`
- `catalogs/chat-intent-functions.json` (FC `analizar_expediente`)
- `tools/verifiers/verifier-citas-legales.mjs`
- SPIJ: https://spij.minjus.gob.pe/
- TC Jurisprudencia: https://jurisprudencia.sedetc.gob.pe/
- Poder Judicial: https://www.pj.gob.pe/
- CSJ Casaciones: https://csj.pj.gob.pe/
