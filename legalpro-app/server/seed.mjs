// legalpro-app/server/seed.mjs
// Generado por @database (Sprint 1 - Tarea 5)
// Crea 3 organizaciones demo con 5 usuarios cada una + expedientes + consentimientos

import db from './db.js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

async function seed() {
  console.log('🌱 Iniciando seed de LegalPro...');

  try {
    // ═══ 1. ORGANIZACIONES ═══
    console.log('📦 Creando 3 organizaciones...');
    const orgs = [
      { id: 'a1b2c3d4-1111-1111-1111-111111111111', nombre: 'Estudio Demo Free', slug: 'estudio-free', plan: 'free', max_usuarios: 1, max_expedientes: 5, max_consultas_ia_mes: 50 },
      { id: 'a1b2c3d4-2222-2222-2222-222222222222', nombre: 'Estudio Pro Asociados', slug: 'estudio-pro', plan: 'pro', max_usuarios: 5, max_expedientes: 50, max_consultas_ia_mes: 1000 },
      { id: 'a1b2c3d4-3333-3333-3333-333333333333', nombre: 'Bufete Enterprise SAC', slug: 'bufete-enterprise', plan: 'enterprise', max_usuarios: 9999, max_expedientes: 9999, max_consultas_ia_mes: 50000 }
    ];

    for (const org of orgs) {
      await db.query(
        `INSERT INTO organizaciones (id, nombre, slug, plan, max_usuarios, max_expedientes, max_consultas_ia_mes, activo, storage_gb_limit, creditos_disponibles, plan_suscripcion, config, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, 10, 1000, 'premium', '{}', '{}', NOW())
         ON CONFLICT (slug) DO NOTHING`,
        [org.id, org.nombre, org.slug, org.plan, org.max_usuarios, org.max_expedientes, org.max_consultas_ia_mes]
      );
    }

    // ═══ 2. USUARIOS (5 roles) ═══
    console.log('👥 Creando 15 usuarios (5 roles x 3 orgs)...');
    const passwordHash = await bcrypt.hash('LegalPro2026!', BCRYPT_ROUNDS);
    const roles = ['ABOGADO', 'FISCAL', 'JUEZ', 'CONTADOR', 'ADMIN'];
    const usuarios = [];

    for (const org of orgs) {
      for (const rol of roles) {
        const id = crypto.randomUUID();
        const email = `${rol.toLowerCase()}@${org.slug}.pe`;
        usuarios.push({ id, org_id: org.id, email, password_hash: passwordHash, rol, nombre_completo: `${rol} Demo ${org.slug}` });
        await db.query(
          `INSERT INTO usuarios (id, email, nombre_completo, password_hash, rol, especialidad, esta_activo, organization_id, acepta_transferencia_internacional, transferencia_internacional_aceptada_en, created_at)
           VALUES ($1, $2, $3, $4, $5, 'general', true, $6, true, NOW(), NOW())
           ON CONFLICT (email) DO NOTHING`,
          [id, email, `${rol} Demo ${org.slug}`, passwordHash, rol, org.id]
        );
      }
    }

    // ═══ 3. CONSENTIMIENTOS ═══
    console.log('✅ Creando consentimientos LPDP...');
    for (const u of usuarios) {
      const tipos = [
        { tipo: 'terminos', version: '1.0.0' },
        { tipo: 'privacidad', version: '1.0.0' },
        { tipo: 'marketing', version: '1.0.0' },
        { tipo: 'eliminacion', version: '1.0.0' }
      ];
      for (const t of tipos) {
        await db.query(
          `INSERT INTO consentimientos (id, usuario_id, tipo, version, aceptado, ip_address, user_agent, created_at)
           VALUES ($1, $2, $3, $4, $5, '127.0.0.1', 'seed-script', NOW())
           ON CONFLICT DO NOTHING`,
          [crypto.randomUUID(), u.id, t.tipo, t.version, true]
        );
      }
    }

    // ═══ 4. EXPEDIENTES ═══
    console.log('⚖️ Creando 9 expedientes demo (3 por org)...');
    const materias = [
      { tipo: 'civil', numero: '00001-2026', titulo: 'Incumplimiento de contrato de compraventa', partes: { demandante: 'Juan Pérez', demandado: 'Empresa XYZ SAC' } },
      { tipo: 'penal', numero: '00002-2026', titulo: 'Lesiones leves por agresión', partes: { agraviado: 'María López', acusado: 'Carlos Mendoza' } },
      { tipo: 'laboral', numero: '00003-2026', titulo: 'Despido arbitrario', partes: { demandante: 'Ana Torres', demandado: 'Compañía ABC SAC' } }
    ];

    for (const org of orgs) {
      for (let i = 0; i < materias.length; i++) {
        const m = materias[i];
        const abogado = usuarios.find(u => u.org_id === org.id && u.rol === 'ABOGADO');
        await db.query(
          `INSERT INTO expedientes (id, usuario_id, organization_id, numero, titulo, tipo, estado, partes, hechos, materia, tipo_proceso, es_urgente, es_dato_sensible, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'activo', $7, 'Hechos del caso...', $8, 'ordinario', false, false, NOW())
           ON CONFLICT (numero) DO NOTHING`,
          [crypto.randomUUID(), abogado.id, org.id, `${org.slug}-${m.numero}`, m.titulo, m.tipo, JSON.stringify(m.partes), m.tipo]
        );
      }
    }

    // ═══ 5. RESUMEN ═══
    const counts = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM organizaciones) as orgs,
        (SELECT COUNT(*) FROM usuarios) as users,
        (SELECT COUNT(*) FROM consentimientos) as consents,
        (SELECT COUNT(*) FROM expedientes) as cases
    `);
    console.log('\n✅ Seed completado:');
    console.log(`   Organizaciones: ${counts.rows[0].orgs}`);
    console.log(`   Usuarios: ${counts.rows[0].users}`);
    console.log(`   Consentimientos: ${counts.rows[0].consents}`);
    console.log(`   Expedientes: ${counts.rows[0].cases}`);
    console.log('\n🔐 Credenciales demo (password: LegalPro2026!):');
    orgs.forEach(org => {
      console.log(`   ${org.slug}:`);
      roles.forEach(rol => console.log(`     - ${rol.toLowerCase()}@${org.slug}.pe`));
    });
  } catch (e) {
    console.error('❌ Error en seed:', e.message);
    throw e;
  }
}

seed()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
