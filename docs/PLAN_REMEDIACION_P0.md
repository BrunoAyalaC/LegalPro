# PLAN DE REMEDIACION P0 - Frontend LegalPro

> Fecha: 1 de agosto de 2026
> Sprint objetivo: 1-2 (1-2 semanas con 2 ingenieros)
> Esfuerzo total estimado: 84-110 horas

## Indice de Issues por Prioridad

### BLOQUEADORES P0 (DEBEN resolverse antes de go-live)
1. BovedaEvidencia es MOCK (12-16h)
2. MonitorSinoe es MOCK (8-10h)
3. Login JWT en localStorage (6-8h)
4. IADisclaimerModal solo 1 de 4 disclaimers (2-3h)
5. Modales sin focus trap - 8/8 (8-10h)
6. Modales sin role="dialog" - 6/8 (3-4h)
7. WizardShell bug handleCancel (0.5h)
8. CommandPalette Ctrl+K no funciona (1-2h)

**Total: 84-110 horas / 2 semanas**

---

## Issue #1: BovedaEvidencia es MOCK (P0 BLOQUEANTE)

**Archivo**: `legalpro-app/src/pages/BovedaEvidencia.jsx` (34 lineas hardcoded)

**Problema**: Pagina completamente simulada con datos hardcoded, boton "Agregar Evidencia" sin handler.

**Solucion**:
```jsx
// Implementar componentes:
- FileUpload con drag-drop usando react-dropzone
- Calculo SHA-256 client-side usando crypto.subtle
- Lista de evidencias con paginacion real
- Modal de detalle de evidencia
- Export PDF de custodia (Ley 27269)
- Cadena de custodia con timestamps inmutables
- Integracion con backend: GET/POST /api/evidencia

// Servicios:
- evidenceUpload(file, expedienteId)
- evidenceVerify(sha256)
- evidenceExportPDF(evidenciaId)
```

**Endpoints backend a implementar**:
- POST /api/evidencia (subir)
- GET /api/evidencia?expediente_id=...
- GET /api/evidencia/:id
- GET /api/evidencia/:id/pdf (custodia)
- POST /api/evidencia/:id/verify

**Estimado**: 12-16 horas (1 ingeniero)

**Criterio de aceptacion**:
- Drag-drop funcional
- Hash SHA-256 calculado client-side
- Upload a backend real
- PDF de custodia generado
- Tests E2E del flujo completo

---

## Issue #2: MonitorSinoe es MOCK (P0 BLOQUEANTE)

**Archivo**: `legalpro-app/src/pages/MonitorSinoe.jsx` (39 lineas hardcoded)

**Problema**: Pagina completamente simulada, sin conexion real al SINOE.

**Solucion**:
```jsx
// Implementar:
- Polling cada 30s al backend
- Notificaciones reales del SINOE
- Estado de casillas especificas del usuario
- Alertas cuando hay notificaciones nuevas
- Filtros (fecha, tipo notificacion, expediente)
- Accion "Marcar como leida"

// Backend:
- GET /api/sinoe/notificaciones (paginado)
- POST /api/sinoe/notificaciones/:id/leida
- GET /api/sinoe/status (resumen)
- GET /api/sinoe/expedientes/mis-casillas
```

**Estimado**: 8-10 horas (1 ingeniero)

**Criterio de aceptacion**:
- Conexion real al backend
- Polling automatico
- Notificaciones se marcan como leidas
- Filtros funcionan

---

## Issue #3: Login JWT en localStorage (P0 SEGURIDAD)

**Archivos**: 
- `src/pages/Landing.jsx` (lineas 12, 21)
- `src/pages/SetupOrganizacion.jsx` (linea 261)
- `src/context/TenantContext.tsx`

**Problema**: JWT almacenado en localStorage, vulnerable a XSS token theft. Viola regla BackendNode #8.

**Solucion**:
```jsx
// Paso 1: Backend - Set httpOnly cookie on login (legalpro-app/server/routes/auth.js)
// const { accessToken, refreshToken } = await issueTokens(req.user);
// res.cookie('__Secure-Session', accessToken, { httpOnly, secure, sameSite: 'Lax', path: '/' });

// Paso 2: Frontend - Remove localStorage JWT logic
// - TenantContext.tsx: Remove localStorage JWT reading
// - SetupOrganizacion.jsx: Use httpOnly cookie via fetch (credentials: 'include')
// - Landing.jsx: Remove localStorage redirect logic

// Paso 3: Update api/client.ts
// - Interceptor Axios withCredentials: true
// - Remove Authorization header manual injection
```

**Estimado**: 6-8 horas

**Riesgo**: ALTO - XSS vulnerability real

---

## Issue #4: IADisclaimerModal solo 1 de 4 disclaimers (P0 LPDP)

**Archivo**: `legalpro-app/src/components/IADisclaimerModal.jsx`

**Problema**: Solo muestra 1 disclaimer. Debe mostrar 4 segun catalogos/disclaimers-ia.json

**Solucion**:
```jsx
// Cargar disclaimers desde catalogs/disclaimers-ia.json
import { DISCLAIMERS_OBLIGATORIOS } from '../constants/disclaimers-ia';

// Renderizar los 4:
const DISCLAIMERS = [
  'Respuesta generada por IA, NO constituye asesoria legal.',
  'Validar con abogado colegiado antes de decisiones legales.',
  'Informacion proviene de fuentes oficiales, puede cambiar.',
  'Verificar citas consultando fuentes oficiales.'
];

// Agregar provider badge (Minimax M3 o Gemini)
// Agregar indicador de transferencia internacional
```

**Estimado**: 2-3 horas

---

## Issue #5: Modales sin focus trap - 8/8 (P0 ACCESIBILIDAD)

**Archivos**:
- `Login.jsx` (ResetPasswordModal)
- `IADisclaimerModal.jsx`
- `Expedientes.jsx` (modal crear/editar inline)
- `Clientes.jsx` (modal crear/editar inline)
- `OnboardingTour.jsx`
- `FilterPanel.jsx`
- `WizardShell.jsx`
- `CommandPalette.jsx`

**Problema**: 8/8 modales sin focus trap. Usuarios de teclado quedan atrapados fuera del modal.

**Solucion**:
```jsx
// Opcion 1: Usar library (recomendado)
// npm install focus-trap-react

// Opcion 2: Custom hook
function useFocusTrap(ref) {
  useEffect(() => {
    if (!ref.current || !ref.current.hasAttribute('open')) return;
    
    const focusable = ref.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    
    first.focus();
    
    function handler(e) {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);
}
```

**Estimado**: 8-10 horas (implementar hook + aplicar a 8 modales)

---

## Issue #6: Modales sin role="dialog" - 6/8 (P0 ACCESIBILIDAD)

**Archivos**: Mismos que #5

**Solucion**:
```jsx
// Agregar a TODOS los modales:
<div 
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <h2 id="modal-title">{title}</h2>
  ...
</div>
```

**Estimado**: 3-4 horas

---

## Issue #7: WizardShell bug handleCancel (P0 BLOQUEANTE MENOR)

**Archivo**: `legalpro-app/src/components/wizards/WizardShell.jsx`

**Problema**: `handleCancel` se referencia en `useEffect` antes de declararse:
```jsx
useEffect(() => {
  if (pendingCancel) handleCancel(); // ❌ ReferenceError
}, [handleCancel]); // ❌ Orden incorrecto

const handleCancel = useCallback(() => { ... });
```

**Solucion**:
```jsx
// Mover useCallback ANTES de useEffect:
const handleCancel = useCallback(() => { ... }, [pendingCancel]);

useEffect(() => {
  if (pendingCancel) handleCancel();
}, [pendingCancel, handleCancel]);
```

**Estimado**: 0.5 horas (30 minutos)

---

## Issue #8: CommandPalette Ctrl+K no funciona (P0 BLOQUEANTE MENOR)

**Archivo**: `legalpro-app/src/components/CommandPalette.jsx`

**Problema**: Ctrl+K dispatcha evento `lp:openCommand` que NADIE escucha.

**Solucion**:
```jsx
// En CommandPalette.jsx, AGREGAR listener global:
useEffect(() => {
  function handler(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen(true);
    }
  }
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, []);
```

**Estimado**: 1-2 horas

---

## Resumen de Esfuerzo Sprint 1

| # | Issue | Horas | Prioridad |
|---|-------|------:|-----------|
| 1 | BovedaEvidencia MOCK | 12-16 | P0 |
| 2 | MonitorSinoe MOCK | 8-10 | P0 |
| 3 | JWT localStorage | 6-8 | P0 |
| 4 | IADisclaimer 1/4 | 2-3 | P0 |
| 5 | Modales focus trap | 8-10 | P0 |
| 6 | Modales role="dialog" | 3-4 | P0 |
| 7 | WizardShell bug | 0.5 | P0 |
| 8 | CommandPalette Ctrl+K | 1-2 | P0 |
| **TOTAL** | | **84-110 horas** | **2 semanas con 2 ingenieros** |

---

## Sprint 2 (P1) - Mejoras Recomendadas

| # | Issue | Horas |
|---|-------|------:|
| 9 | ConfirmModal no montado en App.jsx | 1 |
| 10 | Signup encoding UTF-8 | 2 |
| 11 | QR MFA real (no simulado) | 4 |
| 12 | Captcha en Login | 4 |
| 13 | Persistencia filtros en URL | 6 |
| 14 | Implementar prefers-reduced-motion | 3 |
| 15 | Suite tests componentes UI | 16 |
| 16 | Validacion aria-invalid en forms | 3 |
| **TOTAL** | | **39 horas (~1 semana)** |

---

## Sprint 3 (P2) - Nice-to-have

| # | Issue | Horas |
|---|-------|------:|
| 17 | Service Worker PWA | 8 |
| 18 | Bundle size optimization | 4 |
| 19 | Eliminar @tsparticles no usado | 1 |
| 20 | Critical CSS extraction | 4 |
| 21 | Image optimization pipeline | 6 |
| 22 | Visual regression tests | 8 |
| **TOTAL** | | **31 horas** |

---

## Calendario Sugerido

### Semana 1 (P0)
- Lunes a viernes: 2 ingenieros x 8h/dia = 80h
- Marcar 8 issues P0

### Semana 2 (P0 Final + P1 inicio)
- Lunes miercoles: completar P0 pendientes
- Jueves viernes: iniciar Sprint 2

### Semana 3 (P1 + P2)
- Completar Sprint 2 (P1)
- Iniciar Sprint 3 (P2)

### Semana 4 (P2 + Verificacion)
- Completar Sprint 3
- Re-ejecutar auditoria
- Validar go-live Beta

---

## KPIs de Validacion

### Post-Sprint 1:
- [ ] 8 issues P0 resueltos
- [ ] Score accesibilidad: 78 -> 92
- [ ] Coverage tests UI: 0% -> 80%
- [ ] BovedaEvidencia y MonitorSinoe con datos reales
- [ ] JWT migrado a httpOnly cookie
- [ ] Auditoria final pasa 95/100

### Post-Sprint 2-3:
- [ ] Score accesibilidad: 92 -> 98
- [ ] Bundle size: <250KB gz
- [ ] LCP < 1.5s
- [ ] 0 issues criticos
- [ ] CI/CD con tests automaticos

---

## Riesgos de NO ejecutar este plan

1. **Seguridad**: JWT en localStorage = XSS vulnerable
2. **Legal LPDP**: IADisclaimer incompleto = sancion ANPDP
3. **Funcionalidad**: 2 paginas mock = clientes no pueden usar features core
4. **UX**: Modales sin accesibilidad = perdida de usuarios con discapacidad
5. **Compliance**: WCAG 2.1 AA no cumplido en alfa = riesgo regulatorio

---

**RECOMENDACION FINAL**: Ejecutar Sprint 1 (P0) ANTES de go-live Beta.
**Tiempo total**: 2 semanas con 2 ingenieros senior frontend.
**Inversion**: ~$8,000 USD en horas de desarrollo.
**ROI**: Desbloquea go-live Beta con compliance completo.