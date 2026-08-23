// scripts-smoke/smoke-plazos.mjs — Smoke test del endpoint /api/plazos
import jwt from 'jsonwebtoken';

const BASE = 'http://localhost:3055';
const SECRET = 'SmokeTestJWTSecretMustBeAtLeast32CharactersLong_OK';

const token = jwt.sign(
  { id: 'u1', email: 's@t', organization_id: 'o1', rol_org: 'ABOGADO' },
  SECRET,
  { expiresIn: '1h', algorithm: 'HS256', issuer: 'LegalProAPI', audience: 'LegalProClients' }
);

async function call(method, path, body = null, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

function summarize(label, r, pickKeys) {
  console.log(`\n=== ${label} ===`);
  console.log(`HTTP ${r.status}`);
  if (pickKeys) {
    const out = {};
    for (const k of pickKeys) out[k] = r.body?.data?.[k] ?? r.body?.[k];
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log(JSON.stringify(r.body, null, 2));
  }
}

// 1. Catálogo sin auth
const r1 = await call('GET', '/api/plazos/catalogo', null, false);
console.log(`\n[1] GET /api/plazos/catalogo (sin auth) → HTTP ${r1.status}, ${r1.body?.data?.length ?? 0} plazos devueltos`);

// 2. 30 días hábiles desde 2026-01-01 (plazo_id)
const r2 = await call('POST', '/api/plazos/calcular', {
  plazo_id: 'plazo_contestacion_demanda_civil',
  fecha_inicio: '2026-01-01',
});
summarize('[2] POST /calcular plazo_id=contestacion_demanda_civil, fecha_inicio=2026-01-01',
  r2,
  ['plazo_id', 'fecha_inicio', 'fecha_vencimiento', 'dias_habiles', 'dias_calendario_total', 'es_habil', 'advertencia']
);
console.log(`feriados_del_anio: ${r2.body?.data?.feriados_del_anio?.length ?? 0} entradas`);

// 3. 5 días hábiles desde 2026-07-24 (viernes) → lunes 27, martes 28(feriado), miércoles 29(feriado), jueves 30, viernes 31
//    Esperado: 2026-07-31 (cuenta: 27, 30, 31 son hábiles, pero 28 y 29 no; debe sumar 5 hábiles desde 27)
//    27→+1=28 (no hábil), +1=29 (no hábil), +1=30 (hábil, c=1), +1=31 (hábil, c=2)
//    Fecha de partida 24 (vie), 27 lun +1 hábil? contador cuenta post-inicio. Empezando 24:
//    cursor 25 dom, 26 lun(1), 27 mar(2), 28 mié(feriado), 29 jue(feriado), 30 vie(3), 31 vie(4) — pero cursor es 31, y 31 vie es hábil, c=4.
//    Necesita 5: 1-ago sáb no, 2-dom no, 3-lun(5). Vencimiento = 2026-08-03.
const r3 = await call('POST', '/api/plazos/calcular', {
  dias: 5,
  fecha_inicio: '2026-07-24',
});
summarize('[3] POST /calcular dias=5, fecha_inicio=2026-07-24 (cruza Fiestas Patrias)',
  r3,
  ['fecha_vencimiento', 'dias_calendario_total', 'es_habil', 'advertencia']
);

// 4. 1 día hábil desde 2026-07-27 (lunes) → 28 es feriado, debe prorrogarse a 30-jul
const r4 = await call('POST', '/api/plazos/calcular', {
  dias: 1,
  fecha_inicio: '2026-07-27',
});
summarize('[4] POST /calcular dias=1, fecha_inicio=2026-07-27 (al día siguiente es feriado)',
  r4,
  ['fecha_vencimiento', 'dias_calendario_total', 'es_habil', 'advertencia']
);

// 5. plazo_id inexistente → 404
const r5 = await call('POST', '/api/plazos/calcular', {
  plazo_id: 'plazo_inexistente',
  fecha_inicio: '2026-01-01',
});
console.log(`\n[5] POST /calcular plazo_id=plazo_inexistente → HTTP ${r5.status}: ${JSON.stringify(r5.body)}`);

// 6. sin fecha_inicio → 400
const r6 = await call('POST', '/api/plazos/calcular', { dias: 10 });
console.log(`\n[6] POST /calcular sin fecha_inicio → HTTP ${r6.status}: ${JSON.stringify(r6.body)}`);

// 7. sin auth → 401
const r7 = await call('POST', '/api/plazos/calcular', {
  dias: 5,
  fecha_inicio: '2026-01-01',
}, false);
console.log(`\n[7] POST /calcular sin auth → HTTP ${r7.status}: ${JSON.stringify(r7.body)}`);

// 8. Verificar que esDiaHabil y Semana Santa están en la lista
const r8 = await call('POST', '/api/plazos/calcular', {
  dias: 1,
  fecha_inicio: '2026-04-01',
});
console.log(`\n[8] Feriados del año 2026:`);
const fers = r8.body?.data?.feriados_del_anio ?? [];
for (const f of fers) console.log(`  ${f.fecha}  (${f.motivo})`);