// legalpro-app/server/services/vencimientosService.js
// LegalPro — Servicio de vencimientos de plazos procesales (feature de retención)
//
// Lógica compartida entre:
//   - GET /api/plazos/vencimientos  (routes/plazos.js)
//   - Cron diario de alertas        (cron-jobs.js)
//
// Adaptación al esquema real:
//   - La tabla `expedientes` NO tiene columnas fecha_audiencia ni
//     fecha_vencimiento. La única fecha confiable es `created_at`
//     (timestamptz, fecha de ingreso del expediente al sistema).
//   - Los plazos procesales se calculan a partir del catálogo
//     `catalogs/plazos-procesales.json` aplicando días hábiles reales
//     (utils/feriados.js, CPC Art. 144).
//   - NO se inventan fechas: si un expediente no tiene fecha base ni un
//     plazo aplicable en el catálogo, se excluye (o se marca SIN_FECHA_DEFINIDA).
import db, { tenantQuery } from '../db.js';
import { sumarDiasHabiles, esDiaHabil } from '../utils/feriados.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CATALOG_PATH = join(__dirname, '../../../catalogs/plazos-procesales.json');

let plazosCache = null;

function loadPlazosCatalog() {
  if (!plazosCache) {
    plazosCache = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
  }
  return plazosCache;
}

// ── Utilidades de fecha ────────────────────────────────────────────────────────

/** Convierte Date/timestamptz a YYYY-MM-DD en hora local del servidor */
function toDateStr(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Fecha de hoy en YYYY-MM-DD */
function hoyStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Días hábiles transcurridos entre dos fechas YYYY-MM-DD (inclusive ambos bordes). */
export function contarDiasHabilesEntre(fechaInicio, fechaFin) {
  if (!fechaInicio || !fechaFin) return null;
  const inicio = new Date(fechaInicio + 'T00:00:00');
  const fin = new Date(fechaFin + 'T00:00:00');
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return null;
  if (fin < inicio) return 0;

  let dias = 0;
  const cursor = new Date(inicio);
  while (cursor <= fin) {
    const str = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (esDiaHabil(str)) dias++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

// ── Cálculo de vencimientos ────────────────────────────────────────────────────

/**
 * Mapea la materia libre del expediente (TEXT sin CHECK) al discriminador
 * del catálogo de plazos. El catálogo usa valores del CHECK constraint
 * (`tipo`: civil, penal, laboral, constitucional, familia, administrativo)
 * y sub-materias específicas (obligaciones, alimentos, amparo, etc.).
 *
 * Estrategia de 3 niveles:
 *   1) si materia tiene un plazo propio en el catálogo → usarla
 *   2) si tipo tiene un plazo en el catálogo → usar tipo (fallback)
 *   3) si nada matchea → null (procesará como SIN_FECHA_DEFINIDA)
 */
function resolverMateriaParaPlazo(expediente) {
  const catalog = loadPlazosCatalog();
  const materiaLibre = String(expediente.materia || '').trim().toLowerCase();
  const tipo = String(expediente.tipo || '').trim().toLowerCase();
  const materiasValidas = new Set(catalog.plazos.map((p) => String(p.materia).toLowerCase()));

  // 1) materia libre tiene match directo en el catálogo
  if (materiaLibre && materiasValidas.has(materiaLibre)) return materiaLibre;

  // 2) tipo (CHECK constraint) tiene match directo en el catálogo
  if (tipo && materiasValidas.has(tipo)) return tipo;

  // 3) heurística: mapear sub-materias conocidas al tipo más cercano del CHECK
  //    (esto permite que futuras sub-materias se mapeen sin tocar el código)
  const mapaSubMaterias = {
    'obligaciones': 'civil',
    'alimentos': 'familia',
    'tenencia': 'familia',
    'régimen de visitas': 'familia',
    'divorcio': 'familia',
    'amparo': 'constitucional',
    'habeas corpus': 'constitucional',
    'habeas data': 'constitucional',
    'despido': 'laboral',
    'hostigamiento': 'laboral',
    'pensión': 'laboral',
    'tributario': 'administrativo',
    'previsional': 'administrativo',
  };
  if (materiaLibre && mapaSubMaterias[materiaLibre]) return mapaSubMaterias[materiaLibre];

  // sin match: devolver materia libre (último recurso, probablemente fallará)
  return materiaLibre || tipo || '';
}

/**
 * Devuelve el plazo de "contestación de demanda" aplicable a un expediente.
 * Usa `resolverMateriaParaPlazo` que aplica 3 niveles de fallback.
 */
function getPlazoContestacion(expediente) {
  const catalog = loadPlazosCatalog();
  const materia = resolverMateriaParaPlazo(expediente);
  if (!materia) return null;

  // Buscar el plazo de contestación de la materia resuelta
  const contestacion = catalog.plazos.find(
    (p) => p.acto && p.acto.toLowerCase().includes('contestaci') && p.materia.toLowerCase() === materia && Number.isFinite(p.dias)
  );
  if (contestacion) return contestacion;

  // Fallback: civil es la materia por defecto del CHECK de la tabla expedientes
  if (materia === 'civil') {
    return catalog.plazos.find((p) => p.id === 'plazo_contestacion_demanda_civil');
  }
  return null;
}

/**
 * Calcula los próximos vencimientos para una lista de expedientes.
 *
 * @param {Array} expedientes — filas de la tabla expedientes (mismo tenant)
 * @param {Object} options
 * @param {number} options.dias — ventana en días calendario (default 30)
 * @returns {Array} vencimientos ordenados por fecha_limite asc
 */
export function calcularVencimientos(expedientes, options = {}) {
  const { dias = 30 } = options;
  const hoy = hoyStr();
  const ventanaFin = new Date();
  ventanaFin.setDate(ventanaFin.getDate() + dias);
  const ventanaFinStr = `${ventanaFin.getFullYear()}-${String(ventanaFin.getMonth() + 1).padStart(2, '0')}-${String(ventanaFin.getDate()).padStart(2, '0')}`;

  const resultados = [];

  for (const exp of expedientes) {
    // Solo expedientes activos y no eliminados (defensa extra: ya filtrado en SQL)
    if (exp.estado !== 'activo' || exp.deleted_at) continue;

    const base = {
      expediente_id: exp.id,
      numero: exp.numero,
      titulo: exp.titulo,
      tipo: exp.tipo,
      materia: exp.materia || exp.tipo || 'general',
      estado: exp.estado,
    };

    const fechaBase = toDateStr(exp.created_at);
    const plazo = getPlazoContestacion(exp);

    // 1) Plazo de contestación estimado (si hay fecha base + plazo aplicable)
    if (fechaBase && plazo) {
      const fechaLimite = sumarDiasHabiles(fechaBase, plazo.dias);
      if (fechaLimite >= hoy && fechaLimite <= ventanaFinStr) {
        const diasRestantes = contarDiasHabilesEntre(hoy, fechaLimite) ?? 0;
        resultados.push({
          ...base,
          evento: 'PLAZO_CONTESTACION',
          evento_descripcion: `${plazo.acto} (${plazo.codigo} art. ${plazo.articulo})`,
          fecha_limite: fechaLimite,
          dias_restantes: diasRestantes,
          dias_calendario_restantes: Math.round((new Date(fechaLimite + 'T00:00:00') - new Date(hoy + 'T00:00:00')) / 86_400_000),
          urgencia: clasificarUrgencia(diasRestantes),
          base_legal: `${plazo.codigo} art. ${plazo.articulo}`,
          estimado: true, // fecha base = created_at, no hay columna de notificación real
        });
      }
    }

    // 2) Vencimiento de caducidad (materia constitucional: amparo/habeas data, 60 días calendario)
    const caducidad = catalogCaducidad(exp);
    if (caducidad && fechaBase) {
      const fechaLimite = sumarDiasCalendario(fechaBase, caducidad.dias);
      if (fechaLimite >= hoy && fechaLimite <= ventanaFinStr) {
        const diasRestantes = contarDiasHabilesEntre(hoy, fechaLimite) ?? 0;
        resultados.push({
          ...base,
          evento: 'CADUCIDAD',
          evento_descripcion: `${caducidad.acto} — plazo de caducidad (${caducidad.codigo} art. ${caducidad.articulo})`,
          fecha_limite: fechaLimite,
          dias_restantes: diasRestantes,
          dias_calendario_restantes: Math.round((new Date(fechaLimite + 'T00:00:00') - new Date(hoy + 'T00:00:00')) / 86_400_000),
          urgencia: clasificarUrgencia(diasRestantes),
          base_legal: `${caducidad.codigo} art. ${caducidad.articulo}`,
          estimado: true,
        });
      }
    }
  }

  // 3) SIN_FECHA_DEFINIDA: expedientes activos sin fecha base ni plazo aplicable
  //    — solo cuando es útil (evita ruido si ya hay resultados concretos de esa materia)
  for (const exp of expedientes) {
    if (exp.estado !== 'activo' || exp.deleted_at) continue;
    const yaTieneEvento = resultados.some((r) => r.expediente_id === exp.id);
    if (yaTieneEvento) continue;
    const fechaBase = toDateStr(exp.created_at);
    const plazo = getPlazoContestacion(exp);
    if (!fechaBase || !plazo) {
      resultados.push({
        expediente_id: exp.id,
        numero: exp.numero,
        titulo: exp.titulo,
        tipo: exp.tipo,
        materia: exp.materia || exp.tipo || 'general',
        estado: exp.estado,
        evento: 'SIN_FECHA_DEFINIDA',
        evento_descripcion: 'Expediente activo sin fecha de notificación registrada o sin plazo aplicable en catálogo.',
        fecha_limite: null,
        dias_restantes: null,
        dias_calendario_restantes: null,
        urgencia: 'BAJA',
        base_legal: null,
        estimado: false,
      });
    }
  }

  // Ordenar: fecha_limite asc (nulls al final), luego urgencia
  return resultados.sort((a, b) => {
    if (!a.fecha_limite && !b.fecha_limite) return 0;
    if (!a.fecha_limite) return 1;
    if (!b.fecha_limite) return -1;
    return a.fecha_limite.localeCompare(b.fecha_limite);
  });
}

/** Suma N días calendario a una fecha YYYY-MM-DD */
function sumarDiasCalendario(fechaStr, n) {
  const d = new Date(fechaStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Plazo de caducidad aplicable por discriminador (si el catálogo lo define
 * como caducidad). Usa el discriminador resuelto para detectar constitucional
 * tanto por `tipo` como por sub-materias (`amparo`, `habeas corpus`, etc.).
 */
function catalogCaducidad(exp) {
  const catalog = loadPlazosCatalog();
  const discriminador = resolverMateriaParaPlazo(exp);
  // Solo aplica a constitucional (incluye amparo, habeas corpus/data resueltos)
  if (discriminador !== 'constitucional') return null;
  return catalog.plazos.find(
    (p) => p.materia === 'constitucional' && p.nota && p.nota.toLowerCase().includes('caducidad') && Number.isFinite(p.dias)
  );
}

/** Clasifica urgencia según días hábiles restantes */
export function clasificarUrgencia(diasHabiles) {
  if (diasHabiles === null || diasHabiles === undefined) return 'BAJA';
  if (diasHabiles <= 1) return 'CRITICA';
  if (diasHabiles <= 5) return 'ALTA';
  if (diasHabiles <= 15) return 'MEDIA';
  return 'BAJA';
}

// ── Consultas a BD ─────────────────────────────────────────────────────────────

/**
 * Expedientes activos de una organización.
 * Usa tenantQuery (contexto RLS activo) — para uso dentro de requests.
 */
export async function getExpedientesActivosPorOrg(organizationId) {
  const { rows } = await tenantQuery(
    `SELECT id, numero, titulo, tipo, materia, estado, es_urgente, created_at, deleted_at
       FROM expedientes
      WHERE organization_id = $1 AND estado = 'activo' AND deleted_at IS NULL
      ORDER BY created_at ASC`,
    [organizationId]
  );
  return rows;
}

/**
 * Todas las organizaciones activas (para el cron global).
 * Usa db.query directo (contexto de sistema) — patrón del cron existente.
 */
export async function getOrganizacionesActivas() {
  const { rows } = await db.query(
    `SELECT id, nombre, activo FROM organizaciones WHERE activo = TRUE ORDER BY nombre ASC`
  );
  return rows;
}

/**
 * Expedientes activos de TODAS las organizaciones activas (cron).
 * Devuelve [{ organization_id, ...expediente }]
 */
export async function getExpedientesActivosGlobal() {
  const { rows } = await db.query(
    `SELECT e.organization_id, e.id, e.numero, e.titulo, e.tipo, e.materia, e.estado, e.es_urgente, e.created_at, e.deleted_at
       FROM expedientes e
       JOIN organizaciones o ON o.id = e.organization_id
      WHERE e.estado = 'activo' AND e.deleted_at IS NULL AND o.activo = TRUE
      ORDER BY e.organization_id, e.created_at ASC`
  );
  return rows;
}

/**
 * Usuarios activos de una organización (para generar notificaciones por usuario).
 */
export async function getUsuariosDeOrganizacion(organizationId) {
  const { rows } = await db.query(
    `SELECT id, organization_id FROM usuarios
      WHERE organization_id = $1 AND esta_activo = TRUE`,
    [organizationId]
  );
  return rows;
}

/**
 * Lógica principal: vencimientos próximos de una organización.
 * @param {string} organizationId
 * @param {Object} options { dias = 30 }
 */
export async function getVencimientosPorOrganizacion(organizationId, options = {}) {
  const expedientes = await getExpedientesActivosPorOrg(organizationId);
  let vencimientos = calcularVencimientos(expedientes, options);

  // Aplica overrides manuales del abogado (drag & drop + completado).
  // Se cruzan por (expediente_id, evento) y reemplazan fecha_limite / marcan completado.
  vencimientos = await aplicarOverrides(vencimientos, organizationId);

  // Cuenta items efectivamente modificados por un override del abogado
  // (drag & drop reagendó la fecha → overridden=true, o marcado como completado).
  // Sirve al frontend para mostrar "N overrides aplicados en este cálculo".
  const overridesAplicados = vencimientos.filter(
    (v) => v.overridden === true || v.completado === true
  ).length;

  return {
    vencimientos,
    total: vencimientos.length,
    overrides_aplicados: overridesAplicados,
    generado_en: new Date().toISOString(),
    org_id: organizationId,
  };
}

export async function getOverridesPorOrganizacion(organizationId) {
  const { rows } = await tenantQuery(
    `SELECT expediente_id, evento, nueva_fecha_limite, completado, completado_at
       FROM vencimientos_overrides
      WHERE organization_id = $1`,
    [organizationId]
  );
  return rows;
}

/**
 * Aplica overrides (drag & drop + completado) a la lista de vencimientos
 * recién calculada. Idempotente. No modifica el orden ni la cantidad.
 *
 * Reglas:
 *  - Si hay override.fecha_limite: reemplaza la fecha_limite calculada
 *    y recalcula dias_restantes / dias_calendario_restantes / urgencia.
 *  - Si hay override.completado=true: añade campos completado + completado_at.
 *  - Items SIN_FECHA_DEFINIDA se ignoran (no tienen fecha para reagendar).
 */
export async function aplicarOverrides(vencimientos, organizationId) {
  if (!Array.isArray(vencimientos) || vencimientos.length === 0) return vencimientos;

  const overrides = await getOverridesPorOrganizacion(organizationId);
  if (!overrides.length) return vencimientos;

  const map = new Map();
  for (const o of overrides) {
    map.set(`${o.expediente_id}::${o.evento}`, o);
  }

  const hoy = hoyStr();

  return vencimientos.map((v) => {
    const key = `${v.expediente_id}::${v.evento}`;
    const o = map.get(key);
    if (!o) return v;

    const actualizado = { ...v };

    if (o.nueva_fecha_limite && v.evento !== 'SIN_FECHA_DEFINIDA') {
      const fechaLimite = toDateStr(o.nueva_fecha_limite);
      if (fechaLimite) {
        actualizado.fecha_limite = fechaLimite;
        actualizado.dias_restantes = contarDiasHabilesEntre(hoy, fechaLimite) ?? 0;
        actualizado.dias_calendario_restantes = Math.round(
          (new Date(fechaLimite + 'T00:00:00') - new Date(hoy + 'T00:00:00')) / 86_400_000
        );
        actualizado.urgencia = clasificarUrgencia(actualizado.dias_restantes);
        actualizado.estimado = true; // la fecha fue movida a mano, ya no es estimada pura
        actualizado.overridden = true;
      }
    }

    if (o.completado) {
      actualizado.completado = true;
      actualizado.completado_at = o.completado_at || null;
    }

    return actualizado;
  });
}

/**
 * Upsert idempotente de un override para (organization, expediente, evento).
 * Devuelve la fila resultante (incluyendo id, created_at, updated_at).
 *
 * @param {Object} params
 * @param {string} params.organizationId
 * @param {string} params.expedienteId   — UUID del expediente
 * @param {string} params.evento         — ej: 'PLAZO_CONTESTACION', 'CADUCIDAD'
 * @param {string|null} [params.nuevaFechaLimite] — 'YYYY-MM-DD' o null
 * @param {boolean} [params.completado]
 * @param {string|null} [params.completadoPor] — UUID del usuario
 */
export async function upsertOverride({
  organizationId,
  expedienteId,
  evento,
  nuevaFechaLimite = null,
  completado = null,
  completadoPor = null,
}) {
  const completadoAt = completado === true ? 'now()' : 'NULL';

  const { rows } = await tenantQuery(
    `INSERT INTO vencimientos_overrides
       (organization_id, expediente_id, evento, nueva_fecha_limite, completado, completado_at, completado_por, updated_at)
     VALUES ($1, $2, $3, $4, COALESCE($5, FALSE), ${completadoAt}, $6, now())
     ON CONFLICT (expediente_id, evento) DO UPDATE SET
       nueva_fecha_limite = COALESCE(EXCLUDED.nueva_fecha_limite, vencimientos_overrides.nueva_fecha_limite),
       completado        = COALESCE(EXCLUDED.completado, vencimientos_overrides.completado),
       completado_at     = CASE
                            WHEN EXCLUDED.completado = TRUE  THEN now()
                            WHEN EXCLUDED.completado = FALSE THEN NULL
                            ELSE vencimientos_overrides.completado_at
                          END,
       completado_por    = COALESCE(EXCLUDED.completado_por, vencimientos_overrides.completado_por),
       updated_at        = now()
     RETURNING id, organization_id, expediente_id, evento, nueva_fecha_limite, completado, completado_at, completado_por, created_at, updated_at`,
    [
      organizationId,
      expedienteId,
      evento,
      nuevaFechaLimite,
      completado,
      completadoPor,
    ]
  );
  return rows[0];
}
