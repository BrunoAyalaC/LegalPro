# Política de Release

## Versionado Semver

Seguimos [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR** (vX.0.0): cambios incompatibles (breaking changes)
- **MINOR** (v0.X.0): nuevas features compatibles
- **PATCH** (v0.0.X): fixes compatibles

## Cadencia

- **Minor/Patch**: cada 2 semanas
- **Major**: cada 3-6 meses (con período de migración)
- **Hotfix**: inmediate (sin esperar al ciclo)

## Ramas

- `main` — producción estable
- `develop` — integración de features
- `feature/<descripcion>` — feature en desarrollo
- `hotfix/vX.Y.Z` — fix crítico de producción
- `release/vX.Y.Z` — preparación de release

## Proceso de Release

### 1. Preparación

- Rama `release/vX.Y.Z` desde `develop`
- Changelog actualizado
- Versión bump en package.json, .csproj, build.gradle
- Sign-off de los 3 chiefs: ArquitectoChief, GobernanzaChief, ProductOwner
- 22 verificadores en verde (CI)

### 2. QA

- Smoke test pre-release
- Journey test completo
- Auditoría LPDP
- Auditoría de seguridad
- Auditoría de performance
- Auditoría legal (golden set de evals IA)

### 3. Publicación

- Tag git: `vX.Y.Z`
- GitHub Release con changelog
- Push imágenes a GHCR (legalpro-frontend, legalpro-node, legalpro-dotnet)
- Deploy a Railway: `legalpro-node-production`, `legalpro-dotnet-production`
- Deploy a Play Store (Android): si aplica
- Smoke test post-deploy
- Notificación a stakeholders

### 4. Post-release

- Monitoreo activo 24h
- Métricas vs SLOs
- Si rollback: ejecutar plan de rollback documentado

## Criterios de Aceptación para Release

### Funcionales

- [ ] PRD/Issue original completado
- [ ] DoD cumplido
- [ ] Tests pasan (unit, integration, e2e, journey)
- [ ] Documentación actualizada

### Seguridad

- [ ] Sin secrets en código
- [ ] OWASP mapping revisado
- [ ] LPDP compliance verificado
- [ ] RLS policies en nuevas tablas

### Performance

- [ ] Latencia p95 dentro de SLO
- [ ] Bundle size dentro de budget
- [ ] Sin regresiones > 10%

### Regulatorio

- [ ] Disclaimers IA correctos
- [ ] Cumplimiento LPDP
- [ ] Cumplimiento NCPP/CPC/CC

## Rollback Plan

Cada release debe tener un plan de rollback documentado en su PR:

1. **Identificar trigger**: ¿qué métrica dispara el rollback?
2. **Ventana de rollback**: 24h desde release
3. **Pasos**: revertir tag, rebuild imágenes, redeploy
4. **Verificación post-rollback**: smoke test, métricas
5. **Comunicación**: stakeholders + usuarios

## Hotfix Process

1. Branch `hotfix/vX.Y.Z` desde `main`
2. Fix mínimo + test que reproduce
3. PR con label `hotfix`
4. Aprobación de @ReleaseManager + @ArquitectoChief
5. CI: 22 verificadores
6. Merge a main + tag
7. Deploy inmediato
8. Cherry-pick a develop

## Firmas requeridas

Cada release requiere:

- [ ] @ArquitectoChief (firma técnica)
- [ ] @GobernanzaChief (firma regulatoria)
- [ ] @ProductOwner (firma de negocio)
- [ ] @ReleaseManager (firma de release)
