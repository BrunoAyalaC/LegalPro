# 🚀 GUÍA DE GO-LIVE — LegalPro Alfa Monetizable

> **Audiencia:** Equipo de LegalPro  
> **Fecha objetivo:** Antes del primer cliente pagante  
> **Tiempo estimado total:** 6-8 horas

---

## ✅ CHECKLIST PRE-DEPLOY (2 horas)

### 1. ROTACIÓN DE SECRETOS COMPROMETIDOS (CRÍTICO)
El archivo `datos.txt` (eliminado el 2026-08-01) contenía 4 secretos. Estos DEBEN rotarse:

- [ ] **MiniMax API Key** (MiniMax Dashboard → API Keys → Revoke + Regenerate)
- [ ] **DATABASE_URL password** (Railway → PostgreSQL → Reset Password)
- [ ] **GEMINI_API_KEY** (Google Cloud Console → Credentials → Revoke + Create New)
- [ ] **JWT_SECRET** (Local: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)

**Después de rotar, actualizar en Railway:**
```bash
railway variables --set JWT_SECRET=<nuevo>
railway variables --set MiniMax_API_KEY=<nuevo>
railway variables --set GEMINI_API_KEY=<nuevo>
railway variables --set DATABASE_URL=<nuevo>
```

**INVALIDAR todas las sesiones existentes:**
```sql
UPDATE refresh_tokens SET revoked = true, revoked_reason = 'INC-2026-08-01-SECRET-EXPOSURE' WHERE NOT revoked;
```

### 2. EJECUTAR MIGRACIONES DE HARDENING
- [ ] Backup completo: `pg_dump -Fc -d legalpro -f backup_pre_$(date +%F).dump`
- [ ] Migración MT-03: `psql $DATABASE_URL_SUPERUSER -v ON_ERROR_STOP=1 -f tools/migrations/2026-08-01-multitenant-hardening.sql`
- [ ] Migración LPDP-3.5: `psql $DATABASE_URL_SUPERUSER -v ON_ERROR_STOP=1 -f tools/migrations/2026-08-01-consent-history.sql`
- [ ] Verificar: `psql -c "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname LIKE 'legalpro%'"`
- [ ] Verificar: `psql -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'"`

### 3. ACTUALIZAR CREDENCIALES DE APLICACIÓN
- [ ] Backend Node: actualizar DATABASE_URL para usar `legalpro_node` (no postgres)
- [ ] Backend .NET: actualizar DATABASE_URL para usar `legalpro_dotnet` (no postgres)
- [ ] Redesplegar: `railway up --service legalpro-backend-node`
- [ ] Redesplegar: `railway up --service legalpro-backend-dotnet`

### 4. COMPLETAR DATOS DEL DPO
- [ ] Editar `docs/DPO_DESIGNACION.md` con nombre y teléfono REALES del DPO
- [ ] Actualizar `legalpro-app/docs/POLITICA_PRIVACIDAD.md` con datos reales
- [ ] Configurar `dpo@legalpro.app` (Google Workspace o similar)

---

## ✅ CHECKLIST DE TESTING (2 horas)

### 5. EJECUTAR 29 VERIFICADORES
```bash
cd legalpro-app
npm run verify:all
```
**Esperado:** 27/27 PASS (alfa monetizable)

### 6. EJECUTAR TESTS CROSS-TENANT
```bash
npm run test:cross-tenant
```
**Esperado:** 15+ tests PASS

### 7. EJECUTAR SMOKE TEST FINAL
```bash
node smoke-production-final.mjs
```
**Esperado:** 10+ checks PASS

### 8. TESTS MANUALES (10 casos críticos)
- [ ] Registro → Onboarding → Crear organización
- [ ] Login con MFA
- [ ] Crear expediente → Subir documento → Consulta IA
- [ ] Comprar créditos (Stripe y Culqi)
- [ ] Invitar miembro al equipo
- [ ] Solicitar ARCO (exportar datos)
- [ ] Revocar consentimiento
- [ ] Buscar jurisprudencia en 5 fuentes
- [ ] Panel de expertos multi-agente
- [ ] Logout + invalidación de sesión

---

## ✅ CHECKLIST DE CONFIGURACIÓN (1 hora)

### 9. RAILWAY
- [ ] Variables de entorno configuradas (verificar `tools/release/VARIABLES-1.0.4.sh`)
- [ ] Health checks respondiendo
- [ ] CRON jobs configurados (Railway Dashboard → CRON)
- [ ] Dominio custom configurado (legalpro.app)
- [ ] SSL/TLS automático activo
- [ ] Backups automáticos cada 24h

### 10. STRIPE
- [ ] Webhook URL configurado: `https://api.legalpro.app/webhooks/stripe`
- [ ] Eventos suscritos: subscription.*, invoice.*, charge.*
- [ ] STRIPE_WEBHOOK_SECRET en variables

### 11. CULQI
- [ ] API keys configuradas (test + prod)
- [ ] Webhook configurado (si aplica)

### 12. SENTRY
- [ ] DSN del backend Node configurado
- [ ] DSN del backend .NET configurado
- [ ] Alertas configuradas (error rate, performance)

### 13. SUPABASE
- [ ] Auth funcionando (login, MFA, recuperación)
- [ ] Storage configurado (bucket documentos)
- [ ] RLS policies activas

### 14. GOOGLE CLOUD (Gemini)
- [ ] API Key con restricción de IP (Railway IPs)
- [ ] Cuota configurada

### 15. MINIMAX
- [ ] API Key activa
- [ ] Cuota configurada según plan

---

## ✅ CHECKLIST LEGAL Y COMPLIANCE (30 min)

### 16. LPDP (Ley 29733)
- [ ] Política de Privacidad publicada (legalpro.app/privacidad)
- [ ] Términos y Condiciones publicados (legalpro.app/terminos)
- [ ] DPO designado y contactable
- [ ] Registro de Tratamiento actualizado (docs/REGISTRO_TRATAMIENTO_LPDP.md)
- [ ] Transferencia Internacional documentada (docs/TRANSFERENCIA_INTERNACIONAL.md)
- [ ] Breach Notification documentado (docs/BREACH_NOTIFICATION_2026-08-01.md)

### 17. INDECOPI
- [ ] Si aplica: Registro de marca "LegalPro"
- [ ] Si aplica: Registro de software en Indecopy

---

## ✅ CHECKLIST DE MONETIZACIÓN (1 hora)

### 18. PAGOS
- [ ] Planes publicados en landing (FREE/PRO/ENTERPRISE)
- [ ] Stripe configurado para cobros recurrentes
- [ ] Culqi configurado para cobros Perú
- [ ] Límites de plan aplicados en código:
  - [ ] `max_expedientes` por plan
  - [ ] `max_usuarios` por plan
  - [ ] `max_consultas_ia_mes` por plan

### 19. ONBOARDING CLIENTE
- [ ] Flujo signup → setup → onboarding completo
- [ ] Email de bienvenida configurado (SendGrid/Resend)
- [ ] Tour in-app activado
- [ ] Documentación de ayuda publicada

### 20. DASHBOARD OWNER
- [ ] Métricas de costos IA funcionando
- [ ] Lista de tenants visible
- [ ] Audit log consultable
- [ ] Acciones de suspender/reactivar tenant operativas

---

## ✅ CHECKLIST DE LANZAMIENTO (30 min)

### 21. COMUNICACIÓN
- [ ] Email a lista de espera / early adopters
- [ ] Publicación en redes sociales (LinkedIn, Twitter)
- [ ] Blog post de lanzamiento
- [ ] Press release a medios especializados

### 22. SOPORTE
- [ ] Equipo de soporte preparado
- [ ] KB (knowledge base) publicada
- [ ] Canal de Slack/Discord para clientes beta
- [ ] SLA documentado por plan

### 23. MONITOREO POST-LAUNCH
- [ ] Dashboards de Grafana/Datadog configurados
- [ ] Alertas de SLO configuradas
- [ ] Runbooks operacionales publicados
- [ ] On-call rotation definida

---

## 🎯 CRITERIO DE ÉXITO

**El sistema está listo para alfa monetizable cuando:**
- ✅ Todos los checks P0 completados
- ✅ Score global >= 90/100 en los 4 dimensiones
- ✅ 100% de los verificadores PASS
- ✅ 0 errores críticos en logs
- ✅ Primer cliente pagado usa el sistema sin issues

---

## 📞 CONTACTOS DE EMERGENCIA

| Rol | Contacto |
|---|---|
| Tech Lead | tech@legalpro.app |
| DPO | dpo@legalpro.app |
| Security | security@legalpro.app |
| Soporte | soporte@legalpro.app |

---

**Versión:** 1.0  
**Fecha:** 1 de agosto de 2026  
**Próxima revisión:** Post-go-live (T+7 días)
