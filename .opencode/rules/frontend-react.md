---
description: Reglas para código React 19 + Vite
globs:
  - "legalpro-app/src/**/*.{jsx,tsx,ts}"
  - "legalpro-app/src/**/*.{js,ts}"
---

# Reglas Frontend React 19 + Vite 7

Aplicar estas reglas al editar archivos JSX/TSX en `legalpro-app/src/`.

## Stack

- **React 19.2** con TypeScript 6 estricto
- **Vite 7.3** como bundler
- **TailwindCSS 4.2** para estilos
- **React Router 7.13** para navegación
- **Supabase JS** para cliente

## Componentes

- TypeScript estricto (`strict: true`)
- `React.lazy()` + `Suspense` para code splitting por ruta
- Hooks: `useState`, `useEffect`, `useMemo`, `useCallback`, `useContext`
- Custom hooks en `src/hooks/`

## Accesibilidad (WCAG 2.1 AA)

- `aria-label`, `aria-labelledby`, `aria-describedby` en elementos interactivos
- `role` apropiado en componentes custom
- Focus visible con `box-shadow`
- Focus trap en modales
- Skip links
- `prefers-reduced-motion` respetado
- `loading="lazy"` en imágenes
- Lenguaje `es-PE`

## Performance

- Bundle main chunk < 300kb gz
- `React.memo` para componentes puros
- Virtualización para listas largas (100+ items)
- No inline functions en props de componentes grandes

## Seguridad

- NUNCA `dangerouslySetInnerHTML` sin DOMPurify
- NUNCA `localStorage` para JWT (preferir httpOnly cookies)
- Validar input en cliente Y servidor
- Disclaimer IA visible en cada herramienta
- `eslint-plugin-jsx-a11y` activo
