---
name: buscar-jurisprudencia
description: Busqueda de jurisprudencia peruana en 5 fuentes: PJ (Casaciones), TC (Sentencias constitucionales), INDECOPI, SUNARP, MINJUSDH. Validacion contra catalogos canónicos.
when-to-use: "Cuando se necesite jurisprudencia relevante para un caso,tesis juridica, o precedente vinculante"
allowed-tools: Read, Write, Grep, Glob, WebFetch, playwright
updated: 2026-07-31
fuentes: [PJ, TC, INDECOPI, SUNARP, MINJUSDH]
jurisprudencia-sistematizada: https://jurisprudencia.sedetc.gob.pe/
---

# buscar-jurisprudencia (v3.0 RAG-optimized)

Búsqueda de jurisprudencia peruana en 5 fuentes oficiales con validación contra catálogos canónicos. **A julio 2026**.

## Inputs

```yaml
query: string  # texto libre o términos técnicos
fuentes: [PJ, TC, INDECOPI, SUNARP, MINJUSDH]
materia: penal | civil | laboral | constitucional | comercial | tributario | administrativo
top_k: 5
fecha_desde: iso8601 (opcional)
fecha_hasta: iso8601 (opcional)
solo_vinculantes: bool (opcional)  # solo precedentes vinculantes TC
```

## Output schema

```json
{
  "version": "3.0",
  "query": "string",
  "resultados": [
    {
      "id": "string",
      "fuente": "PJ|TC|INDECOPI|SUNARP|MINJUSDH",
      "tipo": "casacion|sentencia|resolucion|precedente_vinculante",
      "expediente": "string",
      "fecha": "iso8601",
      "tribunal": "string",
      "materia": "string",
      "sumilla": "string (resumen)",
      "ratio_decidendi": "string (fundamento central)",
      "url_oficial": "string",
      "precedente_vinculante": true|false,
      "relevancia_score": "0.0-1.0",
      "aplicabilidad_al_caso": "ALTA|MEDIA|BAJA",
      "tags": ["..."]
    }
  ],
  "total_resultados": "int",
  "fecha_busqueda": "iso8601"
}
```

## Fuentes (julio 2026)

### 1. **Tribunal Constitucional (TC)** — Sentencias y precedentes vinculantes

- **URL Jurisprudencia Sistematizada**: https://jurisprudencia.sedetc.gob.pe/
- **URL Búsqueda de causas**: https://www.tc.gob.pe/consultas-de-causas/
- **Presidente TC (jul-2026)**: Helder Domínguez Haro
- **30 años de funcionamiento** (1996-2026)
- **Búsqueda vía scraping con playwright** (no hay API oficial pública)

```javascript
// Búsqueda con playwright MCP
import { chromium } from 'playwright';

async function searchTC(query, topK = 5) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('https://jurisprudencia.sedetc.gob.pe/');
  await page.fill('input[name="q"]', query);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.result-item');

  const results = await page.$$eval('.result-item', items => items.slice(0, 10).map(item => ({
    expediente: item.querySelector('.expediente')?.textContent,
    sumilla: item.querySelector('.sumilla')?.textContent,
    fecha: item.querySelector('.fecha')?.textContent,
    url: item.querySelector('a')?.href,
  })));

  await browser.close();
  return results;
}
```

### 2. **Poder Judicial (PJ)** — Casaciones y sentencias

- **URL Casaciones CSJ**: https://csj.pj.gob.pe/
- **URL Sentencias**: https://www.pj.gob.pe/
- **Casaciones civiles**: CPC art. 388
- **Casaciones laborales**: LPCL
- **Casaciones penales**: NCPP art. 427

### 3. **INDECOPI** — Resoluciones y precedentes administrativos

- **URL**: https://www.indecopi.gob.pe/
- **Tribunales**: Sala Especializada en Propiedad Intelectual, Protección al Consumidor, Competencia, Dumping
- **Materias**: consumidor, propiedad intelectual, competencia, dumping, barreras burocráticas
- **Resoluciones vinculantes**: precedentes de observancia obligatoria

### 4. **SUNARP** — Jurisprudencia registral

- **URL**: https://www.sunarp.gob.pe/
- **Materias**: derecho registral, calificación registral
- **Resoluciones**: Tribunal Registral

### 5. **MINJUSDH** — Opiniones y directivas

- **URL**: https://www.gob.pe/minjus
- **Compendios**: jurisprudencia sistematizada por materia
- **Directivas**: criterios interpretativos
- **Sentencias CIDH**: https://www.gob.pe/minjus/colecciones/4670

## Precedentes vinculantes TC (julio 2026)

A la fecha, los principales precedentes vinculantes del TC incluyen:

| Expediente | Tema | Año |
|---|---|---|
| STC 0008-2012-PI/TC | Matrimonio igualitario | 2024 |
| STC 05652-2015-PA/TC | Derecho a la salud | 2024 |
| STC 04293-2012-PHD/TC | Habeas data | 2024 |
| STC 01800-2023-PHC/TC | Habeas corpus - Ollanta Humala (31-jul-2026) | 2026 |

## Pasos (protocolo RAG)

1. **Clasificar el query** por materia (penal/civil/etc.) y fuente preferente.
2. **Ejecutar búsqueda en cada fuente** seleccionada (paralelo).
3. **Normalizar resultados** a schema común.
4. **Filtrar por fecha** si se especifica rango temporal.
5. **Calcular relevancia** con embeddings (cosine similarity).
6. **Marcar precedentes vinculantes** según `solo_vinculantes`.
7. **Asignar aplicabilidad al caso** según contexto (ALTA/MEDIA/BAJA).
8. **Validar URLs** (HEAD request, evitar 404s).
9. **Emitir evento `JURISPRUDENCE_RETRIEVED`**.

## Casos especiales

### Búsqueda de Casaciones (PJ)

Las casaciones son **precedentes vinculantes** en materia civil, penal y laboral.

```javascript
async function searchCasaciones(query, materia) {
  // URL base según materia
  const baseUrls = {
    civil: 'https://csj.pj.gob.pe/casaciones/civil',
    penal: 'https://csj.pj.gob.pe/casaciones/penal',
    laboral: 'https://csj.pj.gob.pe/casaciones/laboral',
  };

  return await scrapeSearch(baseUrls[materia], query);
}
```

### Búsqueda en TC con playwright

```javascript
async function searchTCBrowser(query) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://jurisprudencia.sedetc.gob.pe/');

  await page.fill('input[type="search"]', query);
  await page.press('input[type="search"]', 'Enter');
  await page.waitForSelector('.sentencia', { timeout: 10000 });

  const results = await page.$$eval('.sentencia', (items) =>
    items.slice(0, 10).map((item) => ({
      expediente: item.dataset.expediente,
      sumilla: item.querySelector('.sumilla')?.textContent?.trim(),
      fecha: item.querySelector('.fecha')?.textContent?.trim(),
      tribunal: item.querySelector('.tribunal')?.textContent?.trim(),
      precedente_vinculante: item.classList.contains('vinculante'),
      url: item.querySelector('a.descargar')?.href,
    }))
  );

  await browser.close();
  return results;
}
```

## Quality gates

- [ ] Mínimo 1 fuente consultada
- [ ] Top-K resultados (default 5)
- [ ] URLs verificadas (HEAD request 200 OK)
- [ ] Precedentes vinculantes marcados
- [ ] Score de relevancia ≥ 0.70
- [ ] Citas SPIJ presentes si aplica
- [ ] Audit event emitido

## Audit log

Emitir `JURISPRUDENCE_RETRIEVED` con payload: `query, fuentes_consultadas, total_resultados, top_score, latencia_ms`.

## Referencias

- `catalogs/chat-intent-functions.json` (FC `buscar_jurisprudencia`)
- TC: https://www.tc.gob.pe/
- TC Jurisprudencia Sistematizada: https://jurisprudencia.sedetc.gob.pe/
- PJ Casaciones: https://csj.pj.gob.pe/
- INDECOPI: https://www.indecopi.gob.pe/
- SUNARP: https://www.sunarp.gob.pe/
- MINJUSDH: https://www.gob.pe/minjus
- CIDH: https://www.corteidh.or.cr/
- `catalogs/codigos-leyes.json` (validar citas legales)
- `tools/verifiers/verifier-citas-legales.mjs`
- `legalpro-app/server/adapters/SPIJAdapter.js`
- Playwright docs: https://playwright.dev/
