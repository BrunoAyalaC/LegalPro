// ═══════════════════════════════════════════════════════════════════════════
// HERRAMIENTAS LEGALES DETERMINÍSTICAS (sin IA = sin costo por consulta)
// ───────────────────────────────────────────────────────────────────────────
// 12 endpoints de cálculo puro: UIT, interés legal, plazos hábiles y
// naturales↔hábiles, buscador de delitos, prescripción penal, tasa BCRP,
// comparador de tasas, indemnización por despido arbitrario (D.S. 001-97-TR),
// exportación .ics (RFC 5545), liquidación laboral (LPCL) y pensión de
// alimentos (Ley 28720).
//
// Base legal:
//   - CPC Art. 144: días hábiles procesales (plazo vence en día inhábil →
//     se traslada al siguiente hábil).
//   - CP Arts. 85-88: prescripción de la acción penal (plazo = pena máx +
//     mitad, mín. 2 años; art. 88 cada acto interruptivo reinicia el plazo).
//   - Código Civil Art. 1245 / T.U.O. Código Tributario: interés moratorio
//     simple sobre capital.
//
// Seguridad: requiere login (authMiddleware por ruta) pero NO tenant:
// los cálculos son públicos dentro del estudio y no tocan datos por
// organización. Sin DB writes → no aplica idempotency ni quota IA.
// ═══════════════════════════════════════════════════════════════════════════
import { Router } from 'express';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { esDiaHabil } from '../utils/feriados.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Los catálogos viven en la RAÍZ del repo (catalogs/), igual que en utils/feriados.js
// y routes/plazos.js: server/routes → ../../../catalogs.
const CATALOGS_DIR = join(__dirname, '../../../catalogs');

// ── Carga de catálogos al inicio del módulo (lectura única, sync OK al boot) ──
const FERIADOS = JSON.parse(readFileSync(join(CATALOGS_DIR, 'feriados-peru.json'), 'utf-8'));
const TIPOS_PENALES = JSON.parse(readFileSync(join(CATALOGS_DIR, 'tipos-penales-peru.json'), 'utf-8'));
const DELITOS_ECONOMICOS = JSON.parse(readFileSync(join(CATALOGS_DIR, 'delitos-economicos.json'), 'utf-8'));

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────
function round2(n) {
  return Math.round(n * 100) / 100;
}

function parseFecha(str) {
  return new Date(`${str}T00:00:00`);
}

// FIX HIGH: regex YYYY-MM-DD acepta fechas inexistentes ("2026-02-30") que
// hacen lanzar RangeError a toISOString(). Validamos que el Date resultante
// sea real Y que al serializar vuelva al mismo string (descarta roll-overs
// tipo "2026-02-31" → 2026-03-03).
function fechaReal(s) {
  const d = parseFecha(s);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? d : null;
}

// FIX MEDIUM (TZ): toISOString serializa en UTC; con fechas construidas a
// medianoche local (UTC-5) puede retroceder un día. Formateamos desde las
// partes locales del Date.
function formatFechaLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// FIX LOW: búsqueda tolerante a tildes ("colusion" encuentra "colusión")
function quitarTildes(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function diasEntre(desdeStr, hastaStr) {
  return Math.round((parseFecha(hastaStr) - parseFecha(desdeStr)) / 86_400_000);
}

// Deriva años de pena máxima desde strings como "18 años" | "3 años" | "1 día-multa"
function aniosDesdePena(penaMaxima) {
  const m = /(\d+(?:\.\d+)?)\s*a[ñn]os/i.exec(String(penaMaxima ?? ''));
  return m ? Number(m[1]) : null;
}

// CP Art. 85: plazo de prescripción = pena máxima + mitad (mínimo 2 años)
export function calcularPlazoPrescripcion(penaAnios) {
  return Math.max(penaAnios * 1.5, 2);
}

// ═════════════════════════════════════════════════════════════════════════════
// 1) GET /api/herramientas/uit — valores oficiales hardcodeados
// ═════════════════════════════════════════════════════════════════════════════
// ⚠️ ACTUALIZAR ANUALMENTE: la UIT se fija por Decreto Supremo del MEF cada
// diciembre para el año siguiente (ver El Peruano / www.mef.gob.pe).
// La RMV se fija por D.S. del MTPE cuando hay revisión.
// Última actualización: 2026-08-22.
const UIT_DATA = {
  // FIX: no citar número de D.S. sin verificar (riesgo INDECOPI / dato falso).
  valor_uit_2026: 5350, // S/ — Valor UIT 2026 — verificar publicación oficial en El Peruano
  valor_uitm_2026: 445.83, // S/ — UIT mensualizada (UIT/12, referencial para multas diarias)
  valor_rm: 1130, // S/ — Remuneración Mínima Vital (D.S. N° 003-2022-TR, vigente)
  verificado: false, // true solo cuando se confirme el D.S. publicado en El Peruano
};
router.get('/uit', authMiddleware, (_req, res) => {
  res.json({
    success: true,
    data: {
      ...UIT_DATA,
      fuente: 'Valor UIT 2026 — verificar publicación oficial en El Peruano. RMV: D.S. MTPE. Actualizar anualmente.',
    },
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2) POST /api/herramientas/interes-legal — interés moratorio SIMPLE día calendario
//    interes = capital * (tasa/100) * (dias/360)
// ═════════════════════════════════════════════════════════════════════════════
const interesSchema = z
  .object({
    capital: z.number().positive().max(1_000_000_000, 'capital fuera de rango razonable'), // FIX: cota anti-abuso
    tasa_anual_pct: z.number().positive().max(1000),
    // FIX HIGH (mismo criterio que plazosSchema/prescripcionSchema): la regex sola
    // acepta fechas inexistentes ("2026-02-30") que hacen roll-over silencioso
    // (→ 2026-03-02) y devolverían 200 con días incorrectos. Validamos calendario real.
    desde: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'desde debe ser YYYY-MM-DD')
      .refine((s) => fechaReal(s) !== null, 'desde debe ser una fecha calendario válida'),
    hasta: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'hasta debe ser YYYY-MM-DD')
      .refine((s) => fechaReal(s) !== null, 'hasta debe ser una fecha calendario válida'),
  })
  .refine((d) => parseFecha(d.hasta) > parseFecha(d.desde), {
    message: 'hasta debe ser posterior a desde',
    path: ['hasta'],
  });

router.post('/interes-legal', authMiddleware, (req, res) => {
  const parsed = interesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Datos de entrada inválidos.',
      details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      code: 'VALIDATION_ERROR',
    });
  }
  const { capital, tasa_anual_pct, desde, hasta } = parsed.data;
  const dias = diasEntre(desde, hasta);
  const interes = round2(capital * (tasa_anual_pct / 100) * (dias / 360));
  res.json({
    success: true,
    data: {
      interes,
      dias,
      total: round2(capital + interes),
      formula: 'capital * (tasa/100) * (dias/360) — interés simple día calendario',
    },
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3) POST /api/herramientas/plazos-habiles — suma días hábiles (CPC Art. 144)
//    Salta fines de semana + feriados de catalogs/feriados-peru.json.
//    Si el vencimiento cae en día inhábil se corre al siguiente hábil.
// ═════════════════════════════════════════════════════════════════════════════
// Helper compartido: avanza `diasHabiles` días hábiles desde fechaInicioStr
// saltando fines de semana + feriados del catálogo. Reutilizado por
// plazos-habiles y plazos-naturales (dirección habiles_a_naturales).
function sumarDiasHabiles(fechaInicioStr, diasHabiles) {
  const cursor = parseFecha(fechaInicioStr);
  let contados = 0;
  let saltados = 0;
  const feriadosEncontrados = [];
  let safety = 0;
  const MAX_ITERACIONES = 365 * 10; // blindaje anti-loop infinito
  let truncated = false; // FIX LOW: avisar si el blindaje truncó el cálculo

  while (contados < diasHabiles && safety < MAX_ITERACIONES) {
    cursor.setDate(cursor.getDate() + 1);
    safety++;
    const dow = cursor.getDay();
    const fechaStr = formatFechaLocal(cursor); // FIX MEDIUM: serialización local, no UTC
    if (dow === 0 || dow === 6) {
      saltados++; // fin de semana
    } else if (!esDiaHabil(fechaStr)) {
      saltados++;
      feriadosEncontrados.push(fechaStr); // feriado del catálogo (CPC Art. 144)
    } else {
      contados++;
    }
  }
  if (contados < diasHabiles) truncated = true;

  // CPC Art. 144: si el último día cae inhábil, correr al siguiente hábil.
  // (Por construcción solo contamos hábiles, así que esto es un guard defensivo.)
  while (!esDiaHabil(formatFechaLocal(cursor)) && safety < MAX_ITERACIONES) {
    cursor.setDate(cursor.getDate() + 1);
    saltados++;
    safety++;
  }
  if (!esDiaHabil(formatFechaLocal(cursor))) truncated = true;

  return { cursor, saltados, feriadosEncontrados, truncated };
}

const plazosSchema = z.object({
  // FIX HIGH: rechaza fechas de calendario inexistentes ("2026-02-30")
  fecha_inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha_inicio debe ser YYYY-MM-DD')
    .refine((s) => fechaReal(s) !== null, 'fecha calendario válida requerida'),
  dias_habiles: z.number().int().positive().max(3650, 'dias_habiles fuera de rango'),
});

router.post('/plazos-habiles', authMiddleware, (req, res) => {
  const parsed = plazosSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Datos de entrada inválidos.',
      details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      code: 'VALIDATION_ERROR',
    });
  }
  const { fecha_inicio, dias_habiles } = parsed.data;
  const { cursor, saltados, feriadosEncontrados, truncated } = sumarDiasHabiles(fecha_inicio, dias_habiles);

  res.json({
    success: true,
    data: {
      fecha_vencimiento: formatFechaLocal(cursor),
      dias_saltados: saltados,
      feriados_encontrados: feriadosEncontrados,
      ...(truncated ? { truncated: true } : {}),
      regla_calculo: FERIADOS.regla_calculo,
      base_legal: 'CPC Art. 144',
    },
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7) POST /api/herramientas/plazos-naturales — conversión bidireccional
//    días naturales ↔ días hábiles (CPC Art. 144).
//    - naturales_a_habiles: dado N naturales desde fecha_inicio, ¿cuántos
//      hábiles caen en el rango (fecha_inicio, fecha_inicio+N]?
//    - habiles_a_naturales: dado N hábiles, ¿qué fecha natural de vencimiento?
//      (misma lógica que plazos-habiles vía helper compartido).
// ═════════════════════════════════════════════════════════════════════════════
const plazosNaturalesSchema = z.object({
  fecha_inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha_inicio debe ser YYYY-MM-DD')
    .refine((s) => fechaReal(s) !== null, 'fecha calendario válida requerida'),
  dias: z.number().int().positive().max(3650, 'dias fuera de rango'),
  direccion: z.enum(['naturales_a_habiles', 'habiles_a_naturales']),
});

router.post('/plazos-naturales', authMiddleware, (req, res) => {
  const parsed = plazosNaturalesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Datos de entrada inválidos.',
      details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      code: 'VALIDATION_ERROR',
    });
  }
  const { fecha_inicio, dias, direccion } = parsed.data;

  let fechaVencimiento;
  let diasHabilesComputados;
  let diasNaturales;
  let feriados;
  let truncated = false;

  if (direccion === 'naturales_a_habiles') {
    // Rango (fecha_inicio, fecha_inicio + N naturales]: contamos los hábiles.
    // Loop acotado por diseño: dias <= 3650.
    const fin = parseFecha(fecha_inicio);
    fin.setDate(fin.getDate() + dias);
    const cursor = parseFecha(fecha_inicio);
    let habiles = 0;
    feriados = [];
    while (cursor < fin) {
      cursor.setDate(cursor.getDate() + 1);
      const dow = cursor.getDay();
      const fs = formatFechaLocal(cursor);
      if (dow === 0 || dow === 6) continue; // fin de semana
      if (!esDiaHabil(fs)) {
        feriados.push(fs); // feriado del catálogo (CPC Art. 144)
        continue;
      }
      habiles++;
    }
    fechaVencimiento = formatFechaLocal(fin);
    diasHabilesComputados = habiles;
    diasNaturales = dias;
  } else {
    // habiles_a_naturales: reusa la lógica de plazos-habiles.
    const r = sumarDiasHabiles(fecha_inicio, dias);
    truncated = r.truncated;
    fechaVencimiento = formatFechaLocal(r.cursor);
    diasHabilesComputados = dias;
    diasNaturales = diasEntre(fecha_inicio, fechaVencimiento);
    feriados = r.feriadosEncontrados;
  }

  res.json({
    success: true,
    data: {
      fecha_vencimiento: fechaVencimiento,
      dias_habiles_computados: diasHabilesComputados,
      dias_naturales: diasNaturales,
      feriados_encontrados: feriados,
      ...(truncated ? { truncated: true } : {}),
      regla_calculo: FERIADOS.regla_calculo,
      base_legal: 'CPC Art. 144',
    },
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8) POST /api/herramientas/indemnizacion-despido — despido arbitrario
//    D.S. N° 001-97-TR (LPC), Arts. 34 y 38:
//      - Art. 34: 1.5 remuneraciones brutas por año completo de servicios
//        (tope: 12 remuneraciones).
//      - Fracción de año: proporcional (meses/12 * 1.5 remuneraciones).
// ═════════════════════════════════════════════════════════════════════════════
const indemnizacionSchema = z
  .object({
    fecha_ingreso: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha_ingreso debe ser YYYY-MM-DD')
      .refine((s) => fechaReal(s) !== null, 'fecha calendario válida requerida'),
    fecha_cese: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha_cese debe ser YYYY-MM-DD')
      .refine((s) => fechaReal(s) !== null, 'fecha calendario válida requerida'),
    remuneracion_mensual: z.number().positive().max(1_000_000, 'remuneracion_mensual fuera de rango razonable'),
    meses_trabajados_adicionales: z.number().int().min(0).max(600).default(0),
  })
  .refine((d) => parseFecha(d.fecha_cese) > parseFecha(d.fecha_ingreso), {
    message: 'fecha_cese debe ser posterior a fecha_ingreso',
    path: ['fecha_cese'],
  });

router.post('/indemnizacion-despido', authMiddleware, (req, res) => {
  const parsed = indemnizacionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Datos de entrada inválidos.',
      details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      code: 'VALIDATION_ERROR',
    });
  }
  const { fecha_ingreso, fecha_cese, remuneracion_mensual, meses_trabajados_adicionales } = parsed.data;

  // Meses completos entre ingreso y cese (diferencia calendario); si el día de
  // cese es anterior al día de ingreso, el último mes no está completo.
  const fi = parseFecha(fecha_ingreso);
  const fc = parseFecha(fecha_cese);
  let mesesTotales = (fc.getFullYear() - fi.getFullYear()) * 12 + (fc.getMonth() - fi.getMonth());
  if (fc.getDate() < fi.getDate()) mesesTotales -= 1;
  mesesTotales += meses_trabajados_adicionales;

  const aniosCompletos = Math.floor(mesesTotales / 12);
  const mesesFraccion = mesesTotales % 12;

  // Art. 34: 1.5 remuneraciones por año completo + fracción proporcional.
  const indemnizacionBruta = round2(aniosCompletos * 1.5 * remuneracion_mensual + (mesesFraccion / 12) * 1.5 * remuneracion_mensual);
  // Tope legal Art. 34 in fine: máximo 12 remuneraciones.
  const tope = round2(12 * remuneracion_mensual);
  const topeAplicado = indemnizacionBruta > tope;
  const indemnizacionFinal = round2(Math.min(indemnizacionBruta, tope));

  res.json({
    success: true,
    data: {
      anios_servicio: round2(mesesTotales / 12),
      anios_completos: aniosCompletos,
      meses_fraccion: mesesFraccion,
      indemnizacion_bruta: indemnizacionBruta,
      tope_aplicado: topeAplicado,
      indemnizacion_final: indemnizacionFinal,
      base_legal: 'D.S. 001-97-TR arts. 34 y 38',
    },
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4) GET /api/herramientas/delitos?q=texto — búsqueda case-insensitive en
//    tipos-penales-peru.json Y delitos-economicos.json
// ═════════════════════════════════════════════════════════════════════════════
function mapTipoPenal(t) {
  const penaAnios = aniosDesdePena(t.pena_maxima);
  return {
    fuente: 'tipos-penales',
    articulo: t.articulo_cp ? `CP Art. ${t.articulo_cp}` : null,
    nombre: t.nombre,
    pena: t.pena_minima && t.pena_maxima ? `${t.pena_minima} a ${t.pena_maxima}` : (t.pena_maxima ?? null),
    prescripcion: penaAnios != null ? `${calcularPlazoPrescripcion(penaAnios)} años (estimada, CP Art. 85)` : null,
  };
}

function mapDelitoEconomico(d) {
  const penaAnios = aniosDesdePena(d.pena_maxima);
  return {
    fuente: 'delitos-economicos',
    articulo: d.articulo_cp ? `CP Art. ${d.articulo_cp}` : (d.base_legal ?? null),
    nombre: d.nombre,
    pena: d.pena_minima && d.pena_maxima ? `${d.pena_minima} a ${d.pena_maxima}` : (d.pena_maxima ?? null),
    prescripcion: penaAnios != null ? `${calcularPlazoPrescripcion(penaAnios)} años (estimada, CP Art. 85)` : null,
  };
}

const TODOS_LOS_DELITOS = [
  ...TIPOS_PENALES.tipos.map(mapTipoPenal),
  ...DELITOS_ECONOMICOS.delitos.map(mapDelitoEconomico),
];

router.get('/delitos', authMiddleware, (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const qNorm = quitarTildes(q); // FIX LOW: comparación tolerante a tildes

  let resultados;
  if (!q) {
    // Sin q: primeros 10 de cada catálogo
    resultados = [
      ...TIPOS_PENALES.tipos.slice(0, 10).map(mapTipoPenal),
      ...DELITOS_ECONOMICOS.delitos.slice(0, 10).map(mapDelitoEconomico),
    ];
  } else {
    resultados = TODOS_LOS_DELITOS.filter((d) =>
      [d.nombre, d.articulo].some((campo) =>
        quitarTildes(String(campo ?? '').toLowerCase()).includes(qNorm)
      )
    ).slice(0, 20);
  }

  res.json({ success: true, data: resultados, total: resultados.length });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5) POST /api/herramientas/prescripcion — CP Arts. 85 y 88
//    Art. 85: plazo = pena máxima + mitad (mínimo 2 años).
//    Art. 88: cada acto interruptivo INICIA un nuevo plazo completo (no una
//    fracción). Se modela como suma de plazos completos por interruptor.
// ═════════════════════════════════════════════════════════════════════════════
const prescripcionSchema = z.object({
  pena_anios: z.number().positive().max(100, 'pena máxima 100 años'), // FIX: cota (máx legal CP = cadena perpetua aparte)
  fecha_hecho: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha_hecho debe ser YYYY-MM-DD')
    .refine((s) => fechaReal(s) !== null, 'fecha calendario válida requerida'), // FIX HIGH
  interruptores: z.number().int().min(0).max(50, 'interruptores fuera de rango').default(0), // FIX: cota
});

router.post('/prescripcion', authMiddleware, (req, res) => {
  const parsed = prescripcionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Datos de entrada inválidos.',
      details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      code: 'VALIDATION_ERROR',
    });
  }
  const { pena_anios, fecha_hecho, interruptores } = parsed.data;

  const plazoAnios = calcularPlazoPrescripcion(pena_anios);
  const fechaPrescripcion = parseFecha(fecha_hecho);
  // FIX MEDIUM (CP Art. 88): cada interrupción inicia un plazo COMPLETO nuevo
  // (no +mitad). Sumamos en MESES para no truncar fracciones de año (p. ej.
  // pena de 1 año → plazo 2 años; setFullYear con fracciones las perdía).
  // Guard defensivo: fecha_hecho ya validada como calendario real por el schema.
  if (Number.isNaN(fechaPrescripcion.getTime())) {
    return res.status(400).json({
      success: false,
      error: 'fecha_hecho inválida.',
      code: 'VALIDATION_ERROR',
    });
  }
  const totalMeses = Math.round((plazoAnios + interruptores * plazoAnios) * 12);
  fechaPrescripcion.setMonth(fechaPrescripcion.getMonth() + totalMeses);

  const hoy = new Date();
  const diasRestantes = Math.round((fechaPrescripcion - hoy) / 86_400_000);

  res.json({
    success: true,
    data: {
      plazo_anios: round2(plazoAnios),
      fecha_prescripcion: formatFechaLocal(fechaPrescripcion),
      dias_restantes: diasRestantes,
      prescrito: diasRestantes <= 0,
      base_legal: 'CP Art. 85 (plazo = pena máx + mitad, mín. 2 años) + CP Art. 88 (cada interrupción inicia plazo completo nuevo)',
    },
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6) GET /api/herramientas/tasas-bcrp — tasa moratoria real vía API BCRP
//    Serie PD04-20 (Tasa de interés moratoria, % anual). Feature flag
//    FEATURE_BCRP + BCRP_API_URL. Timeout 5s; fallback a último dato conocido.
// ═════════════════════════════════════════════════════════════════════════════
const FALLBACK_TASA_BCRP = {
  tasa_moratoria_pct: 7.6661,
  fuente: 'BCRP último dato conocido',
  stale: true,
};

// Helper reutilizable: obtiene la tasa moratoria BCRP (Serie PD04-20, % anual)
// con feature flag + allowlist https://*.bcrp.gob.pe + timeout 5s + fallback.
// Usada por tasas-bcrp y tasas-comparativo.
async function getTasaMoratoria(logger) {
  const featureOn = process.env.FEATURE_BCRP === 'true';
  const baseUrl = process.env.BCRP_API_URL;

  if (!featureOn || !baseUrl) {
    return { ...FALLBACK_TASA_BCRP };
  }

  // FIX (SSRF/allowlist): solo https + host bcrp.gob.pe; si no, fallback directo.
  let urlOk = false;
  try {
    const u = new URL(baseUrl);
    urlOk = u.protocol === 'https:' && u.hostname.endsWith('.bcrp.gob.pe');
  } catch { /* URL inválida */ }
  if (!urlOk) {
    logger?.warn?.('[getTasaMoratoria] BCRP_API_URL fuera de allowlist, usando fallback');
    return { ...FALLBACK_TASA_BCRP };
  }

  try {
    // Serie PD04-20 = Tasa de interés moratoria (% anual). Sin fechas → serie completa;
    // tomamos el último período con valor no nulo.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(`${baseUrl}/PD04-20/json`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) throw new Error(`BCRP HTTP ${resp.status}`);

    const json = await resp.json();
    const periods = Array.isArray(json.periods) ? json.periods : [];
    let ultimo = null;
    for (let i = periods.length - 1; i >= 0; i--) {
      const val = periods[i]?.values?.[0];
      if (val != null && val !== '' && !Number.isNaN(Number(val))) {
        ultimo = { pct: Number(val), periodo: periods[i].name };
        break;
      }
    }
    if (!ultimo) throw new Error('BCRP sin datos válidos');

    return {
      tasa_moratoria_pct: ultimo.pct,
      periodo: ultimo.periodo,
      fuente: 'BCRP (Serie PD04-20 — Tasa de interés moratoria)',
      stale: false,
    };
  } catch (err) {
    logger?.warn?.('[getTasaMoratoria] fallback activado', { error: err.message });
    return { ...FALLBACK_TASA_BCRP };
  }
}

router.get('/tasas-bcrp', authMiddleware, async (req, res) => {
  const data = await getTasaMoratoria(req.logger);
  res.json({ success: true, data });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9) GET /api/herramientas/tasas-comparativo?monto=&dias= — interés simple /360
//    comparativo sobre un monto con tres tasas:
//      - moratorio: tasa BCRP real (serie PD04-20) vía getTasaMoratoria().
//      - remunerativo: fija referencial TASA_REMUNERATIVA (ver nota abajo).
//      - legal CC Art. 1985-A: mitad de la tasa moratoria.
// ═════════════════════════════════════════════════════════════════════════════
// ⚠️ REFERENCIAL: el BCRP publica la tasa MORATORIA (PD04-20) pero no una tasa
// remunerativa única aplicable a obligaciones civiles; 4.5% es un valor
// referencial de mercado editable aquí (no es dato oficial).
const TASA_REMUNERATIVA = 4.5;

const comparativoQuerySchema = z.object({
  monto: z.coerce.number().positive().max(1_000_000_000, 'monto fuera de rango razonable'),
  dias: z.coerce.number().int().positive().max(3650, 'dias fuera de rango'),
});

router.get('/tasas-comparativo', authMiddleware, async (req, res) => {
  const parsed = comparativoQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Query params inválidos.',
      details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      code: 'VALIDATION_ERROR',
    });
  }
  const { monto, dias } = parsed.data;
  const moratoria = await getTasaMoratoria(req.logger);

  const calcular = (tipo, tasa_pct) => {
    const interes = round2(monto * (tasa_pct / 100) * (dias / 360));
    return { tipo, tasa_pct, interes, total: round2(monto + interes) };
  };

  const resultados = [
    calcular('moratorio_bcrp', moratoria.tasa_moratoria_pct),
    calcular('remunerativo', TASA_REMUNERATIVA),
    calcular('legal_cc_1985a', round2(moratoria.tasa_moratoria_pct / 2)),
  ];

  res.json({
    success: true,
    data: resultados,
    nota: `Interés simple /360 sobre S/ ${monto} por ${dias} días. Moratorio: ${moratoria.fuente}${moratoria.stale ? ' (fallback, dato stale)' : ''}. Remunerativa ${TASA_REMUNERATIVA}%: valor REFERENCIAL editable, no oficial. Legal CC Art. 1985-A: mitad del moratorio.`,
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 10) POST /api/herramientas/exportar-ics — genera calendario iCalendar
//     (RFC 5545) con los vencimientos: 1 VEVENT por evento con 2 VALARM
//     (recordatorios a -24h y -1h). Respuesta descargable text/calendar.
// ═════════════════════════════════════════════════════════════════════════════
const icsEventoSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha debe ser YYYY-MM-DD')
    .refine((s) => fechaReal(s) !== null, 'fecha calendario válida requerida'),
  descripcion: z.string().max(500).optional(),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'hora debe ser HH:mm').optional(),
});
const icsSchema = z.object({
  eventos: z.array(icsEventoSchema).min(1).max(50, 'máximo 50 eventos'),
});

// RFC 5545 §3.3.11 (TEXT): escapar backslash, coma y punto y coma; salto de
// línea → secuencia literal "\n".
function escaparIcsTexto(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function icsDtstampAhora() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

router.post('/exportar-ics', authMiddleware, (req, res) => {
  const parsed = icsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Datos de entrada inválidos.',
      details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      code: 'VALIDATION_ERROR',
    });
  }

  const dtstamp = icsDtstampAhora();
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LegalPro//ES'];

  for (const ev of parsed.data.eventos) {
    const [y, m, d] = ev.fecha.split('-');
    // Con hora → datetime local flotante (RFC 5545 §3.3.5 FORM #2); sin hora → all-day.
    const dtstart = ev.hora
      ? `DTSTART:${y}${m}${d}T${ev.hora.replace(':', '')}00`
      : `DTSTART;VALUE=DATE:${y}${m}${d}`;

    lineas.push(
      'BEGIN:VEVENT',
      `UID:${randomUUID()}@legalpro`,
      `DTSTAMP:${dtstamp}`,
      dtstart,
      `SUMMARY:${escaparIcsTexto(ev.titulo)}`
    );
    if (ev.descripcion) lineas.push(`DESCRIPTION:${escaparIcsTexto(ev.descripcion)}`);
    for (const trigger of ['-PT24H', '-PT1H']) {
      lineas.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:Recordatorio LegalPro: ${escaparIcsTexto(ev.titulo)}`,
        `TRIGGER:${trigger}`,
        'END:VALARM'
      );
    }
    lineas.push('END:VEVENT');
  }
  lineas.push('END:VCALENDAR');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="vencimientos-legalpro.ics"');
  res.send(lineas.join('\r\n') + '\r\n'); // CRLF obligatorio (RFC 5545 §3.1)
});

// ═════════════════════════════════════════════════════════════════════════════
// 11) POST /api/herramientas/liquidacion-laboral — beneficios sociales
//     Base legal: LPCL (D.S. 003-97-TR) arts. 1-7 + D.S. 001-97-TR.
//       - CTS: D.S. 001-97-TR arts. 3-5 (depósitos semestrales mayo-nov /
//         dic-abr). Simplificado aquí como proporcional a días /360.
//       - Vacaciones truncas: LPCL art. 10 (30 días/año → 1/12 por mes del
//         año no devengado completo, contado desde el último aniversario).
//       - Gratificación trunca: D.S. 001-97-TR arts. 32-35 (semestres
//         enero-junio y julio-diciembre; medio sueldo por semestre).
//       - Indemnización despido arbitrario: D.S. 001-97-TR arts. 34 y 38
//         (1.5 sueldos/año + fracción proporcional, tope 12 sueldos).
//     ⚠️ CÁLCULO SIMPLIFICADO REFERENCIAL — el real depende de fechas de
//     aniversario, remuneraciones variables (prom. 6 meses) y períodos
//     vencidos no cobrados.
// ═════════════════════════════════════════════════════════════════════════════
const liquidacionSchema = z
  .object({
    fecha_ingreso: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha_ingreso debe ser YYYY-MM-DD')
      .refine((s) => fechaReal(s) !== null, 'fecha calendario válida requerida'),
    fecha_cese: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha_cese debe ser YYYY-MM-DD')
      .refine((s) => fechaReal(s) !== null, 'fecha calendario válida requerida'),
    remuneracion_mensual: z.number().positive().max(1_000_000, 'remuneracion_mensual fuera de rango razonable'),
    // Meses con gratificación ya percibida — informativo en la versión
    // simplificada (no altera el cálculo truncado por semestre actual).
    meses_con_gratificacion: z.number().int().min(0).max(600).default(0),
    motivo: z.enum(['despido_arbitrario', 'otro']).default('otro'),
  })
  .refine((d) => parseFecha(d.fecha_cese) > parseFecha(d.fecha_ingreso), {
    message: 'fecha_cese debe ser posterior a fecha_ingreso',
    path: ['fecha_cese'],
  });

router.post('/liquidacion-laboral', authMiddleware, (req, res) => {
  const parsed = liquidacionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Datos de entrada inválidos.',
      details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      code: 'VALIDATION_ERROR',
    });
  }
  const { fecha_ingreso, fecha_cese, remuneracion_mensual: R, motivo } = parsed.data;
  const fi = parseFecha(fecha_ingreso);
  const fc = parseFecha(fecha_cese);

  // ── Tiempo de servicio calendario {anios, meses, dias} ──
  let anios = fc.getFullYear() - fi.getFullYear();
  let meses = fc.getMonth() - fi.getMonth();
  let dias = fc.getDate() - fi.getDate();
  if (dias < 0) {
    meses -= 1;
    // Borrow de días del mes previo al cese (repetido por si el borrow deja
    // <0, p. ej. ingreso día 31 vs cese día 1 con mes previo de 28 días).
    while (dias < 0) {
      dias += new Date(fc.getFullYear(), fc.getMonth(), 0).getDate();
    }
  }
  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }

  // Meses completos totales (mismo criterio que indemnizacion-despido)
  let mesesTotales = (fc.getFullYear() - fi.getFullYear()) * 12 + (fc.getMonth() - fi.getMonth());
  if (fc.getDate() < fi.getDate()) mesesTotales -= 1;

  // ── CTS simplificada: 1 sueldo por semestre completo ≈ R × (días/360) ──
  const diasPeriodo = diasEntre(fecha_ingreso, fecha_cese);
  const cts = round2(R * (diasPeriodo / 360));

  // ── Vacaciones truncas: R/12 por mes completo desde el último aniversario
  //    (simplificado: total_meses % 12, sin rastrear la fecha exacta) ──
  const mesesDesdeAniversario = ((mesesTotales % 12) + 12) % 12;
  const vacacionesTruncas = round2((R / 12) * mesesDesdeAniversario);

  // ── Gratificación trunca: R/2 × (meses completos del semestre actual / 6)
  //    Semestres legales: enero-junio y julio-diciembre (empiezan día 1). ──
  const semInicioMes = fc.getMonth() <= 5 ? 0 : 6;
  const mesesSemestreActual = fc.getMonth() - semInicioMes;
  const gratificacionTrunca = round2((R / 2) * (mesesSemestreActual / 6));

  // ── Indemnización despido arbitrario (arts. 34 y 38): solo si aplica ──
  let indemnizacion = null;
  if (motivo === 'despido_arbitrario') {
    const aniosCompletos = Math.floor(mesesTotales / 12);
    const mesesFraccion = mesesTotales % 12;
    const bruta = round2(aniosCompletos * 1.5 * R + (mesesFraccion / 12) * 1.5 * R);
    const tope = round2(12 * R); // tope legal: 12 remuneraciones
    indemnizacion = {
      anios_completos: aniosCompletos,
      meses_fraccion: mesesFraccion,
      monto_bruto: bruta,
      tope_aplicado: bruta > tope,
      monto: round2(Math.min(bruta, tope)),
    };
  }

  const total = round2(cts + vacacionesTruncas + gratificacionTrunca + (indemnizacion?.monto ?? 0));

  res.json({
    success: true,
    data: {
      tiempo_servicio: { anios, meses, dias },
      cts,
      vacaciones_truncas: vacacionesTruncas,
      gratificacion_trunca: gratificacionTrunca,
      indemnizacion,
      total,
      base_legal: 'LPCL arts. 1-7 + D.S. 001-97-TR',
      nota: 'Cálculo simplificado referencial — el cálculo real depende de fechas de aniversario, períodos vencidos y remuneración variable (prom. 6 meses).',
    },
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 12) POST /api/herramientas/pension-alimentos — pensión referencial
//     Base legal: Ley 28720 (procedimiento de fijación de pensión de
//     alimentos: prueba de ingresos) + jurisprudencia de la Corte Suprema
//     (p. ej. Cas. 3456-2016): rangos referenciales según número de hijos.
//       - 1 hijo: 20-30% → se usa 25%.
//       - 2 hijos: 35-45% → se usa 40%.
//       - 3+ hijos: 50% fijo, dividido entre los hijos.
//     ⚠️ REFERENCIAL — el juez fija la pensión según las pruebas de ingresos
//     aportadas (Ley 28720), no por tabla automática.
// ═════════════════════════════════════════════════════════════════════════════
const pensionSchema = z.object({
  ingresos_demandado: z.number().min(0).max(10_000_000, 'ingresos_demandado fuera de rango razonable'),
  numero_hijos: z.number().int().min(1, 'mínimo 1 hijo').max(10, 'numero_hijos fuera de rango'),
  otros_ingresos: z.number().min(0).max(10_000_000, 'otros_ingresos fuera de rango razonable').default(0),
});

router.post('/pension-alimentos', authMiddleware, (req, res) => {
  const parsed = pensionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Datos de entrada inválidos.',
      details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      code: 'VALIDATION_ERROR',
    });
  }
  const { ingresos_demandado, numero_hijos, otros_ingresos } = parsed.data;

  const baseImponible = ingresos_demandado + otros_ingresos;
  if (baseImponible <= 0) {
    return res.status(400).json({
      success: false,
      error: 'La suma de ingresos_demandado y otros_ingresos debe ser mayor a 0.',
      code: 'VALIDATION_ERROR',
    });
  }

  const pct =
    numero_hijos === 1 ? 0.25 :
    numero_hijos === 2 ? 0.4 :
    0.5;

  const pensionTotal = round2(baseImponible * pct);
  const pensionPorHijo = round2(pensionTotal / numero_hijos);

  res.json({
    success: true,
    data: {
      numero_hijos,
      base_imponible: round2(baseImponible),
      porcentaje_aplicado: pct * 100,
      pension_total_mensual: pensionTotal,
      pension_por_hijo: pensionPorHijo,
      base_legal: 'Ley 28720 + jurisprudencia suprema (rangos referenciales, p. ej. Cas. 3456-2016)',
      nota: 'Referencial — el juez fija la pensión según pruebas de ingresos (Ley 28720)',
    },
  });
});

export default router;
