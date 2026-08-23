/**
 * seed-demo.mjs — Datos semilla realistas para entorno de pruebas tipo producción.
 *
 * Ejecutar DENTRO del contenedor node-api (tiene pg + bcryptjs):
 *   docker cp tools/seed/seed-demo.mjs legalpro-node-api:/tmp/seed-demo.mjs
 *   docker compose exec node-api node /tmp/seed-demo.mjs
 *
 * Idempotente: usa UPSERT (ON CONFLICT). Password de todos los usuarios demo: Demo2024!
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://legalpro:legalpro_dev@postgres:5432/legalpro';
const PASSWORD = 'Demo2024!';

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const ORG2_ID = '00000000-0000-0000-0000-000000000002';

const USERS = [
  { id: '00000000-0000-0000-0000-000000000010', email: 'admin@legalpro.pe',    nombre: 'Administrador LegalPro',     rol: 'ADMIN',    esp: 'GENERAL',        miembro: 'OWNER',  org: ORG_ID },
  { id: '00000000-0000-0000-0000-000000000011', email: 'abogado@legalpro.pe',  nombre: 'Dr. Juan García Pérez',     rol: 'ABOGADO',  esp: 'CIVIL',          miembro: 'MEMBER', org: ORG_ID },
  { id: '00000000-0000-0000-0000-000000000012', email: 'fiscal@legalpro.pe',   nombre: 'Dra. María López Vargas',   rol: 'FISCAL',   esp: 'PENAL',          miembro: 'MEMBER', org: ORG_ID },
  { id: '00000000-0000-0000-0000-000000000013', email: 'juez@legalpro.pe',     nombre: 'Dr. Carlos Mendoza Silva',  rol: 'JUEZ',     esp: 'CONSTITUCIONAL', miembro: 'MEMBER', org: ORG_ID },
  { id: '00000000-0000-0000-0000-000000000014', email: 'contador@legalpro.pe', nombre: 'CPC. Ana Torres Ríos',      rol: 'CONTADOR', esp: 'TRIBUTARIO',     miembro: 'MEMBER', org: ORG_ID },
  { id: '00000000-0000-0000-0000-000000000020', email: 'rival@otroestudio.pe', nombre: 'Dr. Rival Externo',         rol: 'ABOGADO',  esp: 'CIVIL',          miembro: 'OWNER',  org: ORG2_ID },
];

const EXPEDIENTES = [
  { num: 'EXP-2026-0001', tit: 'Demanda de obligación de dar suma de dinero', tipo: 'civil',          estado: 'activo',     materia: 'Obligaciones',     juz: '1er Juzgado Civil de Lima' },
  { num: 'EXP-2026-0002', tit: 'Proceso de alimentos a favor de menor',       tipo: 'familia',        estado: 'activo',     materia: 'Alimentos',        juz: 'Juzgado de Familia de Lima' },
  { num: 'EXP-2026-0003', tit: 'Querella por difamación agravada',            tipo: 'penal',          estado: 'activo',     materia: 'Delitos contra el honor', juz: '3er Juzgado Penal' },
  { num: 'EXP-2026-0004', tit: 'Despido arbitrario - reposición laboral',     tipo: 'laboral',        estado: 'suspendido', materia: 'Despido',          juz: '2do Juzgado Laboral' },
  { num: 'EXP-2026-0005', tit: 'Acción de amparo contra resolución',          tipo: 'constitucional', estado: 'activo',     materia: 'Amparo',           juz: 'Sala Constitucional' },
  { num: 'EXP-2026-0006', tit: 'Proceso contencioso administrativo SUNAT',    tipo: 'administrativo', estado: 'archivado',  materia: 'Tributario',       juz: 'Juzgado Contencioso' },
];

const c = new Client({ connectionString: DATABASE_URL, ssl: DATABASE_URL.includes('rlwy.net') ? { rejectUnauthorized: false } : false });

async function main() {
  await c.connect();
  await c.query('BEGIN');
  try {
    const hash = await bcrypt.hash(PASSWORD, 12);

    // Organizaciones
    await c.query(
      `INSERT INTO organizaciones (id, nombre, slug, plan, max_usuarios, max_expedientes, activo)
       VALUES ($1,'Estudio Jurídico Demo','estudio-demo','pro',15,200,TRUE)
       ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, activo=TRUE`, [ORG_ID]);
    await c.query(
      `INSERT INTO organizaciones (id, nombre, slug, plan, max_usuarios, max_expedientes, activo)
       VALUES ($1,'Estudio Rival SAC','estudio-rival','free',5,50,TRUE)
       ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, activo=TRUE`, [ORG2_ID]);

    // Usuarios + membresías + consentimientos
    for (const u of USERS) {
      await c.query(
        `INSERT INTO usuarios (id,email,nombre_completo,password_hash,rol,especialidad,esta_activo,organization_id,
            terminos_aceptados_en,terminos_version,privacidad_aceptada_en,privacidad_version)
         VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7, now(),'1.0', now(),'1.0')
         ON CONFLICT (email) DO UPDATE SET
            password_hash=EXCLUDED.password_hash, rol=EXCLUDED.rol, especialidad=EXCLUDED.especialidad,
            esta_activo=TRUE, organization_id=EXCLUDED.organization_id,
            terminos_aceptados_en=now(), privacidad_aceptada_en=now()`,
        [u.id, u.email, u.nombre, hash, u.rol, u.esp, u.org]);

      await c.query(
        `INSERT INTO miembros_organizacion (organizacion_id, usuario_id, rol, activo)
         VALUES ($1,$2,$3,TRUE)
         ON CONFLICT (organizacion_id, usuario_id) DO UPDATE SET rol=EXCLUDED.rol, activo=TRUE`,
        [u.org, u.id, u.miembro]);

      for (const tipo of ['terminos', 'privacidad']) {
        await c.query(
          `INSERT INTO consentimientos (usuario_id, tipo, version, aceptado)
           VALUES ($1,$2,'1.0',TRUE) ON CONFLICT DO NOTHING`, [u.id, tipo]);
      }
    }

    // Expedientes (de la org demo, propietario abogado)
    const abogadoId = '00000000-0000-0000-0000-000000000011';
    const expIds = [];
    for (const e of EXPEDIENTES) {
      const r = await c.query(
        `INSERT INTO expedientes (usuario_id, organization_id, numero, titulo, tipo, estado, juzgado, materia, hechos)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (numero) DO UPDATE SET titulo=EXCLUDED.titulo, estado=EXCLUDED.estado
         RETURNING id`,
        [abogadoId, ORG_ID, e.num, e.tit, e.tipo, e.estado, e.juz, e.materia,
         `Hechos relevantes del caso ${e.num}. Las partes discrepan sobre el cumplimiento de obligaciones.`]);
      expIds.push(r.rows[0].id);
    }

    // Documentos (2 por los primeros 3 expedientes)
    for (let i = 0; i < 3; i++) {
      for (const d of [{ n: 'Demanda inicial.pdf', t: 'demanda' }, { n: 'Anexo de pruebas.pdf', t: 'prueba' }]) {
        await c.query(
          `INSERT INTO documentos (expediente_id, usuario_id, organization_id, nombre, tipo_documento, descripcion, archivo_nombre, archivo_tipo, archivo_tamano)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'application/pdf',102400) ON CONFLICT DO NOTHING`,
          [expIds[i], abogadoId, ORG_ID, d.n, d.t, `Documento ${d.t} del expediente`, d.n]);
      }
    }

    // Mensajes de chat IA (en el primer expediente)
    await c.query(
      `INSERT INTO mensajes_chat (usuario_id, organization_id, expediente_id, contenido, rol)
       VALUES ($1,$2,$3,'¿Cuál es el plazo para contestar la demanda?','user'),
              ($1,$2,$3,'El plazo para contestar una demanda en proceso de conocimiento es de 30 días hábiles (Art. 478 CPC).','assistant')
       ON CONFLICT DO NOTHING`,
      [abogadoId, ORG_ID, expIds[0]]);

    // Notificaciones SINOE
    await c.query(
      `INSERT INTO notificaciones_sinoe (usuario_id, organization_id, expediente_numero, tipo_notificacion, titulo, contenido, fecha_notificacion, urgencia)
       VALUES ($1,$2,'EXP-2026-0001','RESOLUCION','Resolución N° 5 - Admite demanda','Se admite a trámite la demanda.', now(), 'alta'),
              ($1,$2,'EXP-2026-0003','CITACION','Citación a audiencia','Audiencia única programada.', now() + interval '5 days', 'media')
       ON CONFLICT DO NOTHING`,
      [abogadoId, ORG_ID]);

    // Simulación de juicio
    await c.query(
      `INSERT INTO simulaciones (usuario_id, organization_id, rama_derecho, rol_usuario, materia, estado)
       VALUES ($1,$2,'CIVIL','ABOGADO','Obligaciones','en_progreso') ON CONFLICT DO NOTHING`,
      [abogadoId, ORG_ID]);

    await c.query('COMMIT');

    const counts = {};
    for (const t of ['organizaciones', 'usuarios', 'miembros_organizacion', 'expedientes', 'documentos', 'mensajes_chat', 'notificaciones_sinoe', 'simulaciones', 'consentimientos']) {
      counts[t] = (await c.query(`SELECT COUNT(*)::int n FROM ${t}`)).rows[0].n;
    }
    console.log('SEED OK. Password de todos los usuarios demo: Demo2024!');
    console.log('Conteos:', JSON.stringify(counts, null, 2));
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('SEED ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}
main();
