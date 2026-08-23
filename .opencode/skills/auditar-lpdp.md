---
name: auditar-lpdp
description: Audita cumplimiento Ley 29733 (LPDP Peru) - consentimientos, ARCO, transferencia internacional, firma digital, breach notification, sanciones ANPD.
when-to-use: "Cuando el usuario pida auditar cumplimiento LPDP, antes de release, o al menos 1 vez por mes"
allowed-tools: Read, Bash, Grep, Glob
updated: 2026-07-31
regulatorio-base: Ley 29733 + Reglamento D.S. 016-2024-JUS
autoridad: ANPD (gob.pe/anpd)
---

# auditar-lpdp (v3.0 RAG-optimized)

Audita cumplimiento de la **Ley 29733** de Protección de Datos Personales del Perú y su Reglamento. **Alineado con la ANPD al 31/07/2026** (Resolución Directoral N° 100-2025-JUS-DGTAIPD — Directiva Oficial de Datos Personales).

## Inputs

```yaml
scope: archivo | modulo | sistema
foco: [consentimiento, arco, transferencia, firma, retencion, breach, ia, sanciones]
severidad_minima: INFO | LOW | MEDIUM | HIGH | CRITICAL
multitenant: bool
ia_activa: bool   # ¿usa MiniMax/OpenAI/etc?
```

## Output schema (versionado)

```json
{
  "version": "3.0",
  "fecha_auditoria": "iso8601",
  "scope": "string",
  "hallazgos": [
    {
      "id": "LPDP-NNN",
      "articulo_lpdp": "art. NN",
      "categoria": "consentimiento|arco|transferencia|firma|retencion|breach|ia",
      "severidad": "CRITICAL|HIGH|MEDIUM|LOW",
      "ubicacion": "file:line",
      "evidencia": "string",
      "remediacion": "string",
      "sancion_potencial_soles": "number",
      "norma_violada": "string"
    }
  ],
  "score": "X/4",
  "recomendaciones": ["..."]
}
```

## Pasos (protocolo RAG)

1. **Detección de tratamiento**: localizar todas las tablas/colecciones con PII (Nivel 3+).
2. **Ejecutar verificadores automatizados**:
   - `verifier-lpdp.mjs` — cumplimiento base Ley 29733
   - `verifier-arco.mjs` — derechos ARCO end-to-end
   - `verifier-transferencia-internacional.mjs` — flag `acepta_transferencia_internacional`
   - `verifier-firma-digital.mjs` — Ley 27269 + SHA-256 + timestamp
   - `verifier-masking.mjs` — PII en logs
3. **Validación manual obligatoria**:
   - ¿Existe tabla `consentimientos` con versionado? (D.S. 016-2024-JUS art. 12)
   - ¿Cada tratamiento tiene `finalidad` específica registrada? (Ley 29733 art. 13)
   - ¿`audit_log` emite `LPDP_*` para mutaciones PII? (Ley 29733 art. 39)
   - ¿Endpoints ARCO implementados? `GET/PUT/DELETE /api/mis-datos` + `POST /api/mis-datos/oposicion`
   - ¿Plazo de notificación breach a ANPD ≤ **5 días hábiles** (Ley 29733 art. 24)?
4. **Verificación IA (si aplica)**:
   - ¿Hay `promptSanitizer` antes de enviar a MiniMax?
   - ¿Se registra `TRANSFERENCIA_INTERNACIONAL` por cada llamada?
   - ¿Disclaimers de IA activos? (declaración conjunta 61 autoridades 23-feb-2026)
5. **Multitenant**: validar aislamiento por `organization_id` (RLS) y filtros en queries.

## Quality gates

- [ ] Cero hallazgos `CRITICAL` sin remediación
- [ ] Score LPDP ≥ 3/4
- [ ] Cada hallazgo con `sancion_potencial_soles` documentado
- [ ] Plan de remediación con fechas y owners
- [ ] Verificación cruzada con la lista de **instituciones sancionadas** ANPD
- [ ] `registro_tratamiento` actualizado (Ley 29733 art. 31)

## Sanciones referenciales (actualizado 2026)

| Infracción | Multa S/ | Norma |
|---|---|---|
| No inscribir banco de datos | hasta 50 UIT (S/ 257,500) | art. 39 |
| Transferencia internacional sin consentimiento | hasta 100 UIT (S/ 515,000) | art. 21 + 39 |
| Breach sin notificar ANPD en plazo | hasta 100 UIT (S/ 515,000) | art. 24 + 39 |
| Caso **MAGIC DYNASTY (mayo 2026)** | S/ 194,000 reales | precedente reciente |

## Audit log

Emitir `LPDP_AUDIT_COMPLETED` con payload: `scope, score, total_hallazgos, criticos, fecha`.

## Referencias verificadas (julio 2026)

- `catalogs/codigos-leyes.json` (ley: `lpdp`)
- `catalogs/audit-events.json` (eventos LPDP)
- `catalogs/disclaimers-ia.json` (disclaimers obligatorios)
- `tools/verifiers/verifier-lpdp.mjs`
- `tools/verifiers/verifier-arco.mjs`
- `arneses/runbooks/RB-010-lpdp-breach.md`
- ANPD oficial: https://www.gob.pe/anpd
- Registro Nacional: https://prodpe.minjus.gob.pe/prodpe_web/BancoDato_verResultado
- Sanciones: https://www.gob.pe/9320
- Resolución Directoral N° 100-2025-JUS-DGTAIPD (Directiva Oficial Datos Personales)
- "Compendio sobre Protección de Datos Personales" (1ra edición oficial, dic-2025)
- Declaración conjunta 61 autoridades sobre IA (23-feb-2026)
