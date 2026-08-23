# Mapeo de Compliance

## LPDP 29733 — Perú

| Articulo | Control | Verificador | Owner |
|---|---|---|---|
| Art. 4 (definiciones) | Glosario en `catalogs/glosario-juridico.md` | - | @GobernanzaChief |
| Art. 13-15 (base legal) | Catálogo de finalidades en `consentimientos.finalidades` | `verifier-lpdp.mjs` | @GobernanzaChief |
| Art. 16-17 (consentimiento) | Tabla `consentimientos` + UI de aceptación | `verifier-lpdp.mjs` | @AuditorLPDP |
| Art. 18 (registro) | `docs/REGISTRO_TRATAMIENTO_LPDP.md` | manual | @GobernanzaChief |
| Art. 19 (calidad) | Validación de input + Zod/FluentValidation | `verifier-owasp.mjs` | @AuditorSeguridad |
| Art. 20 (seguridad) | RLS + cifrado + audit log | `verifier-rls.mjs` + `verifier-lpdp.mjs` | @AuditorSeguridad |
| Art. 21 (transferencia internacional) | Flag de consentimiento + cláusula contractual | `verifier-transferencia-internacional.mjs` | @AuditorLPDP |
| Art. 22-23 (deber de información) | Política de privacidad + aviso en UI | `verifier-disclaimers.mjs` | @GobernanzaChief |
| Art. 24 (breach notification) | Proceso en `arneses/runbooks/RB-010-lpdp-breach.md` | `verifier-lpdp.mjs` | @GobernanzaChief |
| Art. 25-28 (ARCO) | Endpoints `/api/mis-datos/*` | `verifier-arco.mjs` | @AuditorLPDP |
| Art. 29 (flujos transfronterizos) | Solo a países con nivel adecuado | `verifier-transferencia-internacional.mjs` | @GobernanzaChief |
| Art. 30 (sector público) | No aplica (somos privados) | - | - |
| Art. 31 (Bancos) | No aplica (no somos banco) | - | - |
| Art. 36 (DPO) | Evaluación si aplica (>5000 PII) | manual | @GobernanzaChief |
| Art. 39-41 (sanciones) | Monitoreo de cumplimiento | - | @GobernanzaChief |
| Art. 207-A CP (penal) | Compliance estricto | - | @GobernanzaChief |

## Ley 27269 — Firma Digital

| Articulo | Control | Verificador | Owner |
|---|---|---|---|
| Art. 1-3 (firma digital equivalencia) | PKCS#7 + hash SHA-256 + TSA | `verifier-firma-digital.mjs` | @AuditorLPDP |
| Art. 4-6 (certificados digitales) | Integración con PSC autorizado | `verifier-firma-digital.mjs` | @DevOps |
| Art. 7-9 (prestadores de servicios) | Solo PSCs acreditados | manual | @DevOps |
| Art. 10-12 (uso y conservación) | Almacenamiento seguro + verificación | `verifier-firma-digital.mjs` | @AuditorLPDP |

## CPC — Código Procesal Civil (TUO D.S. 014-2020-JUS)

| Articulo | Control | Verificador | Owner |
|---|---|---|---|
| Art. 132 (buena fe procesal) | Disclaimer en cada output IA | `verifier-disclaimers.mjs` | @GobernanzaChief |
| Art. 367 (apelación) | Skill `redactar-apelacion` | `verifier-citas-legales.mjs` | @AuditorLegal |
| Art. 386 (casación) | Skill `redactar-casacion` | `verifier-citas-legales.mjs` | @AuditorLegal |
| Art. 608 (medida cautelar) | Skill `redactar-medida-cautelar` | `verifier-citas-legales.mjs` | @AuditorLegal |

## NCPP — Nuevo Código Procesal Penal (D.L. 957)

| Articulo | Control | Verificador | Owner |
|---|---|---|---|
| Art. 159 (Ministerio Público) | Rol `FISCAL` | - | @ProductOwner |
| Art. 253-272 (medidas coercitivas) | Skill `redactar-medida-cautelar` | `verifier-citas-legales.mjs` | @AuditorLegal |
| Art. 342-349 (investigación preparatoria) | Skill `analizar-expediente` (subtipo `estrategia`) | `verifier-citas-legales.mjs` | @AuditorLegal |
| Art. 352 (objeciones) | Skill `sugerir-objecion` | `verifier-citas-legales.mjs` | @AuditorLegal |
| Art. 375-376 (interrogatorio) | Skill `sugerir-pregunta-interrogatorio` | `verifier-citas-legales.mjs` | @AuditorLegal |
| Art. 387-388 (alegatos) | Skill `redactar-alegato-clausura` | `verifier-citas-legales.mjs` | @AuditorLegal |

## CP — Código Penal (D.L. 635)

| Articulo | Control | Verificador | Owner |
|---|---|---|---|
| Art. 12 (error de prohibición) | Disclaimer en outputs IA | `verifier-disclaimers.mjs` | @GobernanzaChief |
| Art. 106-108 (homicidio) | Catálogo `tipos-penales-peru.json` | `verifier-citas-legales.mjs` | @AuditorLegal |
| Art. 122-124 (lesiones) | Catálogo `tipos-penales-peru.json` | `verifier-citas-legales.mjs` | @AuditorLegal |
| Art. 170-173 (violación) | Catálogo `tipos-penales-peru.json` | `verifier-citas-legales.mjs` | @AuditorLegal |
| Art. 185-202 (patrimonio) | Catálogo `tipos-penales-peru.json` | `verifier-citas-legales.mjs` | @AuditorLegal |
| Art. 382-401 (admin. pública) | Catálogo `delitos-economicos.json` | `verifier-citas-legales.mjs` | @AuditorLegal |

## LPCL (D.L. 728) + CPCL (Ley 29497)

| Articulo | Control | Verificador | Owner |
|---|---|---|---|
| LPCL Art. 22-29 (despidos) | Skill `redactar-demanda` (laboral) | `verifier-citas-legales.mjs` | @AuditorLegal |
| CPCL Art. 17-32 (procedimiento) | Skill `analizar-expediente` | `verifier-citas-legales.mjs` | @AuditorLegal |

## CTS (D.L. 650) + Gratificaciones (Ley 27735)

| Articulo | Control | Verificador | Owner |
|---|---|---|---|
| CTS Art. 1-21 (cálculo) | Skill `liquidar-laboral` | `verifier-citas-legales.mjs` | @AuditorLegal |
| Grat. Art. 1-8 | Skill `liquidar-laboral` | `verifier-citas-legales.mjs` | @AuditorLegal |

## IGV (TUO D.S. 055-99-EF) + IR (TUO D.S. 179-2004-EF)

| Articulo | Control | Verificador | Owner |
|---|---|---|---|
| IGV Art. 1-44 | Skill `liquidar-tributario` | `verifier-citas-legales.mjs` | @AuditorLegal |
| IR Art. 1-105 | Skill `liquidar-tributario` | `verifier-citas-legales.mjs` | @AuditorLegal |

## OWASP Top 10 2021

| Item | Control | Verificador | Owner |
|---|---|---|---|
| A01 Broken Access Control | Multi-tenant + RBAC + RLS | `verifier-multi-tenant.mjs` + `verifier-rbac.mjs` + `verifier-rls.mjs` | @AuditorMultiTenant |
| A02 Cryptographic Failures | HTTPS + bcrypt + pgcrypto | `verifier-secretos.mjs` | @AuditorSeguridad |
| A03 Injection | Validación + queries parametrizadas | `verifier-owasp.mjs` | @AuditorSeguridad |
| A04 Insecure Design | Plan limits + idempotencia | `verifier-quota.mjs` + `verifier-idempotencia.mjs` | @AuditorSeguridad |
| A05 Security Misconfiguration | Security headers + CORS | `verifier-owasp.mjs` | @AuditorSeguridad |
| A06 Vulnerable Components | Trivy + Dependabot | `verifier-deps.mjs` | @DevOps |
| A07 Auth Failures | JWT + brute force + MFA | `verifier-brute-force.mjs` | @AuditorSeguridad |
| A08 Data Integrity | Audit log inmutable | `verifier-audit.mjs` | @AuditorSeguridad |
| A09 Logging Failures | Serilog + masking | `verifier-masking.mjs` | @AuditorSeguridad |
| A10 SSRF | Whitelist de URLs | manual | @IntegracionesPeru |

## ISO 27001 (en roadmap)

| Control | Implementación | Verificador |
|---|---|---|
| A.9.4.1 (Access Control) | Auth + RBAC | `verifier-rbac.mjs` |
| A.12.4 (Logging) | Audit log | `verifier-audit.mjs` |
| A.13.1.1 (Network Security) | TLS + CORS | `verifier-owasp.mjs` |
| A.16.1 (Incident Management) | `arneses/runbooks/` | manual |

## Auditoría periódica

| Frecuencia | Acción | Owner |
|---|---|---|
| Diaria | `verifier-lpdp.mjs` + `verifier-multi-tenant.mjs` en CI | CI |
| Semanal | Revisar DPA de proveedores | @GobernanzaChief |
| Mensual | Auditoría completa (22 verificadores) | @AuditorSeguridad |
| Trimestral | Revisión de catálogos legales | @AuditorLegal |
| Anual | Pentest externo | @DevOps + @AuditorSeguridad |
| Anual | Revisión de la política de compliance | @GobernanzaChief |
