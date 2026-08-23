# Toma de Decisiones

## Modelo

Usamos **consentimiento + veto** en decisiones de alto impacto.

## Quién decide qué

### Decisiones técnicas (arquitectura, patrones)

- **Decisor principal**: @ArquitectoChief
- **Veto**: @ArquitectoChief
- **Aprobación**: ADRs firmados

### Decisiones regulatorias (LPDP, ARCO, firma digital)

- **Decisor principal**: @GobernanzaChief
- **Veto**: @GobernanzaChief (sobre cualquier release)
- **Aprobación**: dictamen GO/NO-GO

### Decisiones de producto (features, priorización)

- **Decisor principal**: @ProductOwner
- **Veto**: @ProductOwner (sobre PRD/DoD)
- **Aprobación**: PRD + DoD

### Decisiones de release (deploy, rollback, semver)

- **Decisor principal**: @ReleaseManager
- **Veto**: cualquiera de los 3 chiefs si su área está afectada
- **Aprobación**: sign-off de los 3 chiefs

## Tipos de decisión

### Tipo 1: Reversible (sin restricción)

- Refactors menores
- Optimizaciones locales
- Cambios de UI cosmética

### Tipo 2: Importante (requiere ADR)

- Nueva tabla en BD
- Nuevo endpoint público
- Nuevo agente o skill
- Cambio de SDK o framework

### Tipo 3: Crítica (requiere sign-off 3 chiefs)

- Breaking change de API
- Cambio de pricing
- Modificación del modelo de datos existente
- Cambio regulatorio (LPDP)
- Cambio de proveedor (Gemini, Supabase, Railway)

## Proceso de ADR

1. Crea `arneses/registry/ADRs/ADR-XXX-<titulo>.md` con `arneses/templates/ADR.template.md`
2. Status: `Proposed`
3. Discusión en PR
4. Aprobación: al menos 2 de los 3 chiefs
5. Status: `Accepted` o `Rejected`
6. Si `Superseded`, link al nuevo ADR

## Conflict resolution

Si hay desacuerdo entre chiefs:
1. Discusión asíncrona en el ADR
2. Si no se resuelve: meeting sincrónico
3. Decisión final: mayoría simple (2 de 3)
4. Si sigue sin resolverse: se escalará a dirección

## Cambios del propio arnés

Cambios al arnés agentic (agentes, skills, catálogos) requieren:
- ADR
- Aprobación de @ArquitectoChief
- Review de al menos 2 agentes de la categoría afectada
