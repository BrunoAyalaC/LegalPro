# Descripción

<!-- Describir brevemente el cambio -->

## Tipo de cambio

- [ ] Bugfix (cambio que corrige un issue)
- [ ] Feature (cambio que añade funcionalidad)
- [ ] Breaking change (cambio incompatible con versiones anteriores)
- [ ] Refactor (cambio que no añade feature ni corrige bug)
- [ ] Documentation (cambio solo de docs)
- [ ] Test (cambio solo de tests)
- [ ] Chore (cambio de build, CI, dependencias)

## Issue relacionado

<!-- Link al issue: closes #123, refs #456 -->

## Stack afectado

- [ ] Backend .NET
- [ ] Backend Node
- [ ] Frontend
- [ ] Android
- [ ] Database / Migraciones
- [ ] DevOps / CI
- [ ] IA / Gemini
- [ ] Documentación
- [ ] Catálogos
- [ ] Arnés agentic

## Cambios realizados

<!-- Lista de cambios principales -->

- Cambio 1
- Cambio 2

## Reglas duras cumplidas

- [ ] Sin secrets en código
- [ ] RLS en tablas nuevas (si aplica)
- [ ] Multi-tenant preservado (sin IgnoreQueryFilters)
- [ ] LPDP: consentimientos y audit log
- [ ] Disclaimers IA presentes
- [ ] RBAC correcto
- [ ] Tests añadidos/actualizados

## Quality gates

- [ ] Tests unitarios pasan
- [ ] Tests de integración pasan
- [ ] Coverage >= 80%
- [ ] Lint pasa
- [ ] Type-check pasa
- [ ] Bundle size OK (si aplica)

## Verificadores ejecutados

- [ ] `verifier-owasp.mjs` ✅
- [ ] `verifier-lpdp.mjs` ✅
- [ ] `verifier-multi-tenant.mjs` ✅
- [ ] `verifier-secretos.mjs` ✅
- [ ] Otros: <especificar>

## Screenshots / Evidencia

<!-- Si aplica, agregar screenshots, logs, etc. -->

## Breaking changes

<!-- Si aplica, describir migration guide -->

## Riesgos

<!-- Riesgos conocidos y mitigaciones -->

## Rollback plan

<!-- Cómo revertir este cambio -->

## Checklist de review

- [ ] He revisado mi propio código
- [ ] He añadido tests
- [ ] He actualizado la documentación
- [ ] He revisado los catalogos afectados
- [ ] He firmado con DCO (si aplica)
