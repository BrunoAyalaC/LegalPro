/**
 * reset-production.mjs — Destruye datos de prueba y reconstruye entorno demo realista.
 * Autorizado: solo datos de prueba, sin usuarios reales.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." node tools/seed/reset-production.mjs
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no definida. Ejecuta con DATABASE_URL="postgresql://..." (valor real en Railway).');
  process.exit(1);
}
const PASSWORD = process.env.DEMO_PASSWORD || 'Demo2024!';

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const ORG2_ID = '00000000-0000-0000-0000-000000000002';

const USERS = [
  { id: '00000000-0000-0000-0000-000000000010', email: 'admin@legalpro.pe',    nombre: 'Administrador LegalPro',     rol: 'ABOGADO',  esp: 'GENERAL',        miembro: 'OWNER',  org: ORG_ID },
  { id: '00000000-0000-0000-0000-000000000011', email: 'abogado@legalpro.pe',  nombre: 'Dr. Juan García Pérez',     rol: 'ABOGADO',  esp: 'CIVIL',          miembro: 'MEMBER', org: ORG_ID },
  { id: '00000000-0000-0000-0000-000000000012', email: 'fiscal@legalpro.pe',   nombre: 'Dra. María López Vargas',   rol: 'FISCAL',   esp: 'PENAL',          miembro: 'MEMBER', org: ORG_ID },
  { id: '00000000-0000-0000-0000-000000000013', email: 'juez@legalpro.pe',     nombre: 'Dr. Carlos Mendoza Silva',  rol: 'JUEZ',     esp: 'CONSTITUCIONAL', miembro: 'MEMBER', org: ORG_ID },
  { id: '00000000-0000-0000-0000-000000000014', email: 'contador@legalpro.pe', nombre: 'CPC. Ana Torres Ríos',      rol: 'CONTADOR', esp: 'TRIBUTARIO',     miembro: 'MEMBER', org: ORG_ID },
  { id: '00000000-0000-0000-0000-000000000015', email: 'demo@legalpro.pe',     nombre: 'Usuario Demo LegalPro',     rol: 'ABOGADO',  esp: 'GENERAL',        miembro: 'MEMBER', org: ORG_ID },
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

const TRUNCATE_TABLES = [
  'eventos_simulacion', 'mensajes_chat', 'documentos', 'expedientes', 'simulaciones',
  'notificaciones_sinoe', 'consentimientos', 'refresh_tokens', 'transacciones_creditos',
  'consumo_tokens_ia', 'invitaciones_organizacion', 'evidencia_accesos', 'evidencia_digital',
  'predicciones_judiciales', 'estrategias_interrogatorio', 'audit_log', 'audit_logs',
  'suscripciones', 'miembros_organizacion', 'usuarios', 'organizaciones',
];

const c = new Client({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('rlwy.net') ? { rejectUnauthorized: false } : false,
});

async function ensureSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS outbox_messages (
      id uuid PRIMARY KEY,
      type varchar(255) NOT NULL,
      content text NOT NULL,
      occurred_on_utc timestamptz NOT NULL,
      processed_on_utc timestamptz,
      error text,
      retry_count integer NOT NULL DEFAULT 0
    )`);
  await client.query(`
    CREATE INDEX IF NOT EXISTS ix_outbox_messages_processed_on_utc ON outbox_messages (processed_on_utc)`);

  // Historial EF Core (tabla snake_case usada por DependencyInjection)
  const efMigrations = [
    '20260305222244_InitialCreate',
    '20260312184741_UpdateSchema',
    '20260316191058_AddMensajeChatRefreshToken',
    '20260319011004_SnakeCaseColumns',
    '20260413033854_PendingModelChanges',
    '20260521213343_UnifyDatabaseModel',
    '20260522004427_AddOutboxMessagesTable',
  ];
  await client.query(`
    CREATE TABLE IF NOT EXISTS __ef_migrations_history (
      migration_id character varying(150) NOT NULL PRIMARY KEY,
      product_version character varying(32) NOT NULL
    )`);
  for (const m of efMigrations) {
    await client.query(
      `INSERT INTO __ef_migrations_history (migration_id, product_version) VALUES ($1, '9.0.1') ON CONFLICT DO NOTHING`,
      [m],
    );
  }
}

async function main() {
  console.log('=== RESET PRODUCCION (solo datos demo) ===');
  await c.connect();
  await c.query('BEGIN');
  try {
    console.log('1. Truncando tablas de datos...');
    await c.query(`TRUNCATE TABLE ${TRUNCATE_TABLES.join(', ')} RESTART IDENTITY CASCADE`);

    console.log('2. Asegurando schema (outbox)...');
    await ensureSchema(c);

    const hash = await bcrypt.hash(PASSWORD, 12);

    console.log('3. Organizaciones demo...');
    await c.query(
      `INSERT INTO organizaciones (id, nombre, slug, plan, max_usuarios, max_expedientes, activo, storage_gb_limit, creditos_disponibles, plan_suscripcion, config, metadata, created_at)
       VALUES ($1,'Estudio Jurídico Demo','estudio-demo','enterprise',50,500,TRUE,50,5000,'premium','{}','{}',NOW())
       ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, slug=EXCLUDED.slug, activo=TRUE, plan=EXCLUDED.plan`,
      [ORG_ID]);
    await c.query(
      `INSERT INTO organizaciones (id, nombre, slug, plan, max_usuarios, max_expedientes, activo, storage_gb_limit, creditos_disponibles, plan_suscripcion, config, metadata, created_at)
       VALUES ($1,'Estudio Rival SAC','estudio-rival','free',5,50,TRUE,5,100,'free','{}','{}',NOW())
       ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, activo=TRUE`,
      [ORG2_ID]);

    console.log('4. Usuarios + membresías + consentimientos...');
    for (const u of USERS) {
      await c.query(
        `INSERT INTO usuarios (id, email, nombre_completo, password_hash, rol, especialidad, esta_activo,
            organization_id, organizacion_id, terminos_aceptados_en, terminos_version, privacidad_aceptada_en, privacidad_version,
            acepta_transferencia_internacional, consentimiento_transferencia_internacional, transferencia_internacional_aceptada_en, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7,$7, NOW(),'1.0', NOW(),'1.0', TRUE, TRUE, NOW(), NOW())
         ON CONFLICT (email) DO UPDATE SET
            id=EXCLUDED.id, password_hash=EXCLUDED.password_hash, rol=EXCLUDED.rol, especialidad=EXCLUDED.especialidad,
            esta_activo=TRUE, organization_id=EXCLUDED.organization_id, organizacion_id=EXCLUDED.organizacion_id,
            terminos_aceptados_en=NOW(), privacidad_aceptada_en=NOW(),
            acepta_transferencia_internacional=TRUE, consentimiento_transferencia_internacional=TRUE,
            transferencia_internacional_aceptada_en=NOW()`,
        [u.id, u.email, u.nombre, hash, u.rol, u.esp, u.org]);

      await c.query(
        `INSERT INTO miembros_organizacion (organizacion_id, usuario_id, rol, activo, created_at)
         VALUES ($1,$2,$3,TRUE,NOW())
         ON CONFLICT (organizacion_id, usuario_id) DO UPDATE SET rol=EXCLUDED.rol, activo=TRUE`,
        [u.org, u.id, u.miembro]);

      for (const tipo of ['terminos', 'privacidad', 'marketing', 'transferencia_internacional']) {
        await c.query(
          `INSERT INTO consentimientos (usuario_id, tipo, version, aceptado, acepta_transferencia_internacional, created_at)
           SELECT $1,$2,'1.0',TRUE,TRUE,NOW()
           WHERE NOT EXISTS (SELECT 1 FROM consentimientos WHERE usuario_id=$1 AND tipo=$2)`,
          [u.id, tipo]);
      }
    }

    console.log('5. Expedientes + documentos + chat + notificaciones...');
    const abogadoId = '00000000-0000-0000-0000-000000000011';
    const expIds = [];
    for (const e of EXPEDIENTES) {
      const r = await c.query(
        `INSERT INTO expedientes (usuario_id, organization_id, numero, titulo, tipo, estado, juzgado, materia, hechos, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()) RETURNING id`,
        [abogadoId, ORG_ID, e.num, e.tit, e.tipo, e.estado, e.juz, e.materia,
         `Hechos del caso ${e.num}. Partes en disputa sobre cumplimiento de obligaciones legales.`]);
      expIds.push(r.rows[0].id);
    }

    for (let i = 0; i < 3; i++) {
      for (const d of [{ n: 'Demanda inicial.pdf', t: 'demanda' }, { n: 'Anexo pruebas.pdf', t: 'prueba' }]) {
        await c.query(
          `INSERT INTO documentos (expediente_id, usuario_id, organization_id, nombre, tipo_documento, descripcion, archivo_nombre, archivo_tipo, archivo_tamano, creado_en)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'application/pdf',102400,NOW())`,
          [expIds[i], abogadoId, ORG_ID, d.n, d.t, `Documento ${d.t}`, d.n]);
      }
    }

    await c.query(
      `INSERT INTO mensajes_chat (usuario_id, organization_id, expediente_id, contenido, rol, created_at)
       VALUES ($1,$2,$3,'¿Cuál es el plazo para contestar la demanda?','user',NOW()),
              ($1,$2,$3,'El plazo es de 30 días hábiles (Art. 478 CPC).','assistant',NOW())`,
      [abogadoId, ORG_ID, expIds[0]]);

    await c.query(
      `INSERT INTO notificaciones_sinoe (usuario_id, organization_id, expediente_numero, tipo_notificacion, titulo, contenido, fecha_notificacion, urgencia, creado_en)
       VALUES ($1,$2,'EXP-2026-0001','RESOLUCION','Admite demanda','Se admite a trámite.', NOW(), 'alta', NOW()),
              ($1,$2,'EXP-2026-0003','CITACION','Citación audiencia','Audiencia programada.', NOW() + interval '5 days', 'media', NOW())`,
      [abogadoId, ORG_ID]);

    await c.query(
      `INSERT INTO simulaciones (usuario_id, organization_id, rama_derecho, rol_usuario, materia, estado, created_at)
       VALUES ($1,$2,'CIVIL','ABOGADO','Obligaciones','en_progreso',NOW())`,
      [abogadoId, ORG_ID]);

    await c.query('COMMIT');

    const counts = {};
    for (const t of ['organizaciones', 'usuarios', 'miembros_organizacion', 'expedientes', 'documentos', 'mensajes_chat', 'notificaciones_sinoe', 'simulaciones', 'consentimientos']) {
      counts[t] = (await c.query(`SELECT COUNT(*)::int n FROM ${t}`)).rows[0].n;
    }
    console.log('\n✅ RESET + SEED OK');
    console.log('Password demo:', PASSWORD);
    console.log('Conteos:', JSON.stringify(counts, null, 2));
    console.log('\nUsuarios E2E:');
    USERS.forEach(u => console.log(`  - ${u.email} (${u.rol})`));
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('❌ ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}

main();
