# Cómo Contribuir

¡Gracias por tu interés en contribuir a LegalPro / LexIA!

## Formas de contribuir

- Reportar bugs
- Sugerir features
- Mejorar documentación
- Enviar PRs
- Revisar PRs
- Reportar issues de seguridad (ver `catalogs/security-policy.md`)

## Flujo de trabajo

1. Crea un issue describiendo el cambio propuesto
2. Espera feedback de @ProductOwner y @ArquitectoChief
3. Fork + branch `feature/<descripcion>`
4. Implementa + tests
5. PR con la plantilla `arneses/templates/PR.template.md`
6. Pasa los 22 verificadores
7. Code review por CODEOWNERS
8. Merge cuando tenga 2 approvals + CI verde

## Convenciones

### Commits (Conventional Commits)

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`

Ejemplos:
- `feat(redactor): add generar-escrito-amparo`
- `fix(auth): correct token refresh`
- `docs(readme): update setup instructions`

### Branches

- `feature/<descripcion>` — features
- `bugfix/<descripcion>` — bug fixes
- `hotfix/vX.Y.Z-<descripcion>` — hotfixes
- `release/vX.Y.Z` — releases
- `docs/<descripcion>` — solo docs

### Code Style

- Ver `.opencode/rules/` para reglas por stack
- ESLint + Prettier en Node
- dotnet format en .NET
- ktlint en Kotlin
- Sigue SOLID, DRY, KISS, YAGNI

## Reglas duras

1. **NUNCA** commitear secrets
2. **SIEMPRE** escribir tests
3. **SIEMPRE** actualizar documentación
4. **SIEMPRE** mantener cobertura >= 80%
5. **SIEMPRE** respetar CODEOWNERS
6. **SIEMPRE** firmar el DCO

## Recursos

- `ARNES_AGENTIC_PLAN.md` — Plan del arnés
- `.opencode/agents/` — 50 agentes
- `catalogs/` — 18 catálogos
- `tools/verifiers/` — 22 verificadores
- `arneses/runbooks/` — 16 runbooks
- `arneses/templates/` — 24 plantillas

## DCO (Developer Certificate of Origin)

Al enviar un PR, certificas que:

```
El desarrollo de la contribución es público o
corresponde a una cesión válida de derechos al proyecto.
```

Usa `Signed-off-by:` en cada commit (git commit -s).
