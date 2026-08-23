// legalpro-app/server/services/reporteExpediente.js
// Generado por @backend-node
//
// Reporte consolidado del expediente para exportación JSON / PDF / DOCX
// (feature RICE @auditor-performance: el abogado entrega el caso a cliente/socio).
//
// Seguridad / multi-tenant:
//   - Todas las queries usan tenantQuery() (activa RLS via AsyncLocalStorage)
//     y filtran explícitamente por organization_id (defensa en profundidad).
//   - El endpoint expone PII (partes, hechos, historial IA): solo roles
//     OWNER/ADMIN/MEMBER (requireRole en la ruta) y se emite audit_log.
//   - No se loguea contenido PII (logger.js aplica masking; aquí no se loguea
//     el contenido del reporte).
//
// Performance (@auditor-performance):
//   - Queries independientes en Promise.all (5 consultas + organización).
//   - Historial IA con COUNT(*) OVER() en una sola query y LIMIT 20.
//   - Índices existentes usados: idx_documentos_expediente_id,
//     idx_evidencia_expediente_id, idx_mensajes_chat_org.
//   - Ver notas de índices recomendados en la respuesta final.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { tenantQuery } from '../db.js';
import { sumarDiasHabiles } from '../utils/feriados.js';
import { logAudit } from '../utils/audit.js';
import logger from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Mismo path que routes/plazos.js: server/services -> ../../../catalogs
const PLAZOS_PATH = join(__dirname, '../../../catalogs/plazos-procesales.json');

// ── Límites de payload (evitar reportes inflados) ────────────────────────────
const LIMITE_HISTORIAL = 20;          // últimas N consultas IA en el reporte
const MAX_LEN_CONTENIDO_MSG = 300;    // truncar contenido de cada mensaje
const MAX_LEN_TEXTO_LARGO = 2000;     // truncar hechos / teoria_caso en JSON

let plazosCatalog = null;

function loadPlazosCatalog() {
  if (!plazosCatalog) {
    plazosCatalog = JSON.parse(readFileSync(PLAZOS_PATH, 'utf-8')).plazos;
  }
  return plazosCatalog;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function truncar(texto, max) {
  if (typeof texto !== 'string') return texto ?? null;
  if (texto.length <= max) return texto;
  return `${texto.slice(0, max)}…`;
}

function aFechaStr(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function diasEntre(fechaA, fechaB) {
  const a = new Date(fechaA + 'T00:00:00');
  const b = new Date(fechaB + 'T00:00:00');
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// Reemplaza caracteres HTML que podrían interpretarse en la plantilla PDF/DOCX
// por equivalentes de texto plano (el mismo string se usa en ambos formatos).
function seguro(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, 'y')
    .replace(/</g, '')
    .replace(/>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrae el/los recurrente(s) legibles desde el JSONB `partes` del expediente.
 * La estructura real es libre (JSONB); se lee de forma defensiva.
 */
export function obtenerRecurrente(partes) {
  if (!partes) return '';
  if (typeof partes === 'string') return truncar(seguro(partes), 120);

  const get = (v) => {
    if (!v) return null;
    if (typeof v === 'string') return v;
    if (typeof v === 'object') return v.nombre || v.nombre_completo || v.razon_social || v.demandante || JSON.stringify(v);
    return String(v);
  };

  const demandante = get(partes.demandante) ?? get(partes.actor) ??
    (Array.isArray(partes.demandantes) ? partes.demandantes.map(get).filter(Boolean).join(', ') : null);
  const demandado = get(partes.demandado) ??
    (Array.isArray(partes.demandados) ? partes.demandados.map(get).filter(Boolean).join(', ') : null);

  const partesTexto = [demandante, demandado].filter(Boolean).join(' vs ');
  return truncar(seguro(partesTexto), 120);
}

// ── Plazos relevantes (CPC / NCPP vía catálogo + feriados.js) ────────────────

function calcularPlazos(expediente, notificaciones) {
  const materia = expediente.materia || expediente.tipo || 'civil';

  // Fecha base: la más reciente entre creación del expediente y la última
  // notificación SINOE (si existe), que es cuando empieza a correr el plazo.
  const fechas = [expediente.created_at];
  if (Array.isArray(notificaciones)) {
    for (const n of notificaciones) {
      if (n.fecha_notificacion) fechas.push(n.fecha_notificacion);
    }
  }
  const base = new Date(Math.max(...fechas.map((f) => new Date(f).getTime())));
  const fechaInicio = aFechaStr(base);
  if (!fechaInicio) return [];

  const hoy = aFechaStr(new Date());

  return loadPlazosCatalog()
    .filter((p) => p.materia === materia && Number.isInteger(p.dias))
    .slice(0, 8) // top plazos por materia para no inflar el reporte
    .map((p) => {
      const fechaVencimiento = sumarDiasHabiles(fechaInicio, p.dias);
      const diasRestantes = diasEntre(hoy, fechaVencimiento);
      return {
        id: p.id,
        codigo: p.codigo,
        articulo: p.articulo,
        acto: p.acto,
        diasHabiles: p.dias,
        fechaInicio,
        fechaVencimiento,
        diasRestantes,
        vencido: fechaVencimiento < hoy,
      };
    });
}

// ── Construcción del reporte ─────────────────────────────────────────────────

/**
 * Recopila la información consolidada del expediente (multi-tenant).
 *
 * @param {object} opts
 * @param {string} opts.expedienteId — UUID del expediente
 * @param {string} opts.orgId       — organization_id del JWT
 * @param {string} [opts.userId]    — sub del JWT (para audit)
 * @param {string} [opts.ip]        — IP del cliente (para audit)
 * @param {string} [opts.formato]   — 'json' | 'pdf' | 'docx' (para audit)
 * @returns {Promise<object|null>} Reporte estructurado o null si no existe.
 */
export async function construirReporte({ expedienteId, orgId, userId, ip, formato = 'json' }) {
  // NOTA: `notificaciones_sinoe` NO tiene FK expediente_id; se vincula por
  // `expediente_numero` (TEXT) y depende del numero del expediente, por lo que
  // se consulta en un segundo paso (tras conocer expediente.numero).
  const [
    expResult,
    docsResult,
    evidenciaResult,
    chatResult,
    orgResult,
  ] = await Promise.all([
    // Expediente — columnas explícitas (omitimos metadata_sensibilidad pesada;
    // conservamos el flag LPDP es_dato_sensible para el abogado).
    tenantQuery(
      `SELECT id, numero, numero_expediente, titulo, tipo, materia, estado,
              juzgado, partes, hechos, teoria_caso, tipo_proceso,
              es_urgente, es_dato_sensible, created_at, updated_at
         FROM expedientes
        WHERE id = $1 AND organization_id = $2
        LIMIT 1`,
      [expedienteId, orgId]
    ),
    // Documentos asociados (nombre, tipo, hash SHA-256, tamaño)
    tenantQuery(
      `SELECT id, nombre, tipo_documento, descripcion, archivo_nombre,
              archivo_tipo, archivo_tamano, hash_sha256, fecha_documento, creado_en
         FROM documentos
        WHERE expediente_id = $1 AND organization_id = $2
        ORDER BY creado_en DESC`,
      [expedienteId, orgId]
    ),
    // Evidencia digital (hash + cadena de custodia — bóveda, Ley 27269)
    tenantQuery(
      `SELECT id, nombre_original, tipo_archivo, tamano_bytes, hash_sha256,
              storage_path, descripcion, etiqueta, cadena_custodia, creado_en
         FROM evidencia_digital
        WHERE expediente_id = $1 AND organization_id = $2
        ORDER BY creado_en DESC`,
      [expedienteId, orgId]
    ),
    // Notificaciones SINOE — se consultan en un segundo paso (depende de
    // expediente.numero): ver NOTA al inicio de construirReporte.
    // Historial IA del chat — últimas N + total en una sola query (COUNT OVER)
    tenantQuery(
      `SELECT id, rol, contenido, created_at,
              COUNT(*) OVER () AS total
         FROM mensajes_chat
        WHERE expediente_id = $1 AND organization_id = $2
        ORDER BY created_at DESC
        LIMIT $3`,
      [expedienteId, orgId, LIMITE_HISTORIAL]
    ),
    // Organización para el membrete del documento (nombre/plan)
    tenantQuery(
      `SELECT nombre, plan, slug
         FROM organizaciones
        WHERE id = $1
        LIMIT 1`,
      [orgId]
    ),
  ]);

  const expediente = expResult.rows[0];
  if (!expediente) {
    return null;
  }

  // Notificaciones: la tabla no tiene FK expediente_id; se vincula por
  // `expediente_numero` contra numero / numero_expediente del caso.
  const notifParams = [orgId, expediente.numero, expediente.numero_expediente];
  const { rows: notificaciones } = await tenantQuery(
    `SELECT id, tipo_notificacion, titulo, contenido, fecha_notificacion,
            leida, urgencia, analisis_ia, creado_en
       FROM notificaciones_sinoe
      WHERE organization_id = $1
        AND (expediente_numero = $2 OR expediente_numero = $3)
      ORDER BY fecha_notificacion DESC`,
    notifParams
  );

  const chatRows = chatResult.rows;
  const totalChat = chatRows.length > 0 ? parseInt(chatRows[0].total, 10) : 0;

  const reporte = {
    expediente: {
      id: expediente.id,
      numero: expediente.numero,
      numero_expediente: expediente.numero_expediente,
      titulo: expediente.titulo,
      tipo: expediente.tipo,
      materia: expediente.materia,
      estado: expediente.estado,
      juzgado: expediente.juzgado,
      tipo_proceso: expediente.tipo_proceso,
      partes: expediente.partes,
      hechos: truncar(expediente.hechos, MAX_LEN_TEXTO_LARGO),
      teoria_caso: truncar(expediente.teoria_caso, MAX_LEN_TEXTO_LARGO),
      es_urgente: expediente.es_urgente,
      es_dato_sensible: expediente.es_dato_sensible,
      creado_en: expediente.created_at,
      actualizado_en: expediente.updated_at,
    },
    documentos: docsResult.rows.map((d) => ({
      id: d.id,
      nombre: d.nombre,
      tipo_documento: d.tipo_documento,
      descripcion: truncar(d.descripcion, 300),
      archivo_nombre: d.archivo_nombre,
      archivo_tipo: d.archivo_tipo,
      archivo_tamano: d.archivo_tamano,
      hash_sha256: d.hash_sha256,
      fecha_documento: d.fecha_documento,
      creado_en: d.creado_en,
    })),
    evidencia: evidenciaResult.rows.map((e) => ({
      id: e.id,
      nombre_original: e.nombre_original,
      tipo_archivo: e.tipo_archivo,
      tamano_bytes: e.tamano_bytes,
      hash_sha256: e.hash_sha256,
      storage_path: e.storage_path,
      descripcion: truncar(e.descripcion, 300),
      etiqueta: e.etiqueta,
      cadena_custodia: e.cadena_custodia,
      creado_en: e.creado_en,
    })),
    notificaciones: notificaciones.map((n) => ({
      id: n.id,
      tipo_notificacion: n.tipo_notificacion,
      titulo: n.titulo,
      contenido: truncar(n.contenido, 300),
      fecha_notificacion: n.fecha_notificacion,
      leida: n.leida,
      urgencia: n.urgencia,
      analisis_ia: n.analisis_ia,
      creado_en: n.creado_en,
    })),
    historialIA: {
      total: totalChat,
      ultimasConsultas: chatRows.map((m) => ({
        id: m.id,
        rol: m.rol,
        contenido: truncar(m.contenido, MAX_LEN_CONTENIDO_MSG),
        created_at: m.created_at,
      })),
    },
    plazos: calcularPlazos(expediente, notificaciones),
    membrete: {
      organizacion: orgResult.rows[0]?.nombre ?? null,
      plan: orgResult.rows[0]?.plan ?? null,
    },
    generadoEn: new Date().toISOString(),
  };

  // Audit (LPDP/OWASP A09): acceso a PII del expediente (fire-and-forget).
  logAudit('REPORTE_EXPEDIENTE_GENERADO', {
    severity: 'INFO',
    userId,
    organizationId: orgId,
    ip,
    expedienteId,
    formato,
    piiAccess: Boolean(expediente.es_dato_sensible),
  }).catch((err) => logger.debug('reporte_audit_fallback', { error: err.message }));

  return reporte;
}

// ── Contenido texto plano para PDF / DOCX ────────────────────────────────────

/**
 * Convierte el reporte en texto plano estructurado (secciones separadas por \n)
 * apto para generarPdf() / generarDocx(). Sin caracteres HTML peligrosos.
 */
export function construirContenidoTexto(reporte) {
  const e = reporte.expediente;
  const lineas = [];

  lineas.push('REPORTE CONSOLIDADO DEL EXPEDIENTE');
  lineas.push('='.repeat(60));
  lineas.push(`Número de expediente: ${seguro(e.numero_expediente || e.numero)}`);
  lineas.push(`Título: ${seguro(e.titulo)}`);
  lineas.push(`Tipo / Materia: ${seguro(e.tipo)} / ${seguro(e.materia || 'No especificada')}`);
  lineas.push(`Estado: ${seguro(e.estado)}`);
  lineas.push(`Juzgado: ${seguro(e.juzgado || 'No registrado')}`);
  lineas.push(`Tipo de proceso: ${seguro(e.tipo_proceso || 'No registrado')}`);
  lineas.push(`Urgente: ${e.es_urgente ? 'SÍ' : 'No'}`);
  lineas.push(`Contiene datos sensibles (LPDP): ${e.es_dato_sensible ? 'SÍ' : 'No'}`);
  lineas.push(`Fecha de creación: ${seguro(e.creado_en ? aFechaStr(e.creado_en) : '-')}`);
  lineas.push('');

  lineas.push('PARTES PROCESALES');
  lineas.push('-'.repeat(60));
  const recurrente = obtenerRecurrente(e.partes);
  lineas.push(recurrente || 'Sin partes registradas');
  lineas.push('');

  if (e.hechos) {
    lineas.push('HECHOS');
    lineas.push('-'.repeat(60));
    lineas.push(seguro(e.hechos));
    lineas.push('');
  }
  if (e.teoria_caso) {
    lineas.push('TEORÍA DEL CASO');
    lineas.push('-'.repeat(60));
    lineas.push(seguro(e.teoria_caso));
    lineas.push('');
  }

  lineas.push('DOCUMENTOS ASOCIADOS');
  lineas.push('-'.repeat(60));
  if (reporte.documentos.length === 0) {
    lineas.push('Sin documentos registrados.');
  } else {
    for (const d of reporte.documentos) {
      lineas.push(`- ${seguro(d.nombre)} (${seguro(d.tipo_documento)})`);
      if (d.hash_sha256) lineas.push(`  SHA-256: ${d.hash_sha256}`);
    }
  }
  lineas.push('');

  lineas.push('EVIDENCIA DIGITAL (Bóveda — Ley 27269)');
  lineas.push('-'.repeat(60));
  if (reporte.evidencia.length === 0) {
    lineas.push('Sin evidencia digital registrada.');
  } else {
    for (const ev of reporte.evidencia) {
      lineas.push(`- ${seguro(ev.nombre_original)} (${seguro(ev.tipo_archivo)})`);
      lineas.push(`  SHA-256: ${ev.hash_sha256}`);
      const custodios = Array.isArray(ev.cadena_custodia) ? ev.cadena_custodia.length : 0;
      lineas.push(`  Registros de custodia: ${custodios}`);
    }
  }
  lineas.push('');

  lineas.push('NOTIFICACIONES SINOE');
  lineas.push('-'.repeat(60));
  if (reporte.notificaciones.length === 0) {
    lineas.push('Sin notificaciones registradas.');
  } else {
    for (const n of reporte.notificaciones) {
      lineas.push(`- [${seguro(n.fecha_notificacion ? aFechaStr(n.fecha_notificacion) : '-')}] ${seguro(n.titulo)} (${seguro(n.tipo_notificacion)}, urgencia: ${seguro(n.urgencia)})`);
    }
  }
  lineas.push('');

  lineas.push('HISTORIAL IA (Chat)');
  lineas.push('-'.repeat(60));
  lineas.push(`Total de consultas: ${reporte.historialIA.total}`);
  if (reporte.historialIA.ultimasConsultas.length === 0) {
    lineas.push('Sin consultas IA registradas.');
  } else {
    for (const m of reporte.historialIA.ultimasConsultas.slice(0, 5)) {
      const quien = m.rol === 'user' ? 'Usuario' : m.rol === 'assistant' ? 'IA' : 'Sistema';
      lineas.push(`- [${quien}] ${seguro(m.contenido)}`);
    }
  }
  lineas.push('');

  lineas.push('PLAZOS PROCESALES RELEVANTES');
  lineas.push('-'.repeat(60));
  if (reporte.plazos.length === 0) {
    lineas.push('Sin plazos aplicables calculados para esta materia.');
  } else {
    for (const p of reporte.plazos) {
      lineas.push(`- ${seguro(p.acto)} (${p.codigo} art. ${p.articulo}): vence ${p.fechaVencimiento} (${p.diasRestantes} días) ${p.vencido ? '[VENCIDO]' : ''}`);
    }
  }
  lineas.push('');
  lineas.push(`Reporte generado el ${seguro(reporte.generadoEn)} por LegalPro IA.`);

  return lineas.join('\n');
}

/**
 * Construye los parámetros que consume generarPdf()/generarDocx() y
 * generarNombreArchivo() (membrete del abogado/organización).
 */
export function construirParamsDocumento(reporte, { abogado, colegiatura } = {}) {
  const e = reporte.expediente;
  return {
    tipo: 'resumen',
    juzgado: seguro(e.juzgado) || 'Estudio Jurídico',
    numeroExpediente: seguro(e.numero_expediente || e.numero) || 'S/N',
    sumilla: `Reporte consolidado del expediente ${seguro(e.numero_expediente || e.numero)} — ${seguro(e.titulo)}`,
    contenido: construirContenidoTexto(reporte),
    recurrente: obtenerRecurrente(e.partes) || seguro(e.titulo),
    abogado: seguro(abogado) || 'Abogado patrocinante',
    colegiatura: seguro(colegiatura) || '',
    organizacion: seguro(reporte.membrete?.organizacion) || 'ESTUDIO JURÍDICO',
  };
}

export default {
  construirReporte,
  construirContenidoTexto,
  construirParamsDocumento,
  obtenerRecurrente,
};
