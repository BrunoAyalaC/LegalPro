# Auditoria Frontend LegalPro - Modales y Overlays

> Fecha: 1 de agosto de 2026
> Auditor: @frontend
> Componentes auditados: 28 (13 activos + 11 sin consumidores + 4 nativos)

## 1. Modales Genericos

### 1.1 Modal (`src/components/ui/Modal.jsx`)
- Proposito: Modal generico reutilizable
- Props: `{ open, onClose, title, children, size, footer }`
- Funcionalidades: Backdrop, ESC, focus trap, animaciones, scroll lock
- Accesibilidad: role="dialog", aria-modal, aria-labelledby
- Estado: IMPLEMENTADO pero con 0 consumidores (no adoptado)

### 1.2 Drawer (`src/components/ui/Drawer.jsx`)
- Proposito: Panel lateral deslizante
- Props: `{ open, onClose, position, title }`
- Estado: IMPLEMENTADO pero con 0 consumidores

## 2. Modales Especificos del Dominio

### 2.1 ConfirmModal (`src/components/modals/ConfirmModal.jsx`)
- Proposito: Confirmacion para acciones destructivas
- Props: `{ open, onClose, onConfirm, title, message, variant, confirmText, cancelText }`
- Variantes: danger, warning, info
- Estado: ⚠️ CRITICO - Tiene 0 consumidores, montado NO en App.jsx
- UIContext.confirm() puede dejar promesa pendiente

### 2.2 Lightbox (`src/components/modals/Lightbox.jsx`)
- Proposito: Visor de imagenes expandidas
- Props: `{ images, currentIndex, onClose }`
- Funcionalidades: Navegacion prev/next, zoom, cerrar con ESC
- Estado: IMPLEMENTADO pero sin consumidores

### 2.3 IADisclaimerModal (`src/components/IADisclaimerModal.jsx`)
- Proposito: Modal obligatorio antes de usar IA
- Props: `{ open, onAccept, onDecline }`
- Muestra: 4 disclaimers LPDP (en realidad solo 1)
- Bloquea uso hasta aceptacion: SI
- Estado: PARCIAL - solo 1 disclaimer de 4
- Usado en: RedactorEscritos, GeneradorAlegatos, EstrategiaInterrogatorio

## 3. Overlays

### 3.1 CommandPalette (`src/components/CommandPalette.jsx`)
- Tipo: Overlay con busqueda
- Atajo: Cmd+K / Ctrl+K
- Funcionalidades: Buscar paginas, acciones rapidas
- Estado: PARCIAL - atajo no funciona, abre solo por boton

### 3.2 OnboardingTour (`src/components/onboarding/OnboardingTour.jsx`)
- Tipo: Overlay guiado con spotlight
- Pasos: 5-7 segun rol
- Trigger: Primer login del usuario
- Persistencia: localStorage
- Estado: IMPLEMENTADO completo

## 4. Modales Inline en Paginas

| Pagina | Modal | Trigger |
|--------|-------|---------|
| Clientes | Crear/Editar cliente | Boton "+" |
| Clientes | Confirmar eliminar | alert() nativo |
| Expedientes | Crear/Editar expediente | Boton "+ Nuevo" |
| Expedientes | Confirmar eliminar | ConfirmModal custom |
| Login | Restablecer password | Enlace |
| PanelCreditos | Pasarela de pago | Boton upgrade |
| Perfil | Eliminar cuenta | ConfirmModal custom |
| ChatIA | Limpiar historial | confirm() nativo |
| Perfil | Revocar consentimiento | confirm() nativo |

## 5. Dialogos Nativos

Total: 4 dialogos nativos principales
- `Clientes.jsx`: confirmar soft-delete
- `ChatIA.jsx`: confirmar limpieza del historial
- `Perfil.jsx`: confirmar revocacion de consentimiento (4 tipos)
- `Perfil.jsx`: prompt para motivo de oposicion

## 6. Acciones Destructivas

Total: 5 superficies activas de confirmacion destructiva
1. Eliminar expediente
2. Eliminar cuenta
3. Eliminar cliente
4. Limpiar historial del chat
5. Revocar consentimiento (4 tipos)

## 7. Inventario por Componente

| Componente | Activo | Consumidores |
|-----------|--------|--------------|
| Modal (ui) | SI | 0 |
| Drawer (ui) | SI | 0 |
| ConfirmModal | SI | 0 |
| Lightbox | SI | 0 |
| IADisclaimerModal | SI | 3 |
| CommandPalette | SI | 1 |
| OnboardingTour | SI | 1 |
| Tooltip (ui) | SI | 0 |
| Toast (ui) | SI | N |
| FilterPanel | SI | 0 |
| FilterBar | SI | 0 |
| FilterChip | SI | 0 |
| DateRangePicker | SI | 0 |
| SearchResults | SI | 0 |
| ExpedienteCard | SI | 0 |
| WizardShell | SI | 0 |

## 8. Accesibilidad WCAG 2.1 AA

Sobre los 8 modales activos principales:

| Criterio | Cumplimiento |
|----------|-------------:|
| role="dialog" | 2/8 (25%) |
| aria-modal="true" | 2/8 (25%) |
| Focus trap | 0/8 (0%) |
| Foco inicial | 2/8 (25%) |
| Cierre con Escape | 1/8 (12%) |
| Restauracion del foco | 0/8 (0%) |
| Scroll lock implementado | 0/8 (0%) |
| Fondo marcado como inert | 0/8 (0%) |

**Calidad global de accesibilidad: BAJA**
**No conforme con WCAG 2.1 AA ni APG de dialogo modal.**

## 9. Contraste

- slate-400 sobre #0f172a: 6.96:1 ✅
- slate-500 sobre #0f172a: 3.75:1 ❌ (no cumple 4.5:1)

## 10. Hallazgos Criticos

1. CRITICO: ConfirmModal no esta montado en App.jsx ni Layout.jsx
2. CRITICO: WizardShell usa handleCancel antes de inicializar const
3. CRITICO: Atajo Ctrl+K de CommandPalette no funciona
4. CRITICO: 8/8 modales sin focus trap
5. CRITICO: 6/8 modales sin role="dialog"
6. CRITICO: Modal de eliminacion de cuenta no limpia confirmDeleteText

## 11. Recomendaciones

1. Montar ConfirmModal en App.jsx via UIProvider
2. Corregir handleCancel en WizardShell
3. Agregar listener para lp:openCommand
4. Implementar focus trap en todos los modales
5. Agregar role="dialog" + aria-modal en 6 modales faltantes
6. Migrar alert()/confirm() nativos a ConfirmModal

## Resumen
- Total modales/overlays: 28
- Activos: 13
- Sin consumidores: 11
- Nativos: 4
- Con a11y completo: 0
- Pendientes: 15+