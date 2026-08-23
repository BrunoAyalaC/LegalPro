---
name: liquidacion-laboral
description: Calculo de liquidaciones laborales peruanas: CTS (D.L. 650), Gratificaciones (Ley 27735), Vacaciones, Utilidades, AFP/ONP, BCRP tipo cambio.
when-to-use: "Cuando se pida liquidar CTS, gratificaciones, vacaciones, utilidades, o informe pericial contable"
allowed-tools: Read, Write, Grep, Glob
updated: 2026-07-31
normas: [D.L. 650 CTS, Ley 27735 Gratificaciones, D.L. 713 Vacaciones, TUO LPCL D.S. 003-97-TR]
---

# liquidacion-laboral (v3.0 RAG-optimized)

Cálculo automatizado de liquidaciones laborales peruanas con validación contra normativa vigente al 31/07/2026.

## Inputs

```yaml
tipo_liquidacion: cts | gratificacion | vacaciones | utilidades | liquidacion_total
trabajador:
  dni: string
  fecha_ingreso: iso8601
  fecha_cese: iso8601  # o null si vigente
  remuneracion_basica: number  # S/
  asignacion_familiar: bool
  regimen_pension: afp | onp | sin_pension
  afp_tipo: fondo_1 | fondo_2 | fondo_3  # si AFP
  dias_efectivos: int  # días efectivamente laborados en el periodo
  dias_subsidiados: int  # con subsidio (ESSALUD) — Ej. maternidad
  dias_no_trabajados: int  # faltas, suspensiones, licencias sin goce
  meses_completos: int  # meses completos laborados
config:
  incluir_horas_extras: bool
  incluir_bonos: bool
  bonos: [{ concepto: string, monto: number }]
  periodo_calculo:  # ej. semestre mayo-octubre
    desde: iso8601
    hasta: iso8601
```

## Output schema

```json
{
  "version": "3.0",
  "tipo_liquidacion": "string",
  "trabajador": { "dni": "..." },
  "periodo": { "desde": "...", "hasta": "..." },
  "conceptos": [
    {
      "concepto": "string",
      "base_calculo": "number",
      "factor": "string",
      "monto": "number",
      "base_legal": "string",
      "vigente": true
    }
  ],
  "total_bruto": "number",
  "descuentos": [
    { "concepto": "AFP|ONP|IR_5TA|ESSALUD|otro", "monto": "number", "base_legal": "string" }
  ],
  "total_neto": "number",
  "tipo_cambio_bcrp": { "fecha": "iso8601", "compra": 3.75, "venta": 3.78, "fuente": "BCRP" },
  "disclaimers": ["disclaimer_general", "disclaimer_cc_1972"],
  "base_legal_aplicada": ["D.L. 650", "Ley 27735", "..."],
  "observaciones": ["..."]
}
```

## Fórmulas (julio 2026)

### 1. CTS (Compensación por Tiempo de Servicios) — D.L. 650

**Base legal**: D.L. 650 (1991), TUO D.S. 001-97-TR

```
CTS = (Remuneración Computable × Meses completos) / 12
Donde:
  Remuneración Computable = Suma de todos los conceptos remunerativos
                            del semestre (gratificaciones, horas extras,
                            comisiones, etc.) / 6
```

**Periodo de cálculo**: 1 mayo a 31 octubre (depósito hasta 15 noviembre)
**Periodo de cálculo**: 1 noviembre a 30 abril (depósito hasta 15 mayo)

### 2. Gratificaciones — Ley 27735 + Ley 29351

**Fiestas Patrias (28 julio)**: 1 remuneración completa, depósito hasta 15 julio
**Navidad (25 diciembre)**: 1 remuneración completa, depósito hasta 15 diciembre

**Bonificación extraordinaria (Ley 29351)**:
- 9% de la gratificación si el trabajador NO tiene seguro ESSALUD (esSalud) completo
- Solo si el empleador es MYPE (micro o pequeña empresa)

```
Gratificación = Remuneración mensual
Bonificación = Gratificación × 9% (si aplica Ley 29351)
Total = Gratificación + Bonificación
```

### 3. Vacaciones — D.L. 713

```
Vacaciones = 30 días calendario por año completo de servicios
Remuneración vacacional = Remuneración mensual
```

### 4. Utilidades — D.L. 892 + D.L. 677

**Trabajadores con derecho**:
- Empresas con > 20 trabajadores: 50% distribución
- Empresas con ≤ 20 trabajadores: NO obligados (salvo pacto contrario)

```
Base = Renta neta anual de la empresa
Distribución = 50% según días laborados, 50% según remuneraciones
Utilidad del trabajador = (Monto distribución × Días trabajados) / Total días empresa
```

### 5. Descuentos

- **AFP**: 10% (aporte obligatorio) + comisión según AFP (Promedio/Prima/Hábil)
- **ONP**: 13% del sueldo (sistema nacional de pensiones)
- **IR 5ta categoría**: según tramo de UIT (S/ 5,350 en 2026)
- **ESSALUD**: 9% del sueldo (empleador asume, no descuento al trabajador)

## Cálculo paso a paso

```javascript
import { BCRPAdapter } from '../adapters/BCRPAdapter.js';

const bcrp = new BCRPAdapter({ baseURL: process.env.BCRP_URL });

export async function liquidarCts(input) {
  // 1. Calcular remuneración computable
  const totalIngresos = input.remuneracion_basica +
    (input.asignacion_familiar ? 102.50 : 0) +
    (input.incluir_bonos ? input.bonos.reduce((s, b) => s + b.monto, 0) : 0);

  // 2. Sumar horas extras si aplica
  // (omitido por simplicidad)

  // 3. Determinar meses completos
  const mesesCompletos = calcularMesesCompletos(
    input.fecha_ingreso,
    input.fecha_cese || new Date(),
    input.dias_efectivos
  );

  // 4. Calcular CTS
  const ctsTotal = (totalIngresos * mesesCompletos) / 12;

  // 5. Aplicar factor de días si no es mes completo
  // ...

  // 6. Tipo de cambio BCRP para reporte multi-moneda
  const tc = await bcrp.execute('getTipoCambio', { fecha: new Date().toISOString().slice(0, 10) });

  return {
    tipo_liquidacion: 'cts',
    conceptos: [
      { concepto: 'Remuneración computable', monto: totalIngresos },
      { concepto: `CTS ${mesesCompletos}/12`, monto: ctsTotal },
    ],
    total_bruto: ctsTotal,
    total_neto: ctsTotal,  // CTS es inembargable e intangible
    tipo_cambio_bcrp: tc.ok ? tc.data : null,
    base_legal: ['D.L. 650', 'D.S. 001-97-TR (TUO)'],
  };
}
```

## Calendario laboral Perú 2026

```javascript
import { feriadosPeru } from '../utils/feriados.js';

const feriados2026 = feriadosPeru(2026);
// Incluye: 1 enero, 1 mayo, 29 junio, 28-29 julio, 30 agosto, 8 octubre, 1 noviembre, 8-25 diciembre
```

## Quality gates

- [ ] Validar fecha ingreso < fecha cese
- [ ] Calcular meses completos correctamente
- [ ] Aplicar factor de días si mes incompleto
- [ ] Verificar régimen de pensión (AFP/ONP)
- [ ] Bonificación 9% Ley 29351 SOLO si aplica
- [ ] CTS inembargable (no descuentos)
- [ ] Tipo de cambio BCRP del día
- [ ] Base legal citada correctamente
- [ ] 4 disclaimers IA presentes

## Audit log

Emitir `LIQUIDACION_CALCULATED` con payload: `tipo, dni_trabajador, total_bruto, total_neto, base_legal, fecha`.

## Referencias

- `catalogs/codigos-leyes.json` (ley: `cts`, `gratificaciones`, `lpcl`)
- `catalogs/feriados-peru.json`
- `legalpro-app/server/adapters/BCRPAdapter.js`
- `legalpro-app/server/utils/feriados.js`
- D.L. 650 CTS: https://spij.minjus.gob.pe/content/04Normas/Leyes/DL_650_CTS.pdf
- Ley 27735 Gratificaciones: https://spij.minjus.gob.pe/content/04Normas/Leyes/Ley_27735_Gratificaciones.pdf
- D.L. 713 Vacaciones: https://www.gob.pe/minjus/normas
- TUO LPCL D.S. 003-97-TR: https://spij.minjus.gob.pe/content/04Normas/Leyes/DL_728_Productividad.pdf
- MTPE Perú: https://www.gob.pe/mtpe
- SUNAT (AFP/ONP): https://www.sunat.gob.pe/
- BCRP tipo de cambio: https://www.bcrp.gob.pe/
- `tools/verifiers/verifier-catalogos.mjs`
