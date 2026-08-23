---
name: redactar-escrito-legal
description: Redacta escritos legales peruanos (demanda, contestacion, apelacion, casacion, amparo, habeas corpus, etc.) con formato del Poder Judicial. Citas validadas al 100%.
when-to-use: "Cuando el usuario pida redactar demanda, contestacion, recurso, medida cautelar, acusacion u otro escrito procesal"
allowed-tools: Read, Grep, Glob, Write
updated: 2026-07-31
formatos: [PJ peruano, TC, INDECOPI, SUNAT, MINJUSDH]
materia: [penal, civil, laboral, familia, constitucional, comercial, administrativo]
---

# redactar-escrito-legal (v3.0 RAG-optimized)

Genera escritos procesales peruanos con formato oficial del **Poder Judicial** y validación canónica al 100% de citas. **Alineado con práctica procesal a julio 2026**.

## Inputs

```yaml
tipo_escrito: enum (ver abajo)
expediente_id: UUID
materia: penal | civil | laboral | familia | constitucional | comercial | administrativo
hechos: [opcional]
fundamentos: [opcional]
prueba_disponible: [opcional]
petitorio_usuario: [opcional, recomendado]
```

### `tipo_escrito` permitidos (17)

`demanda | contestacion | reconvencion | apelacion | casacion | queja | reposicion | nulidad | amparo | habeas_corpus | habeas_data | accion_popular | medida_cautelar | acusacion | sobreseimiento | pericial | alegato | traslado | requerimiento_fiscal | resolucion_judicial`

## Output schema

```json
{
  "version": "3.0",
  "tipo_escrito": "string",
  "expediente_id": "uuid",
  "materia": "string",
  "contenido_markdown": "string (formato PJ peruano)",
  "estructura": {
    "sumillas": "...",
    "exponente": "...",
    "fundamentos_derecho": "...",
    "petitorio": "...",
    "pruebas": "...",
    "anexos": "...",
    "firma": "..."
  },
  "citas_verificadas": [
    {
      "articulo": "string",
      "codigo": "string",
      "url_spij": "https://spij.minjus.gob.pe/...",
      "vigente": true,
      "ultima_modificacion": "iso8601"
    }
  ],
  "citas_hallucinated_removidas": ["art. XYZ inválido", "..."],
  "petitorio": "string",
  "prueba_sugerida": ["..."],
  "plazo_presentacion": {
    "dias": "int",
    "tipo": "habiles | calendario",
    "base_legal": "string",
    "vencimiento_estimado": "iso8601"
  },
  "riesgos_procesales": ["..."],
  "disclaimers": ["disclaimer_general", "disclaimer_redactor", "disclaimer_lopj_290"],
  "hash_contenido": "sha256"
}
```

## Pasos (protocolo RAG)

1. **Validar tipo de escrito** contra catálogo canónico (`catalogs/chat-intent-functions.json`, FC `redactar_documento`).
2. **Cargar template** según tipo + materia.
3. **Generar secciones** (orden oficial PJ):
   - **Sumillas** (encabezado de la solicitud)
   - **EXPONE** (hechos cronológicos numerados)
   - **CONSIDERANDOS / FUNDAMENTOS DE DERECHO** (base legal validada)
   - **PETITORIO** (solicitud concreta con orden de prelación)
   - **PRUEBA** (ofrecida con descripción + pertinencia + conducencia)
   - **ANEXOS** (documentos adjuntos numerados 1-A, 1-B, ...)
   - **FIRMA** (lugar, fecha, abogado con CAL)
4. **Validar cada cita** contra `catalogs/codigos-leyes.json`:
   - ¿Existe la norma?
   - ¿Está vigente? (no derogada)
   - ¿URL SPIJ responde?
   - ¿Última modificación posterior a fecha del caso?
5. **Eliminar alucinaciones** (citas inventadas por MiniMax).
6. **Insertar 4+ disclaimers IA** en lugares estratégicos (footer + pre-firma).
7. **Recomendar plazo de presentación** desde `catalogs/plazos-procesales.json`.
8. **Calcular hash SHA-256** del contenido para cadena de custodia.

## Quality gates

- [ ] **100% de citas verificadas** contra catálogo (cero alucinaciones)
- [ ] Formato del PJ peruano respetado (sumillas, EXPONE, FUNDAMENTOS, PETITORIO, PRUEBA)
- [ ] Petitorio claro, específico, con orden de prelación
- [ ] Fundamentación jurídica sólida y actualizada
- [ ] Disclaimers IA presentes (mínimo 4)
- [ ] Plazo de presentación sugerido + fecha de vencimiento
- [ ] Hash SHA-256 del contenido calculado
- [ ] Si hay firma digital: cumplir Ley 27269

## Audit log

Emitir `ESCRITO_GENERATED` con payload: `tipo, expediente_id, materia, citas_count, costo_usd, hash_contenido, version_schema`.

## Tipos de escritos según materia

| Materia | Tipos más comunes |
|---|---|
| Penal | acusación, sobreseimiento, habeas corpus, apelación, casación, alegato |
| Civil | demanda, contestación, reconvención, apelación, casación, medida cautelar |
| Laboral | demanda (Ley 29497), contestación, apelación |
| Familia | demanda (alimentos, divorcio, tenencia), contestación |
| Constitucional | amparo, habeas corpus, habeas data, acción popular |
| Comercial | demanda (societaria), denuncia INDECOPI |
| Tributario | reclamación ante SUNAT, apelación ante TF |

## Referencias verificadas (julio 2026)

- `catalogs/codigos-leyes.json`
- `catalogs/plazos-procesales.json`
- `catalogs/tipos-penales-peru.json`
- `catalogs/disclaimers-ia.json`
- `catalogs/chat-intent-functions.json` (FC `redactar_documento`)
- `arneses/templates/PR.template.md`
- `tools/verifiers/verifier-citas-legales.mjs`
- SPIJ: https://spij.minjus.gob.pe/
- Manual de Escritos Procesales PJ: https://www.pj.gob.pe/
- TUO LPCL: D.S. 003-97-TR (última modificación 2026)
- TUO LPDP: Ley 29733 + D.S. 016-2024-JUS (reglamento actualizado)
