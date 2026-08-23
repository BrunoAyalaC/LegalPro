# Gestión de Cambios del Arnés Agentic

## Reglas duras

1. TODO cambio en `.opencode/agents/` requiere:
   - PR con 2 aprobaciones de @arquitecto-chief o @gobernanza-chief
   - Ejecutar `node tools/verifiers/verifier-arneses-registry.mjs`
   - Verificar que el campo `model` NO se agregue (deja que use default)
   - Verificar que `permission: allow` se mantenga

2. TODO cambio en `catalogs/` requiere:
   - PR con aprobación del owner del catálogo
   - Ejecutar `verifier-catalogos.mjs`
   - Documentar en CHANGELOG.md

3. TODO cambio en `tools/verifiers/` requiere:
   - PR con aprobación de @auditor-seguridad
   - El verificador debe ser ejecutable con `node <archivo>.mjs`
   - Exit code 0 si OK, 1 si FAIL

4. TODO cambio en `arneses/runbooks/` requiere:
   - Aprobación del owner del runbook
   - Link al incidente que lo originó

5. TODO cambio en `.opencode/skills/` o `.opencode/commands/` requiere:
   - PR con aprobación del agente owner
   - El skill debe poder invocarse via `@agente <skill>`

## Versionado

- El arnés sigue semver (ARNES-AGENTIC-X.Y.Z)
- Major: cambio incompatible
- Minor: nueva capability
- Patch: fix

## Cambio de Breaking

- SIEMPRE crear ADR
- SIEMPRE migrar a la nueva version
- SIEMPRE dar periodo de deprecacion (1 minor)
