/**
 * legal-catalogs — Custom tool de OpenCode para LegalPro / LexIA
 *
 * Permite a los agentes legales (abogados, auditores, orquestador) consultar
 * y validar contra los catálogos legales peruanos del repositorio SIN depender
 * únicamente del conocimiento del LLM (fuente de verdad = catalogs/*.json,
 * verificados contra SPIJ por @AuditorLegal).
 *
 * El nombre del archivo define el nombre de la tool: `legal-catalogs`.
 * Se carga automáticamente desde `.opencode/tools/` (ver opencode.ai/docs/custom-tools).
 */
import { tool } from "@opencode-ai/plugin"
import fs from "node:fs"
import path from "node:path"

/**
 * Mapa catálogo -> archivo JSON + clave de la lista + campos relevantes.
 * Los nombres de archivo y claves de lista son los reales en catalogs/.
 */
const CATALOGOS = {
  codigos: {
    archivo: "codigos-leyes.json",
    lista: "normas",
    nombre: "Códigos y leyes peruanas",
    campoPrincipal: "nombre",
  },
  plazos: {
    archivo: "plazos-procesales.json",
    lista: "plazos",
    nombre: "Plazos procesales",
    campoPrincipal: "acto",
  },
  "tipos-penales": {
    archivo: "tipos-penales-peru.json",
    lista: "tipos",
    nombre: "Tipos penales del Código Penal",
    campoPrincipal: "nombre",
  },
  delitos: {
    archivo: "delitos-economicos.json",
    lista: "delitos",
    nombre: "Delitos económicos y contra la administración pública",
    campoPrincipal: "nombre",
  },
  interpretaciones: {
    archivo: "interpretaciones-favorables.json",
    lista: "interpretaciones",
    nombre: "Interpretaciones legales favorables",
    campoPrincipal: "principio",
  },
} as const

type ClaveCatalogo = keyof typeof CATALOGOS
const CLAVES_CATALOGO = Object.keys(CATALOGOS) as ClaveCatalogo[]

const LIMITE_RESULTADOS = 10

/** Normaliza texto para búsqueda: minúsculas + sin tildes. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

/** Lee un JSON robusto: tolera BOM UTF-8 y devuelve el objeto parseado. */
function leerJson(ruta: string): unknown {
  let texto = fs.readFileSync(ruta, "utf-8")
  if (texto.charCodeAt(0) === 0xfeff) {
    texto = texto.slice(1)
  }
  return JSON.parse(texto)
}

/** Resuelve la ruta real de un catálogo usando worktree/directory de la sesión. */
function resolverCatalogo(
  worktree: string,
  directory: string,
  nombreArchivo: string,
): string | null {
  const candidatos = [
    path.join(worktree, "catalogs", nombreArchivo),
    path.join(directory, "catalogs", nombreArchivo),
  ]
  for (const candidato of candidatos) {
    if (fs.existsSync(candidato)) {
      return candidato
    }
  }
  return null
}

/** Formatea un item según el catálogo para una salida legible. */
function formatearItem(clave: ClaveCatalogo, item: Record<string, unknown>): string {
  switch (clave) {
    case "codigos": {
      const numero = item.numero ? ` ${item.numero}` : ""
      const citados = Array.isArray(item.articulos_mas_citados)
        ? ` | Arts. más citados: ${(item.articulos_mas_citados as unknown[]).join(", ")}`
        : ""
      const spij = item.url_spij ? ` | SPIJ: ${item.url_spij}` : ""
      return `- ${item.nombre} (${item.tipo}${numero})${item.nota_identificacion ? ` — ${item.nota_identificacion}` : ""}${citados}${spij}`
    }
    case "plazos": {
      const baseLegal = item.base_legal ? ` | Base legal: ${item.base_legal}` : ""
      const consecuencia = item.consecuencia_vencimiento
        ? ` — Consecuencia: ${item.consecuencia_vencimiento}`
        : ""
      return `- ${item.acto} (${item.codigo} art. ${item.articulo}): ${item.dias} días ${item.tipo ?? ""}${consecuencia}${baseLegal}`
    }
    case "tipos-penales": {
      return `- ${item.nombre} (CP art. ${item.articulo_cp}): pena ${item.pena_minima ?? "n/d"} a ${item.pena_maxima ?? "n/d"} — bien jurídico: ${item.bien_juridico ?? "n/d"}`
    }
    case "delitos": {
      const baseLegal = item.base_legal
        ? String(item.base_legal)
        : `CP art. ${item.articulo_cp ?? "n/d"}`
      return `- ${item.nombre}: ${baseLegal} — pena ${item.pena_minima ?? "n/d"} a ${item.pena_maxima ?? "n/d"}`
    }
    case "interpretaciones": {
      return `- ${item.principio} [${item.materia}]: ${item.base_legal} — ${item.descripcion}`
    }
  }
}

/**
 * Búsqueda por keyword dentro de un catálogo.
 * Ordena por relevancia (coincidencia en el campo principal primero)
 * y limita a LIMITE_RESULTADOS resultados.
 */
function buscarEnCatalogo(
  clave: ClaveCatalogo,
  datos: Record<string, unknown>,
  keyword: string,
): string[] {
  const config = CATALOGOS[clave]
  const lista = Array.isArray(datos[config.lista])
    ? (datos[config.lista] as Record<string, unknown>[])
    : []
  const keywordNorm = normalizar(keyword)

  const conScore = lista
    .map((item) => {
      const serializado = normalizar(JSON.stringify(item))
      const principal = normalizar(String(item[config.campoPrincipal] ?? ""))
      if (!serializado.includes(keywordNorm)) {
        return null
      }
      // +2 si coincide en el campo principal, +1 si coincide en cualquier otro campo
      const score = principal.includes(keywordNorm) ? 2 : 1
      return { item, score }
    })
    .filter((x): x is { item: Record<string, unknown>; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)

  return conScore.slice(0, LIMITE_RESULTADOS).map(({ item }) => formatearItem(clave, item))
}

export default tool({
  description:
    "Consulta y valida los catálogos legales peruanos de LegalPro (catalogs/*.json): códigos y leyes, plazos procesales, tipos penales, delitos económicos e interpretaciones favorables. Devuelve coincidencias con su base legal verificada. Usar para verificar citas, plazos o calificaciones jurídicas antes de citarlos en un escrito (LEGAL-01 / LEGAL-05).",
  args: {
    consulta: tool.schema
      .string()
      .min(2)
      .describe("Keyword o término a buscar (ej: 'lavado de activos', 'apelación', 'despido nulo'). Sin tildes o con tildes da igual: se normaliza."),
    catalogo: tool.schema
      .enum(["codigos", "plazos", "tipos-penales", "delitos", "interpretaciones", "todos"])
      .optional()
      .describe("Catálogo donde buscar. 'todos' (default) busca en los 5 catálogos."),
  },
  async execute(args, context) {
    const keyword = args.consulta.trim()
    const claveBuscada: ClaveCatalogo | "todos" = args.catalogo ?? "todos"

    // Catálogo inexistente -> mensaje claro
    if (claveBuscada !== "todos" && !(claveBuscada in CATALOGOS)) {
      return [
        `Catálogo "${args.catalogo}" no válido.`,
        `Catálogos disponibles: ${CLAVES_CATALOGO.join(", ")} o "todos".`,
      ].join("\n")
    }

    const catalogoSeleccionado: ClaveCatalogo[] =
      claveBuscada === "todos" ? CLAVES_CATALOGO : [claveBuscada]

    const { worktree, directory } = context
    const lineas: string[] = []
    let totalEncontrados = 0

    for (const clave of catalogoSeleccionado) {
      const config = CATALOGOS[clave]
      const ruta = resolverCatalogo(worktree, directory, config.archivo)

      if (!ruta) {
        lineas.push(`- ⚠️ Catálogo "${config.nombre}" no disponible: no se encontró catalogs/${config.archivo}.`)
        continue
      }

      let datos: Record<string, unknown>
      try {
        datos = leerJson(ruta) as Record<string, unknown>
      } catch (error) {
        lineas.push(`- ⚠️ Catálogo "${config.nombre}" ilegible (JSON inválido): ${String(error)}`)
        continue
      }

      const matches = buscarEnCatalogo(clave, datos, keyword)
      totalEncontrados += matches.length

      if (matches.length === 0) {
        continue
      }

      lineas.push(`\n## ${config.nombre} (${matches.length}${matches.length === LIMITE_RESULTADOS ? "+" : ""} coincidencias)`)
      lineas.push(...matches)
    }

    if (totalEncontrados === 0) {
      return [
        `No se encontraron coincidencias para "${keyword}" en ${claveBuscada === "todos" ? "ningún catálogo" : CATALOGOS[claveBuscada].nombre}.`,
        `Sugerencias: probar con otro término, revisar ortografía, o consultar catalogo="todos" para ampliar la búsqueda.`,
        `Los catálogos NO se editan aquí: las citas deben confirmarse contra SPIJ antes de usarse (reglas LEGAL-01 / IA-03).`,
      ].join("\n")
    }

    return [
      `# Búsqueda "${keyword}" en catálogos legales de LegalPro`,
      `Total de coincidencias: ${totalEncontrados} (máx. ${LIMITE_RESULTADOS} por catálogo)`,
      ...lineas,
      ``,
      `⚠️ Verificación humana: confirma cada base legal en SPIJ antes de usarla en un escrito (LEGAL-01 / LEGAL-05).`,
    ].join("\n")
  },
})
