# RB-019: Credenciales del Owner Comprometidas

## Metadata

- **Severidad**: P0
- **Categoría**: security
- **Owner**: @OwnerAdmin + @DevOps
- **Última actualización**: 2026-06-12

## Síntomas

- Owner reporta que su sesión fue usada sin su consentimiento
- Logs muestran login del owner desde IP/país no habitual
- Alertas de Datadog/Sentry: anomalías en `/api/owner/*`
- Investigator de seguridad reporta exposición
- `OWNER_SECRET_KEY` aparece en logs públicos o breach externo

## Diagnóstico

### Paso 1: Confirmar

- [ ] Revisar logs del `legalpro-owner-dashboard/`
- [ ] Buscar `authenticateOwner` con resultados 200 desde IPs nuevas
- [ ] Verificar git history: ¿se commiteó el secret?
- [ ] Verificar canales externos (Slack, email) por exposición

### Paso 2: Escalar

- [ ] Si OWNER_SECRET_KEY está en un commit: BLOQUEO INMEDIATO + git filter-branch
- [ ] Si OWNER_DECRYPTION_SECRET está expuesto: solo requiere cambio (no se usa para autenticar)
- [ ] Si la sesión fue usada: revisar todas las acciones tomadas

### Paso 3: Decidir acción

- [ ] Si fue robo activo: contención inmediata
- [ ] Si fue exposición pasiva: rotación + auditoría
- [ ] Si fue breach del owner: comunicación formal

## Mitigación

### Inmediata (< 30 min)

```bash
# 1. Rotar OWNER_SECRET_KEY
NEW_KEY=$(openssl rand -base64 48)
echo "OWNER_SECRET_KEY=$NEW_KEY" >> .env.production
railway env set OWNER_SECRET_KEY="$NEW_KEY" --service legalpro-owner-dashboard

# 2. Si fue commiteado, remover de git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch legalpro-owner-dashboard/.env" \
  --prune-empty --tag-name-filter cat -- --all

# 3. Notificar a todos los owners
```

### Corto plazo (< 24h)

- [ ] Forzar cambio de OWNER_DECRYPTION_SECRET
- [ ] Auditar TODAS las acciones del owner en últimos 30 días
- [ ] Identificar qué datos fueron accedidos
- [ ] Si se accedió a PII agregada: evaluar si es breach LPDP

### Definitiva (< 1 semana)

- [ ] Implementar JWT con expiración corta (15 min)
- [ ] Implementar refresh token con MFA
- [ ] Audit log con IP geográfica
- [ ] Alertas de login desde país nuevo
- [ ] Considerar implementar WAF
- [ ] Pentest anual obligatorio

## Compliance

- Si PII fue accedida: activar `RB-010-lpdp-breach.md`
- LPDP Art. 24: breach notification en <= 5 días hábiles
- Contractual: el owner debe notificar a LegalPro

## Comunicación

- Slack: #security + #ops (interno) + #status (público si afecta)
- Email: stakeholders
- Status page: actualizar
- ANPDP: si hay breach de PII

## Referencias

- `catalogs/owner-dashboard.json` (auth)
- `catalogs/security-policy.md`
- `tools/verifiers/verifier-owner-secrets.mjs`
- `tools/verifiers/verifier-owner-auth.mjs`
- `arneses/runbooks/RB-010-lpdp-breach.md`
