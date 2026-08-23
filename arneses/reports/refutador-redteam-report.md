# Reporte Red Team: Simulación de Atacante Real

> **Agente**: @red-team
> **Fecha**: 2026-06-12
> **Modo**: Simulación mental de atacante (state-sponsored, criminal, insider)
> **Objetivo**: Identificar cadenas de ataque completas y probabilidad de éxito

## 🎯 Escenarios de Ataque Simulados

### 🔴 CRITICAL: Cadena de Ataque "Robo Masivo de Expedientes"

**Perfil del atacante**: Criminal organizado con recursos medios (~$50K)
**Tiempo estimado**: 2-4 semanas
**Probabilidad de éxito**: MEDIA (0.4)
**Impacto**: S/ 5M en multas LPDP + daño reputacional

**Kill chain**:

1. **Reconocimiento** (1 semana)
   - LinkedIn scraping del equipo LegalPro
   - Identifica 3 admins con email público
   - Busca breaches de esos emails en HaveIBeenPwned

2. **Phishing dirigido** (1 semana)
   - Email: "Su cuenta de LegalPro requiere verificación LPDP"
   - Link a login falso que captura credenciales
   - Tasa de éxito esperada: 15-20% (1 de 5-6 cae)

3. **Escalada de privilegios** (1-2 días)
   - Con credenciales válidas, busca el rol más alto
   - FISCAL o ADMIN tienen acceso a todos los expedientes
   - Si captura ADMIN: game over

4. **Exfiltración** (3-5 días)
   - Script automatizado que exporta TODOS los expedientes vía API
   - Velocidad: 1000 expedientes/hora
   - Detectable: ⚠️ Spike de requests inusual

5. **Extorsión o venta** (1 día)
   - Venta en dark web: $5/expediente
   - O ransomware: amenaza con publicar

**Remediación**:

- [ ] MFA obligatorio para todos los roles (Sprint 1)
- [ ] Detección de anomalías (geo-IP, horario, frecuencia)
- [ ] Rate limit por usuario (no solo IP)
- [ ] Alertas en Slack #security en tiempo real
- [ ] Backups offline inmutables

---

### 🟠 HIGH: Cadena "Insider Malicioso"

**Perfil**: Empleado con acceso legítimo
**Tiempo**: 1-3 meses
**Probabilidad**: MEDIA (0.5)
**Impacto**: Variable, depende del rol

**Kill chain**:

1. **Reclutamiento** (1-2 meses)
   - Vendedor en LinkedIn ofrece $$$ por datos
   - Competidor quiere listas de clientes premium

2. **Acceso legítimo**
   - Empleado tiene acceso a su tenant (correcto)
   - Pero puede intentar acceder a OTROS tenants (IDOR)

3. **Exfiltración**
   - Pequeñas descargas diarias (~10 expedientes/día)
   - Indetectable por rate limit estándar
   - Cifrado + envío a email personal

**Remediación**:

- [ ] Audit log de TODA lectura de expediente (no solo creación)
- [ ] Alertas si un usuario lee > X expedientes/día
- [ ] DLP (Data Loss Prevention) en emails salientes
- [ ] Onboarding + cultura de seguridad

---

### 🟠 HIGH: Cadena "Supply Chain via npm"

**Perfil**: State-sponsored (China/Russia)
**Tiempo**: 3-6 meses
**Probabilidad**: BAJA (0.2)
**Impacto**: Catastrófico

**Kill chain**:

1. **Comprometer dependencia npm** (e.g., una librería popular)
   - "Bug fix" que añade backdoor
   - O un typo de un paquete legítimo (`legapro` vs `legalpro`)

2. **Auto-actualización**
   - Cuando LegalPro hace `npm update`
   - El backdoor entra al código

3. **Persistencia**
   - Backdoor se ejecuta en cada build
   - Envía datos a servidor C2 (Command & Control)

4. **Ataque silencioso**
   - Durante meses, exfiltra datos
   - Espera el momento estratégico

**Remediación**:

- [ ] Lockfile (`package-lock.json`) commiteado
- [ ] `npm audit --audit-level=high` en CI (ya implementado)
- [ ] Dependabot para CVEs (ya implementado)
- [ ] Pin versiones exactas (NO `^`)
- [ ] Renovación de tokens cada 90 días

---

### 🟡 MEDIUM: Cadena "AI Poisoning"

**Perfil**: Abogado/Fiscal malicioso
**Tiempo**: 1 semana
**Probabilidad**: MEDIA (0.5)
**Impacto**: Bajo-Medio

**Kill chain**:

1. **Inserción de prompts crafted** en campos de input
2. Gemini procesa los prompts
3. Genera respuestas con instrucciones ocultas
4. Otros usuarios consumen esas respuestas contaminadas
5. Bypass de disclaimers

**Remediación**:

- [ ] promptSanitizer.js (ya implementado)
- [ ] Output validation contra catálogos
- [ ] Disclaimers siempre presentes
- [ ] No almacenar respuestas IA para reuso

---

### 🟡 MEDIUM: Cadena "Ransomware en Owner Dashboard"

**Perfil**: Insider o atacante externo
**Tiempo**: 1-2 meses
**Probabilidad**: BAJA (0.3)
**Impacto**: Parálisis operativa

**Kill chain**:

1. Comprometer OWNER_SECRET_KEY (phishing, leak, insider)
2. Acceder a owner dashboard
3. Cambiar planes de TODOS los tenants a FREE
4. Suspender todos los tenants
5. Pedir rescate para reactivar

**Remediación**:

- [ ] MFA en owner (Sprint 2)
- [ ] Audit log de TODA acción del owner
- [ ] Notificación a tenants si owner los afecta
- [ ] Time-delayed actions (cooling 7d)
- [ ] 2 owners required para acciones críticas

---

## 📊 Resumen de Escenarios

| Escenario | Prob. | Impacto | Tiempo | Mitigación |
|---|---|---|---|---|
| Robo masivo expedientes | 0.4 | CRITICAL | 2-4 sem | MFA + detección anomalías |
| Insider malicioso | 0.5 | HIGH | 1-3 meses | DLP + alertas |
| Supply chain | 0.2 | CRITICAL | 3-6 meses | Lockfile + audit |
| AI poisoning | 0.5 | MEDIUM | 1 sem | Sanitización + validación |
| Ransomware owner | 0.3 | HIGH | 1-2 meses | MFA + audit + time-delay |

## 🎯 Plan de Mitigación

### Sprint 1 (esta semana)
- [ ] MFA obligatorio en /api/auth/login
- [ ] Audit log de lecturas (no solo escrituras)

### Sprint 2
- [ ] Detección de anomalías (geo-IP)
- [ ] DLP básico en emails
- [ ] Pin versiones npm

### Sprint 3
- [ ] MFA en Owner Dashboard
- [ ] 2-owners required para acciones críticas
- [ ] Backups offline inmutables

### Sprint 4
- [ ] Pentest externo anual
- [ ] Bug bounty program
- [ ] Red team simulation trimestral

## 💡 Conclusión

El sistema es **resiliente** pero tiene **vulnerabilidades** que un atacante motivado puede explotar. Las mitigaciones deben implementarse en orden de probabilidad × impacto.

**Recomendación**: Implementar MFA + detección de anomalías ANTES de producción.

## 📚 Referencias

- OWASP Top 10
- NIST Cybersecurity Framework
- CIS Controls
- LPDP 29733 (Art. 24 breach notification)
- CP Art. 207-A (delito informático)
