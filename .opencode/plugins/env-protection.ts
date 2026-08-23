/**
 * env-protection — Plugin de OpenCode para LegalPro / LexIA
 *
 * Refuerza GOV-02 (0 secretos expuestos): bloquea la lectura de archivos
 * sensibles con la tool `read` (y solo con ella; el resto de tools no se ven
 * afectadas).
 *
 * Se carga automáticamente desde `.opencode/plugins/` (ver opencode.ai/docs/plugins).
 * Patrón base: ejemplo oficial ".env protection" de la documentación.
 */
import type { Plugin } from "@opencode-ai/plugin"

/**
 * Patrones de archivos sensibles. El path se normaliza a "/" antes de testear
 * para funcionar en Windows ("\") y en Linux/macOS ("/").
 *
 * Cubre: .env*, datos.txt, crede.txt, secrets/**, *.pem, *.key
 */
const PATRONES_SENSIBLES = [
  /(^|[\\/])\.env($|\.)/i, // .env, .env.production, .env.local, .env.production.example
  /(^|[\\/])datos\.txt$/i, // datos.txt
  /(^|[\\/])crede\.txt$/i, // crede.txt
  /(^|[\\/])secrets[\\/]/i, // cualquier archivo dentro de secrets/
  /\.pem$/i, // *.pem (certificados/llaves)
  /\.key$/i, // *.key (llaves privadas)
]

export const EnvProtection: Plugin = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "read") {
        return
      }

      const filePath =
        typeof output.args?.filePath === "string" ? output.args.filePath : ""
      if (!filePath) {
        return
      }

      const normalizado = filePath.replace(/\\/g, "/")
      const bloqueado = PATRONES_SENSIBLES.some((patron) => patron.test(normalizado))

      if (bloqueado) {
        throw new Error("Do not read secrets files")
      }
    },
  }
}

export default EnvProtection
