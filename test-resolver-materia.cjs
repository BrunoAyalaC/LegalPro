// Test simple sin imports
const { readFileSync } = require('fs');
const c = JSON.parse(readFileSync('catalogs/plazos-procesales.json', 'utf-8'));
const plazos = c.plazos || [];

function resolverMateriaParaPlazo(expediente) {
  const materiaLibre = String(expediente.materia || '').trim().toLowerCase();
  const tipo = String(expediente.tipo || '').trim().toLowerCase();
  const materiasValidas = new Set(plazos.map((p) => String(p.materia).toLowerCase()));
  if (materiaLibre && materiasValidas.has(materiaLibre)) return materiaLibre;
  if (tipo && materiasValidas.has(tipo)) return tipo;
  const mapaSubMaterias = {
    'obligaciones':'civil','alimentos':'familia','tenencia':'familia','régimen de visitas':'familia',
    'divorcio':'familia','amparo':'constitucional','habeas corpus':'constitucional','habeas data':'constitucional',
    'despido':'laboral','hostigamiento':'laboral','pensión':'laboral','tributario':'administrativo','previsional':'administrativo'
  };
  if (materiaLibre && mapaSubMaterias[materiaLibre]) return mapaSubMaterias[materiaLibre];
  return materiaLibre || tipo || '';
}

const e = { materia: 'Obligaciones', tipo: 'civil' };
const m = resolverMateriaParaPlazo(e);
console.log('Para Obligaciones civil => materia resuelta:', JSON.stringify(m));
const contestacion = plazos.find((p) => p.acto && p.acto.toLowerCase().includes('contestaci') && p.materia.toLowerCase() === m);
console.log('Plazo contestacion encontrado:', contestacion ? `${contestacion.id} (${contestacion.dias}d, ${contestacion.codigo} art. ${contestacion.articulo})` : 'NO ENCONTRADO');

// Amparo
const e2 = { materia: 'Amparo', tipo: 'constitucional' };
const m2 = resolverMateriaParaPlazo(e2);
console.log('\nPara Amparo constitucional => materia resuelta:', JSON.stringify(m2));
const cad = plazos.find((p) => (p.acto || '').toLowerCase().includes('caduc') || (p.acto || '').toLowerCase().includes('amparo'));
console.log('Plazo caducidad/amparo:', cad ? `${cad.id} (${cad.dias}d)` : 'NO ENCONTRADO');
