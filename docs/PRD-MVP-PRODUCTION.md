# PRD: LegalPro MVP Production-Ready v1.0

> **Versión**: 1.0.0
> **Fecha**: 2026-06-12
> **Owner**: @product-owner
> **Estado**: Draft -> Aprobado (firma @arquitecto-chief + @gobernanza-chief + @release-manager)
> **Arnés aplicado**: Los 96 agentes, 25 verificadores, 22 catálogos

## 1. Problema

Los abogados, fiscales, jueces y contadores peruanos necesitan:
- Análisis jurídico con IA verificable (sin alucinaciones)
- Redacción de escritos legales con formato del PJ
- Búsqueda de jurisprudencia vinculante
- Predicción de resultados con disclaimers
- Gestión documental con cadena de custodia
- Cumplimiento LPDP 29733

## 2. Usuarios Primarios

| Rol | Mega-Área | Necesidad Principal |
|---|---|---|
| ABOGADO (13 herram.) | Civil/Penal/Laboral | Análisis + redacción + estrategia |
| FISCAL (10 herram.) | Penal | Investigación + acusación |
| JUEZ (8 herram.) | Constitucional | Análisis imparcial + predictores |
| CONTADOR (5 herram.) | Tributario/Laboral | Liquidaciones + peritajes |

## 3. Solución Propuesta

Plataforma multi-tenant con 16 herramientas IA legales, frontend React 19 + Android Kotlin, backend Node 20 + .NET 8, PostgreSQL 15 con RLS, MiniMax AI con Function Calling, cumplimiento LPDP nativo.

## 4. User Stories (Top 10)

### US-1: Analizar Expediente
**Como** ABOGADO
**Quiero** analizar un expediente judicial con IA
**Para** identificar fortalezas, debilidades, riesgos y estrategia
**Aceptación**:
- Análisis en < 3s (p95)
- Citas verificadas contra catálogos
- 4 disclaimers IA presentes
- Audit log completo

### US-2: Redactar Demanda
**Como** ABOGADO
**Quiero** generar una demanda civil con formato del PJ
**Para** ahorrar tiempo en redacción
**Aceptación**:
- Formato del PJ peruano
- Citas verificadas con link a SPIJ
- Petitorio + fundamentación
- Disclaimer de verificación obligatoria pre-presentación

### US-3: Buscar Jurisprudencia
**Como** ABOGADO
**Quiero** buscar jurisprudencia vinculante en 5 fuentes
**Para** fundamentar escritos
**Aceptación**:
- 5 fuentes: PJ, TC, INDECOPI, SUNARP, MINJUS
- Cita exacta con número de expediente
- Ratio decidendi vs obiter dicta
- Link a SPIJ

### US-4: Predecir Resultado
**Como** ABOGADO
**Quiero** predecir resultado de un caso
**Para** tomar decisiones informadas
**Aceptación**:
- Probabilidad favorable/desfavorable/incierto
- Disclaimer obligatorio (NO es certeza)
- Basado en +50K sentencias
- Latencia p95 < 4s

### US-5: Liquidar CTS
**Como** CONTADOR
**Quiero** liquidar CTS al cese
**Para** calcular monto correcto
**Aceptación**:
- Tasa BCRP vigente aplicada
- Aportes AFP/ONP correctos
- Topes respetados
- Exportable a PDF con firma digital

### US-6: Gestionar Organización
**Como** dueño de firma
**Quiero** invitar miembros a mi organización
**Para** colaborar con mi equipo
**Aceptación**:
- Multi-tenant estricto
- RBAC: OWNER > ADMIN > MEMBER > VIEWER
- RLS en todas las tablas
- Audit log de cada acción

### US-7: Exportar Mis Datos (ARCO)
**Como** usuario
**Quiero** exportar todos mis datos
**Para** ejercer mi derecho ARCO
**Aceptación**:
- Export en JSON y PDF
- Incluir TODOS mis datos (perfil, expedientes, mensajes)
- Plazo <= 8 días hábiles LPDP
- Confirmación por email

### US-8: Eliminar Mi Cuenta
**Como** usuario
**Quiero** eliminar mi cuenta
**Para** ejercer derecho de cancelación
**Aceptación**:
- Soft-delete con retention de 90 días
- Hard-delete después de 90 días
- Notificación a terceros con quienes compartí datos
- Audit log

### US-9: Recibir Notificaciones del SINOE
**Como** ABOGADO
**Quiero** recibir notificaciones electrónicas del PJ
**Para** enterarme de plazos y resoluciones
**Aceptación**:
- Polling cada 15 min
- Notificación push
- Plazos críticos destacados
- Audit log

### US-10: Simular Juicio Oral
**Como** estudiante de derecho
**Quiero** simular una audiencia con IA
**Para** practicar
**Aceptación**:
- IA como juez/fiscal/testigo
- Scoring 1-10 por turno
- Feedback al final
- Disclaimer de entrenamiento

## 5. Out of Scope (v1.0)

- Multi-idioma (solo es-PE)
- Marketplace de profesionales
- Integración nativa con PJ (mock-first)
- Pagos reales (solo plan FREE/PRO/ENTERPRISE con Stripe)
- iOS (solo Android + Web)
- White-label para otros estudios

## 6. KPIs / Métricas de éxito

### North Star
- **MAU activos con uso IA** >= 1,000 en 3 meses
- **Retention D30** >= 40%

### Secundarias
- **Latencia p95** < 500ms (no IA), < 3s (IA)
- **Cobertura tests** >= 80%
- **Cumplimiento LPDP** score 4/4
- **Costo IA por request** < $0.10
- **Errores 5xx** < 0.1%
- **CSAT** >= 4.0/5.0

## 7. Criterios de aceptación

- [ ] Los 22 verificadores en verde
- [ ] 5 roles demo funcionales (ABOGADO, FISCAL, JUEZ, CONTADOR, ADMIN)
- [ ] 16 herramientas IA operativas con citas verificadas
- [ ] Android 5+ pantallas funcionales
- [ ] Owner Dashboard con mutaciones
- [ ] Cumplimiento LPDP 4/4
- [ ] Auditoría de seguridad pasada
- [ ] Performance < SLOs
- [ ] 0 secrets en código
- [ ] Cross-tenant leaks = 0

## 8. Definition of Done (DoD)

- [ ] PRD aprobado
- [ ] ADRs firmados
- [ ] Tests pasan (unit + integration + e2e)
- [ ] Coverage >= 80%
- [ ] Auditorías de seguridad + LPDP + legal + performance
- [ ] Documentación actualizada
- [ ] Smoke test post-deploy
- [ ] 3 sign-offs de chiefs
- [ ] CHANGELOG.md actualizado

## 9. Dependencias

### Críticas
- MiniMax API
- Supabase (PostgreSQL + Auth + Storage)
- Railway (hosting)
- BCRP API (tasas de interés)

### Opcionales
- Stripe (pagos)
- Twilio (SMS)
- Resend (email)

## 10. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| MiniMax obsolescencia | Media | Alto | `verifier-deprecation-modelos.mjs` + migración rápida |
| Cross-tenant leak | Baja | CRÍTICO | `verifier-multi-tenant.mjs` + tests E2E + RLS |
| LPDP breach | Baja | CRÍTICO | RB-010 + notificación ANPDP <= 5d |
| Spike costo IA | Media | Alto | `verifier-cost-spike.mjs` + alertas |
| PG down | Baja | Alto | RB-006 + Railway + read replica |
| Refutadores encuentren hueco | Alta | Bajo | Catálogo de refutadores + RB-XXX |

## 11. Estimación

- **Sprint 1** (2 sem): Validación - 80% ya implementado
- **Sprint 2** (2 sem): Backend + Owner - refinar al 100%
- **Sprint 3** (4 sem): Android + Frontend - implementar Android
- **Sprint 4** (2 sem): Producción - deploy gradual

**Total**: 10-12 semanas para MVP production-ready

## 12. Compliance Mapping

- **LPDP 29733**: consentimiento, ARCO, transferencia, firma, retention
- **Ley 27269**: firma digital con PKCS#7
- **OWASP Top 10**: 10 categorías cubiertas
- **NCPP/CPC/CC/CP**: catálogos canónicos
- **LOPJ art. 290**: deber de fundamentación en outputs
- **CPC art. 132**: buena fe procesal
- **CPP art. IX**: principio de legalidad

## 13. Agentes Involucrados

### Mando (3)
- @arquitecto-chief: Aprueba arquitectura
- @gobernanza-chief: Aprueba compliance
- @product-owner: Este PRD

### Implementación (10)
- @backend-dotnet, @backend-node, @frontend, @android
- @database, @devops, @sre
- 3 senior: @abogado-senior-civil, @abogado-senior-penal, @contador-senior-tributario

### Auditoría (8)
- 8 auditores estándar
- 6 refutadores adversariales (paranoid mode)

### Owner (5)
- @owner-admin, @plataforma-finanzas, @soporte-cliente, @marketing-growth, @ux-ui

## 14. Firmas Requeridas

- [ ] @arquitecto-chief: ____
- [ ] @gobernanza-chief: ____
- [ ] @release-manager: ____
- [ ] @product-owner: ____
