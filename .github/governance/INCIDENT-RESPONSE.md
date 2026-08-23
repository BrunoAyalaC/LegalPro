# Respuesta a Incidentes

## Niveles de severidad

| Nivel | Impacto | Tiempo de respuesta | Tiempo de resolución |
|---|---|---|---|
| P0 | Catastrófico (data breach LPDP, caída total) | 15 min | 4h |
| P1 | Alto (servicio degradado, tenant leak) | 1h | 24h |
| P2 | Medio (feature broken, spike de errores) | 4h | 3 días |
| P3 | Bajo (cosmetic, mejora) | 24h | 1 sprint |

## Roles

- **Incident Commander (IC)**: @SRE o @DevOps rota
- **Tech Lead**: stack specialist
- **Communications Lead**: @ProductOwner
- **Compliance Lead**: @GobernanzaChief (si afecta LPDP)
- **Scribe**: registra el timeline

## Proceso

### 1. Detección

- Alertas de monitor
- Reporte de usuario
- Detección interna

### 2. Triaje (5 min)

- Clasificar severidad
- Asignar IC
- Crear canal #incident-XXX en Slack
- Crear doc en `arneses/incidents/INC-XXX.md`

### 3. Mitigación (objetivo: 30 min)

- Ejecutar `arneses/runbooks/RB-XXX.md` correspondiente
- Si no hay runbook, improvisar + documentar
- **Priorizar**: el servicio vuelve antes que la causa raíz

### 4. Comunicación

- Slack: #status
- Email: lista de stakeholders
- Status page (si aplica)
- Usuarios: si el impacto es externo

### 5. Resolución

- Confirmar métricas en SLO
- Cerrar canal #incident-XXX
- Status: `Resolved`

### 6. Post-mortem (dentro de 48h)

- Blameless: enfoque en sistemas
- Timeline completo
- 5 whys
- Acciones correctivas con dueño y plazo
- Publicar en `arneses/post-mortems/PM-XXX.md`

## LPDP Breach (P0 obligatorio)

Si el incidente involucra breach de datos personales:

1. **Inmediato** (0-24h): Contener + notificar a @GobernanzaChief
2. **<= 5 días hábiles**: Notificar a la ANPDP (Ley 29733 Art. 24)
3. **<= 72h**: Si involucra datos europeos (GDPR Art. 33)
4. Comunicar a titulares afectados (Art. 25 LPDP)
5. Documentar en `arneses/post-mortems/PM-XXX-LPDP.md`

## Runbooks disponibles

Ver `arneses/runbooks/RB-001-...RB-016-...`

## Contactos de emergencia

- @SRE: 24/7
- @GobernanzaChief: para LPDP
- @DevOps: para infraestructura
- ANPDP: notificaciones@anpd.gob.pe
