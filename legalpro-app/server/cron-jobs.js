// legalpro-app/server/cron-jobs.js
// LegalPro — CRON jobs programados
//
// Ejecuta tareas programadas del sistema:
//   - Actualización de catálogos legales (01:00 AM hora Perú)
//   - Limpieza de logs viejos
//
// Railway CRON nativo (preferido):
//   Configurar en Railway → CRON Jobs → POST /api/admin/update-catalogos
//   Horario: "0 6 * * *" (06:00 UTC = 01:00 Perú)
//
// node-cron (fallback para self-hosted):
//   Importar e inicializar en server/index.js
//
// Uso:
//   import { initCronJobs } from './cron-jobs.js'
//   initCronJobs()  // arranca todos los jobs programados

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import db from './db.js';
import {
  calcularVencimientos,
  getExpedientesActivosGlobal,
  getUsuariosDeOrganizacion,
} from './services/vencimientosService.js';
import { logAudit } from './utils/audit.js';
import { maskPII } from './logger.js';
import { anonimizarDatosSensibles } from './utils/datosSensibles.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Logger inline (sin logger externo para bootstrap seguro) ──────────────────

function cronLog(level, msg, meta = {}) {
  const entry = {
    level,
    msg,
    ts: new Date().toISOString(),
    component: 'cron-jobs',
    ...meta,
  };
  if (process.env.NODE_ENV === 'production') {
    process.stdout.write(JSON.stringify(entry) + '\n');
  } else {
    const prefix = `[CRON][${level.toUpperCase()}]`;
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    console.log(`${prefix} ${msg}${metaStr}`);
  }
}

// ── Constantes ────────────────────────────────────────────────────────────────

const TOOLS_DIR = resolve(__dirname, '..', '..', 'tools');
const UPDATER_SCRIPT = resolve(TOOLS_DIR, 'legal-catalog-updater.mjs');

// ── Actualizador de catálogos (vía import dinámico) ───────────────────────────

export async function ejecutarActualizacionCatalogos() {
  const start = Date.now();
  cronLog('info', 'Iniciando actualización de catálogos legales...');

  try {
    if (!existsSync(UPDATER_SCRIPT)) {
      throw new Error(`Updater no encontrado en: ${UPDATER_SCRIPT}`);
    }

    // Importar dinámico del módulo ESM
    const updater = await import(UPDATER_SCRIPT);

    if (typeof updater.main !== 'function') {
      throw new Error('El updater no exporta una función main()');
    }

    const result = await updater.main();

    const duration = Date.now() - start;
    const status = result.ok ? 'completada' : 'con errores';
    cronLog('info', `Actualización de catálogos ${status}`, {
      duration,
      passed: result.passed,
      failed: result.failed,
      errors: result.totalErrors,
      warnings: result.totalWarnings,
    });

    return result;
  } catch (err) {
    const duration = Date.now() - start;
    cronLog('error', 'Error en actualización de catálogos', {
      duration,
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 3).join(' | '),
    });
    throw err;
  }
}

// ── Tarea de limpieza de logs de auditoría > 90 días (LPDP compliance) ──────

export async function ejecutarLimpiezaLogs() {
  const start = Date.now();
  cronLog('info', 'Iniciando limpieza de logs antiguos (> 90 días)...');

  try {
    // Calcular fecha de corte: hoy - 90 días
    const fechaCorte = new Date();
    fechaCorte.setDate(fechaCorte.getDate() - 90);

    // FIX P1-A: la columna `severity` puede no existir en todos los despliegues
    // y el predicado `severity NOT IN (...)` era NULL-unsafe (NULL NOT IN ...
    // evalúa a NULL → las filas con severity NULL JAMÁS se borraban).
    // Estrategia en dos fases:
    //   1) Intentar la función nativa de limpieza fn_cleanup_old_audit_log(2).
    //   2) Si no existe o falla, fallback a DELETE con predicado NULL-safe.
    let deletedAudit = 0;
    let auditCleanupVia = 'fallback_delete';
    try {
      const { rows } = await db.query('SELECT * FROM fn_cleanup_old_audit_log(2)');
      deletedAudit = rows[0]?.fn_cleanup_old_audit_log ?? rows[0]?.count ?? 0;
      auditCleanupVia = 'fn_cleanup_old_audit_log';
    } catch (fnErr) {
      cronLog('warn', 'fn_cleanup_old_audit_log no disponible — usando DELETE fallback', {
        error: fnErr.message,
      });
      const { rowCount } = await db.query(
        `DELETE FROM audit_log
          WHERE created_at < now() - interval '90 days'
            AND (severity IS NULL OR severity NOT IN ('CRITICAL', 'ERROR'))`
      );
      deletedAudit = rowCount;
    }

    // Eliminar logs de notificaciones más antiguos de 90 días (no son compliance)
    const { rowCount: deletedNotif } = await db.query(
      `DELETE FROM notificaciones_sinoe
       WHERE creado_en < $1`,
      [fechaCorte]
    );

    // FIX P1-A: limpieza best-effort de outbox y rag_audit (las funciones pueden
    // no existir en despliegues antiguos — nunca deben tumbar el job completo).
    try {
      await db.query('SELECT fn_cleanup_old_outbox(90)');
    } catch (outboxErr) {
      cronLog('warn', 'fn_cleanup_old_outbox falló u omitida', { error: outboxErr.message });
    }
    try {
      await db.query('SELECT fn_cleanup_old_rag_audit(90)');
    } catch (ragErr) {
      cronLog('warn', 'fn_cleanup_old_rag_audit falló u omitida', { error: ragErr.message });
    }

    cronLog('info', 'Limpieza completada', {
      audit_logs_deleted: deletedAudit,
      audit_cleanup_via: auditCleanupVia,
      notificaciones_deleted: deletedNotif,
      fecha_corte: fechaCorte.toISOString(),
      duration: Date.now() - start,
    });

    return { deletedAudit, deletedNotif, fechaCorte, auditCleanupVia };
  } catch (err) {
    cronLog('error', 'Error en limpieza de logs', { error: err.message });
    throw err;
  }
}

// ── Alertas proactivas de vencimientos de plazos procesales ───────────────────
// Feature de retención propuesta por @auditor-performance.
// Diariamente:
//   1. Recorre los expedientes ACTIVOS de todas las organizaciones activas.
//   2. Calcula vencimientos próximos (misma lógica que GET /api/plazos/vencimientos).
//   3. Para urgencia CRITICA o ALTA (≤5 días hábiles según clasificarUrgencia)
//      inserta una notificación en notificaciones_sinoe POR USUARIO de la org.
//   4. Idempotente: INSERT ... SELECT ... WHERE NOT EXISTS con clave natural
//      (organization_id, usuario_id, expediente_numero, tipo_notificacion='PLAZO_VENCIMIENTO',
//      fecha_notificacion=fecha_limite) → nunca duplica el mismo vencimiento.
//
// Adaptación al esquema real: la tabla es `notificaciones_sinoe` (no `notificaciones`)
// y su CHECK `urgencia IN ('alta','media','baja')` NO acepta 'critica', por lo que
// CRITICA/ALTA se mapean a 'alta'.
export async function ejecutarAlertasVencimientos() {
  const start = Date.now();
  cronLog('info', 'Iniciando alertas proactivas de vencimientos...');

  // El cron corre como rol owner (patrón existente) — bypasa RLS a nivel de tabla.
  const expedientes = await getExpedientesActivosGlobal();

  // Agrupar por organización
  const porOrg = new Map();
  for (const exp of expedientes) {
    const { organization_id: orgId, ...resto } = exp;
    if (!porOrg.has(orgId)) porOrg.set(orgId, []);
    porOrg.get(orgId).push(resto);
  }

  let notificacionesInsertadas = 0;
  let alertasCriticas = 0;
  let alertasAltas = 0;
  const errores = [];

  for (const [orgId, expOrg] of porOrg) {
    try {
      // Ventana de 15 días calendario: cubre CRITICA (≤1) y ALTA (≤5) días hábiles
      const vencimientos = calcularVencimientos(expOrg, { dias: 15 });
      const urgentes = vencimientos.filter((v) => v.urgencia === 'CRITICA' || v.urgencia === 'ALTA');
      if (urgentes.length === 0) continue;

      const usuarios = await getUsuariosDeOrganizacion(orgId);
      // Si no hay usuarios con la org, insertar una alerta org-level (usuario_id NULL)
      const targets = usuarios.length > 0 ? usuarios : [{ id: null }];

      for (const v of urgentes) {
        const urgenciaDb = v.urgencia === 'CRITICA' || v.urgencia === 'ALTA' ? 'alta' : 'media';
        if (v.urgencia === 'CRITICA') alertasCriticas++;
        else alertasAltas++;

        // LPDP PII masking: anonimizar expediente numero/titulo antes de persistir en notificaciones
        const tituloRaw = `Plazo por vencer: ${v.evento_descripcion || v.evento}`;
        const contenidoRaw =
          `El expediente ${v.numero} (${v.titulo}) tiene un plazo de ${v.evento_descripcion || v.evento} ` +
          `que vence el ${v.fecha_limite}. Quedan ${v.dias_restantes} día(s) hábil(es). ` +
          (v.estimado
            ? 'El vencimiento es estimado (fecha base: ingreso del expediente). Verifique la fecha real de notificación.'
            : 'Verifique los actuados del expediente.');
        // Sanitizar PII (DNI, email, telefono, RUC) antes de INSERT
        const titulo = maskPII(anonimizarDatosSensibles(tituloRaw));
        const contenido = maskPII(anonimizarDatosSensibles(contenidoRaw));

        for (const usuario of targets) {
          const { rowCount } = await db.query(
            `INSERT INTO notificaciones_sinoe
               (usuario_id, organization_id, expediente_numero, tipo_notificacion,
                titulo, contenido, fecha_notificacion, leida, analisis_ia, urgencia, creado_en)
             SELECT $1, $2, $3, 'PLAZO_VENCIMIENTO', $4, $5, $6, FALSE, $7::jsonb, $8, NOW()
              WHERE NOT EXISTS (
                SELECT 1 FROM notificaciones_sinoe
                 WHERE organization_id = $2
                   AND usuario_id IS NOT DISTINCT FROM $1
                   AND expediente_numero = $3
                   AND tipo_notificacion = 'PLAZO_VENCIMIENTO'
                   AND fecha_notificacion = $6
              )`,
            [
              usuario.id,
              orgId,
              v.numero,
              titulo,
              contenido,
              // fecha_notificacion = fecha límite del vencimiento (clave de idempotencia)
              new Date(v.fecha_limite + 'T00:00:00Z'),
              JSON.stringify({
                evento: v.evento,
                evento_descripcion: v.evento_descripcion,
                fecha_limite: v.fecha_limite,
                dias_restantes: v.dias_restantes,
                base_legal: v.base_legal,
                estimado: v.estimado,
                expediente_id: v.expediente_id,
              }),
              urgenciaDb,
            ]
          );
          notificacionesInsertadas += rowCount;
        }
      }
    } catch (err) {
      errores.push({ orgId, error: err.message });
      cronLog('error', `Error en alertas de vencimientos para org ${orgId}`, { error: err.message });
    }
  }

  const duration = Date.now() - start;
  cronLog('info', 'Alertas de vencimientos completadas', {
    organizaciones_procesadas: porOrg.size,
    expedientes_activos: expedientes.length,
    notificaciones_insertadas: notificacionesInsertadas,
    alertas_criticas: alertasCriticas,
    alertas_altas: alertasAltas,
    errores: errores.length,
    duration,
  });

  // Audit event (por org + agregado para trazabilidad; se omite PII)
  try {
    await logAudit('PLAZO_VENCIMIENTO_ALERTAS', {
      severity: 'INFO',
      organizationId: null, // evento global del cron
      total_orgs: porOrg.size,
      total_expedientes: expedientes.length,
      insertadas: notificacionesInsertadas,
      criticas: alertasCriticas,
      altas: alertasAltas,
      errores: errores.length,
      duration,
    });
  } catch (auditErr) {
    cronLog('warn', 'No se pudo registrar audit event de vencimientos', { error: auditErr.message });
  }

  return {
    organizaciones: porOrg.size,
    expedientes: expedientes.length,
    insertadas: notificacionesInsertadas,
    criticas: alertasCriticas,
    altas: alertasAltas,
    errores,
    duration,
  };
}

// ── Inicializador de CRON con node-cron (fallback) ────────────────────────────

let cronJobsInitialized = false;

export async function initCronJobs() {
  if (cronJobsInitialized) {
    cronLog('warn', 'CRON jobs ya están inicializados — omitiendo');
    return;
  }

  // Verificar si node-cron está disponible (ESM-safe: import dinámico en vez de require)
  let cron;
  try {
    const cronModule = await import('node-cron');
    cron = cronModule.default || cronModule;
  } catch {
    cronLog('warn', 'node-cron no está instalado. Usa Railway CRON nativo o instala: npm install node-cron');
    cronLog('info', 'Disponible vía endpoint: POST /api/admin/update-catalogos');
    return;
  }

  // ── Job 1: Actualización de catálogos — 01:00 AM hora Perú (UTC-5) ──────
  // En UTC: 06:00 (invierno) / 05:00 (verano) → usamos 06:00 UTC fijo
  // Formato cron: minuto hora día-del-mes mes día-de-semana
  cron.schedule('0 6 * * *', async () => {
    cronLog('info', 'CRON disparado: actualización de catálogos (06:00 UTC = 01:00 Perú)');
    try {
      await ejecutarActualizacionCatalogos();
    } catch (err) {
      cronLog('error', 'CRON job falló', { error: err.message });
    }
  });

  // ── Job 2: Alertas proactivas de vencimientos — todos los días 06:30 UTC ─
  // (01:30 Perú). Corre después del job de catálogos para usar plazos frescos.
  cron.schedule('30 6 * * *', async () => {
    cronLog('info', 'CRON disparado: alertas de vencimientos (06:30 UTC = 01:30 Perú)');
    try {
      await ejecutarAlertasVencimientos();
    } catch (err) {
      cronLog('error', 'CRON de vencimientos falló', { error: err.message });
    }
  });

  // ── Job 3: Limpieza de logs — todos los domingos 03:00 AM Perú ─────────
  cron.schedule('0 8 * * 0', async () => {
    cronLog('info', 'CRON disparado: limpieza de logs');
    try {
      await ejecutarLimpiezaLogs();
    } catch (err) {
      cronLog('error', 'Limpieza de logs falló', { error: err.message });
    }
  });

  cronJobsInitialized = true;
  cronLog('info', 'CRON jobs inicializados correctamente');
  cronLog('info', '  - Catálogos:   01:00 AM hora Perú (06:00 UTC)');
  cronLog('info', '  - Vencimientos: 01:30 AM hora Perú (06:30 UTC) diario');
  cronLog('info', '  - Limpieza:    Domingos 03:00 AM hora Perú (08:00 UTC)');
  cronLog('info', '  - Endpoint:    POST /api/admin/update-catalogos');
}

// ── Ejecución directa (para debug/testing) ─────────────────────────────────────
// node server/cron-jobs.js
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  const command = process.argv[2] || 'catalogos';
  cronLog('info', `Ejecución directa: ${command}`);

  switch (command) {
    case 'catalogos':
      ejecutarActualizacionCatalogos()
        .then(r => {
          process.exit(r.ok ? 0 : 1);
        })
        .catch(() => process.exit(1));
      break;
    case 'alertas':
      ejecutarAlertasVencimientos()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
    case 'limpieza':
      ejecutarLimpiezaLogs().then(() => process.exit(0));
      break;
    default:
      cronLog('error', `Comando desconocido: ${command}. Usar: catalogos | alertas | limpieza`);
      process.exit(1);
  }
}
