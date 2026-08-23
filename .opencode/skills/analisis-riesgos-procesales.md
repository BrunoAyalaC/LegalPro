---
name: analisis-riesgos-procesales
description: Analisis de riesgos procesales en casos legales peruanos. Matriz probabilidad x impacto, mitigacion, plazos, prescripcion, caducidad, medidas cautelares necesarias.
when-to-use: "Cuando se necesite evaluar riesgos procesales de un caso, planificar estrategia defensiva, o calcular plazos criticos"
allowed-tools: Read, Grep, Glob, Write
updated: 2026-07-31
materia: [penal, civil, laboral, familia, constitucional, comercial, tributario, administrativo]
---

# analisis-riesgos-procesales (v3.0 RAG-optimized)

Análisis integral de riesgos procesales en casos legales peruanos con matriz probabilidad × impacto, mitigación, plazos críticos, prescripción, caducidad y medidas cautelares. **A julio 2026**.

## Inputs

```yaml
expediente_id: UUID
rol_usuario: DEMANDANTE | DEMANDADO | FISCAL | IMPUTADO | TERCERO
materia: penal | civil | laboral | familia | constitucional | comercial | tributario
tipo_caso: [opcional]
hechos_relevantes: [array]
evidencia_disponible: [array]
plazos_criticos: [opcional]
```

## Output schema

```json
{
  "version": "3.0",
  "expediente_id": "uuid",
  "rol_usuario": "string",
  "materia": "string",
  "riesgos_identificados": [
    {
      "id": "RIESGO-NN",
      "tipo": "procesal | probatorio | temporal | economico | penal | reputacional",
      "descripcion": "string",
      "probabilidad": "ALTA (0.7-1.0) | MEDIA (0.4-0.6) | BAJA (0.0-0.3)",
      "impacto": "ALTO (>S/ 100k) | MEDIO (S/ 10k-100k) | BAJO (<S/ 10k)",
      "score": "0.0-1.0",
      "plazo_critico": "iso8601 o null",
      "prescripcion": {
        "aplica": true,
        "plazo_anos": "int",
        "base_legal": "string",
        "fecha_vencimiento": "iso8601"
      },
      "caducidad": {
        "aplica": true,
        "dias": "int",
        "base_legal": "string",
        "fecha_vencimiento": "iso8601"
      },
      "mitigacion": {
        "acciones": ["..."],
        "responsable": "string",
        "plazo": "iso8601",
        "costo_estimado": "number"
      },
      "precedentes_aplicables": ["..."]
    }
  ],
  "score_riesgo_global": "0.0-1.0",
  "recomendacion_estrategica": "string",
  "medidas_cautelares_recomendadas": [
    {
      "tipo": "embargo | inhibicion | anotacion_demanda | suspension | otra",
      "justificacion": "string",
      "fumus_boni_iuris": "string",
      "periculum_in_mora": "string",
      "contracautela": "string",
      "base_legal": "string"
    }
  ],
  "plazos_vencimiento_proximo": [
    { "concepto": "string", "dias_restantes": "int", "vencimiento": "iso8601" }
  ]
}
```

## Tipos de riesgo (7)

### 1. **Riesgo Procesal**

- Rebeldía por no contestar demanda (CPC art. 461)
- Caducidad de instancia (CPC art. 346)
- Conclusión del proceso por abandono
- Improcedencia de la demanda
- Inadmisión de recurso

### 2. **Riesgo Probatorio**

- Prueba documental insuficiente
- Testigos contradictorios
- Prueba pericial desfavorable
- Inadmisibilidad de prueba (CPC art. 200)
- Valoración probatoria adversa

### 3. **Riesgo Temporal (Plazos)**

- Vencimiento de plazos fatales
- Prescripción de la acción (CP art. 80-83)
- Caducidad del derecho (CPC art. 2003, D.L. 650 CTS art. 23)
- Preclusión procesal
- Términos de la distancia

### 4. **Riesgo Económico**

- Costas y costos del proceso
- Indemnización por daños (CC art. 1972)
- Multas procesales
- Responsabilidad civil
- Reparación civil en penal

### 5. **Riesgo Penal** (si aplica)

- Tipicidad (CP art. IV Título Preliminar)
- Antijuridicidad
- Culpabilidad
- Pena privativa de libertad
- Multa penal
- Inhabilitación

### 6. **Riesgo Reputacional**

- Daño a imagen pública
- Difusión en medios
- Responsabilidad civil derivada
- Derecho al olvido

### 7. **Riesgo Regulatorio**

- Sanciones administrativas (OSCE, SBS, SUNAT)
- Multas ANPD (Ley 29733 art. 39)
- Multas INDECOPI
- Procedimientos administrativos disciplinarios

## Matriz probabilidad × impacto

```
                  IMPACTO
              BAJO    MEDIO    ALTO
PROB ALTA   [P1]    [P2]    [P3]  ← Críticos
PROB MEDIA  [P2]    [P2]    [P3]
PROB BAJA   [P1]    [P1]    [P2]

P1 = Riesgo aceptable (monitorear)
P2 = Riesgo medio (mitigar proactivamente)
P3 = Riesgo crítico (mitigar inmediatamente)
```

## Cálculo de prescripción

```javascript
// Prescripción penal (CP art. 80)
function calcularPrescripcionPenal(capitalPenaAnios, fechaHecho) {
  const plazoMax = capitalPenaAnios; // años
  const vencimiento = new Date(fechaHecho);
  vencimiento.setFullYear(vencimiento.getFullYear() + plazoMax);
  return {
    aplica: true,
    plazo_anos: plazoMax,
    fecha_vencimiento: vencimiento.toISOString(),
    base_legal: 'CP art. 80',
  };
}

// Prescripción civil (CC art. 2001)
function calcularPrescripcionCivil(plazoAnios, fechaInicio) {
  const vencimiento = new Date(fechaInicio);
  vencimiento.setFullYear(vencimiento.getFullYear() + plazoAnios);
  return {
    aplica: true,
    plazo_anos: plazoAnios,
    fecha_vencimiento: vencimiento.toISOString(),
    base_legal: 'CC art. 2001-2003',
  };
}
```

## Medidas cautelares

### Requisitos (CPC art. 610-687)

1. **Fumus boni iuris** (apariencia de buen derecho): probabilidad de éxito en el fondo
2. **Periculum in mora** (peligro en la demora): riesgo de que la ejecución sea imposible o difícil
3. **Contracautela**: garantía que ofrece el solicitante (CPC art. 613)

### Tipos principales

| Medida | Base Legal | Uso |
|---|---|---|
| Embargo (depósito, retención, inscripción, secuesto) | CPC art. 649 | Asegurar pago de obligación |
| Inhibición | CPC art. 651 | Impedir actos de disposición |
| Anotación de demanda | CPC art. 673-678 | Publicitar litigio sobre inmueble |
| Suspensión de pagos | CPC art. 686 | En juicios de obligación de dar |
| Medida innovativa | CPC art. 687 | Modificar situación de hecho |
| Medida de no innovar | CPC art. 687 | Mantener situación actual |

### Medidas cautelares en laboral (NLPT art. 32-36)

- **Anotación de demanda**: en registros públicos
- **Embargo**: en cuentas del demandado
- **Suspensión del acto hostil**: en despido arbitrario

### Medidas cautelares en penal (NCPP art. 253-303)

- **Prisión preventiva**: art. 268 (gravedad de la pena + peligro de fuga)
- **Comparencia con restricciones**: art. 286 (delitos leves)
- **Comparencia simple**: art. 287
- **Detención domiciliaria**: art. 290 (vulnerables)

## Pasos (protocolo)

1. **Cargar expediente** y validar materia.
2. **Identificar riesgos** por categoría (7 tipos).
3. **Calcular score probabilidad × impacto** para cada riesgo.
4. **Determinar plazos críticos**:
   - Prescripción (penal/civil)
   - Caducidad (instancias, recursos)
   - Preclusión (actos procesales)
5. **Evaluar medidas cautelares** necesarias (fumus + periculum + contracautela).
6. **Proponer mitigación** para cada riesgo crítico (P3) y medio (P2).
7. **Establecer alertas tempranas** (días restantes < 30).
8. **Aplicar 4 disclaimers IA**.

## Quality gates

- [ ] 100% de riesgos categorizados
- [ ] Score probabilidad × impacto calculado
- [ ] Plazos críticos identificados (prescripción, caducidad)
- [ ] Medidas cautelares evaluadas si aplica
- [ ] Mitigación concreta por cada riesgo
- [ ] Alertas tempranas para plazos < 30 días
- [ ] 4 disclaimers IA aplicados
- [ ] Precedentes vinculantes citados si disponibles

## Audit log

Emitir `RISK_ANALYZED` con payload: `expediente_id, total_riesgos, criticos, plazo_mas_cercano, fecha`.

## Referencias

- `catalogs/codigos-leyes.json` (cp, cpc, ncpp, cc, lpcl)
- `catalogs/plazos-procesales.json`
- `catalogs/tipos-penales-peru.json`
- `catalogs/disclaimers-ia.json`
- `tools/verifiers/verifier-citas-legales.mjs`
- SPIJ: https://spij.minjus.gob.pe/
- TC: https://www.tc.gob.pe/
- Poder Judicial: https://www.pj.gob.pe/
- NCPP (medidas coercitivas): https://spij.minjus.gob.pe/content/03Codigos/CodigoProcesalPenal.pdf
