#!/usr/bin/env node
/**
 * Verifier Plazos Procesales — VALIDACIÓN DE CONTENIDO (v2)
 *
 * Valida los VALORES de plazos del catálogo (catalogs/plazos-procesales.json)
 * contra una TABLA CANÓNICA de realidad legal peruana.
 *
 * A diferencia de verifier-plazos.mjs (que solo valida cobertura/estructura),
 * este verifier compara el valor numérico de días (y el tipo: hábiles/naturales)
 * con valores REALES verificados en auditorías previas contra SPIJ (MINJUS)
 * y El Peruano. Un valor incorrecto en el catálogo = ERROR (exit 1).
 *
 * Uso: node tools/verifiers/verifier-plazos-content.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', '..');
const CATALOGO = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalogs/plazos-procesales.json'), 'utf8'));
const plazos = CATALOGO.plazos || CATALOGO;

/**
 * ────────────────────────────────────────────────────────────────────────────
 * TABLA CANÓNICA DE PLAZOS REALES (validada en auditorías contra SPIJ/El Peruano)
 *
 * Cada entrada describe un plazo real: su id en el catálogo, el acto, el valor
 * canónico esperado (dias y tipo) o los textos que debe contener (para campos
 * descriptivos como prescripción) y la base legal exacta.
 *
 * Fuente de verificación: SPIJ (https://spij.minjus.gob.pe), El Peruano.
 * ────────────────────────────────────────────────────────────────────────────
 */
const CANONICO = [
  {
    id: 'plazo_apelacion_sentencia_civil',
    acto: 'Apelación de sentencia',
    dias: 10,
    tipo: 'habiles',
    base: 'CPC art. 367',
    descripcion: 'Apelación de sentencia civil: 10 días hábiles',
  },
  {
    id: 'plazo_apelacion_autos_civil',
    acto: 'Apelación de autos',
    dias: 5,
    tipo: 'habiles',
    base: 'CPC art. 367',
    descripcion: 'Apelación de autos civil: 5 días hábiles',
  },
  {
    id: 'plazo_contestacion_demanda_civil',
    acto: 'Contestación de demanda',
    dias: 30,
    tipo: 'habiles',
    base: 'CPC art. 486',
    descripcion: 'Contestación de demanda civil: 30 días hábiles',
  },
  {
    id: 'plazo_casacion_civil',
    acto: 'Interposición de casación civil',
    dias: 10,
    tipo: 'habiles',
    base: 'CPC art. 388',
    descripcion: 'Casación civil: 10 días hábiles',
  },
  {
    id: 'plazo_amparo',
    acto: 'Demanda de amparo',
    dias: 30,
    tipo: 'habiles',
    base: 'Ley 31307 (NCPCConst) art. 45 (vigente desde 2022); antes Ley 28237 art. 44: 60 días hábiles',
    descripcion: 'Demanda de amparo: 30 días hábiles bajo Ley 31307 vigente',
    notaContiene: ['31307'],
  },
  {
    id: 'plazo_contestacion_laboral',
    acto: 'Contestación de demanda laboral',
    dias: 10,
    tipo: 'habiles',
    base: 'Ley 29497 art. 24',
    descripcion: 'Contestación demanda laboral: 10 días hábiles',
  },
  {
    id: 'plazo_apelacion_laboral',
    acto: 'Apelación de sentencia laboral',
    dias: 5,
    tipo: 'habiles',
    base: 'Ley 29497 art. 32',
    descripcion: 'Apelación sentencia laboral: 5 días hábiles',
  },
  {
    id: 'plazo_demanda_laboral',
    acto: 'Demanda laboral',
    campo: 'dias_prescripcion_contrato',
    contiene: ['4 años'],
    base: 'TUO D.L. 728 art. 36',
    descripcion: 'Prescripción laboral: 4 años desde extinguido el vínculo laboral',
  },
  {
    id: 'plazo_caducidad_impugnacion_despido',
    acto: 'Impugnación de despido',
    dias: 30,
    tipo: 'habiles',
    base: 'TUO LPCL D.S. 003-97-TR art. 36',
    descripcion: 'Caducidad impugnación de despido: 30 días hábiles',
  },
  {
    id: 'plazo_contencioso_administrativo',
    acto: 'Demanda contencioso-administrativa',
    dias: 90,
    tipo: 'naturales',
    base: 'TUO Ley 27584 art. 18',
    descripcion: 'Contencioso-administrativo: 3 meses (90 días naturales)',
  },
  {
    id: 'plazo_apelacion_arbitral',
    acto: 'Anulación de laudo arbitral',
    dias: 20,
    tipo: 'habiles',
    base: 'D.L. 1071 art. 59',
    descripcion: 'Anulación de laudo arbitral: 20 días hábiles',
  },
  {
    id: 'plazo-contrataciones-recurso',
    acto: 'Recurso de apelación contrataciones',
    campo: 'plazo_dias',
    dias: 8,
    tipo: 'habiles',
    base: 'Ley 30225',
    descripcion: 'Apelación ante Tribunal de Contrataciones: 8 días hábiles',
  },
  {
    id: 'plazo_reclamacion_tributaria',
    acto: 'Reclamación ante SUNAT / administración tributaria',
    dias: 20,
    tipo: 'habiles',
    base: 'TUO Código Tributario art. 137',
    descripcion: 'Reclamación tributaria: 20 días hábiles',
  },
  {
    id: 'plazo_apelacion_tribunal_fiscal',
    acto: 'Apelación ante el Tribunal Fiscal',
    dias: 15,
    tipo: 'habiles',
    base: 'TUO Código Tributario art. 146',
    descripcion: 'Apelación ante Tribunal Fiscal: 15 días hábiles',
  },
  {
    id: 'plazo_prescripcion_penal',
    acto: 'Prescripción de la acción penal',
    contiene: ['20/15/10/5'],
    articulo: '80',
    base: 'CP art. 80',
    descripcion: 'Prescripción penal: 20/15/10/5 años según la pena máxima',
  },
  {
    id: 'plazo_prescripcion_civil',
    acto: 'Prescripción de la acción civil',
    contiene: ['10', '5'],
    base: 'CC art. 2001',
    descripcion: 'Prescripción civil: 10 años (acción real), 5 años (acción personal)',
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const norm = (s) => String(s || '').toLowerCase().trim();

function findEnCatalogo(c) {
  // 1) por id exacto
  let item = plazos.find((p) => p.id === c.id);
  if (item) return { item, via: 'id' };
  // 2) por acto (substring case-insensitive)
  item = plazos.find((p) => norm(p.acto || p.nombre || '') === norm(c.acto || ''));
  if (item) return { item, via: 'acto' };
  item = plazos.find((p) => (norm(p.acto || '') + ' ' + norm(p.nombre || '')).includes(norm(c.acto || '')));
  if (item) return { item, via: 'acto-parcial' };
  return null;
}

function getValor(item, c) {
  const campo = c.campo || 'dias';
  if (campo in item) return item[campo];
  return undefined;
}

function coerceNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const m = v.match(/\d+/);
    return m ? parseInt(m[0], 10) : NaN;
  }
  return NaN;
}

// ── Ejecución ───────────────────────────────────────────────────────────────
console.log('🔍 Verificador de Plazos Procesales — VALIDACIÓN DE CONTENIDO');
console.log('   Tabla canónica validada contra SPIJ (MINJUS) y El Peruano');
console.log('');

let errores = 0;
let ok = 0;

for (const c of CANONICO) {
  const found = findEnCatalogo(c);
  if (!found) {
    errores++;
    console.log(`   ❌ ERROR [falta crítica] ${c.id} — "${c.descripcion}" (${c.base})`);
    console.log(`      No existe en catalogs/plazos-procesales.json (ni por id ni por acto)`);
    continue;
  }
  const { item } = found;
  const valor = getValor(item, c);
  const problemas = [];

  if (c.dias !== undefined) {
    if (valor === undefined) {
      problemas.push(`campo '${c.campo || 'dias'}' no existe en el catálogo`);
    } else if (typeof valor === 'number' || /^\d+$/.test(String(valor).trim())) {
      const vn = coerceNumber(valor);
      if (vn !== c.dias) {
        problemas.push(`dias=${vn} (catálogo) ≠ esperado=${c.dias}`);
      }
    } else if (typeof valor === 'string' && !/\d/.test(valor)) {
      problemas.push(`dias="${valor}" no es numérico (esperado ${c.dias})`);
    } else {
      // string con número embebido
      const vn = coerceNumber(valor);
      if (vn !== c.dias) {
        problemas.push(`dias≈${vn} (catálogo) ≠ esperado=${c.dias}`);
      }
    }
  }

  if (c.tipo !== undefined && item.tipo !== undefined) {
    if (norm(item.tipo) !== norm(c.tipo)) {
      problemas.push(`tipo="${item.tipo}" (catálogo) ≠ esperado="${c.tipo}"`);
    }
  }

  if (c.contiene) {
    const texto = typeof valor === 'string' ? valor : JSON.stringify(item);
    for (const frag of c.contiene) {
      if (!texto.includes(frag)) {
        problemas.push(`no contiene "${frag}" (prescripción mal documentada)`);
      }
    }
  }

  if (c.notaContiene) {
    const nota = item.nota || item.descripcion || '';
    for (const frag of c.notaContiene) {
      if (!nota.includes(frag)) {
        problemas.push(`nota no menciona "${frag}" (norma vigente mal referenciada)`);
      }
    }
  }

  if (c.articulo !== undefined) {
    const art = String(item.articulo || '');
    if (art !== String(c.articulo)) {
      problemas.push(`articulo="${art || '(vacío)'}" (catálogo) ≠ esperado="${c.articulo}"`);
    }
  }

  if (problemas.length > 0) {
    errores++;
    console.log(`   ❌ ERROR ${c.id} — "${c.descripcion}" (${c.base})`);
    problemas.forEach((p) => console.log(`      · ${p}`));
  } else {
    ok++;
    const valorTxt = valor === undefined ? '(descriptivo)' : `dias=${valor}`;
    console.log(`   ✅ PASS ${c.id} — ${c.descripcion} [${valorTxt}${item.tipo ? ', ' + item.tipo : ''}]`);
  }
}

console.log('');
console.log('='.repeat(50));
console.log(`📊 RESULTADO: ${ok} PASS / ${CANONICO.length} canónicos · ${errores} ERRORES`);
if (errores > 0) {
  console.log('❌ FAIL: existen valores de plazos incorrectos o faltantes en el catálogo');
} else {
  console.log('✅ PASS: todos los valores de plazos coinciden con la tabla canónica');
}
process.exit(errores > 0 ? 1 : 0);
