# Evaluación de Riesgo de Proveedores

## Proveedores actuales

| Proveedor | Servicio | Datos tratados | Riesgo inherente | Mitigación |
|---|---|---|---|---|
| Google (Gemini) | IA generativa | PII (Nivel 3-4) con consentimiento | Alto | Cláusula contractual, SCCs, consentimiento explícito |
| Supabase | Auth + Postgres + Storage | PII (Nivel 3-4) | Alto | DPA firmado, RLS, cifrado en reposo |
| Railway | Hosting | PII (Nivel 3-4) | Alto | DPA firmado, region control, backup cifrado |
| GitHub | Code hosting | Código (Nivel 2) | Medio | MFA obligatorio, branch protection |
| Vercel/Netlify (futuro) | Frontend hosting | PII (frontend) | Bajo-Medio | Evaluar DPA |

## Criterios de evaluación

### Compliance

- [ ] DPA firmado
- [ ] DPA disponible en web
- [ ] Certificaciones: ISO 27001, SOC 2 Type II, PCI DSS (si aplica)
- [ ] Ubicación de data centers
- [ ] Sub-procesadores declarados
- [ ] Derecho de auditoría

### Seguridad

- [ ] Cifrado en tránsito (TLS 1.2+)
- [ ] Cifrado en reposo
- [ ] MFA en panel admin
- [ ] Logs de auditoría accesibles
- [ ] Programa de bug bounty

### Privacidad

- [ ] Cumple GDPR (si europeos)
- [ ] Cumple LPDP (si peruanos)
- [ ] Permite solicitar eliminación de datos
- [ ] Permite exportación de datos
- [ ] Política de retention
- [ ] Notificación de breaches <= 72h

### Operacional

- [ ] SLA >= 99.9%
- [ ] DR plan documentado
- [ ] RTO <= 4h
- [ ] RPO <= 1h
- [ ] Soporte 24/7

### Financiero

- [ ] Empresa solvente
- [ ] Historial de incidentes
- [ ] Pricing predecible

## Proceso de evaluación

1. **Pre-selección**: completar el checklist
2. **Due diligence**: revisar DPA, ToS, SLA
3. **Aprobación**: @GobernanzaChief firma
4. **Integración**: con consentimiento y logs
5. **Monitoreo**: trimestral, revisar DPA
6. **Salida**: plan documentado, portabilidad de datos

## Proveedores prohibidos

- Sin DPA
- Sin cifrado en reposo
- Sin soporte en español
- Ubicados en países sin nivel adecuado (LPDP Art. 21)
- Sin certifications reconocidas

## Cambio de proveedor

Si se decide cambiar de proveedor:
1. Plan de migración documentado
2. Exportación completa de datos
3. Periodo de transición
4. Eliminación verificada de datos del proveedor anterior
5. Auditoría post-migración
