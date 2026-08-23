/**
 * seed-prod.mjs — Crea/actualiza usuarios de producción para tests E2E
 * ─────────────────────────────────────────────────────────────────────────────
 * Uso:  node seed-prod.mjs
 * Requiere: DATABASE_URL en entorno (Railway la provee automáticamente)
 *           o en .env para ejecución local contra Railway DB
 *
 * Idempotente:  SI (ON CONFLICT DO UPDATE)
 * Multi-tenant: SI (organización compartida con init.sql)
 * Seguro:       bcrypt hash, sin PII en logs
 * ─────────────────────────────────────────────────────────────────────────────
 */
import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

// Organización compartida — misma UUID que init.sql
const ORG_ID = '00000000-0000-0000-0000-000000000001';

// =============================================================================
// USUARIOS PARA E2E — coinciden exactamente con produccion.spec.js
// =============================================================================
const USERS = [
  { email: 'admin@legalpro.pe',    password: 'LegalPro2026!', rol: 'ABOGADO',  nombre: 'Admin LegalPro' },
  { email: 'fiscal@legalpro.pe',   password: 'LegalPro2026!', rol: 'FISCAL',   nombre: 'Fiscal LegalPro' },
  { email: 'juez@legalpro.pe',     password: 'LegalPro2026!', rol: 'JUEZ',     nombre: 'Juez LegalPro' },
  { email: 'contador@legalpro.pe', password: 'LegalPro2026!', rol: 'CONTADOR', nombre: 'Contador LegalPro' },
  { email: 'demo@legalpro.pe',     password: 'Demo2026!',     rol: 'ABOGADO',  nombre: 'Demo LegalPro' },
];

// =============================================================================
// HELPERS
// =============================================================================
function logSep() {
  console.log('─'.repeat(60));
}

// =============================================================================
// MAIN
// =============================================================================
async function seedProd() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   🚀  seed-prod  —  Usuarios E2E de Producción          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
      ? { rejectUnauthorized: false }
      : false,
    max: 3,
    connectionTimeoutMillis: 10_000,
  });

  try {
    // ─── 1. Probar conexión ─────────────────────────────────────────────────
    console.log('🔌 Verificando conexión a PostgreSQL...');
    const connResult = await pool.query('SELECT version(), NOW() AS ts');
    console.log(`   ✅ Conectado a: ${connResult.rows[0].version}`);
    console.log(`   🕐  Server time: ${connResult.rows[0].ts}`);

    // ─── 2. Asegurar organización ──────────────────────────────────────────
    console.log('');
    logSep();
    console.log('📦  Verificando organización...');
    logSep();

    await pool.query(
      `INSERT INTO organizaciones (id, nombre, slug, plan, max_usuarios, max_expedientes, activo, storage_gb_limit, creditos_disponibles, plan_suscripcion, config, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, 10, 1000, 'premium', '{}', '{}', NOW())
       ON CONFLICT (id) DO UPDATE SET
         nombre   = EXCLUDED.nombre,
         activo   = true,
         plan     = EXCLUDED.plan`,
      [ORG_ID, 'Estudio LegalPro Producción', 'legalpro-prod', 'enterprise', 9999, 9999]
    );
    console.log(`   ✅ Organización asegurada: ${ORG_ID}`);
    console.log(`   📛 Nombre: Estudio LegalPro Producción`);

    // ─── 3. Crear/actualizar cada usuario ───────────────────────────────────
    console.log('');
    logSep();
    console.log('👥  Procesando 5 usuarios...');
    logSep();
    console.log('');

    let stats = { creados: 0, actualizados: 0 };

    for (const u of USERS) {
      // 3a. Verificar si el usuario ya existe
      const existente = await pool.query(
        'SELECT id, nombre_completo, rol FROM usuarios WHERE email = $1',
        [u.email]
      );
      const yaExiste = existente.rows.length > 0;

      // 3b. Hacer hash de la contraseña
      const hash = await bcrypt.hash(u.password, BCRYPT_ROUNDS);

      // 3c. Upsert (INSERT ON CONFLICT DO UPDATE)
      const result = await pool.query(
        `INSERT INTO usuarios (id, email, nombre_completo, password_hash, rol, especialidad, esta_activo, organization_id, acepta_transferencia_internacional, consentimiento_transferencia_internacional, transferencia_internacional_aceptada_en, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'general', true, $5, true, true, NOW(), NOW())
         ON CONFLICT (email) DO UPDATE SET
           password_hash    = EXCLUDED.password_hash,
           nombre_completo  = EXCLUDED.nombre_completo,
           rol              = EXCLUDED.rol,
           esta_activo      = true,
           organization_id  = EXCLUDED.organization_id,
           updated_at       = NOW()
         RETURNING id`,
        [u.email, u.nombre, hash, u.rol, ORG_ID]
      );

      const userId = result.rows[0].id;

      // 3d. Asegurar membresía en miembros_organizacion
      await pool.query(
        `INSERT INTO miembros_organizacion (id, organizacion_id, usuario_id, rol, activo, created_at)
         VALUES (gen_random_uuid(), $1, $2, 'MEMBER', true, NOW())
         ON CONFLICT (organizacion_id, usuario_id) DO UPDATE SET
           activo = true,
           rol    = 'MEMBER'`,
        [ORG_ID, userId]
      );

      // 3e. Estadísticas
      if (yaExiste) {
        stats.actualizados++;
        const icono = u.email === 'admin@legalpro.pe' ? '🔄' : '🔄';
        console.log(`   ${icono}  ${u.email.padEnd(32)} rol=${u.rol.padEnd(10)} contraseña ACTUALIZADA`);
      } else {
        stats.creados++;
        console.log(`   🆕  ${u.email.padEnd(32)} rol=${u.rol.padEnd(10)} contraseña: ${u.password}`);
      }
    }

    // ─── 4. Resumen final ──────────────────────────────────────────────────
    console.log('');
    logSep();
    console.log('📊  RESUMEN FINAL');
    logSep();
    console.log('');
    console.log(`   🏢  Organización:  Estudio LegalPro Producción`);
    console.log(`   🆔  Org ID:        ${ORG_ID}`);
    console.log(`   🆕  Creados:       ${stats.creados}`);
    console.log(`   🔄  Actualizados:  ${stats.actualizados}`);
    console.log(`   📋  Total:         ${USERS.length}`);
    console.log('');
    logSep();
    console.log('🔐  CREDENCIALES PARA TESTS E2E:');
    logSep();
    console.log('');
    for (const u of USERS) {
      console.log(`   ${u.rol.padEnd(10)}  →  ${u.email.padEnd(32)}  /  ${u.password}`);
    }
    console.log('');
    logSep();
    console.log('✅  seed-prod completado exitosamente.');
    console.log('');
  } catch (err) {
    console.error('');
    console.error('❌  ERROR en seed-prod:');
    console.error(`    ${err.message}`);
    if (err.stack) {
      console.error('');
      console.error('    Stack trace:');
      console.error(err.stack.split('\n').slice(0, 5).join('\n'));
    }
    throw err;
  } finally {
    await pool.end();
  }
}

seedProd()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
